# Track 5B — Virtualization (Spec)

- **Date:** 2026-05-08
- **Status:** Draft → pending user approval
- **Roadmap:** [v1.14.x Operational Foundation](2026-05-03-v1.14.x-operational-foundation-roadmap.md), Nivel 5, Track 5B
- **Target version:** `v1.18.1-web` (2-patch track: `1.18.0`, `1.18.1`)
- **Predecessor:** Track 5A — Loading States Centralized (closed 2026-05-08)

## Goal

Eliminate frame-rate collapse on long lists by introducing two reusable virtualization primitives and migrating every component that realistically renders 500+ items.

**Acceptance criterion (from roadmap):** 1000+ items rendered while maintaining 60 fps on mid-tier hardware.

## Scope decision

The roadmap literal lists "MessageThread, InboxPanel, large tables (CDR, audit logs, DNC)". An exhaustive audit (35+ candidates scanned, then re-verified file-by-file) shows that most of the original list is already handled by server pagination at small page sizes (20–100/page) where virtualization adds zero value. The honest scope is much tighter:

### TIER 1 — collapses today or near-term (3)

1. `src/agent/conversation/message-thread.tsx` — chat thread, no upper bound, plain `.map()` (42 lines)
2. `src/agent/inbox/inbox-panel.tsx` — inbox list, no pagination, plain `.map()` (68 lines)
3. `src/admin/security/audit/audit-viewer-page.tsx` + `src/admin/audit/audit-page.tsx` — paged 50–500/page with inline comment `// virtualization deferred` at line 12 of audit-viewer; the upper-bound 500/page is borderline-worth virtualizing now while the comment explicitly defers it

### TIER 2 — high preventive value (3)

4. `src/shell/notification-drawer.tsx` — `useNotifications({ limit })` with client-side `Load More` that grows `limit` by `PAGE_SIZE = 50` per click; can reach 1000+ items in a single open drawer
5. `src/operations/agent-states/agent-states-page.tsx` — DataTable 100/page **with per-row realtime subscriptions**; virtualization reduces re-render cost on every realtime tick even at 100 rows
6. `src/operations/monitor/monitor-page.tsx` (voice tab) — `useActiveSessions()` returns unbounded session array, rendered as `.map()` cards; can spike to 500+ during high-load periods

### TIER 3 — covered transparently by DataTable mode

12 server-paged DataTable call-sites (agents, campaigns, users, queues, surveys, bots, KB, flows, webhooks, skills, retention, user sessions). They inherit virtualization automatically once `DataTable` gains the `virtualized` prop. **No call-site changes required.** Virtualization is a no-op while their page sizes stay small (<100), but the prop is available the day a page bumps its `pageSize` for any reason.

### Out of scope (verified during audit, with reasons)

| Component                                               | Why skipped                                                                              |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `analytics/cdr/cdr-page.tsx`                            | AG Grid v35 — already virtualizes natively                                               |
| `admin/dnc-lists/dnc-list-detail.tsx`                   | Already paginated server-side at 100/page via `useDncEntries(listId, offset, limit=100)` |
| `admin/campaigns/steps/contacts-step.tsx` (CSV preview) | Preview already capped at 10 rows (`previewRows = parseResult.rows.slice(0, 10)`)        |
| `admin/webhooks/dead-letter-page.tsx`                   | DataTable paged 20/page server-side                                                      |
| `admin/compliance/consent-management-page.tsx`          | `useSearchContacts()` capped at pageSize=20                                              |
| `analytics/recording/recording-archive-page.tsx`        | Filtered slice of CDR pageSize=50                                                        |
| `operations/monitor/digital-monitor-tab.tsx`            | `useSupervisorConversations(filters, pageSize=25)`                                       |
| `operations/monitor/session-detail.tsx`                 | Hard-capped at 50 messages client-side                                                   |
| XY Flow flow-designer                                   | Canvas manages own virtualization                                                        |
| Static lists < 50 items                                 | Command palette, channels, trunks, license, schedule-step, heatmap                       |
| Speech Analytics topics                                 | Capped at Top 10/25/50                                                                   |

## Architecture

### Dependency

```
@tanstack/react-virtual ^3.x
```

Same vendor as TanStack Table 8.21 already in use; integrates natively.

### Two primitives in `src/core/ui/`

```
src/core/ui/
├── virtual-list.tsx          NEW
├── virtual-list.test.tsx     NEW
├── data-table.tsx            MODIFIED — adds optional `virtualized` mode
└── data-table.test.tsx       MODIFIED — adds virtualized-mode tests
```

