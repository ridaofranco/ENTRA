import nodemailer from 'nodemailer';

// ============================================================
// Vercel Serverless Function — Envío de mail de confirmación
// Se dispara desde el Checkout apenas se completa la compra.
// Envía desde tuticket@entratickets.com vía SMTP (nodemailer).
// El QR es real y escaneable (api.qrserver.com), igual que en la app.
// ============================================================

interface TicketItem {
  qrCode: string;
  type: string;
}

interface RequestBody {
  buyerName: string;
  buyerEmail: string;
  buyerDni?: string;
  eventTitle: string;
  eventDate?: string;
  eventVenue?: string;
  eventLocation?: string;
  orderId: string;
  total?: number;
  tickets: TicketItem[];
}

// QR real y escaneable — mismo servicio que usa la app en el checkout.
function qrImageUrl(value: string, size = 200): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(value)}`;
}

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildConfirmationHTML(data: RequestBody): string {
  const venueLine = [data.eventVenue, data.eventLocation].filter(Boolean).map(escapeHtml).join(' — ');
  const orderShort = (data.orderId || '').substring(0, 8).toUpperCase();

  const ticketCards = data.tickets
    .map(
      (t, i) => `
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#27272A;border-radius:12px;overflow:hidden;margin-bottom:16px;">
        <tr>
          <td style="padding:20px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;width:55%;">
                  <p style="margin:0;font-size:9px;font-weight:700;color:#52525B;letter-spacing:2px;">ENTRADA ${i + 1} DE ${data.tickets.length}</p>
                  <p style="margin:6px 0 14px 0;font-size:17px;font-weight:700;color:#F97316;">${escapeHtml(t.type)}</p>
                  <p style="margin:0;font-size:9px;font-weight:700;color:#52525B;letter-spacing:2px;">ASISTENTE</p>
                  <p style="margin:4px 0 10px 0;font-size:13px;color:#FAFAFA;">${escapeHtml(data.buyerName)}</p>
                  ${data.buyerDni ? `<p style="margin:0;font-size:9px;font-weight:700;color:#52525B;letter-spacing:2px;">DNI</p>
                  <p style="margin:4px 0 0 0;font-size:13px;color:#FAFAFA;">${escapeHtml(data.buyerDni)}</p>` : ''}
                </td>
                <td style="vertical-align:middle;text-align:center;width:45%;">
                  <div style="background-color:#FFFFFF;border-radius:12px;padding:10px;display:inline-block;">
                    <img src="${qrImageUrl(t.qrCode, 180)}" alt="QR" width="150" height="150" style="display:block;" />
                  </div>
                  <p style="margin:8px 0 0 0;font-size:9px;color:#52525B;font-family:monospace;word-break:break-all;">${escapeHtml(t.qrCode)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Tu entrada para ${escapeHtml(data.eventTitle)}</title></head>
<body style="margin:0;padding:0;background-color:#09090B;font-family:Arial,Helvetica,sans-serif;color:#FAFAFA;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#09090B;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background-color:#F97316;padding:24px 32px;border-radius:16px 16px 0 0;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td><span style="font-size:28px;font-weight:900;color:#FFFFFF;letter-spacing:-1px;">ENTR&Aacute;</span></td>
              <td align="right"><span style="font-size:12px;color:#FFFFFF;opacity:0.9;">Tu entrada digital<br/>entratickets.com</span></td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="background-color:#18181B;padding:32px 32px 16px 32px;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#FAFAFA;">&iexcl;Hola ${escapeHtml(data.buyerName)}!</p>
            <p style="margin:12px 0 0 0;font-size:15px;color:#A1A1AA;line-height:1.6;">
              Tu compra fue confirmada. Ac&aacute; ten&eacute;s ${data.tickets.length === 1 ? 'tu entrada' : `tus ${data.tickets.length} entradas`} para <strong style="color:#F97316;">${escapeHtml(data.eventTitle)}</strong>. Presentá el c&oacute;digo QR en la puerta del evento.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#18181B;padding:8px 32px 0 32px;">
            <p style="margin:0;font-size:10px;font-weight:700;color:#F97316;letter-spacing:2px;text-transform:uppercase;">EVENTO</p>
            <p style="margin:6px 0 0 0;font-size:18px;font-weight:900;color:#FAFAFA;">${escapeHtml(data.eventTitle)}</p>
            ${data.eventDate ? `<p style="margin:6px 0 0 0;font-size:13px;color:#A1A1AA;">${escapeHtml(data.eventDate)}</p>` : ''}
            ${venueLine ? `<p style="margin:4px 0 0 0;font-size:13px;color:#A1A1AA;">${venueLine}</p>` : ''}
          </td>
        </tr>
        <tr><td style="background-color:#18181B;padding:20px 32px 8px 32px;">${ticketCards}</td></tr>
        <tr>
          <td style="background-color:#18181B;padding:0 32px 24px 32px;">
            <p style="margin:0 0 12px 0;font-size:13px;font-weight:700;color:#A1A1AA;letter-spacing:1px;">ANTES DEL EVENTO</p>
            <p style="margin:0 0 6px 0;font-size:13px;color:#71717A;line-height:1.5;">&#x2022; Present&aacute; el QR desde tu celular o impreso.</p>
            <p style="margin:0 0 6px 0;font-size:13px;color:#71717A;line-height:1.5;">&#x2022; El QR es &uacute;nico. No lo compartas p&uacute;blicamente.</p>
            <p style="margin:0 0 6px 0;font-size:13px;color:#71717A;line-height:1.5;">&#x2022; Lleg&aacute; con tiempo para evitar demoras en el acceso.</p>
            ${orderShort ? `<p style="margin:16px 0 0 0;font-size:11px;color:#52525B;">Orden #${orderShort}</p>` : ''}
          </td>
        </tr>
        <tr>
          <td style="background-color:#27272A;padding:24px 32px;border-radius:0 0 16px 16px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#52525B;">Ante cualquier consulta, respond&eacute; a este email o escrib&iacute;nos a</p>
            <p style="margin:4px 0 0 0;"><a href="mailto:tuticket@entratickets.com" style="color:#F97316;font-size:13px;font-weight:700;text-decoration:none;">tuticket@entratickets.com</a></p>
            <p style="margin:16px 0 0 0;font-size:11px;color:#3F3F46;">ENTR&Aacute; &mdash; entratickets.com &mdash; Plataforma de ticketing digital</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.error('[send-ticket-email] Faltan variables SMTP en el entorno.');
    return res.status(500).json({ ok: false, error: 'SMTP no configurado en el servidor.' });
  }

  try {
    const body: RequestBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (!body?.buyerEmail || !body?.eventTitle || !Array.isArray(body?.tickets) || body.tickets.length === 0) {
      return res.status(400).json({ ok: false, error: 'Datos incompletos para el envío.' });
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 465,
      secure: (Number(SMTP_PORT) || 465) === 465, // SSL en 465
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: { name: 'ENTRÁ Tickets', address: SMTP_USER },
      to: body.buyerEmail,
      subject: `Tu entrada para ${body.eventTitle} — ENTRÁ`,
      html: buildConfirmationHTML(body),
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[send-ticket-email] Error enviando el mail:', error);
    return res.status(500).json({ ok: false, error: 'No se pudo enviar el email.' });
  }
}
