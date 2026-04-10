# v1.5.0 Web Sync — Design Spec

## Goal

Close the 5 highest-impact frontend-backend gaps identified by the deep gap analysis, making the agent workspace and admin surface demo-ready for Partners.

## Context

Platform v1.5.0 added ~20 new API endpoints (cases, canned responses, supervisor digital, bot analytics, hold/unhold, outbound conversations). Platform.Web has ~50% API coverage (38 hooks / ~200+ backend routes). These 5 deliverables target Tier-1 gaps — features agents and supervisors use every minute of the day.

## Architecture

All work is in the **Platform.Web** React 19 repo. No backend changes needed — all endpoints already exist in Platform v1.5.0. Each deliverable adds a hook file (TanStack Query) + page/component changes following existing patterns (DataTable, PageHeader, Sheets, PermissionGuard, i18n, customFetch).

**Stack:** React 19, TypeScript 5.9, TanStack Query 5.95, React Router 7.13, Zustand 5.0, TailwindCSS v4, shadcn/ui, Lucide icons.

---

## Deliverable 1: Canned Responses — Hook + Admin Page + Dynamic Agent Component

### Backend API (already exists)

| Method | Route | Auth | Body/Params | Response |
|--------|-------|------|-------------|----------|
| GET | `/api/v1/admin/canned-responses` | AdminOnly | — | `CannedResponseDto[]` |
| POST | `/api/v1/admin/canned-responses` | AdminOnly | `CreateCannedResponseRequest` | `CannedResponseDto` (201) |
| PUT | `/api/v1/admin/canned-responses/{id}` | AdminOnly | `UpdateCannedResponseRequest` | `CannedResponseDto` |
| DELETE | `/api/v1/admin/canned-responses/{id}` | AdminOnly | — | 204 |
| GET | `/api/v1/canned-responses?q={search}` | Authenticated | `?q=` | `CannedResponseDto[]` |

### TypeScript Interfaces

```typescript
interface CannedResponse {
  responseId: string;
  shortcut: string;
  title: string;
  body: string;
  category: string | null;
  tags: string[];
  createdBy: string;
  createdAt: string;
}

interface CreateCannedResponseRequest {
  shortcut: string;
  title: string;
  body: string;
  category?: string;
  tags?: string[];
}

interface UpdateCannedResponseRequest {
  shortcut?: string;
  title?: string;
  body?: string;
  category?: string;
  tags?: string[];
}
```

### Files

1. **`src/core/api/hooks/use-canned-responses.ts`** — NEW
   - `useCannedResponses()` — query all (admin)
   - `useSearchCannedResponses(query)` — agent search, debounced
   - `useCreateCannedResponse()` — mutation
   - `useUpdateCannedResponse()` — mutation
   - `useDeleteCannedResponse()` — mutation

2. **`src/admin/canned-responses/canned-responses-page.tsx`** — NEW
   - DataTable with columns: Shortcut, Title, Body (truncated), Category, Tags (badges), Actions
   - Create/Edit Sheet with form (shortcut, title, body textarea, category, tags input)
   - ConfirmDeleteDialog (3s delay)
   - EmptyState when no responses
   - Permission: `contacts:canned_response:manage` (or similar admin perm)

3. **`src/agent/conversation/canned-responses.tsx`** — MODIFY
   - Replace hardcoded `CANNED_RESPONSES` array with `useSearchCannedResponses(query)`
   - Keep Command palette UI, template variable resolution
   - Add loading state while fetching
   - Empty state when no matches

4. **`src/admin/sidebar.tsx`** — MODIFY
   - Add "Canned Responses" entry in communication group: `{ key: 'canned-responses', to: '/admin/canned-responses', icon: MessageSquareText }`

5. **`src/router.tsx`** — MODIFY
   - Add route: `{ path: 'canned-responses', element: <LazyLoad><CannedResponsesPage /></LazyLoad> }`

---

## Deliverable 2: Hold/Unhold + Outbound Conversations

### Backend API (already exists)

| Method | Route | Auth | Body | Response |
|--------|-------|------|------|----------|
| POST | `/api/v1/conversations/{id}/hold` | Authenticated | — | `OwnershipResult` |
| POST | `/api/v1/conversations/{id}/unhold` | Authenticated | — | `OwnershipResult` |
| POST | `/api/v1/conversations` | Authenticated | `CreateConversationRequest` | `Conversation` (201) |

```typescript
interface CreateConversationRequest {
  contactId: string;
  channel: string; // ChannelType enum name
  initialMessage?: string;
}
```

### Files

1. **`src/core/api/hooks/use-conversations.ts`** — MODIFY
   - Add `useHoldConversation()` — mutation POST `/{id}/hold`
   - Add `useUnholdConversation()` — mutation POST `/{id}/unhold`
   - Add `useCreateConversation()` — mutation POST `/conversations`