### `<VirtualList>` API

```tsx
interface VirtualListProps<T> {
  items: readonly T[];
  renderItem: (item: T, index: number) => ReactNode;
  estimateSize: (index: number) => number; // px estimate per row
  getItemKey?: (item: T, index: number) => string | number;
  overscan?: number; // default 5
  className?: string;

  // Chat / feed extras (optional, opt-in)
  reverse?: boolean; // anchor scroll at bottom (chat)
  stickToBottom?: boolean; // auto-scroll on new items if user is near bottom
  onEndReached?: () => void; // infinite scroll (called when overscan hits last item)
  onStartReached?: () => void; // chat-style prepend (called when overscan hits first item)
}
```

**Implementation notes:**

- Internal `useRef` for the scroll container, `useVirtualizer({ count, getScrollElement, estimateSize, overscan, getItemKey })`.
- Items rendered with `position: absolute; transform: translateY(${item.start}px)`.
- Dynamic measurement via `virtualizer.measureElement` (passes `ref` to each rendered row).
- `stickToBottom`: tracks `isNearBottom` (within 50px) on scroll; auto-scrolls only when true.
- `onStartReached`: when prepending, capture `scrollHeight` before prepend, restore `scrollTop = newScrollHeight - oldScrollHeight + oldScrollTop` to preserve viewport position.

### `<DataTable virtualized>` mode

When `virtualized={true}`:

- `<thead>` stays as normal table header with `position: sticky; top: 0; z-index: 1`.
- `<tbody>` is replaced by a scroll container with `position: relative; height: ${virtualizer.getTotalSize()}px`.
- Rows render absolutely positioned. Layout uses `display: grid` per row with `grid-template-columns` matching column widths so cells align with the sticky header.
- Sort, filter, expandable rows, pagination controls (when both server-pagination and virtualization coexist) all keep working.
- Default `virtualized={false}` — no behavior change for existing call-sites until they opt in.

### Why two primitives, not one

Feed-style components (chat, inbox, notifications, monitor cards) need: variable item heights, auto-scroll-to-bottom, scroll-position preservation on prepend, no header/columns. Tables need: sticky header, columns aligned to header, sort/filter UI, expandable rows. A single wrapper with both behaviors ends up with 15 optional props that are mutually exclusive in practice. Two focused primitives are smaller and clearer.

## Migration plan

| Patch | Version                      | Contents                                                                                                                                                                                                                                                               |
| ----- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5B.1  | `1.18.0`                     | Add `@tanstack/react-virtual` dep. Implement `<VirtualList>` + `DataTable` virtualized mode. Unit tests for both. No call-site changes.                                                                                                                                |
| 5B.2  | `1.18.1` (tag `v1.18.1-web`) | Migrate **TIER 1 + TIER 2** (6 components): MessageThread, InboxPanel, audit-viewer, audit-page, notification-drawer (replace Load More with infinite scroll), agent-states-page, monitor voice tab. Add Playwright virtualization spec. Track close + GitHub release. |

Per [ADR-0005](../../decisions/0005-versioning-track-end-tags.md): no annotated tag on `1.18.0`; only `1.18.1` gets `v1.18.1-web` tag and a release whose notes summarize the full track. The `v1.18.1-web` target matches the roadmap entry exactly.

## Per-component migration detail

| Component                 | Primitive                                          | Notes                                                                                                                                |
| ------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| MessageThread             | `VirtualList reverse stickToBottom onStartReached` | Variable heights via dynamic measurement. System events and message bubbles share the list. Infinite scroll up loads older messages. |
| InboxPanel                | `VirtualList`                                      | Stable ~64px rows; `estimateSize: () => 64`.                                                                                         |
| audit-viewer + audit-page | `DataTable virtualized`                            | Removes `// virtualization deferred` inline comment at audit-viewer-page.tsx:12.                                                     |
| notification-drawer       | `VirtualList onEndReached`                         | Replaces explicit "Load More" button with infinite scroll. Removes one i18n key (`notifications.loadMore`).                          |
| agent-states-page         | `DataTable virtualized`                            | Realtime subscriptions still per-row; virtualization reduces DOM cost during ticks.                                                  |
| monitor (voice tab)       | `VirtualList`                                      | Live session cards, refetch every 10s.                                                                                               |

## Testing strategy

### Unit tests (Vitest)

**`virtual-list.test.tsx` (new):**

