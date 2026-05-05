# Track 4A — Tenant Lifecycle UI

> Close the gap between the Platform backend's tenant management capabilities and what the Web UI exposes. Enhance existing tenant pages with dunning states and hierarchy support, add a System Hub page, Setup Wizard, Onboarding Widget, and IP Allowlist management.

## Goal

Bring the Web frontend to full parity with the ManagementTenant, ManagementSystem, Setup, Onboarding, and IP Allowlist backend endpoints. Ship as `v1.17.0`.

## Context

The Web already has a mature tenant CRUD UI (`tenants-page.tsx`, 536 lines) with list/create/edit/delete/suspend/activate, a tabbed detail page (`tenant-detail-page.tsx`, 218 lines), and complete hooks (`use-tenants.ts`, `use-tenant-settings.ts`). However, the backend has capabilities the UI doesn't expose:

- 6 tenant states (UI shows 3)
- Tenant hierarchy with types (UI ignores type/parentTenantId)
- Dedicated suspend/activate endpoints (UI uses generic update)
- System-wide config and license management (no UI at all)
- First-time platform setup wizard (no UI)
- Per-tenant onboarding checklist (no UI)
- IP allowlist per tenant (no UI)

## Scope

### 1. Dunning states + tenant types

**Problem:** `Tenant` interface has `status: string` (untyped). `STATUS_VARIANT` map only covers 3 of 6 states. `CreateTenantInput` lacks `type` and `parentTenantId`.

**Changes to `use-tenants.ts`:**

```typescript
type TenantStatus = 'Active' | 'Suspended' | 'Deleted' | 'Warning' | 'Degraded' | 'PendingDeletion';
type TenantType = 'Platform' | 'Partner' | 'Customer';

interface Tenant {
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

interface CreateTenantInput {
  tenantId: string;
  name: string;
  type?: TenantType; // new — default Customer
  parentTenantId?: string; // new
  maxConcurrentChannels?: number;
  maxActiveCampaigns?: number;
  metadata?: Record<string, string>;
  template?: string; // new — backend supports it
}
```

**Status badge mapping (6 states):**

| Status          | Badge variant                                     | Icon          | Color    | Actions           |
| --------------- | ------------------------------------------------- | ------------- | -------- | ----------------- |
| Active          | `default`                                         | CircleCheck   | green    | Suspend, Delete   |
| Warning         | `outline` + amber text class (`text-amber-600`)   | TriangleAlert | amber    | Suspend, Delete   |
| Degraded        | `outline` + orange text class (`text-orange-600`) | OctagonAlert  | orange   | Suspend, Delete   |
| Suspended       | `secondary`                                       | Ban           | gray     | Activate          |
| PendingDeletion | `destructive`                                     | Timer         | dark red | Activate (rescue) |
| Deleted         | `destructive`                                     | Trash2        | red      | — (read-only)     |

Warning and Degraded rows show an inline text hint: "payment overdue" / "features limited".

**Tenant type:** `outline` badge next to status badge in both list and detail views.

**Create form:** Add `type` select (Customer/Partner — Platform cannot be created from UI) and `parentTenantId` select (filtered by type: Partner parents must be Platform, Customer parents can be Platform or Partner). Both optional — defaults to Customer with no parent.

**Files modified:**

- `src/core/api/hooks/use-tenants.ts` — expand interfaces, add types
- `src/admin/tenants/tenants-page.tsx` — STATUS_VARIANT map (6 states), type badge column, create form fields, conditional actions per state
- `src/admin/tenants/tenant-detail-page.tsx` — STATUS_VARIANT map (6 states), type badge display

### 2. Dedicated suspend/activate mutations

**Problem:** `tenants-page.tsx` uses `useUpdateTenant({ id, status: 'Active' })` for activate — a generic PUT. The backend has dedicated `POST /{id}/suspend` and `POST /{id}/activate` endpoints with proper transition validation.

**New hooks in `use-tenants.ts`:**

```typescript
// POST /api/v1/management/tenants/{id}/suspend → StatusUpdateResponse
export function useSuspendTenant();

// POST /api/v1/management/tenants/{id}/activate → StatusUpdateResponse
export function useActivateTenant();
```

Response type:

```typescript
interface StatusUpdateResponse {
  id: string;
  status: string;
}
```

