// ============================================================================
// HERRAMIENTA ADMIN (temporal): normaliza el email de una orden a minúsculas y
// reenvía el ticket por email. Sirve para reparar órdenes viejas cuyo buyerEmail
// quedó en mayúsculas (no matcheaba con la cuenta). Gateada con MP_CLIENT_SECRET.
// Se puede borrar después de usarla.
// Uso: POST /api/admin-fix-order?key=<MP_CLIENT_SECRET>&orderId=<id>

import { getAdminDb } from './_lib/firebaseAdmin.js';

const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://www.entratickets.com';

export default async function handler(req: any, res: any) {
  try {
    const key = req.query?.key || req.body?.key;
    if (!key || key !== process.env.MP_CLIENT_SECRET) {
      return res.status(401).json({ error: 'no autorizado' });
    }
    const orderId = req.query?.orderId || req.body?.orderId;
    if (!orderId) return res.status(400).json({ error: 'falta orderId' });

    const db = getAdminDb();
    const orderRef = db.collection('orders').doc(String(orderId));
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return res.status(404).json({ error: 'orden inexistente' });
    const order: any = orderSnap.data();

    const emailLower = String(order.buyerEmail || '').trim().toLowerCase();
    await orderRef.update({ buyerEmail: emailLower });

    // Actualiza los tickets de la orden al email en minúsculas y arma la lista para el mail.
    const tq = await db.collection('tickets').where('orderId', '==', String(orderId)).get();
    const tickets: Array<{ qrCode: string; type: string }> = [];
    const batch = db.batch();
    tq.docs.forEach((d) => {
      const t = d.data() as any;
      batch.update(d.ref, { buyerEmail: emailLower });
      tickets.push({ qrCode: t.qrCode, type: t.ticketType });
    });
    if (tq.size > 0) await batch.commit();

    let emailStatus = 0;
    if (tickets.length > 0) {
      const r = await fetch(`${BASE_URL}/api/send-ticket-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          eventId: order.eventId,
          eventTitle: order.eventTitle,
          buyerEmail: emailLower,
          buyerName: order.buyerName,
          tickets,
        }),
      });
      emailStatus = r.status;
    }
    return res.status(200).json({ ok: true, email: emailLower, tickets: tickets.length, emailStatus });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'error' });
  }
}
