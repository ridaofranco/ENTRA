// Mail de PAGO RECHAZADO.
//
// POR QUÉ EXISTE: hoy, cuando a alguien le rebota la tarjeta, no recibe nada. Se
// va y no vuelve. Y es el lead más caliente que existe: ya eligió el evento, ya
// puso los datos y ya decidió ir. Perderlo en silencio es plata que se va sin que
// nadie se entere, ni el comprador ni nosotros.
//
// ══ REGLAS DURAS DE ESTE MAIL, que son la parte importante ══
// 1. SOLO se manda cuando el pago quedó DEFINITIVAMENTE rechazado o cancelado.
//    NUNCA con "pending" ni "in_process": ahí el pago puede aprobarse minutos
//    después (efectivo, débito en proceso, revisión antifraude), y decirle "no
//    pagaste" a alguien que sí pagó es mucho peor que no decirle nada.
// 2. UNA SOLA VEZ por orden. MercadoPago notifica el mismo pago varias veces, y
//    tres mails diciendo "no pudimos cobrarte" son una pesadilla. El candado es
//    `paymentFailedEmailAt` en la orden.
// 3. Nunca tira. Si el mail falla, el webhook tiene que seguir contestando 200
//    igual: el estado del pago ya quedó registrado y eso es lo que importa.

import { deliver } from './_mailer.js';
import { botonWhatsApp } from './_whatsapp.js';

const BASE_URL = 'https://entra-by-der.vercel.app';
const LOGO_DARK = `${BASE_URL}/entra-logo-dark.png`;

/** Estados de MercadoPago en los que SÍ corresponde avisar. */
export function esRechazoDefinitivo(status?: string | null): boolean {
  const s = String(status || '').toLowerCase();
  return s === 'rejected' || s === 'cancelled' || s === 'charged_back';
}

const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export interface PaymentFailedData {
  buyerName?: string | null;
  buyerEmail: string;
  eventTitle?: string | null;
  eventDate?: string | null;
  totalText?: string | null;
  /** Link para reintentar la compra (la página del evento). */
  retryUrl: string;
}

