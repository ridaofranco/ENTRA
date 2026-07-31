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
import { randomUUID } from 'crypto';
import { getAdminDb } from './_lib/firebaseAdmin.js';
import { frenado } from './_rate-limit.js';

const PLATFORM_FEE_RATE = 0.08;   // comisión ENTRÁ sobre el ticket
const IVA = 1.21;                 // 21%
const PROCESSOR_GROSSUP = 0.0499; // costo de procesador que absorbe el comprador (revisar con la tasa preferencial de MP)
const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://www.entratickets.com';

type IncomingItem = { type: string; quantity: number; days?: number };

function fmtDayKey(dk: string): string {
  try {
    const [y, m, d] = dk.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  } catch {
    return dk;
  }
}

/**
 * DATOS DEL COMPRADOR PARA EL ANTIFRAUDE DE MERCADO PAGO
 *
 * Soporte de MP (ticket WCS-43463, 2026-07-30) revisó nuestros 4 primeros pagos y
 * marcó un patrón: los aprobados tenían contexto del comprador, y el rechazado por
 * `cc_rejected_high_risk` entró como anónimo. Su recomendación concreta fue mandar
 * el payer y los items completos, porque cada dato es una señal más para el motor
 * de riesgo. Nosotros ya le pedimos al comprador nombre, mail, DNI (los tres
 * obligatorios) y teléfono, y hasta hoy solo le mandábamos nombre y mail.
 *
 * Domicilio (payer.address) NO se manda porque no lo pedimos, y sumar campos al
 * checkout es exactamente lo que baja la conversión. Queda como decisión de producto.
 *
 * Las tres funciones de abajo son deliberadamente conservadoras: si un dato no se
 * puede interpretar con certeza, se omite. Nunca inventan un valor, porque un dato
 * inventado le miente al antifraude y es peor que no mandar nada.
 */

/** "Juan Carlos Pérez" → { name: "Juan", surname: "Carlos Pérez" }. Un solo token: sin apellido. */
function partirNombre(completo: string): { name: string; surname?: string } {
  const partes = String(completo).trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return { name: partes[0] || '' };
  return { name: partes[0], surname: partes.slice(1).join(' ') };
}

/** DNI argentino: solo dígitos, y solo si el largo es verosímil (7 u 8). */
function identificacion(dni: string): { type: string; number: string } | null {
  const soloDigitos = String(dni).replace(/\D/g, '');
  if (soloDigitos.length < 7 || soloDigitos.length > 8) return null;
  return { type: 'DNI', number: soloDigitos };
}

/**
 * Teléfono argentino. Se separa el código de área SOLO cuando se puede afirmar:
 * los 10 dígitos que arrancan en 11 son AMBA. En cualquier otro caso se manda el
 * número completo sin área, en vez de adivinar un corte y mandar un área falsa.
 */
function telefono(bruto: string): { area_code?: string; number: string } | null {
  let d = String(bruto).replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('54')) d = d.slice(2);        // +54
  if (d.length === 11 && d.startsWith('9')) d = d.slice(1); // el 9 de celular
  if (d.length < 8) return null;
  if (d.length === 10 && d.startsWith('11')) return { area_code: '11', number: d.slice(2) };
  return { number: d };
}

/**
 * ORIGEN DE LA VENTA (lo manda el navegador, ver src/lib/attribution.ts).
 *
 * Es un dato informativo: no toca precio, ni stock, ni permisos. Aun así se
 * sanea acá, porque cualquiera puede postear a este endpoint: se aceptan solo
 * seis campos conocidos, cada uno recortado, y se descarta todo lo demás. Sin
 * este filtro, un tercero podría escribirle basura (o HTML) al panel del
 * productor a través de una compra.
 */
