// ============================================================================
// EMITIR LAS ENTRADAS DE UNA ORDEN PAGADA
// ============================================================================
// Esto vivía adentro de mp-webhook.ts. Se saca acá porque ahora hay DOS caminos
// que terminan en lo mismo:
//
//   1) el webhook, cuando MercadoPago avisa del pago;
//   2) la reconciliación (api/_cron-reconciliar.ts), que busca los pagos
//      aprobados de los que MP NUNCA avisó.
//
// El 15/9/2026 alguien pagó y la notificación no llegó jamás: su orden quedó
// 'pending' para siempre y el ticket no se emitió nunca. Mientras el webhook
// fuera el único camino, un aviso perdido era una entrada perdida.
//
// Las dos puertas tienen que emitir EXACTAMENTE igual (misma transacción, mismo
// control de plata, misma idempotencia), así que hay una sola función.

import { Timestamp } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';
import { getAdminDb } from './_lib/firebaseAdmin.js';

const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://www.entratickets.com';

// Tolerancia al comparar lo cobrado contra el total de la orden. MP puede
// devolver el monto con centavos por redondeo de cuotas; $1 alcanza y sobra.
const AMOUNT_TOLERANCE = 1;

/**
 * Error que NO se arregla reintentando (stock agotado, monto que no coincide,
 * orden inexistente). MercadoPago reintenta ante cualquier no-2xx, así que si
 * devolviéramos 500 para estos casos MP quedaría reintentando para siempre algo
 * que nunca va a funcionar. Se responde 200 y se marca la orden para revisión.
 */
export class PermanentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'PermanentError';
  }
}

export function fmtDayKey(dk: string): string {
  try {
    const [y, m, d] = dk.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  } catch {
    return dk;
  }
}

/**
 * Emite las entradas de una orden cuyo pago ya está aprobado y verificado.
 * Idempotente: si la orden ya está confirmada, no emite nada y devuelve 0.
 * `origen` es solo para los logs: dice por qué puerta entró.
 */
export async function emitirOrdenPagada(
  orderId: string,
  payment: any,
  paymentId: string | number,
  origen: 'webhook' | 'reconciliacion' = 'webhook',
): Promise<{ emitidos: number }> {
  const TAG = origen === 'webhook' ? '[mp-webhook]' : '[reconciliar]';
  const db = getAdminDb();
  const orderRef = db.collection('orders').doc(orderId);

  // Preparamos la lista de tickets a emitir y ejecutamos todo en una transacción.
  const emitted: Array<{ id: string; qrCode: string; type: string }> = [];
  let orderData: any = null;

  await db.runTransaction(async (tx) => {
    // Firestore REINTENTA este callback si hay contención (MercadoPago manda dos
    // avisos casi juntos, y pasó: dos webhooks del mismo pago en el mismo segundo).
    // Los tickets del intento abortado se descartan, pero `emitted` vive afuera y
    // se los quedaba: el log decía "emitidos=1" cuando no se emitió nada, y peor,
    // se mandaba el mail con un QR que NO existe en la base. En la puerta ese QR
    // no escanea. Se vacía en cada intento para que solo queden los del que ganó.
    emitted.length = 0;

    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) throw new PermanentError(`Orden ${orderId} inexistente`, 'order_missing');
    orderData = orderSnap.data();

    // Idempotencia: si ya está confirmada, no reemitir.
    if (orderData.status === 'confirmed') return;

    // ── CONTROL DE PLATA (agregado 2026-07-25) ────────────────────────────
    // Hasta acá alcanzaba con que el pago estuviera 'approved' para emitir lo
    // que dijera orderData.items, sin mirar NUNCA cuánto se cobró de verdad.
    // Como la orden queda 'pending' en Firestore entre que se genera el link
    // de pago y que llega este webhook, editarla en esa ventana (subir
    // quantity) daba tickets que nadie pagó: se abonaba el total viejo y se
    // emitía el carrito nuevo.
    // create-payment.ts arma la preferencia con `total`, así que lo cobrado y
    // el total de la orden tienen que coincidir. Si no coinciden, la orden no
    // es la que se pagó: no se emite nada.
    const paidAmount = Number(payment.transaction_amount);
    const orderTotal = Number(orderData.total);
    if (!Number.isFinite(paidAmount) || !Number.isFinite(orderTotal)) {
      throw new PermanentError(
        `Montos no numéricos (pagado=${payment.transaction_amount} orden=${orderData.total})`,
        'amount_invalid',
      );
    }
    if (Math.abs(paidAmount - orderTotal) > AMOUNT_TOLERANCE) {
      throw new PermanentError(
        `Monto pagado ($${paidAmount}) != total de la orden ($${orderTotal})`,
        'amount_mismatch',
      );
    }

    const eventRef = db.collection('events').doc(orderData.eventId);
    const eventSnap = await tx.get(eventRef);
    if (!eventSnap.exists) throw new PermanentError(`Evento ${orderData.eventId} inexistente`, 'event_missing');
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
      // Permanente: reintentar no va a hacer aparecer stock. Antes esto tiraba
      // un Error común → 500 → MP reintentaba para siempre, y el comprador
      // quedaba pagado y sin entradas, en silencio.
      if (avail < bought.quantity) throw new PermanentError(`Sin stock de "${t.type}"`, 'out_of_stock');
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

  console.log(`${TAG} transacción OK: orden=${orderId} emitidos=${emitted.length} estadoOrdenPrevio=${orderData?.status} evento=${orderData?.eventId} buyer=${orderData?.buyerEmail}`);

  // 4) email de confirmación. IMPORTANTE: se AWAITEA. Antes era fire-and-forget y Vercel
  // congela la función apenas responde el 200, cortando el fetch → el email nunca salía.
  if (emitted.length > 0 && orderData) {
    // El estado del envío se GUARDA en la orden. Antes solo se logueaba el
    // status y además no se miraba si era 2xx: un 500 del endpoint de mail
    // quedaba registrado igual que un envío exitoso, y el panel no tenía forma
    // de saber que el comprador nunca recibió sus entradas.
    let emailStatus = 'failed';
    let emailError: string | null = null;
    try {
      const emailResp = await fetch(`${BASE_URL}/api/send-ticket-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.INTERNAL_API_SECRET
            ? { 'x-internal-secret': process.env.INTERNAL_API_SECRET }
            : {}),
        },
        body: JSON.stringify({
          orderId,
          eventId: orderData.eventId,
          eventTitle: orderData.eventTitle,
          buyerEmail: orderData.buyerEmail,
          buyerName: orderData.buyerName,
          tickets: emitted.map((t) => ({ qrCode: t.qrCode, type: t.type })),
        }),
      });
      if (emailResp.ok) {
        emailStatus = 'sent';
      } else {
        emailError = `HTTP ${emailResp.status}: ${(await emailResp.text().catch(() => '')).slice(0, 300)}`;
      }
      console.log(`${TAG} email a ${orderData.buyerEmail} status=${emailResp.status} ok=${emailResp.ok}`);
    } catch (e: any) {
      emailError = e?.message || String(e);
      console.error(`${TAG} email falló:`, emailError);
    }
    await db.collection('orders').doc(orderId).update({
      emailStatus,
      emailError,
      emailSentAt: Timestamp.now(),
    }).catch((e: any) => console.error(`${TAG} no se pudo registrar emailStatus:`, e?.message || e));
  }


  return { emitidos: emitted.length };
}
