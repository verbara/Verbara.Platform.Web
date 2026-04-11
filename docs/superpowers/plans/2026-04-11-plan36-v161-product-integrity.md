# v1.6.1 "Product Integrity" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all broken functionality (URL mismatches, OIDC permissions, analytics filters, billing tenant selection), improve UX quality (dark mode, SSE backoff, AuthGuard), and complete partially-implemented features (reports, GDPR, webhooks, invoices, validation).

**Architecture:** 25 tasks across 6 phases. Phase 1-2 are mechanical URL/auth fixes (batchable). Phase 3 creates the analytics filter store. Phase 4 fixes billing/system. Phase 5 polishes UX. Phase 6 completes incomplete features. One backend change in Platform repo (force-logout endpoint). All others are Platform.Web frontend-only.

**Tech Stack:** React 19, TanStack Query 5, Zustand 5, Zod 4, React Hook Form 7, Recharts 3, Vite 8, TypeScript 5.9

**Spec:** `docs/superpowers/specs/2026-04-11-v161-product-integrity-design.md`

---

## Phase 1: URL & Type Fixes (batchable)

### Task 1: Fix Tenants Hook URLs (A1)

**Files:**
- Modify: `src/core/api/hooks/use-tenants.ts`

- [ ] **Step 1: Replace all `/admin/tenants` with `/management/tenants`**

In `src/core/api/hooks/use-tenants.ts`, replace every occurrence of `/api/v1/admin/tenants` with `/api/v1/management/tenants`. There are 5 occurrences across 5 hooks: `useTenants` (line 44), `useTenant` (line 52), `useCreateTenant` (line 61), `useUpdateTenant` (line 74), `useDeleteTenant` (line 88).

Use a global find-and-replace within the file:
- Old: `/api/v1/admin/tenants`
- New: `/api/v1/management/tenants`

- [ ] **Step 2: Verify build**

Run: `cd /media/Data/Source/IPcom/Asterisk.Platform.Web && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/core/api/hooks/use-tenants.ts
git commit -m "fix(hooks): correct tenants hook URLs from /admin to /management"
```

---

### Task 2: Fix Reports Types + Remove Toggle (A4 + C10 partial)

**Files:**
- Modify: `src/core/api/hooks/use-reports.ts`
- Modify: `src/admin/reports/reports-page.tsx`

- [ ] **Step 1: Fix types and remove dead hook in `use-reports.ts`**

In `src/core/api/hooks/use-reports.ts`:

1. Remove the `ReportSchedule` type alias (line 7).
2. Change `ScheduledReport.id` from `number` to `string` (line 10).
3. Change `ScheduledReport.schedule` from `ReportSchedule` to `string` (line 13).
4. Update `useReport` parameter from `id: number | undefined` to `id: string | undefined` (line 30).
5. Update `useUpdateReport` `id` from `number` to `string` in the mutationFn type (line 58).
6. Update `useDeleteReport` parameter from `number` to `string` (line 76).
7. Delete the entire `useToggleReportActive` function (lines 86-101).

The `ReportType` union (line 5) stays — it serves as documentation even if the backend is flexible.

- [ ] **Step 2: Update `reports-page.tsx` toggle usage**

In `src/admin/reports/reports-page.tsx`, find where `useToggleReportActive` is used (the active/inactive toggle). Replace it with `useUpdateReport`:

Replace the toggle call pattern from:
```tsx
toggleActive.mutate(!report.isActive)
```
to:
```tsx
updateReport.mutate({ id: report.id, isActive: !report.isActive })
```

Remove the `useToggleReportActive` import. Add `useUpdateReport` to the existing import from `use-reports`.

Also update any place where report `id` is treated as `number` (e.g., `useToggleReportActive(report.id)` which expected number) — now it's `string`.

- [ ] **Step 3: Verify build**

Run: `cd /media/Data/Source/IPcom/Asterisk.Platform.Web && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/core/api/hooks/use-reports.ts src/admin/reports/reports-page.tsx
git commit -m "fix(reports): correct id/schedule types, remove broken toggle hook"
```

---

### Task 3: Fix Agent State Admin URL (A6)

**Files:**
- Modify: `src/core/api/hooks/use-agents.ts`

- [ ] **Step 1: Fix `useUpdateAgentStateAdmin` URL**

In `src/core/api/hooks/use-agents.ts`, find `useUpdateAgentStateAdmin` (around line 124). Change:

Old URL: `` `/api/v1/admin/agents/${agentId}/state` ``
New URL: `` `/api/v1/admin/agents/${agentId}` ``

The body should send `{ status: newState }` where `newState` is the desired agent status string. The existing `PUT /admin/agents/{id}` backend handler accepts `status` as part of the update payload.

- [ ] **Step 2: Verify build**

Run: `cd /media/Data/Source/IPcom/Asterisk.Platform.Web && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/core/api/hooks/use-agents.ts
git commit -m "fix(hooks): correct agent state admin URL to use existing PUT endpoint"
```

---

### Task 4: Fix DNC Check Hook (A2)

**Files:**
- Modify: `src/core/api/hooks/use-dnc-lists.ts`
- Modify: consumers of `useCheckDncNumber` (search for imports)

- [ ] **Step 1: Rewrite `useCheckDncNumber` in `use-dnc-lists.ts`**

Find `useCheckDncNumber` (around line 160). Replace the entire hook:

Old:
```tsx
export function useCheckDncNumber() {
  return useMutation({
    mutationFn: (phoneNumber: string) =>
      customFetch<{ isBlocked: boolean }>({
        url: '/api/v1/admin/dnc-lists/check',
        method: 'POST',
        data: { phoneNumber },
      }),
    onError: (err: Error) => toast.error(err.message),
  });
}
```

New:
```tsx
export function useCheckDncNumber() {
  return useMutation({
    mutationFn: ({ listId, phoneNumber }: { listId: number; phoneNumber: string }) =>
      customFetch<{ isBlocked: boolean }>({
        url: `/api/v1/admin/dnc-lists/${listId}/check/${encodeURIComponent(phoneNumber)}`,
        method: 'GET',
      }),
    onError: (err: Error) => toast.error(err.message),
  });
}
```

- [ ] **Step 2: Update consumers**

Search the codebase for `useCheckDncNumber` usages (likely in `dnc-list-detail.tsx` or `dnc-lists-page.tsx`). Update the `.mutate(phoneNumber)` calls to `.mutate({ listId, phoneNumber })` where `listId` comes from the page's context (URL param or selected list).

- [ ] **Step 3: Verify build**

