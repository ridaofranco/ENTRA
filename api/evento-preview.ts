// Preview del evento para cuando se comparte el link (Open Graph / Twitter Card).
//
// ══ EL PROBLEMA ══
// ENTRÁ es una app de una sola página: el HTML que se sirve es siempre el mismo
// index.html, con los meta tags genéricos de la plataforma. Y los que arman la
// previsualización de un link (WhatsApp, Instagram, Facebook, Telegram, X) NO
// ejecutan JavaScript: leen el HTML crudo y se van.
//
// Resultado hasta hoy: un productor comparte "Fiesta X" por WhatsApp y aparece
// "ENTRÁ - Tu Ticketera" con el logo de la plataforma. En una ticketera eso es
// plata directa: el link compartido ES el canal de venta, y un link sin la foto y
// el nombre del evento no se toca.
//
// ══ LA SOLUCIÓN, Y POR QUÉ ASÍ ══
// Un rewrite en vercel.json manda a esta función SOLO a los bots que armaN
// previsualizaciones (por user-agent). Las personas siguen entrando a la app igual
// que siempre: misma velocidad, cero riesgo, cero invocaciones extra. El bot recibe
// un HTML mínimo con los meta del evento y un link visible por si un humano cae
// acá de casualidad.
//
// No se usa prerender de toda la app ni SSR: eso sería reescribir el proyecto para
// resolver un problema de meta tags.

import { getAdminDb } from './_lib/firebaseAdmin.js';

const SITE = 'https://www.entratickets.com';
const OG_FALLBACK = `${SITE}/og-image.png`;

const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Fecha legible en es-AR. Acepta string ISO, Timestamp de Firestore o Date. */
function fechaLegible(v: any): string {
  try {
    const d =
      v?.toDate?.() instanceof Date
        ? v.toDate()
        : typeof v === "string" || v instanceof Date
          ? new Date(v)
          : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(d);
  } catch {
    return '';
  }
}

/** URL absoluta para la imagen: los bots descartan las relativas. */
function imagenAbsoluta(img?: string | null): string {
  const v = String(img || '').trim();
  if (!v) return OG_FALLBACK;
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  return `${SITE}${v.startsWith('/') ? '' : '/'}${v}`;
}

function html(opts: {
  title: string;
  description: string;
  image: string;
  url: string;
}): string {
  const { title, description, image, url } = opts;
  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">

<meta property="og:type" content="website">
<meta property="og:site_name" content="ENTRÁ">
<meta property="og:url" content="${esc(url)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">

<meta property="twitter:card" content="summary_large_image">
<meta property="twitter:title" content="${esc(title)}">
<meta property="twitter:description" content="${esc(description)}">
<meta property="twitter:image" content="${esc(image)}">
</head>
<body style="margin:0;background:#0b0b0c;color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:48px 24px;">
    <p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#EA580C;margin:0 0 12px;">ENTRÁ</p>
    <h1 style="font-size:26px;line-height:1.2;margin:0 0 12px;">${esc(title)}</h1>
    <p style="color:#a1a1aa;line-height:1.6;margin:0 0 24px;">${esc(description)}</p>
    <a href="${esc(url)}" style="display:inline-block;background:#FF5C00;color:#fff;font-weight:700;padding:14px 26px;border-radius:999px;text-decoration:none;">Ver el evento y comprar</a>
  </div>
</body></html>`;
}

export default async function handler(req: any, res: any) {
  const id = String(req.query?.id ?? '').trim();
  const url = id ? `${SITE}/evento/${encodeURIComponent(id)}` : SITE;

  // Los bots cachean, y de paso el CDN de Vercel: 10 minutos alcanza para que un
  // link recién compartido muestre datos frescos sin pegarle a Firestore de más.
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');

  // Sin id o sin evento NO se falla: se devuelve la tarjeta genérica. Un bot que
  // recibe un 500 no muestra nada, y ahí el link queda peor que antes.
  const generico = () =>
    res.status(200).send(
      html({
        title: 'ENTRÁ · Acceso a experiencias en vivo',
        description: 'Comprá tus entradas, gestioná tus eventos y controlá el acceso desde el celular.',
        image: OG_FALLBACK,
        url,
      }),
    );

  if (!id) return generico();

  try {
    const snap = await getAdminDb().collection('events').doc(id).get();
    if (!snap.exists) return generico();
    const e: any = snap.data() || {};

    // Un evento borrado o despublicado no debería tener preview propia.
    if (e.deleted === true || e.status === 'deleted') return generico();

    const titulo = String(e.title || '').trim() || 'Evento en ENTRÁ';
    const cuando = fechaLegible(e.date);
    const donde = String(e.venue || '').trim();
    const partes = [cuando, donde].filter(Boolean).join(' · ');
    const desc =
      (partes ? `${partes}. ` : '') +
      (String(e.description || '').trim().slice(0, 140) || 'Comprá tus entradas por ENTRÁ.');

    return res.status(200).send(
      html({
        title: `${titulo} · ENTRÁ`,
        description: desc,
        image: imagenAbsoluta(e.image),
        url,
      }),
    );
  } catch (err) {
    console.error('[evento-preview] falló, devuelvo la genérica:', err instanceof Error ? err.message : String(err));
    return generico();
  }
}
