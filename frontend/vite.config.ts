import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/** Where `python manage.py runserver` is listening. */
const DJANGO_ORIGIN = 'http://127.0.0.1:8000';

// `/api` is proxied to Django so the browser only ever talks to one origin --
// no preflight, and no API base URL to keep in sync during the POC.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Mirrors the `@/*` path mapping in tsconfig.json.
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: DJANGO_ORIGIN, changeOrigin: true },
    },
    // tsc writes this on every typecheck; watching it forces a full reload
    // and throws away HMR state.
    watch: { ignored: ['**/*.tsbuildinfo'] },
  },
});
