/**
 * IDIOMA DE ENTRÁ: español por default, inglés automático si el comprador no
 * habla español. Espeja el patrón ya aprobado de PASE (`pase/src/i18n.ts`).
 *
 * ── QUÉ CUBRE ──
 * SOLO el flujo de COMPRA (lo que ve un comprador extranjero): cartelera,
 * detalle del evento, checkout, confirmación y reclamo de transferencia.
 * El panel de productor/admin queda en español a propósito: lo usa el equipo
 * de la casa y no hay razón para traducir 15 pantallas que nadie de afuera ve.
 *
 * ── CÓMO DECIDE, en este orden ──
 * 1. `?lang=en` en la URL (para links que se comparten a audiencias en inglés).
 * 2. La elección manual guardada (`localStorage`, clave `entra_lang`).
 * 3. El idioma del navegador: si no arranca con `es`, va en inglés.
 * 4. Español.
 *
 * A diferencia de PASE (que resuelve una vez por render), ENTRÁ es una SPA con
 * un switcher en el navbar: `useLang()` usa useSyncExternalStore para que TODAS
 * las pantallas re-rendericen al instante cuando el comprador cambia de idioma.
 */
import { useSyncExternalStore } from 'react';

export type Lang = 'es' | 'en';

const CLAVE = 'entra_lang';

export function detectarIdioma(): Lang {
  try {
    // 1. Forzado por URL (links compartidos: entratickets.com/evento/x?lang=en)
    const enUrl = new URLSearchParams(window.location.search).get('lang');
    if (enUrl === 'en' || enUrl === 'es') {
      localStorage.setItem(CLAVE, enUrl);
      return enUrl;
    }
    // 2. Elección manual previa.
    const guardado = localStorage.getItem(CLAVE);
    if (guardado === 'en' || guardado === 'es') return guardado;
    // 3. El idioma del navegador.
    const nav = (navigator.languages?.[0] || navigator.language || 'es').toLowerCase();
    return nav.startsWith('es') ? 'es' : 'en';
  } catch {
    // Sin window (build) o storage bloqueado: español, que es el default.
    return 'es';
  }
}

let idiomaActual: Lang = detectarIdioma();
const oyentes = new Set<() => void>();

export function setLang(l: Lang) {
  idiomaActual = l;
  try {
    localStorage.setItem(CLAVE, l);
  } catch {
    /* si el navegador bloquea el storage, vale para esta visita nada más */
  }
  oyentes.forEach((fn) => fn());
}

export function getLang(): Lang {
  return idiomaActual;
}

/** Hook: el idioma vivo. Cambia el switcher → re-renderiza la pantalla. */
export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      oyentes.add(cb);
      return () => {
        oyentes.delete(cb);
      };
    },
    () => idiomaActual,
    () => 'es' as Lang,
  );
}

/** Locale para fechas: las fechas también se leen en el idioma del comprador. */
export const dateLocale = (l: Lang): string => (l === 'es' ? 'es-AR' : 'en-US');

// ============================================================================
// LOS TEXTOS. Español = fuente de verdad; `en` está tipado contra `es` para
// que TypeScript avise si a un idioma le falta una clave.
// Los precios NO se tocan: siempre ARS con formatCurrency (es-AR).
// ============================================================================

