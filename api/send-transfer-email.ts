// ============================================================================
// MAIL DE TRANSFERENCIA DE TICKET
// ============================================================================
// El modal de transferencia (TransferTicketModal) crea la transferencia en
// Firestore y después llama acá con el token. Este endpoint NO confía en nada
// del navegador: busca la transferencia REAL por token con el Admin SDK y le
// manda al RECEPTOR el link de reclamo (/claim/{token}), más una confirmación
// al que transfirió. Así el mail no depende de que el remitente comparta el
// link a mano (el "compartí por WhatsApp" del modal sigue existiendo igual).
//
// Idempotente: si el mail del receptor ya salió para este token, no re-manda
// (el modal se puede re-renderizar y no queremos duplicados).

import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from './_lib/firebaseAdmin.js';
import { sendTransferEmails } from './_event-mails.js';
import { frenado } from './_rate-limit.js';

const PUBLIC_URL = process.env.PUBLIC_BASE_URL || 'https://www.entratickets.com';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  }

  // Una transferencia por vez: 6 por minuto por IP alcanza de sobra.
  if (frenado(req, res, 'send-transfer-email', 6)) return;

  try {
    const token = String(req.body?.token || '').trim();
    if (!token || token.length < 10 || token.length > 60) {
      return res.status(400).json({ ok: false, error: 'Token inválido.' });
    }

    const db = getAdminDb();
    const snap = await db.collection('ticket_transfers').where('token', '==', token).limit(1).get();
    if (snap.empty) {
      return res.status(404).json({ ok: false, error: 'La transferencia no existe.' });
    }
    const ref = snap.docs[0].ref;
    const t: any = snap.docs[0].data();

    if (t.status !== 'pending') {
      return res.status(409).json({ ok: false, error: 'La transferencia ya no está pendiente.' });
    }
    if (t.notifyEmailSentAt) {
      return res.status(200).json({ ok: true, already: true });
    }

    const fechaTexto = t.eventDate?.toDate
      ? t.eventDate.toDate().toLocaleDateString('es-AR', {
          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
          timeZone: 'America/Argentina/Buenos_Aires',
        })
      : '';

    // El venue no viaja en la transferencia: lo buscamos en el evento (best-effort).
    let lugar = '';
    if (t.eventId) {
      try {
        const evSnap = await db.collection('events').doc(String(t.eventId)).get();
        if (evSnap.exists) {
          const ev: any = evSnap.data();
          lugar = [ev.venue, ev.location].filter(Boolean).join(', ');
        }
      } catch { /* sin lugar, el mail sale igual */ }
    }

    const resultado = await sendTransferEmails({
      fromName: t.fromUserName || '',
      fromEmail: t.fromUserEmail || '',
      toName: t.toUserName || '',
      toEmail: String(t.toUserEmail || '').trim().toLowerCase(),
      eventTitle: t.eventTitle || 'tu evento',
      eventDate: fechaTexto,
      eventVenue: lugar,
      ticketType: t.ticketType || '',
      note: t.toUserNote || '',
      claimUrl: `${PUBLIC_URL}/claim/${token}`,
    });

    if (resultado.receptor) {
      await ref.update({
        notifyEmailSentAt: Timestamp.now(),
        notifySenderEmail: resultado.remitente,
      }).catch(() => {});
    }

    console.log(`[send-transfer-email] token=${token.slice(0, 6)}… receptor=${resultado.receptor} remitente=${resultado.remitente}`);
    return res.status(resultado.receptor ? 200 : 502).json({
      ok: resultado.receptor,
      senderNotified: resultado.remitente,
      ...(resultado.receptor ? {} : { error: 'No se pudo enviar el mail al destinatario.' }),
    });
  } catch (err: any) {
    console.error('[send-transfer-email] error:', err?.message || err);
    return res.status(500).json({ ok: false, error: 'No se pudo enviar el mail.' });
  }
}