- Renders ≤ `overscan * 2 + viewport-fit` DOM rows when given 10,000 items.
- Calls `estimateSize` for each visible item.
- Stable `getItemKey` produces no re-mount on scroll.
- `stickToBottom` auto-scrolls when user is within 50px of bottom; does NOT auto-scroll when user has scrolled up.
- `onEndReached` fires when last item enters overscan window.
- `onStartReached` fires when first item enters overscan window.
- Scroll position preserved across prepend (mock `scrollTop` capture/restore).

**`data-table.test.tsx` (additions):**

- `virtualized={true}` renders ≤ N rows DOM with dataset of 5,000.
- Sort still works in virtualized mode.
- Expandable rows measure correctly (dynamic height).
- `virtualized={false}` (default) renders exactly the page-paginated rows (no behavior change).

### E2E (Playwright)

**`tests/e2e/virtualization.spec.ts` (new):**

- **MessageThread**: load conversation with 1,000 mocked messages. Scroll to bottom programmatically. Measure `requestAnimationFrame` deltas during scroll — assert p95 frame time < 16.67 ms.
- **MessageThread auto-scroll**: send new message → asserts auto-scrolled to bottom when at bottom; send new message after scrolling up 500px → asserts NOT auto-scrolled.
- **MessageThread prepend**: trigger `onStartReached`, prepend 100 messages → assert visible message stays in viewport.
- **Audit viewer**: load 1,000 audit events, scroll smoothly to bottom, assert frame time p95 < 16.67 ms.

### Manual perf check (documented in patch description)

Chrome DevTools Performance recording on:

1. MessageThread with 1,000 messages — scroll top→bottom
2. audit-viewer with 1,000 events — scroll top→bottom

Required: p95 main-thread frame time < 16.67 ms; no long tasks > 50 ms during scroll.

## Risks

### R1 — Chat auto-scroll trap (HIGH)

Virtualization in chat is the canonical hard problem: variable item heights + sticky-to-bottom + scroll-position preservation on prepend interact non-trivially. Dynamic measurement via `virtualizer.measureElement` plus the explicit `stickToBottom` + `onStartReached` props handle the cases, but require thorough E2E coverage. The dedicated Playwright spec above is the mitigation.

### R2 — DataTable expandable rows + virtualization (MEDIUM)

Variable heights from expandable rows are handled by `virtualizer.measureElement`, but row layout switches from `<tr>/<td>` to absolutely-positioned `display: grid` rows. Need to validate:

- Cell alignment with sticky header still pixel-perfect across columns.
- Existing tests that locate rows via `<tr>` selectors may need DOM updates — audit before patch 5B.1.

### R3 — i18n parity (LOW)

`<VirtualList>` and DataTable virtualized mode introduce no new user-facing strings. notification-drawer's removal of the "Load More" button removes one string — must drop the corresponding key from `public/locales/{en-US,es-419,pt-BR}/notifications.json`. CI parity check (`npm run i18n:check`) catches regressions.

## Acceptance summary

Track 5B closes when:

- [ ] `<VirtualList>` and `<DataTable virtualized>` shipped with unit tests (5B.1).
- [ ] All TIER 1 + TIER 2 components migrated and verified (5B.2).
- [ ] Playwright virtualization spec passes consistently in CI (≥ 3 consecutive runs).
- [ ] Manual Chrome perf recording shows p95 frame time < 16.67 ms on MessageThread (1,000 msgs) and audit-viewer (1,000 rows).
- [ ] No regression in existing Vitest baseline (current: 879/879). Track 5B.1 adds new tests for the primitives — final count grows.
- [ ] Existing E2E specs continue passing.
- [ ] `MEMORY.md` and `CLAUDE.md` updated to reflect Track 5B completion.
- [ ] `v1.18.1-web` tag and GitHub release notes summarize the track.

## References

- Roadmap: [`docs/plans/active/2026-05-03-v1.14.x-operational-foundation-roadmap.md`](2026-05-03-v1.14.x-operational-foundation-roadmap.md)
- Versioning: [`docs/decisions/0005-versioning-track-end-tags.md`](../../decisions/0005-versioning-track-end-tags.md)
- i18n CI gate: [`docs/decisions/0001-i18n-parity-ci-gate.md`](../../decisions/0001-i18n-parity-ci-gate.md)
- Predecessor track: Track 5A Loading States (commit `48b92d4`)
- Library: [@tanstack/react-virtual](https://tanstack.com/virtual)
