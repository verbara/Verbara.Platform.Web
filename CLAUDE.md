# CLAUDE.md

## Project Overview

Asterisk.Platform.Web is the React 19 UI for the omnichannel contact center platform. It provides admin configuration, real-time operations monitoring, historical analytics, and an agent workspace.

**253 TS/TSX files, 48 pages, 35 API hooks, 20 UI components, 14 E2E spec files (90 tests)**

## Stack

| Library | Version |
|---------|---------|
| React | 19.2.x |
| TypeScript | 5.9.x (strict mode) |
| Vite | 8.0.x |
| TailwindCSS | 4.2.x (via `@tailwindcss/vite`) |
| shadcn/ui | 4.1.x (`@base-ui/react` 1.3.x, **NOT Radix**) |
| TanStack Query | 5.95.x |
| TanStack Table | 8.21.x |
| React Router | 7.13.x |
| Zustand | 5.0.x |
| React Hook Form + Zod | 7.72.x / 4.3.x |
| Recharts | 3.8.x |
| AG Grid | 35.1.x |
| XY Flow | 12.10.x (flow designer) |
| dnd-kit | core 6.3.x / sortable 10.0.x |
| Lucide React | 0.577.x (icons) |
| i18next | 25.10.x |
| date-fns | 4.1.x |
| Vitest | 4.1.x |
| Testing Library | React 16.3.x |
| Node (Docker) | 22-alpine |

## Build & Test

```sh
# Dev server (proxies /api to localhost:5000)
npm run dev

# Type-check + production build
npm run build

# Run tests
npm run test

# Lint (ESLint 9 flat config)
npm run lint

# Preview production build
npm run preview
```

## Project Structure

```
src/
  admin/           — 28 admin sections (users, agents, queues, campaigns, flows, billing, etc.)
    shared/        — Shared admin components
    sidebar.tsx    — Admin navigation sidebar
  agent/           — Agent workspace (inbox, conversation, AI assist, tours)
    context/       — Agent React contexts
    conversation/  — Conversation view components
    inbox/         — Inbox list
    stores/        — Agent Zustand stores (conversation, draft, AI)
    tour/          — Agent onboarding tour
  analytics/       — Historical analytics (dashboard, CDR, QA, intervals, surveys)
  operations/      — Real-time monitoring (wallboard, agent states, campaign monitor)
    stores/        — Operations Zustand stores (queue metrics, agent state, campaign metrics)
  pages/           — Layout shells (admin, agent, analytics, operations) + unauthorized
  shell/           — App shell, rail navigation, command palette, notifications, user menu
  core/
    api/
      client.ts    — Custom fetch with JWT auto-refresh + tenant header
      hooks/       — 34 TanStack Query hooks (one per domain)
    auth/          — AuthGuard, PermissionGuard, login/MFA/forgot-password, auth store
    hooks/         — Core hooks (use-config, use-sse)
    i18n/          — i18next setup + useFormat
    stores/        — Core Zustand stores (notification, UI)
    tenant/        — Tenant store (multi-tenant context switching)
    ui/            — 20 shadcn/ui components (button, dialog, dropdown, tabs, etc.)
    error-boundary.tsx
  lib/
    utils.ts       — Utility functions (cn, etc.)
  assets/          — Static assets
  test/            — Test setup and utilities
  app.tsx          — App root (QueryClientProvider, ThemeProvider, RouterProvider)
  main.tsx         — Entry point
  router.tsx       — All routes with lazy loading + PermissionGuard
  index.css        — TailwindCSS v4 entry
```

## Routing

4 layout areas, all behind `AuthGuard`. Every route uses `lazy()` + `<Suspense>` for code splitting.