// Exportada para poder previsualizar el mail sin mandarlo (Franco pidió ver cómo llega).
export function buildHtml(d: PaymentFailedData): string {
  const firstName = String(d.buyerName || '').trim().split(/\s+/)[0] || '';
  const saludo = firstName ? `Tranquilo/a ${esc(firstName)}` : 'Tranquilo/a';

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tu pago no pas&oacute;</title></head>
<body bgcolor="#ECECEE" style="margin:0;padding:0;background-color:#ECECEE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#18181B;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">No pudimos cobrar tu entrada, pero tu lugar sigue disponible.</div>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#ECECEE" style="background-color:#ECECEE;padding:24px 12px;"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#FFFFFF" style="max-width:600px;width:100%;background-color:#FFFFFF;border-radius:22px;overflow:hidden;border:1px solid #E4E4E7;">

    <tr><td style="padding:26px 32px 22px 32px;border-bottom:3px solid #FF5C00;">
      <img src="${LOGO_DARK}" alt="ENTR&Aacute;" width="104" style="display:block;border:0;outline:none;height:auto;">
    </td></tr>

    <tr><td style="padding:32px 32px 6px 32px;text-align:center;">
      <p style="margin:0;font-size:26px;font-weight:900;color:#18181B;letter-spacing:-0.5px;line-height:1.1;text-transform:uppercase;">Tu pago no pas&oacute;</p>
      <p style="margin:14px 0 0 0;font-size:15px;color:#71717A;line-height:1.6;">${saludo}: <b style="color:#18181B;">no te cobramos nada</b> y tu lugar sigue disponible.</p>
    </td></tr>

    ${d.eventTitle ? `<tr><td style="padding:22px 32px 0 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#F7F7F8" style="background-color:#F7F7F8;border-radius:16px;border:1px solid #ECECEE;border-left:4px solid #FF5C00;">
        <tr><td style="padding:20px 22px;">
          <p style="margin:0;font-size:10px;font-weight:800;color:#EA580C;letter-spacing:2px;text-transform:uppercase;">Quer&iacute;as</p>
          <p style="margin:8px 0 0 0;font-size:20px;font-weight:900;color:#18181B;line-height:1.2;text-transform:uppercase;letter-spacing:-0.3px;">${esc(d.eventTitle)}</p>
          ${d.eventDate ? `<p style="margin:8px 0 0 0;font-size:13px;color:#52525B;">${esc(d.eventDate)}</p>` : ''}
          ${d.totalText ? `<p style="margin:6px 0 0 0;font-size:13px;color:#52525B;">${esc(d.totalText)}</p>` : ''}
        </td></tr>
      </table>
    </td></tr>` : ''}

    <tr><td style="padding:20px 32px 0 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#F7F7F8" style="background-color:#F7F7F8;border-radius:14px;border:1px solid #ECECEE;">
        <tr><td style="padding:18px 20px;">
          <p style="margin:0 0 10px 0;font-size:11px;font-weight:800;color:#52525B;letter-spacing:1.5px;text-transform:uppercase;">Qu&eacute; suele pasar</p>
          <p style="margin:0 0 7px 0;font-size:13px;color:#71717A;line-height:1.5;">&#8226;&nbsp; El banco rechaza compras online por seguridad: llamalos o autorizala desde su app.</p>
          <p style="margin:0 0 7px 0;font-size:13px;color:#71717A;line-height:1.5;">&#8226;&nbsp; Prob&aacute; con otra tarjeta, o con dinero en cuenta de MercadoPago.</p>
          <p style="margin:0;font-size:13px;color:#71717A;line-height:1.5;">&#8226;&nbsp; Revis&aacute; que el nombre y el documento sean los del titular de la tarjeta.</p>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:24px 32px 8px 32px;text-align:center;">
      <a href="${esc(d.retryUrl)}" style="display:inline-block;background-color:#FF5C00;color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;padding:14px 30px;border-radius:999px;">Volver a intentar</a>
    </td></tr>

    <tr><td style="padding:16px 32px 30px 32px;text-align:center;">
      <p style="margin:0 0 16px 0;font-size:12px;color:#71717A;">Si te sigue fallando, escribinos y lo resolvemos con vos:</p>
      ${botonWhatsApp(
        d.eventTitle
          ? `Hola, tuve un problema para pagar mi entrada de ${d.eventTitle}.`
          : 'Hola, tuve un problema para pagar mi entrada.',
        'Escribinos por WhatsApp',
      )}
      <p style="margin:16px 0 0 0;font-size:12px;color:#71717A;">O respond&eacute; este mail:</p>
      <p style="margin:6px 0 0 0;"><a href="mailto:tuticket@entratickets.com" style="color:#EA580C;font-size:13px;font-weight:700;text-decoration:none;">tuticket@entratickets.com</a></p>
      <p style="margin:14px 0 0 0;font-size:10px;color:#A1A1AA;letter-spacing:0.5px;">entratickets.com &#183; Plataforma de ticketing digital</p>
    </td></tr>

  </table>
</td></tr></table>
</body></html>`;
}

/**
 * Manda el aviso. Devuelve true solo si salió, para que el caller pueda estampar
 * el candado y no repetirlo. NUNCA tira.
 */
export async function sendPaymentFailedEmail(d: PaymentFailedData): Promise<boolean> {
  try {
    if (!d.buyerEmail) return false;
    const r = await deliver({
      to: d.buyerEmail,
      subject: `No se pudo cobrar tu entrada${d.eventTitle ? ` para ${d.eventTitle}` : ''}`,
      html: buildHtml(d),
      attachments: [],
    });
    if (!r.ok) console.error('[payment-failed] no salió el aviso:', r.error);
    return !!r.ok;
  } catch (e) {
    console.error('[payment-failed] error mandando el aviso:', e instanceof Error ? e.message : String(e));
    return false;
  }
}