Run: `cd /media/Data/Source/IPcom/Asterisk.Platform.Web && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/core/api/hooks/use-dnc-lists.ts
git commit -m "fix(hooks): correct DNC check to use GET with listId and phone path params"
```

---

### Task 5: Remove Dead System Cluster Hook (C10 partial)

**Files:**
- Modify: `src/core/api/hooks/use-system.ts`
- Modify: `src/admin/system/diagnostics-page.tsx` (if it imports `useSystemCluster`)

- [ ] **Step 1: Remove `useSystemCluster` from `use-system.ts`**

Delete the `ClusterInfo` interface (line 23-25) and the `useSystemCluster` function (lines 55-64) from `src/core/api/hooks/use-system.ts`.

- [ ] **Step 2: Fix any consumers**

Search for `useSystemCluster` in the codebase. If `diagnostics-page.tsx` imports it, replace with `useClusterStatus` from `use-cluster.ts` (which already exists and calls the correct `/management/cluster/status` URL).

- [ ] **Step 3: Verify build**

Run: `cd /media/Data/Source/IPcom/Asterisk.Platform.Web && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/core/api/hooks/use-system.ts
git commit -m "fix(hooks): remove dead useSystemCluster, replaced by use-cluster.ts"
```

---

## Phase 2: Auth & Core Fixes

### Task 6: Fix OIDC SSO Permissions (A7)

**Files:**
- Modify: `src/core/auth/login-page.tsx`

- [ ] **Step 1: Add /users/me fetch after OIDC hash parse**

In `src/core/auth/login-page.tsx`, find the OIDC callback handler (the block that parses `window.location.hash` starting with `#oidc_callback`). After extracting `accessToken`, `tenantId`, `userId`, `email`, `displayName`, `role`, and before calling `completeLogin()`:

Add a fetch to get the full user profile with permissions:

```tsx
// Fetch full user profile with permissions
const me = await fetch('/api/v1/users/me', {
  headers: { 'Authorization': `Bearer ${accessToken}`, 'X-Tenant-Id': tenantId },
}).then(r => r.json());

completeLogin({
  accessToken,
  expiresAt: expiresAt ?? undefined,
  tenantId,
  user: { id: userId, email, displayName: displayName ?? email, role },
  permissions: me.permissions ?? [],
  features: me.features ?? {},
});
```

Replace the previous `completeLogin` call that had hardcoded `permissions: []` and `features: {}`.

Note: Use native `fetch` here (not `customFetch`) because the auth store is not yet populated at this point — `customFetch` would try to read a token that isn't set yet.

- [ ] **Step 2: Handle fetch failure gracefully**

Wrap the `/users/me` fetch in try/catch. On failure, fall back to `permissions: []` and `features: {}` (degraded but login still works — same as current behavior):

```tsx
let permissions: string[] = [];
let features: Record<string, boolean> = {};
try {
  const me = await fetch('/api/v1/users/me', {
    headers: { 'Authorization': `Bearer ${accessToken}`, 'X-Tenant-Id': tenantId },
  }).then(r => r.json());
  permissions = me.permissions ?? [];
  features = me.features ?? {};
} catch {
  // Degraded: login proceeds without permissions
}
```

- [ ] **Step 3: Verify build**

Run: `cd /media/Data/Source/IPcom/Asterisk.Platform.Web && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/core/auth/login-page.tsx
git commit -m "fix(auth): fetch permissions from /users/me after OIDC callback"
```

---

### Task 7: AuthGuard Token Expiry Check (B3)

**Files:**
- Modify: `src/core/auth/auth-guard.tsx`

- [ ] **Step 1: Add token expiry check**

Replace the full file content of `src/core/auth/auth-guard.tsx`:

```tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './auth-store';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isTokenExpired = useAuthStore((s) => s.isTokenExpired);
  const location = useLocation();

  if (!accessToken || isTokenExpired()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
```

The store already has `isTokenExpired()` which checks `Date.now() >= tokenExpiry - 30_000` (30s buffer). This prevents the flash of authenticated UI with an expired token.

- [ ] **Step 2: Verify build**

Run: `cd /media/Data/Source/IPcom/Asterisk.Platform.Web && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/core/auth/auth-guard.tsx
git commit -m "fix(auth): check token expiry in AuthGuard to prevent stale UI flash"
```

---

### Task 8: Force Logout Backend Endpoint (A3)

**Files:**
- Modify: `/media/Data/Source/IPcom/Asterisk.Platform/src/Asterisk.Platform.Api/Endpoints/AuthAdminEndpoints.cs`
- Modify: `src/core/api/hooks/use-auth-admin.ts` (Platform.Web)

- [ ] **Step 1: Add bulk session revoke endpoint (Platform repo)**

In `/media/Data/Source/IPcom/Asterisk.Platform/src/Asterisk.Platform.Api/Endpoints/AuthAdminEndpoints.cs`, add a new endpoint in the `Map` method alongside the existing session routes:

```csharp
group.MapDelete("/sessions/by-user/{userId}", RevokeAllUserSessions)
    .RequireAuthorization("AdminOnly");
```

Add the handler method:

```csharp
private static async Task<IResult> RevokeAllUserSessions(
    string userId,
    [FromServices] IRefreshTokenStore refreshTokenStore,
    [FromServices] IAuditService auditService,
    HttpContext context,
    CancellationToken ct)
{
    var tokens = await refreshTokenStore.ListByUserIdAsync(userId, ct);
    var count = 0;
    foreach (var token in tokens)
    {
        await refreshTokenStore.RevokeAsync(token.Id, ct);
        count++;
    }

    return TypedResults.Ok(new { revokedCount = count });
}
```

Also add the DTO to `ApiJsonContext` if needed for AOT serialization.

- [ ] **Step 2: Fix frontend hook URL**

In `src/core/api/hooks/use-auth-admin.ts`, find `useForceLogoutUser` (around line 129). Change the URL:

Old: `` `/api/v1/admin/auth/sessions/user/${userId}` ``
New: `` `/api/v1/admin/auth/sessions/by-user/${userId}` ``

- [ ] **Step 3: Build and test both repos**

```bash
cd /media/Data/Source/IPcom/Asterisk.Platform && dotnet build Asterisk.Platform.slnx && dotnet test Asterisk.Platform.slnx -v q
cd /media/Data/Source/IPcom/Asterisk.Platform.Web && npx tsc --noEmit
```

- [ ] **Step 4: Commit both repos**

Platform:
```bash
cd /media/Data/Source/IPcom/Asterisk.Platform
git add src/Asterisk.Platform.Api/Endpoints/AuthAdminEndpoints.cs
git commit -m "feat(auth): add DELETE /sessions/by-user/{userId} bulk session revoke endpoint"
```

