# CLAUDE.md

## Project Overview

Asterisk.Platform.Web is the React 19 UI for the omnichannel contact center platform. It provides admin configuration, real-time operations monitoring, historical analytics, and an agent workspace.

**263 TS/TSX files, 52 pages, 38 API hooks, 20 UI components, 39 E2E spec files (202 tests)**

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

**38 TanStack Query hooks** in `src/core/api/hooks/`:
- `use-agents`, `use-analytics`, `use-audit`, `use-auth-admin`, `use-billing`, `use-bots`, `use-caller-id-pools`, `use-campaigns`, `use-channels`, `use-cluster`, `use-contacts`, `use-conversations`, `use-dialer-settings`, `use-dispositions`, `use-dnc-lists`, `use-endpoint-profiles`, `use-flows`, `use-gdpr`, `use-holiday-calendars`, `use-knowledge`, `use-media`, `use-queue-members`, `use-queue-metrics`, `use-queues`, `use-rbac`, `use-reports`, `use-routes`, `use-skills`, `use-supervisor`, `use-surveys`, `use-system`, `use-teams`, `use-tenants`, `use-trunks`, `use-users`, `use-agent-assist`, `use-webhooks`, `use-impersonation`

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

## v1.3.0 "Integration & Compliance" Frontend — COMPLETE (2026-04-01)

Syncs Platform.Web with backend v1.3.0 (4 sub-projects: license enforcement, OIDC SSO, GDPR, webhooks).

### Sub-project 30E-A: OIDC Callback + License Fix (CRITICAL)
- **OIDC callback rewrite** — Backend now redirects to `#oidc_callback&access_token=...` URL fragment instead of `?token=` query param. Rewrote login-page.tsx to parse hash fragment, removed dead `POST /api/auth/oidc/complete` call
- **SSO button fix** — Added `tenant_id` and `return_url` params to OIDC login redirect
- **License DTO alignment** — Updated LicenseInfo type from `{tier,features,maxAgents}` to `{isValid,licenseId,licensee,status,expiresAt,licensedFeatures[],maxNodes,lastValidatedAt}`. Rewrote license-card.tsx with status-based styling
- **API path migration** — `/api/admin/system/*` → `/api/management/system/*` (info, license, settings)
- **Diagnostics fix** — Updated field references (tenantId→hostTenantId, tier→status, maxAgents→maxNodes)

### Sub-project 30E-B: Webhook Subscriptions
- **use-webhooks.ts** — 11 hooks (subscription CRUD, test, rotate secret, deliveries, event types, DLQ)
- **webhooks-page.tsx** — DataTable with CRUD, status badges, event type count
- **webhook-form.tsx** — Sheet form with Zod validation, HTTPS-only URL, event type multi-select, one-time secret display
- **webhook-detail-sheet.tsx** — Detail view with delivery log, rotate secret, send test

### Sub-project 30E-C: GDPR Compliance
- **use-gdpr.ts** — 5 hooks (export, purge, purge-log, retention CRUD)
- **gdpr-page.tsx** — Data export (JSON download) + data purge (3s confirmation) for tenant admins
- **purge-log-page.tsx** — Purge history DataTable with tenant/date filters
- **retention-policy-section.tsx** — Sheet form for per-tenant retention policies (conversations, auth events, audit, usage records)

### Sub-project 30E-D: Dead Letter Queue
- **dead-letter-page.tsx** — DLQ management with retry per delivery, tenant-scoped pagination

### Integration
- **sidebar.tsx** — Added "Integrations" group (Webhooks, Dead Letter) + GDPR/Purge Log to "Compliance" group
- **router.tsx** — 4 new routes (`/admin/webhooks`, `/admin/webhooks/dead-letter`, `/admin/gdpr`, `/admin/purge-log`)
- **tenants-page.tsx** — Added "Retention Policy" action button per tenant row

New files: 10 (3 hooks, 7 pages/components)
Modified files: 9 (login-page, license-card, system-page, diagnostics, use-system, sidebar, router, tenants-page, package.json)

## E2E Sprint 1.5: v1.3.0 Coverage — COMPLETE (2026-04-01)

Fixed 6 broken E2E tests + added 29 new tests across 5 new spec files for v1.3.0 pages:

