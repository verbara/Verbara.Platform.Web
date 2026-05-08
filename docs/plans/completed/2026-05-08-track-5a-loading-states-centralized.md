# Track 5A — Loading States Centralized Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all 36 `if (isLoading) return <text>` early-return guards with proper skeleton loading components so page headers stay visible during loading and users see a content-shape placeholder.

**Architecture:** Three new components in `src/core/ui/` — a `Skeleton` primitive (animated block), a `PageSkeleton` composition (pre-built layouts for table/cards/form pages), and a `LoadingOverlay` (refetch overlay for future use). Then refactor every file that uses the old loading pattern.

**Tech Stack:** React 19, TypeScript 6, TailwindCSS 4.2, Lucide React, Vitest + Testing Library

---

## Task 1: Create `Skeleton` primitive component + tests

**Files:**

- Create: `src/core/ui/skeleton.tsx`
- Create: `src/core/ui/skeleton.test.tsx`

- [ ] **Step 1: Write the test file**

```tsx
// src/core/ui/skeleton.test.tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Skeleton } from './skeleton';

describe('Skeleton', () => {
  it('Renders_WithDefaultTextVariant', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el).toBeInTheDocument();
    expect(el.className).toContain('animate-pulse');
    expect(el.className).toContain('rounded-md');
  });

  it('Renders_CircularVariant', () => {
    const { container } = render(<Skeleton variant="circular" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('rounded-full');
  });

  it('Renders_RectangularVariant', () => {
    const { container } = render(<Skeleton variant="rectangular" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('rounded-lg');
  });

  it('Merges_CustomClassName', () => {
    const { container } = render(<Skeleton className="h-10 w-40" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('h-10');
    expect(el.className).toContain('w-40');
  });

  it('Renders_AsDiv_WithNoContent', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild?.nodeName).toBe('DIV');
    expect(container.firstChild?.textContent).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/ui/skeleton.test.tsx`
Expected: FAIL — `./skeleton` module does not exist yet.

- [ ] **Step 3: Write the `Skeleton` component**

```tsx
// src/core/ui/skeleton.tsx
import { cn } from '@/lib/utils';

type SkeletonVariant = 'text' | 'circular' | 'rectangular';

const VARIANT_CLASSES: Record<SkeletonVariant, string> = {
  text: 'rounded-md h-4 w-full',
  circular: 'rounded-full',
  rectangular: 'rounded-lg',
};

interface SkeletonProps {
  readonly className?: string;
  readonly variant?: SkeletonVariant;
}

function Skeleton({ className, variant = 'text' }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      className={cn('animate-pulse bg-muted', VARIANT_CLASSES[variant], className)}
    />
  );
}

export { Skeleton };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/ui/skeleton.test.tsx`
Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/ui/skeleton.tsx src/core/ui/skeleton.test.tsx
git commit -m "feat(ui): add Skeleton primitive component with text/circular/rectangular variants"
```

---

## Task 2: Create `PageSkeleton` composition component + tests

**Files:**

- Create: `src/core/ui/page-skeleton.tsx`
- Create: `src/core/ui/page-skeleton.test.tsx`

- [ ] **Step 1: Write the test file**

```tsx
// src/core/ui/page-skeleton.test.tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageSkeleton } from './page-skeleton';

