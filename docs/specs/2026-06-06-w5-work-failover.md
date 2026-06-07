# Session/Auth Overhaul — W5 Technical Design (in-flight work failover — digital slice)

**Date:** 2026-06-06
**Status:** Shipped (digital slice; voice caller-rescue W5b deferred)
**ADR:** [0009 — Agent Presence, Session & Work-Continuity](../decisions/0009-agent-presence-session-work-continuity.md) (W5 section)
**Plan:** [`docs/plans/active/w5-work-failover.md`](../plans/active/w5-work-failover.md)
**Repos:** `Verbara.Platform` (`OfflineSince` grace + `queue_priority` + `RequeueToFrontAsync` + `WorkFailoverWorker` + supervisor endpoints) + `Verbara.Platform.Web` (stuck-work tab + hooks)

## Goal

Automatically **rescue in-flight DIGITAL work** (chat / WhatsApp / email) when its owning agent goes **Offline with active conversations** — the orphaned/stuck work that W3 forces offline (routing zombie) and W4 marks on its max-pending timeout. When the owner has been gone past a per-tenant grace window, re-queue each affected conversation to the **front** of its original queue so the distribution loop re-offers it to a live agent; if the owner returns inside the grace, do nothing (cancel-on-return). Supervisors additionally get a **stuck-work view** and a **manual reassign** action. Rescuing a live **voice caller** when the agent leg dies is a **separate future track (W5b)** and is explicitly out of scope here.

## Problem (today → target)

**Today (broken):**

- When an agent goes Offline with active digital work, `RealtimeStateBridge` only pauses Asterisk; **nothing touches the conversations**. They stay `Active` with an offline owner, are never re-routed, and the customer is abandoned. Only the pre-accept `Offered` state recovers today (the 30 s offer timeout → re-queue).
- This is exactly the **stuck work** that W4 force-applies on its max-pending timeout and marks for a downstream rescuer that did not yet exist.
- There is no concept of an owner-absent grace, no re-queue priority (a rescued conversation would land at the back of the queue behind brand-new contacts), no protection against re-queuing the same conversation forever, and no supervisor view of the orphaned work.

**Target:** a leader-gated background sweep detects offline owners, waits a per-tenant grace (cancelling automatically if the agent returns), and re-queues each `{Active, OnHold, Consulting}` conversation to the **front** (`queue_priority = -1`) of its **origin** queue — capping at 3 attempts before escalating it as `failoverStuck` with a supervisor audit. Supervisors see the stuck work and can reassign it to a queue or agent by hand.

## Why this shape (deep-analysis findings)

Deep analysis confirmed the digital / voice / supervisor split is the correct axis and surfaced four dimensions the naïve "Active→Queued on offline" framing omitted:

- **Voice is a separate problem.** Detecting that the **agent** leg of a live call died (vs the customer hanging up) does not exist today and is Asterisk-deep (PJSIP registration / `ContactStatus` + bridge-leg correlation). Digital, by contrast, reuses machinery that already exists (`TransferToQueueAsync` + `QueueDistributionWorker`). → **voice rescue is its own track (W5b), deferred.**
- **Grace + cancel-on-return is required**, not optional. A reaped/idle/force-offline agent often comes right back; re-queuing instantly would yank a conversation away from an owner about to resume. The grace window plus a clean cancel-on-return path is the difference between a rescue and a disruption.
- **Re-queue priority matters.** A rescued in-progress conversation must **not** land behind brand-new contacts; it jumps to the **front**.
- **Anti-loop protection is required.** Without an attempt cap a conversation that no agent can take (or that lacks an origin queue) would be re-queued forever. Cap at 3 → escalate.
- **Auto-rescue and supervisor visibility belong together** — the same offline-owner × failover-work query powers both the worker and the supervisor view.

## The 4 confirmed decisions

1. **Scope = W5a (auto digital failover) + W5c (supervisor stuck-work view + manual reassign).** Voice **W5b is deferred** to its own future track (the agent-leg-death detection signal does not exist — Asterisk-deep).
2. **Detection = leader-gated periodic sweep (~5 s)** — `WorkFailoverWorker` (resource `work-failover:sweep`, single-node `AlwaysLeader` stub), mirroring the W3 `AgentLivenessReaper` and W4 `PendingPauseDrainWorker`. Chosen over event-driven for the same reasons as W3/W4 (the in-process bus is per-pod; the sweep is uniform + cluster-safe).
3. **Grace + cancel-on-return.** Re-queue only after the owner has been Offline ≥ per-tenant `WorkFailoverGraceSeconds` (default **30**; `0` disables). If the agent returns to routable before grace elapses, the work is **not** re-queued — a returned agent leaves the offline stream and its `OfflineSince` clears.
4. **Re-queue priority = jump to the FRONT** (`queue_priority = -1`) + **max 3 attempts then escalate** (mark `failoverStuck` + supervisor audit, never an infinite loop).

