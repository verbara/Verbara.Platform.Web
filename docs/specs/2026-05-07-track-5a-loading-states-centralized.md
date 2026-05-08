# Track 5A — Loading States Centralized

**Version:** 1.18.0
**Status:** Approved
**Created:** 2026-05-07

## Problem

36 files use `if (isLoading) { return <text> }` early-return guards that render either plain text ("Loading...") or a centered text paragraph while data loads. This causes:

- **Layout shift:** The page header disappears during loading, then reappears when data arrives
- **Poor UX signal:** Users see no indication of content shape — just text
- **Inconsistent patterns:** Some pages preserve the header, most don't; one page (speech-analytics) has a local `LoadingSkeleton` component not shared elsewhere

## Solution

Create 3 reusable components in `src/core/ui/` and refactor all 36 files to use them.

## Components

### 1. `skeleton.tsx` — Primitive

A single animated placeholder block.

```tsx
interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular'; // default: 'text'
}
```

- Base classes: `animate-pulse bg-muted`
- `text` → `rounded-md h-4 w-full` (inline text placeholder)
- `circular` → `rounded-full` (avatar placeholder)
- `rectangular` → `rounded-lg` (card/image placeholder)
- Accepts `className` to override dimensions

### 2. `page-skeleton.tsx` — Page Content Skeleton

Pre-composed skeleton layouts for common page shapes.

```tsx
interface PageSkeletonProps {
  variant?: 'table' | 'cards' | 'form'; // default: 'table'
  rows?: number; // default: 5
  columns?: number; // default: 3 (only for 'table')
}
```

**Variants:**

- **`table`** — Simulates a data table: a header row of skeleton blocks + N content rows with varied column widths. Matches the look of pages using DataTable/AG Grid.
- **`cards`** — 2×2 or 3-column grid of `Skeleton variant="rectangular"` blocks, ~h-28 each. For dashboard-style pages.
- **`form`** — Vertical stack of label+input pairs (short skeleton + longer skeleton per row). For settings/detail pages.

Does NOT render `PageHeader` — the consumer renders the real header outside the loading guard.

### 3. `loading-overlay.tsx` — Refetch Overlay

Semi-transparent overlay for background refetches when data already exists on screen.

```tsx
interface LoadingOverlayProps {
  active: boolean;
  children: ReactNode;
}
```

- When `active=true`: renders children + absolute overlay (`bg-background/60 backdrop-blur-[1px]`) with `LoaderCircle` spinner from Lucide centered
- When `active=false`: renders children only, zero DOM overhead (no wrapper div when inactive — uses conditional rendering)
- The parent container needs `relative` positioning (documented, not enforced)

## Refactor Pattern

### Before (current — 36 files)

```tsx
const { data, isLoading } = useSomething();

if (isLoading) {
  return (
    <div className="space-y-6">
      <PageHeader title={t('page.title')}>
        <Button>Create</Button>
      </PageHeader>
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t('common:status.loading')}
      </div>
    </div>
  );
}

return (
  <div className="space-y-6">
    <PageHeader title={t('page.title')}>
      <Button>Create</Button>
    </PageHeader>
    {/* actual content */}
  </div>
);
```

### After

```tsx
const { data, isLoading } = useSomething();

return (
  <div className="space-y-6">
    <PageHeader title={t('page.title')}>
      <Button>Create</Button>
    </PageHeader>
    {isLoading ? (
      <PageSkeleton variant="table" />
    ) : (
      /* actual content */
    )}
  </div>
);
```

This eliminates the duplicated `PageHeader` rendering and provides a visual skeleton instead of text.

## Files to Refactor

### Table/list pages (~20 files) → `PageSkeleton variant="table"`

