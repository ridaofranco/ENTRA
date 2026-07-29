// ============================================================================
// CRON DIARIO: RECORDATORIO "MAÑANA ES EL EVENTO"
// ============================================================================
// Vercel Cron lo dispara una vez por día (ver "crons" en vercel.json). Acá:
//   1) se buscan los eventos que arrancan MAÑANA (día calendario argentino)
//   2) por cada evento, se juntan las entradas vigentes y se agrupan por
//      comprador: UN mail por persona, no uno por ticket
//   3) es idempotente: el evento queda marcado con reminderSentAt, así un
//      re-disparo del cron (o un deploy en el medio) no duplica avisos
//
// Seguridad: Vercel manda `Authorization: Bearer ${CRON_SECRET}` si la env var
// está cargada. Mismo criterio que INTERNAL_API_SECRET en send-ticket-email:
// si falta la variable, avisa por log pero no se rompe (cargarla es la tarea).

import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { sendEventReminderEmail } from '../_event-mails.js';

// Argentina es UTC-3 fijo (sin horario de verano desde 2009).
const ART_OFFSET_MS = 3 * 60 * 60 * 1000;

export default async function handler(req: any, res: any) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    if (req.headers?.authorization !== `Bearer ${cronSecret}`) {
      console.error('[recordatorio-evento] rechazado: Authorization inválido');
      return res.status(401).json({ ok: false, error: 'No autorizado' });
    }
  } else {
    console.warn('[recordatorio-evento] ⚠️ CRON_SECRET no está configurado: el endpoint acepta cualquier request. Cargala en Vercel.');
  }

  try {
    const db = getAdminDb();

    // "Mañana" en día calendario argentino, expresado como ventana UTC.
    const ahoraArt = new Date(Date.now() - ART_OFFSET_MS);
    const inicioMananaArt = Date.UTC(
      ahoraArt.getUTCFullYear(), ahoraArt.getUTCMonth(), ahoraArt.getUTCDate() + 1,
    );
    const desde = new Date(inicioMananaArt + ART_OFFSET_MS);
    const hasta = new Date(desde.getTime() + 24 * 60 * 60 * 1000);

    // Rango solo por fecha (un campo): el estado se filtra en memoria para no
    // necesitar índices compuestos (mismo criterio que el resto del repo).
    const eventosSnap = await db.collection('events')
      .where('date', '>=', Timestamp.fromDate(desde))
      .where('date', '<', Timestamp.fromDate(hasta))
      .get();

    let eventosAvisados = 0;
    let mailsEnviados = 0;
    let mailsFallidos = 0;
    const detalle: Array<{ eventId: string; buyers: number; sent: number }> = [];

    for (const evDoc of eventosSnap.docs) {
      const ev: any = evDoc.data();
      const status = ev.status || 'active';
      // Pausado cuenta: la VENTA está pausada pero el evento ocurre igual.
      if (!['active', 'published', 'paused'].includes(status)) continue;
      if (ev.isDateTBD) continue;
      if (ev.reminderSentAt) continue; // ya avisado

      // Candado ANTES de mandar: si el cron se re-dispara mientras este evento
      // está en proceso, el segundo disparo lo saltea. Peor perder un aviso
      // que mandarlo dos veces.
      await evDoc.ref.update({ reminderSentAt: Timestamp.now() });

      const ticketsSnap = await db.collection('tickets')
        .where('eventId', '==', evDoc.id)
        .get();

      const porEmail = new Map<string, { name: string; count: number }>();
      for (const t of ticketsSnap.docs) {
        const tk: any = t.data();
        if (tk.status !== 'valid') continue;
        const mail = String(tk.buyerEmail || '').trim().toLowerCase();
        if (!mail) continue;
        const prev = porEmail.get(mail);
        if (prev) prev.count += 1;
        else porEmail.set(mail, { name: tk.buyerName || '', count: 1 });
      }

      if (porEmail.size === 0) {
        detalle.push({ eventId: evDoc.id, buyers: 0, sent: 0 });
        continue;
      }

      const fecha = ev.date?.toDate ? ev.date.toDate() : null;
      const fechaTexto = fecha
        ? `${fecha.toLocaleDateString('es-AR', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
            timeZone: 'America/Argentina/Buenos_Aires',
          })}${ev.isTimeTBD ? '' : ` · ${fecha.toLocaleTimeString('es-AR', {
            hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires',
          })} hs`}`
        : '';
      const lugar = ev.isVenueTBD ? '' : [ev.venue, ev.location].filter(Boolean).join(', ');

      let enviados = 0;
      for (const [mail, info] of porEmail) {
        const ok = await sendEventReminderEmail({
          buyerEmail: mail,
          buyerName: info.name,
          eventTitle: ev.title || 'tu evento',
          eventDate: fechaTexto,
          eventVenue: lugar,
          ticketCount: info.count,
        });
        if (ok) { enviados += 1; mailsEnviados += 1; }
        else mailsFallidos += 1;
      }

      await evDoc.ref.update({ reminderSentCount: enviados }).catch(() => {});
      eventosAvisados += 1;
      detalle.push({ eventId: evDoc.id, buyers: porEmail.size, sent: enviados });
    }

    console.log(`[recordatorio-evento] ventana=${desde.toISOString()}..${hasta.toISOString()} eventos=${eventosAvisados} mails=${mailsEnviados} fallidos=${mailsFallidos}`);
    return res.status(200).json({
      ok: true,
      events: eventosAvisados,
      sent: mailsEnviados,
      failed: mailsFallidos,
      detail: detalle,
    });
  } catch (err: any) {
    console.error('[recordatorio-evento] error:', err?.message || err);
    return res.status(500).json({ ok: false, error: 'Falló el recordatorio.' });
  }
}
