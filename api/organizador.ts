// /api/organizador — los avisos del circuito de alta y aprobación de eventos.
//
// ══ POR QUÉ EXISTE ══
// Hasta acá, para vender entradas con ENTRÁ había que escribir por WhatsApp y
// esperar a que alguien del equipo activara la cuenta a mano. Eso se cambió por
// un alta de un clic, pero abrir la puerta no es abrir la mano: el evento sigue
// naciendo en `pending` (lo obliga la regla de Firestore) y no se ve ni se vende
// hasta que ENTRÁ lo aprueba.
//
// Ese circuito necesita tres avisos, y son los tres que maneja este archivo:
//   welcome          → al productor: tu cuenta está activa, así se carga un evento
//   event-submitted  → a ENTRÁ: alguien cargó un evento, acá está TODO, aprobalo
//   event-approved   → al productor: tu evento ya está a la venta
//
// ══ POR QUÉ UN SOLO ENDPOINT PARA LOS TRES ══
// El proyecto está en el plan Hobby de Vercel, con un tope de 12 funciones
// serverless. Con este son 11. Tres endpoints separados habrían quedado a uno
// del tope, y el próximo mail que haga falta no entraría.
//
// ══ QUÉ NO HACE ══
// No decide nada. No cambia el rol, no aprueba ni publica: eso pasa en el
// cliente contra Firestore, con las reglas de siempre. Acá solo se avisa. Por
// eso ningún fallo de este endpoint puede romper una activación ni una
// aprobación: quien lo llama lo hace sin await y sin mirar la respuesta.

import { alerta } from './_alerta.js';
import { deliver } from './_mailer.js';
import { sendWelcomeProducerEmail, sendEventApprovedEmail } from './_event-mails.js';
import { frenado } from './_rate-limit.js';

const PUBLIC_URL = process.env.PUBLIC_BASE_URL || 'https://www.entratickets.com';

// Casilla de respaldo: la que ya está publicada en el pie de todos los mails de
// ENTRÁ, así que existe y alguien la lee.
const CASILLA_RESPALDO = process.env.ADMIN_FALLBACK_EMAIL || 'tuticket@entratickets.com';

/**
 * Aviso de evento nuevo, con red.
 *
 * `alerta()` manda por Telegram y por mail, pero devuelve false sin hacer nada
 * si NINGUNO de los dos está configurado (hoy Telegram está mudo en los cuatro
 * productos, y `MAIL_ADMIN_TO` puede no estar cargada en este proyecto). Ese
 * silencio es inaceptable acá: todo el circuito nuevo depende de que este aviso
 * llegue. Si el productor carga su evento y nadie se entera, se queda esperando
 * para siempre una aprobación que nadie sabe que tiene que dar, y termina
 * escribiendo por WhatsApp, que es justo lo que se quiso sacar del medio.
 *
 * Entonces: si el canal de alertas no salió, se manda un mail común a la casilla
 * publicada. Feo, pero llega.
 */