| Layout | Path | Purpose | Permission Guard |
|--------|------|---------|-----------------|
| **Admin** | `/admin/*` | Configuration (31 sub-routes) | `users:user:view` or `queues:queue:view` or `campaigns:campaign:view` or `routing:flow:view` or `system:tenant:configure` |
| **Operations** | `/operations/*` | Real-time monitoring (4 sub-routes) | `reporting:realtime:view` or `contacts:conversation:monitor` |
| **Analytics** | `/analytics/*` | Historical reports (6 sub-routes) | `analytics:cdr:view` or `reporting:historical:view` |
| **Agent** | `/agent/*` | Agent workspace (2 sub-routes) | `contacts:conversation:handle` |

Public routes: `/login`, `/forgot-password`, `/reset-password`, `/unauthorized`

## API Layer

Custom `customFetch<T>()` in `src/core/api/client.ts`:
- Wraps native `fetch` with JWT `Authorization: Bearer` header
- Adds `X-Tenant-Id` header from tenant store
- Pre-flight token refresh when expired (deduplicates concurrent refreshes)
- On 401: attempts single refresh, then redirects to `/login`
- Dev proxy: Vite forwards `/api` to `http://localhost:5000`

**35 TanStack Query hooks** in `src/core/api/hooks/`:
- `use-agents`, `use-analytics`, `use-audit`, `use-auth-admin`, `use-billing`, `use-bots`, `use-caller-id-pools`, `use-campaigns`, `use-channels`, `use-cluster`, `use-contacts`, `use-conversations`, `use-dialer-settings`, `use-dispositions`, `use-dnc-lists`, `use-endpoint-profiles`, `use-flows`, `use-holiday-calendars`, `use-knowledge`, `use-media`, `use-queue-members`, `use-queue-metrics`, `use-queues`, `use-rbac`, `use-reports`, `use-routes`, `use-skills`, `use-supervisor`, `use-surveys`, `use-system`, `use-teams`, `use-tenants`, `use-trunks`, `use-users`, `use-agent-assist`

## State Management

Zustand stores (8 total):

| Store | Location | Purpose |
|-------|----------|---------|
| `auth-store` | `core/auth/` | JWT tokens, user, tenant, permissions, token expiry check |
| `tenant-store` | `core/tenant/` | Active tenant ID for multi-tenant context switching |
| `notification-store` | `core/stores/` | Toast/notification queue |
| `ui-store` | `core/stores/` | UI state (sidebar collapsed, theme, etc.) |
| `conversation-store` | `agent/stores/` | Active conversations, selection, message state |
| `draft-store` | `agent/stores/` | Message drafts per conversation |
| `agent-ai-store` | `agent/stores/` | Agent assist AI suggestions and state |
| `agent-state-store` | `operations/stores/` | Real-time agent state tracking |
| `queue-metrics-store` | `operations/stores/` | Real-time queue metrics |
| `campaign-metrics-store` | `operations/stores/` | Real-time campaign metrics |

## UI Components

**CRITICAL: shadcn/ui v4 uses `@base-ui/react`, NOT Radix.** Use `render` prop, NOT `asChild`.

```tsx
// CORRECT (base-ui render prop)
<Dialog.Trigger render={<Button />} />

// WRONG (Radix asChild — does NOT work in v4)
<Dialog.Trigger asChild><Button /></Dialog.Trigger>
```

20 components in `src/core/ui/`: avatar, badge, button, checkbox, command, confirm-delete-dialog, dialog, dropdown-menu, input, input-group, label, select, separator, sheet, sonner, switch, tabs, textarea, tooltip, audit-timeline

Styling: TailwindCSS v4 + `class-variance-authority` (cva) + `tailwind-merge` (tw-merge) + `clsx`

## Auth & RBAC

- `AuthGuard` — wraps all authenticated routes, redirects to `/login`
- `PermissionGuard` — route-level, supports `requires` (single) and `requiresAny` (array)
- `RoleGuard` — role-based route protection
- `useHasPermission` — hook for conditional UI rendering
- Permission format: `domain:resource:action` (e.g., `queues:queue:view`, `system:auth:configure`)
- MFA: TOTP verification via `mfa-verify.tsx`
- Password recovery: forgot-password + reset-password flows

