# Track 3C — deps-majors-upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade all deferred major dependencies, rename deprecated Lucide icon aliases, fix icon accessibility, and remove dead type packages. Ship as `v1.16.5`.

**Architecture:** Staged by dependency chain — each phase produces one commit with full verification (build + lint + tests) before advancing. Phases are independent and revertible.

**Tech Stack:** TypeScript 6.0, ESLint 10, i18next 26, react-i18next 17, i18next-http-backend 4, Lucide React 1.14.

---

## Phase A — Foundation (batch)

### Task 1: Upgrade TypeScript to 6.0 + tsconfig cleanup

**Files:**

- Modify: `package.json:99` (typescript version)
- Modify: `tsconfig.app.json:5` (remove useDefineForClassFields)

- [ ] **Step 1:** Update `package.json` — change the `typescript` version:

```json
"typescript": "~6.0.3",
```

- [ ] **Step 2:** Remove `"useDefineForClassFields": true` from `tsconfig.app.json`. The file should go from:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2023",
    "useDefineForClassFields": true,
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
```

To:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
```

- [ ] **Step 3:** Run install and verify:

```bash
npm install
npm run build
npm run test
npm run lint
```

All must pass. Expected: zero changes to code required — all tsconfig options are already explicitly set and aligned with TS 6.0 defaults.

- [ ] **Step 4:** Commit:

```bash
git add package.json package-lock.json tsconfig.app.json
git commit -m "chore(deps): upgrade typescript to 6.0 + remove redundant useDefineForClassFields"
```

---

## Phase B — Critical (individual subagents)

### Task 2: Upgrade ESLint to 10 + fix new rule violations

**Files:**

- Modify: `package.json:75,87` (@eslint/js and eslint versions)
- Modify: various source files (based on lint output)

- [ ] **Step 1:** Update `package.json` — change both ESLint packages:

```json
"@eslint/js": "^10.0.0",
```

```json
"eslint": "^10.0.0",
```

- [ ] **Step 2:** Run install:

```bash
npm install
```

- [ ] **Step 3:** Run lint to discover new rule violations:

```bash
npm run lint 2>&1 | tee /tmp/eslint10-violations.txt
```

ESLint 10 adds 3 new rules to `eslint:recommended`:

- `no-unassigned-vars` — variables declared but never assigned
- `no-useless-assignment` — assignments whose value is never read
- `preserve-caught-error` — catch blocks that overwrite error before reading

- [ ] **Step 4:** Fix each violation. For each error:

**`no-useless-assignment`** — change `let` to `const` if never reassigned, or remove the dead assignment:

```typescript
// Before (dead assignment — value of x is never read after this):
let x = computeValue();
x = otherValue();
return x;

// After (remove dead first assignment):
const x = otherValue();
return x;
```

**`no-unassigned-vars`** — remove the variable declaration or initialize it:

```typescript
// Before:
let result;
// ... result never assigned ...

// After: remove the declaration entirely
```

**`preserve-caught-error`** — don't overwrite the caught error:

```typescript
// Before:
try { ... } catch (err) { err = new Error('custom'); throw err; }

// After:
try { ... } catch (_err) { throw new Error('custom'); }
```

- [ ] **Step 5:** Verify all passes:

```bash
npm run lint
npm run build
npm run test
```

- [ ] **Step 6:** Commit:

```bash
git add -A
git commit -m "chore(deps): upgrade eslint to 10 + fix new recommended rule violations"
```

---

## Phase C — Runtime (batch)

### Task 3: Upgrade i18next ecosystem (i18next 26 + react-i18next 17 + http-backend 4)

**Files:**

- Modify: `package.json:52-54` (i18next, i18next-http-backend, react-i18next versions)

- [ ] **Step 1:** Update `package.json` — change the three i18next packages:

```json
"i18next": "^26.0.0",
```

```json
"i18next-http-backend": "^4.0.0",
```