async function avisarConRed(opts: {
  titulo: string; detalle: string; datos: Record<string, string>; clave: string;
}): Promise<void> {
  const salio = await alerta(opts);
  if (salio) return;

  const filas = Object.entries(opts.datos)
    .map(([k, v]) => `<tr><td style="padding:4px 10px 4px 0;color:#71717A;font-size:13px;">${k.replace(/_/g, ' ')}</td><td style="padding:4px 0;font-size:13px;color:#18181B;"><b>${v}</b></td></tr>`)
    .join('');

  await deliver({
    to: CASILLA_RESPALDO,
    subject: opts.titulo,
    html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#18181B;">
      <p style="font-size:15px;">${opts.detalle}</p>
      <table cellpadding="0" cellspacing="0">${filas}</table>
      <p style="font-size:12px;color:#A1A1AA;margin-top:18px;">Este aviso salió por la vía de respaldo porque no hay canal de alertas configurado (falta MAIL_ADMIN_TO, o el bot de Telegram).</p>
    </div>`,
    attachments: [],
  }).catch(() => {});
}

/** Recorta y limpia texto que viene del navegador antes de ponerlo en un mail. */
function limpio(v: unknown, max = 200): string {
  return String(v ?? '').trim().replace(/[<>]/g, '').slice(0, max);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  // Cada llamada manda al menos un mail. Sin freno, esto sirve para bombardear
  // una casilla o para quemarnos la cuota del día.
  if (frenado(req, res, 'organizador', 10, 60_000)) return;

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const action = limpio(body.action, 40);

  try {
    // ── 1) El productor activó su cuenta ─────────────────────────────────────
    if (action === 'welcome') {
      const email = limpio(body.email, 160).toLowerCase();
      if (!email.includes('@')) return res.status(200).json({ ok: true });
      await sendWelcomeProducerEmail({ email, nombre: limpio(body.nombre, 80) });
      // A ENTRÁ también: saber que hay un productor nuevo es información
      // comercial, no ruido. Es un lead que se dio de alta solo.
      await alerta({
        titulo: 'Productor nuevo en ENTRÁ',
        detalle: 'Alguien activó su cuenta de productor. Todavía no cargó ningún evento.',
        datos: { Email: email, Nombre: limpio(body.nombre, 80) || 'sin nombre' },
        clave: `productor-nuevo:${email}`,
      });
      return res.status(200).json({ ok: true });
    }

    // ── 2) Cargaron un evento y espera aprobación ────────────────────────────
    // Este es el aviso que reemplaza al WhatsApp: tiene que traer TODO lo que
    // Franco necesita para decidir sin abrir otra pantalla.
    if (action === 'event-submitted') {
      const eventId = limpio(body.eventId, 60);
      const titulo = limpio(body.eventTitle, 140) || 'Evento sin título';
      const entradas: string = Array.isArray(body.tickets)
        ? body.tickets
            .slice(0, 12)
            .map((t: any) => {
              const precio = Number(t?.price) || 0;
              const cant = Number(t?.available) || 0;
              const nombre = limpio(t?.type, 60);
              return `${nombre}: ${precio === 0 ? 'gratis' : `$${precio.toLocaleString('es-AR')}`} x ${cant}`;
            })
            .join(' | ')
        : '';

      await avisarConRed({
        titulo: `Evento nuevo para aprobar: ${titulo}`,
        detalle:
          'Un productor cargó un evento y está esperando aprobación. NO se ve en la cartelera ni se puede comprar hasta que lo publiques.',
        datos: {
          Evento: titulo,
          Fecha: limpio(body.eventDate, 80) || 'sin fecha',
          Lugar: [limpio(body.venue, 100), limpio(body.location, 100)].filter(Boolean).join(', ') || 'sin lugar',
          Entradas: entradas || 'sin entradas cargadas',
          Recaudación_máxima: limpio(body.potencial, 40) || 'sin datos',
          Productor: limpio(body.organizerName, 80) || 'sin nombre',
          Email_productor: limpio(body.organizerEmail, 160),
          Cobra_a_su_MercadoPago: body.mpConectado ? 'sí, split activo' : 'no, cobra ENTRÁ',
          Aprobar_en: `${PUBLIC_URL}/admin/dashboard`,
          Ver_evento: eventId ? `${PUBLIC_URL}/evento/${eventId}` : 'sin id',
        },
        // Sin anti-repetición cruzada entre eventos: cada evento es un aviso
        // distinto y perder uno significa que el productor espera para siempre.
        clave: `evento-nuevo:${eventId}`,
      });
      return res.status(200).json({ ok: true });
    }

    // ── 3) ENTRÁ aprobó el evento ────────────────────────────────────────────
    if (action === 'event-approved') {
      const email = limpio(body.organizerEmail, 160).toLowerCase();
      if (!email.includes('@')) return res.status(200).json({ ok: true });
      const eventId = limpio(body.eventId, 60);
      await sendEventApprovedEmail({
        email,
        nombre: limpio(body.organizerName, 80),
        eventTitle: limpio(body.eventTitle, 140) || 'Tu evento',
        eventDate: limpio(body.eventDate, 80),
        eventVenue: limpio(body.venue, 140),
        eventUrl: eventId ? `${PUBLIC_URL}/evento/${eventId}` : PUBLIC_URL,
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'accion_desconocida' });
  } catch (e) {
    console.error('[organizador]', e);
    // Se devuelve 200 igual: el que llama ya hizo lo suyo (activó la cuenta,
    // creó el evento, lo aprobó) y un aviso que no salió no puede hacer que la
    // pantalla le diga al usuario que algo falló.
    return res.status(200).json({ ok: false });
  }
}
