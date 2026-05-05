# Track 4A — Tenant Lifecycle UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gap between the Platform backend's tenant management capabilities and what the Web UI exposes — dunning states, tenant hierarchy, dedicated suspend/activate, IP allowlist, public setup, and admin home.

**Architecture:** Enhance existing tenant hooks and pages with 6-state status support and type/hierarchy fields. Add IP allowlist tab to tenant detail. Create a public setup page for first-time platform initialization. Replace the admin index redirect with an actual home page embedding the existing setup banner.

**Tech Stack:** React 19, TypeScript 6, TanStack Query 5, React Hook Form + Zod, Vitest + Testing Library, MSW, Lucide React, i18next

---

## Scope Correction: What Already Exists

The spec assumed these features didn't exist — they DO:

| Feature              | Existing File                          | Status                                            |
| -------------------- | -------------------------------------- | ------------------------------------------------- |
| System Hub Page      | `src/admin/system/system-page.tsx`     | ✅ Complete — license card + settings form        |
| License Page         | `src/admin/license/license-page.tsx`   | ✅ Complete — full admin surface                  |
| System hooks (5)     | `src/core/api/hooks/use-system.ts`     | ✅ Complete — info, license, settings, update     |
| Onboarding hooks (4) | `src/core/api/hooks/use-onboarding.ts` | ✅ Complete — status, complete, dismiss, template |
| Setup Wizard         | `src/admin/setup/setup-wizard.tsx`     | ✅ Complete — 5-step wizard (authenticated)       |
| Setup Banner         | `src/admin/setup/setup-banner.tsx`     | ✅ Complete — progress bar + dismiss              |
| Sidebar System group | `src/admin/sidebar.tsx:407-510`        | ✅ Complete — 11 entries                          |

**Remaining actual gaps (this plan):**

1. Dunning states (6 of 6 vs current 3) + tenant types/hierarchy
2. Dedicated `POST /{id}/suspend` and `POST /{id}/activate` mutations
3. IP Allowlist tab in tenant detail
4. Public setup page at `/setup` for `POST /setup` (AllowAnonymous first-time init)
5. Admin home page (replace `Navigate to="users"` redirect)

---

## FCM Batching

| Phase           | Tasks      | Risk                                              | Execution  |
| --------------- | ---------- | ------------------------------------------------- | ---------- |
| A — Hooks       | 1, 2       | Minimal — pure TS interfaces + mutations          | Batch      |
| B — UI          | 3, 4, 5, 6 | Medium — modifying complex pages + new components | Individual |
| C — Integration | 7          | Low — routing + i18n + version bump               | Batch      |

---

### Task 1: Expand tenant hooks — types, interfaces, suspend/activate

**Files:**

- Modify: `src/core/api/hooks/use-tenants.ts`
- Test: `src/core/api/hooks/use-tenants.test.tsx`

- [ ] **Step 1: Write failing tests for useSuspendTenant and useActivateTenant**

Add to the existing test file `src/core/api/hooks/use-tenants.test.tsx`:

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as client from '@/core/api/client';
import {
  useSuspendTenant,
  useActivateTenant,
  type TenantStatus,
  type TenantType,
} from '@/core/api/hooks/use-tenants';

vi.mock('@/core/api/client');
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('useSuspendTenant', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should POST to /management/tenants/{id}/suspend', async () => {
    vi.mocked(client.customFetch).mockResolvedValue({ id: 'tenant-1', status: 'Suspended' });
    const { result } = renderHook(() => useSuspendTenant(), { wrapper: createWrapper() });
    result.current.mutate('tenant-1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/tenants/tenant-1/suspend',
      method: 'POST',
    });
  });
});

