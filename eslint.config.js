import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Deferred to track "lint-cleanup-2" (separate plan):
//   - 92x react-refresh/only-export-components (barrel-export refactor)
//   - 39x @typescript-eslint/no-explicit-any in src/ (typing audit)
//   - 8x react-hooks/incompatible-library (third-party compat)
//   - 1x react-hooks/purity, 1x react-hooks/immutability (case-by-case)
export default defineConfig([
  globalIgnores(['dist']),
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
])