## Grace model — `Agent.OfflineSince`

The owner-absent clock lives on the agent:

- `Agent.OfflineSince` (`DateTimeOffset?`) is set on **entering** Offline and cleared on **leaving** Offline. The verified chokepoint is the only two `→Offline` paths in production — `Agent.ForceOffline()` (W3 reaper / departure beacon / admin / W4 timeout) and `Agent.TransitionTo()` (manual). It is set with `??=` so repeated departure beacons do **not** reset the clock, and cleared when the agent transitions back to any non-Offline state.
- The mutators gain an optional `DateTimeOffset? now = null` parameter so existing call-sites compile unchanged (the worker / endpoints pass the injected clock).
- **Cancel-on-return is free:** a returned agent has `OfflineSince = null` and drops out of `StreamOfflineAgentsAsync`, so the sweep never even visits its (now resumed) conversations.
- Migration `031` adds `agents.offline_since`. **Backfill:** agents already Offline at deploy have `offline_since = NULL` → the worker skips them (no mass re-queue on the first deploy).

## Re-queue priority — `Conversation.QueuePriority`

- `Conversation.QueuePriority` (`int`, default `0`); migration `031` adds `conversations.queue_priority NOT NULL DEFAULT 0`.
- `IConversationStore.ListQueuedAsync` / `ListByStateAsync` switch to `ORDER BY queue_priority ASC, created_at ASC` (`CreatedAt` is init-only and cannot be restamped, so a separate priority column is the front-jump mechanism).
- Failover sets `queue_priority = -1` → front of the queue. `QueueDistributionWorker` drains in that order, so rescued work is offered first with **no change to the distribution worker itself**.

## Re-queue set — `FailoverWorkStates` (distinct from W4's `ActiveWorkStates`)

- `ConversationStateMachine.FailoverWorkStates = {Active, OnHold, Consulting}` — the conversations to re-queue (a live customer is connected).
- It **excludes WrapUp**: a wrap-up has no live customer to talk to, and the existing wrap-up timeout (`ConversationTimeoutWorker`) already closes orphaned wrap-ups. It also excludes parked `{WaitingForCustomer, Snoozed}` and pre-accept `{Queued, Offered}`.
- **This is deliberately different from W4's `ActiveWorkStates = {Active, OnHold, Consulting, WrapUp}`.** W4 counts wrap-up as work that must drain before a pause applies; W5 must **not** re-queue a conversation with no customer. Same conceptual family, different membership — kept as two named sets so the divergence is explicit, not accidental.

## Re-queue mechanism — `RequeueToFrontAsync`

- `IConversationSwitchboard.RequeueToFrontAsync(conversationId, tenant, targetQueueId, ct)` shares its core body with `TransferToQueueAsync` (extracted to a private helper taking a `queuePriority`):
  - **releases the offline agent's reserved capacity** (so the agent's load reflects the rescue);
  - **bridges** `OnHold` / `Consulting` back to `Active` first (a held/consulting conversation cannot transition straight to `Queued`), then `Active → Escalated → Queued`;
  - stamps `queue_priority = -1`.
- Re-queuing emits the normal `ConversationStateChangedEvent`, so existing realtime/SSE wiring reflects the move.

## Origin queue — `Metadata["originQueueId"]`

- The destination is the conversation's **original** queue, stamped as `Metadata["originQueueId"]` at **offer** time in `QueueDistributionWorker` (the only moment the owner is still the `Queue`, alongside `_offeredAt` / `_offeredTo`).
- If `originQueueId` is missing (e.g. a supervisor takeover with no distribution), the worker **escalates only** (mark `failoverStuck` + audit) rather than guessing a destination.

## Worker loop — `WorkFailoverWorker.SweepOnceAsync` (leader-gated, ~5 s)

`WorkFailoverWorker : BackgroundService`, leader-gated on resource `work-failover:sweep` (`WorkFailoverLeaderResources.Sweep`), modeled on `AgentLivenessReaper` / `PendingPauseDrainWorker` (public `SweepOnceAsync`, `PeriodicTimer` at ~5 s with injected `_clock`, OCE-shutdown swallow, fatal rethrow, distinct `[LoggerMessage]` EventIds 9130–9133, `[FromKeyedServices(...)] IClusterLeader` + single-node `AlwaysLeader` stub). Each tick, if leader:

