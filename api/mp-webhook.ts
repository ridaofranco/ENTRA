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
import { esRechazoDefinitivo, sendPaymentFailedEmail } from './_payment-failed.js';

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
class PermanentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'PermanentError';
  }
}

function fmtDayKey(dk: string): string {
  try {
    const [y, m, d] = dk.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  } catch {
    return dk;
  }
}

export default async function handler(req: any, res: any) {
  // Se declaran acá afuera para que el catch pueda marcar la orden ante un
  // PermanentError (adentro del try quedarían fuera de alcance).
  let orderIdForLog: string | null = null;
  let paymentIdForLog: string | null = null;

  // MP espera un 200 rápido; respondemos 200 salvo error transitorio (para que reintente).
  try {
    // En marketplace el pago vive en la cuenta del PRODUCTOR: la preferencia manda
    // su id en ?seller=... para poder consultar el pago con el token correcto. Si no
    // viene seller, es una venta a la cuenta de ENTRÁ (token propio).
    const sellerId = req.query?.seller ? String(req.query.seller) : '';
    // Respaldo: MP manda el user_id del vendedor en el cuerpo del webhook. Si por lo que
    // sea no llegó el ?seller (ej. notificación global del panel), resolvemos el token por
    // ahí, para que un ticket YA PAGADO nunca deje de emitirse.
    const sellerMpUserId = req.body?.user_id ? String(req.body.user_id)
      : (req.query?.user_id ? String(req.query.user_id) : '');
    let accessToken = process.env.MP_ACCESS_TOKEN;
    try {
      const db = getAdminDb();
      if (sellerId) {
        const accSnap = await db.collection('mp_accounts').doc(sellerId).get();
        const acc = accSnap.exists ? (accSnap.data() as any) : null;
        if (acc?.access_token) accessToken = acc.access_token;
      } else if (sellerMpUserId) {
        const q = await db.collection('mp_accounts').where('mp_user_id', '==', sellerMpUserId).limit(1).get();
        if (!q.empty) { const acc = q.docs[0].data() as any; if (acc?.access_token) accessToken = acc.access_token; }
      }
    } catch { /* si falla la búsqueda, caemos al token de ENTRÁ */ }
    if (!accessToken) return res.status(500).json({ error: 'Falta credencial de cobro' });

    // El id del pago llega por query (?data.id=) o por body ({ data: { id } }).
    const paymentId =
      req.query?.['data.id'] || req.query?.id || req.body?.data?.id || req.body?.id;
    const topic = req.query?.type || req.query?.topic || req.body?.type;

    if (topic && topic !== 'payment') return res.status(200).json({ ignored: topic });
    if (!paymentId) return res.status(200).json({ ignored: 'sin id de pago' });
    paymentIdForLog = String(paymentId);

    const tokenSrc = sellerId ? `seller:${sellerId}` : (sellerMpUserId ? `mpuser:${sellerMpUserId}` : 'plataforma');
    const mp = new MercadoPagoConfig({ accessToken });
    const payment: any = await new Payment(mp).get({ id: String(paymentId) });
    console.log(`[mp-webhook] pago=${paymentId} status=${payment.status} extref=${payment.external_reference} token=${tokenSrc}`);

    // Registramos SIEMPRE el estado del intento (approved/rejected/pending) en la orden,
    // para trazabilidad en el panel. Si no está aprobado, no emitimos.
    if (payment.status !== 'approved') {
      console.log(`[mp-webhook] NO emito: pago no aprobado (status=${payment.status})`);
      const oid = payment.external_reference;
      if (oid) {
        const ref = getAdminDb().collection('orders').doc(oid);
        await ref
          .update({ paymentStatus: payment.status, mpPaymentId: String(paymentId) })
          .catch(() => {});

        // AVISO DE PAGO RECHAZADO. Hoy al que le rebota la tarjeta no le llega
        // nada: se va y no vuelve, siendo el lead más caliente que existe (ya
        // eligió el evento y ya puso los datos).
        //
        // Solo con rechazo DEFINITIVO: nunca con pending ni in_process, porque
        // esos se pueden aprobar minutos después y decirle "no pagaste" a alguien
        // que sí pagó es peor que no decir nada. Y una sola vez por orden: MP
        // notifica el mismo pago varias veces y tres mails así son una pesadilla.
        if (esRechazoDefinitivo(payment.status)) {
          try {
            const snap = await ref.get();
            const o: any = snap.exists ? snap.data() : null;
            if (o && !o.paymentFailedEmailAt && o.status !== 'confirmed' && o.buyerEmail) {
              const total = Number(o.total);
              const ok = await sendPaymentFailedEmail({
                buyerName: o.buyerName ?? null,
                buyerEmail: String(o.buyerEmail).trim().toLowerCase(),
                eventTitle: o.eventTitle ?? null,
                eventDate: o.eventDate ?? null,
                totalText: Number.isFinite(total) ? `$${total.toLocaleString('es-AR')}` : null,
                retryUrl: o.eventId ? `${BASE_URL}/evento/${o.eventId}` : BASE_URL,
              });
              if (ok) {
                await ref.update({ paymentFailedEmailAt: new Date().toISOString() }).catch(() => {});
              }
            }
          } catch (e) {
            // El estado del pago ya quedó registrado; el aviso es secundario.
            console.error('[mp-webhook] aviso de pago rechazado falló:', e instanceof Error ? e.message : String(e));
          }
        }
      }
      return res.status(200).json({ ok: true, status: payment.status });
    }

    const orderId = payment.external_reference;
    if (!orderId) { console.log('[mp-webhook] NO emito: pago aprobado SIN external_reference'); return res.status(200).json({ ignored: 'sin external_reference' }); }
    orderIdForLog = String(orderId);

    const db = getAdminDb();
    const orderRef = db.collection('orders').doc(orderId);

    // Preparamos la lista de tickets a emitir y ejecutamos todo en una transacción.
    const emitted: Array<{ id: string; qrCode: string; type: string }> = [];
    let orderData: any = null;

    await db.runTransaction(async (tx) => {
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

    console.log(`[mp-webhook] transacción OK: orden=${orderId} emitidos=${emitted.length} estadoOrdenPrevio=${orderData?.status} evento=${orderData?.eventId} buyer=${orderData?.buyerEmail}`);

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
        console.log(`[mp-webhook] email a ${orderData.buyerEmail} status=${emailResp.status} ok=${emailResp.ok}`);
      } catch (e: any) {
        emailError = e?.message || String(e);
        console.error('[mp-webhook] email falló:', emailError);
      }
      await db.collection('orders').doc(orderId).update({
        emailStatus,
        emailError,
        emailSentAt: Timestamp.now(),
      }).catch((e: any) => console.error('[mp-webhook] no se pudo registrar emailStatus:', e?.message || e));
    }

    return res.status(200).json({ ok: true, emitted: emitted.length });
  } catch (err: any) {
    const permanent = err instanceof PermanentError;
    console.error(`[mp-webhook] error${permanent ? ` PERMANENTE (${err.code})` : ''}:`, err?.message || err);

    if (permanent) {
      // Reintentar no lo arregla. Marcamos la orden para que aparezca en el panel
      // (el comprador PAGÓ y no tiene entradas: hay que resolverlo a mano) y
      // devolvemos 200 para que MP deje de reintentar.
      if (orderIdForLog && err.code !== 'order_missing') {
        await getAdminDb().collection('orders').doc(orderIdForLog).update({
          status: 'needs_attention',
          issueCode: err.code,
          issueMessage: String(err.message).slice(0, 500),
          issueAt: Timestamp.now(),
          mpPaymentId: paymentIdForLog,
        }).catch((e: any) => console.error('[mp-webhook] no se pudo marcar la orden:', e?.message || e));
      }
      return res.status(200).json({ ok: false, permanent: true, code: err.code });
    }

    // 500 → MercadoPago reintenta la notificación más tarde
    return res.status(500).json({ error: 'Error procesando el pago' });
  }
}
