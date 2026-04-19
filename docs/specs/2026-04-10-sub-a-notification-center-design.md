# Sub A — Notification Center Design

**Date:** 2026-04-10
**Parent release:** v1.6.0 "Production Polish"
**Sub-project:** A of 5 (see `project_v160_production_polish.md` in memory)
**Scope:** Platform.Web only (zero backend changes)

## Context

Platform backend shipped a full Notification Center in Sprint 4 (2026-04-07): 5 endpoints at `/api/v1/notifications`, 14 registered notification types across 4 categories (Operational / System / Security / Billing), 3 severity levels (Info / Warning / Critical), role-based routing, SSE delivery via `NotificationEvent` (`notification.created` event), and 6 branded HTML email templates for critical notifications.

The frontend has consumed **zero** of this surface. Instead, `src/shell/notification-bell.tsx` is a client-side-only bell that listens to one SSE event (`conversation.assigned`) and stores it in an ephemeral Zustand store (`src/core/stores/notification-store.ts`). The existing bell is conceptually misplaced: agent conversation assignments are *work items*, not system notifications, and every comparable CCaaS product (Slack, Linear, Intercom, Genesys Cloud, Salesforce Service Cloud, Zendesk, ServiceNow) separates these two concepts.

This sub-project closes the gap by implementing a real Notification Center and relocating conversation assignment alerts to where they belong.

## Approved approach: D + E + G combined

From deep analysis, three orthogonal axes:

- **D — Concept separation.** Bell surfaces *only* backend notifications. Conversation assignments become toasts + a numeric badge on the Agent rail icon. `notification-store.ts` is deleted.
- **E — Drawer (Sheet), not dropdown.** Bell opens a right-side Sheet with category tabs, scalable to future filters without UX rework.
- **G — TanStack Query for server state.** Replace Zustand with TanStack Query cache, consistent with the other 40 hooks in the codebase.

## Out of scope (explicitly deferred)

- Per-user notification preferences (category mute/unmute) → v1.8.0
- Quiet hours / digest mode → v1.8.0
- Dedicated `/notifications` page — drawer is sufficient for MVP, re-evaluate after user feedback
- Desktop Notifications API (browser push) → v2.0
- Sound effects
- i18n of the 14 notification types — titles/bodies come from backend verbatim
- E2E Playwright tests — handled by parallel E2E Sprint 4
- Per-severity badge color breakdown — use simple red counter

## Architecture

### § 1 — API Layer: `use-notifications.ts`

New file: `src/core/api/hooks/use-notifications.ts`

**Types:**

```typescript
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
  category?: NotificationCategory;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}
```

**Query keys (scoped to avoid collision — v1.5.0 lesson):**

```
['notifications', 'list', params]      // from useNotifications(params)
['notifications', 'unread-count']      // from useUnreadCount()
['notifications', 'detail', id]        // from useNotification(id) — optional
```

**Hooks:**

| Hook | HTTP | Notes |
|---|---|---|
| `useNotifications(params?)` | `GET /api/v1/notifications` | query params: `unreadOnly`, `limit`, `offset`, plus client-side `category` filter post-fetch (backend does not filter by category) |
| `useUnreadCount()` | `GET /api/v1/notifications/unread-count` | returns `{ count: number }` |
| `useMarkNotificationRead()` | `PUT /api/v1/notifications/{id}/read` | optimistic: set `isRead=true`, decrement unread count |
| `useMarkAllNotificationsRead()` | `PUT /api/v1/notifications/read-all` | optimistic: set all `isRead=true`, unread count = 0 |

**Note on category filtering:** Backend does not filter by category (see `NotificationEndpoints.cs:39-53`). We fetch all, then filter client-side in the drawer tabs. Since users rarely have hundreds of unread notifications, this is acceptable for MVP.

**Optimistic update pattern:**