const es = {
  nav: {
    eventos: 'Eventos',
    productores: 'Productores',
    ayuda: 'Ayuda',
  },
  footer: {
    eventos: 'Eventos',
    productores: 'Productores',
    ayuda: 'Ayuda',
    sobre: 'Sobre Nosotros',
    terminos: 'Términos',
    privacidad: 'Privacidad',
    blog: 'Blog',
  },
  comun: {
    cargando: 'Cargando...',
    gratis: 'Gratis',
    subtotal: 'Subtotal',
    total: 'Total',
    proximamente: 'PROXIMAMENTE',
    lugarPorConfirmar: 'LUGAR POR CONFIRMAR',
    fechaAConfirmar: 'Fecha a confirmar',
    verOtrosEventos: 'Ver otros eventos',
  },
  cartelera: {
    kicker: 'CARTELERA OFICIAL',
    tituloA: 'Lo que ',
    tituloB: 'viene.',
    bajada:
      'Comprá tus entradas en segundos, con precio claro desde el principio y un QR oficial que nadie te puede clonar.',
    porQueTitulo: 'Por qué comprar en ENTRÁ',
    beneficios: [
      {
        titulo: 'Precio claro de entrada.',
        desc: 'Ves cada peso desde el inicio. El costo total está a la vista, sin cargos fantasma de último momento en el checkout.',
      },
      {
        titulo: 'Tu entrada segura.',
        desc: 'QR único e intransferible que no se clona. Si decidís no ir, podés transferirla de forma oficial y el tuyo deja de existir.',
      },
      {
        titulo: 'Comprá sin crearte cuenta.',
        desc: 'No necesitás validar mails ni recordar contraseñas. Pagás con Mercado Pago como invitado y te enviamos tu QR al mail/WhatsApp.',
      },
    ],
    buscarPlaceholder: 'Buscá por evento, artista o lugar...',
    categoriaTodos: 'Todos',
    tabProximos: 'Próximos',
    tabPasados: 'Pasados',
    tabTodos: 'Todos',
    filtrarPorFecha: 'Filtrar por fecha',
    errorCargarTitulo: 'Error al cargar eventos',
    errorPermisos: 'Permiso denegado. Revisá las reglas de Firebase Firestore.',
    errorCargarDetalle: (m: string) => `No se pudieron cargar los eventos: ${m}`,
    errorDesconocido: 'error desconocido',
    vacioTitulo: 'Todavía no hay eventos',
    vacioBajada: 'Volvé pronto, se vienen cosas buenas. Nos vemos adentro.',
    badgeAbierto: 'ABIERTO',
    badgeEliminado: 'ELIMINADO',
    badgeFinalizado: 'FINALIZADO',
    badgeAgotado: 'AGOTADO',
    badgePendiente: 'PENDIENTE',
    badgeProgramado: 'PROGRAMADO',
    badgePausado: 'VENTA PAUSADA',
    badgePausadoCorto: 'PAUSADO',
    badgeUltimas: 'ÚLTIMAS ENTRADAS',
    ctaOrganizasTitulo: '¿Organizás eventos?',
    ctaOrganizasBajada:
      'Vendé tus entradas en ENTRÁ y cobrá el 100% neto del valor de tu ticket sin costos sorpresivos.',
    ctaOrganizasBoton: 'Quiero vender entradas',
    // Texto que se precarga en el WhatsApp del CTA de productores.
    ctaOrganizasWhatsapp: '¡Hola! Quiero vender mis eventos con ENTRÁ',
  },
  evento: {
    noEncontrado: 'Evento no encontrado',
    eliminadoTitulo: 'Evento no disponible',
    eliminadoBajada: 'Este evento fue eliminado y ya no está disponible.',
    rangoFechas: (a: string, b: string) => `Del ${a} al ${b}`,
    jornadasCortas: (n: number) => `${n} jornadas`,
    compartir: 'Compartir',
    linkCopiado: 'Link copiado',
    agregarCalendario: 'Agregar al calendario',
    sobreEvento: 'Sobre el evento',
    jornadasTitulo: (n: number) => `Jornadas (${n} días)`,
    horaRango: (a: string, b?: string) => `${a}${b ? ` a ${b}` : ''} hs`,
    ubicacion: 'Ubicación',
    verMaps: 'Ver en Google Maps',
    canceladoTitulo: 'Evento cancelado',
    canceladoBajada:
      'El organizador canceló este evento. Si tenías entrada, te mandamos un mail con los detalles.',
    finalizadoTitulo: 'Evento finalizado',
    finalizadoBajada: 'Este evento ya pasó y la venta de entradas está cerrada.',
    pausadoTitulo: 'Venta pausada',
    pausadoBajada:
      'El organizador pausó temporalmente la venta de entradas. Volvé a revisar en un rato.',
    soldOutTitulo: 'SOLD OUT',
    soldOutBajada:
      'Todas las entradas disponibles de todas las tandas fueron vendidas. ¡Nos vemos adentro!',
    verCartelera: 'Ver cartelera',
    reservaTuLugar: 'RESERVÁ TU LUGAR',
    entradas: 'ENTRADAS',
    elegiDias: 'Elegí tus días',
    diaN: (n: number) => `Día ${n}`,
    reservasSoloDias: 'Reservás solo los días que vas a ir.',
    pagasSoloDias: 'Pagás solo por los días que elegís.',
    estadoAbierto: 'ACCESO ABIERTO',
    estadoAgotado: 'AGOTADO',
    estadoFinalizado: 'FINALIZADO',
    estadoProximaTanda: 'PRÓXIMA TANDA',
    estadoUltimos: 'ÚLTIMOS ACCESOS',
    cargoServicio: 'Cargo de Servicio (8% + IVA)',
    costoProcesador: 'Costo Procesador (4.99%)',
    reserva: 'Reserva',
    totalFinal: 'Total Final',
    entradasCount: (n: number): string => (n === 1 ? 'entrada' : 'entradas'),
    diasCount: (n: number) => `${n} día${n === 1 ? '' : 's'}`,
    elegiUnDia: 'Elegí al menos un día arriba',
    botonReservar: 'RESERVAR',
    botonComprar: 'ENTRÁ',
    notaReserva: 'Reserva sin cargo · Sin registro obligatorio · nos vemos adentro',
    notaCompra: 'Compra segura · Sin registro obligatorio · nos vemos adentro',
    shareTexto: (t: string) => `${t} — conseguí tus entradas en ENTRÁ`,
    // Archivo .ics de "Agregar al calendario": lo abre la app de calendario del comprador.
    icsDescripcion: 'Evento en ENTRÁ',
    icsArchivo: 'evento',
  },
  checkout: {
    pagoConfirmado: '¡Pago confirmado!',
    pagoEnProceso: 'Pago en proceso',
    pagoNoCompletado: 'El pago no se completó',
    retornoOk:
      'Estamos generando tus entradas. Te las enviamos por email y quedan disponibles en tu perfil. Puede tardar unos segundos en impactar.',
    retornoPendiente:
      'MercadoPago todavía está acreditando el pago. Cuando se apruebe, te enviamos las entradas por email automáticamente.',
    retornoFallo: 'No se realizó ningún cobro. Podés intentar la compra de nuevo cuando quieras.',
    ordenNro: (o: string) => `Orden #${o}`,
    verMisEntradas: 'Ver mis entradas',
    volverEventos: 'Volver a los eventos',
    irInicio: 'Ir al inicio',
    tusDatos: 'Tus Datos',
    loginRapida: 'Inicia sesión para una compra más rápida',
    iniciarSesion: 'Iniciar Sesión',
    nombreCompleto: 'Nombre Completo',
    nombrePlaceholder: 'Como figura en tu documento',
    email: 'Email',
    emailPlaceholder: 'tu@email.com',
    dni: 'DNI',
    dniPlaceholder: 'Sin puntos ni espacios',
    telefono: 'Teléfono',
    telefonoPlaceholder: 'Ej: 1155443322',
    siguiente: 'Siguiente: Revisar y Confirmar',
    revisarCompra: 'Revisar Compra',
    datosComprador: 'Datos del Comprador',
    nombreLabel: 'Nombre:',
    emailLabel: 'Email:',
    dniLabel: 'DNI:',
    editar: 'Editar',
    entradasTitulo: 'Entradas',
    volver: 'Volver',
    procesando: 'Procesando...',
    confirmarReserva: 'Confirmar Reserva',
    confirmarCompra: 'Confirmar Compra',
    completaCampos: 'Por favor completa todos los campos',
    compraError: 'No se pudo procesar la compra. Intentá de nuevo.',
    compraError2: 'Error al procesar la compra. Por favor intenta nuevamente.',
    reservaConfirmada: '¡Reserva Confirmada!',
    compraExitosa: '¡Compra Exitosa!',
    entradasGeneradas: (n: number): string => (n === 1 ? 'entrada generada' : 'entradas generadas'),
    descargarEntradas: (n: number) =>
      `Descargar ${n === 1 ? 'mi entrada' : `mis ${n} entradas`} (PDF imprimible)`,
    entradaDe: (i: number, n: number) => `Entrada #${i} de ${n}`,
    titular: 'Titular',
    dniPrefix: (d: string) => `DNI ${d}`,
    copiarCodigo: 'Copiar código',
    descargarPDF: 'Descargar PDF',
    listoTitulo: '¡Listo! Tus entradas están acá 👇',
    listoBajada: (email: string) =>
      `Guardá o descargá el QR y presentalo en la puerta. También te mandamos una copia a ${email}; si no la ves, revisá el spam o descargá las entradas desde acá.`,
    verMisEntradasBtn: 'Ver Mis Entradas',
    seguirExplorando: 'Seguir Explorando',
    compraCompletada: 'Compra Completada',
    finalizarCompra: 'Finalizar Compra',
    cadaUno: 'c/u',
    codigoPlaceholder: 'CÓDIGO',
    aplicar: 'APLICAR',
    descuentoAplicado: 'Descuento aplicado',
    descuentoLinea: (v: string) => `Descuento (${v})`,
    descuentoFijo: 'Fijo',
    cargoPorServicio: 'Cargo por servicio',
    incluyeServicio: 'Incluye el servicio de ENTRÁ y el procesamiento del pago.',
    comisionEntra: 'Comisión ENTRÁ',
    gratisTag: 'Gratis',
    notaSeguridad: 'Tu compra está protegida por ENTRA. Tus datos personales no son compartidos.',
    codigoInvalido: 'Código inválido o no disponible',
    codigoExpirado: 'Este código ha expirado',
    codigoLimite: 'Este código ya alcanzó su límite de usos',
    codigoError: 'Error al validar el código',
    codigoAplicado: '¡Código aplicado con éxito!',
    ticketValido: 'VÁLIDO',
    ticketFecha: 'Fecha',
    ticketLugar: 'Lugar',
  },
  claim: {
    linkInvalido: 'Link inválido',
    noExiste: 'Esta transferencia no existe o el link es inválido.',
    yaReclamado: 'Este ticket ya fue reclamado por alguien más.',
    cancelada: 'La transferencia fue cancelada por el remitente.',
    eventoPaso: 'Este evento ya pasó. No se puede reclamar el ticket.',
    errorCargar: 'Error al cargar la transferencia. Intentá de nuevo.',
    propio: 'No podés reclamar tu propio ticket.',
    enviadoA: (e: string) =>
      `Este ticket fue enviado a ${e}. Iniciá sesión con esa cuenta para reclamarlo.`,
    noSePudo: 'No se pudo reclamar el ticket. Intentá de nuevo.',
    noSePuede: 'No se puede reclamar',
    volverEntra: 'Volver a ENTRÁ',
    reclamadoTitulo: '¡Ticket reclamado!',
    reclamadoBajada: 'Ya es tuyo. Lo vas a ver en tu sección "Mis Tickets".',
    redirigiendo: 'Redirigiendo...',
    teTransfirieron: 'Te transfirieron un ticket',
    alguien: 'Alguien',
    teEnvioSufijo: 'te envió un ticket por ENTRÁ',
    para: 'Para:',
    tipo: 'Tipo:',
    noEsParaVos: 'Este ticket no es para vos',
    noEsParaVosDetalle: (e: string) =>
      `Fue enviado a ${e}. Tenés que cerrar sesión e iniciar con esa cuenta para poder reclamarlo.`,
    iniciaCon: (e: string) => `Iniciá sesión con ${e}`,
    iniciaORegistrate: 'Iniciá sesión o registrate para reclamar',
    reclamando: 'Reclamando...',
    reclamarGratis: 'Reclamar ticket gratis',
    alReclamar:
      'Al reclamar, el ticket pasa a estar a tu nombre y el QR original del remitente queda invalidado.',
  },
};

