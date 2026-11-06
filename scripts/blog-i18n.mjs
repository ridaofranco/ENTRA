#!/usr/bin/env node
// Blog de ENTRÁ en 5 idiomas (es, en, pt, fr, it). Réplica de somosder.ar.
//
// Qué hace, en este orden:
//   1. Con --subir: toma las traducciones que dejó la revista en
//      editorial/traducciones/<slug-es>.<idioma>.html, las valida, las copia a
//      public/<idioma>/blog/<slug-nativo>.html (el slug sale del canonical del
//      archivo), suma el par a editorial/blog-pares.json y mueve el original a
//      editorial/traducciones/subidas/.
//   2. Escribe el bloque hreflang (recíproco + x-default al español) en cada nota
//      que tiene al menos una traducción, y el selector de idioma arriba de la nota.
//   3. Regenera los índices public/{en,pt,fr,it}/blog/index.html.
//   4. Regenera api/_blog-i18n.ts (rutas y alternates que suma api/sitemap.ts).
//   5. Regenera la sección «Blog in other languages» de public/llms.txt.
//
// Uso:  node scripts/blog-i18n.mjs            (solo regenera)
//       node scripts/blog-i18n.mjs --subir    (sube traducciones nuevas y regenera)
// Documentación completa: editorial/BLOG-5-IDIOMAS.md

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://www.entratickets.com';
const PUBLIC = path.join(RAIZ, 'public');
const PARES = path.join(RAIZ, 'editorial', 'blog-pares.json');
const TRADUCCIONES = path.join(RAIZ, 'editorial', 'traducciones');
const SITEMAP_TS = path.join(RAIZ, 'api', '_blog-i18n.ts');
const LLMS = path.join(PUBLIC, 'llms.txt');

const IDIOMAS = ['es', 'en', 'pt', 'fr', 'it'];
const OTROS = ['en', 'pt', 'fr', 'it'];
const HREFLANG = { es: 'es-AR', en: 'en', pt: 'pt', fr: 'fr', it: 'it' };
const LOCALE = { es: 'es-AR', en: 'en-US', pt: 'pt-BR', fr: 'fr-FR', it: 'it-IT' };
const NOMBRE = { es: 'Español', en: 'English', pt: 'Português', fr: 'Français', it: 'Italiano' };
const SLUG_OK = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const subir = process.argv.includes('--subir');
const avisos = [];
const avisar = (m) => { avisos.push(m); console.warn('  ! ' + m); };

const rutaNota = (lang, slug) => (lang === 'es' ? `/blog/${slug}` : `/${lang}/blog/${slug}`);
const rutaIndice = (lang) => (lang === 'es' ? '/blog' : `/${lang}/blog`);
const archivoNota = (lang, slug) =>
  lang === 'es' ? path.join(PUBLIC, 'blog', `${slug}.html`) : path.join(PUBLIC, lang, 'blog', `${slug}.html`);
