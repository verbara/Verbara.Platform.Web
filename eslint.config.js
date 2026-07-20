import js from '@eslint/js';
import globals from 'globals';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

// ADR-0012 Ola 2 gate #4 — the four Web feature domains that must stay isolated
// from each other. Shared UI lives in @/core/ui, shared state in @/core/stores,
// shared infra in @/core / @/lib. A cross-domain import (admin↔agent↔analytics↔
// operations) is a layering leak; the audit found 14, all remediated by moving the
// shared primitives + the SSE-fed AI store into @/core.
const DOMAINS = ['admin', 'agent', 'analytics', 'operations'];
const domainIsolation = DOMAINS.map((domain) => ({
  files: [`src/${domain}/**/*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: DOMAINS.filter((other) => other !== domain).flatMap((other) => [
              `@/${other}`,
              `@/${other}/**`,
            ]),
            message:
              'Web domains stay isolated (ADR-0012 gate #4): admin/agent/analytics/operations must not import each other. Put shared UI in @/core/ui, shared state in @/core/stores, shared infra in @/core.',
          },
        ],
      },
    ],
  },
}));

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: { 'jsx-a11y': jsxA11y },
    rules: {
      // Allow `_`-prefixed identifiers as intentional-unused (idiomatic JS:
      // destructuring rest, cb args you must declare but don't read).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      // jsx-a11y recommended preset — at error level (CI gate).
      ...jsxA11y.configs.recommended.rules,
      // ADR-0012 Ola 2 gate #9 — orchestrator/components stay bounded. Frozen at
      // 1250 (just over the current largest hand-authored file, router.tsx at
      // 1178); ratchet DOWN as god-components are split. Generated types + tests
      // are exempt in the override below.
      'max-lines': ['error', 1250],
    },
  },
  {
    // gate #9 exemptions: generated types (openapi.d.ts is ~20k lines) and long
    // test files are not hand-authored orchestrators/components.
    files: [
      'src/core/api/generated/**',
      '**/*.d.ts',
      '**/*.test.{ts,tsx}',
      'tests/**',
      'src/test/**',
    ],
    rules: {
      'max-lines': 'off',
    },
  },
  ...domainIsolation,
  {
    // Playwright E2E fixtures use the `use` callback parameter, which the
    // react-hooks plugin mis-detects as a React hook. Tests also legitimately
    // type API helpers as `any` for flexibility — we type them surgically
    // when worth it but don't block the suite on it.
    files: ['tests/e2e/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // router.tsx is routing infrastructure (lazy() declarations + createBrowserRouter
    // config), not a React component — the refresh rule is semantically irrelevant.
    files: ['src/router.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
]);