| File                                                        | Hook                  |
| ----------------------------------------------------------- | --------------------- |
| `admin/campaigns/campaign-list-page.tsx`                    | `useCampaigns`        |
| `admin/surveys/survey-list-page.tsx`                        | `useSurveys`          |
| `admin/bots/bot-list-page.tsx`                              | `useBots`             |
| `admin/skills/skills-page.tsx`                              | `useSkills`           |
| `admin/dnc-lists/dnc-lists-page.tsx`                        | `useDncLists`         |
| `admin/trunks/trunks-page.tsx`                              | `useTrunks`           |
| `admin/cases/cases-page.tsx`                                | `useCases`            |
| `admin/canned-responses/canned-responses-page.tsx`          | `useCannedResponses`  |
| `admin/routes/routes-page.tsx`                              | `useRoutes`           |
| `admin/reports/reports-page.tsx`                            | `useReports`          |
| `admin/holiday-calendars/holiday-calendars-page.tsx`        | `useHolidayCalendars` |
| `admin/caller-id-pools/caller-id-pools-page.tsx`            | `useCallerIdPools`    |
| `admin/tenants/tenants-page.tsx`                            | `useTenants`          |
| `admin/realtime/realtime-page.tsx`                          | `useRealtimeConfig`   |
| `admin/api-keys/api-keys-page.tsx`                          | `useApiKeys`          |
| `admin/security/impersonation/impersonation-admin-page.tsx` | `useImpersonation`    |
| `admin/security/mfa/mfa-admin-page.tsx`                     | `useMfaUsers`         |

### Settings/form pages (~6 files) → `PageSkeleton variant="form"`

| File                                                           | Hook                  |
| -------------------------------------------------------------- | --------------------- |
| `admin/dialer-settings/dialer-settings-page.tsx`               | `useDialerSettings`   |
| `admin/partner/partner-settings-page.tsx`                      | `usePartnerSettings`  |
| `admin/partner/customer-detail-page.tsx` (settings tab)        | `useCustomerSettings` |
| `admin/agent-assist/agent-assist-config-page.tsx` (3 sections) | multiple              |
| `admin/system/diagnostics-page.tsx`                            | `useDiagnostics`      |
| `admin/profile/security-page.tsx` (sessions section)           | `useSessions`         |

### Detail pages (~5 files) → `PageSkeleton variant="form"` or inline `Skeleton`

| File                                                  | Hook                 |
| ----------------------------------------------------- | -------------------- |
| `admin/campaigns/campaign-detail-page.tsx`            | `useCampaign`        |
| `admin/caller-id-pools/caller-id-pool-detail.tsx`     | `useCallerIdPool`    |
| `admin/holiday-calendars/holiday-calendar-detail.tsx` | `useHolidayCalendar` |
| `admin/campaigns/callbacks-tab.tsx`                   | `useCallbacks`       |

### Sub-components (~3 files) → inline `Skeleton`

| File                                         | Context                                   |
| -------------------------------------------- | ----------------------------------------- |
| `core/ui/audit-timeline.tsx`                 | Small component, inline skeleton          |
| `admin/shared/audit-trail-mini.tsx`          | Small component, inline skeleton          |
| `analytics/dashboard/bot-analytics-card.tsx` | Card skeleton (already has animate-pulse) |

### Migration from local skeleton (~1 file)

| File                                                   | Change                                             |
| ------------------------------------------------------ | -------------------------------------------------- |
| `analytics/speech-analytics/speech-analytics-page.tsx` | Remove local `LoadingSkeleton`, use `PageSkeleton` |

## Testing

- **New unit tests:** `skeleton.test.tsx`, `page-skeleton.test.tsx`, `loading-overlay.test.tsx` — render, props, variants, accessibility (role, aria attributes)
- **Existing tests:** Should not break — loading states are transient and tests typically mock data to arrive immediately. Verify with full `npx vitest run`.
- **E2E:** No new E2E specs needed — skeleton is only visible during loading which is sub-second in tests

## Out of Scope

- `LoadingOverlay` usage in pages (no pages currently use `isFetching` overlay — this component ships as available, refetch adoption deferred)
- Renaming `isLoading` → `isPending` (TanStack Query v5 naming — cosmetic, separate PR)
- Error state improvements (separate track)

## Acceptance Criteria

1. `Skeleton`, `PageSkeleton`, `LoadingOverlay` exist in `src/core/ui/` with unit tests
2. All 36 `if (isLoading)` early-return guards refactored to inline ternary with `PageSkeleton`
3. Page headers always visible during loading (no layout shift)
4. Local `LoadingSkeleton` in speech-analytics removed (uses shared component)
5. `npm run build` green, `npx vitest run` green (863+ tests), `npm run lint` green, `npm run i18n:check` green
6. Zero new i18n keys needed (skeletons are purely visual)
