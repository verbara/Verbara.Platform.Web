import js from '@eslint/js';
import globals from 'globals';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

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
      // jsx-a11y recommended preset — demoted to warn during the rollout
      // sweep (Track 5C-a11y task 2). Promoted back to error in task 4
      // once all baseline violations are resolved.
      ...Object.fromEntries(
        Object.entries(jsxA11y.configs.recommended.rules).map(([rule, level]) => {
          if (Array.isArray(level)) {
            const [, ...rest] = level;
            return [rule, ['warn', ...rest]];
          }
          return [rule, level === 'error' || level === 2 ? 'warn' : level];
        }),
      ),
    },
  },
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
