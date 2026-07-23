## 1. Phase A — Migrate Operations REST hooks (swap-the-T, per file)

Each task: replace the file's hand-written REST request/response interface(s) with the generated
`components['schemas']['<SchemaName>']` type (aliased locally), grep the repo for every usage of
each removed interface name and update imports, then delete the hand-written declaration. `tsc -b`
must stay green after each. Counts in parens = hand-written REST declarations in the file today (14
total across these 3 files).

> **Outcome (2026-07-23): partial migration — the Admin-child bound the GATE predicted.** The
> committed `openapi.d.ts` (refreshed by `openapi-response-adoption`, 2026-07-19, which un-gated
> this child) carries named schemas for _most_ of these paths, but for the Operations surface the
> emitted response DTOs are mostly the WRONG SHAPE (raw entities, not the supervisor view-models) or
> ABSENT (`content?: never` on the cluster list/mutation endpoints). Only the shapes with a true
> structural match were swapped; the rest stay hand-written with a per-declaration `@`-comment naming
> the exact blocker. **2 of 14 declarations migrated onto generated types** (both via the `use-teams`
> coercion-wrapper precedent for the AOT `number | string` wire union).

- [x] 1.1 `use-cluster.ts` (6) — **0 migrated; all 6 kept hand-written (annotated).**
      `ClusterNode` (GET `/nodes` + create/update responses are `content?: never`; also carries
      `amiHostname`/`amiPort` that `MgmtClusterNodeDto` omits, read by `node-detail-drawer.tsx`),
      `ClusterInstance` (GET `/instances` is `content?: never`; `MgmtInstanceDto` uses `ownedNodeIds`
      and drops `activeChannels`, both read by `cluster-page.tsx`), `DrainStatus` (drain/force-drain
      return `content?: never`/`StatusUpdateResponse`, not a drain shape), `ClusterStatus` (nested
      `nodes`/`instances` diverge as above), `CreateNodeInput` (`CreateNodeRequest` makes
      `weight`/`priorityTier`/`maxCapacity` REQUIRED but the add-node zod form declares them
      `.optional()`), `UpdateNodeInput` (`UpdateNodeRequest` adds a required `tags` the edit form
      never sends). See the `openapi-typed-client-operations` notes in the file.
- [x] 1.2 `use-queue-metrics.ts` (1) — **MIGRATED.** Wire response now consumes
      `components['schemas']['QueueMetricsDto'][]`; a `toQueueMetrics` boundary coercion normalizes
      the 6 AOT `number | string` fields back to the store's `QueueMetrics` domain type (arithmetic
      in `computeGlobals`/`queue-card.tsx` needs real `number`). Public `QueueMetricsResult` unchanged.
- [x] 1.3 `use-supervisor.ts` (7) — **1 migrated; 6 kept hand-written (annotated).** MIGRATED:
      `StuckConversation` → coercion-wrapper over `StuckConversationDto` (exact field match; only
      `failoverAttempts` needed `number` coercion for the `> 0` compare in `stuck-work-tab.tsx`).
      KEPT: `ActiveSession` (`ActiveSessionDto` omits `agentName`/`sentiment`, both read by
      `session-card.tsx`), `SupervisorConversation` + `SupervisorMessage` (the document's
      `PagedResultOfConversation.items`/`Message[]` are the raw `Conversation`/`Message` ENTITIES, a
      different shape from the supervisor view-models), `PagedResult<T>` (kept a local generic
      wrapper per this task's own note), `SupervisorConversationFilters` (query params, not a body),
      `ReassignTarget` (a discriminated union that is more precise than the both-nullable
      `ReassignConversationRequest`).

## 2. Phase A-out — Hub-stream payloads (explicitly NOT migrated, listed for accounting)

These 3 files remain Operations-module files but their `*Payload` interfaces are SignalR hub-event
shapes (consumed via `onHubEvent` from `@/core/realtime`), not REST — do NOT migrate them (same
class as `platform-hub.ts`; ADR-0020's deferred follow-up, owner: Pro). No action; recorded so the
module's 6 files are fully accounted for.

- [x] 2.1 `use-agent-state-stream.ts` (`AgentStateChangedPayload`) — left hand-written, untouched
- [x] 2.2 `use-cluster-state-stream.ts` (`ClusterNodeStatePayload`) — left hand-written, untouched
- [x] 2.3 `use-conversation-state-stream.ts` (`ConversationStateChangedPayload`) — left
      hand-written, untouched

## 3. Phase B — Coercion sites (report to the Admin child's tally)

- [x] 3.1 Two genuine `number | string` AOT-wire-union coercion sites were surfaced by this child and
      are reported to the shared tally tracked in `openapi-typed-client-admin`:
      **(a)** `use-queue-metrics.ts` — `toQueueMetrics` normalizes 6 fields (`waiting`,
      `avgWaitSeconds`, `slaPercent`, `agentsAvailable`, `agentsBusy`, `agentsAway`);
      **(b)** `use-supervisor.ts` — `normalizeStuckConversation` normalizes `failoverAttempts`.
      Both use a `Omit<Dto, field> & { field: number }` + `Number(...)` boundary wrapper (the
      `use-teams`/CSAT precedent), not the shared helper (still deferred to ≥3 genuine active sites).
      `ai-credits-readout.tsx`'s `as number` casts excluded (not this pattern — retro run 4).

## 4. Phase C — Validation (batch)

- [x] 4.1 `npm run build` — `tsc -b && vite build` clean (`✓ built`; the drift-catching CI gate).
- [x] 4.2 `npx vitest run` — 1456 unit tests passed (185 files); no test edits required.
- [x] 4.3 `npm run lint` — eslint clean (0 errors, 8 pre-existing warnings), `i18n:check` green,
      and `lint:generated-types` ratchet OK (floor 45 → **43**; `generated-types-adoption-baseline.json`
      trimmed of `use-queue-metrics.ts` + `use-supervisor.ts`).
- [x] 4.4 No hand-written interface remains for a migrated shape (`StuckConversation` is now a type
      alias; queue-metrics consumes `QueueMetricsDto` at the wire). The 3 hub-stream `*Payload`
      interfaces are unchanged (no `*-state-stream` file modified).
- [x] 4.5 No `npx playwright test` run — swap-the-T is compile-time-only; no user-facing flow altered.

## 5. Follow-up (cross-repo, for the archive record)

The thin migratable surface is a **Platform-side response-schema gap**, the same class as the
admin→`openapi-response-adoption` thread. To un-block the remaining Operations shapes, Platform
should emit (via `openapi-response-schemas`, Platform/ADR-0035): a supervisor `ActiveSessionDto`
carrying `agentName`/`sentiment`; a `SupervisorConversationDto` + `SupervisorMessageDto` matching the
list/message view-models (instead of the raw `Conversation`/`Message` entities); response DTOs for
the cluster `GET /nodes`, `GET /instances`, and the create/update/drain mutations; and `amiHostname`/
`amiPort` on `MgmtClusterNodeDto`. Recorded here; not actionable from this repo.
