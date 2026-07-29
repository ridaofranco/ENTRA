// Mails transaccionales de EVENTOS: cancelación, transferencia y recordatorio.
//
// Los tres reusan la plantilla de marca del mail del ticket (send-ticket-email):
// fondo #ECECEE, tarjeta blanca con header de logo y borde naranja, tarjeta de
// evento con borde izquierdo de color, secciones #F7F7F8 y footer con el botón
// oficial de WhatsApp. Todo con colores PLANOS (nada de gradientes ni blend):
// es lo que hace que se vean bien en Gmail modo oscuro sin hacks.
//
// El envío usa deliver() (_mailer.ts): cascada Resend → SMTP. Ninguna función
// de acá tira: si un mail falla se loguea y se devuelve false, el flujo que lo
// disparó tiene que seguir andando igual.

import { deliver } from './_mailer.js';
import { botonWhatsApp } from './_whatsapp.js';

// El logo vive en el hosting del proyecto (mismo criterio que _payment-failed).
const ASSET_URL = 'https://entra-by-der.vercel.app';
const LOGO_DARK = `${ASSET_URL}/entra-logo-dark.png`;
// Links que ve el usuario: siempre el dominio real.
const PUBLIC_URL = process.env.PUBLIC_BASE_URL || 'https://www.entratickets.com';

const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const firstNameOf = (name?: string | null): string =>
  String(name || '').trim().split(/\s+/)[0] || '';

// ── Piezas compartidas de la cáscara de marca ────────────────────────────────

// OJO: `titulo` llega con las entidades YA escapadas (los callers escapan las
// partes dinámicas con esc()); acá no se re-escapa o quedaría &amp;oacute;.
function shellOpen(titulo: string, preheader: string): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<title>${titulo}</title></head>
<body bgcolor="#ECECEE" style="margin:0;padding:0;background-color:#ECECEE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#18181B;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#ECECEE" style="background-color:#ECECEE;padding:24px 12px;"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#FFFFFF" style="max-width:600px;width:100%;background-color:#FFFFFF;border-radius:22px;overflow:hidden;border:1px solid #E4E4E7;">

    <tr><td style="padding:26px 32px 22px 32px;border-bottom:3px solid #FF5C00;">
      <img src="${LOGO_DARK}" alt="ENTR&Aacute;" width="104" style="display:block;border:0;outline:none;height:auto;">
    </td></tr>`;
}

function shellClose(whatsappMensaje: string): string {
  return `
    <tr><td style="padding:16px 32px 30px 32px;text-align:center;">
      <p style="margin:0 0 16px 0;font-size:12px;color:#71717A;">&iquest;Alguna duda? Escribinos y lo resolvemos con vos:</p>
      ${botonWhatsApp(whatsappMensaje, 'Escribinos por WhatsApp')}
      <p style="margin:16px 0 0 0;font-size:12px;color:#71717A;">O respond&eacute; este mail:</p>
      <p style="margin:6px 0 0 0;"><a href="mailto:tuticket@entratickets.com" style="color:#EA580C;font-size:13px;font-weight:700;text-decoration:none;">tuticket@entratickets.com</a></p>
      <p style="margin:14px 0 0 0;font-size:10px;color:#A1A1AA;letter-spacing:0.5px;">entratickets.com &#183; Plataforma de ticketing digital</p>
    </td></tr>

  </table>
