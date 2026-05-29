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
  const venueLine = [data.eventVenue, data.eventLocation].filter(Boolean).map(escapeHtml).join(' &middot; ');
  const orderShort = (data.orderId || '').substring(0, 8).toUpperCase();

  // Cada entrada se renderiza como un "stub" de ticket: datos a la izquierda,
  // perforación punteada al medio, y el QR sobre panel blanco a la derecha.
  const ticketCards = data.tickets
    .map(
      (t, i) => `
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:18px;border-radius:18px;overflow:hidden;border:1px solid #2A2A2E;">
        <tr>
          <!-- Lado info -->
          <td style="background-color:#1C1C1F;padding:22px 22px;vertical-align:top;width:56%;">
            <span style="display:inline-block;background-color:rgba(249,115,22,0.12);color:#F97316;font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:5px 12px;border-radius:999px;">${escapeHtml(t.type)}</span>
            <p style="margin:18px 0 0 0;font-size:9px;font-weight:800;color:#52525B;letter-spacing:2px;">ASISTENTE</p>
            <p style="margin:3px 0 0 0;font-size:15px;font-weight:700;color:#FAFAFA;">${escapeHtml(data.buyerName)}</p>
            ${data.buyerDni ? `<p style="margin:12px 0 0 0;font-size:9px;font-weight:800;color:#52525B;letter-spacing:2px;">DNI</p>
            <p style="margin:3px 0 0 0;font-size:14px;color:#D4D4D8;">${escapeHtml(data.buyerDni)}</p>` : ''}
            <p style="margin:14px 0 0 0;font-size:9px;font-weight:800;color:#52525B;letter-spacing:2px;">ENTRADA</p>
            <p style="margin:3px 0 0 0;font-size:13px;color:#D4D4D8;">${i + 1} de ${data.tickets.length}</p>
          </td>
          <!-- Perforación -->
          <td style="background-color:#1C1C1F;width:1px;padding:0;border-left:2px dashed #3F3F46;"></td>
          <!-- Lado QR -->
          <td style="background-color:#1C1C1F;padding:22px;vertical-align:middle;text-align:center;width:44%;">
            <div style="background-color:#FFFFFF;border-radius:14px;padding:12px;display:inline-block;">
              <img src="${qrImageUrl(t.qrCode, 190)}" alt="C&oacute;digo QR de la entrada" width="160" height="160" style="display:block;border-radius:4px;" />
            </div>
            <p style="margin:10px 0 0 0;font-size:8px;color:#52525B;font-family:'Courier New',monospace;word-break:break-all;line-height:1.4;">${escapeHtml(t.qrCode)}</p>
          </td>
        </tr>
      </table>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Tu entrada para ${escapeHtml(data.eventTitle)}</title></head>
<body style="margin:0;padding:0;background-color:#09090B;font-family:'Helvetica Neue',Arial,sans-serif;color:#FAFAFA;-webkit-font-smoothing:antialiased;">
  <!-- preheader oculto -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Tu entrada para ${escapeHtml(data.eventTitle)} ya est&aacute; lista. Presentá el QR en la puerta.</div>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#09090B;padding:24px 12px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;border-radius:24px;overflow:hidden;border:1px solid #1F1F23;">

        <!-- HEADER -->
        <tr>
          <td style="background:linear-gradient(135deg,#FF5C00 0%,#FF8C00 100%);background-color:#FF6B00;padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
              <td style="vertical-align:middle;"><span style="font-size:30px;font-weight:900;color:#FFFFFF;letter-spacing:-1px;">ENTR&Aacute;</span></td>
              <td align="right" style="vertical-align:middle;"><span style="font-size:11px;color:#FFFFFF;opacity:0.92;font-weight:600;letter-spacing:0.5px;">TU ENTRADA DIGITAL<br/>entratickets.com</span></td>
            </tr></table>
          </td>
        </tr>

        <!-- HERO -->
        <tr>
          <td style="background-color:#101013;padding:36px 32px 8px 32px;text-align:center;">
            <div style="display:inline-block;background-color:rgba(34,197,94,0.12);color:#4ADE80;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;padding:6px 16px;border-radius:999px;">&#10003; Compra confirmada</div>
            <p style="margin:20px 0 0 0;font-size:30px;font-weight:900;color:#FFFFFF;letter-spacing:-0.5px;line-height:1.1;">&iexcl;Est&aacute;s adentro, ${escapeHtml((data.buyerName || '').split(' ')[0] || '')}!</p>
            <p style="margin:12px 0 0 0;font-size:15px;color:#A1A1AA;line-height:1.6;">
              ${data.tickets.length === 1 ? 'Tu entrada ya est&aacute; lista' : `Tus ${data.tickets.length} entradas ya est&aacute;n listas`}. Mostrá el QR en la puerta y list&iacute;simo.
            </p>
          </td>
        </tr>

        <!-- EVENT CARD -->
        <tr>
          <td style="background-color:#101013;padding:24px 32px 8px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-radius:16px;border:1px solid #26262B;border-left:4px solid #F97316;">
              <tr><td style="padding:20px 22px;">
                <p style="margin:0;font-size:10px;font-weight:800;color:#F97316;letter-spacing:2px;text-transform:uppercase;">Evento</p>
                <p style="margin:8px 0 0 0;font-size:21px;font-weight:900;color:#FAFAFA;line-height:1.2;">${escapeHtml(data.eventTitle)}</p>
                ${data.eventDate ? `<p style="margin:10px 0 0 0;font-size:13px;color:#A1A1AA;">&#128197;&nbsp; ${escapeHtml(data.eventDate)}</p>` : ''}
                ${venueLine ? `<p style="margin:5px 0 0 0;font-size:13px;color:#A1A1AA;">&#128205;&nbsp; ${venueLine}</p>` : ''}
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- TICKETS -->
        <tr><td style="background-color:#101013;padding:20px 32px 8px 32px;">
          <p style="margin:0 0 14px 0;font-size:10px;font-weight:800;color:#52525B;letter-spacing:2px;text-transform:uppercase;">${data.tickets.length === 1 ? 'Tu entrada' : 'Tus entradas'}</p>
          ${ticketCards}
        </td></tr>

        <!-- INSTRUCCIONES -->
        <tr>
          <td style="background-color:#101013;padding:8px 32px 28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#161619;border-radius:14px;">
              <tr><td style="padding:18px 20px;">
                <p style="margin:0 0 10px 0;font-size:11px;font-weight:800;color:#A1A1AA;letter-spacing:1.5px;text-transform:uppercase;">Antes del evento</p>
                <p style="margin:0 0 7px 0;font-size:13px;color:#8B8B92;line-height:1.5;">&#8226;&nbsp; Present&aacute; el QR desde el celular o impreso.</p>
                <p style="margin:0 0 7px 0;font-size:13px;color:#8B8B92;line-height:1.5;">&#8226;&nbsp; El QR es &uacute;nico e intransferible. No lo compartas.</p>
                <p style="margin:0;font-size:13px;color:#8B8B92;line-height:1.5;">&#8226;&nbsp; Lleg&aacute; con tiempo para evitar demoras en el acceso.</p>
              </td></tr>
            </table>
            ${orderShort ? `<p style="margin:16px 0 0 0;font-size:11px;color:#52525B;text-align:center;font-family:'Courier New',monospace;">ORDEN #${orderShort}</p>` : ''}
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background-color:#161619;padding:26px 32px;text-align:center;border-top:1px solid #26262B;">
            <p style="margin:0;font-size:12px;color:#71717A;">&iquest;Algo no cierra? Respond&eacute; este mail o escrib&iacute;nos:</p>
            <p style="margin:6px 0 0 0;"><a href="mailto:tuticket@entratickets.com" style="color:#F97316;font-size:13px;font-weight:700;text-decoration:none;">tuticket@entratickets.com</a></p>
            <p style="margin:18px 0 0 0;font-size:18px;font-weight:900;color:#3F3F46;letter-spacing:-0.5px;">ENTR&Aacute;</p>
            <p style="margin:4px 0 0 0;font-size:10px;color:#3F3F46;letter-spacing:0.5px;">entratickets.com &mdash; Plataforma de ticketing digital</p>
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

    const info = await transporter.sendMail({
      from: { name: 'ENTRÁ Tickets', address: SMTP_USER },
      to: body.buyerEmail,
      subject: `Tu entrada para ${body.eventTitle} — ENTRÁ`,
      html: buildConfirmationHTML(body),
    });

    // Log del destinatario y resultado para poder auditar a quién salió cada mail.
    console.log(
      `[send-ticket-email] OK → to=${body.buyerEmail} | orden=${body.orderId} | tickets=${body.tickets.length} | messageId=${info.messageId} | accepted=${JSON.stringify(info.accepted)} | rejected=${JSON.stringify(info.rejected)}`
    );

    return res.status(200).json({ ok: true, to: body.buyerEmail, messageId: info.messageId });
  } catch (error) {
    console.error('[send-ticket-email] Error enviando el mail:', error);
    return res.status(500).json({ ok: false, error: 'No se pudo enviar el email.' });
  }
}