2. **`src/agent/conversation/conversation-panel.tsx`** — MODIFY
   - Add Hold button (Pause icon) when state is `active` → calls `useHoldConversation()`
   - Add Unhold/Resume button (Play icon) when state is `on_hold` → calls `useUnholdConversation()`
   - Place alongside existing action buttons (close, transfer)

3. **`src/agent/inbox/new-conversation-dialog.tsx`** — NEW
   - Dialog triggered by "+" button in inbox header
   - Contact selector (search contacts by name/phone, uses `useSearchContacts()`)
   - Channel selector dropdown (WhatsApp, SMS, WebChat, Email, etc.)
   - Optional initial message textarea
   - Submit → `useCreateConversation()` → navigate to new conversation

4. **`src/agent/inbox/inbox-panel.tsx`** — MODIFY
   - Add "+" button (Plus icon) next to inbox title/filters
   - Opens `NewConversationDialog`

---

## Deliverable 3: Supervisor Digital Conversation Tab

### Backend API (already exists)

| Method | Route | Auth | Params/Body | Response |
|--------|-------|------|-------------|----------|
| GET | `/api/v1/supervisor/conversations` | SupervisorPlus | `?queue=&agent=&channel=&state=&page=&pageSize=` | `PagedResult<Conversation>` |
| GET | `/api/v1/supervisor/conversations/{id}/messages` | SupervisorPlus | `?limit=50&offset=0` | `Message[]` |
| POST | `/api/v1/supervisor/conversations/{id}/takeover` | SupervisorPlus | — | `OwnershipResult` |
| POST | `/api/v1/supervisor/conversations/{id}/close` | SupervisorPlus | `{ reason?: string }` | `MessageResponse` |
| POST | `/api/v1/supervisor/conversations/{id}/note` | SupervisorPlus | `{ text: string }` | `MessageResponse` |

### Files

1. **`src/core/api/hooks/use-supervisor.ts`** — MODIFY
   - Add `useSupervisorConversations(filters)` — query with polling (10s)
   - Add `useSupervisorMessages(conversationId)` — query
   - Add `useTakeoverConversation()` — mutation
   - Add `useCloseDigitalConversation()` — mutation (with reason)
   - Add `useSendCoachingNote()` — mutation

2. **`src/operations/monitor/monitor-page.tsx`** — MODIFY
   - Add tab navigation: "Voice" | "Digital" (default: Voice for backward compat)
   - Voice tab: existing session monitoring (unchanged)
   - Digital tab: renders `DigitalMonitorTab`

3. **`src/operations/monitor/digital-monitor-tab.tsx`** — NEW
   - Two-panel layout matching voice tab: conversation list (left) + detail (right)
   - Left panel: conversation cards with channel icon, contact name, agent name, state badge, duration
   - Filters: channel dropdown, state dropdown, queue dropdown
   - Right panel: `DigitalConversationDetail` component

