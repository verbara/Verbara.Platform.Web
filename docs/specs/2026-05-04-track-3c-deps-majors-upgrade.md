# Track 3C — deps-majors-upgrade

> Upgrade all deferred major dependencies, rename deprecated Lucide icon aliases, fix icon-only button accessibility, and remove dead type packages.

## Goal

Bring every major dependency to its current stable version, eliminate deprecated API usage, and close accessibility gaps introduced by the Lucide 1.x `aria-hidden` default. Ship as `v1.16.5`.

## Scope

### Major upgrades (6 packages)

| Package                | From        | To        | Code changes                                         |
| ---------------------- | ----------- | --------- | ---------------------------------------------------- |
| `typescript`           | `~5.9.3`    | `~6.0.3`  | None (all tsconfig options already explicit)         |
| `eslint`               | `^9.39.4`   | `^10.0.0` | Fix violations from 3 new `recommended` rules        |
| `@eslint/js`           | `^9.39.4`   | `^10.0.0` | None (co-upgrade with eslint)                        |
| `i18next`              | `^25.10.10` | `^26.0.0` | None (no `initImmediate`, no `interpolation.format`) |
| `react-i18next`        | `^16.6.6`   | `^17.0.0` | None (no deprecated APIs, simple Trans usage)        |
| `i18next-http-backend` | `^3.0.2`    | `^4.0.0`  | None (browser has native fetch)                      |
| `lucide-react`         | `^0.577.0`  | `^1.14.0` | Rename 33 deprecated aliases across 28 files         |

### Deprecated Lucide icon renames (33 imports across 28 files)

| Deprecated alias | Canonical name   | Files                                                                                                                                                                                                                                                     |
| ---------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AlertCircle`    | `CircleAlert`    | `message-bubble.tsx`, `notification-item.tsx`, `metrics-availability-banner.tsx`                                                                                                                                                                          |
| `AlertTriangle`  | `TriangleAlert`  | `compliance-alert.tsx`, `quotas-page.tsx`, `contacts-step.tsx`, `create-api-key-dialog.tsx`, `notification-item.tsx`, `license-card.tsx`, `dead-letter-page.tsx`, `license-page.tsx`, `gdpr-page.tsx`, `confirm-delete-dialog.tsx`, `regenerate-page.tsx` |
| `BarChart3`      | `ChartColumn`    | `rail.tsx`, `command-palette.tsx`, `analytics-sidebar.tsx`                                                                                                                                                                                                |
| `CheckCircle`    | `CircleCheckBig` | `inbox-empty.tsx`, `welcome-step.tsx`, `invoices-page.tsx`, `test-step.tsx`, `forgot-password-page.tsx`, `bot-analytics-card.tsx`, `reset-password-page.tsx`                                                                                              |
| `CheckCircle2`   | `CircleCheck`    | `contacts-step.tsx`, `dnc-import-wizard.tsx`, `dnc-list-detail.tsx`                                                                                                                                                                                       |
| `Loader2`        | `LoaderCircle`   | `channel-test-button.tsx`, `drawer-detail.tsx`                                                                                                                                                                                                            |
| `MoreHorizontal` | `Ellipsis`       | `agent-states-page.tsx`                                                                                                                                                                                                                                   |
| `XCircle`        | `CircleX`        | `dnc-list-detail.tsx`, `reset-password-page.tsx`, `bot-analytics-card.tsx`                                                                                                                                                                                |

Note: `ExternalLink` remains canonical — not renamed.

### Icon-only button accessibility (5 buttons in 2 files)

Lucide 1.14 sets `aria-hidden="true"` on all icons by default. Buttons that contain only an icon and no visible text become invisible to screen readers unless they have an explicit `aria-label`.

| File                         | Button                  | Current state                   | Fix                                                                                          |
| ---------------------------- | ----------------------- | ------------------------------- | -------------------------------------------------------------------------------------------- |
| `routes-page.tsx:83`         | Delete route            | No `aria-label`, no `title`     | Add `aria-label={t('admin:routes.delete_route')}` — **key must be created** in all 3 locales |
| `campaign-list-page.tsx:98`  | Start campaign (draft)  | Has `title` but no `aria-label` | Add `aria-label={t('admin:campaigns.start')}` — key exists                                   |
| `campaign-list-page.tsx:108` | Pause campaign          | Has `title` but no `aria-label` | Add `aria-label={t('admin:campaigns.pause')}` — key exists                                   |
| `campaign-list-page.tsx:118` | Start campaign (paused) | Has `title` but no `aria-label` | Add `aria-label={t('admin:campaigns.start')}` — key exists                                   |
| `campaign-list-page.tsx:128` | Stop campaign           | Has `title` but no `aria-label` | Add `aria-label={t('admin:campaigns.stop')}` — key exists                                    |

Note: `title` provides tooltip on hover but is NOT reliably announced by screen readers. `aria-label` is the standard accessible name mechanism.

New i18n key required (all 3 locales):

| Key                   | en-US          | es-419          | pt-BR          |
| --------------------- | -------------- | --------------- | -------------- |
| `routes.delete_route` | `Delete route` | `Eliminar ruta` | `Excluir rota` |

### Dead type package removal

| Package                    | Reason for removal                                                                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@types/dompurify` (3.2.0) | `dompurify` 3.3.3 bundles its own types at `dist/purify.cjs.d.ts`. The `@types/` package is redundant and incorrectly placed in `dependencies` instead of `devDependencies`. |