## Docker

Multi-stage build (`Dockerfile`):
1. **Build stage**: `node:22-alpine` — `npm ci` + `npm run build`
2. **Serve stage**: `nginx:alpine` — copies `dist/` to nginx html, uses custom `nginx.conf`

Exposed on port 80.

## Code Conventions

- **No `Co-Authored-By` in commits**
- Conventional Commits format (`feat:`, `fix:`, `docs:`, etc.)
- TypeScript strict mode (`strict: true`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`)
- TailwindCSS v4 for all styling — no CSS modules, no styled-components
- Path alias: `@/` maps to `src/`
- All routes lazy-loaded with `React.lazy()` + `<Suspense>`
- Forms: React Hook Form + Zod validation + `@hookform/resolvers`
- Icons: Lucide React exclusively
- Delete confirmations use 3-second delay pattern (`confirm-delete-dialog`)
- Drag-and-drop: `@dnd-kit` for sortable lists (routes, etc.)
- No company-specific references in code — generic product

## Current Version

**v1.1.0 "Enterprise Ready" — COMPLETE**

Three pillars delivered:
1. **Auth Enterprise** — Email/Password + JWT(RS256) + MFA(TOTP) + OIDC SSO + API Keys(M2M) + Auth Audit + Sessions + Lockout + Password Policies
2. **RBAC Granular** — 52 permissions (`domain:resource:action`), 7 templates, custom roles per-tenant, PermissionGuard
3. **UI Completion** — All 34 hooks wired, delete confirmations, route drag-and-drop, bulk import, diagnostics, audit trail

## v1.2.0 Billing Frontend — COMPLETE (2026-03-31)

4 billing management pages + 1 API hooks file + 1 form component:
1. **Rate Cards** — CRUD page with DataTable, Sheet form with useFieldArray for rate entries, delete with 3s confirmation
2. **Invoices** — List with generate dialog, detail Sheet with line items, issue action (Draft→Issued)
3. **Usage Dashboard** — Summary bar chart (Recharts), stat cards, detailed records table with date/type filters
4. **Quotas** — Status display with color-coded progress bars (green/yellow/red at 0/70/90%), edit Sheet form

All under `/admin/billing/*`, guarded by `system:tenant:configure` permission. Sidebar group "Billing" with 4 items.

## v1.2.1 Operations Frontend — COMPLETE (2026-03-31)

Two deliverables:

1. **Plan 29D: Impersonation UI** — useImpersonate/useEndImpersonate hooks in `use-impersonation.ts`, auth store with impersonation state (save/restore original token), ImpersonationBanner component with countdown timer
2. **Plan 29E: Cluster UI** — Dedicated `/admin/cluster` page (cluster-page.tsx) with DataTable, summary cards, CRUD sheets (add/edit node), drain dialog, ConfirmDeleteDialog for remove/force, active drains section (amber), platform instances section. Rewrote `use-cluster.ts` fixing path mismatch (`/api/admin/` → `/api/management/`). Sidebar entry with Network icon. Consolidated cluster info from diagnostics-page and system-page.

New files:
- `src/admin/cluster/cluster-page.tsx` — Cluster management page
- `src/core/api/hooks/use-impersonation.ts` — Impersonation hooks
- `src/shell/impersonation-banner.tsx` — Impersonation banner component

Modified files:
- `src/core/api/hooks/use-cluster.ts` — Rewritten with correct API paths
- `src/core/auth/auth-store.ts` — Impersonation state management
- `src/admin/sidebar.tsx` — Cluster sidebar entry

## Plan Execution

**Always use Subagent-Driven Development** with risk-weighted batching (FCM pattern):
- Phase A: Foundation (scaffolding, models) — batch
- Phase B: Critical components (serializers, calculators) — individual focused subagents
- Phase C: Integration (DI, storage, wiring) — batch
