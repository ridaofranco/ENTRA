// ============================================================================
// TAREA: RECORDATORIO "MAÑANA ES EL EVENTO"
// ============================================================================
//   1) se buscan los eventos que arrancan MAÑANA (día calendario argentino)
//   2) por cada evento, se juntan las entradas vigentes y se agrupan por
//      comprador: UN mail por persona, no uno por ticket
//   3) es idempotente: el evento queda marcado con reminderSentAt, así un
//      re-disparo del cron (o un deploy en el medio) no duplica avisos
//   4) VARIOS DÍAS (29/10): antes solo avisaba antes del PRIMER día y le
//      llegaba a todos, incluso a quien compró solo el último. Ahora avisa
//      la víspera de CADA jornada, a quien tiene entrada para esa jornada
//      (un QR por día) y, al abono, solo antes del primer día. El candado
//      es por día: reminderSentDays.
//
// El prefijo `_` la saca del ruteo de Vercel: esto NO es un endpoint. Lo llama
// api/cron/[tarea].ts, que es el único que atiende HTTP y el que hace la
// autenticación. La URL pública no cambió: sigue siendo
// /api/cron/recordatorio-evento.

import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './_lib/firebaseAdmin.js';
import { sendEventReminderEmail } from './_event-mails.js';
import { claveDiaAR, diasDelEvento } from './_dias.js';

// Argentina es UTC-3 fijo (sin horario de verano desde 2009).
const ART_OFFSET_MS = 3 * 60 * 60 * 1000;

export async function correrRecordatorioEvento() {
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
  // Se traen también los que arrancaron hasta 31 días antes: un evento de
  // varios días guarda en `date` su PRIMERA jornada, y mañana puede ser la
  // tercera. Los de un día se filtran abajo con la ventana exacta.
  const DIAS_ATRAS_MS = 31 * 24 * 60 * 60 * 1000;
  const manana = claveDiaAR(desde);
  const eventosSnap = await db.collection('events')
    .where('date', '>=', Timestamp.fromDate(new Date(desde.getTime() - DIAS_ATRAS_MS)))
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

    const dias = diasDelEvento(ev);
    const esVariosDias = dias.length > 0;
    if (esVariosDias) {
      if (!manana || !dias.includes(manana)) continue; // mañana no hay jornada
      const yaAvisados: string[] = Array.isArray(ev.reminderSentDays) ? ev.reminderSentDays : [];
      if (yaAvisados.includes(manana)) continue;
      // Compatibilidad: eventos avisados con la versión anterior (solo antes del
      // primer día, con reminderSentAt) no repiten el primer día.
      if (manana === dias[0] && ev.reminderSentAt) continue;
    } else {
      const fechaEv = ev.date?.toDate ? ev.date.toDate() : null;
      if (!fechaEv || fechaEv < desde || fechaEv >= hasta) continue;
      if (ev.reminderSentAt) continue; // ya avisado
    }

    // Candado ANTES de mandar: si el cron se re-dispara mientras este evento
    // está en proceso, el segundo disparo lo saltea. Peor perder un aviso
    // que mandarlo dos veces.
    await evDoc.ref.update(
      esVariosDias
        ? { reminderSentDays: FieldValue.arrayUnion(manana), reminderSentAt: Timestamp.now() }
        : { reminderSentAt: Timestamp.now() },
    );

    const ticketsSnap = await db.collection('tickets')
      .where('eventId', '==', evDoc.id)
      .get();

    const porEmail = new Map<string, { name: string; count: number }>();
    for (const t of ticketsSnap.docs) {
      const tk: any = t.data();
      if (tk.status !== 'valid') continue;
      if (esVariosDias) {
        const diasTk: string[] = Array.isArray(tk.validDays) ? tk.validDays : [];
        const esPorDia = diasTk.length > 0 && diasTk.length < dias.length;
        // Un QR por día: solo si tiene entrada para mañana. Abono (todos los
        // días) o entrada sin días: solo la víspera del primer día.
        if (esPorDia ? !diasTk.includes(manana as string) : manana !== dias[0]) continue;
      }
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

    // La fecha del mail es la de la jornada de mañana, no la del primer día.
    const jornada = esVariosDias
      ? (ev.days || []).find((d: any) => claveDiaAR(d?.date) === manana)
      : null;
    const fechaRaw = jornada?.date ?? ev.date;
    const fecha = fechaRaw?.toDate ? fechaRaw.toDate() : null;
    const fechaTexto = fecha
      ? `${fecha.toLocaleDateString('es-AR', {
          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
          timeZone: 'America/Argentina/Buenos_Aires',
        })}${ev.isTimeTBD ? '' : ` · ${fecha.toLocaleTimeString('es-AR', {
          hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Argentina/Buenos_Aires',
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
  return {
    ok: true,
    events: eventosAvisados,
    sent: mailsEnviados,
    failed: mailsFallidos,
    detail: detalle,
  };
}
