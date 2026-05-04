# CLAUDE.md

> **Planning split (updated 2026-05-03):**
>
> - **Web-only tracks** (i18n, lint, UX, frontend features) live in this repo's `docs/plans/`. The v1.14.x Operational Foundation roadmap is the authoritative source for Web work.
> - **Cross-cutting tracks** that span API + Web (e.g. auth-hotpath-hardening, R5.5 production validation) continue under `/media/Data/Source/IPcom/Asterisk.Platform/docs/plans/`.
> - The previous note (2026-04-19) directing all planning to Platform is superseded for Web-only work; the v1.13.x i18n closure already shipped Web-authored plans/specs/ADRs successfully.

## Project Overview

Asterisk.Platform.Web — React 19 UI for the omnichannel contact center platform. Admin configuration, real-time operations monitoring, historical analytics, and an agent workspace.

**~330 TS/TSX files · 60+ pages · 54 API hooks · 28 UI components · 12 Zustand stores · 64+ E2E specs · 800/800 Vitest · Version 1.15.5** (Nivel 2 Quality Foundation closed).

Nivel 1 (Operational Foundation, `v1.14.0`..`v1.14.5`, tag `v1.14.5-web`) and Nivel 2 (Quality Foundation, `v1.15.0`..`v1.15.5`, tag `v1.15.5-web`) are complete. Coverage: 28% statements, hooks dir 91.58% lines. Shell bundle 114 kB (-86% from pre-split). Zero npm vulnerabilities.

**Next track: Nivel 3 — Code Quality** (`v1.16.x`). See [`docs/plans/active/2026-05-03-v1.14.x-operational-foundation-roadmap.md`](docs/plans/active/2026-05-03-v1.14.x-operational-foundation-roadmap.md). Track 3A: lint-cleanup-2 (111 ESLint errors → 0). Track 3B: typescript-strict-2 (eliminate `as any` casts).

See [`docs/plans/completed/`](docs/plans/completed/) for delivery history; earlier milestones are in `git log`. Architectural decisions in [`docs/decisions/`](docs/decisions/).

## Documentation Layout (all git-tracked, private repo)

| Folder                    | Purpose                                             | Lifecycle                               |
| ------------------------- | --------------------------------------------------- | --------------------------------------- |
| `docs/specs/`             | Technical designs (input to implementation)         | Add on new feature, rarely edited after |
| `docs/specs/archived/`    | Superseded / draft specs kept for history           | Append-only                             |
| `docs/decisions/`         | ADRs — architecture decision records (why, not how) | Append-only; never delete               |
| `docs/plans/active/`      | Execution plans currently in progress               | Moves to `completed/` on ship           |
| `docs/plans/completed/`   | Shipped plans, preserved as historical record       | Append-only                             |
| `docs/plans/archived/`    | Skeletons / superseded / abandoned plans            | Append-only                             |
| `docs/research/`          | Exploratory findings, market analysis, discovery    | Freeform                                |
| `docs/research/archived/` | Older research kept for context                     | Append-only                             |

After `ExitPlanMode` approval, copy the system-path plan file (`~/.claude/plans/*.md`) into `docs/plans/active/` with a date-prefixed meaningful name — the repo is authoritative. When the plan ships, `git mv` it to `docs/plans/completed/`.

ADR numbering is sequential (`0001`, `0002`, …). Once `Accepted`, ADRs are append-only — supersede with a new ADR that references the predecessor.

## Stack

| Library               | Version                                       |
| --------------------- | --------------------------------------------- |
| React                 | 19.2.x                                        |
| TypeScript            | 5.9.x (strict mode)                           |
| Vite                  | 8.0.x                                         |
| TailwindCSS           | 4.2.x (via `@tailwindcss/vite`)               |
| shadcn/ui             | 4.1.x (`@base-ui/react` 1.3.x, **NOT Radix**) |
| TanStack Query        | 5.95.x                                        |
| TanStack Table        | 8.21.x                                        |
| React Router          | 7.13.x                                        |
| Zustand               | 5.0.x                                         |
| React Hook Form + Zod | 7.72.x / 4.3.x                                |
| Recharts              | 3.8.x                                         |
| AG Grid               | 35.1.x                                        |
| XY Flow               | 12.10.x (flow designer)                       |
| dnd-kit               | core 6.3.x / sortable 10.0.x                  |
| Lucide React          | 0.577.x                                       |
| i18next               | 25.10.x                                       |
| date-fns              | 4.1.x                                         |
| Vitest                | 4.1.x                                         |
| Testing Library       | React 16.3.x                                  |
| Node (Docker)         | 22-alpine                                     |

## Build & Test

```sh
npm run dev          # Dev server (proxies /api/v1 to localhost:5000)
npm run build        # Type-check + production build
npm run test         # Unit tests (Vitest, excludes tests/e2e/**)
npx playwright test  # E2E tests (requires running demo backend)
npm run lint         # ESLint 9 flat config
npm run preview      # Preview production build
```

## Project Structure

```
src/
  admin/         — Admin sections (users, agents, queues, campaigns, flows, billing, …)
  agent/         — Agent workspace (inbox, conversation, AI assist, stores, tour)
  analytics/     — Historical analytics (dashboard, CDR, QA, surveys)
  operations/    — Real-time monitoring (wallboard, agent states, campaign monitor, stores)
  pages/         — Layout shells (admin, agent, analytics, operations) + unauthorized
  shell/         — App shell, rail nav, command palette, notifications, user menu
  core/
    api/client.ts     — customFetch with JWT auto-refresh + tenant header
    api/hooks/        — TanStack Query hooks (one per domain)
    auth/             — AuthGuard, PermissionGuard, auth pages, auth-store
    i18n/, stores/, tenant/, ui/, hooks/, error-boundary.tsx
  lib/utils.ts   — cn() helper
  app.tsx, main.tsx, router.tsx, index.css
```