```json
"react-i18next": "^17.0.0",
```

- [ ] **Step 2:** Run install and verify:

```bash
npm install
npm run build
npm run test
npm run lint
```

All must pass. Expected: zero code changes needed. The breaking changes in these versions (removal of `initImmediate`, `interpolation.format`, `cross-fetch`) do not affect this codebase.

- [ ] **Step 3:** Commit:

```bash
git add package.json package-lock.json
git commit -m "chore(deps): upgrade i18next to 26, react-i18next to 17, i18next-http-backend to 4"
```

---

### Task 4: Upgrade Lucide React to 1.14 + rename deprecated icon aliases

**Files:**

- Modify: `package.json:55` (lucide-react version)
- Modify: 28 source files (icon import renames)

The full rename mapping:

| Old name         | New name         |
| ---------------- | ---------------- |
| `AlertCircle`    | `CircleAlert`    |
| `AlertTriangle`  | `TriangleAlert`  |
| `BarChart3`      | `ChartColumn`    |
| `CheckCircle`    | `CircleCheckBig` |
| `CheckCircle2`   | `CircleCheck`    |
| `Loader2`        | `LoaderCircle`   |
| `MoreHorizontal` | `Ellipsis`       |
| `XCircle`        | `CircleX`        |

- [ ] **Step 1:** Update `package.json`:

```json
"lucide-react": "^1.14.0",
```

- [ ] **Step 2:** Run install:

```bash
npm install
```

- [ ] **Step 3:** Rename all deprecated icon imports. In each file, replace the old import name with the new one in BOTH the import statement AND all JSX usage.

**File: `src/agent/conversation/message-bubble.tsx`**

Replace in import: `AlertCircle` → `CircleAlert`
Replace in JSX: `<AlertCircle` → `<CircleAlert`

**File: `src/shell/notification-item.tsx`**

Replace in import: `AlertTriangle` → `TriangleAlert`, `AlertCircle` → `CircleAlert`
Replace in JSX: `<AlertTriangle` → `<TriangleAlert`, `<AlertCircle` → `<CircleAlert`

**File: `src/core/ui/metrics-availability-banner.tsx`**

Replace in import: `AlertCircle` → `CircleAlert`
Replace in JSX: `<AlertCircle` → `<CircleAlert`

**File: `src/agent/conversation/compliance-alert.tsx`**

Replace in import: `AlertTriangle` → `TriangleAlert`
Replace in JSX: `<AlertTriangle` → `<TriangleAlert`

**File: `src/admin/billing/quotas-page.tsx`**

Replace in import: `AlertTriangle` → `TriangleAlert`
Replace in JSX: `<AlertTriangle` → `<TriangleAlert`

**File: `src/admin/campaigns/steps/contacts-step.tsx`**

Replace in import: `CheckCircle2` → `CircleCheck`, `AlertTriangle` → `TriangleAlert`
Replace in JSX: `<CheckCircle2` → `<CircleCheck`, `<AlertTriangle` → `<TriangleAlert`

**File: `src/admin/api-keys/create-api-key-dialog.tsx`**

Replace in import: `AlertTriangle` → `TriangleAlert`
Replace in JSX: `<AlertTriangle` → `<TriangleAlert`

**File: `src/admin/system/license-card.tsx`**

Replace in import: `AlertTriangle` → `TriangleAlert`
Replace in JSX: `<AlertTriangle` → `<TriangleAlert`

**File: `src/admin/webhooks/dead-letter-page.tsx`**

Replace in import: `AlertTriangle` → `TriangleAlert`
Replace in JSX: `<AlertTriangle` → `<TriangleAlert`

**File: `src/admin/license/license-page.tsx`**

Replace in import: `AlertTriangle` → `TriangleAlert`
Replace in JSX: `<AlertTriangle` → `<TriangleAlert`

**File: `src/admin/gdpr/gdpr-page.tsx`**