const dirBlog = (lang) => (lang === 'es' ? path.join(PUBLIC, 'blog') : path.join(PUBLIC, lang, 'blog'));

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const desc = (s) => String(s ?? '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const sinTags = (s) => desc(String(s ?? '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

// ---------- pares ----------
function leerPares() {
  if (!fs.existsSync(PARES)) return { _leeme: '', pares: [] };
  return JSON.parse(fs.readFileSync(PARES, 'utf8'));
}
function guardarPares(data) {
  data.pares.sort((a, b) => a.es.localeCompare(b.es));
  fs.writeFileSync(PARES, JSON.stringify(data, null, 2) + '\n');
}

// ---------- lectura de una nota ----------
function leerNota(lang, slug) {
  const html = fs.readFileSync(archivoNota(lang, slug), 'utf8');
  const m = (re) => (html.match(re) || [])[1];
  const h1 = sinTags(m(/<h1[^>]*>([\s\S]*?)<\/h1>/));
  const titulo = sinTags(m(/<title>([\s\S]*?)<\/title>/));
  const descripcion = desc(m(/<meta name="description" content="([^"]*)"/) || '');
  const kicker = sinTags(m(/<article[^>]*>\s*<p class="kicker">([\s\S]*?)<\/p>/) || '');
  const fecha = m(/"datePublished":\s*"([0-9-]{10})/) || '';
  const minutos = Number(m(/<p class="meta">[^<]*?(\d+)\s*min/) || 0) || null;
  return { lang, slug, html, h1: h1 || titulo, titulo, descripcion, kicker, fecha, minutos };
}

// ---------- 1. subir traducciones ----------
function subirTraducciones(data) {
  if (!fs.existsSync(TRADUCCIONES)) return;
  const archivos = fs.readdirSync(TRADUCCIONES).filter((f) => f.endsWith('.html'));
  for (const f of archivos) {
    const mm = f.match(/^(.+)\.(en|pt|fr|it)\.html$/);
    if (!mm) { avisar(`traducciones/${f}: el nombre tiene que ser <slug-es>.<en|pt|fr|it>.html, no lo subo`); continue; }
    const [, slugEs, lang] = mm;
    const origen = path.join(TRADUCCIONES, f);
    const html = fs.readFileSync(origen, 'utf8');
    const errores = [];
    if (!fs.existsSync(archivoNota('es', slugEs))) errores.push(`no existe la nota española public/blog/${slugEs}.html`);
    const canon = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] || '';
    const cm = canon.match(new RegExp(`^${SITE.replace(/[.]/g, '\\.')}/${lang}/blog/([^/?#]+)$`));
    if (!cm) errores.push(`el canonical tiene que ser ${SITE}/${lang}/blog/<slug-nativo> (es «${canon}»)`);
    const slug = cm ? cm[1] : '';
    if (slug && !SLUG_OK.test(slug)) errores.push(`slug «${slug}» inválido (minúsculas, sin acentos, guiones)`);
    if (!new RegExp(`<html lang="${lang}`).test(html)) errores.push(`falta <html lang="${lang}">`);
    if (/[\u2014\u2013]/.test(html)) errores.push('tiene guion largo o semiguion');
    for (const bloque of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try { JSON.parse(bloque[1]); } catch (e) { errores.push('JSON-LD roto: ' + e.message); }
    }
    if (errores.length) { avisar(`traducciones/${f} NO se sube: ${errores.join('; ')}`); continue; }

    let par = data.pares.find((p) => p.es === slugEs);
    if (!par) { par = { es: slugEs }; data.pares.push(par); }
    if (par[lang] && par[lang] !== slug) {
      avisar(`${slugEs} ya tenía ${lang}=${par[lang]}; lo reemplazo por ${slug} (el archivo viejo queda en public/${lang}/blog: avisar a Franco si hay que borrarlo)`);
    }
    par[lang] = slug;
    fs.mkdirSync(dirBlog(lang), { recursive: true });
    fs.writeFileSync(archivoNota(lang, slug), html);
    fs.mkdirSync(path.join(TRADUCCIONES, 'subidas'), { recursive: true });
    fs.renameSync(origen, path.join(TRADUCCIONES, 'subidas', f));
    console.log(`  + subida ${lang}/blog/${slug} (de ${slugEs})`);
  }
}

// ---------- 2. hreflang + selector ----------
function reemplazarBloque(html, marca, contenido, insertar) {
  const re = new RegExp(`[ \\t]*<!-- ${marca}:inicio[\\s\\S]*?<!-- ${marca}:fin -->\\n?`);
  if (re.test(html)) return html.replace(re, contenido);
  if (!contenido) return html;
  return insertar(html, contenido);
}

function bloqueHreflang(grupo) {
  if (!grupo || grupo.length < 2) return '';
  const es = grupo.find((g) => g.lang === 'es') || grupo[0];
  const lineas = grupo.map((g) => `  <link rel="alternate" hreflang="${HREFLANG[g.lang]}" href="${SITE}${g.ruta}" />`);
  lineas.push(`  <link rel="alternate" hreflang="x-default" href="${SITE}${es.ruta}" />`);
  return `  <!-- hreflang:inicio (lo escribe scripts/blog-i18n.mjs, no tocar a mano) -->\n${lineas.join('\n')}\n  <!-- hreflang:fin -->\n`;
}

function bloqueIdiomas(grupo, actual) {
  if (!grupo || grupo.length < 2) return '';
  const items = IDIOMAS.map((l) => grupo.find((g) => g.lang === l)).filter(Boolean).map((g) =>
    g.lang === actual
      ? `<b lang="${g.lang}">${NOMBRE[g.lang]}</b>`
      : `<a href="${g.ruta}" hreflang="${HREFLANG[g.lang]}" lang="${g.lang}">${NOMBRE[g.lang]}</a>`,
  );
  return `  <!-- idiomas:inicio (lo escribe scripts/blog-i18n.mjs, no tocar a mano) -->\n  <nav class="wrap idiomas" aria-label="Idioma" style="padding-top:14px;font-size:.85rem;opacity:.85;display:flex;gap:.9rem;flex-wrap:wrap;">${items.join(' ')}</nav>\n  <!-- idiomas:fin -->\n`;
}

function aplicarBloques(file, grupo, lang) {
  let html = fs.readFileSync(file, 'utf8');
  const antes = html;
  html = reemplazarBloque(html, 'hreflang', bloqueHreflang(grupo), (h, c) =>
    h.replace(/(<link rel="canonical"[^>]*>\n)/, `$1${c}`),
  );
  html = reemplazarBloque(html, 'idiomas', bloqueIdiomas(grupo, lang), (h, c) =>
    h.replace(/(<\/header>\n)/, `$1${c}`),
  );
  if (html !== antes) fs.writeFileSync(file, html);
  return html !== antes;
}

// ---------- 3. índices por idioma ----------
const TXT = {
  en: {
    titulo: 'ENTRÁ Blog | Selling Event Tickets and Door Control',
    descripcion: 'Guides from ENTRÁ, an Argentine ticketing platform: ticket pricing, fees, QR access control and fraud at the door, for small and mid-size event organizers.',
    h1: 'Tickets and the door, straight to the point',
    intro: 'Practical guides for people who organize events. ENTRÁ is a ticketing platform from Argentina: it sells tickets for events held in Argentina, priced in Argentine pesos. The advice works anywhere; the ENTRÁ details describe how it works in Argentina.',
    min: (n) => `${n} min read`,
    inicio: 'Home',
    blogEs: 'Read the full blog in Spanish',
    cta: 'Questions about selling tickets in Argentina? Write to us on WhatsApp',
    wa: 'Hi! I read the ENTRÁ blog and I have a question about selling tickets for an event in Argentina.',
    pie: 'Ticketing platform with access control, made in Argentina by',
  },
  pt: {
    titulo: 'Blog da ENTRÁ | Vender ingressos e controlar o acesso',
    descripcion: 'Guias da ENTRÁ, plataforma argentina de ingressos: preço e lotes, taxas, controle de acesso com QR e fraude na entrada, para quem organiza eventos.',
    h1: 'Ingressos e portaria, sem rodeios',
    intro: 'Guias práticos para quem organiza eventos. A ENTRÁ é uma plataforma de ingressos da Argentina: vende ingressos para eventos realizados na Argentina, com preço em pesos argentinos. As dicas servem em qualquer lugar; os detalhes da ENTRÁ descrevem como ela funciona na Argentina.',
    min: (n) => `${n} min de leitura`,
    inicio: 'Início',
    blogEs: 'Ler o blog completo em espanhol',
    cta: 'Dúvidas sobre vender ingressos na Argentina? Fale com a gente no WhatsApp',
    wa: 'Olá! Li o blog da ENTRÁ e tenho uma dúvida sobre vender ingressos para um evento na Argentina.',
    pie: 'Plataforma de ingressos com controle de acesso, feita na Argentina por',
  },
  fr: {
    titulo: 'Blog ENTRÁ | Vendre des billets et contrôler l’accès',
    descripcion: 'Guides d’ENTRÁ, billetterie en ligne argentine : prix des billets, commissions, contrôle d’accès par QR et fraude à l’entrée, pour les organisateurs.',
    h1: 'Billets et entrée, sans détour',
    intro: 'Des guides pratiques pour celles et ceux qui organisent des événements. ENTRÁ est une billetterie en ligne argentine : elle vend des billets pour des événements organisés en Argentine, en pesos argentins. Les conseils valent partout ; les détails sur ENTRÁ décrivent son fonctionnement en Argentine.',
    min: (n) => `${n} min de lecture`,
    inicio: 'Accueil',
    blogEs: 'Lire le blog complet en espagnol',
    cta: 'Une question sur la vente de billets en Argentine ? Écrivez-nous sur WhatsApp',
    wa: 'Bonjour ! J’ai lu le blog d’ENTRÁ et j’ai une question sur la vente de billets pour un événement en Argentine.',
    pie: 'Billetterie avec contrôle d’accès, faite en Argentine par',
  },
  it: {
    titulo: 'Blog di ENTRÁ | Vendere biglietti e controllare gli ingressi',
    descripcion: 'Guide di ENTRÁ, biglietteria online argentina: prezzo dei biglietti, commissioni, controllo accessi con QR e frodi all’ingresso, per chi organizza eventi.',
    h1: 'Biglietti e ingresso, senza giri di parole',
    intro: 'Guide pratiche per chi organizza eventi. ENTRÁ è una biglietteria online argentina: vende biglietti per eventi che si tengono in Argentina, con prezzi in pesos argentini. I consigli valgono ovunque; i dettagli su ENTRÁ descrivono come funziona in Argentina.',
    min: (n) => `${n} min di lettura`,
    inicio: 'Home',
    blogEs: 'Leggi il blog completo in spagnolo',
    cta: 'Domande sulla vendita di biglietti in Argentina? Scrivici su WhatsApp',
    wa: 'Ciao! Ho letto il blog di ENTRÁ e ho una domanda sulla vendita di biglietti per un evento in Argentina.',
    pie: 'Biglietteria con controllo accessi, fatta in Argentina da',
  },
};

function fechaLarga(lang, iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00Z');
  return new Intl.DateTimeFormat(LOCALE[lang], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}

function indiceHtml(lang, notas, grupoIndices) {
  const t = TXT[lang];
  const tarjetas = notas.map((n) => `      <a class="hcard" href="${rutaNota(lang, n.slug)}">
        ${n.kicker ? `<p class="kicker">${esc(n.kicker)}</p>\n        ` : ''}<h2>${esc(n.h1)}</h2>
        <p>${esc(n.descripcion)}</p>
        <p class="meta">${esc(fechaLarga(lang, n.fecha))}${n.minutos ? ' · ' + esc(t.min(n.minutos)) : ''}</p>
      </a>`).join('\n');
  const wa = `https://wa.me/5491171540675?text=${encodeURIComponent(t.wa)}`;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: t.titulo,
    description: t.descripcion,
    inLanguage: lang,
    url: `${SITE}${rutaIndice(lang)}`,
    publisher: { '@type': 'Organization', name: 'ENTRÁ', url: `${SITE}/` },
    blogPost: notas.map((n) => ({ '@type': 'BlogPosting', headline: n.h1, url: `${SITE}${rutaNota(lang, n.slug)}`, datePublished: n.fecha })),
  };
  return `<!doctype html>
<html lang="${lang}">
<head>
  <!-- Índice GENERADO por scripts/blog-i18n.mjs. No editar a mano: se pisa. -->
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#0a0a0a" />
  <meta name="color-scheme" content="dark" />
  <title>${esc(t.titulo)}</title>
  <meta name="description" content="${esc(t.descripcion)}" />
  <link rel="canonical" href="${SITE}${rutaIndice(lang)}" />
${bloqueHreflang(grupoIndices)}  <link rel="icon" type="image/png" href="/pwa-192.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="stylesheet" href="/blog.css" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="ENTRÁ" />
  <meta property="og:locale" content="${LOCALE[lang].replace('-', '_')}" />
  <meta property="og:title" content="${esc(t.titulo)}" />
  <meta property="og:description" content="${esc(t.descripcion)}" />
  <meta property="og:url" content="${SITE}${rutaIndice(lang)}" />
  <meta property="og:image" content="${SITE}/og-image.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
  </script>
</head>
<body>
  <header class="nav">
    <div class="wrap nav-in">
      <a class="word" href="/">ENTR<b>Á</b></a>
      <a class="btn btn-ghost" href="/">${esc(t.inicio)}</a>
    </div>
  </header>
${bloqueIdiomas(grupoIndices, lang)}
  <div class="wrap">
    <article style="padding-bottom:0;">
      <p class="kicker">Blog</p>
      <h1>${esc(t.h1)}</h1>
      <p class="meta">${esc(t.intro)}</p>
    </article>

    <div class="hlist">
${tarjetas}
    </div>

    <div class="cta">
      <p><a class="btn btn-primary" href="${esc(wa)}">${esc(t.cta)}</a></p>
      <p><a href="/blog" hreflang="es-AR">${esc(t.blogEs)} →</a></p>
    </div>
  </div>

  <footer>
    <div class="wrap foot-in">
      <a class="word" href="/" style="font-size:1.1rem;">ENTR<b>Á</b></a>
      <span>${esc(t.pie)} <a href="https://somosder.ar">SOMOS DER</a> · <a href="https://pase.somosder.ar">PASE</a> · <a href="https://laburo.somosder.ar">LABURO</a></span>
    </div>
    <div class="wrap" style="padding-top:12px;font-size:.8rem;opacity:.85">Desarrollo: <a href="https://hito.agency">hito.agency</a></div>
  </footer>
</body>
</html>
`;
}

// ---------- chequeo de enlaces internos de las traducciones ----------
function existeRuta(ruta) {
  const r = ruta.split(/[?#]/)[0].replace(/\/$/, '') || '/';
  if (['/', '/productores', '/ayuda', '/contacto', '/eventos', '/terminos', '/privacidad', '/blog', '/vender-entradas'].includes(r)) return true;
  if (/^\/(en|pt|fr|it)\/blog$/.test(r)) return fs.existsSync(path.join(PUBLIC, r, 'index.html'));
  if (fs.existsSync(path.join(PUBLIC, r)) && fs.statSync(path.join(PUBLIC, r)).isFile()) return true;
  return fs.existsSync(path.join(PUBLIC, r + '.html'));
}

// ---------- main ----------
const data = leerPares();
if (subir) { console.log('Subiendo traducciones…'); subirTraducciones(data); }

// Limpiar pares: cada slug tiene que existir.
for (const par of data.pares) {
  for (const lang of IDIOMAS) {
    if (!par[lang]) continue;
    if (!SLUG_OK.test(par[lang]) || !fs.existsSync(archivoNota(lang, par[lang]))) {
      avisar(`par ${par.es}: ${lang}=${par[lang]} no existe en public/; lo saco del grupo`);
      delete par[lang];
    }
  }
}
data.pares = data.pares.filter((p) => p.es);
guardarPares(data);

// Notas por idioma.
const notas = {};
for (const lang of IDIOMAS) {
  const dir = dirBlog(lang);
  notas[lang] = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith('.html') && f !== 'index.html').map((f) => f.slice(0, -5)).sort()
    : [];
}

// Grupo de cada nota.
const grupoDe = new Map(); // "lang/slug" -> [{lang, ruta}]
for (const par of data.pares) {
  const grupo = IDIOMAS.filter((l) => par[l]).map((l) => ({ lang: l, slug: par[l], ruta: rutaNota(l, par[l]) }));
  for (const g of grupo) grupoDe.set(`${g.lang}/${g.slug}`, grupo);
}
let tocadas = 0;
for (const lang of IDIOMAS) {
  for (const slug of notas[lang]) {
    const grupo = grupoDe.get(`${lang}/${slug}`) || null;
    if (lang !== 'es' && !grupo) avisar(`${lang}/blog/${slug} no está en blog-pares.json (queda sin hreflang)`);
    if (aplicarBloques(archivoNota(lang, slug), grupo, lang)) tocadas++;
  }
}

// Índices.
const idiomasConNotas = OTROS.filter((l) => notas[l].length);
const grupoIndices = ['es', ...idiomasConNotas].map((l) => ({ lang: l, ruta: rutaIndice(l) }));
aplicarBloques(path.join(PUBLIC, 'blog', 'index.html'), grupoIndices, 'es');
const leidas = {};
for (const lang of idiomasConNotas) {
  leidas[lang] = notas[lang].map((s) => leerNota(lang, s)).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || a.h1.localeCompare(b.h1));
  fs.writeFileSync(path.join(dirBlog(lang), 'index.html'), indiceHtml(lang, leidas[lang], grupoIndices));
  for (const n of leidas[lang]) {
    for (const [, href] of n.html.matchAll(/href="(\/[^"]*)"/g)) {
      if (!existeRuta(href)) avisar(`${lang}/blog/${n.slug}: enlace interno roto ${href}`);
    }
    if (/[\u2014\u2013]/.test(n.html)) avisar(`${lang}/blog/${n.slug}: tiene guion largo o semiguion`);
  }
}

