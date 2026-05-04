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
    exclude: ['**/tests/e2e/**', '**/node_modules/**'],
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
      // Ratchet floor: thresholds set just below the current baseline so a
      // regression fails CI but cleanup work is not blocked. Target is 70%
      // (lifted progressively in Track 2C "API hooks coverage" once MSW +
      // 50+ hooks land). See docs/research/2026-05-03-coverage-baseline.md.
      thresholds: {
        lines: 12,
        functions: 10,
        branches: 13,
        statements: 12,
      },
    },
  },
});
