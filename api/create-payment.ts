// ============================================================================
// CREAR PAGO — MercadoPago Checkout Pro (backend de confianza)
// ============================================================================
// Este endpoint reemplaza la "compra" que hoy hace el navegador. El flujo nuevo:
//   1) el frontend manda el carrito (evento + entradas + comprador)
//   2) ACÁ, en el servidor, se RE-VALIDAN el precio y el stock contra Firestore
//      (nunca se confía en los números que manda el navegador)
//   3) se crea la orden en estado 'pending' (todavía no hay ticket ni se tocó el stock)
//   4) se crea la preferencia de pago en MercadoPago y se devuelve el link de pago
//   5) el comprador paga en MP → MP avisa al webhook (mp-webhook.ts) → recién ahí
//      se emiten los tickets y se descuenta el stock
//
// Requiere en Vercel: MP_ACCESS_TOKEN (MercadoPago) y FIREBASE_SERVICE_ACCOUNT.
// Split/marketplace (que MP le pague al organizador) se suma en un paso posterior,
// cuando cada organizador tenga su cuenta de MP vinculada.

import { MercadoPagoConfig, Preference } from 'mercadopago';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './_lib/firebaseAdmin.js';

const PLATFORM_FEE_RATE = 0.08;   // comisión ENTRÁ sobre el ticket
const IVA = 1.21;                 // 21%
const PROCESSOR_GROSSUP = 0.0499; // costo de procesador que absorbe el comprador (revisar con la tasa preferencial de MP)
const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://www.entratickets.com';