Both mutations invalidate `['tenants']` and `['tenant', id]` query keys on success.

**Files modified:**

- `src/core/api/hooks/use-tenants.ts` — add 2 mutations + response type
- `src/admin/tenants/tenants-page.tsx` — replace `useUpdateTenant` status calls with dedicated mutations

### 3. System Hub Page

**Route:** `/admin/system` — single page with stacked cards.

**Permission:** `PermissionGuard requires="system:tenant:configure"` (same gate as tenant management).

**Sidebar:** New entry "System" with `Settings` icon in the System group, below Cluster.

**New hook: `src/core/api/hooks/use-system.ts`**

```typescript
// ─── Types ──────────────────────────────────────────

interface SystemInfo {
  version: string;
  hostTenantId: string | null;
  platformName: string | null;
  features: Record<string, boolean>;
}

interface LicenseInfo {
  isValid: boolean;
  licenseId: string | null;
  licensee: string | null;
  status: string;
  expiresAt: string | null;
  licensedFeatures: string[];
  maxNodes: number;
  lastValidatedAt: string;
  inGrace: boolean;
  gracePeriodRemaining: string | null;
  blocked: boolean;
}

interface SystemSettings {
  platformName: string;
  defaultTimezone: string;
  defaultLanguage: string;
}

interface UpdateLicenseInput {
  licenseKey: string;
}

// ─── Hooks ──────────────────────────────────────────

useSystemInfo(); // GET /api/v1/management/system/info
useLicenseInfo(); // GET /api/v1/management/system/license
useUpdateLicense(); // PUT /api/v1/management/system/license
useSystemSettings(); // GET /api/v1/management/system/settings
useUpdateSystemSettings(); // PUT /api/v1/management/system/settings
```

**Page layout (3 stacked cards):**

**Card 1 — System Info:** Platform name (large), version (monospace), host tenant ID, feature badges (green for enabled, gray for disabled). Read-only.

**Card 2 — License:** Status indicator (Valid/Invalid/Expired/Grace), licensee, expiry date, max nodes, licensed features list. Conditional alerts:

- `inGrace: true` → amber banner "License in grace period — X remaining"
- `blocked: true` → red banner "License blocked — platform features restricted"
- `expiresAt` < 30 days → amber badge "Expires in N days"
- License key update form: text input + "Update" button. On success, re-fetch license info.

**Card 3 — Platform Settings:** Form with 3 fields: Platform Name (text input), Default Timezone (select), Default Language (select with en-US/es-419/pt-BR). Save button. Uses react-hook-form + Zod.

**Files created:**

- `src/core/api/hooks/use-system.ts` — 5 hooks + types
- `src/admin/system/system-page.tsx` — hub page with 3 card sections

**Files modified:**

- `src/router.tsx` — add `/admin/system` route
- `src/admin/sidebar.tsx` — add System nav entry

### 4. Setup Wizard

**Route:** `/setup` — public route, no `AuthGuard`. Placed alongside `/login`, `/forgot-password`, `/reset-password`.

**Detection:** No auto-detection. The `/setup` route is always available. If setup was already completed, `POST /setup` returns an error and the page shows "Platform already configured" with a link to `/login`. This avoids complex detection logic — the URL is shared in deployment docs, not auto-discovered.

**Form (single page, not multi-step):**

```typescript
const setupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().optional(),
  platformName: z.string().optional(),
});
```

Two sections: "Admin Account" (email, password, display name) and "Platform" (platform name).

**On success:**

1. Receive `SetupResponse { tenantId, userId, accessToken, managementApiKey }`
2. Store `accessToken` in auth-store
3. Show `managementApiKey` in a one-time copy dialog (cannot be retrieved again)
4. Redirect to `/admin`
5. Toast "Platform initialized successfully"

**No i18n** for this page — it runs pre-configuration, before language is established. English-only hardcoded strings.

**Hook:** `useSetup()` added to `use-system.ts`:

```typescript
interface SetupInput {
  email: string;
  password: string;
  displayName?: string;
  platformName?: string;
}

interface SetupResponse {
  tenantId: string;
  userId: string;
  accessToken: string;
  managementApiKey: string;
}

// POST /api/v1/setup
export function useSetup();
```

**Files created:**

- `src/core/auth/setup-page.tsx` — setup form + API key reveal dialog

**Files modified:**

