import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // Exclude ALL of tests/** — that dir holds Playwright specs (tests/e2e/**
    // and tests/manuales/personas/**) which call test.describe() and crash the
    // vitest collector ("did not expect test.describe() to be called here").
    // Vitest unit tests are co-located under src/**/*.test.{ts,tsx}, so excluding
    // tests/** never drops a unit test. Widened from '**/tests/e2e/**' which
    // missed tests/manuales/** and kept CI red.
    exclude: ['**/tests/**', '**/node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/router.tsx',
        'src/**/*.d.ts',
        'src/**/index.ts',
      ],
      thresholds: {
        lines: 29,
        functions: 31,
        branches: 16,
        statements: 27,
      },
    },
  },
});
