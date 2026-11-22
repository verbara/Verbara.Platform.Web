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
    // Filter two known-benign console lines so a real warning never hides in the
    // noise. Both are expected test-environment artifacts, not defects:
    //  - NO_I18NEXT_INSTANCE: component tests that don't care about copy render
    //    without an i18n provider; react-i18next falls back to keys by design.
    //  - "could not fit page": jspdf-autotable layout note when test fixtures are
    //    rendered into a fixed-width PDF; the PDF tests assert structure, not layout.
    // Any other console output is preserved.
    onConsoleLog(log) {
      if (log.includes('NO_I18NEXT_INSTANCE') || log.includes('could not fit page')) {
        return false;
      }
    },
    // Unit tests live in two places: co-located under src/** and under tests/unit/**.
    // The rest of tests/ is Playwright (tests/e2e/**, tests/manuales/**, plus their
    // fixtures), whose specs call test.describe() and crash the vitest collector
    // ("did not expect test.describe() to be called here"). So the include names the
    // two unit-test roots instead of excluding tests/** wholesale, which (since
    // 583107cf) had silently dropped every tests/unit file from the run.
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/unit/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', 'tests/e2e/**', 'tests/manuales/**', 'tests/fixtures/**'],
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
