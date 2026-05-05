# Sub A — Notification Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Platform.Web to the Sprint 4 backend Notification Center, relocate conversation assignment alerts to toasts + agent rail badge, and delete the misplaced client-only `notification-store.ts`.

**Architecture:** TanStack Query hook `use-notifications.ts` + Sheet drawer with category tabs + SSE listener for `notification.created`. Conversation assignments move to Sonner toast + ephemeral agent-alerts Zustand store driving a numeric badge on the Agent rail icon.

**Tech Stack:** React 19, TypeScript 5.9, TanStack Query 5.95, Zustand 5.0, base-ui Sheet/Tabs, Sonner 2.0, date-fns 4.1, lucide-react 0.577, vitest 4.1 + RTL 16.3.

**Spec:** `docs/superpowers/specs/2026-04-10-sub-a-notification-center-design.md`

---

## File Structure

**New (4):**

- `src/core/api/hooks/use-notifications.ts` — 4 hooks + types + optimistic updates
- `src/shell/notification-drawer.tsx` — Sheet drawer with category tabs + list + mark-all
- `src/shell/notification-item.tsx` — single row component with severity icon + click
- `src/agent/stores/agent-alerts-store.ts` — ephemeral Zustand store for agent rail badge

**Modified (4):**

- `src/shell/notification-bell.tsx` — rewritten as drawer trigger + unread badge
- `src/core/hooks/use-sse.ts` — add `notification.created` listener + rewrite `conversation.assigned` handler
- `src/shell/rail.tsx` — wrap Agent RailIcon with numeric badge
- `src/pages/agent/agent-layout.tsx` — reset agent-alerts on mount

**Deleted (2):**

- `src/core/stores/notification-store.ts`
- `src/core/stores/notification-store.test.ts`

**Tests (2 new):**

- `src/core/api/hooks/use-notifications.test.tsx`
- `src/shell/notification-item.test.tsx`

---

## Task Dependency Graph

```
Task 1 (use-notifications hook + tests)
  ↓
Task 2 (notification-item + test)
  ↓
Task 3 (notification-drawer)
  ↓
Task 4 (notification-bell rewrite)

Task 5 (agent-alerts-store)
  ↓
  ├── Task 6 (use-sse.ts modifications)
  ├── Task 7 (rail.tsx badge)
  └── Task 8 (agent-layout.tsx reset)

Tasks 4 + 6 → Task 9 (delete notification-store)
All tasks → Task 10 (final verification)
```

Tasks 1→4 form the "center" track. Tasks 5→8 form the "agent badge" track. Task 9 can only run after both tracks have removed the old `notification-store` imports. Task 10 is the final build + typecheck + manual verification.

---

## Task 1: `use-notifications.ts` hook + tests

**Files:**

- Create: `src/core/api/hooks/use-notifications.ts`
- Create: `src/core/api/hooks/use-notifications.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/core/api/hooks/use-notifications.test.tsx`:

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@/core/api/client', () => ({
  customFetch: vi.fn(),
}));

import { customFetch } from '@/core/api/client';
import {
  useNotifications,
  useUnreadCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type Notification,
} from './use-notifications';

const mockFetch = customFetch as ReturnType<typeof vi.fn>;

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const sample: Notification = {
  notificationId: 'n-1',
  type: 'billing.quota_warning',
  category: 'Billing',
  severity: 'Warning',
  title: 'Quota warning',
  body: 'You are at 85% of monthly limit',
  actionUrl: '/admin/billing/usage',
  isRead: false,
  createdAt: '2026-04-10T12:00:00Z',
  readAt: null,
};

describe('useNotifications', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should_FetchNotifications_WhenCalled', async () => {
    mockFetch.mockResolvedValueOnce([sample]);

    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sample]);
    expect(mockFetch).toHaveBeenCalledWith({
      url: '/api/v1/notifications',
      method: 'GET',
      params: {},
    });
  });

  it('should_PassUnreadOnlyParam_WhenRequested', async () => {
    mockFetch.mockResolvedValueOnce([]);

    const { result } = renderHook(
      () => useNotifications({ unreadOnly: true, limit: 20 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith({
      url: '/api/v1/notifications',
      method: 'GET',
      params: { unreadOnly: 'true', limit: '20' },
    });
  });
});

describe('useUnreadCount', () => {
  beforeEach(() => mockFetch.mockReset());

  it('should_ReturnCount_WhenCalled', async () => {
    mockFetch.mockResolvedValueOnce({ count: 3 });

    const { result } = renderHook(() => useUnreadCount(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ count: 3 });
    expect(mockFetch).toHaveBeenCalledWith({
      url: '/api/v1/notifications/unread-count',
      method: 'GET',
    });
  });
});

describe('useMarkNotificationRead', () => {
  beforeEach(() => mockFetch.mockReset());

  it('should_CallPutEndpoint_WhenMutated', async () => {
    mockFetch.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useMarkNotificationRead(), { wrapper });
    result.current.mutate('n-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith({
      url: '/api/v1/notifications/n-1/read',
      method: 'PUT',
    });
  });
});

