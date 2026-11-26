import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { RUTAS, SITIO } from './src/lib/routeMeta';
import { htmlPortada, htmlProductores, htmlRuta, jsonLdPreguntas } from './src/lib/portada';

// HTML propio por ruta pública (30/10/2026). Vercel servía el mismo index.html para
// /productores, /ayuda, /contacto, etc.: mismo título, sin canonical y sin texto para quien no
// corre JavaScript (las IA). Acá se copia el index.html ya armado a dist/_rutas/<archivo>.html
// con el <head> y el texto de cada ruta (tabla en src/lib/routeMeta.ts), y vercel.json
// reescribe cada ruta a su archivo. El JS es el mismo: React Router arma la pantalla igual.
//
// 16/11/2026: el texto ya no va en un <noscript> (Google no lo cuenta como contenido) sino como
// HTML dentro de <div id="root">, que React reemplaza al arrancar. La portada y /productores
// llevan el contenido completo de src/lib/portada.ts (qué es, cómo se cobra, pasos, tipos de
// evento, ciudades y preguntas frecuentes), el mismo que muestra PortadaOrganizadores.tsx.
// El respaldo de la app (_rutas/app.html) queda como estaba, con su <noscript>.
function htmlPorRuta(): Plugin {
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const RAIZ = /<div id="root"><\/div>/;
  const NOSCRIPT = /\s*<!-- Texto para buscadores[\s\S]*?<\/noscript>/;
  const conTexto = (html: string, texto: string) => {
    for (const re of [RAIZ, NOSCRIPT]) if (!re.test(html)) throw new Error(`html-por-ruta: no encontré ${re} en index.html`);
    return html.replace(NOSCRIPT, '').replace(RAIZ, () => `<div id="root">${texto}</div>`);
  };
  return {
    name: 'html-por-ruta',
    apply: 'build',
    writeBundle(opts) {
      const dir = opts.dir ?? 'dist';
      const base = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
      fs.mkdirSync(path.join(dir, '_rutas'), { recursive: true });
      const hechos = new Set<string>();
      for (const [ruta, m] of Object.entries(RUTAS)) {
        if (!m.archivo || hechos.has(m.archivo)) continue;
        hechos.add(m.archivo);
        const url = SITIO + (m.canonical ?? ruta);
        const reemplazos: [RegExp, string][] = [
          [/<title>[^<]*<\/title>/, `<title>${esc(m.title)}</title>\n    <link rel="canonical" href="${url}" />`],
          [/(<meta name="description" content=")[^"]*/, `$1${esc(m.description)}`],
          [/(<meta property="og:url" content=")[^"]*/, `$1${url}`],
          [/(<meta property="(?:og|twitter):title" content=")[^"]*/g, `$1${esc(m.title)}`],
          [/(<meta property="(?:og|twitter):description" content=")[^"]*/g, `$1${esc(m.description)}`],
        ];
        let html = base;
        for (const [re, por] of reemplazos) {
          if (!re.test(html)) throw new Error(`html-por-ruta: no encontré ${re} en index.html`);
          re.lastIndex = 0;
          html = html.replace(re, por);
        }
        const h1 = m.h1 ?? m.title;
        const resumen = m.resumen ?? m.description;
        html = conTexto(html, m.archivo === 'productores' ? htmlProductores(h1, resumen) : htmlRuta(h1, resumen));
        fs.writeFileSync(path.join(dir, '_rutas', `${m.archivo}.html`), html);
      }
      // La home lleva canonical propio en el HTML (30/10/2026). Como Vercel sirve index.html en "/"
      // y también como respaldo de toda ruta de la app (/evento/..., /checkout), el respaldo pasa a
      // ser _rutas/app.html (el mismo HTML SIN canonical) y solo index.html, que es "/", lo trae.
      fs.writeFileSync(path.join(dir, '_rutas', 'app.html'), base);
      if (!/<title>[^<]*<\/title>/.test(base)) throw new Error('html-por-ruta: index.html sin <title>');
      const home = RUTAS['/'];
      if (base.match(/<title>([^<]*)<\/title>/)![1] !== home.title) {
        throw new Error('html-por-ruta: el <title> de index.html no coincide con el de la home en src/lib/routeMeta.ts');
      }
      const portada = conTexto(base, htmlPortada(home.h1 ?? home.title))
        .replace(/(<title>[^<]*<\/title>)/, `$1\n    <link rel="canonical" href="${SITIO}/" />`)
        .replace('</head>', () => `  <script type="application/ld+json">${jsonLdPreguntas()}</script>\n  </head>`);
      fs.writeFileSync(path.join(dir, 'index.html'), portada);
    },
  };
}