```
now; graceCache(tenant -> seconds)
await foreach (offlineAgent in agentStore.StreamOfflineAgentsAsync(ct)):
  grace = graceCache[tenant] ??= cfg.WorkFailoverGraceSeconds ?? 30;  if (grace <= 0) continue;
  if (offlineAgent.OfflineSince is null || now - OfflineSince < grace) continue;   // grace not elapsed / returned
  await foreach (conv in convStore.ListFailoverWorkByOwnerAsync(tenant, agentId)):
    // re-load + re-check: owner still offline, still owns, state still in FailoverWorkStates (idempotent)
    attempts = conv.Metadata["failoverAttempts"] ?? 0;
    if (attempts >= 3 || conv has "failoverStuck"): continue;                       // already escalated
    originQueueId = conv.Metadata["originQueueId"];
    if (originQueueId is null): markStuck + audit "conversation.failover.escalated"; continue;
    conv.Metadata["failoverAttempts"] = attempts + 1; save;                         // PERSIST BEFORE requeue — anti-loop
    await switchboard.RequeueToFrontAsync(convId, tenant, originQueueId);           // release cap + Active→Escalated→Queued + priority -1
    audit "conversation.failover.requeued";
```

The attempt counter is **persisted before** the re-queue so a crash mid-re-queue cannot reset the count and loop. After 3 attempts (or no origin queue) the conversation is marked `failoverStuck` and skipped by future sweeps until a supervisor reassigns it (which clears the markers).

## Detection feeds (no global scan)

- `IAgentStore.StreamOfflineAgentsAsync` (cross-tenant, unpaged) mirrors W3's `StreamRoutableAgentsAsync` but filters `state = Offline`.
- `IConversationStore.ListFailoverWorkByOwnerAsync(tenant, agentId, ct)` is the `List` sibling of W4's `CountActiveWorkAsync`, scoped to `owner_kind = Agent` + `state ∈ FailoverWorkStates`.
- The sweep walks the **few offline agents → their failover-work conversations**, avoiding a global conversation scan.

## Supervisor stuck-work view + reassign

`SupervisorEndpoints.cs` (`SupervisorPlus` + `RequireOperationalTenant`):

- **`GET /api/v1/supervisor/conversations/stuck`** — offline-owner × failover-work (the same offline-agents stream × `ListFailoverWorkByOwner` queries, plus conversations already marked `failoverStuck`). DTOs registered in `ApiJsonContext`.
- **`POST /api/v1/supervisor/conversations/{id}/reassign`** — body `{targetQueueId | targetAgentId}` → `TransferToQueue` / `TransferToAgent`, and **clears the failover markers** via `Conversation.RemoveMetadata` (`failoverAttempts` + `failoverStuck`), so a reassigned-then-re-orphaned conversation gets fresh failover treatment.

`Conversation.RemoveMetadata` is the new helper that makes the marker-clearing on reassign possible.

## Client module (`Verbara.Platform.Web`)

- **Hooks** (`src/core/api/hooks/use-supervisor.ts`): `useStuckConversations()` (`GET /supervisor/conversations/stuck`) + `useReassignConversation()` (`POST .../{id}/reassign`), modeled on the existing supervisor hooks and invalidating the relevant query keys.
- **`monitor-page.tsx`:** a **third tab** — `voice | digital | stuck` — added (a lighter integration than a standalone page) → `stuck-work-tab.tsx` lists the orphaned conversations with "owned by (offline) / stuck for X" and **Reassign to queue** / **Reassign to agent** actions.
- **i18n:** new `operations.*` keys in all 3 locales (EN-US, ES-419, PT-BR), including the `consulting` state label added in the follow-up — parity gate green.

## Rejected alternatives (with rationale)

- **Event-driven detection** — react to a compound condition over a per-pod in-process event bus. Rejected: more wiring + idempotency surface than a single cluster-safe leader-gated sweep (same conclusion reached in W3 and W4).
- **A dedicated JOIN stuck-query** — one cross-store query joining agents × conversations for the supervisor view. Rejected: reused the existing offline-agents stream × `ListFailoverWorkByOwner` instead — simpler and with no new cross-store coupling.

## O1 — bug fixed in passing

