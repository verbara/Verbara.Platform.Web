# v1.6.1 "Product Integrity" — Design Spec

**Date:** 2026-04-11
**Scope:** Asterisk.Platform.Web (primary) + Asterisk.Platform (1 backend endpoint)
**Goal:** Fix all broken functionality, complete partially-implemented features, and improve UX quality before adding new features.

## Context

A deep product audit across 5 dimensions (frontend-backend coverage, incomplete code, UX flows, E2E tests, backend) revealed that the product has significantly more broken/incomplete features than the roadmap accounted for. Six URL mismatches cause silent 404s, three pages render non-functional filters, billing pages are unreachable for multi-tenant management, and OIDC SSO users get zero permissions.

This release fixes everything that is broken or half-done before proceeding with i18n (v1.6.2) and Partner Portal (v1.7.0).

## Inventory: 26 Items across 3 Categories

### Category A — Bugs (10 items)

#### A1. Tenants Hook URL Mismatch

**File:** `src/core/api/hooks/use-tenants.ts` (lines 44, 52, 61, 74, 88)
**Problem:** All 5 hooks call `/api/v1/admin/tenants`. Backend route is `/api/v1/management/tenants` (PlatformAdminOnly).
**Fix:** Replace `/admin/tenants` with `/management/tenants` in all 5 URLs.

#### A2. DNC Check URL/Method/Shape Mismatch

**File:** `src/core/api/hooks/use-dnc-lists.ts` (lines 166-169)
**Problem:** `useCheckDncNumber` calls `POST /api/v1/admin/dnc-lists/check` with `{ phoneNumber }` body. Backend is `GET /admin/dnc-lists/{id}/check/{phone}` — requires list ID in path, phone as path segment, GET method.
**Fix:** Change hook signature to `(listId: number, phoneNumber: string)`. Call `GET /api/v1/admin/dnc-lists/${listId}/check/${encodeURIComponent(phoneNumber)}` with no body. Update consumers to pass `listId`.

#### A3. Force Logout Endpoint Missing (Backend + Frontend)

**File:** `src/core/api/hooks/use-auth-admin.ts` (lines 129-132)
**Problem:** `useForceLogoutUser` calls `DELETE /api/v1/admin/auth/sessions/user/${userId}`. Backend only has `DELETE /admin/auth/sessions/{id}` (single session). No bulk-by-user endpoint exists.
**Backend fix:** Add `DELETE /admin/auth/sessions/by-user/{userId}` to `AuthAdminEndpoints.cs`. Implementation: call `IRefreshTokenStore.ListByUserIdAsync(userId)` then revoke all. AdminOnly auth.
**Frontend fix:** Update URL to `/api/v1/admin/auth/sessions/by-user/${userId}`.

#### A4. Report Toggle Calls Non-Existent PATCH

**File:** `src/core/api/hooks/use-reports.ts` (lines 86-101)
**Problem:** `useToggleReportActive` calls `PATCH /api/v1/admin/reports/${id}/activate`. No PATCH route exists. Backend has `PUT /{id}` (UpdateReport) which accepts `isActive`.
**Fix:** Remove `useToggleReportActive`. In `reports-page.tsx`, use `useUpdateReport` with `{ isActive: !current }` instead.

Additionally fix two type mismatches in the same file:
- `ScheduledReport.id`: `number` → `string` (backend uses GUID string)
- `ScheduledReport.schedule`: `ReportSchedule` union → `string` (backend uses cron expressions)

#### A5. Setup Wizard Uses Raw customFetch Instead of Hooks

**File:** `src/admin/setup/setup-wizard.tsx` (lines 76-128)
**Problem:** `handleNext()` calls `customFetch` directly for queue creation, agent creation, and channel enablement instead of using the existing hooks from `use-onboarding.ts` (`useCompleteOnboarding`, `useApplyTemplate`). The `handleFinish()` correctly uses `useCompleteOnboarding` but the step submissions bypass the hook layer, duplicating logic and missing query invalidation.
**Fix:** Refactor step submissions to use the appropriate existing mutation hooks (`useCreateQueue`, `useCreateAgent`, `useUpdateChannelConfig`) from their respective hook files. This ensures consistent cache invalidation and error handling. The `completeOnboarding` call in `handleFinish` is already correct.

#### A6. Agent State Admin Calls Non-Existent Route

**File:** `src/core/api/hooks/use-agents.ts` (lines 124-139)
**Problem:** `useUpdateAgentStateAdmin` calls `PUT /api/v1/admin/agents/${agentId}/state`. Backend `AdminEndpoints.cs` only has `PUT /admin/agents/{id}` (full agent update). No `/state` sub-route exists.
**Fix:** Change to `PUT /api/v1/admin/agents/${agentId}` with `{ status: newState }` in the body. The existing `UpdateAgent` handler accepts status updates as part of the full update.

