// Sitemap de ENTRÁ.
//
// POR QUÉ ES UNA FUNCIÓN Y NO UN ARCHIVO ESTÁTICO: las páginas que de verdad
// interesan para Google son las de cada evento, y esas cambian todo el tiempo
// (aparecen, se venden, pasan). Un sitemap.xml a mano quedaría viejo el mismo día.
// Acá se arma en cada request, con los eventos publicados y a futuro.
//
// HOY VA A DEVOLVER SOLO LAS PÁGINAS FIJAS, y está bien: todavía no hay eventos
// cargados en la ticketera. Queda listo para el primero.
//
// QUÉ NO ENTRA A PROPÓSITO: checkout, login, dashboard, claim de entradas y los
// eventos ya pasados. Un sitemap es "esto quiero que se indexe", no "todas mis
// URLs": meter pantallas privadas o eventos viejos ensucia el índice y le hace
// perder tiempo a Google en páginas que no venden nada.

import { getAdminDb } from './_lib/firebaseAdmin.js';

const SITE = 'https://www.entratickets.com';

/** Páginas fijas, con su prioridad relativa. */
const FIJAS: Array<[string, string, string]> = [
  // [ruta, changefreq, priority]
  ['/', 'weekly', '1.0'],
  ['/eventos', 'daily', '0.9'],
  ['/productores', 'monthly', '0.8'],
  ['/ayuda', 'monthly', '0.5'],
  ['/contacto', 'monthly', '0.5'],
  // Blog: HTML estáticos en public/blog, servidos por el rewrite /blog/:slug -> .html.
  // Van a mano porque son pocos y no cambian solos; al sumar un post, agregarlo acá.
  ['/blog', 'weekly', '0.6'],
  ['/blog/como-elegir-ticketera-comisiones', 'monthly', '0.6'],
  ['/blog/poner-precio-entradas-tandas-preventa', 'monthly', '0.6'],
  ['/blog/datos-ventas-ticketera-productor', 'monthly', '0.6'],
  ['/blog/comprar-entradas-sin-estafas', 'monthly', '0.6'],
  ['/blog/no-me-llego-la-entrada-al-mail', 'monthly', '0.6'],
  ['/blog/evento-cancelado-reprogramado-transferir-entrada', 'monthly', '0.6'],
  ['/blog/entradas-truchas-duplicadas-puerta', 'monthly', '0.6'],
  ['/terminos', 'yearly', '0.2'],
  ['/privacidad', 'yearly', '0.2'],
];

const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function url(loc: string, changefreq: string, priority: string, lastmod?: string): string {
  return (
    `  <url>\n` +
    `    <loc>${esc(loc)}</loc>\n` +
    (lastmod ? `    <lastmod>${esc(lastmod)}</lastmod>\n` : '') +
    `    <changefreq>${changefreq}</changefreq>\n` +
    `    <priority>${priority}</priority>\n` +
    `  </url>\n`
  );
}

/** Fecha ISO a partir de string, Date o Timestamp de Firestore. */
function iso(v: any): string | undefined {
  try {
    const d =
      v?.toDate?.() instanceof Date ? v.toDate() : typeof v === 'string' || v instanceof Date ? new Date(v) : null;
    if (!d || Number.isNaN(d.getTime())) return undefined;
    return d.toISOString();
  } catch {
    return undefined;
  }
}

export default async function handler(_req: any, res: any) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const [ruta, freq, prio] of FIJAS) xml += url(`${SITE}${ruta}`, freq, prio);

  let eventos = 0;
  try {
    // Solo los publicados. El filtro de "ya pasó" se hace acá y no en la query
    // para no depender de un índice compuesto de Firestore ni del tipo exacto del
    // campo fecha (que puede ser Timestamp o string según cómo se cargó).
    const snap = await getAdminDb().collection('events').where('status', '==', 'published').limit(1000).get();
    const ahora = Date.now();

    snap.forEach((doc) => {
      const e: any = doc.data() || {};
      if (e.deleted === true) return;
      const fecha = iso(e.date);
      // Un evento que ya pasó no se indexa: la página queda viva para el que tenga
      // el link, pero no aporta nada al índice.
      if (fecha && new Date(fecha).getTime() < ahora - 24 * 60 * 60 * 1000) return;
      xml += url(`${SITE}/evento/${doc.id}`, 'daily', '0.9', iso(e.updatedAt) || fecha);
      eventos += 1;
    });
  } catch (err) {
    // Un sitemap corto es mucho mejor que un 500: si Google recibe un error, marca
    // el sitemap como roto y deja de pedirlo por un buen rato.
    console.error('[sitemap] no pude leer los eventos:', err instanceof Error ? err.message : String(err));
  }

  xml += '</urlset>\n';

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
  res.setHeader('X-Eventos-En-Sitemap', String(eventos));
  return res.status(200).send(xml);
}