type IncomingItem = { type: string; quantity: number; days?: number };

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { eventId, items, buyer, buyerId, discountCode } = req.body || {};

    if (!eventId || !Array.isArray(items) || items.length === 0 || !buyer?.email || !buyer?.name || !buyer?.dni) {
      return res.status(400).json({ error: 'Faltan datos de la compra (evento, entradas o comprador).' });
    }

    const db = getAdminDb();

    // --- 1) leer el evento REAL (fuente de verdad de precio y stock) ---
    const eventSnap = await db.collection('events').doc(eventId).get();
    if (!eventSnap.exists) {
      return res.status(404).json({ error: 'El evento no existe.' });
    }
    const event: any = eventSnap.data();
    if (!['active', 'published'].includes(event.status)) {
      return res.status(409).json({ error: 'El evento no está disponible para la venta.' });
    }

    const isFree = Boolean(event.isFree);
    const eventTickets: any[] = Array.isArray(event.tickets) ? event.tickets : [];
    const validDays: string[] = Array.isArray(event.validDays) ? event.validDays : [];
    const isPerDay = Boolean(event.isMultiDay) && event.entryMode === 'per_day' && validDays.length > 0;
    const daysMultiplier = isPerDay ? validDays.length : 1;

    // --- 2) validar cada tipo de entrada contra el evento real ---
    let subtotal = 0;
    const normalizedItems: Array<{ type: string; quantity: number; unitPrice: number }> = [];

    for (const it of items as IncomingItem[]) {
      const qty = Math.floor(Number(it.quantity) || 0);
      if (qty <= 0) continue;
      const real = eventTickets.find((t) => t.type === it.type);
      if (!real) {
        return res.status(400).json({ error: `El tipo de entrada "${it.type}" no existe en este evento.` });
      }
      // stock: se controla en firme en el webhook (transacción), pero cortamos temprano si ya no hay
      if (!isFree && typeof real.available === 'number' && real.available < qty) {
        return res.status(409).json({ error: `No quedan suficientes entradas de "${it.type}".` });
      }
      const unitPrice = isFree ? 0 : Number(real.price) || 0;
      subtotal += unitPrice * qty * daysMultiplier;
      normalizedItems.push({ type: it.type, quantity: qty, unitPrice });
    }

    if (normalizedItems.length === 0) {
      return res.status(400).json({ error: 'No hay entradas válidas en la compra.' });
    }

    // --- 3) descuento (validado server-side contra discount_codes) ---
    let discountAmount = 0;
    let discountRef: FirebaseFirestore.DocumentReference | null = null;
    let discountData: any = null;
    if (discountCode && !isFree) {
      const dq = await db.collection('discount_codes')
        .where('eventId', '==', eventId)
        .where('code', '==', String(discountCode).toUpperCase())
        .limit(1).get();
      if (!dq.empty) {
        const d = dq.docs[0];
        const dc = d.data() as any;
        const expired = dc.validUntil && dc.validUntil.toDate && dc.validUntil.toDate() < new Date();
        const maxedOut = dc.maxUses != null && (dc.usedCount || 0) >= dc.maxUses;
        if (dc.active && !expired && !maxedOut) {
          discountAmount = dc.type === 'percentage'
            ? subtotal * (Number(dc.value) / 100)
            : Math.min(subtotal, Number(dc.value));
          discountRef = d.ref;
          discountData = { id: d.id, code: dc.code };
        }
      }
    }

    // --- 4) fee y total (comprador absorbe comisión + procesador) ---
    const subAfterDiscount = Math.max(0, subtotal - discountAmount);
    const feeConIva = isFree ? 0 : Math.round(subAfterDiscount * PLATFORM_FEE_RATE * IVA);
    const total = isFree ? 0 : Math.round((subAfterDiscount + feeConIva) / (1 - PROCESSOR_GROSSUP));

    // --- Marketplace / split: ¿el organizador conectó su MercadoPago? ---
    // Si conectó, cobramos con SU token + marketplace_fee (la comisión de ENTRÁ):
    // MercadoPago le paga directo a él y a ENTRÁ su comisión, automáticamente. Si
    // no conectó, se cobra a la cuenta de ENTRÁ (comportamiento actual, sin split).
    const organizerId: string = event.organizerId || '';
    let sellerToken = process.env.MP_ACCESS_TOKEN;
    let isMarketplace = false;
    if (organizerId) {
      const accSnap = await db.collection('mp_accounts').doc(organizerId).get();
      const acc = accSnap.exists ? (accSnap.data() as any) : null;
      if (acc?.access_token) {
        sellerToken = acc.access_token;
        isMarketplace = true;
      }
    }

    // --- 5) crear la ORDEN en estado pending (aún sin ticket ni descuento de stock) ---
    const orderRef = await db.collection('orders').add({
      buyerId: buyerId || 'guest',
      buyerEmail: buyer.email,
      buyerName: buyer.name,
      buyerDni: buyer.dni,
      buyerPhone: buyer.phone || '',
      eventId,
      eventTitle: event.title,
      items: normalizedItems,
      discountCodeId: discountData?.id || null,
      discountCode: discountData?.code || null,
      discountAmount,
      subtotal,
      fee: feeConIva,
      total,
      status: 'pending',
      paymentMethod: 'mercadopago',
      collectorId: isMarketplace ? organizerId : null,
      marketplace: isMarketplace,
      createdAt: Timestamp.now(),
    });

    // incremento de uso del cupón (idempotencia real se refuerza en el webhook)
    if (discountRef) {
      // BUG FIX: antes escribía (usedCount||0)+1 con usedCount indefinido → siempre 1,
      // así maxUses nunca limitaba (cupones infinitos). increment() suma sobre el valor real.
      await discountRef.update({ usedCount: FieldValue.increment(1), updatedAt: Timestamp.now() }).catch(() => {});
    }

    // --- evento gratis: no pasa por MercadoPago, se confirma directo ---
    if (isFree || total === 0) {
      return res.status(200).json({ free: true, orderId: orderRef.id });
    }

    // --- 6) crear la preferencia de pago en MercadoPago ---
    // En marketplace usamos el token del PRODUCTOR (sellerToken); si no, el de ENTRÁ.
    if (!sellerToken) {
      return res.status(500).json({ error: 'Falta la credencial de cobro en el servidor.' });
    }
    const mp = new MercadoPagoConfig({ accessToken: sellerToken });
    const prefBody: any = {
      items: [{
        id: eventId,
        title: `Entradas · ${event.title}`.slice(0, 250),
        quantity: 1,
        unit_price: total,
        currency_id: 'ARS',
      }],
      payer: { name: buyer.name, email: buyer.email },
      external_reference: orderRef.id,
      // En marketplace el pago vive en la cuenta del PRODUCTOR, así que pasamos su
      // id en la URL del webhook para poder consultar el pago con el token correcto.
      notification_url: `${BASE_URL}/api/mp-webhook${isMarketplace ? `?seller=${encodeURIComponent(organizerId)}` : ''}`,
      back_urls: {
        success: `${BASE_URL}/checkout?status=success&order=${orderRef.id}`,
        failure: `${BASE_URL}/checkout?status=failure&order=${orderRef.id}`,
        pending: `${BASE_URL}/checkout?status=pending&order=${orderRef.id}`,
      },
      auto_return: 'approved',
      statement_descriptor: 'ENTRA TICKETS',
    };
    // Comisión de ENTRÁ: MercadoPago la descuenta del total y se la acredita a ENTRÁ
    // (dueña de la app de marketplace); el resto va directo al productor.
    if (isMarketplace) {
      prefBody.marketplace_fee = feeConIva;
    }
    const preference = await new Preference(mp).create({ body: prefBody });

    // MP_SANDBOX=true → devolvemos el link de PRUEBA (sandbox_init_point) para testear el
    // flujo completo con tarjetas de prueba, sin cobrar de verdad. Sin la flag, link real.
    const sandbox = process.env.MP_SANDBOX === 'true';
    return res.status(200).json({
      orderId: orderRef.id,
      init_point: sandbox ? preference.sandbox_init_point : preference.init_point,
      preferenceId: preference.id,
    });
  } catch (err: any) {
    console.error('[create-payment] error:', err?.message || err);
    return res.status(500).json({ error: 'No se pudo iniciar el pago. Intentá de nuevo.' });
  }
}
