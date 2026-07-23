import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
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
          // El bundle de la ticketera es grande; subimos el tope de precache.
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          // SPA: cualquier ruta desconocida cae al index (React Router la resuelve).
          navigateFallback: '/index.html',
          // No interceptar las llamadas a Firebase/Firestore ni a las funciones serverless:
          // Firestore maneja su propia persistencia offline y el cobro debe ir siempre a la red.
          navigateFallbackDenylist: [/^\/api\//],
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