// TÍTULOS SEGÚN SU LARGO (26/11/2026). Las notas y guías son HTML suelto en public/ y todas
// usaban el mismo tamaño de h1: un titular de 90 letras ocupaba 7 renglones en el celular.
// Al compilar, a cada h1 de 70 letras o más se le agrega la clase t-largo (85 o más:
// t-muy-largo), que public/blog.css achica. Así nadie tiene que acordarse al escribir la nota.
function tituloSegunLargo(): Plugin {
  const CARPETAS = ['blog', 'vender-entradas', 'en', 'pt', 'fr', 'it'];
  const recorrer = (dir: string): string[] =>
    fs.existsSync(dir)
      ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
          e.isDirectory() ? recorrer(path.join(dir, e.name)) : e.name.endsWith('.html') ? [path.join(dir, e.name)] : [])
      : [];
  return {
    name: 'titulo-segun-largo',
    apply: 'build',
    closeBundle() {
      for (const archivo of CARPETAS.flatMap((c) => recorrer(path.join('dist', c)))) {
        const html = fs.readFileSync(archivo, 'utf8');
        const nuevo = html.replace(/<h1>([\s\S]*?)<\/h1>/, (todo, dentro: string) => {
          const largo = dentro.replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, 'x').trim().length;
          return largo >= 85 ? `<h1 class="t-muy-largo">${dentro}</h1>` : largo >= 70 ? `<h1 class="t-largo">${dentro}</h1>` : todo;
        });
        if (nuevo !== html) fs.writeFileSync(archivo, nuevo);
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      htmlPorRuta(),
      tituloSegunLargo(),
      // PWA: service worker + manifest para que ENTRÁ se instale y ABRA sin internet.
      // Clave para el control de acceso en la puerta: con la app instalada, el operador
      // entra a /control-acceso aunque no haya señal (los tickets ya están en la caché de
      // Firestore de cuando abrió el evento online). `autoUpdate` = el SW se refresca solo
      // al deployar una versión nueva, así ningún comprador queda con checkout viejo cacheado.
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
        manifest: {
          name: 'ENTRÁ · Ticketera',
          short_name: 'ENTRÁ',
          description: 'Comprá entradas y controlá el acceso de tu evento, incluso sin conexión en la puerta.',
          lang: 'es-AR',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#0a0a0a',
          theme_color: '#0a0a0a',
          icons: [
            { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
            { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Precachea el shell (JS/CSS/HTML/imgs/fuentes) para que abra offline.
          globPatterns: ['**/*.{js,css,html,png,svg,ico,woff,woff2}'],
          // Las imágenes para compartir y las páginas estáticas (blog, vender entradas) no son
          // parte de la app: precargarlas le bajaría varios MB a cada visitante.
          globIgnores: ['og/**', 'blog/**', 'vender-entradas/**', '_rutas/**', 'en/**', 'pt/**', 'fr/**', 'it/**'],
          // El bundle de la ticketera es grande; subimos el tope de precache.
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          // SPA: cualquier ruta desconocida cae al index (React Router la resuelve).
          navigateFallback: '/index.html',
          // No interceptar las llamadas a Firebase/Firestore ni a las funciones serverless:
          // Firestore maneja su propia persistencia offline y el cobro debe ir siempre a la red.
          // Tampoco el blog: son HTML estáticos servidos por Vercel (rewrite /blog/:slug ->
          // /blog/:slug.html). Sin este denylist, el service worker les devolvería el shell de
          // la SPA a cualquiera que ya tenga la PWA instalada y el post no se vería nunca.
          // Lo mismo para las páginas por público (public/vender-entradas), los .txt/.xml
          // (llms.txt, sitemap) y /en y /pt, que son redirecciones de vercel.json.
          navigateFallbackDenylist: [
            /^\/api\//,
            /^\/blog(\/|$)/,
            /^\/vender-entradas(\/|$)/,
            /\.(txt|xml)$/,
            /^\/(en|pt)(\/|$)/,
            // Blog en otros idiomas (public/<idioma>/blog, ver editorial/BLOG-5-IDIOMAS.md).
            /^\/(fr|it)\/blog(\/|$)/,
          ],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
        },
        // En dev no registramos SW para no ensuciar el flujo con caché.
        devOptions: { enabled: false },
      }),
    ],
    // Nota de seguridad: se quitó `define: process.env.GEMINI_API_KEY`, que incrustaba
    // una clave de servidor en el bundle servido al navegador (cualquiera podía leerla).
    // Si se usa IA, va detrás de un endpoint backend, nunca en el cliente.
    resolve: {
      alias: {
        '@/src': path.resolve(__dirname, './src'),
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      host: '0.0.0.0',
      port: 3000,
    },
  };
});