```typescript
useMarkNotificationRead onMutate:
  - Cancel queries matching ['notifications']
  - Snapshot current data
  - queryClient.setQueryData(['notifications', 'list', ...], (old) =>
      old?.map(n => n.notificationId === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
  - queryClient.setQueryData(['notifications', 'unread-count'], (old) =>
      old ? { count: Math.max(0, old.count - 1) } : old)
  - Return snapshot for rollback
onError: rollback snapshot
onSettled: invalidate ['notifications']
```

### § 2 — UI: Bell + Drawer

**File: `src/shell/notification-bell.tsx`** (REWRITTEN)

Responsibilities: trigger button only. Reads `useUnreadCount()`, shows bell icon with red badge when `count > 0`. On click, opens the drawer via local state.

- Badge: solid red dot with `count` (or `99+` if > 99), consistent with current visual
- Accessibility: `aria-label` with unread count
- No dropdown menu — Sheet opens on click

**File: `src/shell/notification-drawer.tsx`** (NEW)

A `Sheet` from `@/core/ui/sheet` that slides in from the right. Props: `open: boolean`, `onOpenChange: (open: boolean) => void`.

Layout:

```
SheetContent (side="right", class="w-96 sm:w-[440px]")
  ├── SheetHeader
  │     ├── SheetTitle: "Notifications"
  │     └── "Mark all read" button (visible only if unreadCount > 0)
  ├── Tabs (base-ui Tabs component already in @/core/ui/tabs)
  │     ├── TabsList: All | Operational | System | Security | Billing
  │     │              (each tab shows count badge of unread in category)
  │     └── TabsContent per category: <NotificationList category={...} />
  └── Footer (if empty state): EmptyState component
```

Filtering logic inside drawer:
- `useNotifications()` fetches all (limit=50 default)
- For each tab, filter by category client-side
- "All" tab shows unfiltered

Load-more: if `list.length === limit`, show a "Load more" button that refetches with `offset += 50`. Track offset in drawer local state.

**File: `src/shell/notification-item.tsx`** (NEW)

A single row component. Props: `notification: Notification`, `onClick?: (n: Notification) => void`.

```
┌────────────────────────────────────┐
│ [icon]  Title (bold if unread)    │
│         Body text truncated to 2…  │
│         2 min ago          [dot?]  │
└────────────────────────────────────┘
```

- Left: icon per severity
  - `Info` → `Info` icon, blue-500
  - `Warning` → `AlertTriangle` icon, amber-500
  - `Critical` → `AlertCircle` icon, red-500
- Middle: title (font-medium if unread, font-normal + opacity-70 if read) + body (line-clamp-2 text-xs) + `formatDistanceToNow(createdAt)` from date-fns
- Right: unread dot (2×2 brand color) when `!isRead`
- Click behavior:
  1. Call `useMarkNotificationRead().mutate(notificationId)` if unread
  2. If `actionUrl` is present: `navigate(actionUrl)` (internal) and close drawer
  3. If no `actionUrl`: no navigation, just marks read
- Hover state: slight background tint (`hover:bg-slate-50 dark:hover:bg-slate-800`)

Empty state per tab: inline `<div>` with centered `Bell` icon (muted color) + "No notifications" text. Not reusing `@/admin/shared/empty-state` because importing from `admin/` into `shell/` would cross architectural layers.

### § 3 — SSE Integration + Toast Policy

**File: `src/core/hooks/use-sse.ts`** (MODIFIED)

**Add listener for `notification.created`:**

```typescript
source.addEventListener('notification.created', (e) => {
  const data = JSON.parse(e.data) as {
    notificationId: string;
    userId: string;
    category: NotificationCategory;
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
  // Info: silent, only bell badge increments via invalidation
});
```

**Remove old `conversation.assigned` handler that writes to notification-store (use-sse.ts:22-31).** Replace with the new handler described in § 4.

`useSSE()` currently does not have access to `queryClient` or `navigate`. Add:

```typescript
const queryClient = useQueryClient();
const navigate = useNavigate();
```

at the top of the hook.

**Toast delivery policy:**

| Severity | Bell badge | Toast | Duration | Action button |
|---|---|---|---|---|
| Critical | ✅ | ✅ `toast.error` | 10s, dismissable | Yes (if actionUrl) |
| Warning | ✅ | ✅ `toast.warning` | 6s auto-dismiss | No |
| Info | ✅ | ❌ | — | — |