- `src/core/api/hooks/use-system.ts` — add useSetup hook
- `src/router.tsx` — add `/setup` public route

### 5. Onboarding Widget

**Location:** Embedded in admin dashboard area. Visible when `wizardCompleted === false && checklistDismissed === false`.

**New hook: `src/core/api/hooks/use-onboarding.ts`**

```typescript
interface OnboardingStatus {
  wizardCompleted: boolean;
  templateApplied: string | null;
  checklist: ChecklistItem[];
  checklistDismissed: boolean;
}

interface ChecklistItem {
  key: string;
  label: string;
  completed: boolean;
}

useOnboardingStatus(); // GET /api/v1/admin/onboarding/status
useApplyTemplate(); // POST /api/v1/admin/onboarding/apply-template { template }
useCompleteOnboarding(); // POST /api/v1/admin/onboarding/complete
useDismissOnboarding(); // PUT /api/v1/admin/onboarding/dismiss-checklist
```

**Widget layout:**

- Header: "Getting Started" with dismiss button (X icon, calls `useDismissOnboarding`)
- Template selector: Only shown when `templateApplied === null`. Select dropdown + "Apply" button
- Progress bar: "3/7 steps" with visual progress indicator
- Checklist: Each item is a link to the relevant admin page. Completed items show checkmark. Labels come from backend (i18n is backend responsibility)
- "Mark as Complete" button: Enabled only when all items are completed. Calls `useCompleteOnboarding`

**Checklist link mapping:** Map `key` values to admin routes:

```typescript
const CHECKLIST_ROUTES: Record<string, string> = {
  create_queue: '/admin/queues',
  add_agent: '/admin/agents',
  configure_route: '/admin/routes',
  setup_campaign: '/admin/campaigns',
  configure_webhooks: '/admin/webhooks', // future Track 4B
  review_retention: '/admin/gdpr',
  test_call_flow: '/admin/flows',
};
```

