/**
 * Freno de abuso en memoria (ventana deslizante por identificador).
 * Portado de HITO vía PASE, que es el mismo archivo. Sin dependencias nuevas.
 *
 * QUÉ PROTEGE ACÁ: ENTRÁ es el único producto del ecosistema que cobra plata de
 * verdad, y era el único de los cuatro con pantallas públicas que había quedado
 * sin freno (LABURO, PASE y la web lo tienen desde el 25/7). Item 7 del plan único.
 *
 * EL RIESGO REAL NO ES QUE TIREN EL SITIO. Son tres cosas concretas:
 *   1. `create-payment` escribe una orden en Firestore y crea una preferencia en
 *      MercadoPago en CADA llamada. Un script deja miles de órdenes pending
 *      basura adentro del panel del productor y ensucia los números de venta.
 *   2. Esas llamadas pegan contra la API de MercadoPago con nuestro token. El que
 *      se come el rate limit de MP somos nosotros, y ahí deja de poder comprar
 *      gente real.
 *   3. Firestore free tiene cuota diaria de escrituras. Quemarla un viernes a la
 *      noche es el evento entero sin vender.
 *
 * LÍMITE HONESTO: en serverless el contador es por instancia, no global. Frena el
 * abuso desde una IP, que es el caso real, pero no algo distribuido. Para eso
 * haría falta Redis, que es plata y complejidad.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [k, b] of buckets) if (now > b.resetAt) buckets.delete(k);
}

export function rateLimit(identifier: string, limit: number, windowMs = 60_000): { ok: boolean; resetAt: number } {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(identifier);
  if (!b || now > b.resetAt) {
    buckets.set(identifier, { count: 1, resetAt: now + windowMs });
    return { ok: true, resetAt: now + windowMs };
  }
  b.count += 1;
  return { ok: b.count <= limit, resetAt: b.resetAt };
}

/** IP del cliente a partir de los headers del proxy de Vercel (best-effort). */
export function clientIp(req: any): string {
  const xff = req?.headers?.['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return String(req?.headers?.['x-real-ip'] || 'unknown');
}

/**
 * Aplica el freno sobre un handler estilo Vercel. Devuelve true si YA contestó
 * 429 (o sea: cortá el handler), false si hay que seguir.
 */
export function frenado(req: any, res: any, clave: string, limite: number, windowMs = 60_000): boolean {
  const r = rateLimit(`${clave}:${clientIp(req)}`, limite, windowMs);
  if (r.ok) return false;
  res.setHeader('Retry-After', String(Math.ceil((r.resetAt - Date.now()) / 1000)));
  res.status(429).json({ error: 'too_many_requests', message: 'Demasiados intentos. Probá de nuevo en un minuto.' });
  return true;
}
