import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Pratinjau link (og:image) harus memakai URL lengkap agar WhatsApp mau memuat gambarnya.
 * Di Vercel, domain produksi tersedia otomatis sebagai VERCEL_PROJECT_PRODUCTION_URL, juga saat
 * build preview. SITE_URL bisa dipakai untuk domain sendiri. Tanpa keduanya (misalnya di
 * laptop), URL dibiarkan relatif.
 */
function absoluteOgImage(): Plugin {
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const site = (process.env.SITE_URL ?? (vercelHost ? `https://${vercelHost}` : '')).replace(
    /\/+$/,
    '',
  );
  return {
    name: 'kuis-pasangan:og-image-absolut',
    transformIndexHtml: (html) =>
      site ? html.replace('content="/og-image.png"', `content="${site}/og-image.png"`) : html,
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), absoluteOgImage()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Logika game di utils/ adalah fungsi murni: cukup lingkungan Node, tanpa DOM.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/utils/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
