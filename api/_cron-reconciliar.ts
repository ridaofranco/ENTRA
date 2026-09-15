// ============================================================================
// RECONCILIAR PAGOS — rescatar lo que el webhook nunca supo
// ============================================================================
// El 15/9/2026 Agustín pagó su entrada y no le llegó nada. En los logs estaba la
// orden creada… y ningún webhook. MercadoPago nunca avisó del pago, así que la
// orden quedó 'pending' para siempre y el ticket no se emitió nunca. Nadie se
// entera: del lado del comprador el dinero salió, y del nuestro no pasó nada.
//
// Mientras el webhook sea el único camino, un aviso perdido es una entrada
// perdida. Esta tarea es el camino de atrás: cada pocos minutos mira las órdenes
// que siguen pendientes, le PREGUNTA a MercadoPago si esa compra se pagó, y si
// está aprobada emite igual que el webhook (misma función, misma transacción,
// mismo control de plata).
//
// Se le da un margen de gracia antes de mirar una orden: el webhook normal tarda
// segundos, y no tiene sentido competirle. Y se ignoran las viejas: si en tres
// días no apareció un pago aprobado, no va a aparecer.

import { MercadoPagoConfig, Payment } from 'mercadopago';
import { getAdminDb } from './_lib/firebaseAdmin.js';
import { emitirOrdenPagada, PermanentError } from './_emitir-entradas.js';
import { alerta } from './_alerta.js';

// El webhook normal llega en segundos. Antes de este margen no se toca la orden.
const GRACIA_MS = 4 * 60 * 1000;
// Más allá de esto, si no hay pago aprobado no lo va a haber.
const VENTANA_MS = 72 * 60 * 60 * 1000;
// Techo de órdenes a mirar por corrida, para no barrer la colección entera.
const MAX_POR_CORRIDA = 40;

function aMillis(v: any): number {
  if (!v) return 0;
  if (typeof v?.toMillis === 'function') return v.toMillis();
  if (typeof v?.seconds === 'number') return v.seconds * 1000;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

export async function correrReconciliarPagos() {
  const db = getAdminDb();
  const ahora = Date.now();

  // Sin orderBy a propósito: filtrar por estado + rango de fecha pediría un índice
  // compuesto, y un índice que falta es una tarea que no corre nunca. Se traen las
  // pendientes y se filtra la ventana en memoria, que son pocas.
  const snap = await db.collection('orders').where('status', '==', 'pending').limit(300).get();

  const candidatas = snap.docs
    .map((d) => ({ id: d.id, data: d.data() as any }))
    .filter(({ data }) => {
      const creada = aMillis(data.createdAt);
      if (!creada) return false;
      const edad = ahora - creada;
      return edad > GRACIA_MS && edad < VENTANA_MS;
    })
    .slice(0, MAX_POR_CORRIDA);

  let rescatadas = 0;
  let miradas = 0;

  for (const { id: orderId, data: orden } of candidatas) {
    miradas++;
    try {
      // El pago vive en la cuenta del PRODUCTOR cuando la venta fue por split, así
      // que hay que preguntarle a MP con SU token; si no, con el de ENTRÁ.
      let accessToken = process.env.MP_ACCESS_TOKEN;
      // De qué cuenta se preguntó. Importa: si la venta fue por split y acá
      // cayéramos al token de ENTRÁ, estaríamos buscando el pago en la cuenta
      // equivocada y "no hay pagos" no querría decir "no pagó". Sin este dato la
      // conclusión no se puede sostener.
      let tokenSrc = 'plataforma';
      if (orden.collectorId) {
        const acc = await db.collection('mp_accounts').doc(String(orden.collectorId)).get();
        const tok = acc.exists ? (acc.data() as any)?.access_token : null;
        if (tok) { accessToken = tok; tokenSrc = `seller:${orden.collectorId}`; }
        else tokenSrc = `SIN TOKEN DEL SELLER ${orden.collectorId} (busco con el de ENTRÁ)`;
      }
      if (!accessToken) continue;

      const mp = new MercadoPagoConfig({ accessToken });
      const encontrados: any = await new Payment(mp).search({
        options: { external_reference: orderId },
      });
      const pagos: any[] = encontrados?.results || [];
      const aprobado = pagos.find((p) => p?.status === 'approved');
      if (!aprobado) {
        // Sin esto, "rescatadas=0" no distingue dos situaciones muy distintas:
        // que la persona no haya pagado, o que haya pagado y no lo estemos viendo
        // (token equivocado, pago en otra cuenta, búsqueda que no devuelve nada).
        // Cuando alguien dice "pagué y no me llegó", esta línea es la respuesta.
        console.log(
          `[reconciliar] orden=${orderId} sin pago aprobado · token=${tokenSrc} · ${pagos.length} intento(s): ` +
            (pagos.map((p) => `${p?.id}:${p?.status}/${p?.status_detail || '—'}`).join(', ') || 'ninguno'),
        );
        continue;
      }

      console.log(`[reconciliar] orden=${orderId} tenía un pago APROBADO (${aprobado.id}) del que nunca llegó el webhook`);
      const { emitidos } = await emitirOrdenPagada(orderId, aprobado, String(aprobado.id), 'reconciliacion');
      if (emitidos > 0) {
        rescatadas++;
        // Que Franco se entere: que esto rescate algo significa que el webhook
        // falló, y eso hay que mirarlo aunque la entrada ya haya salido.
        await alerta({
          titulo: 'Un pago se emitió por reconciliación: el webhook de MercadoPago no avisó',
          plata: true,
          datos: { orden: orderId, pago: String(aprobado.id), comprador: orden.buyerEmail || null },
          detalle: `Se emitieron ${emitidos} entrada(s) al reconciliar. El comprador había pagado y estaba sin su entrada.`,
          clave: 'reconciliacion-rescate',
        });
      }
    } catch (e: any) {
      const permanente = e instanceof PermanentError;
      console.error(`[reconciliar] orden=${orderId} falló${permanente ? ` (${e.code})` : ''}:`, e?.message || e);
      if (permanente) {
        await db.collection('orders').doc(orderId).update({
          status: 'needs_attention',
          issueCode: e.code,
          issueMessage: String(e.message).slice(0, 500),
        }).catch(() => {});
      }
    }
  }

  console.log(`[reconciliar] pendientes miradas=${miradas} rescatadas=${rescatadas}`);
  return { ok: true, miradas, rescatadas };
}