**Conversation.assigned policy:**

| Route at time of event | Toast | Badge increment |
|---|---|---|
| Inside `/agent/*` | ✅ `toast.info` with "Open" action | ❌ (already visible in inbox) |
| Outside `/agent/*` | ✅ `toast.info` with "Open" action | ✅ (agent rail badge) |

### § 4 — Agent rail badge for conversation.assigned

**File: `src/agent/stores/agent-alerts-store.ts`** (NEW)

Ephemeral (non-persisted) Zustand store:

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

**File: `src/core/hooks/use-sse.ts`** (already modified in § 3, add the replacement handler):

```typescript
source.addEventListener('conversation.assigned', (e) => {
  const data = JSON.parse(e.data);
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
});
```

**File: `src/shell/rail.tsx`** (MODIFIED)

The existing Agent `RailIcon` becomes wrapped with a numeric badge when `pendingCount > 0`:

```tsx
import { useAgentAlertsStore } from '@/agent/stores/agent-alerts-store';

// inside Rail():
const agentAlerts = useAgentAlertsStore((s) => s.pendingCount);

// in JSX where <RailIcon to="/agent" ... /> is rendered:
<div className="relative">
  <RailIcon to="/agent" icon={MessageSquare} label={t('nav.agent')} />
  {agentAlerts > 0 && (
    <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
      {agentAlerts > 9 ? '9+' : agentAlerts}
    </span>
  )}
</div>
```

Note: `RailIcon` currently doesn't expose a badge slot. Either wrap externally (as above) or extend `RailIcon` with an optional `badge?: number` prop. Decision: wrap externally to keep `RailIcon` simple.

**File: `src/pages/agent/agent-layout.tsx`** (MODIFIED)

Add effect to reset badge on entry:

```typescript
import { useAgentAlertsStore } from '@/agent/stores/agent-alerts-store';

// inside AgentLayout():
useEffect(() => {
  useAgentAlertsStore.getState().reset();
}, []);
```

Runs once on mount — when user navigates away and back, it resets again.

### § 5 — Deprecation of `notification-store.ts`

**Files to delete:**
- `src/core/stores/notification-store.ts`
- `src/core/stores/notification-store.test.ts`

**Consumers already handled:**
- `src/core/hooks/use-sse.ts` — modified in §§ 3-4 (imports removed, handler replaced)
- `src/shell/notification-bell.tsx` — rewritten in § 2 (imports removed)

**Verification step:** before deletion, run `grep -r "notification-store\|useNotificationStore" src/` — expected zero matches after the rewrites above.

## Files changed

**New (4):**
- `src/core/api/hooks/use-notifications.ts` — API hook with 4 hooks + types
- `src/shell/notification-drawer.tsx` — Sheet drawer with tabs
- `src/shell/notification-item.tsx` — single row component
- `src/agent/stores/agent-alerts-store.ts` — ephemeral agent badge counter

**Modified (4):**
- `src/shell/notification-bell.tsx` — rewritten as drawer trigger + unread badge
- `src/core/hooks/use-sse.ts` — add `notification.created` listener, rewrite `conversation.assigned` handler, add `useQueryClient` + `useNavigate` + `toast`
- `src/shell/rail.tsx` — wrap Agent RailIcon with numeric badge
- `src/pages/agent/agent-layout.tsx` — reset agent-alerts on mount

**Deleted (2):**
- `src/core/stores/notification-store.ts`
- `src/core/stores/notification-store.test.ts`

**Net:** +4 new, −2 deleted = +2 TS/TSX files (from 274 to 276)

## Data flow

```
Backend NotificationService
  ↓ Publish NotificationEvent on PlatformEventBus
  ↓
SSE stream `/api/v1/events/stream`
  ↓ event: notification.created
  ↓
Frontend use-sse.ts listener
  ↓ queryClient.invalidateQueries(['notifications'])
  ↓ toast.error/warning based on severity
  ↓
TanStack Query refetches
  ↓ useUnreadCount() → bell badge updates
  ↓ useNotifications() → drawer list updates (if open)
  ↓
User clicks notification in drawer
  ↓ useMarkNotificationRead() mutation (optimistic)
  ↓ Navigate to actionUrl if present
  ↓ Drawer closes
```

