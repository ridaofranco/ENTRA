#!/usr/bin/env node
/**
 * CONTROL VISUAL DE ENTRÁ (26/11/2026). Copia de /root/scripts/control-visual-sitio.mjs
 * (versión general del control de somosder-web) con un agregado: --idioma, porque la
 * aplicación elige español o inglés según el navegador. Abre las páginas públicas en un
 * navegador real, en escritorio (1440) y celular (390), y falla si encuentra:
 *   desborde (la página se corre al costado) · hueco (grilla con columnas vacías o una
 *   tarjeta sola) · titulo (h1 en demasiados renglones) · imagen (foto que no carga).
 *
 * Uso:  node control-visual.mjs --base http://127.0.0.1:4173 [--mapa https://sitio/sitemap.xml]
 *                               [--rutas archivo.txt] [--por-grupo 4] [/ruta ...]
 *                               [--idioma es-AR]   (idioma del navegador; por defecto es-AR)
 * Las páginas salen del mapa del sitio (por defecto <base>/sitemap.xml). Como miles de
 * páginas comparten plantilla, de cada grupo (primer tramo de la ruta) se revisan las
 * de título más largo en la dirección y unas pocas más.
 * Sale con 1 si hay fallas.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const BASE = (opt('base') || '').replace(/\/$/, '');
const MAPA = opt('mapa');
const RUTAS = opt('rutas');
const POR_GRUPO = Number(opt('por-grupo', 4));
const IDIOMA = opt('idioma', 'es-AR');
const MAX_RENGLONES = { 1440: 4, 390: 6 };
const MAX_RENGLONES_NOTA = { 1440: 5, 390: 8 }; // titulares de notas (blog, revista)
const ES_NOTA = /(^|\/)(blog|revista|notas|magazine)\/.+/;
// Excepciones justificadas, una por una, en control-visual.excepciones.json junto al
// script: [{ "ruta": "^/eventos$", "tipo": "hueco", "motivo": "listado que depende de la cartelera" }]
const EXC_ARCHIVO = new URL('./control-visual.excepciones.json', import.meta.url);
const EXCEPCIONES = fs.existsSync(EXC_ARCHIVO) ? JSON.parse(fs.readFileSync(EXC_ARCHIVO, 'utf8')) : [];
const exceptuada = (f) => EXCEPCIONES.some((e) => new RegExp(e.ruta).test(f.u) && (!e.tipo || e.tipo === f.tipo) && (!e.contiene || f.det.includes(e.contiene)));
if (!BASE) { console.error('control-visual: falta --base'); process.exit(2); }

let chromium;
for (const m of ['playwright', '/opt/der-node/node_modules/playwright']) { try { ({ chromium } = require(m)); break; } catch {} }
if (!chromium) { console.error('control-visual: falta Playwright.'); process.exit(2); }

// --- páginas a revisar -------------------------------------------------------
async function delMapa(url, nivel = 0) {
  let xml;
  if (!/^https?:/.test(url)) xml = fs.readFileSync(url, 'utf8');
  else {
    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!r.ok) return [];
    xml = await r.text();
  }
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  if (/<sitemapindex/.test(xml) && nivel < 2) return (await Promise.all(locs.map((l) => delMapa(l, nivel + 1)))).flat();
  return locs;
}
let rutas = args.filter((a) => a.startsWith('/'));
if (!rutas.length && RUTAS) rutas = fs.readFileSync(RUTAS, 'utf8').split('\n').map((x) => x.trim()).filter(Boolean);
if (!rutas.length) {
  const locs = await delMapa(MAPA || `${BASE}/sitemap.xml`);
  const todas = [...new Set(locs.map((l) => { try { const u = new URL(l); return u.pathname + u.search; } catch { return null; } }).filter(Boolean))];
  const grupos = {};
  for (const p of todas) {
    const tramos = p.split('/').filter(Boolean);
    // idioma + sección cuentan como grupo: /en/blog/x → en/blog
    const clave = tramos.length <= 1 ? '(raíz)' : tramos.slice(0, /^[a-z]{2}$/.test(tramos[0]) && tramos.length > 2 ? 2 : 1).join('/');
    (grupos[clave] ||= []).push(p);
  }
  rutas = ['/'];
  for (const [clave, lista] of Object.entries(grupos)) {
    if (clave === '(raíz)') { rutas.push(...lista); continue; }
    lista.sort((a, b) => b.length - a.length);
    const paso = Math.max(1, Math.floor(lista.length / POR_GRUPO));
    rutas.push(...lista.slice(0, 2), ...lista.filter((_, i) => i % paso === 0).slice(0, POR_GRUPO));
  }
  rutas = [...new Set(rutas)];
}
if (!rutas.length) { console.error('control-visual: no encontré páginas para revisar.'); process.exit(2); }

// --- medición dentro de la página -------------------------------------------
function medir(maxRenglones) {
  const fallas = [];
  const vw = window.innerWidth;
  const desborde = document.documentElement.scrollWidth - vw;
  if (desborde > 2) {
    const culpable = [...document.querySelectorAll('body *')].find((e) => {
      if (!e.offsetWidth || e.closest('.logos-track')) return false;
      return e.getBoundingClientRect().right > vw + 2 && getComputedStyle(e).position !== 'fixed';
    });
    fallas.push({ tipo: 'desborde', det: `${desborde}px · ${(culpable?.innerText || culpable?.className || '').toString().trim().slice(0, 50)}` });
  }
  const h1 = document.querySelector('h1');
  if (h1 && h1.innerText.trim()) {
    const cs = getComputedStyle(h1);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.1;
    const renglones = Math.round(h1.getBoundingClientRect().height / lh);
    if (renglones > maxRenglones) fallas.push({ tipo: 'titulo', det: `${renglones} renglones · ${h1.innerText.trim().slice(0, 60)}` });
  }
  for (const g of document.querySelectorAll('*')) {
    const cs = getComputedStyle(g);
    if (cs.display !== 'grid' || g.closest('form')) continue;
    const hijos = [...g.children].filter((k) => k.offsetWidth > 0 && getComputedStyle(k).position !== 'absolute');
    const columnas = cs.gridTemplateColumns.split(' ').filter((x) => parseFloat(x) > 0).length;
    // 2 hijos en 2 columnas es un bloque texto + imagen, no una grilla de tarjetas;
    // los listados largos (blog, todos los eventos) terminan donde terminan.
    if (columnas < 2 || columnas > 6 || hijos.length < 2 || hijos.length === columnas || hijos.length > 12) continue;
    const caja = g.getBoundingClientRect();
    const filas = {};
    for (const k of hijos) (filas[Math.round(k.getBoundingClientRect().top)] ||= []).push(k);
    const ultima = filas[Math.max(...Object.keys(filas).map(Number))];
    const derecha = Math.max(...ultima.map((k) => k.getBoundingClientRect().right));
    if (caja.right - derecha > caja.width / (columnas + 0.5)) {
      fallas.push({ tipo: 'hueco', det: `${hijos.length} en ${columnas} columnas · ${(g.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 45)}` });
    }
  }
  return fallas;
}


// --- recorrido ---------------------------------------------------------------
let navegador;
try { navegador = await chromium.launch(); } catch { navegador = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] }); }
const fallas = [];
const cola = [...rutas];
async function trabajador() {
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 }, locale: IDIOMA });
  const pag = await ctx.newPage();
  const rotas = new Set();
  pag.on('response', (r) => { if (r.status() === 404 && r.request().resourceType() === 'image') rotas.add(r.url()); });
  while (cola.length) {
    const u = cola.shift();
    for (const ancho of [1440, 390]) {
      rotas.clear();
      try {
        await pag.setViewportSize({ width: ancho, height: 900 });
        const resp = await pag.goto(BASE + u, { waitUntil: 'load', timeout: 45000 });
        await pag.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        if (resp && resp.status() >= 400) { fallas.push({ u, ancho, tipo: 'error', det: `responde ${resp.status()}` }); continue; }
        for (const f of await pag.evaluate(medir, (ES_NOTA.test(u) ? MAX_RENGLONES_NOTA : MAX_RENGLONES)[ancho])) fallas.push({ u, ancho, ...f });
        for (const r of rotas) fallas.push({ u, ancho, tipo: 'imagen', det: r.slice(0, 110) });
      } catch (e) { fallas.push({ u, ancho, tipo: 'error', det: String(e).split('\n')[0].slice(0, 90) }); }
    }
  }
  await ctx.close();
}
await Promise.all(Array.from({ length: 3 }, trabajador));
await navegador.close();

for (let i = fallas.length - 1; i >= 0; i--) if (exceptuada(fallas[i])) fallas.splice(i, 1);
if (!fallas.length) { console.log(`control-visual: ${rutas.length} páginas en escritorio y celular (${IDIOMA}), sin fallas.`); process.exit(0); }
const grupos = new Map();
for (const f of fallas) { const k = `${f.tipo} · ${f.ancho}px · ${f.det}`; (grupos.get(k) || grupos.set(k, []).get(k)).push(f.u); }
console.error(`control-visual: ${fallas.length} fallas en ${new Set(fallas.map((f) => f.u)).size} páginas (de ${rutas.length}).\n`);
for (const [k, us] of [...grupos].sort((a, b) => b[1].length - a[1].length).slice(0, 50)) console.error(`✗ ${k}\n    ${us.slice(0, 4).join('  ')}${us.length > 4 ? `  (+${us.length - 4})` : ''}`);
process.exit(1);
