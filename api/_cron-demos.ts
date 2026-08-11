// ============================================================================
// TAREA: LOS DOS EVENTOS DEMO SIEMPRE VIGENTES
// ============================================================================
// Los eventos demo estan definidos en _demo-eventos.ts, que comparte con el
// panel de admin. Acá está solo la mecánica de escribirlos.
//
// POR QUÉ ESTO NO PODÍA ARREGLARSE DESDE EL NAVEGADOR SIN SESIÓN
// seedEventsIfMissing() corría en el cliente, anónimo, y las reglas de Firestore
// piden isVerified() + organizer/admin para crear un evento. O sea que fallaba
// SIEMPRE y el try/catch se comía el error. Acá se usa el Admin SDK, que saltea
// las reglas, y por eso api/cron/[tarea].ts autentica antes de llamar a esto.
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
//
// El prefijo `_` la saca del ruteo de Vercel: esto NO es un endpoint.

import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from './_lib/firebaseAdmin.js';
import { DEMOS, proximaFechaDemo, aDate, hayQueReprogramar } from './_demo-eventos.js';

export async function correrEventosDemo() {
  const db = getAdminDb();
  const ahora = Date.now();
  const nueva = proximaFechaDemo(ahora);
  const detalle: Array<{ id: string; accion: string; fecha: string }> = [];

  for (const demo of DEMOS) {
    const { id, ...datos } = demo;
    const ref = db.collection('events').doc(id);
    const snap = await ref.get();

    if (!snap.exists) {
      // El Admin SDK saltea las reglas, así que puede nacer 'active' directo.
      // (El panel, que sí pasa por las reglas, tiene que crearlo 'pending' y
      // recién después activarlo.)
      await ref.set({
        ...datos,
        status: 'active',
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

    if (!hayQueReprogramar(fin, ahora)) {
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
    if (actual.status !== 'active') update.status = 'active';
    if (actual.hidden) update.hidden = false;

    await ref.update(update);
    detalle.push({ id, accion: 'reprogramado', fecha: nueva.toISOString() });
  }

  console.log(`[eventos-demo] ${detalle.map((d) => `${d.id}=${d.accion}`).join(' ')}`);
  return { ok: true, demos: detalle };
}
