// Traducción de estados a español para mostrar al usuario.
// Antes las ramas "fallback" imprimían el enum crudo en inglés (pending, cancelled, used…).

export function estadoOrden(status?: string): string {
  switch (status) {
    case 'confirmed': return 'Confirmada';
    case 'pending': return 'Pendiente';
    case 'cancelled': return 'Cancelada';
    case 'refunded': return 'Devuelta';
    default: return '—';
  }
}

export function estadoTicket(status?: string): string {
  switch (status) {
    case 'valid': return 'Válido';
    case 'used': return 'Usada';
    case 'cancelled': return 'Cancelada';
    case 'refunded': return 'Devuelta';
    default: return '—';
  }
}
