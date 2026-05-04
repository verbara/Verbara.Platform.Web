# Track 3B — typescript-strict-2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Eliminate all unsafe type casts from production and test code (34 total → 0).

**Architecture:** Extend missing types, fix schema typing patterns, create test utility helper.

**Tech Stack:** TypeScript 5.9, React Hook Form 7.75, Zod 4, TanStack Table 8, Vitest 4.

---

## Phase A — Foundation (batch)

### Task 1: Extend User interface + fix user-detail.tsx

**Files:**

- Modify: `src/core/api/hooks/use-users.ts:6-13`
- Modify: `src/admin/users/user-detail.tsx:110-112`

- [ ] **Step 1:** Add optional fields to User interface in `use-users.ts`:

```typescript
export interface User {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  createdAt: string;
  mfaEnabled?: boolean;
  lastLoginAt?: string;
  authProvider?: string;
}
```

- [ ] **Step 2:** Remove casts in `user-detail.tsx` lines 110-112:

```typescript
const mfaEnabled = user.mfaEnabled === true;
const lastLogin = user.lastLoginAt;
const authProvider = user.authProvider || 'local';
```

- [ ] **Step 3:** Run `npx tsc --noEmit` — verify passes.

### Task 2: Fix i18n.ts readonly tuple cast

**Files:**

- Modify: `src/core/i18n/i18n.ts:17`

- [ ] **Step 1:** Replace the cast:

```typescript
// Before:
supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
// After:
supportedLngs: [...SUPPORTED_LANGUAGES],
```

- [ ] **Step 2:** Run `npx tsc --noEmit` — verify passes.

### Task 3: Fix sentry.ts headers cast

**Files:**

- Modify: `src/core/observability/sentry.ts:62-65`

- [ ] **Step 1:** The `redactHeaders` function already accepts `Record<string, unknown> | undefined`. The issue is that `event.request.headers` is `{ [key: string]: string }`. Since `Record<string, string>` is assignable to `Record<string, unknown>`, pass directly:

```typescript
if (event.request?.headers && typeof event.request.headers === 'object') {
  event.request.headers = redactHeaders(event.request.headers) as typeof event.request.headers;
}
```

If the `as typeof event.request.headers` is still needed for the return assignment, that's a safe narrowing (not widening). If even that isn't needed, remove entirely.

- [ ] **Step 2:** Run `npx tsc --noEmit` — verify passes.

### Task 4: Fix route-form.tsx undefined defaults

**Files:**

- Modify: `src/admin/routes/route-form.tsx:63,85`

- [ ] **Step 1:** Replace both `'' as unknown as number` with `undefined`:

```typescript
defaultValues: {
  priority: 10,
  pattern: '',
  patternType: 'prefix',
  trunkId: undefined,
  overflowTrunkId: '',
  dialPrefix: '',
},
```

And in the reset call:

```typescript
: {
    priority: 10,
    pattern: '',
    patternType: 'prefix',
    trunkId: undefined,
    overflowTrunkId: '',
    dialPrefix: '',
  },
```

- [ ] **Step 2:** Run `npx tsc --noEmit` — verify passes. The Select already handles undefined: `value={field.value ? String(field.value) : ''}`.

---

## Phase B — Critical fixes (individual subagents)

### Task 5: Fix campaign-wizard.tsx dynamic schema

**Files:**

- Modify: `src/admin/campaigns/campaign-wizard.tsx:21,138`

- [ ] **Step 1:** Remove the `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment and the `as any` cast. Try first with just removing the cast:

```typescript
resolver: currentSchema ? zodResolver(currentSchema) : undefined,
```

- [ ] **Step 2:** If TypeScript complains (z.ZodType is too broad for zodResolver), use the Track 3A pattern:

```typescript
import { type Resolver } from 'react-hook-form';
// ...
resolver: currentSchema
  ? (zodResolver(currentSchema) as Resolver<CampaignFormValues>)
  : undefined,