`QueueDistributionWorker` re-saved its **stale `Queued` snapshot** after `OfferToAgentAsync` had already persisted the `Offered` instance — in stores that return distinct instances (Postgres) this reverted `Offered → Queued`. Fixed by re-loading the offered instance and stamping the `originQueueId` metadata **on it** (the in-memory store returned the same instance, so unit tests stayed green — this was a Postgres-only integration bug). The A6 fix also corrected a crash `EventId`.

## Voice failover (W5b) — deferred, recorded

Rescuing a live **voice caller** when the agent leg dies is intentionally **not** in W5. The blocking gap is **detection**: the platform has no signal that distinguishes an agent-leg death (power/internet loss mid-call) from a normal customer hang-up. Producing that signal is Asterisk-deep — PJSIP registration / `ContactStatus` plus bridge-leg correlation — and lies outside the digital re-queue machinery W5a reuses. W5b ships later as its own spec → plan → implementation cycle.

## Also deferred (recorded in ADR-0009 as W5.x)

- **Per-tenant `MaxAttempts`** — constant `3` for now; per-tenant configurability later.
- **A `consulting`-and-beyond friendly-label completeness pass** for the stuck-work view — only the immediately needed `consulting` label was added.

## Testing

- **Backend (xUnit, `Method_ShouldExpected_WhenCondition`):** `OfflineSince` (set-on-offline / no-reset-on-repeat / clear-on-return / round-trip); `WorkFailoverGraceSeconds` (default-30 / round-trip); `StreamOfflineAgentsAsync` (yields-only-offline / across-tenants); `ListFailoverWorkByOwnerAsync` (lists engaged, excludes WrapUp + parked + pre-accept + closed, owner+tenant-scoped); `queue_priority` front-ordering + `RequeueToFrontAsync` (releases capacity, sets priority -1, `OnHold`/`Consulting` → `Active` → `Escalated` → `Queued` bridge); `WorkFailoverWorker` (no-op-not-leader / no-requeue-under-grace / requeue-to-front-past-grace / cancel-on-return when owner routable / escalate-after-3-attempts / skip-no-originQueueId→escalate / idempotent-twice / per-tenant-grace / skip-when-grace-zero); supervisor (stuck list = offline-owner + escalated / reassign-to-queue / reassign-to-agent / clears markers / RBAC forbid / not-found). Gates: `dotnet build -warnaserror` **0 warnings**; **Queues 65, Storage.InMemory 164, Switchboard 55, Api.Tests 1255**.
- **Client (Vitest):** stuck-work tab lists conversations / reassign-to-queue + reassign-to-agent call the hook / empty-state / consulting label. Gate: `npm run build` (tsc -b) + `npm run lint` (eslint + i18n:check) + `npm run test` → **vitest 1272**, build clean, lint 0, i18n parity OK.
- **Manual E2E (key):** (1) agent with 2 active chats → Offline → after grace (~30 s) both chats re-queue to the **front** and are re-offered to another agent. (2) the agent returns inside the grace → **not** re-queued. (3) 3 failed attempts → escalate `failoverStuck` + supervisor audit. (4) an orphaned WrapUp → **not** re-queued (the wrap-up timeout closes it). (5) supervisor opens the Stuck Work tab, sees the list, reassigns to a queue/agent → markers cleared.

## Delivery

- **Platform (`w5-work-failover`):** `ca9b0a9` (A1 — `OfflineSince` + migration `031`) + `a7c3d9c` (A1 fix — InMemory presence stamp + clock); `332f45b` (A2 grace config + A3 `StreamOfflineAgentsAsync` + A4 `ListFailoverWorkByOwnerAsync`); `808f35e` (A5 — `queue_priority` + `RequeueToFrontAsync`) + `43e4cc2` (A5 fix — `OnHold`/`Consulting` bridge); `9b89230` (A6 — `WorkFailoverWorker`) + `b2afff7` (A6 fix — O1 offered-instance stamp + crash EventId); `909c0ac` (A7 — supervisor stuck + reassign). Gates: `dotnet build -warnaserror` 0 warnings; Queues 65, Storage.InMemory 164, Switchboard 55, Api.Tests 1255.
- **Web (`w5-work-failover-web`):** `bbbe352` (Phase B — stuck-work tab + `useStuckConversations`/`useReassignConversation` hooks + 3-locale i18n) + `8bfb086` (consulting state label). Gates: `npm run build` clean, lint 0, i18n parity OK, vitest 1272.

## Out of scope (recorded in ADR-0009)

Voice caller-rescue (**W5b** — its own future track; detection signal does not exist yet), per-tenant `MaxAttempts`, the consulting-and-beyond label completeness pass, and capacity configurability (**W6**).
