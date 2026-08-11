// ============================================================================
// LOS DOS EVENTOS DEMO: LA DEFINICIÓN, EN UN SOLO LUGAR
// ============================================================================
// ENTRÁ necesita eventos de ejemplo permanentes para mostrarle a un cliente cómo
// se compra una entrada de punta a punta.
//
// Este archivo lo leen DOS lados y por eso no importa NADA:
//   - api/_cron-demos.ts, que corre con Admin SDK y los mantiene vigentes
//   - src/pages/AdminDashboard.tsx, para el botón que los crea a mano
// Las fechas van como Date pelado; cada lado las convierte a su Timestamp.
//
// ⚠️ LOS CAMPOS SON LOS QUE PERMITE LA REGLA. isValidEvent() en firestore.rules
// usa hasOnlyAllowedFields(), así que un campo de más hace fallar la escritura
// entera desde el navegador. Por eso NO hay un `isDemo`: los demos se reconocen
// por su ID fijo, que para eso lo tienen.

// ⚠️ SIN GUIONES. La URL pública es `titulo-slugificado-<docId>` y resolveEventId()
// (src/lib/slug.ts) saca el id tomando el ÚLTIMO segmento separado por guiones. Un
// id como 'demo-entrada-gratis' resolvería a 'gratis' y el evento daría 404.
export const DEMO_GRATIS_ID = 'demogratis';
export const DEMO_PAGO_ID = 'demopago';

// A cuántos días se reprograma el demo cuando hay que moverlo.
export const DIAS_ADELANTE = 30;
// Umbral: si al demo le quedan menos de estos días, se lo manda de nuevo a
// DIAS_ADELANTE. Sin umbral habría una escritura por día para no cambiar nada.
export const DIAS_MINIMOS = 7;

// Argentina es UTC-3 fijo (sin horario de verano desde 2009).
const ART_OFFSET_MS = 3 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

// El evento pago cobra de verdad (cae en la cuenta de MercadoPago de ENTRÁ,
// porque organizerId 'demo' no tiene cuenta conectada y create-payment usa
// MP_ACCESS_TOKEN como fallback). Por eso el precio es simbólico: tiene que
// parecer una entrada real sin que devolver la plata sea un problema.
const PRECIO_DEMO = 1000;

const BASE_DEMO = {
  venue: 'Sala ENTRÁ',
  location: 'Palermo, CABA',
  organizerId: 'demo',
  organizerName: 'ENTRÁ',
  organizerEmail: 'soporte@entratickets.com',
  ticketsSold: 0,
  totalRevenue: 0,
  hidden: false,
};

export const DEMOS = [
  {
    id: DEMO_GRATIS_ID,
    ...BASE_DEMO,
    title: 'Demo ENTRÁ · Entrada gratis',
    description:
      'Evento de demostración de ENTRÁ. Reservá tu lugar sin costo y vas a recibir por mail el QR y el ticket en PDF, igual que en un evento real. No es un evento real: no se cobra nada y no hay que ir a ningún lado.',
    category: 'Conferencia',
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&h=600&fit=crop',
    isFree: true,
    price: 0,
    tickets: [{ type: 'General', price: 0, available: 500 }],
  },
  {
    id: DEMO_PAGO_ID,
    ...BASE_DEMO,
    title: 'Demo ENTRÁ · Entrada paga',
    description:
      'Evento de demostración de ENTRÁ para ver el checkout con MercadoPago tal cual lo ve tu público. No es un evento real. La entrada sale $1.000 simbólicos y el pago es de verdad: si comprás una para probar, escribinos a soporte@entratickets.com y te la devolvemos.',
    category: 'Recital',
    image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&h=600&fit=crop',
    isFree: false,
    price: PRECIO_DEMO,
    tickets: [{ type: 'General', price: PRECIO_DEMO, available: 500 }],
  },
];

// La próxima fecha del demo: dentro de DIAS_ADELANTE días, a las 21:00 de
// Argentina. Se calcula sobre el día calendario argentino para que no se corra
// un día según la hora a la que se ejecute.
export function proximaFechaDemo(ahora: number = Date.now()): Date {
  const ahoraArt = new Date(ahora - ART_OFFSET_MS);
  const diaArt = Date.UTC(
    ahoraArt.getUTCFullYear(),
    ahoraArt.getUTCMonth(),
    ahoraArt.getUTCDate() + DIAS_ADELANTE,
    21, 0, 0,
  );
  return new Date(diaArt + ART_OFFSET_MS);
}

// Acepta cualquiera de las formas en que puede venir una fecha de Firestore
// (Timestamp del SDK, Timestamp serializado, o Date).
export function aDate(raw: any): Date | null {
  const d = raw?.toDate
    ? raw.toDate()
    : raw?.seconds
    ? new Date(raw.seconds * 1000)
    : raw instanceof Date
    ? raw
    : null;
  return d && !isNaN(d.getTime()) ? d : null;
}

// Si al demo le quedan menos de DIAS_MINIMOS, hay que correrlo. Sin fecha
// legible también, porque un demo sin fecha no se puede mostrar.
export function hayQueReprogramar(fin: Date | null, ahora: number = Date.now()): boolean {
  if (!fin) return true;
  return (fin.getTime() - ahora) / DIA_MS < DIAS_MINIMOS;
}