describe('useActivateTenant', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should POST to /management/tenants/{id}/activate', async () => {
    vi.mocked(client.customFetch).mockResolvedValue({ id: 'tenant-1', status: 'Active' });
    const { result } = renderHook(() => useActivateTenant(), { wrapper: createWrapper() });
    result.current.mutate('tenant-1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/tenants/tenant-1/activate',
      method: 'POST',
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/api/hooks/use-tenants.test.tsx`
Expected: FAIL — `useSuspendTenant` and `useActivateTenant` not exported

- [ ] **Step 3: Implement types and mutations in use-tenants.ts**

Replace the existing `Tenant`, `CreateTenantInput`, `UpdateTenantInput` interfaces and add new hooks. The full file after changes:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────────────────

export type TenantStatus =
  | 'Active'
  | 'Suspended'
  | 'Deleted'
  | 'Warning'
  | 'Degraded'
  | 'PendingDeletion';
export type TenantType = 'Platform' | 'Partner' | 'Customer';

export interface Tenant {
  tenantId: string;
  name: string;
  status: TenantStatus;
  type: TenantType;
  parentTenantId: string | null;
  maxConcurrentChannels: number;
  maxActiveCampaigns: number;
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface TenantStats {
  tenantId: string;
  status: string;
  maxConcurrentChannels: number;
  maxActiveCampaigns: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantInput {
  tenantId: string;
  name: string;
  type?: TenantType;
  parentTenantId?: string;
  maxConcurrentChannels?: number;
  maxActiveCampaigns?: number;
  metadata?: Record<string, string>;
  template?: string;
}

export interface UpdateTenantInput {
  name?: string;
  status?: string;
  maxConcurrentChannels?: number;
  maxActiveCampaigns?: number;
}

export interface StatusUpdateResponse {
  id: string;
  status: string;
}

// ─── Query hooks ────────────────────────────────────────────────────────────

export function useTenants() {
  return useQuery({
    queryKey: ['tenants'],
    queryFn: () => customFetch<Tenant[]>({ url: '/api/v1/management/tenants', method: 'GET' }),
  });
}

export function useTenant(id: string) {
  return useQuery({
    queryKey: ['tenant', id],
    queryFn: () => customFetch<Tenant>({ url: `/api/v1/management/tenants/${id}`, method: 'GET' }),
    enabled: !!id,
  });
}

// ─── Mutation hooks ─────────────────────────────────────────────────────────

export function useCreateTenant() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: CreateTenantInput) =>
      customFetch<Tenant>({ url: '/api/v1/management/tenants', method: 'POST', data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      toast.success(t('toasts.tenants.created'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateTenant() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateTenantInput) =>
      customFetch<Tenant>({ url: `/api/v1/management/tenants/${id}`, method: 'PUT', data }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      qc.invalidateQueries({ queryKey: ['tenant', variables.id] });
      toast.success(t('toasts.tenants.updated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteTenant() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({ url: `/api/v1/management/tenants/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      toast.success(t('toasts.tenants.deleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSuspendTenant() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<StatusUpdateResponse>({
        url: `/api/v1/management/tenants/${id}/suspend`,
        method: 'POST',
      }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      qc.invalidateQueries({ queryKey: ['tenant', id] });
      toast.success(t('toasts.tenants.suspended'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useActivateTenant() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<StatusUpdateResponse>({
        url: `/api/v1/management/tenants/${id}/activate`,
        method: 'POST',
      }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      qc.invalidateQueries({ queryKey: ['tenant', id] });
      toast.success(t('toasts.tenants.activated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/core/api/hooks/use-tenants.test.tsx`
Expected: ALL PASS

- [ ] **Step 5: Run full test suite + lint + build**

Run: `npm run test && npm run lint && npm run build`
Expected: 800+ tests pass, 0 lint errors, build green

- [ ] **Step 6: Commit**

```bash
git add src/core/api/hooks/use-tenants.ts src/core/api/hooks/use-tenants.test.tsx
git commit -m "feat(tenants): expand types with dunning states + hierarchy + suspend/activate hooks"
```

---

### Task 2: Add IP allowlist hooks to use-tenant-settings.ts

**Files:**

- Modify: `src/admin/tenants/use-tenant-settings.ts`
- Test: `src/admin/tenants/use-tenant-settings.test.tsx` (create if not exists, or add to existing)

- [ ] **Step 1: Write failing tests for IP allowlist hooks**

Create or append to `src/admin/tenants/use-tenant-settings.test.tsx`:

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as client from '@/core/api/client';
import {
  useIpAllowlist,
  useAddIpAllowlistEntry,
  useRemoveIpAllowlistEntry,
  type IpAllowlistEntry,
} from '@/admin/tenants/use-tenant-settings';

vi.mock('@/core/api/client');
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('useIpAllowlist', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should GET /management/tenants/{id}/ip-allowlist', async () => {
    const entries: IpAllowlistEntry[] = [
      { id: 'e1', cidr: '10.0.0.0/8', description: 'VPN', createdAt: '2026-01-01T00:00:00Z' },
    ];
    vi.mocked(client.customFetch).mockResolvedValue(entries);
    const { result } = renderHook(() => useIpAllowlist('t1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(entries);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/tenants/t1/ip-allowlist',
      method: 'GET',
    });
  });
});

describe('useAddIpAllowlistEntry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should POST to /management/tenants/{id}/ip-allowlist', async () => {
    vi.mocked(client.customFetch).mockResolvedValue({ id: 'e2', cidr: '192.168.1.0/24', description: 'Office', createdAt: '2026-05-04T00:00:00Z' });
    const { result } = renderHook(() => useAddIpAllowlistEntry('t1'), { wrapper: createWrapper() });
    result.current.mutate({ cidr: '192.168.1.0/24', description: 'Office' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/tenants/t1/ip-allowlist',
      method: 'POST',
      data: { cidr: '192.168.1.0/24', description: 'Office' },
    });
  });
});

describe('useRemoveIpAllowlistEntry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should DELETE /management/tenants/{id}/ip-allowlist/{entryId}', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useRemoveIpAllowlistEntry('t1'), { wrapper: createWrapper() });
    result.current.mutate('entry-abc');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/tenants/t1/ip-allowlist/entry-abc',
      method: 'DELETE',
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/admin/tenants/use-tenant-settings.test.tsx`
Expected: FAIL — hooks not exported

- [ ] **Step 3: Add IP allowlist types and hooks to use-tenant-settings.ts**

Append after the existing `useUpdateTenantSettings` function in `src/admin/tenants/use-tenant-settings.ts`:

```typescript
// ─── IP Allowlist ───────────────────────────────────────────────────────────

export interface IpAllowlistEntry {
  id: string;
  cidr: string;
  description: string;
  createdAt: string;
}

export interface CreateIpAllowlistInput {
  cidr: string;
  description: string;
}

export function ipAllowlistQueryKey(tenantId: string) {
  return ['ip-allowlist', tenantId] as const;
}

export function useIpAllowlist(tenantId: string) {
  return useQuery({
    queryKey: ipAllowlistQueryKey(tenantId),
    queryFn: () =>
      customFetch<IpAllowlistEntry[]>({
        url: `/api/v1/management/tenants/${tenantId}/ip-allowlist`,
        method: 'GET',
      }),
    enabled: !!tenantId,
  });
}

export function useAddIpAllowlistEntry(tenantId: string) {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: CreateIpAllowlistInput) =>
      customFetch<IpAllowlistEntry>({
        url: `/api/v1/management/tenants/${tenantId}/ip-allowlist`,
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ipAllowlistQueryKey(tenantId) });
      toast.success(t('toasts.ipAllowlist.added'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveIpAllowlistEntry(tenantId: string) {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (entryId: string) =>
      customFetch<void>({
        url: `/api/v1/management/tenants/${tenantId}/ip-allowlist/${entryId}`,
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ipAllowlistQueryKey(tenantId) });
      toast.success(t('toasts.ipAllowlist.removed'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/admin/tenants/use-tenant-settings.test.tsx`
Expected: ALL PASS

- [ ] **Step 5: Run full test suite + lint + build**

Run: `npm run test && npm run lint && npm run build`
Expected: 800+ tests pass, 0 lint errors, build green

- [ ] **Step 6: Commit**

```bash
git add src/admin/tenants/use-tenant-settings.ts src/admin/tenants/use-tenant-settings.test.tsx
git commit -m "feat(tenants): add IP allowlist hooks for per-tenant CIDR management"
```

---

### Task 3: Enhance tenants-page.tsx — dunning states, type column, dedicated suspend/activate

**Files:**

- Modify: `src/admin/tenants/tenants-page.tsx`

This is the largest modification. Changes:

1. Expand `STATUS_VARIANT` from 3 to 6 states with proper styling
2. Add `type` column with badge
3. Add `type` and `parentTenantId` fields to create form
4. Replace `useUpdateTenant` status calls with `useSuspendTenant` / `useActivateTenant`
5. Show Warning/Degraded/PendingDeletion action buttons

- [ ] **Step 1: Update imports and STATUS_VARIANT map**

In `src/admin/tenants/tenants-page.tsx`, replace the imports and STATUS_VARIANT:

Old imports (line 7):

```typescript
import { Plus, Building2, Trash2, Pencil, Clock, CreditCard, Ban, CircleCheck } from 'lucide-react';
```

New imports:

```typescript
import {
  Plus,
  Building2,
  Trash2,
  Pencil,
  Clock,
  CreditCard,
  Ban,
  CircleCheck,
  TriangleAlert,
  OctagonAlert,
  Timer,
} from 'lucide-react';
```

Old hook import (lines 31-37):

```typescript
import {
  useTenants,
  useCreateTenant,
  useUpdateTenant,
  useDeleteTenant,
  type Tenant,
} from '@/core/api/hooks/use-tenants';
```

New hook import:

```typescript
import {
  useTenants,
  useCreateTenant,
  useUpdateTenant,
  useDeleteTenant,
  useSuspendTenant,
  useActivateTenant,
  type Tenant,
  type TenantStatus,
} from '@/core/api/hooks/use-tenants';
```

Old STATUS_VARIANT (lines 59-63):

```typescript
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  suspended: 'secondary',
  deleted: 'destructive',
};
```

New STATUS_VARIANT with styling config:

```typescript
interface StatusConfig {
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  active: { variant: 'default' },
  warning: { variant: 'outline', className: 'text-amber-600 border-amber-300' },
  degraded: { variant: 'outline', className: 'text-orange-600 border-orange-300' },
  suspended: { variant: 'secondary' },
  pendingdeletion: { variant: 'destructive' },
  deleted: { variant: 'destructive' },
};

const STATUS_HINT: Record<string, string> = {
  warning: 'tenants.list.status_hint.warning',
  degraded: 'tenants.list.status_hint.degraded',
  pendingdeletion: 'tenants.list.status_hint.pending_deletion',
};

function canSuspend(status: string): boolean {
  const s = status.toLowerCase();
  return s === 'active' || s === 'warning' || s === 'degraded';
}

function canActivate(status: string): boolean {
  const s = status.toLowerCase();
  return s === 'suspended' || s === 'pendingdeletion';
}
```

- [ ] **Step 2: Update the component to use dedicated suspend/activate**

In the component body, replace:

Old (line 85):

```typescript
const updateTenant = useUpdateTenant();
```

Add:

```typescript
const updateTenant = useUpdateTenant();
const suspendTenant = useSuspendTenant();
const activateTenant = useActivateTenant();
```

- [ ] **Step 3: Update status column cell renderer**

Replace the status column cell (lines 146-158) with:

```typescript
columnHelper.accessor('status', {
  header: () => t('tenants.list.columns.status'),
  cell: (info) => {
    const s = info.getValue().toLowerCase();
    const config = STATUS_CONFIG[s] ?? { variant: 'outline' as const };
    const hintKey = STATUS_HINT[s];
    return (
      <div className="flex items-center gap-1.5">
        <Badge
          data-testid={`tenant-status-${info.row.original.tenantId}`}
          variant={config.variant}
          className={config.className}
        >
          {info.getValue()}
        </Badge>
        {hintKey && (
          <span className="text-xs text-muted-foreground">{t(hintKey)}</span>
        )}
      </div>
    );
  },
}),
```

- [ ] **Step 4: Add type column after status**

Insert after the status column:

```typescript
columnHelper.accessor('type', {
  header: () => t('tenants.list.columns.type'),
  cell: (info) => (
    <Badge variant="outline" data-testid={`tenant-type-${info.row.original.tenantId}`}>
      {info.getValue()}
    </Badge>
  ),
}),
```

- [ ] **Step 5: Update action buttons to use canSuspend/canActivate**

Replace the suspend/activate button block (lines 217-244) with:

```typescript
{canSuspend(row.original.status) && (
  <Button
    variant="ghost"
    size="sm"
    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
    title={t('tenants.list.actions.suspend')}
    aria-label={t('tenants.list.actions.suspend')}
    onClick={(e) => {
      e.stopPropagation();
      setSuspendTarget(row.original);
    }}
  >
    <Ban className="h-3.5 w-3.5" />
  </Button>
)}
{canActivate(row.original.status) && (
  <Button
    variant="ghost"
    size="sm"
    className="h-7 w-7 p-0 text-emerald-600"
    title={t('tenants.list.actions.activate')}
    aria-label={t('tenants.list.actions.activate')}
    onClick={(e) => {
      e.stopPropagation();
      activateTenant.mutate(row.original.tenantId);
    }}
  >
    <CircleCheck className="h-3.5 w-3.5" />
  </Button>
)}
```

- [ ] **Step 6: Update suspend confirm dialog to use dedicated hook**

Replace the suspend confirm dialog's `onConfirm` (lines 412-418):

Old:

```typescript
onConfirm={() => {
  if (suspendTarget) {
    updateTenant.mutate({ id: suspendTarget.tenantId, status: 'Suspended' });
    setSuspendTarget(null);
  }
}}
```

New:

```typescript
onConfirm={() => {
  if (suspendTarget) {
    suspendTenant.mutate(suspendTarget.tenantId);
    setSuspendTarget(null);
  }
}}
```

- [ ] **Step 7: Add type + parentTenantId fields to create form schema**

Update the create schema (lines 45-53):

```typescript
const createSchema = z.object({
  tenantId: z
    .string()
    .min(1, 'admin:tenants.validation.tenantIdRequired')
    .regex(/^[a-z0-9-]+$/, 'admin:tenants.validation.tenantIdFormat'),
  name: z.string().min(1, 'admin:tenants.validation.nameRequired'),
  type: z.enum(['Customer', 'Partner']).optional(),
  parentTenantId: z.string().optional(),
  maxConcurrentChannels: z.coerce.number().int().min(1).optional(),
  maxActiveCampaigns: z.coerce.number().int().min(1).optional(),
});
```

Add the form fields in the create sheet (`<form>` block, after the name field):

```tsx
<div className="space-y-1.5">
  <Label htmlFor="type">{t('tenants.list.create_sheet.type')}</Label>
  <Select
    value={watch('type') ?? 'Customer'}
    onValueChange={(v) => setValue('type', v as 'Customer' | 'Partner')}
  >
    <SelectTrigger id="type" data-testid="tenants-form-type">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="Customer">{t('tenants.list.create_sheet.type_customer')}</SelectItem>
      <SelectItem value="Partner">{t('tenants.list.create_sheet.type_partner')}</SelectItem>
    </SelectContent>
  </Select>
</div>

<div className="space-y-1.5">
  <Label htmlFor="parentTenantId">{t('tenants.list.create_sheet.parent_tenant')}</Label>
  <Select
    value={watch('parentTenantId') ?? ''}
    onValueChange={(v) => setValue('parentTenantId', v || undefined)}
  >
    <SelectTrigger id="parentTenantId" data-testid="tenants-form-parent">
      <SelectValue placeholder={t('tenants.list.create_sheet.parent_none')} />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="">{t('tenants.list.create_sheet.parent_none')}</SelectItem>
      {tenants
        .filter((t) => t.type === 'Platform' || t.type === 'Partner')
        .map((t) => (
          <SelectItem key={t.tenantId} value={t.tenantId}>
            {t.name} ({t.type})
          </SelectItem>
        ))}
    </SelectContent>
  </Select>
</div>
```

Note: add `watch` and `setValue` to the `useForm` destructuring (line 95):

```typescript
const {
  register,
  handleSubmit,
  reset,
  watch,
  setValue,
  formState: { errors, isSubmitting },
} = useForm<CreateFormValues>({
```

Update `onCreateSubmit` (lines 110-125) to include new fields:

```typescript
const onCreateSubmit = handleSubmit((values) => {
  createTenant.mutate(
    {
      tenantId: values.tenantId,
      name: values.name,
      type: values.type,
      parentTenantId: values.parentTenantId,
      maxConcurrentChannels: values.maxConcurrentChannels,
      maxActiveCampaigns: values.maxActiveCampaigns,
    },
    {
      onSuccess: () => {
        setCreateOpen(false);
        reset();
      },
    },
  );
});
```

- [ ] **Step 8: Update columns useMemo deps**

Replace the deps array (line 264):

Old:

```typescript
[t, updateTenant, handleManageBilling, setDeleteTarget],
```

New:

```typescript
[t, activateTenant, handleManageBilling, setDeleteTarget],
```

- [ ] **Step 9: Run full test suite + lint + build**

Run: `npm run test && npm run lint && npm run build`
Expected: 800+ tests pass, 0 lint errors, build green

- [ ] **Step 10: Commit**

```bash
git add src/admin/tenants/tenants-page.tsx
git commit -m "feat(tenants): 6-state dunning badges + type column + dedicated suspend/activate"
```

---

### Task 4: Enhance tenant-detail-page.tsx — dunning states + type badge

**Files:**

- Modify: `src/admin/tenants/tenant-detail-page.tsx`

- [ ] **Step 1: Update STATUS_VARIANT and add type badge**

Replace the STATUS_VARIANT (lines 14-20):

```typescript
interface StatusConfig {
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  active: { variant: 'default' },
  Active: { variant: 'default' },
  warning: { variant: 'outline', className: 'text-amber-600 border-amber-300' },
  Warning: { variant: 'outline', className: 'text-amber-600 border-amber-300' },
  degraded: { variant: 'outline', className: 'text-orange-600 border-orange-300' },
  Degraded: { variant: 'outline', className: 'text-orange-600 border-orange-300' },
  suspended: { variant: 'secondary' },
  Suspended: { variant: 'destructive' },
  pendingdeletion: { variant: 'destructive' },
  PendingDeletion: { variant: 'destructive' },
  deleted: { variant: 'destructive' },
};
```

Update the badge rendering (lines 50-57) to use `STATUS_CONFIG`:

```tsx
<div className="flex items-center gap-2">
  <span className="font-mono text-xs text-muted-foreground">{tenantId}</span>
  {(() => {
    const config = STATUS_CONFIG[status] ?? { variant: 'outline' as const };
    return (
      <Badge
        variant={config.variant}
        className={config.className}
        data-status={status}
        data-testid="tenant-status-badge"
      >
        {status}
      </Badge>
    );
  })()}
  {tenant?.type && (
    <Badge variant="outline" data-testid="tenant-type-badge">
      {tenant.type}
    </Badge>
  )}
  {plan && <Badge variant="outline">{plan}</Badge>}
</div>
```

- [ ] **Step 2: Run full test suite + lint + build**

Run: `npm run test && npm run lint && npm run build`
Expected: 800+ tests pass, 0 lint errors, build green

- [ ] **Step 3: Commit**

```bash
git add src/admin/tenants/tenant-detail-page.tsx
git commit -m "feat(tenants): 6-state dunning badges + type badge in tenant detail"
```

---

### Task 5: Create IP Allowlist tab component + wire into tenant detail

**Files:**

- Create: `src/admin/tenants/ip-allowlist-tab.tsx`
- Create: `src/admin/tenants/ip-allowlist-tab.test.tsx`
- Modify: `src/admin/tenants/tenant-detail-page.tsx`

- [ ] **Step 1: Write tests for the IP Allowlist tab**

Create `src/admin/tenants/ip-allowlist-tab.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IpAllowlistTab } from './ip-allowlist-tab';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, d?: string) => d ?? k }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('./use-tenant-settings', () => ({
  useIpAllowlist: vi.fn(),
  useAddIpAllowlistEntry: vi.fn(),
  useRemoveIpAllowlistEntry: vi.fn(),
  useTenantSettings: vi.fn(),
}));

import { useIpAllowlist, useAddIpAllowlistEntry, useRemoveIpAllowlistEntry, useTenantSettings } from './use-tenant-settings';
import { asMock } from '@/test/as-mock';

const mockList = asMock(useIpAllowlist);
const mockAdd = asMock(useAddIpAllowlistEntry);
const mockRemove = asMock(useRemoveIpAllowlistEntry);
const mockSettings = asMock(useTenantSettings);

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('IpAllowlistTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdd.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mockRemove.mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  it('should show upgrade badge when feature not enabled', () => {
    mockSettings.mockReturnValue({ data: { enabledFeatures: [] } } as ReturnType<typeof useTenantSettings>);
    mockList.mockReturnValue({ data: [], isLoading: false } as ReturnType<typeof useIpAllowlist>);
    render(<IpAllowlistTab tenantId="t1" />, { wrapper: createWrapper() });
    expect(screen.getByTestId('ip-allowlist-upgrade')).toBeInTheDocument();
  });

  it('should show empty state when no entries', () => {
    mockSettings.mockReturnValue({ data: { enabledFeatures: ['IpAllowlist'] } } as ReturnType<typeof useTenantSettings>);
    mockList.mockReturnValue({ data: [], isLoading: false } as ReturnType<typeof useIpAllowlist>);
    render(<IpAllowlistTab tenantId="t1" />, { wrapper: createWrapper() });
    expect(screen.getByTestId('ip-allowlist-empty')).toBeInTheDocument();
  });

  it('should list entries when present', () => {
    mockSettings.mockReturnValue({ data: { enabledFeatures: ['IpAllowlist'] } } as ReturnType<typeof useTenantSettings>);
    mockList.mockReturnValue({
      data: [{ id: 'e1', cidr: '10.0.0.0/8', description: 'VPN', createdAt: '2026-01-01' }],
      isLoading: false,
    } as ReturnType<typeof useIpAllowlist>);
    render(<IpAllowlistTab tenantId="t1" />, { wrapper: createWrapper() });
    expect(screen.getByText('10.0.0.0/8')).toBeInTheDocument();
    expect(screen.getByText('VPN')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/admin/tenants/ip-allowlist-tab.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Create ip-allowlist-tab.tsx**

Create `src/admin/tenants/ip-allowlist-tab.tsx`:

```tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Trash2, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/core/ui/badge';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { ConfirmDialog } from '@/admin/shared/confirm-dialog';
import {
  useIpAllowlist,
  useAddIpAllowlistEntry,
  useRemoveIpAllowlistEntry,
  useTenantSettings,
} from './use-tenant-settings';

const cidrSchema = z.object({
  cidr: z
    .string()
    .min(1, 'admin:tenants.ipAllowlist.validation.cidrRequired')
    .regex(
      /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/,
      'admin:tenants.ipAllowlist.validation.cidrFormat',
    ),
  description: z.string().min(1, 'admin:tenants.ipAllowlist.validation.descriptionRequired'),
});

type CidrFormValues = z.infer<typeof cidrSchema>;

export function IpAllowlistTab({ tenantId }: Readonly<{ tenantId: string }>) {
  const { t } = useTranslation('admin');
  const { data: settings } = useTenantSettings(tenantId);
  const { data: entries = [], isLoading } = useIpAllowlist(tenantId);
  const addEntry = useAddIpAllowlistEntry(tenantId);
  const removeEntry = useRemoveIpAllowlistEntry(tenantId);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const featureEnabled = settings?.enabledFeatures.includes('IpAllowlist') ?? false;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CidrFormValues>({
    resolver: zodResolver(cidrSchema),
    defaultValues: { cidr: '', description: '' },
  });

  const onAdd = handleSubmit((values) => {
    addEntry.mutate(values, { onSuccess: () => reset() });
  });

  if (!featureEnabled) {
    return (
      <div className="flex items-center gap-2 py-8" data-testid="ip-allowlist-upgrade">
        <ShieldAlert className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {t('tenants.ipAllowlist.upgrade', 'Upgrade plan to enable IP Allowlist')}
        </span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6" data-testid="ip-allowlist-tab">
      <form onSubmit={onAdd} className="flex items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="cidr">{t('tenants.ipAllowlist.cidr', 'CIDR')}</Label>
          <Input
            id="cidr"
            data-testid="ip-cidr-input"
            placeholder="192.168.1.0/24"
            aria-invalid={!!errors.cidr}
            {...register('cidr')}
          />
          {errors.cidr && (
            <p className="text-xs text-destructive">{t(errors.cidr.message ?? '')}</p>
          )}
        </div>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="description">{t('tenants.ipAllowlist.description', 'Description')}</Label>
          <Input
            id="description"
            data-testid="ip-description-input"
            placeholder={t('tenants.ipAllowlist.description_placeholder', 'Office VPN')}
            aria-invalid={!!errors.description}
            {...register('description')}
          />
        </div>
        <Button type="submit" data-testid="ip-add-button" disabled={addEntry.isPending}>
          {t('tenants.ipAllowlist.add', 'Add')}
        </Button>
      </form>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">
          {t('tenants.ipAllowlist.loading', 'Loading...')}
        </p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="ip-allowlist-empty">
          {t('tenants.ipAllowlist.empty', 'No IP restrictions configured. All IPs are allowed.')}
        </p>
      ) : (
        <div className="divide-y rounded-md border">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-4">
                <code className="text-sm font-medium">{entry.cidr}</code>
                <span className="text-sm text-muted-foreground">{entry.description}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleDateString()}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive"
                  data-testid={`ip-delete-${entry.id}`}
                  onClick={() => setDeleteTarget(entry.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t('tenants.ipAllowlist.delete_title', 'Remove IP entry')}
        description={t(
          'tenants.ipAllowlist.delete_description',
          'This IP range will be removed from the allowlist.',
        )}
        confirmLabel={t('tenants.ipAllowlist.delete_confirm', 'Remove')}
        onConfirm={() => {
          if (deleteTarget) {
            removeEntry.mutate(deleteTarget);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Add IP Allowlist tab to tenant-detail-page.tsx**

In `src/admin/tenants/tenant-detail-page.tsx`, add import:

```typescript
import { IpAllowlistTab } from '@/admin/tenants/ip-allowlist-tab';
```

Add new tab trigger after the retention tab trigger (after line 81):

```tsx
<TabsTrigger value="ip-allowlist" data-testid="tab-ip-allowlist">
  {t('tenants.detail.tabs.ipAllowlist', 'IP Allowlist')}
</TabsTrigger>
```

Add new tab content before the closing `</Tabs>` tag (before line 144):

```tsx
<TabsContent value="ip-allowlist" className="pt-4" data-testid="tab-content-ip-allowlist">
  <IpAllowlistTab tenantId={tenantId} />
</TabsContent>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/admin/tenants/ip-allowlist-tab.test.tsx`
Expected: ALL PASS

- [ ] **Step 6: Run full test suite + lint + build**

Run: `npm run test && npm run lint && npm run build`
Expected: 800+ tests pass, 0 lint errors, build green

- [ ] **Step 7: Commit**

```bash
git add src/admin/tenants/ip-allowlist-tab.tsx src/admin/tenants/ip-allowlist-tab.test.tsx src/admin/tenants/tenant-detail-page.tsx
git commit -m "feat(tenants): add IP allowlist tab with CIDR management and feature gate"
```

---

### Task 6: Create public setup page for first-time platform initialization

**Files:**

- Modify: `src/core/api/hooks/use-system.ts`
- Create: `src/core/auth/setup-page.tsx`
- Create: `src/core/auth/setup-page.test.tsx`
- Modify: `src/router.tsx`

- [ ] **Step 1: Add useSetup hook to use-system.ts**

Append to `src/core/api/hooks/use-system.ts`:

```typescript
// ─── First-time platform setup ──────────────────────────────────────────────

export interface SetupInput {
  email: string;
  password: string;
  displayName?: string;
  platformName?: string;
}

export interface SetupResponse {
  tenantId: string;
  userId: string;
  accessToken: string;
  managementApiKey: string;
}

export function useSetup() {
  return useMutation({
    mutationFn: (data: SetupInput) =>
      customFetch<SetupResponse>({ url: '/api/v1/setup', method: 'POST', data }),
  });
}
```

- [ ] **Step 2: Write tests for setup page**

Create `src/core/auth/setup-page.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/core/api/hooks/use-system', () => ({
  useSetup: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isError: false, error: null })),
}));

import SetupPage from './setup-page';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('SetupPage', () => {
  it('should render setup form with email and password fields', () => {
    render(<SetupPage />, { wrapper: createWrapper() });
    expect(screen.getByTestId('setup-email')).toBeInTheDocument();
    expect(screen.getByTestId('setup-password')).toBeInTheDocument();
    expect(screen.getByTestId('setup-submit')).toBeInTheDocument();
  });

  it('should render platform name field', () => {
    render(<SetupPage />, { wrapper: createWrapper() });
    expect(screen.getByTestId('setup-platform-name')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Create setup-page.tsx**

Create `src/core/auth/setup-page.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Copy, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/core/ui/dialog';
import { useAuthStore } from '@/core/auth/auth-store';
import { useSetup, type SetupResponse } from '@/core/api/hooks/use-system';

const setupSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().optional(),
  platformName: z.string().optional(),
});

type SetupFormValues = z.infer<typeof setupSchema>;

export default function SetupPage() {
  const navigate = useNavigate();
  const setup = useSetup();
  const [apiKeyResponse, setApiKeyResponse] = useState<SetupResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetupFormValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: { email: '', password: '', displayName: '', platformName: '' },
  });

  const onSubmit = handleSubmit((values) => {
    setup.mutate(values, {
      onSuccess: (response) => {
        useAuthStore.getState().setTokens(response.accessToken, '');
        setApiKeyResponse(response);
      },
    });
  });

  const handleCopyKey = async () => {
    if (!apiKeyResponse) return;
    await navigator.clipboard.writeText(apiKeyResponse.managementApiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDone = () => {
    toast.success('Platform initialized successfully');
    navigate('/admin');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Building2 className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-4 text-2xl font-bold">Platform Setup</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Configure your contact center platform
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          <fieldset className="space-y-4">
            <legend className="text-sm font-medium">Admin Account</legend>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                data-testid="setup-email"
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                data-testid="setup-password"
                aria-invalid={!!errors.password}
                {...register('password')}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                data-testid="setup-display-name"
                {...register('displayName')}
              />
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-medium">Platform</legend>
            <div className="space-y-1.5">
              <Label htmlFor="platformName">Platform Name</Label>
              <Input
                id="platformName"
                data-testid="setup-platform-name"
                placeholder="My Contact Center"
                {...register('platformName')}
              />
            </div>
          </fieldset>

          {setup.isError && (
            <p className="text-sm text-destructive" data-testid="setup-error">
              {setup.error?.message ?? 'Setup failed. The platform may already be configured.'}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            data-testid="setup-submit"
            disabled={setup.isPending}
          >
            {setup.isPending ? 'Initializing...' : 'Initialize Platform'}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Already configured?{' '}
          <a href="/login" className="text-primary underline">
            Sign in
          </a>
        </p>
      </div>

      <Dialog open={apiKeyResponse !== null} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" data-testid="api-key-dialog">
          <DialogHeader>
            <DialogTitle>Management API Key</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Save this key now — it cannot be retrieved again.
          </p>
          <div className="flex items-center gap-2 rounded border bg-muted p-3">
            <code className="flex-1 break-all text-xs" data-testid="api-key-value">
              {apiKeyResponse?.managementApiKey}
            </code>
            <Button variant="ghost" size="sm" onClick={handleCopyKey}>
              {copied ? <CheckCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={handleDone} data-testid="api-key-done">
              I&apos;ve saved my key — Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 4: Add /setup route to router.tsx**

In `src/router.tsx`, add lazy import at the top (after line 9, with other auth page imports):

```typescript
const SetupPage = lazy(() => import('@/core/auth/setup-page'));
```

Add public route (after the `/unauthorized` route, line 114):

```typescript
{
  path: '/setup',
  element: (
    <LazyLoad>
      <SetupPage />
    </LazyLoad>
  ),
},
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/core/auth/setup-page.test.tsx`
Expected: ALL PASS

- [ ] **Step 6: Run full test suite + lint + build**

Run: `npm run test && npm run lint && npm run build`
Expected: 800+ tests pass, 0 lint errors, build green

- [ ] **Step 7: Commit**

```bash
git add src/core/api/hooks/use-system.ts src/core/auth/setup-page.tsx src/core/auth/setup-page.test.tsx src/router.tsx
git commit -m "feat(auth): add public setup page for first-time platform initialization"
```

---

### Task 7: Admin home page + i18n keys + routing + version bump

**Files:**

- Create: `src/admin/admin-home-page.tsx`
- Modify: `src/router.tsx`
- Modify: `public/locales/en-US/admin.json`
- Modify: `public/locales/es-419/admin.json`
- Modify: `public/locales/pt-BR/admin.json`
- Modify: `public/locales/en-US/common.json`
- Modify: `public/locales/es-419/common.json`
- Modify: `public/locales/pt-BR/common.json`
- Modify: `package.json`

- [ ] **Step 1: Create admin-home-page.tsx**

Create `src/admin/admin-home-page.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import { Building2 } from 'lucide-react';
import { PageHeader } from '@/admin/shared/page-header';
import { SetupBanner } from '@/admin/setup/setup-banner';

export default function AdminHomePage() {
  const { t } = useTranslation('admin');

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('home.title', 'Dashboard')}
        description={t('home.subtitle', 'Welcome to the administration panel.')}
      />
      <SetupBanner />
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
        <div className="text-center text-muted-foreground">
          <Building2 className="mx-auto mb-2 h-8 w-8" />
          <p className="text-sm">{t('home.placeholder', 'Dashboard widgets coming soon.')}</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update router — replace Navigate redirect with AdminHomePage**

In `src/router.tsx`, add lazy import:

```typescript
const AdminHomePage = lazy(() => import('@/admin/admin-home-page'));
```

Replace the admin index redirect (line 152):

Old:

```typescript
{ index: true, element: <Navigate to="users" replace /> },
```

New:

```typescript
{
  index: true,
  element: (
    <LazyLoad>
      <AdminHomePage />
    </LazyLoad>
  ),
},
```

- [ ] **Step 3: Add i18n keys to en-US/admin.json**

Add these keys to the `admin.json` file under appropriate sections:

```json
{
  "home": {
    "title": "Dashboard",
    "subtitle": "Welcome to the administration panel.",
    "placeholder": "Dashboard widgets coming soon."
  },
  "tenants": {
    "list": {
      "columns": {
        "type": "Type"
      },
      "status_hint": {
        "warning": "payment overdue",
        "degraded": "features limited",
        "pending_deletion": "pending deletion"
      },
      "create_sheet": {
        "type": "Tenant type",
        "type_customer": "Customer",
        "type_partner": "Partner",
        "parent_tenant": "Parent tenant",
        "parent_none": "None (top-level)"
      }
    },
    "detail": {
      "tabs": {
        "ipAllowlist": "IP Allowlist"
      }
    },
    "ipAllowlist": {
      "upgrade": "Upgrade plan to enable IP Allowlist",
      "cidr": "CIDR",
      "description": "Description",
      "description_placeholder": "Office VPN",
      "add": "Add",
      "loading": "Loading...",
      "empty": "No IP restrictions configured. All IPs are allowed.",
      "delete_title": "Remove IP entry",
      "delete_description": "This IP range will be removed from the allowlist.",
      "delete_confirm": "Remove",
      "validation": {
        "cidrRequired": "CIDR is required",
        "cidrFormat": "Must be valid IPv4 CIDR (e.g. 192.168.1.0/24)",
        "descriptionRequired": "Description is required"
      }
    }
  }
}
```

- [ ] **Step 4: Add i18n keys to es-419/admin.json**

Add equivalent keys in Spanish:

```json
{
  "home": {
    "title": "Panel",
    "subtitle": "Bienvenido al panel de administración.",
    "placeholder": "Widgets del panel próximamente."
  },
  "tenants": {
    "list": {
      "columns": {
        "type": "Tipo"
      },
      "status_hint": {
        "warning": "pago vencido",
        "degraded": "funciones limitadas",
        "pending_deletion": "eliminación pendiente"
      },
      "create_sheet": {
        "type": "Tipo de tenant",
        "type_customer": "Cliente",
        "type_partner": "Socio",
        "parent_tenant": "Tenant padre",
        "parent_none": "Ninguno (nivel superior)"
      }
    },
    "detail": {
      "tabs": {
        "ipAllowlist": "Lista IP permitidas"
      }
    },
    "ipAllowlist": {
      "upgrade": "Actualice su plan para habilitar la lista de IP permitidas",
      "cidr": "CIDR",
      "description": "Descripción",
      "description_placeholder": "VPN oficina",
      "add": "Agregar",
      "loading": "Cargando...",
      "empty": "Sin restricciones de IP configuradas. Todas las IPs están permitidas.",
      "delete_title": "Eliminar entrada IP",
      "delete_description": "Este rango de IP será eliminado de la lista permitida.",
      "delete_confirm": "Eliminar",
      "validation": {
        "cidrRequired": "El CIDR es requerido",
        "cidrFormat": "Debe ser un CIDR IPv4 válido (ej. 192.168.1.0/24)",
        "descriptionRequired": "La descripción es requerida"
      }
    }
  }
}
```

- [ ] **Step 5: Add i18n keys to pt-BR/admin.json**

Add equivalent keys in Portuguese:

```json
{
  "home": {
    "title": "Painel",
    "subtitle": "Bem-vindo ao painel de administração.",
    "placeholder": "Widgets do painel em breve."
  },
  "tenants": {
    "list": {
      "columns": {
        "type": "Tipo"
      },
      "status_hint": {
        "warning": "pagamento vencido",
        "degraded": "recursos limitados",
        "pending_deletion": "exclusão pendente"
      },
      "create_sheet": {
        "type": "Tipo de tenant",
        "type_customer": "Cliente",
        "type_partner": "Parceiro",
        "parent_tenant": "Tenant pai",
        "parent_none": "Nenhum (nível superior)"
      }
    },
    "detail": {
      "tabs": {
        "ipAllowlist": "Lista de IPs permitidos"
      }
    },
    "ipAllowlist": {
      "upgrade": "Atualize seu plano para ativar a lista de IPs permitidos",
      "cidr": "CIDR",
      "description": "Descrição",
      "description_placeholder": "VPN escritório",
      "add": "Adicionar",
      "loading": "Carregando...",
      "empty": "Sem restrições de IP configuradas. Todos os IPs são permitidos.",
      "delete_title": "Remover entrada IP",
      "delete_description": "Este intervalo de IP será removido da lista permitida.",
      "delete_confirm": "Remover",
      "validation": {
        "cidrRequired": "O CIDR é obrigatório",
        "cidrFormat": "Deve ser um CIDR IPv4 válido (ex. 192.168.1.0/24)",
        "descriptionRequired": "A descrição é obrigatória"
      }
    }
  }
}
```

- [ ] **Step 6: Add toast keys to common.json (all 3 locales)**

Add to `public/locales/en-US/common.json` under `toasts`:

```json
{
  "toasts": {
    "tenants": {
      "suspended": "Tenant suspended",
      "activated": "Tenant activated"
    },
    "ipAllowlist": {
      "added": "IP entry added",
      "removed": "IP entry removed"
    }
  }
}
```

Add to `public/locales/es-419/common.json`:

```json
{
  "toasts": {
    "tenants": {
      "suspended": "Tenant suspendido",
      "activated": "Tenant activado"
    },
    "ipAllowlist": {
      "added": "Entrada IP agregada",
      "removed": "Entrada IP eliminada"
    }
  }
}
```

Add to `public/locales/pt-BR/common.json`:

```json
{
  "toasts": {
    "tenants": {
      "suspended": "Tenant suspenso",
      "activated": "Tenant ativado"
    },
    "ipAllowlist": {
      "added": "Entrada IP adicionada",
      "removed": "Entrada IP removida"
    }
  }
}
```

- [ ] **Step 7: Bump version in package.json to 1.17.0**

In `package.json`, change:

```json
"version": "1.16.5"
```

to:

```json
"version": "1.17.0"
```

- [ ] **Step 8: Run full verification**

Run: `npm run test && npm run lint && npm run i18n:check && npm run build`
Expected: ALL pass — tests green, lint 0/0, i18n parity, build green

- [ ] **Step 9: Commit**

```bash
git add src/admin/admin-home-page.tsx src/router.tsx public/locales/ package.json
git commit -m "feat(admin): add admin home page + i18n keys + version bump to 1.17.0"
```

---

## Final Verification Checklist

After all tasks complete, verify acceptance criteria:

```bash
# All tests pass
npm run test

# Lint clean
npm run lint

# i18n parity
npm run i18n:check

# Build green
npm run build

# Version is 1.17.0
node -p "require('./package.json').version"

# No deprecated Lucide imports introduced
grep -rn "AlertCircle\|AlertTriangle\|BarChart3\|CheckCircle\b\|Loader2\|MoreHorizontal\|XCircle" src/ --include="*.tsx" --include="*.ts"

# Verify types exported
grep -n "TenantStatus\|TenantType\|StatusUpdateResponse" src/core/api/hooks/use-tenants.ts

# Verify IP allowlist hooks
grep -n "useIpAllowlist\|useAddIpAllowlistEntry\|useRemoveIpAllowlistEntry" src/admin/tenants/use-tenant-settings.ts

# Verify setup hook
grep -n "useSetup" src/core/api/hooks/use-system.ts

# Verify public route
grep -n "/setup" src/router.tsx
```
