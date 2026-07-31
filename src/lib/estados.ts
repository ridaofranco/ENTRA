// Traducción de estados para mostrar al usuario.
// Antes las ramas "fallback" imprimían el enum crudo en inglés (pending, cancelled, used…).
//
// El idioma es opcional y por default sigue siendo español, así que las pantallas
// del panel (que son en español a propósito) no cambian. Las del comprador le
// pasan el idioma elegido.

import type { Lang } from './i18n';

export function estadoOrden(status?: string, lang: Lang = 'es'): string {
  if (lang === 'en') {
    switch (status) {
      case 'confirmed': return 'Confirmed';
      case 'pending': return 'Pending';
      case 'cancelled': return 'Cancelled';
      case 'refunded': return 'Refunded';
      default: return '—';
    }
  }
  switch (status) {
    case 'confirmed': return 'Confirmada';
    case 'pending': return 'Pendiente';
    case 'cancelled': return 'Cancelada';
    case 'refunded': return 'Devuelta';
    default: return '—';
  }
}

export function estadoTicket(status?: string, lang: Lang = 'es'): string {
  if (lang === 'en') {
    switch (status) {
      case 'valid': return 'Valid';
      case 'used': return 'Used';
      case 'cancelled': return 'Cancelled';
      case 'refunded': return 'Refunded';
      default: return '—';
    }
  }
  switch (status) {
    case 'valid': return 'Válido';
    case 'used': return 'Usada';
    case 'cancelled': return 'Cancelada';
    case 'refunded': return 'Devuelta';
    default: return '—';
  }
}