4. **`src/operations/monitor/digital-conversation-detail.tsx`** — NEW
   - Message thread (read-only, similar to agent's MessageThread but no reply composer)
   - Action buttons: Takeover (UserCheck icon), Close (X icon), Send Coaching Note (MessageCircle icon)
   - Coaching note: inline textarea that sends note via API
   - Close: ConfirmDialog with optional reason text
   - Takeover: ConfirmDialog ("This will reassign the conversation to you")

---

## Deliverable 4: Cases Admin Page

### Backend API (already exists)

| Method | Route | Auth | Body/Params | Response |
|--------|-------|------|-------------|----------|
| GET | `/api/v1/cases` | Authenticated | `?status=&priority=&page=&pageSize=` | `PagedResult<Case>` |
| GET | `/api/v1/cases/{id}` | Authenticated | — | `Case` |
| POST | `/api/v1/cases` | Authenticated | `CreateCaseRequest` | `Case` (201) |
| PUT | `/api/v1/cases/{id}` | Authenticated | `UpdateCaseRequest` | `Case` |
| POST | `/api/v1/cases/{id}/conversations/{conversationId}` | Authenticated | — | `Case` |

### TypeScript Interfaces

```typescript
interface Case {
  caseId: string;
  caseNumber: string;
  subject: string;
  priority: 'Low' | 'Normal' | 'High' | 'Urgent';
  status: 'Open' | 'Pending' | 'Resolved' | 'Closed';
  contactId: string;
  assignedAgentId: string | null;
  conversationIds: string[];
  createdAt: string;
  updatedAt: string | null;
}

interface CreateCaseRequest {
  subject: string;
  priority: string;
  contactId: string;
  assignedAgentId?: string;
}

interface UpdateCaseRequest {
  subject?: string;
  status?: string;
  priority?: string;
  assignedAgentId?: string;
}
```

### Files

1. **`src/core/api/hooks/use-cases.ts`** — NEW
   - `useCases(filters)` — query with status/priority params
   - `useCase(id)` — single case query
   - `useCreateCase()` — mutation
   - `useUpdateCase()` — mutation
   - `useLinkConversation()` — mutation POST `/{id}/conversations/{convId}`

2. **`src/admin/cases/cases-page.tsx`** — NEW
   - DataTable columns: Case Number, Subject, Priority (color badge), Status (badge), Contact, Agent, Created, Actions
   - Priority badges: Low=slate, Normal=blue, High=amber, Urgent=red
   - Status badges: Open=green, Pending=amber, Resolved=blue, Closed=slate
   - Filter bar: status dropdown, priority dropdown
   - Create Sheet: subject, priority select, contact search selector, agent selector (optional)
   - Edit Sheet: subject, status select, priority select, agent selector
   - Detail view (click row): shows linked conversations list with "Link Conversation" button
   - ConfirmDeleteDialog not needed (no delete endpoint)

3. **`src/admin/sidebar.tsx`** — MODIFY
   - Add "Cases" entry: `{ key: 'cases', to: '/admin/cases', icon: Briefcase }` in communication group

4. **`src/router.tsx`** — MODIFY
   - Add route: `{ path: 'cases', element: <LazyLoad><CasesPage /></LazyLoad> }`

---

## Deliverable 5: Bot Analytics Card

### Backend API (already exists)

| Method | Route | Auth | Params | Response |
|--------|-------|------|--------|----------|
| GET | `/api/v1/analytics/bot` | SupervisorPlus | `?from=&to=` (ISO 8601) | `BotAnalyticsSummary` |

```typescript
interface BotAnalyticsSummary {
  totalConversations: number;
  handedOff: number;
  resolved: number;
  failed: number;
  handoffRate: number;    // 0.0 - 1.0
  resolutionRate: number; // 0.0 - 1.0
  avgTurns: number;
  failureRate: number;    // 0.0 - 1.0
}
```

### Files

1. **`src/core/api/hooks/use-analytics.ts`** — MODIFY
   - Add `useBotAnalytics(from, to)` — query GET `/analytics/bot`

2. **`src/analytics/dashboard/bot-analytics-card.tsx`** — NEW
   - Card component with title "Bot Performance"
   - 4 KPI mini-cards: Total Conversations, Resolution Rate (%), Handoff Rate (%), Avg Turns
   - Color coding: Resolution Rate green if >60%, Handoff Rate amber if >40%, Failure Rate red if >10%
   - Small donut/pie showing resolved vs handoff vs failed
   - Uses same date range from dashboard filters

3. **`src/analytics/dashboard/dashboard-page.tsx`** — MODIFY
   - Add `BotAnalyticsCard` below existing KPI grid
   - Pass `from`/`to` filter dates
   - Only render if data is available (graceful hide if no bot data)

---

## Cross-cutting

### i18n Keys

New translation keys needed across all deliverables. Follow existing `admin:` and `agent:` namespace pattern. Keys will be added to the English locale file.

### Permissions

| Feature | Permission | Notes |
|---------|-----------|-------|
| Canned Responses Admin | AdminOnly | Same as backend |
| Canned Responses Search | Authenticated | Agent-level |
| Hold/Unhold | Authenticated | Agent-level |
| Create Conversation | Authenticated | Agent-level |
| Supervisor Digital | `contacts:conversation:monitor` | SupervisorPlus |
| Cases CRUD | Authenticated | Agent-level (backend validates) |
| Bot Analytics | `analytics:cdr:view` | Same as dashboard |

### Testing

Each deliverable should have E2E tests added in a follow-up sprint (E2E Sprint 4). This spec focuses on the functional UI implementation.

---

## File Summary

| Type | Files |
|------|-------|
| New hooks | 2 (`use-canned-responses.ts`, `use-cases.ts`) |
| Modified hooks | 3 (`use-conversations.ts`, `use-supervisor.ts`, `use-analytics.ts`) |
| New pages | 2 (`canned-responses-page.tsx`, `cases-page.tsx`) |
| New components | 4 (`new-conversation-dialog.tsx`, `digital-monitor-tab.tsx`, `digital-conversation-detail.tsx`, `bot-analytics-card.tsx`) |
| Modified components | 4 (`canned-responses.tsx`, `conversation-panel.tsx`, `inbox-panel.tsx`, `monitor-page.tsx`, `dashboard-page.tsx`) |
| Modified routing | 2 (`sidebar.tsx`, `router.tsx`) |
| **Total** | **~17 files (8 new, 9 modified)** |
