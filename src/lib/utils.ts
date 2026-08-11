import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// ==================== FIN DE EVENTO ====================
// REGLA DE PRODUCTO (unica fuente de verdad, usarla en badges, bloqueos y listados):
// - Si el productor cargo una hora de fin (endDate), el evento finaliza exactamente ahi.
//   Los eventos multi-dia tambien guardan endDate (el ultimo dia).
// - Si no hay endDate, el evento se da por finalizado 3 horas despues del inicio.
//   Ese margen evita cortar la venta en puerta apenas arranca el evento.
export function getEventEnd(event: { date?: any; endDate?: any }): Date | null {
  const toDate = (raw: any): Date | null => {
    const d = raw?.toDate
      ? raw.toDate()
      : raw?.seconds
      ? new Date(raw.seconds * 1000)
      : raw instanceof Date
      ? raw
      : null;
    return d && !isNaN(d.getTime()) ? d : null;
  };
  const end = toDate(event?.endDate);
  const start = toDate(event?.date);
  // UN endDate ANTERIOR AL INICIO ES BASURA, NO UN FIN.
  // Detectado el 11/8/2026 en produccion: "Festival ENTRÁ · Demo 2026" figuraba con
  // fecha 22/1/2028 y aun asi caia en "Ya pasaron", invisible en la home y en la
  // cartelera, con 540 entradas a la venta que nadie podia ver.
  // Como se llega a ese estado: el evento es multi-dia y el modal de edicion del
  // panel saltea TODO el bloque de endDate cuando isMultiDay es true (solo valida
  // fin > inicio para los de un dia). Se mueve la fecha de inicio hacia adelante,
  // el endDate viejo queda intacto, y como aca tenia prioridad absoluta el evento
  // quedaba terminado para siempre.
  // Ignorarlo arregla de una todos los eventos que ya esten asi, sin migrar datos.
  if (end && (!start || end.getTime() > start.getTime())) return end;
  if (!start) return null;
  return new Date(start.getTime() + 3 * 60 * 60 * 1000);
}

// Un evento con fecha "a confirmar" (isDateTBD) nunca cuenta como finalizado.
export function isEventFinished(event: { date?: any; endDate?: any; isDateTBD?: boolean }): boolean {
  if (event?.isDateTBD) return false;
  const end = getEventEnd(event);
  return !!end && end.getTime() < Date.now();
}
