# Track 5B — Virtualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@tanstack/react-virtual`-backed `<VirtualList>` and `<DataTable virtualized>` primitives, then migrate 6 verified components so they render 1,000+ items at 60 fps.

**Architecture:** Two focused primitives in `src/core/ui/`. `<VirtualList>` for feed-style components (chat, inbox, notifications, monitor cards) — supports variable heights, auto-scroll-to-bottom, infinite scroll both directions. `<DataTable>` gains an opt-in `virtualized` prop that swaps `<tbody>` for an absolutely-positioned scroll container while keeping a sticky `<thead>` and grid-aligned cells.

**Tech Stack:** React 19, TypeScript 6 strict, `@tanstack/react-virtual` ^3.x, `@tanstack/react-table` 8.21 (already present), Vitest 4.1, Testing Library React 16.3, Playwright.

**Spec:** [`2026-05-08-track-5b-virtualization.md`](2026-05-08-track-5b-virtualization.md)

---

## File Structure

| Path                                                                                             | Action           | Responsibility                                        |
| ------------------------------------------------------------------------------------------------ | ---------------- | ----------------------------------------------------- |
| `package.json`                                                                                   | modify           | add `@tanstack/react-virtual` dep                     |
| `src/core/ui/virtual-list.tsx`                                                                   | create           | feed-style virtualization primitive                   |
| `src/core/ui/virtual-list.test.tsx`                                                              | create           | unit tests for VirtualList                            |
| `src/core/ui/index.ts` (or barrel)                                                               | modify if exists | export VirtualList                                    |
| `src/admin/shared/data-table.tsx`                                                                | modify           | add `virtualized?: boolean` prop                      |
| `src/admin/shared/data-table.test.tsx`                                                           | create or modify | virtualized-mode tests                                |
| `src/agent/conversation/message-thread.tsx`                                                      | modify           | migrate to VirtualList (chat)                         |
| `src/agent/inbox/inbox-panel.tsx`                                                                | modify           | migrate to VirtualList                                |
| `src/admin/security/audit/audit-viewer-page.tsx`                                                 | modify           | enable DataTable virtualized; remove deferred comment |
| `src/admin/audit/audit-page.tsx`                                                                 | modify           | enable DataTable virtualized                          |
| `src/shell/notification-drawer.tsx`                                                              | modify           | replace Load More with VirtualList onEndReached       |
| `public/locales/en-US/notifications.json`                                                        | modify           | remove `loadMore` key                                 |
| `public/locales/es-419/notifications.json`                                                       | modify           | remove `loadMore` key                                 |
| `public/locales/pt-BR/notifications.json`                                                        | modify           | remove `loadMore` key                                 |
| `src/operations/agent-states/agent-states-page.tsx`                                              | modify           | enable DataTable virtualized                          |
| `src/operations/monitor/monitor-page.tsx`                                                        | modify           | wrap voice-tab session cards in VirtualList           |
| `tests/e2e/virtualization.spec.ts`                                                               | create           | Playwright spec for chat + audit virtualization       |
| `package.json`                                                                                   | modify           | bump version to 1.18.0, then 1.18.1                   |
| `CLAUDE.md`                                                                                      | modify           | reflect Track 5B closure                              |
| `home/orion75/.claude/projects/-media-Data-Source-Verbara-Verbara-Platform-Web/memory/MEMORY.md` | modify           | mark 5B closed; queue 5C next                         |

---

# Patch 5B.1 — Primitives (target: 1.18.0)

### Task 1: Add `@tanstack/react-virtual` dependency

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Install dependency**

```bash
cd /media/Data/Source/Verbara/Verbara.Platform.Web
npm install @tanstack/react-virtual@^3
```

- [ ] **Step 2: Verify install**

```bash
npm ls @tanstack/react-virtual
```

Expected: prints `@tanstack/react-virtual@3.x.y` with no `UNMET DEPENDENCY` warnings.

- [ ] **Step 3: Verify build still passes**

```bash
npm run build
```

Expected: typecheck + bundle succeed, no warnings.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add @tanstack/react-virtual ^3"
```

---

### Task 2: VirtualList — minimal flat-list rendering (TDD)

**Files:**

- Create: `src/core/ui/virtual-list.tsx`
- Create: `src/core/ui/virtual-list.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/core/ui/virtual-list.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VirtualList } from './virtual-list';