Replace in import: `AlertTriangle` → `TriangleAlert`
Replace in JSX: `<AlertTriangle` → `<TriangleAlert`

**File: `src/core/ui/confirm-delete-dialog.tsx`**

Replace in import: `AlertTriangle` → `TriangleAlert`
Replace in JSX: `<AlertTriangle` → `<TriangleAlert`

**File: `src/profile/security/recovery-codes/regenerate-page.tsx`**

Replace in import: `AlertTriangle` → `TriangleAlert`
Replace in JSX: `<AlertTriangle` → `<TriangleAlert`

**File: `src/shell/rail.tsx`**

Replace in import: `BarChart3` → `ChartColumn`
Replace in JSX: `<BarChart3` → `<ChartColumn`

**File: `src/shell/command-palette.tsx`**

Replace in import: `BarChart3` → `ChartColumn`
Replace in JSX: `<BarChart3` → `<ChartColumn`

**File: `src/analytics/sidebar/analytics-sidebar.tsx`**

Replace in import: `BarChart3` → `ChartColumn`
Replace in JSX: `<BarChart3` → `<ChartColumn`

**File: `src/agent/inbox/inbox-empty.tsx`**

Replace in import: `CheckCircle` → `CircleCheckBig`
Replace in JSX: `<CheckCircle` → `<CircleCheckBig`

**File: `src/admin/setup/steps/welcome-step.tsx`**

Replace in import: `CheckCircle` → `CircleCheckBig`
Replace in JSX: `<CheckCircle` → `<CircleCheckBig`

**File: `src/admin/billing/invoices-page.tsx`**

Replace in import: `CheckCircle` → `CircleCheckBig`
Replace in JSX: `<CheckCircle` → `<CircleCheckBig`

**File: `src/admin/setup/steps/test-step.tsx`**

Replace in import: `CheckCircle` → `CircleCheckBig`
Replace in JSX: `<CheckCircle` → `<CircleCheckBig`

**File: `src/core/auth/forgot-password-page.tsx`**

Replace in import: `CheckCircle` → `CircleCheckBig`
Replace in JSX: `<CheckCircle` → `<CircleCheckBig`

**File: `src/analytics/dashboard/bot-analytics-card.tsx`**

Replace in import: `CheckCircle` → `CircleCheckBig`, `XCircle` → `CircleX`
Replace in JSX: `<CheckCircle` → `<CircleCheckBig`, `<XCircle` → `<CircleX`

**File: `src/core/auth/reset-password-page.tsx`**

Replace in import: `CheckCircle` → `CircleCheckBig`, `XCircle` → `CircleX`
Replace in JSX: `<CheckCircle` → `<CircleCheckBig`, `<XCircle` → `<CircleX`

**File: `src/admin/dnc-lists/dnc-import-wizard.tsx`**

Replace in import: `CheckCircle2` → `CircleCheck`
Replace in JSX: `<CheckCircle2` → `<CircleCheck`

**File: `src/admin/dnc-lists/dnc-list-detail.tsx`**

Replace in import: `CheckCircle2` → `CircleCheck`, `XCircle` → `CircleX`
Replace in JSX: `<CheckCircle2` → `<CircleCheck`, `<XCircle` → `<CircleX`

**File: `src/admin/channels/channel-test-button.tsx`**

Replace in import: `Loader2` → `LoaderCircle`
Replace in JSX: `<Loader2` → `<LoaderCircle`

**File: `src/core/ui/drawer-detail.tsx`**

Replace in import: `Loader2` → `LoaderCircle`
Replace in JSX: `<Loader2` → `<LoaderCircle`

**File: `src/operations/agent-states/agent-states-page.tsx`**

Replace in import: `MoreHorizontal` → `Ellipsis`
Replace in JSX: `<MoreHorizontal` → `<Ellipsis`

- [ ] **Step 4:** Verify no deprecated aliases remain:

```bash
grep -rn "AlertCircle\|AlertTriangle\|BarChart3\|CheckCircle\b\|CheckCircle2\|Loader2\|MoreHorizontal\|XCircle" src/ --include="*.tsx" --include="*.ts"
```

Expected: 0 results.

- [ ] **Step 5:** Verify all passes:

```bash
npm run build
npm run lint
npm run test
```

- [ ] **Step 6:** Commit:

```bash
git add package.json package-lock.json src/
git commit -m "chore(deps): upgrade lucide-react to 1.14 + rename all deprecated icon aliases"
```

---

### Task 5: Add aria-label to icon-only buttons + new i18n key

**Files:**

- Modify: `src/admin/routes/routes-page.tsx:83-93`
- Modify: `src/admin/campaigns/campaign-list-page.tsx:98-135`
- Modify: `public/locales/en-US/admin.json` (routes section)
- Modify: `public/locales/es-419/admin.json` (routes section)
- Modify: `public/locales/pt-BR/admin.json` (routes section)

- [ ] **Step 1:** Add the new i18n key `routes.delete_route` to all 3 locale files.

In `public/locales/en-US/admin.json`, in the `"routes"` object, add:

```json
"delete_route": "Delete route"
```

In `public/locales/es-419/admin.json`, in the `"routes"` object, add:

```json
"delete_route": "Eliminar ruta"
```

In `public/locales/pt-BR/admin.json`, in the `"routes"` object, add:

```json
"delete_route": "Excluir rota"
```

- [ ] **Step 2:** In `src/admin/routes/routes-page.tsx`, add `aria-label` to the delete button. Change:

```tsx
        <Button
          variant="ghost"
          size="icon"
          data-testid={`delete-route-${route.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(route);
          }}
        >