#### A7. OIDC SSO Permissions Empty

**File:** `src/core/auth/login-page.tsx` (line 73)
**Problem:** OIDC callback hardcodes `permissions: []` and `features: {}`. SSO users pass AuthGuard but every PermissionGuard denies access — blank UI.
**Fix:** After parsing the OIDC hash and obtaining `accessToken`, fetch `GET /api/v1/users/me` with `Authorization: Bearer ${accessToken}`. The response should include `permissions` and `features`. Use those in `completeLogin()`. If `UsersMeEndpoint` does not currently return permissions/features, extend it (backend change) to include them — the `useMe` hook already expects these fields based on the Me interface added in v1.6.0.

#### A8. Analytics FilterBar Non-Functional (3 pages)

**Root cause:** `src/pages/analytics/analytics-layout.tsx` (line 12) renders `<FilterBar />` without `onFilterChange`. Filter state goes nowhere.

**Files affected:**
- `src/analytics/cdr/cdr-page.tsx` (line 194): `useCdrList(undefined, undefined, {}, page)` — hardcoded undefined filters
- `src/analytics/qa/qa-page.tsx` (line 27): `useQaList(undefined, undefined, {}, page)` — same, plus `[page]` has no setter (stuck at 1)
- `src/analytics/agents/agent-intervals-page.tsx` (lines 42-46): `from`/`to` hardcoded at component mount with no setter
- `src/analytics/shared/filter-bar.tsx` (line 40): `agent` state has no setter, Export button has no onClick

**Fix:** Create `src/core/stores/analytics-filter-store.ts` (Zustand):
```typescript
interface AnalyticsFilterState {
  from: string;       // ISO date
  to: string;         // ISO date
  queue: string;      // queue ID or empty
  channel: string;    // channel ID or empty
  setFilters: (filters: Partial<AnalyticsFilterState>) => void;
  reset: () => void;
}
```

- `filter-bar.tsx`: Write to store on every change. Remove `agent` stub. Wire Export button to a callback prop or `window.location` download.
- `analytics-layout.tsx`: No change needed (store decouples).
- `cdr-page.tsx`: Read `from, to, queue` from store. Pass to `useCdrList(from, to, { queue }, page)`.
- `qa-page.tsx`: Same + fix `[page, setPage] = useState(1)`.
- `agent-intervals-page.tsx`: Read `from, to` from store.

Defaults: `from` = start of current month, `to` = now.

#### A9. Billing Tenant Selection Broken

**File:** `src/admin/tenants/tenants-page.tsx`
**Problem:** `useBillingTenantId()` reads `activeTenantId` from tenant store, but no UI sets it. `setActiveTenant` is only called at login. Platform admins managing multiple tenants can never switch context — billing pages show "Select a tenant" forever.

**Fix:** Add a "Manage" icon-button action in each tenant row in `tenants-page.tsx`. On click:
1. Call `useTenantStore.getState().setActiveTenant(tenant.id)`
2. Navigate to `/admin/billing/rate-cards`

Also add a small tenant-context indicator in the billing pages header showing which tenant is selected, with a link back to tenants page.

#### A10. System Settings Form Loads Hardcoded Defaults

**File:** `src/admin/system/system-page.tsx` (lines 70-74)
**Problem:** `defaultValues` are hardcoded (`platformName: 'Asterisk Platform'`, `defaultTimezone: 'America/Bogota'`). No `useSystemSettings` GET hook exists. Saving overwrites real settings with hardcoded values.

**Fix:**
1. Add `useSystemSettings()` GET hook in `use-system.ts` → `GET /api/v1/management/system/settings`
2. In `system-page.tsx`: call `useSystemSettings()`, use `form.reset(data)` in `useEffect` when data loads. Show loading skeleton while fetching.

### Category B — UX Quality (6 items)

#### B1. Dark Mode Charts

**Files:** `src/analytics/dashboard/trend-chart.tsx`, `overlay-chart.tsx`, `heatmap.tsx`
**Problem:** Recharts grid/axis use hardcoded hex colors (`#e2e8f0`, `#94a3b8`) — invisible on dark backgrounds. Heatmap uses inline `rgb()`.
**Fix:** Replace with CSS variable references:
- Grid: `hsl(var(--border))`
- Axis: `hsl(var(--muted-foreground))`
- Chart data colors: `hsl(var(--primary))`, `hsl(var(--chart-1))` through `hsl(var(--chart-5))` (shadcn chart colors)
- Heatmap: Compute gradient using CSS variables for low/high values

#### B2. SSE Reconnect with Backoff

**File:** `src/core/hooks/use-sse.ts` (line 191)
**Problem:** Fixed 2s retry, no limit, no jitter. Thundering herd on outages.
**Fix:** Exponential backoff with jitter:
```
attempt = 0
onError:
  delay = min(2000 * 2^attempt, 30000) + Math.random() * 1000
  attempt++
  if attempt > 10: toast.error('Real-time connection lost'), stop retrying
onOpen:
  attempt = 0
```

