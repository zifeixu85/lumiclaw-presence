import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@lumiclaw/i18n': fileURLToPath(new URL('./packages/i18n/src/index.ts', import.meta.url))
    }
  },
  test: {
    environment: 'node',
    include: ['apps/**/*.test.ts', 'packages/**/*.test.ts', 'scripts/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json-summary']
    }
  }
});
