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
import { getAdminDb } from './_lib/firebaseAdmin.js';
import { emitirOrdenPagada, PermanentError } from './_emitir-entradas.js';
import { esRechazoDefinitivo, sendPaymentFailedEmail } from './_payment-failed.js';
import { alerta } from './_alerta.js';

const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://www.entratickets.com';

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
        // `status_detail` es el motivo real del rechazo y hasta ahora se descartaba.
        // Sin él no se puede distinguir un "llamá a tu banco a autorizar" (la venta
        // más recuperable que hay) de un "no lo reintentes con esa tarjeta". Se guarda
        // en la orden para el mail de abajo y para poder mirarlo en el panel después.
        await ref
          .update({
            paymentStatus: payment.status,
            mpPaymentId: String(paymentId),
            paymentStatusDetail: (payment as any).status_detail || null,
          })
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
                statusDetail: (payment as any).status_detail || null,
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

    // La emisión vive en _emitir-entradas.ts porque la comparte con la
    // reconciliación (api/_cron-reconciliar.ts), que rescata los pagos aprobados
    // de los que MP nunca avisó. Las dos puertas tienen que emitir igual.
    const { emitidos } = await emitirOrdenPagada(String(orderId), payment, String(paymentId), 'webhook');

    return res.status(200).json({ ok: true, emitted: emitidos });
  } catch (err: any) {
    const permanent = err instanceof PermanentError;
    console.error(`[mp-webhook] error${permanent ? ` PERMANENTE (${err.code})` : ''}:`, err?.message || err);

    // El comprador pagó y algo se rompió emitiendo. Un 'needs_attention' en el
    // panel solo sirve si alguien entra a mirarlo: acá lo que hace falta es que
    // Franco se entere en el celular, porque del otro lado hay alguien que pagó.
    await alerta({
      titulo: permanent
        ? 'Un pago quedó sin emitir y hay que resolverlo a mano'
        : 'Falló el webhook de pagos (MercadoPago va a reintentar)',
      plata: true,
      datos: { orden: orderIdForLog, pago: paymentIdForLog, causa: permanent ? err.code : undefined },
      detalle: String(err?.message || err),
      clave: permanent ? `emision-${err.code}` : 'webhook-transitorio',
    });

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