describe('PageSkeleton', () => {
  it('Renders_TableVariantByDefault', () => {
    const { container } = render(<PageSkeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el).toBeInTheDocument();
    expect(el.dataset.testid).toBe('page-skeleton');
    expect(el.dataset.variant).toBe('table');
  });

  it('Renders_DefaultFiveRows_ForTable', () => {
    const { container } = render(<PageSkeleton />);
    const rows = container.querySelectorAll('[data-slot="skeleton-row"]');
    // 1 header row + 5 content rows
    expect(rows.length).toBe(6);
  });

  it('Renders_CustomRowCount_ForTable', () => {
    const { container } = render(<PageSkeleton rows={3} />);
    const rows = container.querySelectorAll('[data-slot="skeleton-row"]');
    // 1 header row + 3 content rows
    expect(rows.length).toBe(4);
  });

  it('Renders_CardsVariant', () => {
    const { container } = render(<PageSkeleton variant="cards" />);
    const el = container.firstChild as HTMLElement;
    expect(el.dataset.variant).toBe('cards');
    const cards = container.querySelectorAll('[data-slot="skeleton"]');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('Renders_FormVariant', () => {
    const { container } = render(<PageSkeleton variant="form" />);
    const el = container.firstChild as HTMLElement;
    expect(el.dataset.variant).toBe('form');
    const fields = container.querySelectorAll('[data-slot="skeleton-field"]');
    expect(fields.length).toBe(5);
  });

  it('Renders_CustomRowCount_ForForm', () => {
    const { container } = render(<PageSkeleton variant="form" rows={3} />);
    const fields = container.querySelectorAll('[data-slot="skeleton-field"]');
    expect(fields.length).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/ui/page-skeleton.test.tsx`
Expected: FAIL — `./page-skeleton` module does not exist yet.

- [ ] **Step 3: Write the `PageSkeleton` component**

```tsx
// src/core/ui/page-skeleton.tsx
import { Skeleton } from '@/core/ui/skeleton';

type PageSkeletonVariant = 'table' | 'cards' | 'form';

interface PageSkeletonProps {
  readonly variant?: PageSkeletonVariant;
  readonly rows?: number;
  readonly columns?: number;
}

function TableSkeleton({ rows, columns }: { rows: number; columns: number }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      {/* Header row */}
      <div data-slot="skeleton-row" className="flex gap-4 border-b bg-muted/30 px-4 py-3">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-4" style={{ width: `${20 + (i % 3) * 10}%` }} />
        ))}
      </div>
      {/* Content rows */}
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          data-slot="skeleton-row"
          className="flex gap-4 border-b px-4 py-3 last:border-0"
        >
          {Array.from({ length: columns }, (_, j) => (
            <Skeleton key={j} className="h-4" style={{ width: `${25 + ((i + j) % 3) * 8}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function CardsSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} variant="rectangular" className="h-28" />
      ))}
    </div>
  );
}

function FormSkeleton({ rows }: { rows: number }) {
  return (
    <div className="max-w-lg space-y-6">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} data-slot="skeleton-field" className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

function PageSkeleton({ variant = 'table', rows = 5, columns = 3 }: PageSkeletonProps) {
  return (
    <div data-testid="page-skeleton" data-variant={variant}>
      {variant === 'table' && <TableSkeleton rows={rows} columns={columns} />}
      {variant === 'cards' && <CardsSkeleton count={rows} />}
      {variant === 'form' && <FormSkeleton rows={rows} />}
    </div>
  );
}

export { PageSkeleton };
export type { PageSkeletonProps };
```

Note: the `Skeleton` component in Task 1 needs a small tweak to accept a `style` prop. Update `skeleton.tsx`:

```tsx
// Update the interface in src/core/ui/skeleton.tsx
interface SkeletonProps {
  readonly className?: string;
  readonly variant?: SkeletonVariant;
  readonly style?: React.CSSProperties;
}

function Skeleton({ className, variant = 'text', style }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      className={cn('animate-pulse bg-muted', VARIANT_CLASSES[variant], className)}
      style={style}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/ui/page-skeleton.test.tsx`
Expected: 6 tests PASS.

- [ ] **Step 5: Run all Skeleton tests together**

Run: `npx vitest run src/core/ui/skeleton.test.tsx src/core/ui/page-skeleton.test.tsx`
Expected: 11 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/ui/skeleton.tsx src/core/ui/page-skeleton.tsx src/core/ui/page-skeleton.test.tsx
git commit -m "feat(ui): add PageSkeleton composition component with table/cards/form variants"
```

---

## Task 3: Create `LoadingOverlay` component + tests

**Files:**

- Create: `src/core/ui/loading-overlay.tsx`
- Create: `src/core/ui/loading-overlay.test.tsx`

- [ ] **Step 1: Write the test file**

```tsx
// src/core/ui/loading-overlay.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingOverlay } from './loading-overlay';

describe('LoadingOverlay', () => {
  it('Renders_ChildrenOnly_WhenInactive', () => {
    render(
      <LoadingOverlay active={false}>
        <p data-testid="child">content</p>
      </LoadingOverlay>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.queryByTestId('loading-overlay')).not.toBeInTheDocument();
  });

  it('Renders_ChildrenAndOverlay_WhenActive', () => {
    render(
      <LoadingOverlay active={true}>
        <p data-testid="child">content</p>
      </LoadingOverlay>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByTestId('loading-overlay')).toBeInTheDocument();
  });

  it('Overlay_HasAriaLabel_ForAccessibility', () => {
    render(
      <LoadingOverlay active={true}>
        <p>content</p>
      </LoadingOverlay>,
    );
    const overlay = screen.getByTestId('loading-overlay');
    expect(overlay.getAttribute('role')).toBe('status');
    expect(overlay.getAttribute('aria-label')).toBe('Loading');
  });

  it('Wraps_InRelativeContainer_WhenActive', () => {
    render(
      <LoadingOverlay active={true}>
        <p data-testid="child">content</p>
      </LoadingOverlay>,
    );
    const wrapper = screen.getByTestId('child').parentElement;
    expect(wrapper?.className).toContain('relative');
  });

  it('NoWrapper_WhenInactive', () => {
    const { container } = render(
      <LoadingOverlay active={false}>
        <p data-testid="child">content</p>
      </LoadingOverlay>,
    );
    // The <p> should be a direct child — no wrapping div
    expect(container.firstChild?.nodeName).toBe('P');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/ui/loading-overlay.test.tsx`
Expected: FAIL — `./loading-overlay` module does not exist yet.

- [ ] **Step 3: Write the `LoadingOverlay` component**

```tsx
// src/core/ui/loading-overlay.tsx
import type { ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';

interface LoadingOverlayProps {
  readonly active: boolean;
  readonly children: ReactNode;
}

function LoadingOverlay({ active, children }: LoadingOverlayProps) {
  if (!active) return children;

  return (
    <div className="relative">
      {children}
      <div
        data-testid="loading-overlay"
        role="status"
        aria-label="Loading"
        className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px]"
      >
        <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    </div>
  );
}

export { LoadingOverlay };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/ui/loading-overlay.test.tsx`
Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/ui/loading-overlay.tsx src/core/ui/loading-overlay.test.tsx
git commit -m "feat(ui): add LoadingOverlay component for refetch states"
```

---

## Task 4: Refactor table/list pages — batch 1 (10 files)

**Files to modify:**

- `src/admin/campaigns/campaign-list-page.tsx`
- `src/admin/surveys/survey-list-page.tsx`
- `src/admin/bots/bot-list-page.tsx`
- `src/admin/skills/skills-page.tsx`
- `src/admin/dnc-lists/dnc-lists-page.tsx`
- `src/admin/trunks/trunks-page.tsx`
- `src/admin/cases/cases-page.tsx`
- `src/admin/canned-responses/canned-responses-page.tsx`
- `src/admin/routes/routes-page.tsx`
- `src/admin/reports/reports-page.tsx`

All 10 files follow the **exact same pattern**. For each file:

1. Add import: `import { PageSkeleton } from '@/core/ui/page-skeleton';`
2. Remove the `if (isLoading) { return (...) }` block (which duplicates PageHeader + shows loading text)
3. Restructure the return to: render PageHeader once, then `isLoading ? <PageSkeleton /> : <actual content>`

- [ ] **Step 1: Refactor all 10 files**

The transformation for every file is identical. Here is the exact pattern, demonstrated with `bot-list-page.tsx` as the example:

**Before** (lines 100-112 of `src/admin/bots/bot-list-page.tsx`):

```tsx
  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('admin:bots.title')}>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t('admin:bots.create')}
          </Button>
        </PageHeader>
        <div className="flex h-64 items-center justify-center text-muted-foreground">{t('common:status.loading')}</div>
      </div>
    );
  }

  const isEmpty = bots.length === 0;

  return (
    <div className="space-y-6" data-testid="bots-page">
      <PageHeader title={t('admin:bots.title')}>
        ...
      </PageHeader>
      {isEmpty ? (
        <EmptyState ... />
      ) : (
        <DataTable ... />
      )}
      ...dialogs...
    </div>
  );
```

**After:**

```tsx
  const isEmpty = !isLoading && bots.length === 0;

  return (
    <div className="space-y-6" data-testid="bots-page">
      <PageHeader title={t('admin:bots.title')}>
        <Button data-testid="bots-create-btn" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:bots.create')}
        </Button>
      </PageHeader>

      {isLoading ? (
        <PageSkeleton />
      ) : isEmpty ? (
        <EmptyState ... />
      ) : (
        <DataTable ... />
      )}

      ...dialogs remain unchanged...
    </div>
  );
```

Key points for every file:

- Remove the entire `if (isLoading)` early-return block
- Keep only one return statement with one `<PageHeader>` at the top
- The loading guard PageHeader may have fewer props/data-testid than the real one — **use the real one** (the one from the non-loading return) as the single source
- Guard `isEmpty` with `!isLoading &&` so it doesn't flash an empty state while loading
- Dialogs, forms, modals at the bottom of the return are NOT inside the ternary — they stay after the content area

Apply this pattern to all 10 files listed above. Each one: add the `PageSkeleton` import, delete the early-return block, restructure to a single return.

- [ ] **Step 2: Run tests to verify nothing is broken**

Run: `npx vitest run`
Expected: All 863+ tests PASS. These tests all mock `isLoading: false`, so skeleton never renders in tests.

- [ ] **Step 3: Run build + lint**

Run: `npm run build && npm run lint`
Expected: Both green. No unused imports (the loading text i18n keys like `t('common:status.loading')` may become unused in some files if they were only used in the loading guard — remove those specific `t()` calls if TypeScript/lint flags them).

- [ ] **Step 4: Commit**

```bash
git add src/admin/campaigns/campaign-list-page.tsx src/admin/surveys/survey-list-page.tsx src/admin/bots/bot-list-page.tsx src/admin/skills/skills-page.tsx src/admin/dnc-lists/dnc-lists-page.tsx src/admin/trunks/trunks-page.tsx src/admin/cases/cases-page.tsx src/admin/canned-responses/canned-responses-page.tsx src/admin/routes/routes-page.tsx src/admin/reports/reports-page.tsx
git commit -m "refactor(ui): replace loading text with PageSkeleton in 10 table/list pages"
```

---

## Task 5: Refactor table/list pages — batch 2 (7 files)

**Files to modify:**

- `src/admin/holiday-calendars/holiday-calendars-page.tsx`
- `src/admin/caller-id-pools/caller-id-pools-page.tsx`
- `src/admin/tenants/tenants-page.tsx`
- `src/admin/realtime/realtime-page.tsx`
- `src/admin/api-keys/api-keys-page.tsx`
- `src/admin/security/impersonation/impersonation-admin-page.tsx`
- `src/admin/security/mfa/mfa-admin-page.tsx`

- [ ] **Step 1: Refactor all 7 files**

Same pattern as Task 4. Special notes:

**`api-keys-page.tsx`**: Has an inner `ListSection` component that takes `isLoading` as a prop and does its own `if (isLoading)` guard. Refactor `ListSection` the same way — replace the early return with a `PageSkeleton` ternary.

**`impersonation-admin-page.tsx`**: Has two inner section components (`ActiveSection`, `HistorySection`) each with their own `isLoading` prop and guard. Refactor both — replace each early return with `isLoading ? <PageSkeleton rows={3} /> : <content>`.

**`mfa-admin-page.tsx`**: Has an inner `ListSection` like api-keys. Same treatment.

For all others, same pattern as Task 4.

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: All tests PASS.

- [ ] **Step 3: Run build + lint**

Run: `npm run build && npm run lint`
Expected: Both green.

- [ ] **Step 4: Commit**

```bash
git add src/admin/holiday-calendars/holiday-calendars-page.tsx src/admin/caller-id-pools/caller-id-pools-page.tsx src/admin/tenants/tenants-page.tsx src/admin/realtime/realtime-page.tsx src/admin/api-keys/api-keys-page.tsx src/admin/security/impersonation/impersonation-admin-page.tsx src/admin/security/mfa/mfa-admin-page.tsx
git commit -m "refactor(ui): replace loading text with PageSkeleton in 7 table/list pages"
```

---

## Task 6: Refactor settings/form pages (6 files)

**Files to modify:**

- `src/admin/dialer-settings/dialer-settings-page.tsx`
- `src/admin/partner/partner-settings-page.tsx`
- `src/admin/partner/customer-detail-page.tsx`
- `src/admin/agent-assist/agent-assist-config-page.tsx`
- `src/admin/system/diagnostics-page.tsx`
- `src/admin/profile/security-page.tsx`

- [ ] **Step 1: Refactor all 6 files**

Same refactor pattern but using `variant="form"`:

```tsx
import { PageSkeleton } from '@/core/ui/page-skeleton';

// Replace the early return with:
{isLoading ? <PageSkeleton variant="form" /> : (
  /* existing form content */
)}
```

Special notes per file:

**`dialer-settings-page.tsx`**: The loading block renders its own `<h1>` title. After refactor, keep the header (the icon+title+description block at lines 82-91) outside the ternary, then `isLoading ? <PageSkeleton variant="form" /> : <form>...</form>`.

**`partner-settings-page.tsx`**: Loading block is a centered paragraph. Replace with `PageSkeleton variant="form"`.

**`customer-detail-page.tsx`**: Only the `CustomerSettingsTab` inner component (around line 449) has the loading guard. Replace that one `if (isLoading) return <p>...` with `isLoading ? <PageSkeleton variant="form" rows={3} /> : <content>`.

**`agent-assist-config-page.tsx`**: Has 3 inner section components each with `if (isLoading)` guards (lines 217, 544, 883). Refactor each: `isLoading ? <PageSkeleton variant="form" rows={3} /> : <content>`. The page-level loading block (line 883) preserves the icon+header outside the ternary.

**`diagnostics-page.tsx`**: Has a PageHeader in the loading block. Keep PageHeader outside, ternary for content.

**`security-page.tsx`**: The sessions section (line 511) has `if (isLoading)`. Replace inline.

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: All tests PASS.

- [ ] **Step 3: Run build + lint**

Run: `npm run build && npm run lint`
Expected: Both green.

- [ ] **Step 4: Commit**

```bash
git add src/admin/dialer-settings/dialer-settings-page.tsx src/admin/partner/partner-settings-page.tsx src/admin/partner/customer-detail-page.tsx src/admin/agent-assist/agent-assist-config-page.tsx src/admin/system/diagnostics-page.tsx src/admin/profile/security-page.tsx
git commit -m "refactor(ui): replace loading text with PageSkeleton variant=form in 6 settings pages"
```

---

## Task 7: Refactor detail pages (4 files)

**Files to modify:**

- `src/admin/campaigns/campaign-detail-page.tsx`
- `src/admin/caller-id-pools/caller-id-pool-detail.tsx`
- `src/admin/holiday-calendars/holiday-calendar-detail.tsx`
- `src/admin/campaigns/callbacks-tab.tsx`

- [ ] **Step 1: Refactor all 4 files**

**`campaign-detail-page.tsx`**: Loading block (line 309) shows centered text. Replace:

```tsx
{isLoading ? <PageSkeleton variant="form" /> : (
  /* existing detail content */
)}
```

**`caller-id-pool-detail.tsx`**: Loading block (line 40) shows centered text. Same pattern with `variant="form"`.

**`holiday-calendar-detail.tsx`**: Loading block (line 47) shows centered text. Same pattern.

**`callbacks-tab.tsx`**: This is a sub-component (no PageHeader). Loading block (line 30) returns a `<p>`. Replace with inline `Skeleton`:

```tsx
import { Skeleton } from '@/core/ui/skeleton';

// Replace:
//   if (isLoading) return <p className="...">{t('...')}</p>;
// With:
if (isLoading) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: All tests PASS.

- [ ] **Step 3: Run build + lint**

Run: `npm run build && npm run lint`
Expected: Both green.

- [ ] **Step 4: Commit**

```bash
git add src/admin/campaigns/campaign-detail-page.tsx src/admin/caller-id-pools/caller-id-pool-detail.tsx src/admin/holiday-calendars/holiday-calendar-detail.tsx src/admin/campaigns/callbacks-tab.tsx
git commit -m "refactor(ui): replace loading text with PageSkeleton/Skeleton in 4 detail pages"
```

---

## Task 8: Refactor sub-components + migrate speech-analytics (4 files)

**Files to modify:**

- `src/core/ui/audit-timeline.tsx`
- `src/admin/shared/audit-trail-mini.tsx`
- `src/analytics/dashboard/bot-analytics-card.tsx`
- `src/analytics/speech-analytics/speech-analytics-page.tsx`

- [ ] **Step 1: Refactor sub-components**

**`audit-timeline.tsx`** (line 24): Replace the loading `<p>` with inline `Skeleton`:

```tsx
import { Skeleton } from '@/core/ui/skeleton';

// Replace:
//   if (isLoading) {
//     return <p className="py-4 text-sm text-muted-foreground">Loading history...</p>;
//   }
// With:
if (isLoading) {
  return (
    <div className="space-y-3 py-4">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}
```

**`audit-trail-mini.tsx`** (line 35): Replace the loading `<p>` with inline `Skeleton`:

```tsx
import { Skeleton } from '@/core/ui/skeleton';

// Replace:
//   if (isLoading) {
//     return <p className="py-3 text-xs ..." data-testid="audit-trail-mini-loading">...</p>;
//   }
// With:
if (isLoading) {
  return (
    <div className="space-y-2" data-testid="audit-trail-mini-loading">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}
```

**`bot-analytics-card.tsx`** (line 31): Already uses `animate-pulse`. Replace the manual div with `Skeleton`:

```tsx
import { Skeleton } from '@/core/ui/skeleton';

// Replace:
//   if (isLoading) {
//     return (
//       <div className="h-36 animate-pulse rounded-xl border ..." data-testid="bot-analytics-card-loading" />
//     );
//   }
// With:
if (isLoading) {
  return (
    <Skeleton
      variant="rectangular"
      className="h-36 border border-slate-200 dark:border-slate-700"
      data-testid="bot-analytics-card-loading"
    />
  );
}
```

Note: `Skeleton` doesn't have a `data-testid` prop. Instead of adding it to the Skeleton interface, use a wrapping div:

```tsx
if (isLoading) {
  return (
    <div data-testid="bot-analytics-card-loading">
      <Skeleton variant="rectangular" className="h-36" />
    </div>
  );
}
```

- [ ] **Step 2: Migrate speech-analytics**

**`speech-analytics-page.tsx`**: Remove the local `LoadingSkeleton` function (lines 48-56). Replace all 3 usages of `<LoadingSkeleton />` with `<PageSkeleton variant="cards" rows={3} />`:

```tsx
import { PageSkeleton } from '@/core/ui/page-skeleton';

// Delete lines 48-56 (the local LoadingSkeleton function)

// Replace each:
//   if (isLoading) return <LoadingSkeleton />;
// With:
if (isLoading) return <PageSkeleton variant="cards" rows={3} />;
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run`
Expected: All tests PASS. The `speech-analytics-page.test.tsx` test that checks for `data-testid="loading-skeleton"` may need updating if it tests the loading state. Check and update if needed — but most tests mock data loaded.

- [ ] **Step 4: Run build + lint**

Run: `npm run build && npm run lint`
Expected: Both green.

- [ ] **Step 5: Commit**

```bash
git add src/core/ui/audit-timeline.tsx src/admin/shared/audit-trail-mini.tsx src/analytics/dashboard/bot-analytics-card.tsx src/analytics/speech-analytics/speech-analytics-page.tsx
git commit -m "refactor(ui): replace inline loading states with Skeleton in sub-components, remove local LoadingSkeleton"
```

---

## Task 9: Full verification + version bump

**Files to modify:**

- `package.json` (version bump)

- [ ] **Step 1: Run complete verification suite**

```bash
npm run build && npx vitest run && npm run lint && npm run i18n:check
```

Expected: All green. 863+ tests pass. Zero lint errors. i18n parity check passes (no new keys added).

- [ ] **Step 2: Verify no remaining old loading patterns**

```bash
grep -rn "flex h-64 items-center justify-center text-muted-foreground" --include="*.tsx" src/ | grep -v ".test."
```

Expected: Zero results (all centralized loading text divs replaced).

```bash
grep -rn "if (isLoading)" --include="*.tsx" src/ | grep -v ".test." | grep -v "node_modules"
```

Expected: Only the refactored inline skeleton returns remain (callbacks-tab, audit-timeline, audit-trail-mini, bot-analytics-card, confirm-delete-dialog). No full-page loading text guards.

- [ ] **Step 3: Bump version to 1.18.0**

In `package.json`, change `"version"` from current to `"1.18.0"`.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore: bump version to 1.18.0"
```

- [ ] **Step 5: Update roadmap plan**

In `docs/plans/active/2026-05-03-v1.14.x-operational-foundation-roadmap.md`, mark Track 5A as done:

Change the Track 5A heading from:

```
### Track 5A — Loading states centralized
```

to:

```
### Track 5A — Loading states centralized ✅ DONE YYYY-MM-DD
```

(Use today's date when completing.)

- [ ] **Step 6: Final commit**

```bash
git add docs/plans/active/2026-05-03-v1.14.x-operational-foundation-roadmap.md
git commit -m "docs: mark Track 5A loading states as complete in roadmap"
```
