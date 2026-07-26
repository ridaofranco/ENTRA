/**
 * AVISO POR TELEGRAM CUANDO ALGO SE ROMPE.
 *
 * ══ EL PROBLEMA QUE RESUELVE ══
 * Ninguno de los productos avisa nada cuando falla. Todos los bugs de esta semana
 * se encontraron auditando el código a mano: las alertas de aforo de PASE llevaban
 * meses rotas, el cron de recordatorios de LABURO nunca había corrido, y la
 * entrada de ENTRÁ no llegaba. En los tres casos el sistema decía "todo bien".
 *
 * Esto no es un monitoreo completo: es que Franco se entere en el celular, en el
 * momento, cuando algo que importa se rompe. Que es el 90% del valor.
 *
 * ══ POR QUÉ TELEGRAM Y NO WHATSAPP ══
 * WhatsApp para mandar mensajes desde un sistema necesita la API de Meta: alta de
 * negocio, plantillas aprobadas y costo por mensaje. Telegram es gratis, sale en
 * dos minutos y llega al mismo celular. Si en algún momento hace falta WhatsApp,
 * este mismo archivo es el único lugar que habría que cambiar.
 *
 * ══ CÓMO SE PRENDE (2 minutos, lo hace Franco una sola vez) ══
 * 1. En Telegram, buscar `@BotFather` → /newbot → nombre "Alertas DER". Devuelve
 *    un token largo tipo 1234567890:AAG...
 * 2. Escribirle CUALQUIER cosa al bot nuevo (si no, no puede iniciar la charla).
 * 3. Abrir en el navegador: https://api.telegram.org/bot<TOKEN>/getUpdates
 *    y copiar el número de `"chat":{"id":...}`.
 * 4. Cargar en Vercel (en cada proyecto): TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID.
 * Sin esas dos variables esto NO hace nada: no rompe, no tira, no loguea de más.
 *
 * ══ REGLAS ══
 * · Nunca tira y nunca bloquea: 3 segundos de timeout y listo. Un aviso no puede
 *   hacer fallar un cobro.
 * · Anti-spam: el mismo problema no se repite antes de 10 minutos. Sin esto, un
 *   webhook que falla en loop manda 200 mensajes y Franco silencia el bot, que es
 *   peor que no tenerlo.
 */

const PRODUCTO = "ENTRA";

/**
 * ── Y TAMBIÉN POR MAIL (pedido de Franco, 26/7) ──
 * Telegram sirve para enterarse en el momento; el mail sirve para que QUEDE: se
 * puede buscar tres semanas después, reenviar y usar como registro. Va a
 * MAIL_ADMIN_TO, que acepta varias direcciones separadas por coma.
 * Los dos canales son independientes y los dos se esperan antes de devolver: si el
 * mail quedara sin await, en serverless la función se congela y no sale nunca.
 */
const VENTANA_REPETICION_MS = 10 * 60 * 1000;

const ultimoAviso = new Map<string, number>();

function telegramHabilitado(): boolean {
  return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

function habilitado(): boolean {
  return telegramHabilitado() || !!process.env.MAIL_ADMIN_TO;
}

/** El mismo aviso por mail. Nunca tira. */
async function mandarMail(opts: AlertaOpts, filas: string): Promise<boolean> {
  try {
    const to = (process.env.MAIL_ADMIN_TO || "").trim();
    if (!to) return false;
    const { deliver } = await import("./_mailer.js");
    const html =
      `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#0d0d0d;color:#e9e6e4;padding:24px">` +
      `<p style="margin:0 0 6px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${opts.plata ? "#ffcc00" : "#ff5c5c"}">${esc(PRODUCTO)} · algo se rompió</p>` +
      `<h1 style="margin:0 0 14px;font-size:20px;line-height:1.3">${esc(opts.titulo)}</h1>` +
      (filas ? `<p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#cfcbca">${filas.replace(/\n/g, "<br>")}</p>` : "") +
      (opts.detalle ? `<pre style="background:#000;border:1px solid #1a1a1a;padding:12px;font-size:12px;white-space:pre-wrap;color:#cfe8d4;margin:0">${esc(String(opts.detalle).slice(0, 1200))}</pre>` : "") +
      `</div>`;
    const r = await deliver({
      to,
      subject: `${opts.plata ? "💸" : "🔴"} ${PRODUCTO}: ${opts.titulo}`,
      html,
      attachments: [],
    });
    return !!r.ok;
  } catch (e) {
    console.error("[alerta] no se pudo avisar por mail:", e instanceof Error ? e.message : String(e));
    return false;
  }
}

/** Escapa lo mínimo para el modo HTML de Telegram. */
const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export interface AlertaOpts {
  /** Qué se rompió, en una línea y en criollo. */
  titulo: string;
  /** Detalle técnico: el error, el id, el mail. Lo que sirva para encontrarlo. */
  detalle?: string;
  /** Datos extra, uno por línea. */
  datos?: Record<string, string | number | null | undefined>;
  /**
   * Clave para el anti-repetición. Por default se usa el título: dos fallas del
   * mismo tipo no se avisan dos veces en 10 minutos.
   */
  clave?: string;
  /** true = es plata o alguien quedó sin lo que pagó. Cambia el ícono. */
  plata?: boolean;
}

/**
 * Manda el aviso. Devuelve true si salió (para poder loguearlo), false si estaba
 * apagado, repetido o falló. NUNCA tira.
 */
export async function alerta(opts: AlertaOpts): Promise<boolean> {
  try {
    if (!habilitado()) return false;

    const clave = opts.clave ?? opts.titulo;
    const ahora = Date.now();
    const previo = ultimoAviso.get(clave);
    if (previo && ahora - previo < VENTANA_REPETICION_MS) return false;
    ultimoAviso.set(clave, ahora);

    const filas = Object.entries(opts.datos ?? {})
      .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
      .map(([k, v]) => `· ${esc(k)}: <code>${esc(v)}</code>`)
      .join("\n");

    const texto =
      `${opts.plata ? "💸" : "🔴"} <b>${esc(PRODUCTO)}</b>\n` +
      `${esc(opts.titulo)}\n` +
      (filas ? `\n${filas}\n` : "") +
      (opts.detalle ? `\n<pre>${esc(String(opts.detalle).slice(0, 600))}</pre>` : "");

    const porMail = mandarMail(opts, filas);
    const porTelegram = (async (): Promise<boolean> => {
      if (!telegramHabilitado()) return false;
      try {
        const rr = await fetch(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: process.env.TELEGRAM_CHAT_ID,
              text: texto,
              parse_mode: "HTML",
              disable_web_page_preview: true,
            }),
            signal: AbortSignal.timeout(3000),
          },
        );
        if (!rr.ok) console.error("[alerta] Telegram respondió", rr.status);
        return rr.ok;
      } catch (e) {
        console.error("[alerta] Telegram falló:", e instanceof Error ? e.message : String(e));
        return false;
      }
    })();
    const [mailOk, tgOk] = await Promise.all([porMail, porTelegram]);
    return mailOk || tgOk;

  } catch (e) {
    // Si el aviso falla, se traga: el problema real ya está logueado por el caller.
    console.error("[alerta] no se pudo avisar:", e instanceof Error ? e.message : String(e));
    return false;
  }
}
