import nodemailer from 'nodemailer';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { JOST_BLACK_B64, JOST_MEDIUM_B64 } from './_fonts';

// Registra la fuente Jost (la de la marca) dentro del documento PDF.
function registerJost(doc: jsPDF) {
  try {
    doc.addFileToVFS('Jost-Black.ttf', JOST_BLACK_B64);
    doc.addFont('Jost-Black.ttf', 'Jost', 'bold');
    doc.addFileToVFS('Jost-Medium.ttf', JOST_MEDIUM_B64);
    doc.addFont('Jost-Medium.ttf', 'Jost', 'normal');
    return true;
  } catch (e) {
    console.error('[send-ticket-email] No se pudo registrar Jost en el PDF:', e);
    return false;
  }
}

// ============================================================
// Vercel Serverless Function — Envío de mail de confirmación
// Mail: CLARO y premium (se ve consistente en Gmail + modo oscuro).
// PDF adjunto: OSCURO con la estética de marca (como en Apple Mail).
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

const BASE_URL = 'https://entra-by-der.vercel.app';
const LOGO_DARK = `${BASE_URL}/entra-logo-dark.png`;   // wordmark oscuro (para fondo claro = mail)
const LOGO_LIGHT = `${BASE_URL}/entra-logo.png`;        // wordmark blanco (para fondo oscuro = PDF)
// Stack lo más cercano a Jost que respetan los clientes de mail (Gmail incluido)
const FONT = "'Jost','Century Gothic','Futura','Trebuchet MS','Helvetica Neue',Arial,sans-serif";

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