Platform.Web:
```bash
cd /media/Data/Source/IPcom/Asterisk.Platform.Web
git add src/core/api/hooks/use-auth-admin.ts
git commit -m "fix(hooks): update force-logout URL to /sessions/by-user/{userId}"
```

---

### Task 9: SSE Reconnect with Backoff (B2)

**Files:**
- Modify: `src/core/hooks/use-sse.ts`

- [ ] **Step 1: Add exponential backoff to SSE reconnect**

In `src/core/hooks/use-sse.ts`, add a `reconnectAttempt` ref at the top of the hook (near other refs):

```tsx
const reconnectAttemptRef = useRef(0);
```

Replace the `source.onerror` handler (around line 186):

Old:
```tsx
source.onerror = () => {
  source.close();
  sourceRef.current = null;
  queryClient.invalidateQueries({ queryKey: ['notifications'] });
  setTimeout(connect, 2000);
};
```

New:
```tsx
source.onerror = () => {
  source.close();
  sourceRef.current = null;
  queryClient.invalidateQueries({ queryKey: ['notifications'] });

  const attempt = reconnectAttemptRef.current;
  if (attempt >= 10) {
    toast.error('Real-time connection lost. Refresh the page to reconnect.');
    return;
  }
  const delay = Math.min(2000 * Math.pow(2, attempt), 30000) + Math.random() * 1000;
  reconnectAttemptRef.current = attempt + 1;
  setTimeout(connect, delay);
};
```

Also add a reset on successful connection. Find `source.onopen` or add it after creating the EventSource:

```tsx
source.onopen = () => {
  reconnectAttemptRef.current = 0;
};
```

Import `toast` from `sonner` if not already imported.

- [ ] **Step 2: Verify build**

Run: `cd /media/Data/Source/IPcom/Asterisk.Platform.Web && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/core/hooks/use-sse.ts
git commit -m "fix(sse): add exponential backoff with jitter and max retries to reconnect"
```

---

## Phase 3: Analytics FilterBar Wiring (A8)

### Task 10: Create Analytics Filter Store + Wire FilterBar

**Files:**
- Create: `src/core/stores/analytics-filter-store.ts`
- Modify: `src/analytics/shared/filter-bar.tsx`

- [ ] **Step 1: Create the Zustand store**

Create `src/core/stores/analytics-filter-store.ts`:

```tsx
import { create } from 'zustand';

function startOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

interface AnalyticsFilterState {
  from: string;
  to: string;
  queue: string;
  channel: string;
  setFilters: (filters: Partial<Pick<AnalyticsFilterState, 'from' | 'to' | 'queue' | 'channel'>>) => void;
  reset: () => void;
}

export const useAnalyticsFilterStore = create<AnalyticsFilterState>()((set) => ({
  from: startOfMonth(),
  to: todayStr(),
  queue: '',
  channel: '',
  setFilters: (filters) => set(filters),
  reset: () => set({ from: startOfMonth(), to: todayStr(), queue: '', channel: '' }),
}));
```

- [ ] **Step 2: Wire FilterBar to the store**

In `src/analytics/shared/filter-bar.tsx`:

1. Import the store: `import { useAnalyticsFilterStore } from '@/core/stores/analytics-filter-store';`
2. Replace local state with store reads:
   - Replace `const [dateRange, setDateRange] = useState(...)` with reading from store
   - Replace `const [queue, setQueue] = useState('')` with store
   - Remove `const [agent] = useState('')` (dead code)
   - Replace `const [channel, setChannel] = useState('')` with store
3. Remove the `useEffect` that calls `onFilterChange?.()` (no longer needed — store is the source of truth)
4. Remove the `onFilterChange` prop from `FilterBarProps` interface

Updated file:

```tsx
import { useTranslation } from 'react-i18next';
import { DateRangePicker, type DateRange } from './date-range-picker';
import { ExportButton } from './export-button';
import { useQueues } from '@/core/api/hooks/use-queues';
import { useAnalyticsFilterStore } from '@/core/stores/analytics-filter-store';

const CHANNELS = ['voice', 'whatsapp', 'webchat', 'email'];

export function FilterBar() {
  const { t } = useTranslation('analytics');
  const { data: queues = [] } = useQueues();
  const { from, to, queue, channel, setFilters } = useAnalyticsFilterStore();

  const handleDateChange = (range: DateRange) => {
    setFilters({ from: range.from, to: range.to });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-6 py-2.5 dark:border-slate-700 dark:bg-slate-800">
      <DateRangePicker value={{ from, to }} onChange={handleDateChange} />

      <select
        value={queue}
        onChange={(e) => setFilters({ queue: e.target.value })}
        className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
      >
        <option value="">{t('filters.queue')}</option>
        {queues.map((q) => (
          <option key={q.id} value={q.name}>
            {q.name}
          </option>
        ))}
      </select>

      <select
        value={channel}
        onChange={(e) => setFilters({ channel: e.target.value })}
        className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
      >
        <option value="">{t('filters.channel')}</option>
        {CHANNELS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <div className="ml-auto">
        <ExportButton />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd /media/Data/Source/IPcom/Asterisk.Platform.Web && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/core/stores/analytics-filter-store.ts src/analytics/shared/filter-bar.tsx
git commit -m "feat(analytics): add analytics filter Zustand store and wire FilterBar"
```

---

### Task 11: Wire Analytics Pages to Filter Store

**Files:**
- Modify: `src/analytics/cdr/cdr-page.tsx`
- Modify: `src/analytics/qa/qa-page.tsx`
- Modify: `src/analytics/agents/agent-intervals-page.tsx`

- [ ] **Step 1: Wire CDR page**

In `src/analytics/cdr/cdr-page.tsx`:

1. Import: `import { useAnalyticsFilterStore } from '@/core/stores/analytics-filter-store';`
2. Add at the top of the component: `const { from, to, queue } = useAnalyticsFilterStore();`
3. Replace the `useCdrList(undefined, undefined, {}, page)` call with: `useCdrList(from, to, { queue }, page)`
4. Add page reset when filters change — add a `useEffect` that resets page to 1 when `from`, `to`, or `queue` change:
```tsx
useEffect(() => { setPage(1); }, [from, to, queue]);
```

- [ ] **Step 2: Wire QA page**

In `src/analytics/qa/qa-page.tsx`:

1. Import: `import { useAnalyticsFilterStore } from '@/core/stores/analytics-filter-store';`
2. Add at the top of the component: `const { from, to, queue } = useAnalyticsFilterStore();`
3. Fix the `page` state — change `const [page] = useState(1)` to `const [page, setPage] = useState(1)`
4. Replace `useQaList(undefined, undefined, {}, page)` with: `useQaList(from, to, { queue }, page)`
5. Add page reset on filter change:
```tsx
useEffect(() => { setPage(1); }, [from, to, queue]);
```

- [ ] **Step 3: Wire Agent Intervals page**

In `src/analytics/agents/agent-intervals-page.tsx`:

1. Import: `import { useAnalyticsFilterStore } from '@/core/stores/analytics-filter-store';`
2. Replace the hardcoded `from`/`to` state:
   - Remove `const [from] = useState(() => { ... });` and `const [to] = useState(() => ...);`
   - Add: `const { from, to } = useAnalyticsFilterStore();`
3. Pass these to the hook: `useAgentIntervals({ from, to })`

- [ ] **Step 4: Verify build**

Run: `cd /media/Data/Source/IPcom/Asterisk.Platform.Web && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/analytics/cdr/cdr-page.tsx src/analytics/qa/qa-page.tsx src/analytics/agents/agent-intervals-page.tsx
git commit -m "fix(analytics): wire CDR, QA, and Agent Intervals pages to filter store"
```

---

## Phase 4: Billing & System Fixes

### Task 12: Billing Tenant Selection (A9)

**Files:**
- Modify: `src/admin/tenants/tenants-page.tsx`

- [ ] **Step 1: Add "Manage Billing" action to tenant rows**

In `src/admin/tenants/tenants-page.tsx`:

1. Import: `import { useTenantStore } from '@/core/tenant/tenant-store';` (or wherever `useTenantStore` is defined — search for `setActiveTenant`)
2. Import: `import { useNavigate } from 'react-router-dom';`
3. Import: `import { CreditCard } from 'lucide-react';`
4. In the component, add: `const navigate = useNavigate();`
5. Add a "Manage Billing" action button/dropdown item in each tenant row's actions area. On click:

```tsx
const handleManageBilling = (tenant: Tenant) => {
  useTenantStore.getState().setActiveTenant(tenant.tenantId);
  navigate('/admin/billing/rate-cards');
};
```

Add this as a dropdown item or icon-button alongside the existing Edit/Delete actions:
```tsx
<DropdownMenuItem onClick={() => handleManageBilling(tenant)}>
  <CreditCard className="mr-2 h-4 w-4" />
  Manage Billing
</DropdownMenuItem>
```

- [ ] **Step 2: Verify build**

Run: `cd /media/Data/Source/IPcom/Asterisk.Platform.Web && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/admin/tenants/tenants-page.tsx
git commit -m "fix(tenants): add Manage Billing action to set active tenant context"
```

---

### Task 13: System Settings GET Hook + Form Fix (A10)

**Files:**
- Modify: `src/core/api/hooks/use-system.ts`
- Modify: `src/admin/system/system-page.tsx`

- [ ] **Step 1: Add `useSystemSettings` GET hook**

In `src/core/api/hooks/use-system.ts`, add after `useSystemLicense`:

```tsx
export function useSystemSettings() {
  return useQuery({
    queryKey: ['system', 'settings'],
    queryFn: () =>
      customFetch<SystemSettings>({
        url: '/api/v1/management/system/settings',
        method: 'GET',
      }),
  });
}
```

The `SystemSettings` interface already exists in the file (lines 27-31).

- [ ] **Step 2: Fix system-page.tsx to load from API**

In `src/admin/system/system-page.tsx`:

1. Import `useSystemSettings` from `use-system.ts`
2. Call `const { data: settings, isLoading: settingsLoading } = useSystemSettings();`
3. Change `defaultValues` to empty strings (they will be populated by `reset`):
```tsx
defaultValues: {
  platformName: '',
  defaultTimezone: '',
  defaultLanguage: '',
},
```
4. Add a `useEffect` to populate the form when data loads:
```tsx
useEffect(() => {
  if (settings) {
    form.reset(settings);
  }
}, [settings, form]);
```
5. Show loading state while `settingsLoading` is true (wrap the form section in a conditional or show a skeleton).

- [ ] **Step 3: Verify build**

Run: `cd /media/Data/Source/IPcom/Asterisk.Platform.Web && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/core/api/hooks/use-system.ts src/admin/system/system-page.tsx
git commit -m "fix(system): add useSystemSettings GET hook, load real values in form"
```

---

## Phase 5: UX Quality

### Task 14: Dark Mode Charts (B1)

**Files:**
- Modify: `src/analytics/dashboard/trend-chart.tsx`
- Modify: `src/analytics/dashboard/overlay-chart.tsx`
- Modify: `src/analytics/dashboard/heatmap.tsx`

- [ ] **Step 1: Fix trend-chart.tsx**

In `src/analytics/dashboard/trend-chart.tsx`, replace all hardcoded hex colors:

- Grid stroke `#e2e8f0` → `'hsl(var(--border))'`
- Axis stroke `#94a3b8` → `'hsl(var(--muted-foreground))'`
- Default bar/line color `#6366f1` → `'hsl(var(--primary))'`
- Pie colors array: replace hardcoded hex values with `'hsl(var(--chart-1))'`, `'hsl(var(--chart-2))'`, etc.

- [ ] **Step 2: Fix overlay-chart.tsx**

In `src/analytics/dashboard/overlay-chart.tsx`, same pattern:

- Grid stroke `#e2e8f0` → `'hsl(var(--border))'`
- Axis stroke `#94a3b8` → `'hsl(var(--muted-foreground))'`
- Bar fill `#3b82f6` → `'hsl(var(--chart-1))'`
- Line stroke `#10b981` → `'hsl(var(--chart-2))'`

- [ ] **Step 3: Fix heatmap.tsx**

In `src/analytics/dashboard/heatmap.tsx`, replace the inline `rgb()` gradient function:

Replace the `interpolateBlue` function and hardcoded text colors with CSS-variable-aware values. Use `hsl(var(--primary))` as the high value and `hsl(var(--muted))` as the low value. For text color, use `hsl(var(--primary-foreground))` for high-ratio cells and `hsl(var(--foreground))` for low-ratio cells.

- [ ] **Step 4: Verify build**

Run: `cd /media/Data/Source/IPcom/Asterisk.Platform.Web && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/analytics/dashboard/trend-chart.tsx src/analytics/dashboard/overlay-chart.tsx src/analytics/dashboard/heatmap.tsx
git commit -m "fix(charts): replace hardcoded hex colors with CSS variables for dark mode"
```

---

### Task 15: Teams Sidebar + Agent-Assist Blocked (B5 + B6)

