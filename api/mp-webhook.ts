// ============================================================================
// WEBHOOK DE MERCADOPAGO — emisión de tickets SOLO con el pago confirmado
// ============================================================================
// MercadoPago llama a este endpoint cuando cambia el estado de un pago. Acá:
//   1) se consulta el pago REAL a MercadoPago (no se confía en el aviso crudo)
//   2) si está 'approved', en UNA transacción: se descuenta el stock, se marca la
//      orden como pagada y se emiten los tickets (con QR generado en el servidor)
//   3) es idempotente: si el pago ya se procesó, no vuelve a emitir (MP reintenta)
//
// Esto es lo que reemplaza la emisión insegura del navegador: el cliente ya NO crea
// tickets; solo este backend (con Admin SDK) lo hace, y solo tras verificar el pago.
// Requiere en Vercel: MP_ACCESS_TOKEN y FIREBASE_SERVICE_ACCOUNT.

import { MercadoPagoConfig, Payment } from 'mercadopago';
import { Timestamp } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';
import { getAdminDb } from './_lib/firebaseAdmin.js';

const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://www.entratickets.com';

function fmtDayKey(dk: string): string {
  try {
    const [y, m, d] = dk.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  } catch {
    return dk;
  }
}

export default async function handler(req: any, res: any) {
  // MP espera un 200 rápido; respondemos 200 salvo error transitorio (para que reintente).
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) return res.status(500).json({ error: 'Falta MP_ACCESS_TOKEN' });

    // El id del pago llega por query (?data.id=) o por body ({ data: { id } }).
    const paymentId =
      req.query?.['data.id'] || req.query?.id || req.body?.data?.id || req.body?.id;
    const topic = req.query?.type || req.query?.topic || req.body?.type;

    if (topic && topic !== 'payment') return res.status(200).json({ ignored: topic });
    if (!paymentId) return res.status(200).json({ ignored: 'sin id de pago' });

    const mp = new MercadoPagoConfig({ accessToken });
    const payment: any = await new Payment(mp).get({ id: String(paymentId) });

    // Registramos SIEMPRE el estado del intento (approved/rejected/pending) en la orden,
    // para trazabilidad en el panel. Si no está aprobado, no emitimos.
    if (payment.status !== 'approved') {
      const oid = payment.external_reference;
      if (oid) {
        await getAdminDb().collection('orders').doc(oid)
          .update({ paymentStatus: payment.status, mpPaymentId: String(paymentId) })
          .catch(() => {});
      }
      return res.status(200).json({ ok: true, status: payment.status });
    }

    const orderId = payment.external_reference;
    if (!orderId) return res.status(200).json({ ignored: 'sin external_reference' });

    const db = getAdminDb();
    const orderRef = db.collection('orders').doc(orderId);

    // Preparamos la lista de tickets a emitir y ejecutamos todo en una transacción.
    const emitted: Array<{ id: string; qrCode: string; type: string }> = [];
    let orderData: any = null;

    await db.runTransaction(async (tx) => {
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists) throw new Error(`Orden ${orderId} inexistente`);
      orderData = orderSnap.data();

      // Idempotencia: si ya está confirmada, no reemitir.
      if (orderData.status === 'confirmed') return;

      const eventRef = db.collection('events').doc(orderData.eventId);
      const eventSnap = await tx.get(eventRef);
      if (!eventSnap.exists) throw new Error(`Evento ${orderData.eventId} inexistente`);
      const event: any = eventSnap.data();

      const eventTickets: any[] = Array.isArray(event.tickets) ? event.tickets : [];
      const validDays: string[] = Array.isArray(event.validDays) ? event.validDays : [];
      const isPerDay = Boolean(event.isMultiDay) && event.entryMode === 'per_day' && validDays.length > 0;
      const items: Array<{ type: string; quantity: number; unitPrice: number }> = orderData.items || [];

      // 1) validar y descontar stock
      let totalQty = 0;
      const updatedTickets = eventTickets.map((t) => {
        const bought = items.find((it) => it.type === t.type);
        if (!bought) return t;
        const avail = typeof t.available === 'number' ? t.available : Infinity;
        if (avail < bought.quantity) throw new Error(`Sin stock de "${t.type}"`);
        totalQty += bought.quantity;
        return { ...t, available: Math.max(0, avail - bought.quantity) };
      });

      tx.update(eventRef, {
        tickets: updatedTickets,
        ticketsSold: (event.ticketsSold || 0) + totalQty,
        totalRevenue: (event.totalRevenue || 0) + (orderData.subtotal || 0),
        updatedAt: Timestamp.now(),
      });

      // 2) emitir tickets (un QR por jornada si es per_day; uno para todo si no)
      for (const it of items) {
        const issueGroups: string[][] = isPerDay ? validDays.map((dk) => [dk]) : [validDays];
        for (let i = 0; i < it.quantity; i++) {
          for (const grpDays of issueGroups) {
            const qrCode = randomUUID(); // seguro (CSPRNG), no Math.random
            const dayLabel = isPerDay && grpDays[0] ? fmtDayKey(grpDays[0]) : '';
            const newRef = db.collection('tickets').doc();
            const ticketData: any = {
              orderId,
              eventId: orderData.eventId,
              eventTitle: orderData.eventTitle,
              buyerId: orderData.buyerId,
              buyerName: orderData.buyerName,
              buyerEmail: orderData.buyerEmail,
              buyerPhone: orderData.buyerPhone || '',
              buyerDni: orderData.buyerDni,
              ticketType: it.type,
              price: it.unitPrice,
              status: 'valid',
              qrCode,
              createdAt: Timestamp.now(),
              purchasedAt: Timestamp.now(),
            };
            if (grpDays.length > 0) ticketData.validDays = grpDays;
            tx.set(newRef, ticketData);
            emitted.push({ id: newRef.id, qrCode, type: dayLabel ? `${it.type} · ${dayLabel}` : it.type });
          }
        }
      }

      // 3) confirmar la orden
      tx.update(orderRef, {
        status: 'confirmed',
        paymentMethod: 'mercadopago',
        mpPaymentId: String(paymentId),
        paidAt: Timestamp.now(),
      });
    });

    // 4) email de confirmación (fuera de la transacción; si falla no rompe la emisión)
    if (emitted.length > 0 && orderData) {
      fetch(`${BASE_URL}/api/send-ticket-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          eventId: orderData.eventId,
          eventTitle: orderData.eventTitle,
          buyerEmail: orderData.buyerEmail,
          buyerName: orderData.buyerName,
          tickets: emitted.map((t) => ({ qrCode: t.qrCode, type: t.type })),
        }),
      }).catch((e) => console.error('[mp-webhook] email falló:', e?.message || e));
    }

    return res.status(200).json({ ok: true, emitted: emitted.length });
  } catch (err: any) {
    console.error('[mp-webhook] error:', err?.message || err);
    // 500 → MercadoPago reintenta la notificación más tarde
    return res.status(500).json({ error: 'Error procesando el pago' });
  }
}