// Sitemap (lo importa api/sitemap.ts).
const rutasSitemap = [];
const alternates = {};
for (const lang of idiomasConNotas) {
  rutasSitemap.push([rutaIndice(lang), 'weekly', '0.5']);
  for (const slug of notas[lang]) rutasSitemap.push([rutaNota(lang, slug), 'monthly', '0.5']);
}
const conAlt = (grupo) => {
  const es = grupo.find((g) => g.lang === 'es') || grupo[0];
  return [...grupo.map((g) => [HREFLANG[g.lang], g.ruta]), ['x-default', es.ruta]];
};
if (grupoIndices.length > 1) for (const g of grupoIndices) alternates[g.ruta] = conAlt(grupoIndices);
for (const grupo of new Set(grupoDe.values())) {
  if (grupo.length < 2) continue;
  for (const g of grupo) alternates[g.ruta] = conAlt(grupo);
}
fs.writeFileSync(SITEMAP_TS, `// GENERADO por scripts/blog-i18n.mjs (node scripts/blog-i18n.mjs). No editar a mano.
// Rutas del blog en en/pt/fr/it y los alternates hreflang de cada nota con traducciones.
// Lo usa api/sitemap.ts. El guion bajo del nombre hace que Vercel no lo trate como función.

export const BLOG_I18N_RUTAS: Array<[string, string, string]> = [
${rutasSitemap.map((r) => '  ' + JSON.stringify(r) + ',').join('\n')}
];

export const BLOG_I18N_ALTERNATES: Record<string, Array<[string, string]>> = {
${Object.entries(alternates).map(([k, v]) => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(v) + ',').join('\n')}
};
`);

