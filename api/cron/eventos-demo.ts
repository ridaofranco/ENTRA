// ============================================================================
// CRON DIARIO: LOS DOS EVENTOS DEMO SIEMPRE VIGENTES
// ============================================================================
// ENTRÁ necesita eventos de ejemplo permanentes para mostrarle a un cliente cómo
// se compra una entrada de punta a punta. Había cuatro, pero tenían la fecha
// escrita a mano en el código (abril/junio 2026) y se vencieron todos: desde
// entonces la cartelera quedó vacía y /demo mandaba a una lista sin nada.
//
// POR QUÉ ESTO NO PODÍA ARREGLARSE DESDE EL NAVEGADOR
// seedEventsIfMissing() corría en el cliente, sin sesión, y las reglas de
// Firestore piden isVerified() + organizer/admin + status == 'pending' para
// crear un evento. O sea que fallaba SIEMPRE y el try/catch se comía el error.
// Acá se usa el Admin SDK, que saltea las reglas, y por eso el endpoint tiene
// que estar cerrado con la misma llave que el resto de los crons.
//
// QUÉ HACE, EXACTAMENTE
//   - Si el evento demo no existe, lo crea entero.
//   - Si ya existe, SOLO le corre la fecha, y solo cuando está por vencer.
//     Todo lo demás (título, imagen, precio, entradas) queda como esté, así
//     Franco puede editarlo desde el panel sin que el cron se lo pise al día
//     siguiente.
//
// Es idempotente: los documentos tienen ID fijo, así que correrlo diez veces
// deja lo mismo que correrlo una.

import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '../_lib/firebaseAdmin.js';

// Argentina es UTC-3 fijo (sin horario de verano desde 2009). Mismo criterio
// que recordatorio-evento.ts.
const ART_OFFSET_MS = 3 * 60 * 60 * 1000;

// A cuántos días se reprograma el demo cuando hay que moverlo.
const DIAS_ADELANTE = 30;
// Umbral: si al demo le quedan menos de estos días, se lo manda de nuevo a
// DIAS_ADELANTE. Sin umbral habría una escritura por día para no cambiar nada.
const DIAS_MINIMOS = 7;

const DIA_MS = 24 * 60 * 60 * 1000;

// Los dos IDs son fijos a propósito: son la clave de que esto sea idempotente y
// de que /demo pueda linkear al evento sin adivinar nada.
//
// ⚠️ SIN GUIONES. La URL pública es `titulo-slugificado-<docId>` y resolveEventId()
// (src/lib/slug.ts) saca el id tomando el ÚLTIMO segmento separado por guiones. Un
// id como 'demo-entrada-gratis' resolvería a 'gratis' y el evento daría 404.
export const DEMO_GRATIS_ID = 'demogratis';
export const DEMO_PAGO_ID = 'demopago';

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
  status: 'active',
  ticketsSold: 0,
  totalRevenue: 0,
  // La marca que hace que el cron los reconozca. También sirve para filtrarlos
  // desde el panel sin depender del título.
  isDemo: true,
};

const DEMOS = [
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
// un día según la hora a la que dispare el cron.
function proximaFecha(): Date {
  const ahoraArt = new Date(Date.now() - ART_OFFSET_MS);
  const diaArt = Date.UTC(
    ahoraArt.getUTCFullYear(),
    ahoraArt.getUTCMonth(),
    ahoraArt.getUTCDate() + DIAS_ADELANTE,
    21, 0, 0,
  );
  return new Date(diaArt + ART_OFFSET_MS);
}

function aDate(raw: any): Date | null {
  const d = raw?.toDate ? raw.toDate() : raw?.seconds ? new Date(raw.seconds * 1000) : null;
  return d && !isNaN(d.getTime()) ? d : null;
}

export default async function handler(req: any, res: any) {
  // Mismo criterio fail-closed que recordatorio-evento.ts: sin ninguna llave
  // cargada no se atiende. Este endpoint ESCRIBE en la base con Admin SDK, así
  // que dejarlo abierto sería peor que en cualquier otro cron.
  const aceptados = [process.env.CRON_SECRET, process.env.CF_CRON_SECRET].filter(Boolean);
  const auth = req.headers?.authorization;
  if (!aceptados.length) {
    console.error('[eventos-demo] sin CRON_SECRET ni CF_CRON_SECRET: no se atiende');
    return res.status(401).json({ ok: false, error: 'No autorizado' });
  }
  if (!aceptados.some((s) => auth === `Bearer ${s}`)) {
    console.error('[eventos-demo] rechazado: Authorization inválido');
    return res.status(401).json({ ok: false, error: 'No autorizado' });
  }

  try {
    const db = getAdminDb();
    const ahora = Date.now();
    const nueva = proximaFecha();
    const detalle: Array<{ id: string; accion: string; fecha: string }> = [];

    for (const demo of DEMOS) {
      const { id, ...datos } = demo;
      const ref = db.collection('events').doc(id);
      const snap = await ref.get();

      if (!snap.exists) {
        await ref.set({
          ...datos,
          date: Timestamp.fromDate(nueva),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        detalle.push({ id, accion: 'creado', fecha: nueva.toISOString() });
        continue;
      }

      // Ya existe: el cron es dueño de la fecha y de NADA más. Si alguien le
      // cambió el título, la imagen o el precio desde el panel, eso se respeta.
      const actual: any = snap.data() || {};
      const fin = aDate(actual.endDate) || aDate(actual.date);
      const diasRestantes = fin ? (fin.getTime() - ahora) / DIA_MS : -1;

      if (diasRestantes >= DIAS_MINIMOS) {
        detalle.push({
          id,
          accion: 'sin cambios',
          fecha: fin ? fin.toISOString() : 'sin fecha',
        });
        continue;
      }

      const update: Record<string, any> = {
        date: Timestamp.fromDate(nueva),
        updatedAt: Timestamp.now(),
      };
      // Un endDate viejo lo dejaría vencido igual (getEventEnd le da prioridad
      // sobre date), así que si estaba cargado se corre el mismo margen.
      const endActual = aDate(actual.endDate);
      const inicioActual = aDate(actual.date);
      if (endActual && inicioActual) {
        const duracion = endActual.getTime() - inicioActual.getTime();
        if (duracion > 0) {
          update.endDate = Timestamp.fromDate(new Date(nueva.getTime() + duracion));
        }
      }
      // Si estaba pausado o cancelado, volver a ponerlo en venta: un demo que no
      // se puede comprar no sirve para mostrarle nada a nadie.
      if (actual.status && actual.status !== 'active') update.status = 'active';
      if (actual.hidden) update.hidden = false;

      await ref.update(update);
      detalle.push({ id, accion: 'reprogramado', fecha: nueva.toISOString() });
    }

    console.log(`[eventos-demo] ${detalle.map((d) => `${d.id}=${d.accion}`).join(' ')}`);
    return res.status(200).json({ ok: true, demos: detalle });
  } catch (err: any) {
    console.error('[eventos-demo] error:', err?.message || err);
    return res.status(500).json({ ok: false, error: 'Falló la puesta a punto de los demos.' });
  }
}