### Broken Test Fixes
- **system-settings.spec.ts** — Fixed license card assertion (`/tier/i` → `/status|valid|expired|license/i`), removed 3 cluster tests (moved to /admin/cluster)
- **diagnostics.spec.ts** — Fixed license assertion, rewrote cluster nodes test to use StatusCard (`diag-cluster-card`)
- **billing-rate-cards.spec.ts** — Fixed ConfirmDeleteDialog testid (`confirm-dialog-confirm` → `confirm-delete-btn`)
- **confirm-delete-dialog.tsx** — Added `data-testid="confirm-delete-btn"` to destructive Button

### New Spec Files (5 files, 29 tests)
- **webhooks.spec.ts** (10 tests) — CRUD, detail sheet, test/rotate, one-time secret dialog, sidebar nav
- **dead-letter.spec.ts** (4 tests) — Page display, empty state, tenant search, sidebar nav
- **gdpr.spec.ts** (6 tests) — Export/purge sections, button state validation, reason validation, sidebar nav
- **purge-log.spec.ts** (4 tests) — Page display, filter controls, tenant filter, sidebar nav
- **retention-policy.spec.ts** (5 tests) — Sheet open via tenants, toggle fields, save + API verify, sidebar nav

### ApiHelper Extensions
- 5 new methods: `createWebhookSubscription`, `listWebhookSubscriptions`, `deleteWebhookSubscription`, `getRetentionPolicy`, `updateRetentionPolicy`

Result: 90 → 116 tests, 14 → 19 spec files

## E2E Sprint 2: Tenant Administration — COMPLETE (2026-04-01)

Added data-testid instrumentation to ~30 admin pages + 20 new spec files covering all tenant admin pages:

### Data-testid Instrumentation (~30 files)
Added `data-testid` attributes to: users-page, user-form, user-detail, agents-page, teams-page, roles-page, role-detail-page, channels-page, queues-page, queue-form, skills-page, skill-form, flows-page, campaigns-page, surveys-page, survey-form, trunks-page, trunk-form, routes-page, route-form, caller-id-pools-page, dnc-lists-page, holiday-calendars-page, bots-page, bot-form, kb-list-page, kb-form, dialer-settings-page, realtime-page, reports-page

### ApiHelper Extensions (42 new methods)
CRUD methods for: Users (3), Teams (3), Roles (4 incl clone), Queues (3), Skills (3), Flows (2), Surveys (3), Trunks (3), Routes (3), Caller ID Pools (3), DNC Lists (3), Holiday Calendars (3), Bots (3), Knowledge Base (3), Reports (2)

### New Spec Files (20 files, 86 tests)
- **users.spec.ts** (8 tests) — CRUD, validation, detail page, edit, sidebar
- **agents.spec.ts** (5 tests) — Page display, data table, search, detail nav, sidebar
- **teams.spec.ts** (6 tests) — CRUD with Dialog form, instant ConfirmDialog, search, sidebar
- **roles.spec.ts** (5 tests) — Create, clone, delete (instant confirm), detail nav
- **channels.spec.ts** (3 tests) — Page display, channel cards, sidebar
- **queues.spec.ts** (6 tests) — CRUD, search, detail nav, sidebar
- **skills.spec.ts** (5 tests) — CRUD, window.confirm() delete, search, sidebar
- **flows.spec.ts** (4 tests) — Page display, data table, designer nav, sidebar
- **campaigns.spec.ts** (3 tests) — Page display, wizard nav, sidebar
- **surveys.spec.ts** (4 tests) — Create, delete 3s, sidebar
- **trunks.spec.ts** (7 tests) — CRUD, custom search, active filter, delete 3s, sidebar
- **routes.spec.ts** (5 tests) — Sortable table, CRUD (trunk dependency), delete 3s, sidebar
- **caller-id-pools.spec.ts** (4 tests) — CRUD, delete 3s, sidebar
- **dnc-lists.spec.ts** (4 tests) — CRUD, delete 3s, sidebar
- **holiday-calendars.spec.ts** (4 tests) — CRUD, delete 3s, sidebar
- **bots.spec.ts** (4 tests) — CRUD, delete 3s, sidebar
- **knowledge-base.spec.ts** (4 tests) — CRUD, window.confirm() delete, sidebar
- **dialer-settings.spec.ts** (2 tests) — Page display, sidebar
- **realtime.spec.ts** (2 tests) — Page display, sidebar
- **reports.spec.ts** (1 test) — Page display

Result: 116 → 202 tests, 19 → 39 spec files

## Plan Execution

**Always use Subagent-Driven Development** with risk-weighted batching (FCM pattern):
- Phase A: Foundation (scaffolding, models) — batch
- Phase B: Critical components (serializers, calculators) — individual focused subagents
- Phase C: Integration (DI, storage, wiring) — batch
