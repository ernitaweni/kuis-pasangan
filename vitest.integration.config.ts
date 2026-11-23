import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Integration test terhadap Firebase Emulator. Dijalankan lewat `npm run test:integration`. */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Semua tes memakai database emulator yang sama dan mengosongkannya di beforeEach.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
