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
const VENTANA_REPETICION_MS = 10 * 60 * 1000;

const ultimoAviso = new Map<string, number>();

function habilitado(): boolean {
  return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
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

    const r = await fetch(
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
        // Un aviso no puede demorar un cobro ni un envío de mail.
        signal: AbortSignal.timeout(3000),
      },
    );
    if (!r.ok) {
      console.error("[alerta] Telegram respondió", r.status);
      return false;
    }
    return true;
  } catch (e) {
    // Si el aviso falla, se traga: el problema real ya está logueado por el caller.
    console.error("[alerta] no se pudo avisar:", e instanceof Error ? e.message : String(e));
    return false;
  }
}