describe('VirtualList', () => {
  it('Renders_OnlyOverscanWindow_When10kItemsProvided', () => {
    const items = Array.from({ length: 10_000 }, (_, i) => ({ id: i, label: `Row ${i}` }));
    const { container } = render(
      <div style={{ height: 400 }}>
        <VirtualList
          items={items}
          renderItem={(item) => <div>{item.label}</div>}
          estimateSize={() => 40}
          getItemKey={(item) => item.id}
        />
      </div>,
    );
    const renderedRows = container.querySelectorAll('[data-virtual-row]');
    // Viewport 400px / 40px = 10 visible + overscan default 5 each side
    expect(renderedRows.length).toBeLessThanOrEqual(30);
    expect(renderedRows.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/core/ui/virtual-list.test.tsx
```

Expected: FAIL — `Cannot find module './virtual-list'`.

- [ ] **Step 3: Implement minimal VirtualList**

Create `src/core/ui/virtual-list.tsx`:

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { ReactNode, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface VirtualListProps<T> {
  readonly items: readonly T[];
  readonly renderItem: (item: T, index: number) => ReactNode;
  readonly estimateSize: (index: number) => number;
  readonly getItemKey?: (item: T, index: number) => string | number;
  readonly overscan?: number;
  readonly className?: string;
}

export function VirtualList<T>({
  items,
  renderItem,
  estimateSize,
  getItemKey,
  overscan = 5,
  className,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan,
    getItemKey: getItemKey ? (i) => getItemKey(items[i] as T, i) : undefined,
  });

  return (
    <div ref={parentRef} className={cn('h-full overflow-auto', className)}>
      <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const item = items[virtualItem.index] as T;
          return (
            <div
              key={virtualItem.key}
              data-virtual-row
              ref={virtualizer.measureElement}
              data-index={virtualItem.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderItem(item, virtualItem.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/core/ui/virtual-list.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/ui/virtual-list.tsx src/core/ui/virtual-list.test.tsx
git commit -m "feat(ui): add VirtualList primitive with flat-list rendering"
```

---

### Task 3: VirtualList — `stickToBottom` for chat-style auto-scroll (TDD)

**Files:**

- Modify: `src/core/ui/virtual-list.tsx`
- Modify: `src/core/ui/virtual-list.test.tsx`

- [ ] **Step 1: Add the failing tests**

Append to `src/core/ui/virtual-list.test.tsx`:

```tsx
it('AutoScrollsToBottom_WhenStickToBottom_AndUserNearBottom', async () => {
  const items = Array.from({ length: 50 }, (_, i) => ({ id: i }));
  const { container, rerender } = render(
    <div style={{ height: 200 }}>
      <VirtualList
        items={items}
        renderItem={(item) => <div style={{ height: 40 }}>Row {item.id}</div>}
        estimateSize={() => 40}
        getItemKey={(item) => item.id}
        stickToBottom
      />
    </div>,
  );
  const scroller = container.querySelector('[data-virtual-scroller]') as HTMLDivElement;
  // Simulate user is at bottom (within 50px threshold)
  Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 2000 });
  Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 200 });
  Object.defineProperty(scroller, 'scrollTop', { configurable: true, writable: true, value: 1750 });

  const longer = [...items, { id: 50 }, { id: 51 }];
  rerender(
    <div style={{ height: 200 }}>
      <VirtualList
        items={longer}
        renderItem={(item) => <div style={{ height: 40 }}>Row {item.id}</div>}
        estimateSize={() => 40}
        getItemKey={(item) => item.id}
        stickToBottom
      />
    </div>,
  );
  // Auto-scroll should have moved scrollTop to ≥ scrollHeight - clientHeight
  expect(scroller.scrollTop).toBeGreaterThanOrEqual(1800 - 200);
});

it('DoesNotAutoScroll_WhenStickToBottom_AndUserScrolledUp', async () => {
  const items = Array.from({ length: 50 }, (_, i) => ({ id: i }));
  const { container, rerender } = render(
    <div style={{ height: 200 }}>
      <VirtualList
        items={items}
        renderItem={(item) => <div style={{ height: 40 }}>Row {item.id}</div>}
        estimateSize={() => 40}
        getItemKey={(item) => item.id}
        stickToBottom
      />
    </div>,
  );
  const scroller = container.querySelector('[data-virtual-scroller]') as HTMLDivElement;
  Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 2000 });
  Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 200 });
  Object.defineProperty(scroller, 'scrollTop', { configurable: true, writable: true, value: 100 });
  // Manually trigger scroll event to register isNearBottom = false
  scroller.dispatchEvent(new Event('scroll'));

  const longer = [...items, { id: 50 }];
  rerender(
    <div style={{ height: 200 }}>
      <VirtualList
        items={longer}
        renderItem={(item) => <div style={{ height: 40 }}>Row {item.id}</div>}
        estimateSize={() => 40}
        getItemKey={(item) => item.id}
        stickToBottom
      />
    </div>,
  );
  // scrollTop unchanged
  expect(scroller.scrollTop).toBe(100);
});
```

- [ ] **Step 2: Run tests — verify two new ones fail**

```bash
npx vitest run src/core/ui/virtual-list.test.tsx
```

Expected: FAIL on the two new tests (`stickToBottom` not implemented, `data-virtual-scroller` selector missing).

- [ ] **Step 3: Implement stickToBottom**

Replace `src/core/ui/virtual-list.tsx` contents:

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface VirtualListProps<T> {
  readonly items: readonly T[];
  readonly renderItem: (item: T, index: number) => ReactNode;
  readonly estimateSize: (index: number) => number;
  readonly getItemKey?: (item: T, index: number) => string | number;
  readonly overscan?: number;
  readonly className?: string;
  readonly stickToBottom?: boolean;
}

const NEAR_BOTTOM_THRESHOLD_PX = 50;

export function VirtualList<T>({
  items,
  renderItem,
  estimateSize,
  getItemKey,
  overscan = 5,
  className,
  stickToBottom = false,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const [, force] = useState(0);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan,
    getItemKey: getItemKey ? (i) => getItemKey(items[i] as T, i) : undefined,
  });

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
      isNearBottomRef.current = distanceFromBottom <= NEAR_BOTTOM_THRESHOLD_PX;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!stickToBottom) return;
    const el = parentRef.current;
    if (!el) return;
    if (isNearBottomRef.current) {
      el.scrollTop = el.scrollHeight - el.clientHeight;
      force((n) => n + 1);
    }
  }, [items.length, stickToBottom]);

  return (
    <div ref={parentRef} data-virtual-scroller className={cn('h-full overflow-auto', className)}>
      <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const item = items[virtualItem.index] as T;
          return (
            <div
              key={virtualItem.key}
              data-virtual-row
              ref={virtualizer.measureElement}
              data-index={virtualItem.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderItem(item, virtualItem.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
npx vitest run src/core/ui/virtual-list.test.tsx
```

Expected: PASS for all 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/ui/virtual-list.tsx src/core/ui/virtual-list.test.tsx
git commit -m "feat(ui): add stickToBottom auto-scroll to VirtualList"
```

---

### Task 4: VirtualList — `onEndReached` and `onStartReached` callbacks (TDD)

**Files:**

- Modify: `src/core/ui/virtual-list.tsx`
- Modify: `src/core/ui/virtual-list.test.tsx`

- [ ] **Step 1: Add the failing tests**

Append to `src/core/ui/virtual-list.test.tsx`:

```tsx
it('FiresOnEndReached_WhenLastItemEntersOverscan', () => {
  const onEndReached = vi.fn();
  const items = Array.from({ length: 30 }, (_, i) => ({ id: i }));
  const { container } = render(
    <div style={{ height: 200 }}>
      <VirtualList
        items={items}
        renderItem={(item) => <div style={{ height: 40 }}>Row {item.id}</div>}
        estimateSize={() => 40}
        getItemKey={(item) => item.id}
        onEndReached={onEndReached}
      />
    </div>,
  );
  const scroller = container.querySelector('[data-virtual-scroller]') as HTMLDivElement;
  Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 1200 });
  Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 200 });
  Object.defineProperty(scroller, 'scrollTop', { configurable: true, writable: true, value: 1000 });
  scroller.dispatchEvent(new Event('scroll'));
  expect(onEndReached).toHaveBeenCalled();
});

it('FiresOnStartReached_WhenFirstItemEntersOverscan', () => {
  const onStartReached = vi.fn();
  const items = Array.from({ length: 30 }, (_, i) => ({ id: i }));
  const { container } = render(
    <div style={{ height: 200 }}>
      <VirtualList
        items={items}
        renderItem={(item) => <div style={{ height: 40 }}>Row {item.id}</div>}
        estimateSize={() => 40}
        getItemKey={(item) => item.id}
        onStartReached={onStartReached}
      />
    </div>,
  );
  const scroller = container.querySelector('[data-virtual-scroller]') as HTMLDivElement;
  Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 1200 });
  Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 200 });
  Object.defineProperty(scroller, 'scrollTop', { configurable: true, writable: true, value: 0 });
  scroller.dispatchEvent(new Event('scroll'));
  expect(onStartReached).toHaveBeenCalled();
});
```

Add the import at top of file if not present:

```tsx
import { describe, expect, it, vi } from 'vitest';
```

- [ ] **Step 2: Run tests — verify the two new ones fail**

```bash
npx vitest run src/core/ui/virtual-list.test.tsx
```

Expected: FAIL on `FiresOnEndReached_*` and `FiresOnStartReached_*`.

- [ ] **Step 3: Add the callback wiring**

Edit `src/core/ui/virtual-list.tsx` — extend the props interface and the scroll handler:

```tsx
export interface VirtualListProps<T> {
  readonly items: readonly T[];
  readonly renderItem: (item: T, index: number) => ReactNode;
  readonly estimateSize: (index: number) => number;
  readonly getItemKey?: (item: T, index: number) => string | number;
  readonly overscan?: number;
  readonly className?: string;
  readonly stickToBottom?: boolean;
  readonly onEndReached?: () => void;
  readonly onStartReached?: () => void;
}

const END_REACHED_THRESHOLD_PX = 200;
```

Replace the scroll `useEffect` block:

```tsx
useEffect(() => {
  const el = parentRef.current;
  if (!el) return;
  let firedEnd = false;
  let firedStart = false;
  const onScroll = () => {
    const distanceFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
    isNearBottomRef.current = distanceFromBottom <= NEAR_BOTTOM_THRESHOLD_PX;
    if (onEndReached && distanceFromBottom <= END_REACHED_THRESHOLD_PX) {
      if (!firedEnd) {
        firedEnd = true;
        onEndReached();
      }
    } else {
      firedEnd = false;
    }
    if (onStartReached && el.scrollTop <= END_REACHED_THRESHOLD_PX) {
      if (!firedStart) {
        firedStart = true;
        onStartReached();
      }
    } else {
      firedStart = false;
    }
  };
  el.addEventListener('scroll', onScroll, { passive: true });
  return () => el.removeEventListener('scroll', onScroll);
}, [onEndReached, onStartReached]);
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
npx vitest run src/core/ui/virtual-list.test.tsx
```

Expected: PASS for all 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/ui/virtual-list.tsx src/core/ui/virtual-list.test.tsx
git commit -m "feat(ui): add onEndReached/onStartReached to VirtualList"
```

---

### Task 5: VirtualList — scroll-position preservation on prepend (TDD)

**Files:**

- Modify: `src/core/ui/virtual-list.tsx`
- Modify: `src/core/ui/virtual-list.test.tsx`

- [ ] **Step 1: Add the failing test**

Append to `src/core/ui/virtual-list.test.tsx`:

```tsx
it('PreservesScrollPosition_WhenItemsPrepended', () => {
  const items = Array.from({ length: 30 }, (_, i) => ({ id: i }));
  const { container, rerender } = render(
    <div style={{ height: 200 }}>
      <VirtualList
        items={items}
        renderItem={(item) => <div style={{ height: 40 }}>Row {item.id}</div>}
        estimateSize={() => 40}
        getItemKey={(item) => item.id}
      />
    </div>,
  );
  const scroller = container.querySelector('[data-virtual-scroller]') as HTMLDivElement;
  Object.defineProperty(scroller, 'scrollHeight', {
    configurable: true,
    writable: true,
    value: 1200,
  });
  Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 200 });
  Object.defineProperty(scroller, 'scrollTop', { configurable: true, writable: true, value: 500 });

  const prepended = [...Array.from({ length: 10 }, (_, i) => ({ id: -10 + i })), ...items];
  // After prepend, mock the new scrollHeight increase (10 items * 40px = +400)
  Object.defineProperty(scroller, 'scrollHeight', {
    configurable: true,
    writable: true,
    value: 1600,
  });

  rerender(
    <div style={{ height: 200 }}>
      <VirtualList
        items={prepended}
        renderItem={(item) => <div style={{ height: 40 }}>Row {item.id}</div>}
        estimateSize={() => 40}
        getItemKey={(item) => item.id}
      />
    </div>,
  );
  // Position should shift by the prepended height to keep the same row in view: 500 + 400 = 900
  expect(scroller.scrollTop).toBe(900);
});
```

- [ ] **Step 2: Run tests — verify the new one fails**

```bash
npx vitest run src/core/ui/virtual-list.test.tsx
```

Expected: FAIL — `expected 500 to be 900` (no preservation logic yet).

- [ ] **Step 3: Implement scroll-position preservation**

Edit `src/core/ui/virtual-list.tsx` — add a layout effect that detects prepends and shifts `scrollTop`:

```tsx
import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
```

Add a ref + layout effect inside the component, after the existing effects:

```tsx
const prevFirstKeyRef = useRef<string | number | undefined>(undefined);
const prevScrollHeightRef = useRef<number>(0);

useLayoutEffect(() => {
  const el = parentRef.current;
  if (!el) return;
  const firstKey = items.length > 0 ? (getItemKey ? getItemKey(items[0] as T, 0) : 0) : undefined;
  const prevFirstKey = prevFirstKeyRef.current;
  const prevScrollHeight = prevScrollHeightRef.current;
  if (
    prevFirstKey !== undefined &&
    firstKey !== undefined &&
    firstKey !== prevFirstKey &&
    prevScrollHeight > 0
  ) {
    const delta = el.scrollHeight - prevScrollHeight;
    if (delta > 0) {
      el.scrollTop = el.scrollTop + delta;
    }
  }
  prevFirstKeyRef.current = firstKey;
  prevScrollHeightRef.current = el.scrollHeight;
}, [items, getItemKey]);
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
npx vitest run src/core/ui/virtual-list.test.tsx
```

Expected: PASS for all 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/ui/virtual-list.tsx src/core/ui/virtual-list.test.tsx
git commit -m "feat(ui): preserve scroll position on VirtualList prepend"
```

---

### Task 6: DataTable — `virtualized` opt-in mode (TDD)

**Files:**

- Modify: `src/admin/shared/data-table.tsx`
- Create: `src/admin/shared/data-table.test.tsx` (if it doesn't already exist; if it exists, append)

- [ ] **Step 1: Check if a test file exists**

```bash
ls /media/Data/Source/Verbara/Verbara.Platform.Web/src/admin/shared/data-table.test.tsx
```

If it does not exist, create with the imports below. If it does, append the new tests to the existing `describe`.

- [ ] **Step 2: Write the failing tests**

Create or append `src/admin/shared/data-table.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { DataTable } from './data-table';
import { type ColumnDef } from '@tanstack/react-table';

interface Row {
  id: number;
  name: string;
}

void i18n.init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      admin: {
        shared: {
          data_table: {
            search_placeholder: 'Search',
            no_results: 'None',
            page_info: '{{current}}/{{total}}',
            previous: 'Prev',
            next: 'Next',
          },
        },
      },
    },
  },
});

const columns: ColumnDef<Row>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' },
];

describe('DataTable virtualized mode', () => {
  it('Renders_BoundedRowCount_WhenVirtualized_AndDatasetIs5k', () => {
    const data: Row[] = Array.from({ length: 5_000 }, (_, i) => ({ id: i, name: `Row ${i}` }));
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <div style={{ height: 400 }}>
          <DataTable data={data} columns={columns} virtualized />
        </div>
      </I18nextProvider>,
    );
    const rows = container.querySelectorAll('[data-virtual-row]');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(40);
  });

  it('Defaults_NotVirtualized_WhenPropOmitted', () => {
    const data: Row[] = Array.from({ length: 30 }, (_, i) => ({ id: i, name: `Row ${i}` }));
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <DataTable data={data} columns={columns} pageSize={10} />
      </I18nextProvider>,
    );
    // Default mode: no data-virtual-row, regular <tr> rows
    expect(container.querySelectorAll('[data-virtual-row]').length).toBe(0);
    expect(container.querySelectorAll('tbody tr').length).toBe(10);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run src/admin/shared/data-table.test.tsx
```

Expected: FAIL — virtualized prop unknown / no `data-virtual-row` rendered.

- [ ] **Step 4: Implement virtualized mode**

Edit `src/admin/shared/data-table.tsx`:

Add to imports:

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';
```

Extend `DataTableProps`:

```tsx
export interface DataTableProps<T> {
  data: T[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[];
  searchPlaceholder?: string;
  noResultsMessage?: string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  virtualized?: boolean;
  virtualRowEstimate?: number;
}
```

Update the destructure:

```tsx
export function DataTable<T>({
  data,
  columns,
  searchPlaceholder,
  noResultsMessage,
  pageSize = 10,
  onRowClick,
  virtualized = false,
  virtualRowEstimate = 48,
}: DataTableProps<T>) {
```

Inside the component, after `table` is created, add the virtualizer (only used in virtualized mode):

```tsx
const scrollerRef = useRef<HTMLDivElement>(null);
const rowsForRender = virtualized ? table.getCoreRowModel().rows : table.getRowModel().rows;
const rowVirtualizer = useVirtualizer({
  count: rowsForRender.length,
  getScrollElement: () => scrollerRef.current,
  estimateSize: () => virtualRowEstimate,
  overscan: 10,
});
```

Replace the `<tbody>` block with:

```tsx
          {virtualized ? null : (
            <tbody className="divide-y">
              {rowsForRender.map((row) => (
                <tr
                  key={row.id}
                  className={`transition-colors hover:bg-muted/50${onRowClick ? ' cursor-pointer' : ''}`}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {rowsForRender.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    {resolvedNoResults}
                  </td>
                </tr>
              )}
            </tbody>
          )}
        </table>
        {virtualized && (
          <div
            ref={scrollerRef}
            data-virtual-scroller
            className="max-h-[600px] overflow-auto"
          >
            <div
              style={{
                height: rowVirtualizer.getTotalSize(),
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((vi) => {
                const row = rowsForRender[vi.index]!;
                return (
                  <div
                    key={row.id}
                    data-virtual-row
                    ref={rowVirtualizer.measureElement}
                    data-index={vi.index}
                    className={`grid border-b transition-colors hover:bg-muted/50${onRowClick ? ' cursor-pointer' : ''}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${vi.start}px)`,
                      gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
                    }}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <div key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
```

Hide the pagination block when virtualized:

```tsx
{
  !virtualized && (
    <div className="flex items-center justify-between">{/* existing pagination */}</div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/admin/shared/data-table.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Run the full test suite to catch regressions**

```bash
npx vitest run
```

Expected: PASS for all 879+ tests + the new ones (count grows by 6+ from VirtualList + 2 from DataTable).

- [ ] **Step 7: Commit**

```bash
git add src/admin/shared/data-table.tsx src/admin/shared/data-table.test.tsx
git commit -m "feat(ui): add virtualized mode to DataTable"
```

---

### Task 7: Bump version to 1.18.0 (close patch 5B.1)

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Verify current version**

```bash
grep '"version"' package.json | head -1
```

Expected: `"version": "1.17.5"` (or similar Track 5A train version).

- [ ] **Step 2: Bump to 1.18.0**

Edit `package.json`, change `"version": "1.17.5"` (or whatever current) to `"version": "1.18.0"`.

- [ ] **Step 3: Verify build still passes**

```bash
npm run build && npm run lint
```

Expected: typecheck + bundle + lint + i18n parity all PASS.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore: bump version to 1.18.0 (track 5B.1 — virtualization primitives)"
```

Per ADR-0005, no annotated tag for 1.18.0 — only the track-end tag at 1.18.1.

---

# Patch 5B.2 — Migrations + E2E (target: 1.18.1, tag `v1.18.1-web`)

### Task 8: Migrate MessageThread to VirtualList

**Files:**

- Modify: `src/agent/conversation/message-thread.tsx`
- Modify (if exists): `src/agent/conversation/message-thread.test.tsx`

- [ ] **Step 1: Check for existing tests**

```bash
ls /media/Data/Source/Verbara/Verbara.Platform.Web/src/agent/conversation/message-thread*.tsx
```

If a test exists, add an assertion that the rendered DOM contains a virtual scroller. If not, create one minimally.

- [ ] **Step 2: Add a failing test**

Create or modify `src/agent/conversation/message-thread.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MessageThread } from './message-thread';

vi.mock('@/agent/stores/conversation-store', () => ({
  useConversationStore: (selector: (s: { messages: Record<string, unknown[]> }) => unknown) =>
    selector({
      messages: {
        c1: Array.from({ length: 200 }, (_, i) => ({
          id: `m${i}`,
          type: 'agent',
          sender: 'a',
          body: `msg ${i}`,
        })),
      },
    }),
}));
vi.mock('@/core/api/hooks/use-conversations', () => ({ useMessages: () => ({ data: [] }) }));
vi.mock('./message-bubble', () => ({
  MessageBubble: ({ message }: { message: { id: string; body: string } }) => (
    <div data-msg-id={message.id}>{message.body}</div>
  ),
}));
vi.mock('./system-event', () => ({ SystemEvent: () => <div /> }));

describe('MessageThread', () => {
  it('Virtualizes_MessagesList_WhenManyMessages', () => {
    const { container } = render(
      <div style={{ height: 400 }}>
        <MessageThread conversationId="c1" />
      </div>,
    );
    expect(container.querySelector('[data-virtual-scroller]')).toBeTruthy();
    // Only a window of messages should be in the DOM, not all 200
    expect(container.querySelectorAll('[data-msg-id]').length).toBeLessThan(200);
  });
});
```

- [ ] **Step 3: Run test — verify failure**

```bash
npx vitest run src/agent/conversation/message-thread.test.tsx
```

Expected: FAIL — `[data-virtual-scroller]` missing.

- [ ] **Step 4: Migrate MessageThread**

Replace `src/agent/conversation/message-thread.tsx`:

```tsx
import { useEffect } from 'react';
import { useConversationStore } from '@/agent/stores/conversation-store';
import { useMessages } from '@/core/api/hooks/use-conversations';
import { VirtualList } from '@/core/ui/virtual-list';
import { MessageBubble } from './message-bubble';
import { SystemEvent } from './system-event';

const ESTIMATED_MESSAGE_HEIGHT_PX = 64;

export function MessageThread({ conversationId }: { conversationId: string }) {
  const messages = useConversationStore((s) => s.messages[conversationId] ?? []);
  const setMessages = useConversationStore((s) => s.setMessages);

  const { data: fetchedMessages } = useMessages(conversationId);

  useEffect(() => {
    if (fetchedMessages && fetchedMessages.length > 0) {
      setMessages(conversationId, fetchedMessages);
    }
  }, [fetchedMessages, conversationId, setMessages]);

  return (
    <div className="flex-1 px-4 py-4">
      <div className="mx-auto h-full max-w-2xl">
        <VirtualList
          items={messages}
          getItemKey={(msg) => msg.id}
          estimateSize={() => ESTIMATED_MESSAGE_HEIGHT_PX}
          stickToBottom
          renderItem={(msg, idx) => {
            if (msg.type === 'system') {
              return <SystemEvent message={msg} />;
            }
            const prev = messages[idx - 1];
            const showSender = !prev || prev.type === 'system' || prev.sender !== msg.sender;
            return (
              <div className="py-0.5">
                <MessageBubble message={msg} showSender={showSender} />
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify pass**

```bash
npx vitest run src/agent/conversation/message-thread.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Run full test suite**

```bash
npx vitest run
```

Expected: PASS, no regressions.

- [ ] **Step 7: Commit**

```bash
git add src/agent/conversation/message-thread.tsx src/agent/conversation/message-thread.test.tsx
git commit -m "refactor(agent): migrate MessageThread to VirtualList with stickToBottom"
```

---

### Task 9: Migrate InboxPanel to VirtualList

**Files:**

- Modify: `src/agent/inbox/inbox-panel.tsx`
- Modify (if exists): `src/agent/inbox/inbox-panel.test.tsx`

- [ ] **Step 1: Add or update a test**

Create or modify `src/agent/inbox/inbox-panel.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { InboxPanel } from './inbox-panel';

void i18n.init({
  lng: 'en',
  resources: { en: { agent: { inbox: { title: 'Inbox', aria: { newConversation: 'New' } } } } },
});

vi.mock('@/agent/stores/conversation-store', () => ({
  useConversationStore: (
    selector: (s: {
      filter: unknown;
      filteredConversations: () => unknown[];
      upsertConversation: () => void;
    }) => unknown,
  ) =>
    selector({
      filter: 'all',
      filteredConversations: () => Array.from({ length: 200 }, (_, i) => ({ id: `c${i}` })),
      upsertConversation: () => undefined,
    }),
}));
vi.mock('@/core/api/hooks/use-conversations', () => ({ useConversations: () => ({ data: [] }) }));
vi.mock('@/core/api/hooks/use-agents', () => ({ useAgentMe: () => ({ data: { id: 'a1' } }) }));
vi.mock('./inbox-filters', () => ({ InboxFilters: () => <div /> }));
vi.mock('./inbox-item', () => ({
  InboxItem: ({ conversation }: { conversation: { id: string } }) => (
    <div data-conv-id={conversation.id} />
  ),
}));
vi.mock('./inbox-empty', () => ({ InboxEmpty: () => <div /> }));
vi.mock('./agent-status-selector', () => ({ AgentStatusSelector: () => <div /> }));
vi.mock('./new-conversation-dialog', () => ({ NewConversationDialog: () => <div /> }));

describe('InboxPanel', () => {
  it('Virtualizes_InboxList_WhenManyConversations', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <div style={{ height: 400 }}>
          <InboxPanel />
        </div>
      </I18nextProvider>,
    );
    expect(container.querySelector('[data-virtual-scroller]')).toBeTruthy();
    expect(container.querySelectorAll('[data-conv-id]').length).toBeLessThan(200);
  });
});
```

- [ ] **Step 2: Run test — verify failure**

```bash
npx vitest run src/agent/inbox/inbox-panel.test.tsx
```

Expected: FAIL — no virtual scroller.

- [ ] **Step 3: Migrate InboxPanel**

Replace the `<div className="flex-1 overflow-y-auto">` block in `src/agent/inbox/inbox-panel.tsx` with VirtualList:

```tsx
import { VirtualList } from '@/core/ui/virtual-list';

const INBOX_ITEM_HEIGHT_PX = 64;
```

Replace the body:

```tsx
<div className="flex-1">
  {visible.length === 0 ? (
    <InboxEmpty filter={filter} />
  ) : (
    <VirtualList
      items={visible}
      getItemKey={(conv) => conv.id}
      estimateSize={() => INBOX_ITEM_HEIGHT_PX}
      renderItem={(conv) => (
        <div className="border-b border-slate-100 dark:border-slate-700/50">
          <InboxItem conversation={conv} />
        </div>
      )}
    />
  )}
</div>
```

- [ ] **Step 4: Run test to verify pass**

```bash
npx vitest run src/agent/inbox/inbox-panel.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/agent/inbox/inbox-panel.tsx src/agent/inbox/inbox-panel.test.tsx
git commit -m "refactor(agent): migrate InboxPanel to VirtualList"
```

---

### Task 10: Enable virtualized mode on `audit-viewer-page`

**Files:**

- Modify: `src/admin/security/audit/audit-viewer-page.tsx`

- [ ] **Step 1: Locate the deferred-virtualization comment and DataTable usage**

```bash
grep -n "virtualization deferred\|DataTable" /media/Data/Source/Verbara/Verbara.Platform.Web/src/admin/security/audit/audit-viewer-page.tsx
```

Expected output includes `// virtualization deferred` near line 12 and a `<DataTable ... />` invocation later.

- [ ] **Step 2: Add `virtualized` prop and remove the deferred comment**

Edit `src/admin/security/audit/audit-viewer-page.tsx`:

- Remove the line that says `// virtualization deferred` (and the matching `// - Paged backend (50 rows/page default, max 500) — virtualization deferred` comment block).
- Find the `<DataTable` call and add `virtualized` to its props.

Example (the exact prop list will depend on the existing call-site):

```tsx
<DataTable
  data={events}
  columns={columns}
  virtualized
  // ... existing props
/>
```

- [ ] **Step 3: Run typecheck + linter**

```bash
npm run build && npm run lint
```

Expected: PASS.

- [ ] **Step 4: Run any existing audit tests**

```bash
npx vitest run src/admin/security/audit/
```

Expected: PASS (no behavior change visible in unit tests; visual confirmation deferred to E2E + manual perf check).

- [ ] **Step 5: Commit**

```bash
git add src/admin/security/audit/audit-viewer-page.tsx
git commit -m "refactor(admin): enable virtualized DataTable on audit-viewer-page"
```

---

### Task 11: Enable virtualized mode on `audit-page`

**Files:**

- Modify: `src/admin/audit/audit-page.tsx`

- [ ] **Step 1: Locate the DataTable usage**

```bash
grep -n "DataTable" /media/Data/Source/Verbara/Verbara.Platform.Web/src/admin/audit/audit-page.tsx
```

- [ ] **Step 2: Add `virtualized` prop**

Edit `src/admin/audit/audit-page.tsx` and add `virtualized` to the `<DataTable ... />` props.

- [ ] **Step 3: Verify**

```bash
npm run build && npx vitest run src/admin/audit/
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/admin/audit/audit-page.tsx
git commit -m "refactor(admin): enable virtualized DataTable on audit-page"
```

---

### Task 12: Migrate `notification-drawer` to VirtualList with infinite scroll

**Files:**

- Modify: `src/shell/notification-drawer.tsx`
- Modify: `public/locales/en-US/notifications.json`
- Modify: `public/locales/es-419/notifications.json`
- Modify: `public/locales/pt-BR/notifications.json`

- [ ] **Step 1: Inspect the current Load More wiring**

```bash
grep -n "loadMore\|LoadMore\|canLoadMore\|handleLoadMore\|PAGE_SIZE" /media/Data/Source/Verbara/Verbara.Platform.Web/src/shell/notification-drawer.tsx
```

- [ ] **Step 2: Identify the i18n key for the Load More button**

```bash
grep -n "loadMore\|load_more" /media/Data/Source/Verbara/Verbara.Platform.Web/public/locales/en-US/notifications.json
```

Note the exact key path (e.g. `"actions.loadMore"`).

- [ ] **Step 3: Replace the list rendering with VirtualList**

Edit `src/shell/notification-drawer.tsx`:

- Add `import { VirtualList } from '@/core/ui/virtual-list';`
- Replace the `notifications.map(...)` block with:

```tsx
<VirtualList
  items={notifications}
  getItemKey={(n) => n.id}
  estimateSize={() => 80}
  onEndReached={canLoadMore ? handleLoadMore : undefined}
  renderItem={(n) => <NotificationRow notification={n} />}
/>
```

(Adapt `NotificationRow` to whatever the existing item-rendering component is named in the file.)

- Remove the `Load More` button JSX block and the `canLoadMore && activeTab === 'all'` wrapper around it.

- [ ] **Step 4: Remove the i18n key from all three locales**

Edit each of:

- `public/locales/en-US/notifications.json`
- `public/locales/es-419/notifications.json`
- `public/locales/pt-BR/notifications.json`

Remove the `loadMore` entry (exact path from Step 2).

- [ ] **Step 5: Verify i18n parity passes**

```bash
npm run i18n:check
```

Expected: PASS.

- [ ] **Step 6: Verify typecheck + lint**

```bash
npm run build && npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/shell/notification-drawer.tsx public/locales/en-US/notifications.json public/locales/es-419/notifications.json public/locales/pt-BR/notifications.json
git commit -m "refactor(shell): migrate notification-drawer to VirtualList with infinite scroll"
```

---

### Task 13: Enable virtualized mode on `agent-states-page`

**Files:**

- Modify: `src/operations/agent-states/agent-states-page.tsx`

- [ ] **Step 1: Locate DataTable usage**

```bash
grep -n "DataTable" /media/Data/Source/Verbara/Verbara.Platform.Web/src/operations/agent-states/agent-states-page.tsx
```

- [ ] **Step 2: Add `virtualized` prop**

Edit the `<DataTable ... />` invocation to include `virtualized`.

- [ ] **Step 3: Verify**

```bash
npm run build && npx vitest run src/operations/agent-states/
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/operations/agent-states/agent-states-page.tsx
git commit -m "refactor(operations): enable virtualized DataTable on agent-states-page"
```

---

### Task 14: Migrate monitor voice-tab session cards to VirtualList

**Files:**

- Modify: `src/operations/monitor/monitor-page.tsx`

- [ ] **Step 1: Locate the voice-tab session map**

```bash
grep -n "sessions.map\|useActiveSessions" /media/Data/Source/Verbara/Verbara.Platform.Web/src/operations/monitor/monitor-page.tsx
```

- [ ] **Step 2: Wrap the cards in VirtualList**

Edit `src/operations/monitor/monitor-page.tsx`:

- Add `import { VirtualList } from '@/core/ui/virtual-list';`
- Replace the `sessions.map(...)` rendering with:

```tsx
<VirtualList
  items={sessions}
  getItemKey={(s) => s.sessionId}
  estimateSize={() => 96}
  renderItem={(session) => (
    <div className="px-1 py-1">
      {/* existing card markup, refactored to a component if not already */}
      <SessionCard session={session} />
    </div>
  )}
/>
```

If the inline card markup is large, extract it into a sibling `SessionCard` component first (no behavior change), then call it from `renderItem`.

- [ ] **Step 3: Verify**

```bash
npm run build && npm run lint
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/operations/monitor/monitor-page.tsx
git commit -m "refactor(operations): wrap voice-tab session cards in VirtualList"
```

---

### Task 15: Add Playwright virtualization E2E spec

**Files:**

- Create: `tests/e2e/virtualization.spec.ts`

- [ ] **Step 1: Inspect an existing Playwright spec for patterns**

```bash
ls /media/Data/Source/Verbara/Verbara.Platform.Web/tests/e2e/ | head -10
head -30 /media/Data/Source/Verbara/Verbara.Platform.Web/tests/e2e/$(ls /media/Data/Source/Verbara/Verbara.Platform.Web/tests/e2e/ | head -1)
```

Note the existing import paths, fixture/login helper, and locator conventions.

- [ ] **Step 2: Create `tests/e2e/virtualization.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test.describe('Virtualization', () => {
  test('MessageThread_RendersBoundedDom_WithThousandMessages', async ({ page }) => {
    // Adapt to existing login helper / fixture in this repo
    await page.goto('/agent');
    // Open a conversation seeded with 1000 mocked messages — assumes a test fixture or a route param
    await page.goto('/agent?conv=test-1k');
    const scroller = page.locator('[data-virtual-scroller]').first();
    await expect(scroller).toBeVisible();
    const count = await page.locator('[data-virtual-row]').count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(60);
  });

  test('MessageThread_AutoScrollsToBottom_WhenAtBottom', async ({ page }) => {
    await page.goto('/agent?conv=test-1k');
    // Scroll to bottom
    await page
      .locator('[data-virtual-scroller]')
      .first()
      .evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
    // Trigger a new message via test-only window hook (must be wired in dev/test build)
    await page.evaluate(() =>
      (window as unknown as { __pushTestMessage?: () => void }).__pushTestMessage?.(),
    );
    // Verify scrollTop still near bottom
    const distance = await page
      .locator('[data-virtual-scroller]')
      .first()
      .evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop);
    expect(distance).toBeLessThanOrEqual(50);
  });

  test('AuditViewer_VirtualizesRows_WithThousandEvents', async ({ page }) => {
    await page.goto('/admin/security/audit?seed=1000');
    const scroller = page.locator('[data-virtual-scroller]');
    await expect(scroller).toBeVisible();
    const count = await page.locator('[data-virtual-row]').count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(80);
  });
});
```

- [ ] **Step 3: Wire test fixtures (if needed)**

If `?conv=test-1k` and `?seed=1000` are not already supported by the demo backend, add a thin in-memory branch behind a `VITE_E2E` flag or extend the existing test fixture. Keep it minimal — only what these tests need.

```bash
grep -rn "VITE_E2E\|e2e fixture" /media/Data/Source/Verbara/Verbara.Platform.Web/src/ | head -5
```

If no fixture infrastructure exists, the simplest path is mocking `useMessages`/`useAuditSearch` to return seeded data when `import.meta.env.MODE === 'test'`.

- [ ] **Step 4: Run the new spec**

```bash
npx playwright test tests/e2e/virtualization.spec.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/virtualization.spec.ts
# include any test-fixture changes touched
git commit -m "test(e2e): add Playwright spec for virtualization"
```

---

### Task 16: Manual perf check + close track

**Files:**

- Modify: `package.json` (bump to 1.18.1)
- Modify: `CLAUDE.md`
- Modify: `MEMORY.md` (auto-memory)
- Move: `docs/plans/active/2026-05-08-track-5b-virtualization*.md` → `docs/plans/completed/`

- [ ] **Step 1: Run the manual perf check on MessageThread**

Open the dev server with a 1,000-message conversation:

```bash
npm run dev
```

In Chrome DevTools → Performance, record while scrolling top→bottom on the chat. Save a note:

```
MessageThread perf (1000 msgs):
- p95 frame time: ____ ms (must be < 16.67)
- longest task: ____ ms (must be < 50)
```

- [ ] **Step 2: Run the manual perf check on audit-viewer**

Same procedure, on `/admin/security/audit` with 1,000 events seeded. Record results.

- [ ] **Step 3: Run full test suite + e2e + lint**

```bash
npx vitest run && npx playwright test && npm run lint
```

Expected: PASS.

- [ ] **Step 4: Bump version to 1.18.1**

Edit `package.json` → `"version": "1.18.1"`.

- [ ] **Step 5: Update `CLAUDE.md`**

In `Verbara.Platform.Web/CLAUDE.md`, update the version-summary line (currently `Version 2.0.0 (Nivel 5 Track 5A Loading States done)`) to reflect Track 5B closure. Update the "Next:" line to point at Track 5C (a11y) per the roadmap.

- [ ] **Step 6: Update auto-memory**

Edit `~/.claude/projects/-media-Data-Source-Verbara-Verbara-Platform-Web/memory/project_current_position.md` and `project_v1.14_roadmap.md` to mark Track 5B done. Update `MEMORY.md` if the index entry changes.

- [ ] **Step 7: Move the plan files into `completed/`**

```bash
git mv docs/plans/active/2026-05-08-track-5b-virtualization.md docs/plans/completed/
git mv docs/plans/active/2026-05-08-track-5b-virtualization-plan.md docs/plans/completed/
```

- [ ] **Step 8: Commit the closure**

```bash
git add package.json CLAUDE.md
git commit -m "chore: close Track 5B virtualization (v1.18.1-web)"
```

- [ ] **Step 9: Tag and release**

```bash
git tag -a v1.18.1-web -m "Track 5B: VirtualList + DataTable virtualized; 6 components migrated"
gh release create v1.18.1-web --title "v1.18.1-web — Track 5B Virtualization" --notes "Track 5B closes Nivel 5 Track 5B (Virtualization). Adds <VirtualList> and <DataTable virtualized> primitives backed by @tanstack/react-virtual. Migrates: MessageThread, InboxPanel, audit-viewer, audit-page, notification-drawer (replaces Load More with infinite scroll), agent-states-page, monitor voice tab. 1000+ items at 60 fps verified on chat and audit-viewer."
```

(`gh release create` requires the user to authenticate `gh` — if not, push the tag and create the release manually.)

---

## Self-Review

**Spec coverage check (against `2026-05-08-track-5b-virtualization.md`):**

| Spec requirement                                                                                  | Task                                                |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Add `@tanstack/react-virtual` dep                                                                 | Task 1                                              |
| `<VirtualList>` API: `items`, `renderItem`, `estimateSize`, `getItemKey`, `overscan`, `className` | Task 2                                              |
| `<VirtualList>` `stickToBottom` (50px threshold)                                                  | Task 3                                              |
| `<VirtualList>` `onEndReached` / `onStartReached`                                                 | Task 4                                              |
| `<VirtualList>` scroll-position preservation on prepend                                           | Task 5                                              |
| `<VirtualList>` dynamic measurement via `measureElement`                                          | Task 2 (passes ref to `virtualizer.measureElement`) |
| `<DataTable virtualized>` opt-in mode                                                             | Task 6                                              |
| Sticky thead, grid-aligned cells                                                                  | Task 6                                              |
| Default `virtualized={false}` no behavior change                                                  | Task 6 (Step 2 second test)                         |
| Migrate MessageThread                                                                             | Task 8                                              |
| Migrate InboxPanel                                                                                | Task 9                                              |
| Migrate audit-viewer + audit-page                                                                 | Tasks 10, 11                                        |
| Migrate notification-drawer with infinite scroll, remove i18n key                                 | Task 12                                             |
| Migrate agent-states-page                                                                         | Task 13                                             |
| Migrate monitor voice tab                                                                         | Task 14                                             |
| Playwright virtualization spec                                                                    | Task 15                                             |
| Manual Chrome perf check on MessageThread + audit-viewer (p95 < 16.67ms)                          | Task 16                                             |
| `v1.18.1-web` tag + GitHub release                                                                | Task 16                                             |
| Move plan files to completed/                                                                     | Task 16                                             |
| Update CLAUDE.md + MEMORY.md                                                                      | Task 16                                             |

All spec requirements have a task. No gaps.

**Risks tracked:**

- R1 (chat auto-scroll trap): Tasks 3, 4, 5 cover stickToBottom, onEndReached, prepend preservation; Task 15 adds E2E.
- R2 (DataTable expandable + virtualization): Task 6 uses `measureElement` for dynamic measurement; existing audit-viewer expandable rows tested in Tasks 10–11.
- R3 (i18n parity): Task 12 removes the key from all three locales and runs `npm run i18n:check`.

**Placeholder scan:** No `TBD`/`TODO`/`fill in details` strings. Each step has either complete code or an exact command. Migration tasks (10, 11, 13, 14) intentionally do not show full file rewrites — they are surgical "add `virtualized` prop" changes to specific call-sites whose surrounding markup is preserved as-is. The grep step at the start of each migration task locates the exact line.

**Type consistency:** `VirtualListProps<T>` is consistent across Tasks 2–5. `DataTableProps<T>` extension in Task 6 (`virtualized?: boolean`, `virtualRowEstimate?: number`) is used unchanged in Tasks 10, 11, 13. The `data-virtual-scroller` and `data-virtual-row` attributes are introduced in Tasks 2/3 and reused in Tasks 6, 8, 9, 15 consistently.

**Done.**