**Files:**
- Modify: `src/admin/sidebar.tsx`
- Modify: `src/admin/agent-assist/agent-assist-config-page.tsx`

- [ ] **Step 1: Add Teams entry to sidebar**

In `src/admin/sidebar.tsx`, find the `people` group (around line 66-73). Add a Teams entry after the `agents` item:

```tsx
{ key: 'teams', labelKey: 'admin:sidebar.teams', to: '/admin/teams', icon: UsersRound, requiredPermission: 'core:team:view' },
```

Import `UsersRound` from `lucide-react` (add to the existing import block).

- [ ] **Step 2: Block agent-assist config page**

In `src/admin/agent-assist/agent-assist-config-page.tsx`, add a "Coming Soon" banner at the top of the return JSX, before the form. Disable all form fields. Read the file first to understand the current structure, then add:

```tsx
<div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
    Coming Soon — Agent Assist requires speech recognition configuration.
    This feature will be available in a future release.
  </p>
</div>
```

Then wrap the form content with a disabled state — either add `pointer-events-none opacity-50` to the form container, or add `disabled` to each input and the Save button. The simplest approach is wrapping the form in a `<fieldset disabled>`:

```tsx
<fieldset disabled className="space-y-6 opacity-50">
  {/* existing form content */}
</fieldset>
```

Also verify the sidebar: if there is an entry for agent-assist in the sidebar, it should stay (users may want to see the "coming soon" notice), but remove any active/clickable impression.

- [ ] **Step 3: Verify build**

Run: `cd /media/Data/Source/IPcom/Asterisk.Platform.Web && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/admin/sidebar.tsx src/admin/agent-assist/agent-assist-config-page.tsx
git commit -m "fix(admin): add Teams to sidebar, block agent-assist config with Coming Soon"
```

---

### Task 16: Setup Wizard Hooks Refactor (A5)

**Files:**
- Modify: `src/admin/setup/setup-wizard.tsx`

- [ ] **Step 1: Replace customFetch calls with hooks**

In `src/admin/setup/setup-wizard.tsx`, the `handleNext` function (lines 69-133) calls `customFetch` directly for queue, agent, and channel creation. Replace with the existing mutation hooks.

1. Import the needed hooks at the top:
```tsx
import { useCreateQueue } from '@/core/api/hooks/use-queues';
import { useCreateAgent } from '@/core/api/hooks/use-agents';
```

2. In the component body, initialize the hooks:
```tsx
const createQueue = useCreateQueue();
const createAgent = useCreateAgent();
```

3. In `handleNext`, replace the `customFetch` calls:

For the queue step (currently line 76-85):
```tsx
if (currentStepKey === 'queue') {
  try {
    await createQueue.mutateAsync({ name: values.queueName, isActive: true });
  } catch {
    return;
  }
}
```

For the agent step (currently line 88-113):
```tsx
if (currentStepKey === 'agent') {
  try {
    await createAgent.mutateAsync({
      userId: values.agentUserId || undefined,
      displayName: values.agentDisplayName,
      email: values.agentEmail || undefined,
    });
  } catch {
    return;
  }
}
```

For the channel step, check if `useUpdateChannelConfig` exists in `use-channels.ts`. If so, use it. If not, the `customFetch` call for the PUT channel config can stay as-is (it's not a hook mismatch bug, just a consistency preference — skip if no matching hook exists).

Note: The hooks already handle toasts and cache invalidation, so remove the manual `toast.success()` and `toast.error()` calls that follow the `customFetch` calls.

- [ ] **Step 2: Verify build**

Run: `cd /media/Data/Source/IPcom/Asterisk.Platform.Web && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/admin/setup/setup-wizard.tsx
git commit -m "refactor(setup): replace raw customFetch with mutation hooks for cache consistency"
```

---

## Phase 6: Incomplete Features

### Task 17: Reports Run/History/Download (C1)

**Files:**
- Modify: `src/core/api/hooks/use-reports.ts`
- Modify: `src/admin/reports/reports-page.tsx`

- [ ] **Step 1: Add 2 new hooks to `use-reports.ts`**

Add after `useDeleteReport`:

```tsx
export function useRunReport() {
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/admin/reports/${id}/run`,
        method: 'POST',
      }),
    onSuccess: () => toast.success('Report execution started'),
    onError: (err: Error) => toast.error(err.message),
  });
}

export interface ReportExecution {
  id: string;
  reportId: string;
  status: 'Pending' | 'Running' | 'Completed' | 'Failed';
  startedAt: string;
  completedAt: string | null;
  error: string | null;
}

export function useReportHistory(reportId: string | undefined) {
  return useQuery({
    queryKey: ['report-history', reportId],
    queryFn: () =>
      customFetch<ReportExecution[]>({
        url: `/api/v1/admin/reports/${reportId}/history`,
        method: 'GET',
        params: { limit: '25' },
      }),
    enabled: !!reportId,
  });
}
```

- [ ] **Step 2: Add Run/History UI to `reports-page.tsx`**

In `src/admin/reports/reports-page.tsx`:

1. Import the new hooks: `useRunReport`, `useReportHistory`, `ReportExecution`
2. Import: `Play`, `Clock`, `Download` from `lucide-react`
3. Import: `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle` from `@/core/ui/sheet`
4. Import: `Badge` from `@/core/ui/badge`

Add state for the history sheet:
```tsx
const [historyReportId, setHistoryReportId] = useState<string | undefined>();
const runReport = useRunReport();
const { data: history = [] } = useReportHistory(historyReportId);
```

In the actions column for each report row, add two buttons:

```tsx
<Button
  variant="ghost"
  size="sm"
  disabled={runReport.isPending}
  onClick={() => runReport.mutate(report.id)}
>
  <Play className="h-4 w-4" />
</Button>
<Button
  variant="ghost"
  size="sm"
  onClick={() => setHistoryReportId(report.id)}
>
  <Clock className="h-4 w-4" />