## Error handling

- **SSE disconnect:** already handled by existing reconnect logic in `use-sse.ts` (2s retry). On reconnect, invalidate `['notifications']` to catch up any missed events.
- **Mark-read mutation failure:** rollback optimistic update via TanStack Query's `onError` + `onSettled` invalidation. Show `toast.error('Failed to mark notification as read')`.
- **Empty actionUrl + click:** just marks read, no navigation. Drawer stays open.
- **Malformed SSE payload:** wrap `JSON.parse` in try/catch, log to console, skip event. (Match existing handlers in `use-sse.ts`.)
- **Mark-all-read with zero unread:** button is hidden when `unreadCount === 0`, so this case is prevented at the UI layer.

## Testing strategy

**Unit tests (vitest):**
- `use-notifications.test.ts` — mock `customFetch`, verify hooks return data, test optimistic updates for mark-read mutations
- Test notification-item rendering for each severity (snapshot or testing-library queries)
- Test drawer filter-by-category logic

**Manual verification:**
1. Start demo environment
2. Trigger a notification from backend (e.g., by running GDPR export which emits `gdpr.export_completed`)
3. Verify bell badge increments
4. Open drawer, verify notification appears in "System" tab
5. Click notification → verify navigation + mark-read
6. Verify optimistic badge decrement
7. Refresh page → verify state persists (from backend)
8. Trigger `conversation.assigned` → verify toast + agent badge (not in bell)

**E2E (deferred):** E2E Sprint 4 will add Playwright tests for the drawer, toast, and badge.

## Acceptance criteria

1. Bell badge shows unread count from `GET /notifications/unread-count`
2. Bell click opens right-side drawer (Sheet), not dropdown
3. Drawer has 5 category tabs: All, Operational, System, Security, Billing
4. Each tab shows count of unread within that category
5. Items display severity icon (Info/Warning/Critical), title, body (2-line clamp), relative timestamp
6. Unread items have bold title + unread dot; read items are opacity-reduced
7. Click on item marks it as read (optimistic) and navigates to `actionUrl` if present
8. "Mark all read" button appears in header when `unreadCount > 0`, clears all
9. Load-more button fetches next 50 items
10. Empty state per tab with Bell icon and "No notifications" message
11. SSE `notification.created` invalidates queries and shows toast for Critical (10s) or Warning (6s)
12. `conversation.assigned` SSE event shows toast + increments Agent rail badge (not notification bell)
13. Agent rail badge resets when navigating to `/agent/*`
14. `notification-store.ts` and its test are deleted; no remaining grep matches
15. Build passes (`npm run build`) with 0 TypeScript errors
16. Unit tests pass (`npm run test`)

## Dependencies

- No new npm dependencies required
- Uses existing: `@tanstack/react-query` (5.95.x), `sonner` (2.0.x), `date-fns` (4.1.x), `lucide-react` (0.577.x), `@base-ui/react` (1.3.x) via `@/core/ui/sheet` + `@/core/ui/tabs`

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| `RailIcon` doesn't support children/badge slot | Wrap externally with relative positioning (no component change) |
| `useSSE` doesn't have router context for `useNavigate` | Add `const navigate = useNavigate()` at hook start — `AppShell` is already inside `RouterProvider` |
| Client-side category filter slow with many notifications | Backend limit=50 caps list size; if this becomes a perf issue, revisit in v1.7.0 with server-side category filter |
| Existing Sonner toast styles might not match new error/warning look | Sonner already supports `.error` and `.warning` variants; verify once visually |
| Conversation assignment toast spam if many arrive | Sonner auto-stacks and limits; 6s duration prevents pile-up |
| `notification-store.test.ts` deletion leaves test count inconsistent | Replace with `use-notifications.test.ts` as part of the same task — net test delta should be positive |
