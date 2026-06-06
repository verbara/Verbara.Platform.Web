# CLAUDE.md

> **Planning split (updated 2026-05-03):**
>
> - **Web-only tracks** (i18n, lint, UX, frontend features) live in this repo's `docs/plans/`. The v1.14.x Operational Foundation roadmap is the authoritative source for Web work.
> - **Cross-cutting tracks** that span API + Web (e.g. auth-hotpath-hardening, R5.5 production validation) continue under `/media/Data/Source/Verbara/Verbara.Platform/docs/plans/`.
> - The previous note (2026-04-19) directing all planning to Platform is superseded for Web-only work; the v1.13.x i18n closure already shipped Web-authored plans/specs/ADRs successfully.

## Project Overview

Verbara.Platform.Web — React 19 UI for the omnichannel contact center platform. Admin configuration, real-time operations monitoring, historical analytics, and an agent workspace.

**~375 TS/TSX files · 60+ pages · 56 API hooks · 41 UI components · 12 Zustand stores · 67+ E2E specs · 1244/1244 Vitest · Version 3.1.3** (Niveles 1-7 CLOSED — ROADMAP COMPLETE 🎉). Post-roadmap: Session/Auth Overhaul **W1+W2** ✅ SHIPPED 2026-06-05 (agent-aware idle-timeout + refresh-cookie fix; new `src/core/session/*`; PR #75 merged) — see [ADR-0009](docs/decisions/0009-agent-presence-session-work-continuity.md). Session/Auth **W3** (server-side agent liveness / anti-zombie: heartbeat + TTL + leader-gated reaper + `pagehide` departure beacon; new `src/core/presence/*`) ✅ SHIPPED 2026-06-06 — see [ADR-0009](docs/decisions/0009-agent-presence-session-work-continuity.md) + [W3 spec](docs/specs/2026-06-06-w3-agent-liveness.md). Session/Auth **W4** (deferred pause / pause-when-free: agent `PendingState` blocks new work immediately but the visible state only flips once active work drains, via a leader-gated drain sweep; pending UX + casing fix in `agent-status-selector`) ✅ SHIPPED 2026-06-06 — see [ADR-0009](docs/decisions/0009-agent-presence-session-work-continuity.md) + [W4 spec](docs/specs/2026-06-06-w4-deferred-pause.md); W5–W6 north-star pending.

Niveles 1-7 complete (tags `v1.14.5-web` through `v3.0.1-web`). **Track 7C-polish (`v3.0.1-web`)** cerró 12 gaps de auditoría post-ship del v3.0.0 (theming inyectado real, attachments propagation, offline queue drain, message cache localStorage para resume, sound toggle UI funcional, focus-on-open, conversation timeout 5min, favicon badge, reduced-motion en iframe, pre-chat a11y Track 5C parity, Sentry breadcrumbs, virtualización de message-list). **Bloqueados por backend** (tracked aparte): availability/office-hours endpoint, history endpoint, tenant config endpoint, `CreateSessionRequest` field acceptance.

**Roadmap status: COMPLETE.** All 25 tracks across 7 niveles shipped. Production-readiness: 60/100 (pre-roadmap) → ~98/100 (post-roadmap). Future work tracked separately as enhancement requests (file uploads, voice/video, NPM package, external CDN, etc.).

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
| TypeScript            | 6.0.x (strict mode)                           |
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
| Lucide React          | 1.14.x                                        |
| i18next               | 26.0.x                                        |
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

31 components in [src/core/ui/](src/core/ui/) (includes `Skeleton`, `PageSkeleton`, `LoadingOverlay` added in Track 5A). Styling: TailwindCSS v4 + `cva` + `tailwind-merge` + `clsx`. Per-area error boundaries on each layout shell ([ADR-0002](docs/decisions/0002-area-error-boundary-pattern.md)).

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
