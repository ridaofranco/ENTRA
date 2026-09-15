// ============================================================================
// LA COMISIÓN, EN UN SOLO LUGAR
// ============================================================================
// El cargo que ve el comprador antes de pagar tiene que ser EXACTAMENTE el que
// después le cobra MercadoPago. Hasta acá el 8% estaba escrito a mano en el
// checkout, en la página del evento y en el perfil: si la comisión cambiaba
// —y ahora puede cambiar por evento— la pantalla mentía.
//
// Estas cuentas son las mismas que hace `api/create-payment.ts`, que es el que
// cobra de verdad. Si se toca una, se tocan las dos.

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';

/** Respaldo si nunca se configuró la comisión o si falla la lectura. */
export const COMISION_POR_DEFECTO = 8;
export const IVA = 1.21;
/** Costo del procesador que absorbe el comprador (grossup). */
export const PROCESSOR_GROSSUP = 0.0499;

let cache: { valor: number; hasta: number } | null = null;

/** La comisión global del panel (`platform_config/settings.commissionPercent`). */
export async function comisionGlobal(): Promise<number> {
  const ahora = Date.now();
  if (cache && cache.hasta > ahora) return cache.valor;

  let valor = COMISION_POR_DEFECTO;
  try {
    const snap = await getDoc(doc(db, 'platform_config', 'settings'));
    const num = Number(snap.exists() ? (snap.data() as any)?.commissionPercent : NaN);
    if (Number.isFinite(num) && num >= 0 && num <= 50) valor = num;
  } catch {
    // Que no se caiga una pantalla de compra por no poder leer una config.
  }
  cache = { valor, hasta: ahora + 60_000 };
  return valor;
}

/**
 * La comisión que rige para ESTE evento: la propia si un admin le puso una
 * (0% incluido), si no la global. Igual que en el servidor.
 */
export function comisionDeEvento(event: any, global: number): number {
  const propia = Number(event?.commissionPercent);
  if (Number.isFinite(propia) && propia >= 0 && propia <= 50) return propia;
  return global;
}

/** Lo que paga el comprador sobre un subtotal, con el desglose que se muestra. */
export function calcularTotales(subtotal: number, comisionPct: number) {
  if (!(subtotal > 0)) {
    return { feeConIva: 0, total: 0, processorFee: 0, cargoTotal: 0 };
  }
  const feeConIva = Math.round(subtotal * (comisionPct / 100) * IVA);
  const total = Math.round((subtotal + feeConIva) / (1 - PROCESSOR_GROSSUP));
  return {
    feeConIva,
    total,
    processorFee: Math.max(0, total - subtotal - feeConIva),
    cargoTotal: total - subtotal,
  };
}