Unknown keys render without a link (graceful fallback — backend may add items the Web doesn't know about yet).

**Dashboard integration:** The admin layout currently routes to the first available section. We add a lightweight admin home at `/admin` that shows the onboarding widget (when active) above a welcome message or quick stats. If onboarding is dismissed/complete, the home shows just the welcome content.

**Files created:**

- `src/core/api/hooks/use-onboarding.ts` — 4 hooks + types
- `src/admin/shared/onboarding-widget.tsx` — the widget component
- `src/admin/admin-home-page.tsx` — admin dashboard home page

**Files modified:**

- `src/router.tsx` — add `/admin` index route pointing to admin-home-page

### 6. IP Allowlist

**Location:** New tab "IP Allowlist" in `tenant-detail-page.tsx` (7th tab, after Retention).

**Hooks added to `use-tenant-settings.ts`:**

```typescript
interface IpAllowlistEntry {
  id: string;
  cidr: string;
  description: string;
  createdAt: string;
}

interface CreateIpAllowlistInput {
  cidr: string;
  description: string;
}

useIpAllowlist(tenantId); // GET /api/v1/management/tenants/{tenantId}/ip-allowlist
useAddIpAllowlistEntry(tenantId); // POST
useRemoveIpAllowlistEntry(tenantId); // DELETE /{entryId}
```

**Tab behavior:**

- Feature gate: Check if `enabledFeatures` includes `IpAllowlist`. If not, show informational badge "Upgrade plan to enable IP Allowlist" instead of functional UI.
- If enabled: Add form (CIDR input + description input + Add button) above entry list.
- Entry list: Table with columns CIDR, Description, Created, Delete button.
- Delete: `ConfirmDialog` (standard confirm, not 3-second countdown — IP entries are less destructive than tenant delete).
- Empty state: "No IP restrictions configured. All IPs are allowed."
- CIDR validation: Zod regex for IPv4 CIDR notation (`/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/` with range checks).

**Files created:**

- `src/admin/tenants/ip-allowlist-tab.tsx` — tab content component

**Files modified:**

- `src/admin/tenants/use-tenant-settings.ts` — add 3 hooks + types
- `src/admin/tenants/tenant-detail-page.tsx` — add 7th tab importing ip-allowlist-tab

## i18n keys

All new UI text requires keys in all 3 locales (`en-US`, `es-419`, `pt-BR`). Namespaces:

- `admin.json` — system page, tenant enhancements, IP allowlist, onboarding widget
- `common.json` — toast messages for new mutations

Setup page is excluded from i18n (hardcoded English — pre-configuration context).

Estimated new keys: ~60-80 across the 3 locales.

## File summary

### New files (8)

| File                                     | Purpose                                              |
| ---------------------------------------- | ---------------------------------------------------- |
| `src/core/api/hooks/use-system.ts`       | System info, license, settings, setup hooks          |
| `src/core/api/hooks/use-onboarding.ts`   | Onboarding status, template, complete, dismiss hooks |
| `src/admin/system/system-page.tsx`       | System Hub page (info + license + settings)          |
| `src/core/auth/setup-page.tsx`           | First-time platform setup wizard                     |
| `src/admin/shared/onboarding-widget.tsx` | Getting Started checklist widget                     |
| `src/admin/admin-home-page.tsx`          | Admin dashboard home page                            |
| `src/admin/tenants/ip-allowlist-tab.tsx` | IP Allowlist tab content                             |
| `src/core/api/hooks/use-system.test.tsx` | Tests for system hooks                               |

### Modified files (7)

| File                                             | Changes                                                                                               |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `src/core/api/hooks/use-tenants.ts`              | Expand Tenant interface (type, parentTenantId, TenantStatus union), add suspend/activate mutations    |
| `src/admin/tenants/tenants-page.tsx`             | 6-state STATUS_VARIANT, type badge column, create form type/parent fields, dedicated suspend/activate |
| `src/admin/tenants/tenant-detail-page.tsx`       | 6-state STATUS_VARIANT, type badge, IP Allowlist tab                                                  |
| `src/admin/tenants/use-tenant-settings.ts`       | IP allowlist hooks + types                                                                            |
| `src/router.tsx`                                 | Add /admin/system, /admin (index), /setup routes                                                      |
| `src/admin/sidebar.tsx`                          | Add System nav entry                                                                                  |
| `public/locales/{en-US,es-419,pt-BR}/admin.json` | ~60-80 new keys each                                                                                  |

### Test files (new)

| File                                          | Covers                                                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/core/api/hooks/use-system.test.tsx`      | useSystemInfo, useLicenseInfo, useUpdateLicense, useSystemSettings, useUpdateSystemSettings, useSetup |
| `src/core/api/hooks/use-onboarding.test.tsx`  | useOnboardingStatus, useApplyTemplate, useCompleteOnboarding, useDismissOnboarding                    |
| `src/admin/tenants/ip-allowlist-tab.test.tsx` | IP allowlist CRUD, feature gate                                                                       |
| `src/admin/system/system-page.test.tsx`       | System page rendering, license alerts, settings form                                                  |
| `src/core/auth/setup-page.test.tsx`           | Setup form validation, API key reveal                                                                 |
| `src/admin/shared/onboarding-widget.test.tsx` | Widget visibility, checklist, dismiss, complete                                                       |

## Excluded

| Item                                 | Reason                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------- |
| Tenant tree view                     | Flat list with type/parent badges is sufficient. Tree view is a UX enhancement for Track 5+ |
| Tenant hierarchy drag-and-drop       | Over-engineering for management scope                                                       |
| Auto-detection of setup state        | Simpler to let POST /setup return error if already configured                               |
| Onboarding wizard (modal multi-step) | Dashboard widget is less intrusive and already approved                                     |
| IP Allowlist IPv6                    | Backend CIDR validation handles this; frontend validates IPv4 format, passes through IPv6   |
| System info edit                     | Read-only — system info is server-derived                                                   |
| License features management          | Read-only display — features are controlled by license key                                  |

## Acceptance criteria

- `npm run build` passes
- `npm run lint` passes (0 errors, 0 warnings)
- `npm run test` passes (800+ tests — new tests added)
- `npm run i18n:check` passes (parity across 3 locales)
- Tenant list shows all 6 statuses with correct badges and actions
- Tenant create form supports type and parent tenant selection
- Suspend/Activate use dedicated POST endpoints (not generic PUT)
- System Hub page displays info, license, and settings with functional forms
- License grace/blocked alerts render conditionally
- Setup page at `/setup` creates platform and reveals API key
- Onboarding widget appears on admin home, can be dismissed/completed
- IP Allowlist tab in tenant detail with feature gate
- Version is `1.17.0`
