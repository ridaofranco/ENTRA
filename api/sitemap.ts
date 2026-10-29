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
  ['/blog/promocionar-evento-medir-ventas', 'monthly', '0.6'],
  ['/blog/organizar-primer-evento-checklist', 'monthly', '0.6'],
  ['/blog/control-de-acceso-dia-del-evento', 'monthly', '0.6'],
  ['/blog/para-que-sirve-el-qr-de-tu-entrada', 'monthly', '0.6'],
  ['/blog/me-olvide-el-celular-entrar-al-evento', 'monthly', '0.6'],
  ['/blog/facturar-venta-de-entradas-monotributista', 'monthly', '0.6'],
  ['/blog/cortesias-invitaciones-evento-cuantas-dar', 'monthly', '0.6'],
  ['/blog/noche-de-open-mic-o-karaoke-entradas', 'monthly', '0.6'],
  ['/blog/cuanta-gente-poner-en-la-puerta-de-un-evento', 'monthly', '0.6'],
  ['/blog/entradas-agotadas-lista-de-espera', 'monthly', '0.6'],
  ['/blog/muestra-de-fin-de-ano-escuela-de-danza', 'monthly', '0.6'],
  ['/blog/fiesta-de-fin-de-ano-de-empresa-entradas-o-lista', 'monthly', '0.6'],
  ['/blog/entrada-con-consumicion-combo', 'monthly', '0.6'],
  ['/blog/festival-con-varias-bandas-repartir-recaudacion', 'monthly', '0.6'],
  ['/blog/jornada-o-congreso-con-inscripcion-paga', 'monthly', '0.6'],
  ['/blog/fiesta-de-egresados-vender-entradas', 'monthly', '0.6'],
  ['/blog/vender-entradas-por-instagram-y-whatsapp', 'monthly', '0.6'],
  ['/blog/torneo-gamer-evento-de-videojuegos-entradas', 'monthly', '0.6'],
  ['/blog/degustacion-de-vinos-o-cerveza-con-entrada', 'monthly', '0.6'],
  ['/blog/ciclo-mensual-de-musica-vender-entradas', 'monthly', '0.6'],
  ['/blog/pena-folclorica-vender-entradas', 'monthly', '0.6'],
  ['/blog/after-office-vender-entradas', 'monthly', '0.6'],
  ['/blog/eventos-de-verano-en-la-costa-vender-entradas', 'monthly', '0.6'],
  ['/blog/show-infantil-entrada-de-chicos-y-adultos', 'monthly', '0.6'],
  ['/blog/fiesta-de-ano-nuevo-vender-entradas', 'monthly', '0.6'],
  ['/blog/evento-en-una-ciudad-chica-del-interior', 'monthly', '0.6'],
  ['/blog/cena-show-entrada-con-o-sin-cena', 'monthly', '0.6'],
  ['/blog/descripcion-del-evento-que-vende', 'monthly', '0.6'],
  ['/blog/cuando-abrir-la-venta-de-entradas', 'monthly', '0.6'],
  ['/blog/fiesta-tematica-como-venderla', 'monthly', '0.6'],
  ['/blog/base-de-compradores-proxima-fecha', 'monthly', '0.6'],
  ['/blog/feria-o-mercado-con-entrada', 'monthly', '0.6'],
  ['/blog/vender-entradas-milonga-clase-de-baile', 'monthly', '0.6'],
  ['/blog/primera-fecha-de-tu-banda-cuantas-entradas', 'monthly', '0.6'],
  ['/blog/evento-solidario-beneficio-vender-entradas', 'monthly', '0.6'],
  ['/blog/evento-al-aire-libre-lluvia-plan-b', 'monthly', '0.6'],
  ['/blog/vender-entradas-recital-en-un-bar', 'monthly', '0.6'],
  ['/blog/sadaic-musica-en-un-evento', 'monthly', '0.6'],
  ['/blog/cuantas-entradas-vender-para-no-perder-plata', 'monthly', '0.6'],
  ['/blog/permiso-para-hacer-un-evento-en-caba', 'monthly', '0.6'],
  ['/blog/capacidad-habilitada-cuantas-entradas-vender', 'monthly', '0.6'],
  ['/blog/abono-o-entrada-por-dia-festival', 'monthly', '0.6'],
  ['/blog/inscripcion-taller-con-cupo', 'monthly', '0.6'],
  ['/blog/vender-entradas-teatro-independiente', 'monthly', '0.6'],
  ['/blog/por-que-la-ticketera-pide-dni', 'monthly', '0.6'],
  ['/blog/vender-entradas-en-la-puerta', 'monthly', '0.6'],
  ['/blog/codigos-de-descuento-para-un-evento', 'monthly', '0.6'],
  ['/blog/control-de-acceso-sin-internet', 'monthly', '0.6'],
  ['/blog/devolver-entrada-comprada-online', 'monthly', '0.6'],
  ['/blog/evento-gratis-reservan-y-no-vienen', 'monthly', '0.6'],
  ['/blog/entrada-original-o-falsa-reventa', 'monthly', '0.6'],
  ['/blog/transferir-entrada-a-otra-persona', 'monthly', '0.6'],
  ['/blog/vender-entradas-con-mercado-pago', 'monthly', '0.6'],
  // Páginas por público (28/10/2026): HTML estáticos en public/vender-entradas.
  ['/vender-entradas', 'monthly', '0.7'],
  ['/vender-entradas/como-funciona', 'monthly', '0.8'],
  ['/vender-entradas/fiestas', 'monthly', '0.7'],
  ['/vender-entradas/recitales-y-shows', 'monthly', '0.7'],
  ['/vender-entradas/festivales', 'monthly', '0.7'],
  ['/vender-entradas/teatro', 'monthly', '0.7'],
  ['/vender-entradas/talleres-y-charlas', 'monthly', '0.7'],
  ['/vender-entradas/eventos-gratuitos-con-reserva', 'monthly', '0.7'],
  ['/vender-entradas/stand-up-y-comedia', 'monthly', '0.7'],
  ['/vender-entradas/eventos-deportivos', 'monthly', '0.7'],
  ['/vender-entradas/transferencia-y-lista-o-ticketera', 'monthly', '0.7'],
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
    // Solo los que están a la venta. El filtro de "ya pasó" se hace acá y no en la
    // query para no depender de un índice compuesto de Firestore ni del tipo exacto
    // del campo fecha (que puede ser Timestamp o string según cómo se cargó).
    //
    // ⚠️ ACÁ DECÍA where('status', '==', 'published') Y NINGÚN EVENTO TIENE ESE
    // ESTADO. Un evento nace 'pending' (CreateEvent) y el admin lo publica a
    // 'active' (AdminDashboard); 'published' solo aparece en filtros de LECTURA que
    // lo toleran, nunca en una escritura. O sea que el sitemap venía devolviendo
    // CERO eventos desde siempre y ninguna página de evento se descubría por acá.
    // Verificado el 11/8/2026 contra producción: header x-eventos-en-sitemap: 0.
    // Se dejan los dos estados porque las reglas siguen admitiendo 'published' y
    // create-payment lo acepta como vendible.
    const snap = await getAdminDb().collection('events')
      .where('status', 'in', ['active', 'published'])
      .limit(1000)
      .get();
    const ahora = Date.now();

    snap.forEach((doc) => {
      const e: any = doc.data() || {};
      if (e.deleted === true) return;
      // Oculto es oculto: si no se lista en la cartelera, tampoco se indexa.
      if (e.hidden === true) return;
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
