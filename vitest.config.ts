import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./apps/web/src', import.meta.url)),
      '@lumiclaw/blob-store': fileURLToPath(new URL('./packages/blob-store/src/index.ts', import.meta.url)),
      '@lumiclaw/i18n': fileURLToPath(new URL('./packages/i18n/src/index.ts', import.meta.url)),
      '@lumiclaw/domain': fileURLToPath(new URL('./packages/domain/src/index.ts', import.meta.url)),
      '@lumiclaw/db': fileURLToPath(new URL('./packages/db/src/index.ts', import.meta.url)),
      '@lumiclaw/governed-shadow': fileURLToPath(new URL('./packages/governed-shadow/src/index.ts', import.meta.url))
    }
  },
  test: {
    environment: 'node',
    include: ['apps/**/*.test.{ts,tsx}', 'packages/**/*.test.{ts,tsx}', 'scripts/**/*.test.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'json-summary']
    }
  }
});