#### B3. AuthGuard Token Expiry Check

**File:** `src/core/auth/auth-guard.tsx` (line 8)
**Problem:** Only checks `accessToken !== null`. Expired token passes guard, causing flash of authenticated UI before API calls trigger refresh/redirect.
**Fix:** Read `expiresAt` from store. If `Date.now() >= expiresAt`, redirect to `/login`. The store already persists `expiresAt`.

#### B4. Agent Mutations Error Handling

**File:** `src/core/api/hooks/use-conversations.ts`
**Problem:** `useAcceptConversation`, `useRejectConversation`, `useCloseConversation`, `useHoldConversation`, `useUnholdConversation` — none have `onError` callbacks. Agent sees no feedback on failure.
**Fix:** Add `onError: (err: Error) => toast.error(err.message)` to all 5 mutations. This pattern is already used in 30+ hooks across the project.

#### B5. Teams Page in Sidebar

**File:** `src/admin/sidebar.tsx`
**Problem:** `/admin/teams` is a fully functional CRUD page (with DataTable, Zod forms, E2E tests) but has no sidebar entry. Unreachable without direct URL.
**Fix:** Add entry in the "People" group after "Agents": `{ name: 'Teams', href: '/admin/teams', icon: UsersRound, permission: 'core:team:view' }`.

#### B6. Agent-Assist Config Page Blocked

**File:** `src/admin/agent-assist/agent-assist-config-page.tsx`
**Problem:** Page is reachable by URL, backend engine is dead code (`AddProAgentAssist()` commented out). Admin can "configure" a feature that does nothing — saves return 200 but changes are discarded.
**Fix:** Add a "Coming Soon" banner at the top of the page. Disable all form inputs and Save button. Show explanatory text: "Agent Assist requires speech recognition configuration. This feature will be available in a future release." Remove from sidebar if present.

### Category C — Incomplete Features (10 items)

#### C1. Reports Run/History/Download

**File:** `src/core/api/hooks/use-reports.ts`
**New hooks:**
- `useRunReport()` → `POST /api/v1/admin/reports/${id}/run` — mutation, returns 202. Toast: "Report execution started".
- `useReportHistory(id)` → `GET /api/v1/admin/reports/${id}/history?limit=25` — query, enabled when id is set.
- Download: Plain `window.open()` to `/api/v1/admin/reports/${id}/history/${executionId}/download` (file download, no hook needed).

**UI in `reports-page.tsx`:**
- Add "Run" icon-button (Play) in the actions column. Shows loading spinner during execution.
- Add "History" icon-button (Clock) that opens a Sheet with execution history table: `startedAt`, `completedAt`, `status` badge (Pending/Running/Completed/Failed), download button per row.

#### C2. Tenant Suspend/Activate Quick-Actions

**File:** `src/admin/tenants/tenants-page.tsx`
**UI:** Add to the existing row dropdown menu:
- "Suspend" — visible when `status === 'Active'`. Uses `useUpdateTenant` with `{ status: 'Suspended' }`. Requires `ConfirmDeleteDialog` (destructive action).
- "Activate" — visible when `status === 'Suspended'`. Uses `useUpdateTenant` with `{ status: 'Active' }`. No confirmation needed.

No new hooks — reuses existing `useUpdateTenant`.

#### C3. Campaign Wizard Zod Validation

**File:** `src/admin/campaigns/campaign-wizard.tsx` + step components
**Problem:** `useForm<CampaignFormValues>` has no resolver. Zero client-side validation.
**Fix:** Add Zod schemas per step:
- `basicStepSchema`: `name` min 2 chars required, `queueId` required
- `dialingStepSchema`: `dialingMode` required, `maxChannels` positive integer
- `scheduleStepSchema`: `timezone` required, `startDate` required
- `complianceStepSchema`: `maxAttempts` positive integer (if set)
- `contactsStepSchema`: no validation (file upload handled separately)

Attach `resolver: zodResolver(currentStepSchema)` and add `{errors.fieldName && <p className="text-sm text-destructive">{errors.fieldName.message}</p>}` in each step component.

#### C4. GDPR Purge-User + Purge-Preview

**File:** `src/core/api/hooks/use-gdpr.ts`
**New hooks:**
- `usePurgePreview(scope, id)` → `GET /api/v1/admin/gdpr/purge-preview?userId=${id}` — query, returns entity counts.
- `usePurgeUser()` → `POST /api/v1/admin/gdpr/purge-user` with `{ userId, reason }` — mutation.

**UI in `gdpr-page.tsx`:**
- Add scope toggle: "Contact" / "User" using Tabs component.
- In "User" mode: userId input field, "Preview" button that shows affected entity counts (conversations, messages, auth events, audit entries), then "Purge" with confirmation dialog showing the preview summary.