</Button>
```

Add a Sheet at the bottom of the component for history:

```tsx
<Sheet open={!!historyReportId} onOpenChange={(open) => !open && setHistoryReportId(undefined)}>
  <SheetContent>
    <SheetHeader>
      <SheetTitle>Execution History</SheetTitle>
    </SheetHeader>
    <div className="mt-4 space-y-3">
      {history.map((exec) => (
        <div key={exec.id} className="flex items-center justify-between rounded-md border p-3">
          <div>
            <Badge variant={exec.status === 'Completed' ? 'default' : exec.status === 'Failed' ? 'destructive' : 'secondary'}>
              {exec.status}
            </Badge>
            <p className="mt-1 text-xs text-muted-foreground">{new Date(exec.startedAt).toLocaleString()}</p>
          </div>
          {exec.status === 'Completed' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(`/api/v1/admin/reports/${historyReportId}/history/${exec.id}/download`)}
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      {history.length === 0 && <p className="text-sm text-muted-foreground">No executions yet</p>}
    </div>
  </SheetContent>
</Sheet>
```

- [ ] **Step 3: Verify build**

Run: `cd /media/Data/Source/IPcom/Asterisk.Platform.Web && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/core/api/hooks/use-reports.ts src/admin/reports/reports-page.tsx
git commit -m "feat(reports): add run, history, and download functionality"
```

---

### Task 18: Tenant Suspend/Activate Quick-Actions (C2)

**Files:**
- Modify: `src/admin/tenants/tenants-page.tsx`

- [ ] **Step 1: Add suspend/activate dropdown items**

In `src/admin/tenants/tenants-page.tsx`, find the row actions dropdown (where Edit, Delete, Retention Policy actions are). Add:

```tsx
{tenant.status === 'Active' && (
  <DropdownMenuItem
    className="text-destructive"
    onClick={() => {
      setSuspendTarget(tenant);
    }}
  >
    Suspend
  </DropdownMenuItem>
)}
{tenant.status === 'Suspended' && (
  <DropdownMenuItem
    onClick={() => {
      updateTenant.mutate({ id: tenant.tenantId, status: 'Active' });
    }}
  >
    Activate
  </DropdownMenuItem>
)}
```

Add state: `const [suspendTarget, setSuspendTarget] = useState<Tenant | null>(null);`

Add a `ConfirmDeleteDialog` for suspend (it's a destructive action):
```tsx
<ConfirmDeleteDialog
  open={!!suspendTarget}
  onOpenChange={(open) => !open && setSuspendTarget(null)}
  entityName={suspendTarget?.name ?? ''}
  entityType="tenant"
  onConfirm={() => {
    if (suspendTarget) {
      updateTenant.mutate({ id: suspendTarget.tenantId, status: 'Suspended' });
      setSuspendTarget(null);
    }
  }}
/>
```

Import `ConfirmDeleteDialog` if not already imported.

- [ ] **Step 2: Verify build**

Run: `cd /media/Data/Source/IPcom/Asterisk.Platform.Web && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/admin/tenants/tenants-page.tsx
git commit -m "feat(tenants): add suspend/activate quick-actions in row dropdown"
```

---

### Task 19: Campaign Wizard Zod Validation (C3)

**Files:**
- Modify: `src/admin/campaigns/campaign-wizard.tsx`
- Modify: `src/admin/campaigns/steps/basic-step.tsx`
- Modify: `src/admin/campaigns/steps/dialing-step.tsx`
- Modify: `src/admin/campaigns/steps/schedule-step.tsx`

- [ ] **Step 1: Add Zod schemas to campaign-wizard.tsx**

In `src/admin/campaigns/campaign-wizard.tsx`, add schemas before the component:

```tsx
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const stepSchemas = {
  basic: z.object({
    name: z.string().min(2, 'Campaign name must be at least 2 characters'),
    queueId: z.string().min(1, 'Queue is required'),
  }),
  dialing: z.object({
    dialingMode: z.string().min(1, 'Dialing mode is required'),
    maxChannels: z.coerce.number().int().positive('Must be a positive number'),
  }),
  schedule: z.object({
    timezone: z.string().min(1, 'Timezone is required'),
    startDate: z.string().min(1, 'Start date is required'),
  }),
} as const;

type StepKey = keyof typeof stepSchemas;
```

In the `useForm` call, add the resolver for the current step. Since the wizard is multi-step and each step validates different fields, use a dynamic resolver:

```tsx
const currentSchema = stepSchemas[currentStepKey as StepKey];
const methods = useForm<CampaignFormValues>({
  defaultValues: DEFAULT_VALUES,
  resolver: currentSchema ? (zodResolver(currentSchema) as any) : undefined,
});
```

Note: The `as any` cast follows the existing project pattern for Zod v4 + react-hook-form compatibility.

- [ ] **Step 2: Add error display to basic-step.tsx**

In `src/admin/campaigns/steps/basic-step.tsx`, add error messages below each field:

```tsx
const { register, formState: { errors } } = useFormContext<CampaignFormValues>();

// After the name input:
{errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}

// After the queue select:
{errors.queueId && <p className="text-sm text-destructive">{errors.queueId.message}</p>}
```

- [ ] **Step 3: Add error display to dialing-step.tsx and schedule-step.tsx**

Same pattern — destructure `errors` from `useFormContext` and add error messages below each validated field.

- [ ] **Step 4: Verify build**

Run: `cd /media/Data/Source/IPcom/Asterisk.Platform.Web && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/admin/campaigns/campaign-wizard.tsx src/admin/campaigns/steps/basic-step.tsx src/admin/campaigns/steps/dialing-step.tsx src/admin/campaigns/steps/schedule-step.tsx
git commit -m "feat(campaigns): add Zod validation schemas and error messages to wizard steps"
```

---

### Task 20: GDPR Purge-User + Preview (C4)

**Files:**
- Modify: `src/core/api/hooks/use-gdpr.ts`
- Modify: `src/admin/gdpr/gdpr-page.tsx`

- [ ] **Step 1: Add hooks to `use-gdpr.ts`**

Add after the existing `useGdprPurge`:

```tsx
// --- Purge Preview ---

export interface PurgePreview {
  conversations: number;
  messages: number;
  authEvents: number;
  auditEntries: number;
}

export function usePurgePreview(userId: string | undefined) {
  return useQuery({
    queryKey: ['gdpr', 'purge-preview', userId],
    queryFn: () =>
      customFetch<PurgePreview>({
        url: '/api/v1/admin/gdpr/purge-preview',
        method: 'GET',
        params: { userId: userId! },
      }),
    enabled: !!userId,
  });
}

// --- Purge User ---

export function useGdprPurgeUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { userId: string; reason: string }) =>
      customFetch<PurgeResult>({
        url: '/api/v1/admin/gdpr/purge-user',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purge-log'] });
      toast.success('User data purged');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
```

- [ ] **Step 2: Add User tab to `gdpr-page.tsx`**

In `src/admin/gdpr/gdpr-page.tsx`:

1. Import: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `@/core/ui/tabs`
2. Import: `usePurgePreview`, `useGdprPurgeUser` from the hook file
3. Wrap the existing contact export/purge sections in a `<TabsContent value="contact">` and add a new `<TabsContent value="user">`:

```tsx
<Tabs defaultValue="contact">
  <TabsList>
    <TabsTrigger value="contact">By Contact ID</TabsTrigger>
    <TabsTrigger value="user">By User ID</TabsTrigger>
  </TabsList>

  <TabsContent value="contact">
    {/* existing export + purge UI */}
  </TabsContent>

  <TabsContent value="user">
    {/* New user purge UI with userId input, Preview button showing PurgePreview counts, and Purge with confirm */}
  </TabsContent>
</Tabs>
```

The "User" tab should have:
- Input field for userId
- "Preview" button that triggers `usePurgePreview(userId)`
- When preview data is loaded, show entity counts (conversations, messages, auth events, audit entries)
- "Purge User Data" button with reason field and confirmation dialog
- On confirm, call `purgeUser.mutateAsync({ userId, reason })`

- [ ] **Step 3: Verify build**

Run: `cd /media/Data/Source/IPcom/Asterisk.Platform.Web && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/core/api/hooks/use-gdpr.ts src/admin/gdpr/gdpr-page.tsx
git commit -m "feat(gdpr): add purge-by-user with preview and user tab in GDPR page"
```

---

### Task 21: Webhook Circuit-Breaker (C5)

**Files:**
- Modify: `src/core/api/hooks/use-webhooks.ts`
- Modify: `src/admin/webhooks/webhook-detail-sheet.tsx`

- [ ] **Step 1: Add hooks to `use-webhooks.ts`**

Add after the existing hooks:

```tsx
export interface CircuitBreakerStatus {
  state: 'Closed' | 'Open' | 'HalfOpen';
  failureCount: number;
  lastFailureAt: string | null;
  nextRetryAt: string | null;
}

export function useCircuitStatus(subscriptionId: string | undefined) {
  return useQuery({
    queryKey: ['webhook-circuit', subscriptionId],
    queryFn: () =>
      customFetch<CircuitBreakerStatus>({
        url: `/api/v1/webhooks/subscriptions/${subscriptionId}/circuit-status`,
        method: 'GET',
      }),
    enabled: !!subscriptionId,
  });
}

export function useResetCircuit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subscriptionId: string) =>
      customFetch<void>({
        url: `/api/v1/webhooks/subscriptions/${subscriptionId}/reset-circuit`,
        method: 'POST',
      }),
    onSuccess: (_data, subscriptionId) => {
      qc.invalidateQueries({ queryKey: ['webhook-circuit', subscriptionId] });
      toast.success('Circuit breaker reset');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
```

- [ ] **Step 2: Add circuit-breaker UI to `webhook-detail-sheet.tsx`**

In `src/admin/webhooks/webhook-detail-sheet.tsx`:

1. Import: `useCircuitStatus`, `useResetCircuit` from the hooks
2. Import: `Badge` from `@/core/ui/badge`
3. Call: `const { data: circuit } = useCircuitStatus(subscription?.id);`
4. Call: `const resetCircuit = useResetCircuit();`

Add a circuit-breaker section near the Active/Inactive badge:

```tsx
{circuit && (
  <div className="flex items-center gap-2">
    <Badge variant={
      circuit.state === 'Closed' ? 'default' :
      circuit.state === 'Open' ? 'destructive' : 'secondary'
    }>
      Circuit: {circuit.state}
    </Badge>
    {circuit.state === 'Open' && (
      <Button
        variant="outline"
        size="sm"
        disabled={resetCircuit.isPending}
        onClick={() => resetCircuit.mutate(subscription!.id)}
      >
        Reset Circuit
      </Button>
    )}
    {circuit.failureCount > 0 && (
      <span className="text-xs text-muted-foreground">
        {circuit.failureCount} failures
      </span>
    )}
  </div>
)}
```

- [ ] **Step 3: Verify build**

Run: `cd /media/Data/Source/IPcom/Asterisk.Platform.Web && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/core/api/hooks/use-webhooks.ts src/admin/webhooks/webhook-detail-sheet.tsx
git commit -m "feat(webhooks): add circuit-breaker status display and reset action"
```

---

### Task 22: Invoice Pay + Dunning Status (C6 + C7)

**Files:**
- Modify: `src/core/api/hooks/use-billing.ts`
- Modify: `src/admin/billing/invoices-page.tsx`
- Modify: `src/admin/billing/quotas-page.tsx`

- [ ] **Step 1: Add hooks to `use-billing.ts`**

Add to the `Invoice` interface:
```tsx
paymentStatus?: string;
dueDate?: string | null;
```

Add after the existing invoice hooks:

```tsx
export function usePayInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: string) =>
      customFetch<void>({
        url: `/api/v1/management/invoices/${invoiceId}/pay`,
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing', 'invoices'] });
      toast.success('Invoice marked as paid');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export interface DunningStatus {
  isActive: boolean;
  phase: string | null;
  daysOverdue: number;
  overdueAmount: number;
  invoiceId: string | null;
}

export function useDunningStatus(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['billing', 'dunning', tenantId],
    queryFn: () =>
      customFetch<DunningStatus>({
        url: `/api/v1/management/tenants/${tenantId}/dunning`,
        method: 'GET',
      }),
    enabled: !!tenantId,
  });
}
```

- [ ] **Step 2: Add "Mark Paid" to invoices-page.tsx**

In `src/admin/billing/invoices-page.tsx`:

1. Import `usePayInvoice` from `use-billing`
2. Call: `const payInvoice = usePayInvoice();`
3. In the actions column, add a "Mark Paid" button visible when `invoice.status === 'Issued'`:

```tsx
{invoice.status === 'Issued' && (
  <Button
    variant="outline"
    size="sm"
    disabled={payInvoice.isPending}
    onClick={() => payInvoice.mutate(invoice.id)}
  >
    Mark Paid
  </Button>
)}
```

4. In the detail sheet, show `paymentStatus` and `dueDate` if present.

- [ ] **Step 3: Add dunning banner to quotas-page.tsx**

In `src/admin/billing/quotas-page.tsx`:

1. Import `useDunningStatus` from `use-billing`
2. Get the active tenant ID (same pattern used for billing tenant): `const tenantId = useBillingTenantId();` (or however it's resolved in this file)
3. Call: `const { data: dunning } = useDunningStatus(tenantId || undefined);`
4. Above the quotas content, add a conditional banner:

```tsx
{dunning?.isActive && (
  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
    <div className="flex items-center justify-between">
      <div>
        <Badge variant="secondary">{dunning.phase}</Badge>
        <span className="ml-2 text-sm text-amber-800 dark:text-amber-200">
          {dunning.daysOverdue} days overdue — ${dunning.overdueAmount.toFixed(2)}
        </span>
      </div>
      <Button variant="link" size="sm" onClick={() => navigate('/admin/billing/invoices')}>
        View Invoice
      </Button>
    </div>
  </div>
)}
```

- [ ] **Step 4: Verify build**

Run: `cd /media/Data/Source/IPcom/Asterisk.Platform.Web && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/core/api/hooks/use-billing.ts src/admin/billing/invoices-page.tsx src/admin/billing/quotas-page.tsx
git commit -m "feat(billing): add invoice pay action and dunning status banner in quotas"
```

---

### Task 23: Contacts DELETE (C8)

**Files:**
- Modify: `src/core/api/hooks/use-contacts.ts`
- Modify: `src/agent/context/contact-info.tsx`

- [ ] **Step 1: Add `useDeleteContact` hook**

In `src/core/api/hooks/use-contacts.ts`, add after `useUpdateContact`:

```tsx
export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/contacts/${id}`,
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
```

- [ ] **Step 2: Add Delete action to contact-info.tsx**

In `src/agent/context/contact-info.tsx`, add a "Delete Contact" button. Read the file first to understand the current action buttons layout. Add:

1. Import: `useDeleteContact` from `use-contacts`
2. Import: `ConfirmDeleteDialog` from `@/core/ui/confirm-delete-dialog`
3. Import: `Trash2` from `lucide-react`
4. Add state: `const [deleteOpen, setDeleteOpen] = useState(false);`
5. Call: `const deleteContact = useDeleteContact();`
6. Add the button (gated by permission if `useHasPermission` is available):

```tsx
<Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)}>
  <Trash2 className="h-4 w-4" />
</Button>

<ConfirmDeleteDialog
  open={deleteOpen}
  onOpenChange={setDeleteOpen}
  entityName={contact?.firstName ?? 'Contact'}
  entityType="contact"
  onConfirm={() => {
    if (contact) {
      deleteContact.mutate(contact.id);
      setDeleteOpen(false);
    }
  }}
/>
```

- [ ] **Step 3: Verify build**

Run: `cd /media/Data/Source/IPcom/Asterisk.Platform.Web && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/core/api/hooks/use-contacts.ts src/agent/context/contact-info.tsx
git commit -m "feat(contacts): add delete contact hook and action in agent workspace"
```

---

### Task 24: ErrorBoundary per Route (C9)

**Files:**
- Create: `src/core/ui/route-error-boundary.tsx`
- Modify: `src/router.tsx`

- [ ] **Step 1: Create `route-error-boundary.tsx`**

Create `src/core/ui/route-error-boundary.tsx`:

```tsx
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/core/ui/button';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Route error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
          <h2 className="text-lg font-semibold">Something went wrong on this page</h2>
          <p className="text-sm text-muted-foreground">
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try Again
            </Button>
            <Button variant="ghost" onClick={() => (window.location.href = '/admin')}>
              Go Home
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

- [ ] **Step 2: Apply to main layout routes in `router.tsx`**

In `src/router.tsx`, import the error boundary:
```tsx
import { RouteErrorBoundary } from '@/core/ui/route-error-boundary';
```

Add `errorElement: <RouteErrorBoundary />` to the 4 main layout route objects. Find each layout route (`admin`, `agent`, `analytics`, `operations`) and add the property.

For example, the admin layout route (around line 106):
```tsx
{
  path: 'admin',
  errorElement: <RouteErrorBoundary />,
  element: (
    <PermissionGuard ...>
      <LazyLoad><AdminLayout /></LazyLoad>
    </PermissionGuard>
  ),
  children: [...]
}
```

Do the same for the `operations`, `analytics`, and `agent` layout routes.

- [ ] **Step 3: Verify build**

Run: `cd /media/Data/Source/IPcom/Asterisk.Platform.Web && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/core/ui/route-error-boundary.tsx src/router.tsx
git commit -m "feat(core): add per-route ErrorBoundary to isolate page crashes"
```

---

### Task 25: Dead Code Cleanup (C10 remaining)

**Files:**
- Modify: `src/core/auth/auth-store.ts`
- Modify: `src/core/auth/auth-store.test.ts` (if it exists)

- [ ] **Step 1: Remove `hasFeature` and `hasAnyPermission` from auth-store**

In `src/core/auth/auth-store.ts`:

1. Remove `hasFeature: (feature: string) => boolean;` from the `AuthState` interface (line 47)
2. Remove `hasAnyPermission: (...permissions: string[]) => boolean;` from the interface (line 49)
3. Remove the implementations:
   - `hasFeature: (feature) => get().features[feature] === true,` (line 95)
   - `hasAnyPermission: (...permissions) => permissions.some((p) => get().permissions.includes(p)),` (line 97-98)

Keep `hasPermission` — it is the same pattern but need to verify it's used. Search for `hasPermission` usage. If it's also unused, remove it too. If it's used by `useHasPermission` hook or `PermissionGuard`, keep it.

- [ ] **Step 2: Remove corresponding test cases**

Search for `auth-store.test.ts` or similar. If tests exist for `hasFeature` and `hasAnyPermission`, remove those test cases.

- [ ] **Step 3: Verify build and tests**

```bash
cd /media/Data/Source/IPcom/Asterisk.Platform.Web && npx tsc --noEmit && npm run test
```
Expected: 0 errors, all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/core/auth/auth-store.ts
git commit -m "refactor(auth): remove unused hasFeature and hasAnyPermission from auth store"
```

---

## Final Verification

After all 25 tasks are complete:

```bash
cd /media/Data/Source/IPcom/Asterisk.Platform.Web && npm run build && npm run test && npm run lint
cd /media/Data/Source/IPcom/Asterisk.Platform && dotnet build Asterisk.Platform.slnx && dotnet test Asterisk.Platform.slnx -v q
```

Expected:
- Platform.Web: 0 TypeScript errors, all unit tests pass, lint baseline unchanged
- Platform: 0 warnings, all tests pass

## Task Summary

| Phase | Tasks | Items Covered |
|-------|-------|---------------|
| 1: URL & Type Fixes | T1-T5 | A1, A2, A4, A6, C10 partial |
| 2: Auth & Core | T6-T9 | A7, B3, A3, B2 |
| 3: Analytics Filters | T10-T11 | A8 |
| 4: Billing & System | T12-T13 | A9, A10 |
| 5: UX Quality | T14-T16 | B1, B5, B6, A5 |
| 6: Features | T17-T25 | C1-C10 |

**Note:** B4 (Agent mutations onError) was dropped — verified that all 5 conversation mutations already have `onError: (err: Error) => toast.error(err.message)`. The original audit was incorrect.