// Traducción de VENTA (natural, no literal). Los precios quedan en ARS tal cual.
const en: typeof es = {
  nav: {
    eventos: 'Events',
    productores: 'Organizers',
    ayuda: 'Help',
  },
  footer: {
    eventos: 'Events',
    productores: 'Organizers',
    ayuda: 'Help',
    sobre: 'About Us',
    terminos: 'Terms',
    privacidad: 'Privacy',
    blog: 'Blog',
  },
  comun: {
    cargando: 'Loading...',
    gratis: 'Free',
    subtotal: 'Subtotal',
    total: 'Total',
    proximamente: 'COMING SOON',
    lugarPorConfirmar: 'VENUE TBA',
    fechaAConfirmar: 'Date TBA',
    verOtrosEventos: 'See other events',
  },
  cartelera: {
    kicker: 'OFFICIAL LISTINGS',
    tituloA: 'Coming ',
    tituloB: 'up.',
    bajada:
      'Get your tickets in seconds, with the full price upfront and an official QR code no one can clone.',
    porQueTitulo: 'Why buy on ENTRÁ',
    beneficios: [
      {
        titulo: 'Clear pricing, upfront.',
        desc: 'You see every peso from the start. The total cost is in plain sight — no surprise fees at the last step of checkout.',
      },
      {
        titulo: 'Your ticket, secured.',
        desc: "A unique QR code that can't be cloned. If you can't make it, transfer it officially and your old code stops working.",
      },
      {
        titulo: 'Buy without an account.',
        desc: 'No email verification, no passwords to remember. Pay with Mercado Pago as a guest and we send your QR code by email/WhatsApp.',
      },
    ],
    buscarPlaceholder: 'Search by event, artist or venue...',
    categoriaTodos: 'All',
    tabProximos: 'Upcoming',
    tabPasados: 'Past',
    tabTodos: 'All',
    filtrarPorFecha: 'Filter by date',
    errorCargarTitulo: 'Error loading events',
    errorPermisos: 'Permission denied. Check your Firebase Firestore rules.',
    errorCargarDetalle: (m: string) => `We couldn't load the events: ${m}`,
    errorDesconocido: 'unknown error',
    vacioTitulo: 'No events yet',
    vacioBajada: 'Check back soon — good things are coming. See you inside.',
    badgeAbierto: 'ON SALE',
    badgeEliminado: 'REMOVED',
    badgeFinalizado: 'ENDED',
    badgeAgotado: 'SOLD OUT',
    badgePendiente: 'PENDING',
    badgeProgramado: 'SCHEDULED',
    badgePausado: 'SALES PAUSED',
    badgePausadoCorto: 'PAUSED',
    badgeUltimas: 'LAST TICKETS',
    ctaOrganizasTitulo: 'Do you run events?',
    ctaOrganizasBajada:
      'Sell your tickets on ENTRÁ and keep 100% of your ticket price, with no surprise costs.',
    ctaOrganizasBoton: 'I want to sell tickets',
    ctaOrganizasWhatsapp: "Hi! I'd like to sell my events with ENTRÁ",
  },
  evento: {
    noEncontrado: 'Event not found',
    eliminadoTitulo: 'Event unavailable',
    eliminadoBajada: 'This event was removed and is no longer available.',
    rangoFechas: (a: string, b: string) => `From ${a} to ${b}`,
    jornadasCortas: (n: number) => `${n} days`,
    compartir: 'Share',
    linkCopiado: 'Link copied',
    agregarCalendario: 'Add to calendar',
    sobreEvento: 'About this event',
    jornadasTitulo: (n: number) => `Schedule (${n} days)`,
    horaRango: (a: string, b?: string) => `${a}${b ? ` to ${b}` : ''}`,
    ubicacion: 'Location',
    verMaps: 'Open in Google Maps',
    canceladoTitulo: 'Event cancelled',
    canceladoBajada:
      'The organizer cancelled this event. If you had a ticket, we sent you an email with the details.',
    finalizadoTitulo: 'Event ended',
    finalizadoBajada: 'This event already took place and ticket sales are closed.',
    pausadoTitulo: 'Sales paused',
    pausadoBajada:
      'The organizer has temporarily paused ticket sales. Check back in a little while.',
    soldOutTitulo: 'SOLD OUT',
    soldOutBajada: 'Every available ticket in every release has been sold. See you inside!',
    verCartelera: 'Browse events',
    reservaTuLugar: 'RESERVE YOUR SPOT',
    entradas: 'TICKETS',
    elegiDias: 'Pick your days',
    diaN: (n: number) => `Day ${n}`,
    reservasSoloDias: "You only reserve the days you'll attend.",
    pagasSoloDias: 'You only pay for the days you pick.',
    estadoAbierto: 'ON SALE',
    estadoAgotado: 'SOLD OUT',
    estadoFinalizado: 'ENDED',
    estadoProximaTanda: 'NEXT RELEASE',
    estadoUltimos: 'LAST TICKETS',
    cargoServicio: 'Service fee (8% + VAT)',
    costoProcesador: 'Payment processing (4.99%)',
    reserva: 'Reservation',
    totalFinal: 'Final Total',
    entradasCount: (n: number) => (n === 1 ? 'ticket' : 'tickets'),
    diasCount: (n: number) => `${n} day${n === 1 ? '' : 's'}`,
    elegiUnDia: 'Pick at least one day above',
    botonReservar: 'RESERVE',
    botonComprar: 'GET TICKETS',
    notaReserva: 'Free reservation · No sign-up required · see you inside',
    notaCompra: 'Secure checkout · No sign-up required · see you inside',
    shareTexto: (t: string) => `${t} — get your tickets on ENTRÁ`,
    icsDescripcion: 'Event on ENTRÁ',
    icsArchivo: 'event',
  },
  checkout: {
    pagoConfirmado: 'Payment confirmed!',
    pagoEnProceso: 'Payment in progress',
    pagoNoCompletado: "The payment didn't go through",
    retornoOk:
      "We're generating your tickets. We'll email them to you and they'll be available in your profile. It may take a few seconds to show up.",
    retornoPendiente:
      "MercadoPago is still processing the payment. Once it's approved, we'll email you your tickets automatically.",
    retornoFallo: 'You were not charged. You can try the purchase again whenever you like.',
    ordenNro: (o: string) => `Order #${o}`,
    verMisEntradas: 'View my tickets',
    volverEventos: 'Back to events',
    irInicio: 'Go to home',
    tusDatos: 'Your Details',
    loginRapida: 'Log in for a faster checkout',
    iniciarSesion: 'Log In',
    nombreCompleto: 'Full Name',
    nombrePlaceholder: 'As it appears on your ID',
    email: 'Email',
    emailPlaceholder: 'you@email.com',
    dni: 'ID / Passport',
    dniPlaceholder: 'No dots or spaces',
    telefono: 'Phone',
    telefonoPlaceholder: 'e.g. +54 11 5544 3322',
    siguiente: 'Next: Review & Confirm',
    revisarCompra: 'Review Your Order',
    datosComprador: 'Buyer Details',
    nombreLabel: 'Name:',
    emailLabel: 'Email:',
    dniLabel: 'ID:',
    editar: 'Edit',
    entradasTitulo: 'Tickets',
    volver: 'Back',
    procesando: 'Processing...',
    confirmarReserva: 'Confirm Reservation',
    confirmarCompra: 'Confirm Purchase',
    completaCampos: 'Please fill in all the fields',
    compraError: "We couldn't process your purchase. Please try again.",
    compraError2: 'Something went wrong processing your purchase. Please try again.',
    reservaConfirmada: 'Reservation Confirmed!',
    compraExitosa: 'Purchase Complete!',
    entradasGeneradas: (n: number) => (n === 1 ? 'ticket issued' : 'tickets issued'),
    descargarEntradas: (n: number) =>
      `Download ${n === 1 ? 'my ticket' : `my ${n} tickets`} (printable PDF)`,
    entradaDe: (i: number, n: number) => `Ticket #${i} of ${n}`,
    titular: 'Ticket Holder',
    dniPrefix: (d: string) => `ID ${d}`,
    copiarCodigo: 'Copy code',
    descargarPDF: 'Download PDF',
    listoTitulo: 'Done! Your tickets are right here 👇',
    listoBajada: (email: string) =>
      `Save or download the QR code and show it at the door. We also sent a copy to ${email}; if you don't see it, check your spam folder or download your tickets from here.`,
    verMisEntradasBtn: 'View My Tickets',
    seguirExplorando: 'Keep Exploring',
    compraCompletada: 'Order Complete',
    finalizarCompra: 'Checkout',
    cadaUno: 'each',
    codigoPlaceholder: 'CODE',
    aplicar: 'APPLY',
    descuentoAplicado: 'Discount applied',
    descuentoLinea: (v: string) => `Discount (${v})`,
    descuentoFijo: 'Fixed',
    cargoPorServicio: 'Service fee',
    incluyeServicio: 'Covers the ENTRÁ service and payment processing.',
    comisionEntra: 'ENTRÁ fee',
    gratisTag: 'Free',
    notaSeguridad: 'Your purchase is protected by ENTRÁ. Your personal data is never shared.',
    codigoInvalido: 'Invalid or unavailable code',
    codigoExpirado: 'This code has expired',
    codigoLimite: 'This code has reached its usage limit',
    codigoError: "Couldn't validate the code",
    codigoAplicado: 'Code applied!',
    ticketValido: 'VALID',
    ticketFecha: 'Date',
    ticketLugar: 'Venue',
  },
  claim: {
    linkInvalido: 'Invalid link',
    noExiste: "This transfer doesn't exist or the link is invalid.",
    yaReclamado: 'This ticket was already claimed by someone else.',
    cancelada: 'The transfer was cancelled by the sender.',
    eventoPaso: 'This event already took place. The ticket can no longer be claimed.',
    errorCargar: "We couldn't load the transfer. Please try again.",
    propio: "You can't claim your own ticket.",
    enviadoA: (e: string) => `This ticket was sent to ${e}. Log in with that account to claim it.`,
    noSePudo: "We couldn't claim the ticket. Please try again.",
    noSePuede: "This ticket can't be claimed",
    volverEntra: 'Back to ENTRÁ',
    reclamadoTitulo: 'Ticket claimed!',
    reclamadoBajada: 'It\'s yours. You\'ll find it under "My Tickets".',
    redirigiendo: 'Redirecting...',
    teTransfirieron: "You've been sent a ticket",
    alguien: 'Someone',
    teEnvioSufijo: 'sent you a ticket via ENTRÁ',
    para: 'For:',
    tipo: 'Type:',
    noEsParaVos: "This ticket isn't for you",
    noEsParaVosDetalle: (e: string) =>
      `It was sent to ${e}. Sign out and log in with that account to claim it.`,
    iniciaCon: (e: string) => `Log in as ${e}`,
    iniciaORegistrate: 'Log in or sign up to claim it',
    reclamando: 'Claiming...',
    reclamarGratis: 'Claim your ticket — free',
    alReclamar:
      "Once claimed, the ticket is in your name and the sender's original QR code is invalidated.",
  },
};

/** Los textos del idioma pedido (o del detectado, si no se pasa ninguno). */
export function textos(l: Lang = idiomaActual) {
  return l === 'en' ? en : es;
}
