import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
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
