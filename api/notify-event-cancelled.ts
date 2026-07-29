// ============================================================================
// CANCELAR EVENTO + AVISO A TODOS LOS COMPRADORES
// ============================================================================
// El admin (o el organizador del evento) cancela desde el panel. Acá, en el
// servidor y con la identidad VERIFICADA (mismo patrón que mp-oauth-start):
//   1) se marca el evento como 'cancelled' (estado que ya existía en las reglas
//      de Firestore pero que ninguna UI usaba)
//   2) se les avisa por mail a TODOS los que tienen entradas vigentes, una vez
//      por comprador (agrupado por email, no por ticket)
//   3) es idempotente: si el evento ya fue cancelado y notificado, no re-manda
//
// El mail usa la plantilla de marca (_event-mails.ts). Si un envío falla, se
// sigue con el resto y se informa cuántos salieron.

import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb, getAdminAuth } from './_lib/firebaseAdmin.js';
import { sendEventCancelledEmail } from './_event-mails.js';
import { frenado } from './_rate-limit.js';

const SUPERADMIN_EMAIL = 'ridaofrancorg@gmail.com';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Cancelar un evento es una acción rarísima: 3 por minuto sobra.
  if (frenado(req, res, 'notify-event-cancelled', 3)) return;

  try {
    const { idToken, eventId } = req.body || {};
    if (!idToken || !eventId) {
      return res.status(400).json({ error: 'Faltan datos (sesión o evento).' });
    }

    // ── ¿Quién sos? (verificado, no confiamos en el navegador) ──────────────
    let uid: string;
    let email: string;
    try {
      const decoded = await getAdminAuth().verifyIdToken(String(idToken));
      uid = decoded.uid;
      email = String(decoded.email || '').toLowerCase();
    } catch {
      return res.status(401).json({ error: 'Sesión inválida. Volvé a iniciar sesión e intentá de nuevo.' });
    }

    const db = getAdminDb();

    const eventRef = db.collection('events').doc(String(eventId));
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) {
      return res.status(404).json({ error: 'El evento no existe.' });
    }
    const event: any = eventSnap.data();

    // ── ¿Podés cancelar ESTE evento? (admin/superadmin u organizador dueño) ──
    let autorizado = email === SUPERADMIN_EMAIL || event.organizerId === uid;
    if (!autorizado) {
      const userSnap = await db.collection('users').doc(uid).get();
      const role = userSnap.exists ? (userSnap.data() as any)?.role : null;
      autorizado = role === 'admin' || role === 'superadmin';
    }
    if (!autorizado) {
      return res.status(403).json({ error: 'No tenés permiso para cancelar este evento.' });
    }

    // Idempotencia: cancelado y notificado, no hay nada más que hacer.
    if (event.status === 'cancelled' && event.cancelNotifiedAt) {
      return res.status(200).json({
        ok: true,
        already: true,
        notified: event.cancelNotifiedCount || 0,
      });
    }

    // ── 1) marcar el evento como cancelado ──────────────────────────────────
    if (event.status !== 'cancelled') {
      await eventRef.update({
        status: 'cancelled',
        cancelledAt: Timestamp.now(),
        cancelledBy: uid,
        updatedAt: Timestamp.now(),
      });
    }

    // ── 2) juntar a quién avisar: entradas vigentes, UNA vez por email ──────
    // La fuente de verdad es tickets (no orders): si hubo transferencias, el
    // dueño actual de la entrada es el que tiene que enterarse.
    const ticketsSnap = await db.collection('tickets').where('eventId', '==', String(eventId)).get();
    const porEmail = new Map<string, { name: string; count: number }>();
    for (const t of ticketsSnap.docs) {
      const tk: any = t.data();
      if (!['valid', 'used'].includes(tk.status)) continue;
      const mail = String(tk.buyerEmail || '').trim().toLowerCase();
      if (!mail) continue;
      const prev = porEmail.get(mail);
      if (prev) prev.count += 1;
      else porEmail.set(mail, { name: tk.buyerName || '', count: 1 });
    }

    const fechaTexto = event.date?.toDate
      ? event.date.toDate().toLocaleDateString('es-AR', {
          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
          timeZone: 'America/Argentina/Buenos_Aires',
        })
      : '';
    const lugar = [event.venue, event.location].filter(Boolean).join(', ');

    // ── 3) mandar los avisos (secuencial: son pocos y no queremos ráfagas) ──
    let enviados = 0;
    let fallidos = 0;
    for (const [mail, info] of porEmail) {
      const ok = await sendEventCancelledEmail({
        buyerEmail: mail,
        buyerName: info.name,
        eventTitle: event.title || 'tu evento',
        eventDate: fechaTexto,
        eventVenue: lugar,
        ticketCount: info.count,
      });
      if (ok) enviados += 1;
      else fallidos += 1;
    }

    await eventRef.update({
      cancelNotifiedAt: Timestamp.now(),
      cancelNotifiedCount: enviados,
      ...(fallidos > 0 ? { cancelNotifyFailed: fallidos } : {}),
    }).catch(() => {});

    console.log(`[notify-event-cancelled] evento=${eventId} por=${email} avisados=${enviados} fallidos=${fallidos}`);
    return res.status(200).json({ ok: true, notified: enviados, failed: fallidos });
  } catch (err: any) {
    console.error('[notify-event-cancelled] error:', err?.message || err);
    return res.status(500).json({ error: 'No se pudo cancelar el evento. Intentá de nuevo.' });
  }
}
