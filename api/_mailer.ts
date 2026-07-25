import nodemailer from 'nodemailer';

// ─────────────────────────────────────────────────────────────────────────────
// ENVÍO EN CASCADA REAL: Resend primero, SMTP de respaldo.
//
// POR QUÉ: la entrada es lo único que el comprador recibe después de pagar, y no
// estaba llegando. El SMTP de hosting compartido devuelve 250 OK y el mail cae en
// spam o se pierde, así que desde afuera parecía que funcionaba. ENTRÁ era el
// único producto del ecosistema que cobra plata Y el único sin ninguna red de
// contención de envío.
//
// CASCADA DE VERDAD, no un switch: si Resend está configurado se intenta primero
// (API HTTP, ~300 ms, entregabilidad alta y devuelve el error real). Si Resend
// falla por cualquier motivo, se intenta el SMTP igual. Recién si los dos fallan
// se devuelve error. PASE tiene un `if resend else smtp` que parece cascada pero
// no lo es: cuando Resend rechaza, marca el envío como fallido y nunca prueba el
// SMTP. Acá no se repite ese error.
//
// LOS QR VAN INLINE EN LOS DOS CANALES: nodemailer con `cid`, y Resend con
// `content_id` (que es el equivalente en su API, ya probado en producción por
// PASE). El QR ES la entrada: no puede depender de que el cliente de correo
// muestre imágenes remotas.
// ─────────────────────────────────────────────────────────────────────────────

export type Attachment = {
  filename: string;
  content: Buffer;
  cid?: string;
  contentType?: string;
  contentDisposition?: 'attachment' | 'inline';
};

export type SendResult = { ok: boolean; channel?: 'resend' | 'smtp'; id?: string; error?: string };

export function resendReady(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

export function smtpReady(): boolean {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  return !!(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

async function sendViaResend(opts: {
  to: string; subject: string; html: string; attachments: Attachment[];
}): Promise<string | undefined> {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      // El PDF va como adjunto normal; los QR con content_id para que el
      // `cid:` del HTML los resuelva igual que por SMTP.
      attachments: opts.attachments.map((a) => ({
        filename: a.filename,
        content: a.content.toString('base64'),
        ...(a.cid ? { content_id: a.cid } : {}),
      })),
      ...(process.env.MAIL_REPLY_TO ? { reply_to: process.env.MAIL_REPLY_TO } : {}),
    }),
    // Resend es rápido: cortamos a los 15 s para no colgar el webhook de pago.
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`resend_${resp.status}: ${detail.slice(0, 300)}`);
  }
  const data = (await resp.json().catch(() => null)) as { id?: string } | null;
  return data?.id;
}

async function sendViaSmtp(opts: {
  to: string; subject: string; html: string; attachments: Attachment[];
}): Promise<string | undefined> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  const port = Number(SMTP_PORT) || 465;
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    // El SMTP de hosting compartido es lento: fallar rápido es mejor que colgar
    // la función hasta que Vercel la corte.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
  const info = await transporter.sendMail({
    from: { name: 'ENTRÁ Tickets', address: SMTP_USER as string },
    ...(process.env.MAIL_REPLY_TO ? { replyTo: process.env.MAIL_REPLY_TO } : {}),
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    attachments: opts.attachments,
  });
  return info.messageId;
}

export async function deliver(opts: {
  to: string; subject: string; html: string; attachments: Attachment[];
}): Promise<SendResult> {
  let resendError: string | undefined;

  if (resendReady()) {
    try {
      const id = await sendViaResend(opts);
      return { ok: true, channel: 'resend', id };
    } catch (e) {
      resendError = errText(e);
      console.error('[send-ticket-email] Resend falló, pruebo SMTP:', resendError);
    }
  }

  if (smtpReady()) {
    try {
      const id = await sendViaSmtp(opts);
      return { ok: true, channel: 'smtp', id };
    } catch (e) {
      const smtpError = errText(e);
      console.error('[send-ticket-email] SMTP falló:', smtpError);
      return {
        ok: false,
        error: resendError ? `smtp: ${smtpError} | resend: ${resendError}` : `smtp: ${smtpError}`,
      };
    }
  }

  return {
    ok: false,
    error: resendError ?? 'No hay ninguna vía de envío configurada (falta RESEND_API_KEY + RESEND_FROM, o el SMTP).',
  };
}