#### C5. Webhook Circuit-Breaker Status/Reset

**File:** `src/core/api/hooks/use-webhooks.ts`
**New hooks:**
- `useCircuitStatus(subscriptionId)` → `GET /api/v1/webhooks/subscriptions/${id}/circuit-status` — query.
- `useResetCircuit()` → `POST /api/v1/webhooks/subscriptions/${id}/reset-circuit` — mutation.

**UI in `webhook-detail-sheet.tsx`:**
- Show circuit-breaker badge next to Active/Inactive: Closed (green), HalfOpen (amber), Open (red).
- When Open: show "Reset Circuit Breaker" button. On click, call `useResetCircuit`, invalidate status.
- Show failure count and last failure timestamp if available in the response.

#### C6. Invoice Pay/Mark-as-Paid

**File:** `src/core/api/hooks/use-billing.ts`
**New hook:**
- `usePayInvoice()` → `POST /api/v1/management/invoices/${invoiceId}/pay` — mutation. Invalidates `['billing', 'invoices']`.

**Type update:** Add to `Invoice` interface:
- `paymentStatus: string` (values: 'Current' | 'Overdue' | 'InCollections')
- `dueDate: string | null`

**UI in `invoices-page.tsx`:**
- Add "Mark Paid" button visible when `status === 'Issued'`. Confirmation dialog: "Mark invoice #{number} as paid?"
- Show `paymentStatus` badge and `dueDate` in the detail sheet.

#### C7. Billing Dunning Status in Quotas

**File:** `src/admin/billing/quotas-page.tsx`
**Problem:** No dunning visibility. Admin cannot see if a tenant is in collections.
**Fix:** Add `useDunningStatus(tenantId)` query hook in `use-billing.ts` → `GET /api/v1/management/tenants/${tenantId}/dunning`. Enabled only when `tenantId` is truthy.

**UI:** Show amber banner above quotas when dunning is active:
- Phase badge: Warning / Degraded / Suspended / PendingDeletion
- Days overdue, overdue amount
- "View Invoice" link navigating to invoices page

#### C8. Contacts DELETE

**File:** `src/core/api/hooks/use-contacts.ts`
**New hook:**
- `useDeleteContact()` → `DELETE /api/v1/contacts/${id}` — mutation with `ConfirmDeleteDialog`.

**UI:** Add "Delete" action in the contact context panel of the agent workspace (`contact-info.tsx`). Only visible to users with `contacts:contact:manage` permission.

#### C9. ErrorBoundary per Route

**New file:** `src/core/ui/route-error-boundary.tsx`
**Implementation:** React class component that catches render errors. Renders: "Something went wrong on this page" + "Try Again" button (calls `this.setState({ hasError: false })` to remount) + "Go Home" link.

**Apply in `router.tsx`:** Add `errorElement: <RouteErrorBoundary />` on the 4 main layout routes: `/admin`, `/agent`, `/analytics`, `/operations`. Chunk-load failures and render crashes stay isolated to the current route instead of crashing the entire app.

#### C10. Dead Code Cleanup

**Remove:**
- `useSystemCluster` from `use-system.ts` — dead code, replaced by `use-cluster.ts` in v1.2.1. Verify `diagnostics-page.tsx` uses `use-cluster.ts` instead; update import if not.
- `hasFeature()` and `hasAnyPermission()` from `auth-store.ts` — defined but never called from any component. Remove their test cases too.
- `useToggleReportActive` from `use-reports.ts` — replaced in A4 by reusing `useUpdateReport`.
- Dead `agent` state (no setter, no UI) from `filter-bar.tsx` — cleaned up in A8.

## Out of Scope

- **i18n sweep** — deferred to v1.6.2 (separate sprint)
- **Partner Portal UI** — deferred to v1.7.0
- **Branding Admin Page** — deferred to v1.7.0
- **Agent Assist activation** — deferred to v1.7.0+
- **Responsive/mobile layout** — deferred (requires design system rethink)
- **Management API Keys page** — deferred to v1.7.0 (new page, not a fix)
- **Admin Tenant Settings page** — deferred to v1.7.0 (new page, not a fix)
- **E2E test expansion** — parallel effort, not blocking this release

## Repos Affected

| Repo | Changes |
|------|---------|
| Asterisk.Platform.Web | 25 items (all frontend) |
| Asterisk.Platform | 1 item (A3: force-logout endpoint) |

## Verification

- `npm run build` — 0 TypeScript errors
- `npm run test` — all unit tests pass
- `npm run lint` — no new warnings
- `dotnet build` + `dotnet test` on Platform (for A3 backend change)
- Manual verification of: OIDC login flow, analytics filters, billing tenant selection, reports run/history, system settings load
