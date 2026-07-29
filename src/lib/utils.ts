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
  if (end) return end;
  const start = toDate(event?.date);
  if (!start) return null;
  return new Date(start.getTime() + 3 * 60 * 60 * 1000);
}

// Un evento con fecha "a confirmar" (isDateTBD) nunca cuenta como finalizado.
export function isEventFinished(event: { date?: any; endDate?: any; isDateTBD?: boolean }): boolean {
  if (event?.isDateTBD) return false;
  const end = getEventEnd(event);
  return !!end && end.getTime() < Date.now();
}
