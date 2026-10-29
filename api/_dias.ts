// ============================================================================
// DÍAS DE UN EVENTO DE VARIOS DÍAS (qué habilita cada entrada y cuánto se cobra)
// ============================================================================
// Hasta el 28/10/2026 el servidor leía `event.validDays`, un campo que NADIE
// escribe: los días que elegía el comprador se quedaban en el navegador. Efecto:
// en "un QR por día" se mostraba el precio por los días elegidos pero se cobraba
// uno solo y salía un único QR sin días; en "un QR para todo el evento" la
// entrada se quemaba el primer día.
//
// Ahora la regla vive acá, en UN lugar, y la usan create-payment (cobrar y, si es
// gratis, emitir) y _emitir-entradas (emitir lo pagado):
//
//   - Evento de un día: nada cambia. Una entrada, sin días, se usa una vez.
//   - Varios días, "un QR por día" (entryMode 'per_day'): el comprador elige
//     jornadas. Se validan contra los días REALES del evento (un día que no
//     existe se rechaza), el precio se multiplica por la cantidad de días y sale
//     un QR por día.
//   - Varios días, "un QR para todo el evento" (cualquier otro modo): es un
//     abono. Se cobra una vez, sale un QR con TODOS los días del evento y el
//     control de acceso lo deja entrar una vez por día (usedDays).
//
// Las claves de día son YYYY-MM-DD en hora de Argentina, la misma clave que arma
// el control de acceso con la fecha del celular de la puerta. El servidor corre
// en UTC: sin fijar la zona, una jornada que empieza a las 22 h caería en el día
// siguiente.

export const TZ_AR = 'America/Argentina/Buenos_Aires';

const fmtClave = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ_AR,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Timestamp de Firestore (admin o cliente), {seconds} o Date → 'YYYY-MM-DD' en hora argentina. */
export function claveDiaAR(fecha: any): string | null {
  let dt: Date | null = null;
  if (fecha instanceof Date) dt = fecha;
  else if (fecha && typeof fecha.toDate === 'function') dt = fecha.toDate();
  else if (fecha && typeof fecha.seconds === 'number') dt = new Date(fecha.seconds * 1000);
  else if (fecha && typeof fecha._seconds === 'number') dt = new Date(fecha._seconds * 1000);
  if (!dt || Number.isNaN(dt.getTime())) return null;
  return fmtClave.format(dt); // en-CA da 2026-10-28
}

/** Días del evento como claves ordenadas y sin repetir. Vacío si no es de varios días. */
export function diasDelEvento(event: any): string[] {
  if (!event?.isMultiDay || !Array.isArray(event.days)) return [];
  const claves = event.days.map((d: any) => claveDiaAR(d?.date)).filter(Boolean) as string[];
  return Array.from(new Set(claves)).sort();
}

export type PlanDias = {
  /** El evento tiene varios días cargados. */
  multiDia: boolean;
  /** Un QR por día (true) o un abono para todo el evento (false). */
  porDia: boolean;
  /** Días que habilita la compra (en orden). Vacío en eventos de un día. */
  dias: string[];
  /** Por cuánto se multiplica el precio de cada entrada. */
  multiplicador: number;
};

// Sin strictNullChecks en este repo, una unión discriminada por booleano no se
// achica: se devuelve plan o error, uno de los dos en null.
export type ResultadoDias = { plan: PlanDias | null; error: string | null };

/**
 * Resuelve qué días habilita una compra a partir del evento REAL y de lo que
 * pidió el navegador. Nunca confía en el navegador: los días pedidos tienen que
 * existir en el evento, y en el abono se ignoran (habilita todos).
 */
export function resolverDias(event: any, pedidos: unknown): ResultadoDias {
  const delEvento = diasDelEvento(event);
  if (delEvento.length === 0) {
    return { plan: { multiDia: false, porDia: false, dias: [], multiplicador: 1 }, error: null };
  }

  if (event.entryMode !== 'per_day') {
    return { plan: { multiDia: true, porDia: false, dias: delEvento, multiplicador: 1 }, error: null };
  }

  if (!Array.isArray(pedidos) || pedidos.length === 0) {
    return { plan: null, error: 'Elegí al menos un día del evento.' };
  }
  if (pedidos.length > 366 || pedidos.some((d) => typeof d !== 'string')) {
    return { plan: null, error: 'Los días elegidos no son válidos.' };
  }
  const unicos = Array.from(new Set(pedidos as string[]));
  const inexistentes = unicos.filter((d) => !delEvento.includes(d));
  if (inexistentes.length > 0) {
    return { plan: null, error: 'Alguno de los días elegidos no es un día de este evento. Volvé al evento y elegilos de nuevo.' };
  }
  const dias = unicos.sort();
  return { plan: { multiDia: true, porDia: true, dias, multiplicador: dias.length }, error: null };
}

/**
 * Cómo se reparte la emisión de UNA entrada comprada: un grupo por QR, y cada
 * grupo dice qué días habilita ese QR. Por día: un QR por jornada. Abono: un QR
 * con todos los días. Un día: un QR sin días (uso único de siempre).
 */
export function gruposDeEmision(plan: Pick<PlanDias, 'porDia' | 'dias'>): string[][] {
  if (plan.porDia && plan.dias.length > 0) return plan.dias.map((d) => [d]);
  return [plan.dias];
}

/**
 * Los días con los que se emite una orden ya pagada. Sale de la ORDEN (lo que se
 * cobró), no del evento. Las órdenes creadas antes de este cambio no tienen el
 * dato: para esas se mantiene lo que se cobró entonces (un QR por entrada), y si
 * el evento es un abono se le ponen todos sus días, que es lo que compró.
 */
export function diasDeLaOrden(orderData: any, event: any): Pick<PlanDias, 'porDia' | 'dias'> {
  if (Array.isArray(orderData?.validDays)) {
    const dias = orderData.validDays.filter((d: unknown) => typeof d === 'string') as string[];
    return { porDia: Boolean(orderData.porDia) && dias.length > 0, dias };
  }
  const delEvento = diasDelEvento(event);
  if (delEvento.length > 0 && event.entryMode !== 'per_day') {
    return { porDia: false, dias: delEvento };
  }
  return { porDia: false, dias: [] };
}