## Routing

4 layout areas, all behind `AuthGuard`. Every route uses `lazy()` + `<Suspense>` for code splitting.

| Layout         | Path            | Permission Guard (requiresAny)                                                                                        |
| -------------- | --------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Admin**      | `/admin/*`      | `users:user:view` · `queues:queue:view` · `campaigns:campaign:view` · `routing:flow:view` · `system:tenant:configure` |
| **Operations** | `/operations/*` | `reporting:realtime:view` · `contacts:conversation:monitor`                                                           |
| **Analytics**  | `/analytics/*`  | `analytics:cdr:view` · `reporting:historical:view`                                                                    |
| **Agent**      | `/agent/*`      | `contacts:conversation:handle`                                                                                        |

Public routes: `/login`, `/forgot-password`, `/reset-password`, `/unauthorized`

## API Layer

`customFetch<T>()` in [src/core/api/client.ts](src/core/api/client.ts):

- Adds `Authorization: Bearer <JWT>` + `X-Tenant-Id` (from tenant store) headers
- Pre-flight token refresh when expired; deduplicates concurrent refreshes
- On 401: single refresh attempt, then redirects to `/login`
- All API paths use the `/api/v1` prefix (migrated from `/api` in v1.3.1)
- Dev proxy: Vite forwards `/api/v1` → `http://localhost:5000`

Hooks live in [src/core/api/hooks/](src/core/api/hooks/) — one per domain, naming `use-<domain>.ts`.

## State Management

11 Zustand stores total across `core/`, `agent/`, and `operations/`. Architectural ones to know about:

| Store                 | Location                 | Purpose                                                                  |
| --------------------- | ------------------------ | ------------------------------------------------------------------------ |
| `auth-store`          | `src/core/auth/`         | JWT tokens, user, tenant, permissions, expiry check, impersonation state |
| `tenant-store`        | `src/core/tenant/`       | Active tenant ID for multi-tenant context switching                      |
| `conversation-store`  | `src/agent/stores/`      | Active conversations, selection, message state                           |
| `queue-metrics-store` | `src/operations/stores/` | Real-time queue metrics                                                  |

Feature-scoped stores: `draft-store`, `agent-ai-store`, `agent-alerts-store`, `notification-store`, `ui-store`, `analytics-filter-store`, `agent-state-store`, `campaign-metrics-store`.

## UI Components

**CRITICAL: shadcn/ui v4 uses `@base-ui/react`, NOT Radix.** Use `render` prop, NOT `asChild`.

```tsx
// CORRECT (base-ui render prop)
<Dialog.Trigger render={<Button />} />

// WRONG (Radix asChild — does NOT work in v4)
<Dialog.Trigger asChild><Button /></Dialog.Trigger>
```

28 components in [src/core/ui/](src/core/ui/). Styling: TailwindCSS v4 + `cva` + `tailwind-merge` + `clsx`. Per-area error boundaries on each layout shell ([ADR-0002](docs/decisions/0002-area-error-boundary-pattern.md)).

## Auth & RBAC

- `AuthGuard` wraps all authenticated routes, redirects to `/login`
- `PermissionGuard` — route-level; supports `requires` (single) or `requiresAny` (array)
- `RoleGuard` — role-based route protection
- `useHasPermission` — hook for conditional UI rendering
- Permission format: `domain:resource:action` (e.g. `queues:queue:view`)
- MFA (TOTP) via `mfa-verify.tsx`; password recovery via forgot-password + reset-password

## Docker

Multi-stage (`Dockerfile`): build with `node:22-alpine` (`npm ci` + `npm run build`), serve with `nginx:alpine` using custom `nginx.conf`. Exposed on port 80.

## Code Conventions

- **No `Co-Authored-By` in commits**; Conventional Commits (`feat:`, `fix:`, `docs:`, etc.)
- TypeScript strict mode: `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`
- TailwindCSS v4 only — no CSS modules, no styled-components
- Path alias: `@/` → `src/`
- All routes lazy-loaded with `React.lazy()` + `<Suspense>`
- Forms: React Hook Form + Zod via `@hookform/resolvers`
- Icons: Lucide React exclusively
- Delete confirmations use the 3-second delay pattern (`confirm-delete-dialog`)
- Drag-and-drop: `@dnd-kit` for sortable lists
- No company-specific references in code — generic product

## Plan Execution

**Always use Subagent-Driven Development** with risk-weighted batching (FCM pattern):

- Phase A: Foundation (scaffolding, models) — batch
- Phase B: Critical components (serializers, calculators) — individual focused subagents
- Phase C: Integration (DI, storage, wiring) — batch

## Versioning

[ADR-0005](docs/decisions/0005-versioning-track-end-tags.md): patches inside a track ship without git tags. Only the **last patch of a track** receives an annotated tag (`v<version>-web`) and a GitHub release whose notes summarize the whole track. The v1.13.x i18n closure (5 patches `1.13.33`..`1.13.37` → tag `v1.13.37-web`) is the canonical example.

## i18n parity (CI gate)

Every key in `public/locales/es-419/*.json` must exist in `public/locales/en-US/*.json` and `public/locales/pt-BR/*.json` (and vice versa). Enforced by [`scripts/i18n-parity-check.mjs`](scripts/i18n-parity-check.mjs); `npm run lint` runs both ESLint and `npm run i18n:check`. Drift fails CI. See [ADR-0001](docs/decisions/0001-i18n-parity-ci-gate.md).
