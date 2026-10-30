import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { RUTAS, SITIO } from './src/lib/routeMeta';

// HTML propio por ruta pública (30/10/2026). Vercel servía el mismo index.html para
// /productores, /ayuda, /contacto, etc.: mismo título, sin canonical y sin texto para quien no
// corre JavaScript (las IA). Acá se copia el index.html ya armado a dist/_rutas/<archivo>.html
// con el <head> y el <noscript> de cada ruta (tabla en src/lib/routeMeta.ts), y vercel.json
// reescribe cada ruta a su archivo. El JS es el mismo: React Router arma la pantalla igual.
function htmlPorRuta(): Plugin {
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
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
          [/(<noscript>\s*)<h1>[^<]*<\/h1>\s*<p>[^<]*<\/p>/, `$1<h1>${esc(m.h1 ?? m.title)}</h1>\n      <p>${esc(m.resumen ?? m.description)}</p>`],
        ];
        let html = base;
        for (const [re, por] of reemplazos) {
          if (!re.test(html)) throw new Error(`html-por-ruta: no encontré ${re} en index.html`);
          re.lastIndex = 0;
          html = html.replace(re, por);
        }
        fs.writeFileSync(path.join(dir, '_rutas', `${m.archivo}.html`), html);
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
          globIgnores: ['og/**', 'blog/**', 'vender-entradas/**', '_rutas/**'],
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