describe('useMarkAllNotificationsRead', () => {
  beforeEach(() => mockFetch.mockReset());

  it('should_CallReadAllEndpoint_WhenMutated', async () => {
    mockFetch.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useMarkAllNotificationsRead(), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith({
      url: '/api/v1/notifications/read-all',
      method: 'PUT',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /media/Data/Source/Verbara/Asterisk.Platform.Web
npm run test -- use-notifications
```

Expected: FAIL with "Cannot find module './use-notifications'" or similar.

- [ ] **Step 3: Create the hook file**

Create `src/core/api/hooks/use-notifications.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

export type NotificationCategory = 'Operational' | 'System' | 'Security' | 'Billing';
export type NotificationSeverity = 'Info' | 'Warning' | 'Critical';

export interface Notification {
  notificationId: string;
  type: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  body: string;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

export interface UnreadCountResponse {
  count: number;
}

export interface NotificationListParams {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

function buildParams(params: NotificationListParams): Record<string, string> {
  const result: Record<string, string> = {};
  if (params.unreadOnly !== undefined) result.unreadOnly = String(params.unreadOnly);
  if (params.limit !== undefined) result.limit = String(params.limit);
  if (params.offset !== undefined) result.offset = String(params.offset);
  return result;
}

export function useNotifications(params: NotificationListParams = {}) {
  return useQuery({
    queryKey: ['notifications', 'list', params],
    queryFn: () =>
      customFetch<Notification[]>({
        url: '/api/v1/notifications',
        method: 'GET',
        params: buildParams(params),
      }),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () =>
      customFetch<UnreadCountResponse>({
        url: '/api/v1/notifications/unread-count',
        method: 'GET',
      }),
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/notifications/${id}/read`,
        method: 'PUT',
      }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['notifications'] });

      const previousLists = qc.getQueriesData<Notification[]>({
        queryKey: ['notifications', 'list'],
      });
      const previousCount = qc.getQueryData<UnreadCountResponse>(['notifications', 'unread-count']);

      qc.setQueriesData<Notification[]>({ queryKey: ['notifications', 'list'] }, (old) =>
        old?.map((n) =>
          n.notificationId === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n,
        ),
      );

      if (previousCount) {
        qc.setQueryData<UnreadCountResponse>(['notifications', 'unread-count'], {
          count: Math.max(0, previousCount.count - 1),
        });
      }

      return { previousLists, previousCount };
    },
    onError: (err: Error, _id, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([key, data]) => qc.setQueryData(key, data));
      }
      if (context?.previousCount !== undefined) {
        qc.setQueryData(['notifications', 'unread-count'], context.previousCount);
      }
      toast.error(err.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      customFetch<void>({
        url: '/api/v1/notifications/read-all',
        method: 'PUT',
      }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['notifications'] });

      const previousLists = qc.getQueriesData<Notification[]>({
        queryKey: ['notifications', 'list'],
      });
      const previousCount = qc.getQueryData<UnreadCountResponse>(['notifications', 'unread-count']);

      qc.setQueriesData<Notification[]>({ queryKey: ['notifications', 'list'] }, (old) =>
        old?.map((n) => (n.isRead ? n : { ...n, isRead: true, readAt: new Date().toISOString() })),
      );

      qc.setQueryData<UnreadCountResponse>(['notifications', 'unread-count'], { count: 0 });

      return { previousLists, previousCount };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([key, data]) => qc.setQueryData(key, data));
      }
      if (context?.previousCount !== undefined) {
        qc.setQueryData(['notifications', 'unread-count'], context.previousCount);
      }
      toast.error(err.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- use-notifications
```

Expected: 5 tests passing (2 in `useNotifications`, 1 each in `useUnreadCount`, `useMarkNotificationRead`, `useMarkAllNotificationsRead`).

- [ ] **Step 5: Typecheck + commit**

```bash
npm run build 2>&1 | tail -20
```

Expected: 0 TypeScript errors.

```bash
git add src/core/api/hooks/use-notifications.ts src/core/api/hooks/use-notifications.test.tsx
git commit -m "feat(notifications): add use-notifications hook with optimistic updates"
```

---

## Task 2: `notification-item.tsx` component + test

**Files:**

- Create: `src/shell/notification-item.tsx`
- Create: `src/shell/notification-item.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/shell/notification-item.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { NotificationItem } from './notification-item';
import type { Notification } from '@/core/api/hooks/use-notifications';

const base: Notification = {
  notificationId: 'n-1',
  type: 'billing.quota_warning',
  category: 'Billing',
  severity: 'Warning',
  title: 'Quota warning',
  body: 'You are at 85% of monthly limit',
  actionUrl: '/admin/billing/usage',
  isRead: false,
  createdAt: new Date().toISOString(),
  readAt: null,
};

function renderItem(n: Notification) {
  return render(
    <MemoryRouter>
      <NotificationItem notification={n} onClick={() => {}} />
    </MemoryRouter>,
  );
}

describe('NotificationItem', () => {
  it('should_RenderTitleAndBody_WhenGivenNotification', () => {
    renderItem(base);
    expect(screen.getByText('Quota warning')).toBeInTheDocument();
    expect(screen.getByText(/85% of monthly limit/)).toBeInTheDocument();
  });

  it('should_ShowUnreadDot_WhenNotificationIsUnread', () => {
    renderItem(base);
    const dot = document.querySelector('[data-testid="notification-unread-dot"]');
    expect(dot).toBeInTheDocument();
  });

  it('should_HideUnreadDot_WhenNotificationIsRead', () => {
    renderItem({ ...base, isRead: true, readAt: new Date().toISOString() });
    const dot = document.querySelector('[data-testid="notification-unread-dot"]');
    expect(dot).not.toBeInTheDocument();
  });

  it('should_RenderWarningIcon_WhenSeverityIsWarning', () => {
    renderItem(base);
    expect(document.querySelector('[data-testid="notification-icon-warning"]')).toBeInTheDocument();
  });

  it('should_RenderCriticalIcon_WhenSeverityIsCritical', () => {
    renderItem({ ...base, severity: 'Critical' });
    expect(document.querySelector('[data-testid="notification-icon-critical"]')).toBeInTheDocument();
  });

  it('should_RenderInfoIcon_WhenSeverityIsInfo', () => {
    renderItem({ ...base, severity: 'Info' });
    expect(document.querySelector('[data-testid="notification-icon-info"]')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- notification-item
```

Expected: FAIL with "Cannot find module './notification-item'".

- [ ] **Step 3: Create the component**

Create `src/shell/notification-item.tsx`:

```typescript
import { formatDistanceToNow } from 'date-fns';
import { Info, AlertTriangle, AlertCircle } from 'lucide-react';
import type { Notification, NotificationSeverity } from '@/core/api/hooks/use-notifications';

interface NotificationItemProps {
  notification: Notification;
  onClick: (notification: Notification) => void;
}

function SeverityIcon({ severity }: { severity: NotificationSeverity }) {
  if (severity === 'Critical') {
    return (
      <AlertCircle
        className="h-5 w-5 shrink-0 text-red-500"
        data-testid="notification-icon-critical"
      />
    );
  }
  if (severity === 'Warning') {
    return (
      <AlertTriangle
        className="h-5 w-5 shrink-0 text-amber-500"
        data-testid="notification-icon-warning"
      />
    );
  }
  return (
    <Info
      className="h-5 w-5 shrink-0 text-blue-500"
      data-testid="notification-icon-info"
    />
  );
}

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const { title, body, severity, isRead, createdAt } = notification;
  const relativeTime = formatDistanceToNow(new Date(createdAt), { addSuffix: true });

  return (
    <button
      type="button"
      onClick={() => onClick(notification)}
      className={`flex w-full items-start gap-3 border-b border-slate-100 p-3 text-left transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 ${
        isRead ? 'opacity-60' : ''
      }`}
      data-testid={`notification-item-${notification.notificationId}`}
    >
      <SeverityIcon severity={severity} />
      <div className="min-w-0 flex-1">
        <div className={`text-sm ${isRead ? 'font-normal' : 'font-medium'} text-foreground`}>
          {title}
        </div>
        <div className="line-clamp-2 text-xs text-muted-foreground">{body}</div>
        <div className="mt-1 text-xs text-muted-foreground">{relativeTime}</div>
      </div>
      {!isRead && (
        <span
          className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand"
          data-testid="notification-unread-dot"
        />
      )}
    </button>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- notification-item
```

Expected: 6 tests passing.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run build 2>&1 | tail -10
```

Expected: 0 TypeScript errors.

```bash
git add src/shell/notification-item.tsx src/shell/notification-item.test.tsx
git commit -m "feat(notifications): add NotificationItem component with severity icons"
```

---

## Task 3: `notification-drawer.tsx` Sheet drawer

**Files:**

- Create: `src/shell/notification-drawer.tsx`

- [ ] **Step 1: Create the drawer component**

Create `src/shell/notification-drawer.tsx`:

```typescript
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/core/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/core/ui/tabs';
import { Button } from '@/core/ui/button';
import { NotificationItem } from './notification-item';
import {
  useNotifications,
  useUnreadCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type Notification,
  type NotificationCategory,
} from '@/core/api/hooks/use-notifications';

interface NotificationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TabValue = 'all' | NotificationCategory;

const CATEGORIES: { value: TabValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'Operational', label: 'Operational' },
  { value: 'System', label: 'System' },
  { value: 'Security', label: 'Security' },
  { value: 'Billing', label: 'Billing' },
];

const PAGE_SIZE = 50;

export function NotificationDrawer({ open, onOpenChange }: NotificationDrawerProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const { data: notifications = [], isLoading } = useNotifications({ limit });
  const { data: unreadCount } = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const categoryCounts = useMemo(() => {
    const counts: Record<TabValue, number> = {
      all: 0,
      Operational: 0,
      System: 0,
      Security: 0,
      Billing: 0,
    };
    for (const n of notifications) {
      if (!n.isRead) {
        counts.all += 1;
        counts[n.category] += 1;
      }
    }
    return counts;
  }, [notifications]);

  const filtered = useMemo(() => {
    if (activeTab === 'all') return notifications;
    return notifications.filter((n) => n.category === activeTab);
  }, [notifications, activeTab]);

  const canLoadMore = notifications.length === limit;

  function handleItemClick(n: Notification) {
    if (!n.isRead) {
      markRead.mutate(n.notificationId);
    }
    if (n.actionUrl) {
      navigate(n.actionUrl);
      onOpenChange(false);
    }
  }

  function handleMarkAll() {
    markAllRead.mutate();
  }

  function handleLoadMore() {
    setLimit((prev) => prev + PAGE_SIZE);
  }

  const hasUnread = (unreadCount?.count ?? 0) > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:!max-w-md overflow-hidden flex flex-col p-0">
        <SheetHeader className="flex-row items-center justify-between gap-0 border-b border-slate-200 px-4 py-3 pr-12 dark:border-slate-700">
          <SheetTitle>Notifications</SheetTitle>
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAll}
              disabled={markAllRead.isPending}
              data-testid="notification-mark-all-btn"
            >
              <Check className="mr-1 h-4 w-4" />
              Mark all read
            </Button>
          )}
        </SheetHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => v && setActiveTab(v as TabValue)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <TabsList className="flex w-full justify-start overflow-x-auto border-b border-slate-200 px-2 dark:border-slate-700">
            {CATEGORIES.map((cat) => (
              <TabsTrigger key={cat.value} value={cat.value} className="gap-1.5">
                {cat.label}
                {categoryCounts[cat.value] > 0 && (
                  <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                    {categoryCounts[cat.value]}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {CATEGORIES.map((cat) => (
            <TabsContent
              key={cat.value}
              value={cat.value}
              className="flex-1 overflow-y-auto p-0"
            >
              {isLoading ? (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  Loading…
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Bell className="h-8 w-8" />
                  <span className="text-sm">No notifications</span>
                </div>
              ) : (
                <>
                  {filtered.map((n) => (
                    <NotificationItem
                      key={n.notificationId}
                      notification={n}
                      onClick={handleItemClick}
                    />
                  ))}
                  {canLoadMore && activeTab === 'all' && (
                    <div className="p-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleLoadMore}
                        data-testid="notification-load-more-btn"
                      >
                        Load more
                      </Button>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Typecheck to verify it compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: 0 TypeScript errors. Note: the drawer is not yet consumed; build may warn about unused export which is OK because Task 4 will wire it.

- [ ] **Step 3: Commit**

```bash
git add src/shell/notification-drawer.tsx
git commit -m "feat(notifications): add NotificationDrawer with category tabs and mark-all"
```

---

## Task 4: Rewrite `notification-bell.tsx`

**Files:**

- Modify: `src/shell/notification-bell.tsx`

- [ ] **Step 1: Replace the file content**

Overwrite `src/shell/notification-bell.tsx` with:

```typescript
import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useUnreadCount } from '@/core/api/hooks/use-notifications';
import { NotificationDrawer } from './notification-drawer';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data } = useUnreadCount();
  const count = data?.count ?? 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
        className="relative flex h-10 w-10 items-center justify-center rounded-md text-rail-icon hover:bg-slate-800 hover:text-rail-icon-active"
        data-testid="notification-bell-btn"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span
            className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
            data-testid="notification-bell-badge"
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
      <NotificationDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
```

- [ ] **Step 2: Typecheck to verify it compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: 0 TypeScript errors. The old `notification-store` import is gone, but `notification-store.ts` still exists (deleted in Task 9).

- [ ] **Step 3: Commit**

```bash
git add src/shell/notification-bell.tsx
git commit -m "feat(notifications): rewrite NotificationBell as drawer trigger"
```

---

## Task 5: `agent-alerts-store.ts`

**Files:**

- Create: `src/agent/stores/agent-alerts-store.ts`

- [ ] **Step 1: Create the store**

Create `src/agent/stores/agent-alerts-store.ts`:

```typescript
import { create } from 'zustand';

interface AgentAlertsState {
  pendingCount: number;
  increment: () => void;
  reset: () => void;
}

export const useAgentAlertsStore = create<AgentAlertsState>()((set) => ({
  pendingCount: 0,
  increment: () => set((s) => ({ pendingCount: s.pendingCount + 1 })),
  reset: () => set({ pendingCount: 0 }),
}));
```

- [ ] **Step 2: Typecheck**

```bash
npm run build 2>&1 | tail -10
```

Expected: 0 TypeScript errors. Note: store is not yet consumed; the bundler may tree-shake until Task 6/7/8 wire it.

- [ ] **Step 3: Commit**

```bash
git add src/agent/stores/agent-alerts-store.ts
git commit -m "feat(notifications): add ephemeral agent-alerts Zustand store"
```

---

## Task 6: Modify `use-sse.ts` — add `notification.created` + rewrite `conversation.assigned`

**Files:**

- Modify: `src/core/hooks/use-sse.ts`

- [ ] **Step 1: Replace the file content**

Overwrite `src/core/hooks/use-sse.ts` with:

```typescript
import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@/core/auth/auth-store';
import { useAgentAlertsStore } from '@/agent/stores/agent-alerts-store';
import {
  useCampaignMetricsStore,
  type CampaignStatus,
} from '@/operations/stores/campaign-metrics-store';
import { useAgentAiStore } from '@/agent/stores/agent-ai-store';
import type { NotificationSeverity } from '@/core/api/hooks/use-notifications';

type SseEventHandler = (data: unknown) => void;
const handlers: Record<string, SseEventHandler[]> = {};

export function useSSE() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const sourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!accessToken || sourceRef.current) return;

    const url = `/api/v1/events/stream?token=${encodeURIComponent(accessToken)}`;
    const source = new EventSource(url);
    sourceRef.current = source;

    source.addEventListener('conversation.assigned', (e) => {
      try {
        const data = JSON.parse(e.data) as {
          conversationId: string;
          contactName: string;
        };
        const isInAgentRoute = window.location.pathname.startsWith('/agent');

        toast.info(`New conversation from ${data.contactName}`, {
          duration: 6000,
          action: {
            label: 'Open',
            onClick: () => navigate(`/agent/conversation/${data.conversationId}`),
          },
        });

        if (!isInAgentRoute) {
          useAgentAlertsStore.getState().increment();
        }

        handlers['conversation.assigned']?.forEach((h) => h(data));
      } catch {
        // Malformed payload — skip
      }
    });

    source.addEventListener('conversation.message', (e) => {
      try {
        const data = JSON.parse(e.data);
        handlers['conversation.message']?.forEach((h) => h(data));
      } catch {
        // ignore
      }
    });

    source.addEventListener('conversation.state_changed', (e) => {
      try {
        const data = JSON.parse(e.data);
        handlers['conversation.state_changed']?.forEach((h) => h(data));
      } catch {
        // ignore
      }
    });

    source.addEventListener('agent.state_changed', (e) => {
      try {
        const data = JSON.parse(e.data);
        handlers['agent.state_changed']?.forEach((h) => h(data));
      } catch {
        // ignore
      }
    });

    source.addEventListener('campaign.status_changed', (e) => {
      try {
        const data = JSON.parse(e.data) as { campaignId: string; newStatus: CampaignStatus };
        useCampaignMetricsStore.getState().updateStatus(data.campaignId, data.newStatus);
        handlers['campaign.status_changed']?.forEach((h) => h(data));
      } catch {
        // ignore
      }
    });

    source.addEventListener('campaign.metrics_updated', (e) => {
      try {
        const data: { campaignId: string } & Record<string, unknown> = JSON.parse(e.data);
        useCampaignMetricsStore.getState().updateMetrics(data.campaignId, data);
        handlers['campaign.metrics_updated']?.forEach((h) => h(data));
      } catch {
        // ignore
      }
    });

    source.addEventListener('agentassist.suggestion', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const currentUserId = useAuthStore.getState().user?.id;
        if (data.agentId === currentUserId) {
          useAgentAiStore.getState().addSuggestion(data.suggestion ?? data);
        }
        handlers['agentassist.suggestion']?.forEach((h) => h(data));
      } catch {
        // ignore
      }
    });

    source.addEventListener('agentassist.sentiment', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const currentUserId = useAuthStore.getState().user?.id;
        if (data.agentId === currentUserId) {
          useAgentAiStore.getState().updateSentiment(data.sentiment ?? data);
        }
        handlers['agentassist.sentiment']?.forEach((h) => h(data));
      } catch {
        // ignore
      }
    });

    source.addEventListener('agentassist.compliance_alert', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const currentUserId = useAuthStore.getState().user?.id;
        if (data.agentId === currentUserId) {
          useAgentAiStore.getState().addComplianceAlert(data.alert ?? data);
        }
        handlers['agentassist.compliance_alert']?.forEach((h) => h(data));
      } catch {
        // ignore
      }
    });

    source.addEventListener('agentassist.transcript', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const currentUserId = useAuthStore.getState().user?.id;
        if (data.agentId === currentUserId) {
          useAgentAiStore.getState().addTranscript(data.segment ?? data);
        }
        handlers['agentassist.transcript']?.forEach((h) => h(data));
      } catch {
        // ignore
      }
    });

    source.addEventListener('notification.created', (e) => {
      try {
        const data = JSON.parse(e.data) as {
          notificationId: string;
          userId: string;
          category: string;
          severity: NotificationSeverity;
          title: string;
          body: string;
          actionUrl: string | null;
          timestamp: string;
        };

        queryClient.invalidateQueries({ queryKey: ['notifications'] });

        if (data.severity === 'Critical') {
          toast.error(data.title, {
            description: data.body,
            duration: 10000,
            action: data.actionUrl
              ? { label: 'View', onClick: () => navigate(data.actionUrl!) }
              : undefined,
          });
        } else if (data.severity === 'Warning') {
          toast.warning(data.title, { description: data.body, duration: 6000 });
        }
        // Info: silent, only bell badge updates via invalidation

        handlers['notification.created']?.forEach((h) => h(data));
      } catch {
        // Malformed payload — skip
      }
    });

    source.onerror = () => {
      source.close();
      sourceRef.current = null;
      // Catch up missed notifications on reconnect
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setTimeout(connect, 2000);
    };
  }, [accessToken, queryClient, navigate]);

  useEffect(() => {
    connect();
    return () => {
      sourceRef.current?.close();
      sourceRef.current = null;
    };
  }, [connect]);
}

export function onSseEvent(type: string, handler: SseEventHandler) {
  if (!handlers[type]) handlers[type] = [];
  handlers[type]!.push(handler);
  return () => {
    handlers[type] = handlers[type]?.filter((h) => h !== handler) ?? [];
  };
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run build 2>&1 | tail -20
```

Expected: 0 TypeScript errors. The old `useNotificationStore` import is removed.

- [ ] **Step 3: Commit**

```bash
git add src/core/hooks/use-sse.ts
git commit -m "feat(notifications): wire SSE to notification.created and agent alerts"
```

---

## Task 7: Add badge to Agent rail icon in `rail.tsx`

**Files:**

- Modify: `src/shell/rail.tsx`

- [ ] **Step 1: Replace the file content**

Overwrite `src/shell/rail.tsx` with:

```typescript
import { useTranslation } from 'react-i18next';
import { RailIcon } from './rail-icon';
import { NotificationBell } from './notification-bell';
import { UserMenu } from './user-menu';
import { useAuthStore } from '@/core/auth/auth-store';
import { useAgentAlertsStore } from '@/agent/stores/agent-alerts-store';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/core/ui/tooltip';
import { Settings, Activity, BarChart3, MessageSquare, Hexagon, Command } from 'lucide-react';

export function Rail() {
  const { t } = useTranslation();
  const permissions = useAuthStore((s) => s.permissions);
  const agentAlerts = useAgentAlertsStore((s) => s.pendingCount);

  function hasAny(...perms: string[]) {
    return perms.some((p) => permissions.includes(p));
  }

  const showAdmin = hasAny(
    'users:user:view',
    'queues:queue:view',
    'campaigns:campaign:view',
    'system:tenant:configure',
    'routing:flow:view',
  );
  const showOperations = hasAny('reporting:realtime:view', 'contacts:conversation:monitor');
  const showAnalytics = hasAny('analytics:cdr:view', 'reporting:historical:view');

  function openCommandPalette() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  }

  return (
    <nav className="flex h-full w-12 flex-col items-center bg-rail-bg py-3">
      <div className="mb-6 text-brand">
        <Hexagon className="h-6 w-6" />
      </div>

      <div className="flex flex-1 flex-col items-center gap-1">
        {showAdmin && (
          <RailIcon to="/admin" icon={Settings} label={t('nav.admin')} />
        )}
        {showOperations && (
          <RailIcon to="/operations" icon={Activity} label={t('nav.operations')} />
        )}
        {showAnalytics && (
          <RailIcon to="/analytics" icon={BarChart3} label={t('nav.analytics')} />
        )}
        <div className="relative">
          <RailIcon to="/agent" icon={MessageSquare} label={t('nav.agent')} />
          {agentAlerts > 0 && (
            <span
              className="pointer-events-none absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white"
              data-testid="agent-rail-badge"
            >
              {agentAlerts > 9 ? '9+' : agentAlerts}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-1">
        <TooltipProvider delay={200}>
          <Tooltip>
            <TooltipTrigger
              render={(props) => (
                <button
                  {...props}
                  onClick={openCommandPalette}
                  className="flex h-10 w-10 items-center justify-center rounded-md text-rail-icon hover:bg-slate-800 hover:text-rail-icon-active"
                />
              )}
            >
              <Command className="h-5 w-5" />
            </TooltipTrigger>
            <TooltipContent side="right">{t('actions.search')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <NotificationBell />
        <UserMenu />
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run build 2>&1 | tail -10
```

Expected: 0 TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/shell/rail.tsx
git commit -m "feat(notifications): add numeric badge to Agent rail icon"
```

---

## Task 8: Reset agent-alerts on agent-layout mount

**Files:**

- Modify: `src/pages/agent/agent-layout.tsx`

- [ ] **Step 1: Replace the file content**

Overwrite `src/pages/agent/agent-layout.tsx` with:

```typescript
import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { initConversationSSE } from '@/agent/stores/conversation-store';
import { useAgentAlertsStore } from '@/agent/stores/agent-alerts-store';
import { InboxPanel } from '@/agent/inbox/inbox-panel';
import { ContextPanel } from '@/agent/context/context-panel';
import { AgentTour } from '@/agent/tour/agent-tour';

export default function AgentLayout() {
  const [contextOpen, setContextOpen] = useState(true);

  const toggleContext = useCallback(() => {
    setContextOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    initConversationSSE();
  }, []);

  useEffect(() => {
    useAgentAlertsStore.getState().reset();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        toggleContext();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleContext]);

  return (
    <div className="flex h-full">
      {/* Inbox Panel */}
      <aside data-tour="inbox" className="flex w-70 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <InboxPanel />
      </aside>

      {/* Conversation Panel */}
      <main data-tour="conversation" className="relative flex min-w-0 flex-1 flex-col">
        {/* Context panel toggle */}
        <button
          type="button"
          onClick={toggleContext}
          className="absolute top-2 right-2 z-10 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          title="Toggle context panel (Ctrl+I)"
        >
          {contextOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
        </button>
        <Outlet />
      </main>

      {/* Context Panel */}
      {contextOpen && (
        <aside data-tour="context" className="flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <ContextPanel />
        </aside>
      )}

      <AgentTour />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run build 2>&1 | tail -10
```

Expected: 0 TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/agent/agent-layout.tsx
git commit -m "feat(notifications): reset agent rail badge on agent layout mount"
```

---

## Task 9: Delete `notification-store.ts` and its test

**Files:**

- Delete: `src/core/stores/notification-store.ts`
- Delete: `src/core/stores/notification-store.test.ts`

- [ ] **Step 1: Verify zero remaining consumers**

```bash
cd /media/Data/Source/Verbara/Asterisk.Platform.Web
grep -rn "notification-store\|useNotificationStore" src/ 2>/dev/null
```

Expected: NO output (zero matches). If any match appears, STOP and fix before proceeding.

- [ ] **Step 2: Delete the files**

```bash
rm src/core/stores/notification-store.ts src/core/stores/notification-store.test.ts
```

- [ ] **Step 3: Typecheck + test suite**

```bash
npm run build 2>&1 | tail -20
npm run test 2>&1 | tail -20
```

Expected:

- Build: 0 TypeScript errors
- Tests: all pass. The old `notification-store.test.ts` tests are gone; new tests from Tasks 1-2 take their place.

- [ ] **Step 4: Commit**

```bash
git add -A src/core/stores/
git commit -m "refactor(notifications): remove obsolete client-only notification-store"
```

---

## Task 10: Final verification

**Files:**

- None (verification only)

- [ ] **Step 1: Full build**

```bash
cd /media/Data/Source/Verbara/Asterisk.Platform.Web
npm run build
```

Expected: build completes with 0 errors, 0 warnings.

- [ ] **Step 2: Full test suite**

```bash
npm run test
```

Expected: all unit tests pass. Count should include the new tests from Tasks 1 and 2 (approximately 11 new tests: 5 in `use-notifications.test.tsx` + 6 in `notification-item.test.tsx`).

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Manual verification (demo environment)**

Start the demo backend if not already running:

```bash
cd /media/Data/Source/Verbara/Asterisk.Platform
docker compose -f docker/demo/docker-compose.demo.yml up -d
```

Start the dev server:

```bash
cd /media/Data/Source/Verbara/Asterisk.Platform.Web
npm run dev
```

Verify the following in the browser:

1. Login with demo credentials. Bell icon appears in the bottom of the rail.
2. Bell badge shows 0 initially (or whatever the backend reports).
3. Click the bell → drawer opens from the right with 5 tabs (All, Operational, System, Security, Billing).
4. Empty state shows Bell icon + "No notifications" text if no data.
5. Trigger a notification from the backend. Easiest: trigger a GDPR export via `/admin/gdpr` which emits `gdpr.export_completed` (category System, severity Info). Bell badge should increment.
6. Reopen drawer → new notification appears in the "System" tab with Info icon.
7. Click the notification → if it has an `actionUrl`, navigate there and drawer closes.
8. Verify the clicked notification shows as read (opacity reduced, no dot).
9. Trigger a Critical notification (e.g., via backend dunning simulation). Toast error appears (10s, dismissable, with View action if actionUrl). Bell badge increments.
10. Click "Mark all read" in the drawer. Badge goes to 0, all items opacity-reduced.
11. Simulate an inbound conversation assignment (requires agent workspace). Verify:
    - Toast info appears with "Open" action
    - If NOT in `/agent/*` route: Agent rail icon shows numeric badge
    - Navigate to `/agent` → badge clears

- [ ] **Step 5: Verify no remaining references**

```bash
grep -rn "notification-store\|useNotificationStore" src/
```

Expected: zero matches.

- [ ] **Step 6: Summary commit (no code, verification only — skip if nothing to commit)**

No changes in this step. If all verifications pass, Sub A is complete.

---

## Verification checklist against acceptance criteria

Map each spec acceptance criterion to the task where it is implemented:

| #   | Criterion                                         | Task                     |
| --- | ------------------------------------------------- | ------------------------ |
| 1   | Bell badge shows unread count                     | Task 4                   |
| 2   | Bell click opens right-side drawer                | Task 4                   |
| 3   | Drawer has 5 category tabs                        | Task 3                   |
| 4   | Each tab shows unread count badge                 | Task 3                   |
| 5   | Items display severity icon + title + body + time | Task 2                   |
| 6   | Unread bold + dot; read opacity-reduced           | Task 2                   |
| 7   | Click marks read + navigates actionUrl            | Task 3 (handleItemClick) |
| 8   | "Mark all read" button                            | Task 3                   |
| 9   | Load more button                                  | Task 3                   |
| 10  | Empty state per tab                               | Task 3                   |
| 11  | SSE notification.created → invalidate + toast     | Task 6                   |
| 12  | conversation.assigned → toast + agent badge       | Task 6                   |
| 13  | Agent rail badge resets on /agent/\*              | Task 8                   |
| 14  | notification-store deleted                        | Task 9                   |
| 15  | Build passes 0 errors                             | Task 10                  |
| 16  | Unit tests pass                                   | Task 10                  |