// llms.txt
let llms = fs.readFileSync(LLMS, 'utf8');
let seccion = '';
if (idiomasConNotas.length) {
  const partes = [
    '<!-- blog-i18n:inicio (lo escribe scripts/blog-i18n.mjs, no tocar a mano) -->',
    '## Blog in other languages',
    'ENTRÁ is an Argentine ticketing platform: it sells tickets for events held in Argentina, priced in Argentine pesos. These guides are native versions of notes from the Spanish blog, for readers in English, Portuguese, French and Italian.',
  ];
  for (const lang of idiomasConNotas) {
    partes.push('', `### ${NOMBRE[lang]} (${SITE}${rutaIndice(lang)})`);
    for (const n of leidas[lang]) partes.push(`- [${n.h1}](${SITE}${rutaNota(lang, n.slug)})`);
  }
  partes.push('<!-- blog-i18n:fin -->', '');
  seccion = partes.join('\n') + '\n';
}
const reLlms = /<!-- blog-i18n:inicio[\s\S]*?<!-- blog-i18n:fin -->\n\n?/;
if (reLlms.test(llms)) llms = llms.replace(reLlms, seccion);
else if (seccion) llms = llms.includes('\n## Ecosistema SOMOS DER') ? llms.replace('\n## Ecosistema SOMOS DER', '\n' + seccion + '## Ecosistema SOMOS DER') : llms + '\n' + seccion;
fs.writeFileSync(LLMS, llms);

console.log(`Listo: ${data.pares.length} grupos, notas en ${IDIOMAS.map((l) => `${l}=${notas[l].length}`).join(' ')}, ${tocadas} notas con hreflang actualizado, ${rutasSitemap.length} rutas nuevas en el sitemap.`);
if (avisos.length) { console.log(`${avisos.length} aviso(s), revisar arriba.`); process.exitCode = 0; }