```

To:

```tsx
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('admin:routes.delete_route')}
          data-testid={`delete-route-${route.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(route);
          }}
        >
```

- [ ] **Step 3:** In `src/admin/campaigns/campaign-list-page.tsx`, add `aria-label` to all 4 icon-only buttons. For each button that has `title={t('admin:campaigns.XXX')}`, add a matching `aria-label`:

Button at line ~98 (start draft):

```tsx
                <Button
                  variant="ghost"
                  size="icon"
                  title={t('admin:campaigns.start')}
                  aria-label={t('admin:campaigns.start')}
                  onClick={(e) => { e.stopPropagation(); startCampaign.mutate(id); }}
                >
```

Button at line ~108 (pause):

```tsx
                <Button
                  variant="ghost"
                  size="icon"
                  title={t('admin:campaigns.pause')}
                  aria-label={t('admin:campaigns.pause')}
                  onClick={(e) => { e.stopPropagation(); pauseCampaign.mutate(id); }}
                >
```

Button at line ~118 (start paused):

```tsx
                <Button
                  variant="ghost"
                  size="icon"
                  title={t('admin:campaigns.start')}
                  aria-label={t('admin:campaigns.start')}
                  onClick={(e) => { e.stopPropagation(); startCampaign.mutate(id); }}
                >
```

Button at line ~128 (stop):

```tsx
                <Button
                  variant="ghost"
                  size="icon"
                  title={t('admin:campaigns.stop')}
                  aria-label={t('admin:campaigns.stop')}
                  onClick={(e) => { e.stopPropagation(); stopCampaign.mutate(id); }}
                >
```

- [ ] **Step 4:** Verify i18n parity and all passes:

```bash
npm run lint
npm run build
npm run test
```

The `npm run lint` command includes `npm run i18n:check` which verifies all 3 locales have the same keys.

- [ ] **Step 5:** Commit:

```bash
git add src/admin/routes/routes-page.tsx src/admin/campaigns/campaign-list-page.tsx public/locales/
git commit -m "fix(a11y): add aria-label to icon-only buttons for screen reader accessibility"
```

---

## Phase D — Cleanup (batch)

### Task 6: Remove @types/dompurify + patch updates + version bump

**Files:**

- Modify: `package.json:43` (remove @types/dompurify)
- Modify: `package.json:2` (version bump to 1.16.5)

- [ ] **Step 1:** Remove `@types/dompurify` from `package.json`. Delete this line from the `"dependencies"` section:

```json
"@types/dompurify": "^3.2.0",
```

- [ ] **Step 2:** Run uninstall + patch updates:

```bash
npm uninstall @types/dompurify
npm install zod@4.4.3 msw@2.14.3 typescript-eslint@8.59.2
```

- [ ] **Step 3:** Bump version in `package.json`:

```json
"version": "1.16.5",
```

- [ ] **Step 4:** Verify everything passes:

```bash
npm run build
npm run lint
npm run test
npm audit --audit-level=high
```

Build must pass — `dompurify` 3.3.3 bundles its own types at `dist/purify.cjs.d.ts`, so TypeScript will resolve them automatically without the `@types/` package.

- [ ] **Step 5:** Commit:

```bash
git add package.json package-lock.json
git commit -m "chore(deps): remove dead @types/dompurify + patch updates + bump to 1.16.5"
```

---

## Phase E — Ship

### Task 7: Final verification + roadmap update

**Files:**

- Modify: `docs/plans/active/2026-05-03-v1.14.x-operational-foundation-roadmap.md` (Track 3C section)

- [ ] **Step 1:** Run full acceptance criteria verification:

```bash
npm run build
npm run lint
npm run test
npm audit --audit-level=high
npm outdated
```

Expected:

- Build: ✅
- Lint: 0 errors, 0 warnings
- Tests: 800/800
- Audit: 0 vulnerabilities
- Outdated: only `@types/node` 24→25 (excluded by design)

- [ ] **Step 2:** Verify no deprecated Lucide aliases remain:

```bash
grep -rn "AlertCircle\|AlertTriangle\|BarChart3\|CheckCircle\b\|CheckCircle2\|Loader2\|MoreHorizontal\|XCircle" src/ --include="*.tsx" --include="*.ts"
```

Expected: 0 results.

- [ ] **Step 3:** Verify cleanup items:

```bash
grep "useDefineForClassFields" tsconfig.app.json
grep "@types/dompurify" package.json
grep '"version"' package.json
```

Expected:

- First: no output
- Second: no output
- Third: `"version": "1.16.5",`

- [ ] **Step 4:** Update the roadmap file `docs/plans/active/2026-05-03-v1.14.x-operational-foundation-roadmap.md`. In the Track 3C section, update to:

```markdown
### Track 3C — Deps majors upgrade ✅ DONE 2026-05-04

**Versión:** `1.16.5` (cierre track) · **Tag:** `v1.16.5-web`

Cambios shipped:

- ✅ TypeScript 5.9 → 6.0 (zero code changes, removed redundant `useDefineForClassFields`)
- ✅ ESLint 9 → 10 + @eslint/js 9 → 10 (fixed new `recommended` rule violations)
- ✅ i18next 25 → 26 + react-i18next 16 → 17 + i18next-http-backend 3 → 4 (zero code changes)
- ✅ lucide-react 0.577 → 1.14 (renamed 33 deprecated icon aliases across 28 files)
- ✅ Icon-only button accessibility: aria-label on 5 buttons + 1 new i18n key
- ✅ Removed dead `@types/dompurify` (dompurify bundles own types)
- ✅ Patch updates: zod 4.4.3, msw 2.14.3, typescript-eslint 8.59.2

Verificación: build verde, lint 0/0, 800/800 tests, 0 npm audit vulnerabilities, 0 major upgrades pendientes.
```

- [ ] **Step 5:** Commit:

```bash
git add docs/plans/active/2026-05-03-v1.14.x-operational-foundation-roadmap.md
git commit -m "docs: close Track 3C in roadmap (1.16.5)"
```