// ============================================================
// EMAIL HTML — CLARO PREMIUM
// ============================================================
function buildConfirmationHTML(data: RequestBody, logoSrc: string): string {
  const venueLine = [data.eventVenue, data.eventLocation].filter(Boolean).map(escapeHtml).join(' &middot; ');
  const orderShort = (data.orderId || '').substring(0, 8).toUpperCase();
  const firstName = escapeHtml((data.buyerName || '').split(' ')[0] || '');

  const ticketCards = data.tickets
    .map(
      (t, i) => `
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#FFFFFF" style="background-color:#FFFFFF;margin-bottom:16px;border-radius:18px;overflow:hidden;border:1px solid #E4E4E7;">
        <tr>
          <td bgcolor="#FFFFFF" style="background-color:#FFFFFF;padding:22px;vertical-align:top;width:56%;">
            <span style="display:inline-block;background-color:#FFF1E8;color:#EA580C;font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:5px 12px;border-radius:999px;">${escapeHtml(t.type)}</span>
            <p style="margin:18px 0 0 0;font-size:9px;font-weight:800;color:#A1A1AA;letter-spacing:2px;">ASISTENTE</p>
            <p style="margin:3px 0 0 0;font-size:15px;font-weight:700;color:#18181B;">${escapeHtml(data.buyerName)}</p>
            ${data.buyerDni ? `<p style="margin:12px 0 0 0;font-size:9px;font-weight:800;color:#A1A1AA;letter-spacing:2px;">DNI</p>
            <p style="margin:3px 0 0 0;font-size:14px;color:#3F3F46;">${escapeHtml(data.buyerDni)}</p>` : ''}
            <p style="margin:14px 0 0 0;font-size:9px;font-weight:800;color:#A1A1AA;letter-spacing:2px;">ENTRADA</p>
            <p style="margin:3px 0 0 0;font-size:13px;color:#3F3F46;">${i + 1} de ${data.tickets.length}</p>
          </td>
          <td bgcolor="#FFFFFF" style="background-color:#FFFFFF;width:1px;padding:0;border-left:2px dashed #D4D4D8;"></td>
          <td bgcolor="#FFFFFF" style="background-color:#FFFFFF;padding:22px;vertical-align:middle;text-align:center;width:44%;">
            <div style="border:1px solid #E4E4E7;border-radius:14px;padding:10px;display:inline-block;">
              <img src="${qrImageUrl(t.qrCode, 190)}" alt="C&oacute;digo QR" width="158" height="158" style="display:block;" />
            </div>
            <p style="margin:9px 0 0 0;font-size:8px;color:#A1A1AA;font-family:'Courier New',monospace;word-break:break-all;line-height:1.4;">${escapeHtml(t.qrCode)}</p>
          </td>
        </tr>
      </table>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light">
  <title>Tu entrada para ${escapeHtml(data.eventTitle)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700;800;900&display=swap');
    :root { color-scheme: light only; supported-color-schemes: light; }
    body, table, td, p, span, a, div { font-family: ${FONT}; }
  </style>
</head>
<body bgcolor="#ECECEE" style="margin:0;padding:0;background-color:#ECECEE;font-family:${FONT};color:#18181B;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Tu entrada para ${escapeHtml(data.eventTitle)} ya est&aacute; lista. Mostr&aacute; el QR en la puerta.</div>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#ECECEE" style="background-color:#ECECEE;padding:24px 12px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#FFFFFF" style="max-width:600px;width:100%;background-color:#FFFFFF;border-radius:22px;overflow:hidden;border:1px solid #E4E4E7;">

        <!-- HEADER (logo de marca, fondo claro, acento naranja) -->
        <tr>
          <td bgcolor="#FFFFFF" style="background-color:#FFFFFF;padding:26px 32px 22px 32px;border-bottom:3px solid #FF5C00;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
              <td style="vertical-align:middle;"><img src="${logoSrc}" width="108" height="36" alt="ENTR&Aacute;" style="display:block;border:0;height:36px;width:auto;" /></td>
              <td align="right" style="vertical-align:middle;"><span style="font-size:10px;color:#A1A1AA;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Tu entrada digital<br/>entratickets.com</span></td>
            </tr></table>
          </td>
        </tr>

        <!-- HERO -->
        <tr>
          <td bgcolor="#FFFFFF" style="background-color:#FFFFFF;padding:34px 32px 6px 32px;text-align:center;">
            <div style="display:inline-block;background-color:#E7F8EE;color:#16A34A;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;padding:6px 16px;border-radius:999px;">&#10003; Compra confirmada</div>
            <p style="margin:20px 0 0 0;font-family:${FONT};font-size:30px;font-weight:900;color:#18181B;letter-spacing:-0.5px;line-height:1.08;text-transform:uppercase;">&iexcl;Est&aacute;s adentro${firstName ? ', ' + firstName : ''}!</p>
            <p style="margin:12px 0 0 0;font-size:15px;color:#71717A;line-height:1.6;">
              ${data.tickets.length === 1 ? 'Tu entrada ya est&aacute; lista' : `Tus ${data.tickets.length} entradas ya est&aacute;n listas`}. Mostr&aacute; el QR en la puerta &mdash; tambi&eacute;n te adjuntamos el ticket en PDF.
            </p>
          </td>
        </tr>

        <!-- EVENT CARD -->
        <tr>
          <td bgcolor="#FFFFFF" style="background-color:#FFFFFF;padding:24px 32px 6px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#F7F7F8" style="background-color:#F7F7F8;border-radius:16px;border:1px solid #ECECEE;border-left:4px solid #FF5C00;">
              <tr><td style="padding:20px 22px;">
                <p style="margin:0;font-size:10px;font-weight:800;color:#EA580C;letter-spacing:2px;text-transform:uppercase;">Evento</p>
                <p style="margin:8px 0 0 0;font-family:${FONT};font-size:22px;font-weight:900;color:#18181B;line-height:1.2;text-transform:uppercase;letter-spacing:-0.3px;">${escapeHtml(data.eventTitle)}</p>
                ${data.eventDate ? `<p style="margin:10px 0 0 0;font-size:13px;color:#52525B;">&#128197;&nbsp; ${escapeHtml(data.eventDate)}</p>` : ''}
                ${venueLine ? `<p style="margin:5px 0 0 0;font-size:13px;color:#52525B;">&#128205;&nbsp; ${venueLine}</p>` : ''}
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- TICKETS -->
        <tr><td bgcolor="#FFFFFF" style="background-color:#FFFFFF;padding:20px 32px 6px 32px;">
          <p style="margin:0 0 14px 0;font-size:10px;font-weight:800;color:#A1A1AA;letter-spacing:2px;text-transform:uppercase;">${data.tickets.length === 1 ? 'Tu entrada' : 'Tus entradas'}</p>
          ${ticketCards}
        </td></tr>

        <!-- INSTRUCCIONES -->
        <tr>
          <td bgcolor="#FFFFFF" style="background-color:#FFFFFF;padding:6px 32px 28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#F7F7F8" style="background-color:#F7F7F8;border-radius:14px;border:1px solid #ECECEE;">
              <tr><td style="padding:18px 20px;">
                <p style="margin:0 0 10px 0;font-size:11px;font-weight:800;color:#52525B;letter-spacing:1.5px;text-transform:uppercase;">Antes del evento</p>
                <p style="margin:0 0 7px 0;font-size:13px;color:#71717A;line-height:1.5;">&#8226;&nbsp; Present&aacute; el QR desde el celular o el PDF impreso.</p>
                <p style="margin:0 0 7px 0;font-size:13px;color:#71717A;line-height:1.5;">&#8226;&nbsp; El QR es &uacute;nico e intransferible. No lo compartas.</p>
                <p style="margin:0;font-size:13px;color:#71717A;line-height:1.5;">&#8226;&nbsp; Lleg&aacute; con tiempo para evitar demoras en el acceso.</p>
              </td></tr>
            </table>
            ${orderShort ? `<p style="margin:16px 0 0 0;font-size:11px;color:#A1A1AA;text-align:center;font-family:'Courier New',monospace;">ORDEN #${orderShort}</p>` : ''}
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td bgcolor="#F7F7F8" style="background-color:#F7F7F8;padding:26px 32px;text-align:center;border-top:1px solid #ECECEE;">
            <p style="margin:0;font-size:12px;color:#71717A;">&iquest;Algo no cierra? Respond&eacute; este mail o escrib&iacute;nos:</p>
            <p style="margin:6px 0 0 0;"><a href="mailto:tuticket@entratickets.com" style="color:#EA580C;font-size:13px;font-weight:700;text-decoration:none;">tuticket@entratickets.com</a></p>
            <img src="${logoSrc}" width="84" height="28" alt="ENTR&Aacute;" style="display:block;margin:18px auto 0 auto;border:0;height:28px;width:auto;opacity:0.9;" />
            <p style="margin:8px 0 0 0;font-size:10px;color:#A1A1AA;letter-spacing:0.5px;">entratickets.com &mdash; Plataforma de ticketing digital</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ============================================================
// PDF — OSCURO, ESTÉTICA DE MARCA (como Apple Mail)
// ============================================================
async function fetchPngDataUrl(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    return 'data:image/png;base64,' + buf.toString('base64');
  } catch {
    return null;
  }
}

export async function generateTicketsPDF(data: RequestBody): Promise<Buffer> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();   // ~595
  const H = doc.internal.pageSize.getHeight();  // ~842
  const M = 44;

  const hasJost = registerJost(doc);
  const FF = hasJost ? 'Jost' : 'helvetica'; // tipografía de la marca

  const logo = await fetchPngDataUrl(LOGO_LIGHT);

  for (let i = 0; i < data.tickets.length; i++) {
    if (i > 0) doc.addPage();
    const t = data.tickets[i];

    // Fondo oscuro
    doc.setFillColor(16, 16, 19); // #101013
    doc.rect(0, 0, W, H, 'F');

    // Header: logo + acento naranja
    if (logo) {
      doc.addImage(logo, 'PNG', M, 44, 122, 41); // ratio ~2.97
    } else {
      doc.setTextColor(255, 255, 255); doc.setFont(FF, 'bold'); doc.setFontSize(26);
      doc.text('ENTRA', M, 74);
    }
    doc.setDrawColor(255, 92, 0); doc.setLineWidth(2); doc.line(M, 102, W - M, 102);

    // Etiqueta
    doc.setTextColor(255, 92, 0); doc.setFont(FF, 'bold'); doc.setFontSize(9);
    doc.text('TU ENTRADA', M, 132);

    // Título del evento
    doc.setTextColor(250, 250, 250); doc.setFont(FF, 'bold'); doc.setFontSize(22);
    const titleLines = doc.splitTextToSize((data.eventTitle || '').toUpperCase(), W - M * 2);
    doc.text(titleLines.slice(0, 2), M, 158);
    let y = 158 + Math.min(titleLines.length, 2) * 24 + 6;

    // Fecha / lugar
    doc.setFont(FF, 'normal'); doc.setFontSize(12); doc.setTextColor(161, 161, 170);
    if (data.eventDate) { doc.text(data.eventDate, M, y); y += 18; }
    const venue = [data.eventVenue, data.eventLocation].filter(Boolean).join('  ·  ');
    if (venue) { doc.text(venue, M, y); y += 18; }

    // Tipo de entrada (pill)
    y += 10;
    doc.setFillColor(40, 22, 8); doc.roundedRect(M, y - 13, 70 + (t.type.length * 7), 22, 11, 11, 'F');
    doc.setTextColor(255, 140, 60); doc.setFont(FF, 'bold'); doc.setFontSize(11);
    doc.text((t.type || '').toUpperCase(), M + 14, y + 2);
    y += 36;

    // Panel blanco con QR (centrado)
    const qrDataUrl = await QRCode.toDataURL(t.qrCode, { width: 480, margin: 1, color: { dark: '#0C0C0E', light: '#FFFFFF' } });
    const panel = 256;
    const px = (W - panel) / 2;
    const py = y + 6;
    doc.setFillColor(255, 255, 255); doc.roundedRect(px, py, panel, panel, 18, 18, 'F');
    const qrSize = 212;
    doc.addImage(qrDataUrl, 'PNG', px + (panel - qrSize) / 2, py + (panel - qrSize) / 2, qrSize, qrSize);

    // Código bajo el QR
    doc.setTextColor(113, 113, 122); doc.setFont('courier', 'normal'); doc.setFontSize(8);
    doc.text(t.qrCode, W / 2, py + panel + 18, { align: 'center' });

    // Asistente / DNI
    let yb = py + panel + 48;
    doc.setFont(FF, 'bold'); doc.setFontSize(9); doc.setTextColor(113, 113, 122);
    doc.text('ASISTENTE', M, yb);
    doc.setFont(FF, 'bold'); doc.setFontSize(15); doc.setTextColor(250, 250, 250);
    doc.text(data.buyerName || '—', M, yb + 18);
    if (data.buyerDni) {
      doc.setFont(FF, 'bold'); doc.setFontSize(9); doc.setTextColor(113, 113, 122);
      doc.text('DNI', W - M, yb, { align: 'right' });
      doc.setFont(FF, 'normal'); doc.setFontSize(14); doc.setTextColor(228, 228, 231);
      doc.text(String(data.buyerDni), W - M, yb + 18, { align: 'right' });
    }
    doc.setFont(FF, 'normal'); doc.setFontSize(10); doc.setTextColor(113, 113, 122);
    doc.text(`Entrada ${i + 1} de ${data.tickets.length}`, M, yb + 40);

    // Footer
    doc.setDrawColor(38, 38, 43); doc.setLineWidth(1); doc.line(M, H - 70, W - M, H - 70);
    doc.setTextColor(120, 120, 128); doc.setFont(FF, 'normal'); doc.setFontSize(9);
    doc.text('ENTRA  —  entratickets.com  —  Plataforma de ticketing digital', W / 2, H - 48, { align: 'center' });
    if (data.orderId) {
      doc.setFont('courier', 'normal'); doc.setFontSize(8); doc.setTextColor(82, 82, 91);
      doc.text(`ORDEN #${data.orderId.substring(0, 8).toUpperCase()}`, W / 2, H - 32, { align: 'center' });
    }
  }

  return Buffer.from(doc.output('arraybuffer'));
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
      secure: (Number(SMTP_PORT) || 465) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    const attachments: any[] = [];

    // Logo embebido inline (CID) para que cargue al instante en el mail
    // (sin esperar a traerlo de internet). Si falla, usamos la URL remota.
    let logoSrc = LOGO_DARK;
    const logoData = await fetchPngDataUrl(LOGO_DARK);
    if (logoData) {
      attachments.push({
        filename: 'entra-logo.png',
        content: Buffer.from(logoData.split(',')[1], 'base64'),
        contentType: 'image/png',
        cid: 'entralogo',
        contentDisposition: 'inline',
      });
      logoSrc = 'cid:entralogo';
    }

    // PDF adjunto (oscuro, de marca). Si falla, igual mandamos el mail.
    try {
      const pdf = await generateTicketsPDF(body);
      attachments.push({
        filename: `ENTRA-entradas-${(body.orderId || '').substring(0, 8)}.pdf`,
        content: pdf,
        contentType: 'application/pdf',
        contentDisposition: 'attachment',
      });
    } catch (pdfErr) {
      console.error('[send-ticket-email] No se pudo generar el PDF:', pdfErr);
    }

    const hasPdf = attachments.some((a) => a.contentType === 'application/pdf');

    const info = await transporter.sendMail({
      from: { name: 'ENTRÁ Tickets', address: SMTP_USER },
      to: body.buyerEmail,
      subject: `Tu entrada para ${body.eventTitle} — ENTRÁ`,
      html: buildConfirmationHTML(body, logoSrc),
      attachments,
    });

    console.log(
      `[send-ticket-email] OK → to=${body.buyerEmail} | orden=${body.orderId} | tickets=${body.tickets.length} | pdf=${hasPdf} | messageId=${info.messageId}`
    );

    return res.status(200).json({ ok: true, to: body.buyerEmail, messageId: info.messageId, pdf: hasPdf });
  } catch (error) {
    console.error('[send-ticket-email] Error enviando el mail:', error);
    return res.status(500).json({ ok: false, error: 'No se pudo enviar el email.' });
  }
}