### tsconfig cleanup

| File                | Change                                   | Reason                                                                                 |
| ------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------- |
| `tsconfig.app.json` | Remove `"useDefineForClassFields": true` | Redundant — TS 6.0 defaults to `true` when `target >= ES2022`. Our target is `ES2023`. |

### Patch updates (semver-compatible)

| Package             | From   | To     |
| ------------------- | ------ | ------ |
| `zod`               | 4.4.2  | 4.4.3  |
| `msw`               | 2.14.2 | 2.14.3 |
| `typescript-eslint` | 8.59.1 | 8.59.2 |

## Excluded

| Item                                                                 | Reason                                                                                                                                              |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@types/node` 24 → 25                                                | Runtime is Node 22 (Docker + `.nvmrc`). `@types/node@24` matches dev machine (v24.11.1). Upgrading to 25 would type against a runtime we don't use. |
| `@dnd-kit`, `next-themes`, `cmdk`, `otplib`, `otpauth`               | Already at latest — no upgrade available.                                                                                                           |
| Brand icon imports                                                   | None used — verified by grep.                                                                                                                       |
| `import assert {}` syntax                                            | Not used anywhere — TS 6 deprecation does not apply.                                                                                                |
| Deprecated react-i18next APIs (`withTranslation`, `I18nextProvider`) | Not used — modern hooks only.                                                                                                                       |

## Compatibility matrix (verified)

| Tool                                  | TS 6 support    | ESLint 10 support                 |
| ------------------------------------- | --------------- | --------------------------------- |
| `typescript-eslint` 8.59.x            | ✅ since 8.58.0 | ✅ peerDep `^10.0.0`              |
| `eslint-plugin-react-hooks` 7.1.1     | N/A             | ✅ peerDep `^10.0.0`              |
| `eslint-plugin-react-refresh` 0.5.2   | N/A             | ✅ peerDep `^9 \|\| ^10`          |
| `globals` 17.6.0                      | N/A             | ✅ no change needed               |
| Vite 8.0 / `@vitejs/plugin-react` 6.x | ✅ uses Oxc     | N/A                               |
| Vitest 4.1.x                          | ✅ confirmed    | N/A                               |
| Node 22 (CI/Docker)                   | ✅              | ✅ requires ≥22.13.0, LTS exceeds |

## ESLint 10 new rules in `recommended`

Three rules added to `eslint:recommended` that may surface errors:

1. **`no-unassigned-vars`** — variables declared but never assigned a value.
2. **`no-useless-assignment`** — assignments whose value is never read (38 `let` declarations in prod code are potential targets).
3. **`preserve-caught-error`** — catch blocks that overwrite the error variable before reading it.

These are legitimate code quality improvements — each violation found is a real improvement to the product.

## Execution strategy

Staged by dependency chain. Each phase produces one commit with full verification (build + lint + 800/800 tests) before advancing.

| Phase         | Scope                                                                              | Risk            |
| ------------- | ---------------------------------------------------------------------------------- | --------------- |
| 1. Foundation | TypeScript 6.0 + tsconfig cleanup + semver range                                   | Minimal         |
| 2. Tooling    | ESLint 10 + @eslint/js 10 + fix new rule violations                                | Medium          |
| 3. Runtime    | i18next 26 + react-i18next 17 + i18next-http-backend 4                             | Minimal         |
| 4. UI         | Lucide 1.14 + rename 33 aliases in 28 files + aria-label on 5 buttons + 1 i18n key | Medium (volume) |
| 5. Cleanup    | Remove @types/dompurify + patch updates + version bump                             | Minimal         |

## Acceptance criteria

- `npm run build` passes (tsc -b + vite build)
- `npm run lint` passes (0 errors, 0 warnings)
- `npm run test` passes (800/800)
- `npm audit --audit-level=high` → 0 vulnerabilities
- `npm outdated` → 0 major upgrades pending (except `@types/node` 24→25, excluded by design)
- `grep -rn "AlertCircle\|AlertTriangle\|BarChart3\|CheckCircle\b\|CheckCircle2\|Loader2\|MoreHorizontal\|XCircle" src/ --include="*.tsx" --include="*.ts"` → 0 results
- All `size="icon"` buttons have explicit `aria-label`
- `@types/dompurify` not in `package.json`
- `useDefineForClassFields` not in `tsconfig.app.json`
- Version is `1.16.5`