</td></tr></table>
</body></html>`;
}

function hero(badge: { texto: string; bg: string; color: string }, titulo: string, introHtml: string): string {
  return `
    <tr><td style="padding:32px 32px 6px 32px;text-align:center;">
      <div style="display:inline-block;background-color:${badge.bg};color:${badge.color};font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;padding:6px 16px;border-radius:999px;">${badge.texto}</div>
      <p style="margin:18px 0 0 0;font-size:26px;font-weight:900;color:#18181B;letter-spacing:-0.5px;line-height:1.1;text-transform:uppercase;">${titulo}</p>
      <p style="margin:14px 0 0 0;font-size:15px;color:#71717A;line-height:1.6;">${introHtml}</p>
    </td></tr>`;
}

function eventCard(opts: {
  etiqueta: string;
  titulo: string;
  lineas: Array<string | null | undefined>;
  bordeColor?: string;
  etiquetaColor?: string;
}): string {
  const lineas = opts.lineas
    .filter(Boolean)
    .map((l) => `<p style="margin:8px 0 0 0;font-size:13px;color:#52525B;">${l}</p>`)
    .join('');
  return `
    <tr><td style="padding:22px 32px 0 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#F7F7F8" style="background-color:#F7F7F8;border-radius:16px;border:1px solid #ECECEE;border-left:4px solid ${opts.bordeColor || '#FF5C00'};">
        <tr><td style="padding:20px 22px;">
          <p style="margin:0;font-size:10px;font-weight:800;color:${opts.etiquetaColor || '#EA580C'};letter-spacing:2px;text-transform:uppercase;">${esc(opts.etiqueta)}</p>
          <p style="margin:8px 0 0 0;font-size:20px;font-weight:900;color:#18181B;line-height:1.2;text-transform:uppercase;letter-spacing:-0.3px;">${esc(opts.titulo)}</p>
          ${lineas}
        </td></tr>
      </table>
    </td></tr>`;
}

function seccion(titulo: string, bullets: string[]): string {
  const items = bullets
    .map((b, i) => `<p style="margin:0 0 ${i === bullets.length - 1 ? '0' : '7px'} 0;font-size:13px;color:#71717A;line-height:1.5;">&#8226;&nbsp; ${b}</p>`)
    .join('');
  return `
    <tr><td style="padding:20px 32px 0 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#F7F7F8" style="background-color:#F7F7F8;border-radius:14px;border:1px solid #ECECEE;">
        <tr><td style="padding:18px 20px;">
          <p style="margin:0 0 10px 0;font-size:11px;font-weight:800;color:#52525B;letter-spacing:1.5px;text-transform:uppercase;">${titulo}</p>
          ${items}
        </td></tr>
      </table>
    </td></tr>`;
}

function botonPrimario(href: string, etiqueta: string): string {
  return `
    <tr><td style="padding:24px 32px 8px 32px;text-align:center;">
      <a href="${esc(href)}" style="display:inline-block;background-color:#FF5C00;color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;padding:14px 30px;border-radius:999px;">${esc(etiqueta)}</a>
    </td></tr>`;
}

// ════════════════════════════════════════════════════════════════════════════
// 1) EVENTO CANCELADO
// ════════════════════════════════════════════════════════════════════════════

export interface EventCancelledData {
  buyerName?: string | null;
  buyerEmail: string;
  eventTitle: string;
  eventDate?: string | null;
  eventVenue?: string | null;
  ticketCount?: number;
}

// Exportada para poder previsualizar el mail sin mandarlo (regla de Franco:
// ningún mail sale sin que él lo vea renderizado antes).
export function buildEventCancelledHTML(d: EventCancelledData): string {
  const nombre = firstNameOf(d.buyerName);
  const n = Math.max(1, Number(d.ticketCount) || 1);
  const entradas = n === 1 ? 'tu entrada' : `tus ${n} entradas`;

  return (
    shellOpen(`Se cancel&oacute; ${esc(d.eventTitle)}`, `El organizador canceló ${d.eventTitle}. Tu entrada queda sin efecto.`) +
    hero(
      { texto: 'Evento cancelado', bg: '#FEE2E2', color: '#DC2626' },
      'El evento fue cancelado',
      `${nombre ? esc(nombre) + ': ' : ''}el organizador cancel&oacute; <b style="color:#18181B;">${esc(d.eventTitle)}</b>. ${n === 1 ? 'Tu entrada queda' : 'Tus entradas quedan'} sin efecto y no ten&eacute;s que hacer nada.`,
    ) +
    eventCard({
      etiqueta: 'Evento cancelado',
      titulo: d.eventTitle,
      lineas: [
        d.eventDate ? `&#128197;&nbsp; ${esc(d.eventDate)}` : null,
        d.eventVenue ? `&#128205;&nbsp; ${esc(d.eventVenue)}` : null,
      ],
      bordeColor: '#DC2626',
      etiquetaColor: '#DC2626',
    }) +
    seccion('Qu&eacute; pasa ahora', [
      `El QR de ${entradas} queda sin efecto: no se puede usar.`,
      'Si pagaste tu entrada, escribinos por WhatsApp y gestionamos la devoluci&oacute;n con el organizador.',
      'Si el evento se reprograma, te avisamos por este mismo mail.',
    ]) +
    shellClose(`Hola, compré una entrada para ${d.eventTitle} y me llegó el aviso de cancelación.`)
  );
}

/** Manda el aviso de cancelación a UN comprador. Nunca tira. */
export async function sendEventCancelledEmail(d: EventCancelledData): Promise<boolean> {
  try {
    if (!d.buyerEmail) return false;
    const r = await deliver({
      to: d.buyerEmail,
      subject: `Se canceló ${d.eventTitle}`,
      html: buildEventCancelledHTML(d),
      attachments: [],
    });
    if (!r.ok) console.error('[event-mails] cancelación no salió:', r.error);
    return !!r.ok;
  } catch (e) {
    console.error('[event-mails] error mandando cancelación:', e instanceof Error ? e.message : String(e));
    return false;
  }
}
