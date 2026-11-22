import { configDefaults, defineConfig } from 'vitest/config';
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
    // Collect with vitest's default include and exclude only what is not a unit test.
    // tests/e2e/** and tests/manuales/** (plus tests/fixtures/**) are Playwright: their
    // specs call test.describe() and crash the vitest collector ("did not expect
    // test.describe() to be called here"). An exclude-only list fails loudly: a new
    // Playwright folder crashes the run until it is excluded here, whereas an include
    // list of unit-test roots would drop a new unit-test folder silently -- which is how
    // the old tests/** exclude (since 583107cf) hid every tests/unit file from the run.
    exclude: [
      ...configDefaults.exclude,
      'dist/**',
      'tests/e2e/**',
      'tests/manuales/**',
      'tests/fixtures/**',
    ],
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