```

- [ ] **Step 3:** Run `npx tsc --noEmit` — verify passes.

### Task 6: Fix ColumnDef casts in audit-viewer-page.tsx

**Files:**

- Modify: `src/admin/security/audit/audit-viewer-page.tsx:149,201`

- [ ] **Step 1:** Remove explicit generic from useMemo and remove the cast. Assign to a typed variable:

```typescript
const columns: ColumnDef<AuditEventDto>[] = useMemo(
  () => [
    col.accessor('occurredAt', { ... }),
    // ... all column defs ...
    col.accessor('status', { ... }),
  ],
  [t, formatDate, formatRelative],
);
```

- [ ] **Step 2:** If TypeScript still errors on the array (createColumnHelper return types don't unify), try `satisfies`:

```typescript
const columns = useMemo(
  () =>
    [
      col.accessor('occurredAt', { ... }),
      // ...
    ] satisfies ColumnDef<AuditEventDto>[],
  [t, formatDate, formatRelative],
);
```

- [ ] **Step 3:** If neither works, use direct `as ColumnDef<AuditEventDto>[]` (single assert, no double-cast through unknown).

- [ ] **Step 4:** Run `npx tsc --noEmit` — verify passes.

### Task 7: Fix ColumnDef casts in impersonation-admin-page.tsx

**Files:**

- Modify: `src/admin/security/impersonation/impersonation-admin-page.tsx:295,347`

- [ ] **Step 1:** Apply the same fix as Task 6 (whichever approach worked) to both `activeColumns` (line 295) and `historyColumns` (line 347).

- [ ] **Step 2:** Run `npx tsc --noEmit` — verify passes.

---

## Phase C — Test utility (batch)

### Task 8: Create asMock helper

**Files:**

- Create: `src/tests/utils/as-mock.ts`

- [ ] **Step 1:** Create the utility:

```typescript
import type { Mock } from 'vitest';

export function asMock<T extends (...args: never[]) => unknown>(fn: T): Mock {
  return fn as unknown as Mock;
}
```

- [ ] **Step 2:** Verify it compiles: `npx tsc --noEmit`

### Task 9: Migrate all test files to use asMock

**Files (all .test.tsx):**

- `src/admin/api-keys/api-keys-page.test.tsx` (4 casts)
- `src/admin/security/impersonation/impersonation-admin-page.test.tsx` (3 casts)
- `src/admin/security/audit/audit-viewer-page.test.tsx` (2 casts)
- `src/admin/license/license-page.test.tsx` (2 casts)
- `src/admin/security/mfa/mfa-admin-page.test.tsx` (3 casts)
- `src/core/api/hooks/use-cluster-state-stream.test.tsx` (1 cast)
- `src/core/api/hooks/use-agent-state-stream.test.tsx` (1 cast)
- `src/core/api/hooks/use-conversation-state-stream.test.tsx` (1 cast)
- `src/profile/security/mfa/mfa-enroll-wizard.test.tsx` (3 casts)
- `src/profile/security/recovery-codes/regenerate-page.test.tsx` (1 cast)
- `src/profile/security/sessions/user-sessions-page.test.tsx` (2 casts)

- [ ] **Step 1:** In each file, add import: `import { asMock } from '@/tests/utils/as-mock';`

- [ ] **Step 2:** Replace each `const mockX = useY as unknown as ReturnType<typeof vi.fn>;` with `const mockX = asMock(useY);`

- [ ] **Step 3:** Run `npm run test` — verify 800/800 pass.

---

## Phase D — Verification + Ship

### Task 10: Final verification and version bump

- [ ] **Step 1:** Run full verification:
  - `npm run build` (tsc -b + vite build)
  - `npm run lint` (0 errors, 0 warnings)
  - `npm run test` (800/800)

- [ ] **Step 2:** Verify no remaining casts:
  - `grep -rn "as any\|as unknown as" src/ | grep -v "as Resolver" | grep -v "as-mock.ts"` → 0 results

- [ ] **Step 3:** Bump version in `package.json` to `1.16.1`.

- [ ] **Step 4:** Update roadmap: mark Track 3B as DONE.

- [ ] **Step 5:** Commit all changes.