function saneaOrigen(bruto: any): Record<string, string> | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const campos = ['source', 'medium', 'campaign', 'content', 'term', 'referrer', 'landing'];
  const limpio: Record<string, string> = {};
  for (const c of campos) {
    const v = bruto[c];
    if (typeof v !== 'string') continue;
    const s = v.trim().replace(/[<>]/g, '').slice(0, 120);
    if (s) limpio[c] = s;
  }
  return limpio.source ? limpio : null;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Freno de abuso. 8 por minuto por IP: alguien comprando de verdad entra una
  // vez, y como mucho reintenta un par si se equivocó o le rebotó la tarjeta.
  // Se pone ANTES de leer Firestore y de tocar MercadoPago, que es justo lo que
  // hay que proteger (ver el comentario largo de _rate-limit.ts).
  if (frenado(req, res, 'create-payment', 8)) return;

  try {
    const { eventId, items, buyer, buyerId, discountCode, origen } = req.body || {};

    if (!eventId || !Array.isArray(items) || items.length === 0 || !buyer?.email || !buyer?.name || !buyer?.dni) {
      return res.status(400).json({ error: 'Faltan datos de la compra (evento, entradas o comprador).' });
    }

    // Normalizamos el email a minúsculas SIEMPRE. Firebase Auth guarda el email en
    // minúsculas, y "Mis Tickets" busca por igualdad exacta; si el comprador lo tipea
    // en mayúsculas (FRANCO@...), el ticket no aparecía en su cuenta. Bug real, cerrado acá.
    buyer.email = String(buyer.email).trim().toLowerCase();

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
      // De dónde vino el comprador. Se guarda en la orden pending, o sea ANTES
      // de que el pago se confirme: si esperáramos al webhook, MercadoPago sería
      // el último referrer y perderíamos justo lo que queremos medir.
      origen: saneaOrigen(origen),
      createdAt: Timestamp.now(),
    });

    // incremento de uso del cupón (idempotencia real se refuerza en el webhook)
    if (discountRef) {
      // BUG FIX: antes escribía (usedCount||0)+1 con usedCount indefinido → siempre 1,
      // así maxUses nunca limitaba (cupones infinitos). increment() suma sobre el valor real.
      await discountRef.update({ usedCount: FieldValue.increment(1), updatedAt: Timestamp.now() }).catch(() => {});
    }

    // --- evento gratis (o total $0): no pasa por MercadoPago, se resuelve ACÁ ---
    // Antes se devolvía {free:true} pelado y el NAVEGADOR seguía con su "flujo
    // directo": creaba una SEGUNDA orden (la de acá quedaba pending huérfana,
    // duplicada) y emitía los tickets desde el cliente. Encima, si el evento
    // tenía isFree apagado pero precio $0 (o descuento del 100%), las reglas de
    // Firestore ni siquiera dejaban emitir: dos órdenes y cero entradas.
    // Ahora la reserva gratis usa el mismo patrón que el webhook de pago: UNA
    // transacción que valida y descuenta stock, emite los tickets con QR de
    // servidor y confirma la orden. El mail sale desde acá con el secreto
    // interno (el navegador ya no llama a send-ticket-email para esto).
    if (isFree || total === 0) {
      const emitted: Array<{ id: string; qrCode: string; type: string }> = [];
      try {
        await db.runTransaction(async (tx) => {
          const evSnap = await tx.get(eventSnap.ref);
          const ev: any = evSnap.data() || {};
          const evTickets: any[] = Array.isArray(ev.tickets) ? ev.tickets : [];

          // 1) validar y descontar stock (los gratis también se agotan)
          let totalQty = 0;
          const updatedTickets = evTickets.map((t) => {
            const bought = normalizedItems.find((it) => it.type === t.type);
            if (!bought) return t;
            const avail = typeof t.available === 'number' ? t.available : Infinity;
            if (avail < bought.quantity) throw new Error(`Sin stock de "${t.type}"`);
            totalQty += bought.quantity;
            return { ...t, available: avail === Infinity ? t.available : Math.max(0, avail - bought.quantity) };
          });
          tx.update(eventSnap.ref, {
            tickets: updatedTickets,
            ticketsSold: (ev.ticketsSold || 0) + totalQty,
            updatedAt: Timestamp.now(),
          });

          // 2) emitir tickets (un QR por jornada si es per_day; uno para todo si no)
          for (const it of normalizedItems) {
            const issueGroups: string[][] = isPerDay ? validDays.map((dk) => [dk]) : [validDays];
            for (let i = 0; i < it.quantity; i++) {
              for (const grpDays of issueGroups) {
                const qrCode = randomUUID();
                const dayLabel = isPerDay && grpDays[0] ? fmtDayKey(grpDays[0]) : '';
                const newRef = db.collection('tickets').doc();
                const ticketData: any = {
                  orderId: orderRef.id,
                  eventId,
                  eventTitle: event.title,
                  buyerId: buyerId || 'guest',
                  buyerName: buyer.name,
                  buyerEmail: buyer.email,
                  buyerPhone: buyer.phone || '',
                  buyerDni: buyer.dni,
                  ticketType: it.type,
                  price: 0,
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

          // 3) confirmar la orden (la ÚNICA orden de la reserva)
          tx.update(orderRef, {
            status: 'confirmed',
            paymentMethod: 'free',
            paidAt: Timestamp.now(),
          });
        });
      } catch (txErr: any) {
        // La orden quedó pending y no se emitió nada: se puede reintentar.
        console.error(`[create-payment] reserva gratis falló: orden=${orderRef.id}`, txErr?.message || txErr);
        return res.status(409).json({ error: txErr?.message?.startsWith('Sin stock') ? txErr.message : 'No se pudo confirmar la reserva. Intentá de nuevo.' });
      }

      // 4) mail de confirmación, igual que el webhook: awaiteado y con el
      // resultado guardado en la orden para poder auditarlo desde el panel.
      let emailStatus = 'failed';
      let emailError: string | null = null;
      try {
        const eventDateText = event.date?.toDate
          ? event.date.toDate().toLocaleDateString('es-AR', {
              weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
              timeZone: 'America/Argentina/Buenos_Aires',
            })
          : '';
        const emailResp = await fetch(`${BASE_URL}/api/send-ticket-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.INTERNAL_API_SECRET
              ? { 'x-internal-secret': process.env.INTERNAL_API_SECRET }
              : {}),
          },
          body: JSON.stringify({
            orderId: orderRef.id,
            eventId,
            eventTitle: event.title,
            eventDate: eventDateText,
            eventVenue: event.venue || '',
            eventLocation: event.location || '',
            buyerEmail: buyer.email,
            buyerName: buyer.name,
            buyerDni: buyer.dni,
            total: 0,
            tickets: emitted.map((t) => ({ qrCode: t.qrCode, type: t.type })),
          }),
        });
        if (emailResp.ok) {
          emailStatus = 'sent';
        } else {
          emailError = `HTTP ${emailResp.status}: ${(await emailResp.text().catch(() => '')).slice(0, 300)}`;
        }
      } catch (e: any) {
        emailError = e?.message || String(e);
        console.error('[create-payment] email de reserva gratis falló:', emailError);
      }
      await orderRef.update({ emailStatus, emailError, emailSentAt: Timestamp.now() }).catch(() => {});

      console.log(`[create-payment] reserva GRATIS ok: orden=${orderRef.id} buyer=${buyer.email} tickets=${emitted.length} email=${emailStatus}`);
      return res.status(200).json({ free: true, orderId: orderRef.id, tickets: emitted });
    }

    // --- 6) crear la preferencia de pago en MercadoPago ---
    // En marketplace usamos el token del PRODUCTOR (sellerToken); si no, el de ENTRÁ.
    if (!sellerToken) {
      return res.status(500).json({ error: 'Falta la credencial de cobro en el servidor.' });
    }
    const mp = new MercadoPagoConfig({ accessToken: sellerToken });

    // El detalle de lo que se compró, para la descripción del ítem: "2x General, 1x VIP".
    const detalleEntradas = normalizedItems.map((i) => `${i.quantity}x ${i.type}`).join(', ');
    // picture_url solo si es absoluta: una ruta relativa no la puede resolver MP.
    const imagenEvento = typeof event.image === 'string' && /^https?:\/\//.test(event.image)
      ? event.image
      : undefined;

    const nombrePartido = partirNombre(buyer.name);
    const docComprador = identificacion(buyer.dni);
    const telComprador = buyer.phone ? telefono(buyer.phone) : null;

    const prefBody: any = {
      items: [{
        id: eventId,
        title: `Entradas · ${event.title}`.slice(0, 250),
        // Los 4 campos que pidió MP en el ticket WCS-43463. Van en UN solo ítem a
        // propósito: el total incluye los cargos, y MP exige que la suma de los
        // items sea igual al monto de la transacción. Partirlo por tipo de entrada
        // haría que no cierre.
        description: `${detalleEntradas} · ${event.title}`.slice(0, 250),
        category_id: 'tickets',
        ...(imagenEvento ? { picture_url: imagenEvento } : {}),
        quantity: 1,
        unit_price: total,
        currency_id: 'ARS',
      }],
      payer: {
        ...nombrePartido,
        email: buyer.email,
        ...(docComprador ? { identification: docComprador } : {}),
        ...(telComprador ? { phone: telComprador } : {}),
      },
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
    // RED DE SEGURIDAD. Los datos de arriba son señales para el antifraude, no algo
    // sin lo cual no se pueda cobrar: si MP rechazara la preferencia por alguno de
    // esos campos, perder la venta sería mucho peor que perder la señal. Entonces se
    // reintenta UNA vez con el cuerpo mínimo, que es exactamente el que funcionaba
    // antes de este cambio. Si el que falla es el cuerpo mínimo, ahí sí es un error
    // real y sube como siempre.
    let preference: any;
    let datosCompletos = true;
    try {
      preference = await new Preference(mp).create({ body: prefBody });
    } catch (errPref: any) {
      datosCompletos = false;
      console.error('[create-payment] la preferencia con datos completos fallo, reintento con lo minimo:', errPref?.message || errPref);
      const minimo = { ...prefBody };
      minimo.items = [{ id: eventId, title: `Entradas · ${event.title}`.slice(0, 250), quantity: 1, unit_price: total, currency_id: 'ARS' }];
      minimo.payer = { name: buyer.name, email: buyer.email };
      preference = await new Preference(mp).create({ body: minimo });
    }
    console.log(`[create-payment] orden=${orderRef.id} buyer=${buyer.email} split=${isMarketplace} organizer=${organizerId} fee=${feeConIva} total=${total} pref=${preference.id} notif=${prefBody.notification_url} datosAntifraude=${datosCompletos ? 'completos' : 'MINIMOS(fallback)'} doc=${docComprador ? 'si' : 'no'} tel=${telComprador ? 'si' : 'no'}`);

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
