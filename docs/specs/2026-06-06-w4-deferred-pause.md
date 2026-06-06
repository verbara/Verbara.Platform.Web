# Session/Auth Overhaul — W4 Technical Design (deferred pause / "pause-when-free")

**Date:** 2026-06-06
**Status:** Shipped
**ADR:** [0009 — Agent Presence, Session & Work-Continuity](../decisions/0009-agent-presence-session-work-continuity.md) (W4 section)
**Plan:** [`docs/plans/active/w4-deferred-pause.md`](../plans/active/w4-deferred-pause.md)
**Repos:** `Verbara.Platform` (PendingState model + endpoints + drain worker + eligibility/voice block) + `Verbara.Platform.Web` (pending UX + hooks)

## Goal

Make an aux pause ("Break", "Lunch", "Training", "DND") requested while an agent is handling work behave the way an agent expects: **block new work immediately** but only **flip the visible state once the active work drains to zero**. Requesting a pause today either is impossible (`Busy→Break` is an invalid transition — the agent is on a call) or applies instantly and shows "Break" while two chats are still open — a state that _lies_. Rescuing the leftover/stuck work is out of scope (that is W5); W4 only blocks new work, defers the state flip, and — on timeout — force-applies + raises a supervisor alert that marks the stuck work for W5.

> The user reported it explicitly: _"asking for a pause is initially so that no more messages or calls arrive, and the pause should not become effective until they have actually completely finished whatever they have pending."_

## Problem (today → target)

**Today (broken):**

- A pause request is **immediate** and only blocks **new** routing; it does not wait for in-flight work to drain, and nothing watches the load to auto-transition. There is no "pause-when-free" concept.
- Worse, for voice the transition is often **invalid**: `Busy` is set automatically by the system on call answer (`Busy→ACW` on hang-up), so `Busy→Break` fails the state-machine table outright — the agent literally cannot request a break mid-call.
- A naïve "load == 0" trigger is also wrong: on hang-up the agent moves to **ACW** (wrap-up — which _is_ work) with capacity load already 0, and `ACW→Lunch/Training/DND` is an invalid transition. The real apply condition is **"pending ∧ no ACTIVE work"**, not "load == 0".
- A **parked** chat (`WaitingForCustomer` / `Snoozed`) keeps its capacity reserved, so a capacity-based trigger would hold the agent hostage to a customer who may never reply.

**Target:** requesting a deferrable state while holding active work records a **pending** state (the visible `State` does not change), blocks new offers instantly (digital eligibility exclusion + voice `QueuePause`), shows a "pending" indicator, and a leader-gated background sweep applies the real transition the moment active work reaches zero — with force-now / cancel affordances and a per-tenant max-pending timeout that force-applies and alerts a supervisor.

## Why this shape (deep-analysis findings)

Three rounds of exploration + feasibility verification refined the design:

- **State is not the signal.** `Busy` is automatic (the system sets it on voice answer; `Busy→ACW` on hang-up). Digital leaves the agent `Available` with load carried via `IAgentCapacityService`. So "work in progress" = (voice: an `Active` conversation) ∪ (digital: active conversations) — it must be derived from conversations the agent **owns**, not from the agent's `State`.
- **"load == 0" is insufficient.** ACW after a call has load 0 but is still work; and parked chats keep capacity reserved. The drain condition must count **active work** `{Active, OnHold, Consulting, WrapUp}` and explicitly **exclude** parked `{WaitingForCustomer, Snoozed}` and pre-accept `{Queued, Offered}` — which stay assigned and resume on return — using a **new** active-work query, **not** `GetCurrentLoadAsync`.
- **No fin-de-trabajo signal exists.** There is no `PendingState` and `AgentCapacityChangedEvent` is defined but never published — so an event-driven trigger has nothing reliable to subscribe to. A leader-gated periodic sweep polls the compound condition uniformly and is cluster-safe.
- **`QueuePause(true)` confirms the semantics** we want for voice: it blocks **new** calls while keeping the **active** call connected.

## The 4 confirmed decisions

1. **Apply mechanism = leader-gated periodic sweep (~5 s)** — `PendingPauseDrainWorker`, mirroring the W3 `AgentLivenessReaper` (resource `pending-pause:sweep`, single-node `AlwaysLeader` stub). Chosen over event-driven and inline-at-release because the apply condition is **compound** (pending ∧ no active work) and the in-process event bus is **per-pod**; the sweep covers it uniformly and is cluster-safe.
2. **Drain condition = "no ACTIVE work"** — zero conversations the agent owns in `{Active, OnHold, Consulting, WrapUp}`. Parked `{WaitingForCustomer, Snoozed}` and pre-accept `{Queued, Offered}` do **not** block (they stay assigned and resume on return). Uses a new `IConversationStore.CountActiveWorkAsync` — **not** capacity load, because parked chats keep capacity reserved.
3. **Deferrable states = {Break, Lunch, Training, DND}** (manual non-routable aux), with **re-request** (change the target while pending). **Offline stays immediate** (deferred sign-off is a future extension on the _same_ machinery). ACW is automatic, not deferrable.
4. **Max-pending timeout = force-apply + supervisor alert/audit** marking the stuck work. Per-tenant `PendingPauseTimeoutMinutes` (default **30**; `0` disables). The stuck-work **reassignment** is W5 (out of scope) — W4 just force-applies and raises the audit `agent.pending_pause.forced_timeout`.

## State model — `PendingState`

Requesting a pause does **not** change `Agent.State`; it records the target:

- `Agent.PendingState` (`AgentState?`), `Agent.PendingReason` (`string?`), `Agent.PendingSince` (`DateTimeOffset?`), and a `HasPendingPause` convenience.
- `Agent.ApplyPendingState()` — a **bounded bypass** modeled on W1's `ForceOffline()`: it force-sets `State` to the pending target and clears the pending fields, **without** widening the public `EnsureTransition` table. This is required because e.g. `ACW→Lunch` is an invalid table transition, yet it is exactly the apply we must perform once wrap-up finishes.
- Migration `030_DeferredPause.sql` adds the `pending_*` columns to `agents` and `pending_pause_timeout_minutes` to `tenant_auth_config`. Postgres threading mirrors the nullable `auto_answer` pattern (SELECTs incl. streams, INSERT/VALUES/ON CONFLICT, binders, Row/Map/ToAgent) + InMemory.
- `IAgentStore.StreamPendingPauseAgentsAsync` (cross-tenant, unpaged) mirrors W3's `StreamRoutableAgentsAsync` and feeds the drain worker.

## Immediate block of new work (on SET pending)

The visible `State` stays routable while pending, so both routing paths must be blocked explicitly:

- **Digital — eligibility exclusion.** `InMemoryAgentPresenceService.GetAvailableAgentsAsync` gains `&& !HasPendingPause` in its predicate; this propagates to `MembershipAwareRoutingEligibilityService` (routing eligibility) and to the round-robin **sticky bypass**, so a pending agent is skipped for new digital assignments.
- **Voice — immediate `QueuePause(true)`.** A new `AgentPendingStateChangedEvent(tenant, agent, name, pendingState | null)` is published; `RealtimeStateBridge` consumes it (refactored to a shared `ApplyPauseAsync`) → AMI `QueuePause(true)` on SET (blocks new calls, keeps the active call), unpause on CLEAR (when `State` is routable).
- **Cross-pod.** Because the event must reach the pod that holds the Asterisk AMI connection, `AgentPendingStateChangedEvent` is registered in `PlatformPushJsonContext` (source-gen) and dispatched via `RemoteEventDispatcher` (a new `case "agent.pending_state_changed"`), exactly like `AgentStateChangedEvent`.

## Active-work query (the drain condition)

- `IConversationStore.CountActiveWorkAsync(tenant, agentId, ct)` counts conversations with `owner_kind = Agent` in the canonical set `ConversationStateMachine.ActiveWorkStates = {Active, OnHold, Consulting, WrapUp}` (`COUNT(*)` → `ExecuteScalarAsync<long?>(...) ?? 0L`) — Postgres + InMemory. This single query covers **voice** (calls are Conversations) and **digital** uniformly.
- It deliberately **excludes** parked `{WaitingForCustomer, Snoozed}` and pre-accept `{Queued, Offered}`, and is **not** `GetCurrentLoadAsync` (parked chats keep capacity reserved — counting load would never reach 0).

## Apply mechanism — leader-gated drain sweep

`PendingPauseDrainWorker : BackgroundService`, leader-gated on resource `pending-pause:sweep` (`PendingPauseLeaderResources.Sweep`), modeled on `AgentLivenessReaper` (public `SweepOnceAsync`, `PeriodicTimer` at **~5 s** with injected `_clock`, OCE-shutdown swallow, fatal rethrow, distinct `[LoggerMessage]` EventIds, `[FromKeyedServices(...)] IClusterLeader` + single-node `AlwaysLeader` stub).

Each tick, if leader: cache the per-tenant timeout once, then `await foreach` over `StreamPendingPauseAgentsAsync` and, for each agent, **re-load (`GetByIdAsync`) and re-check pending** (anti-stale / idempotent), then:

- **`CountActiveWorkAsync == 0`** → **apply**: `ApplyPendingState()` → `SaveAsync` → publish (see flicker contract) → done.
- **work remains AND `now - PendingSince ≥ timeout`** → **force-apply** the target anyway + `RaiseTimeoutAlertAsync` → audit `agent.pending_pause.forced_timeout` (`severity:"warning"`, `actorType:"system"`) with metadata marking the stuck work (handed to W5).
- **otherwise** → leave pending.

`timeout <= 0` disables the timeout branch for that tenant (the drain still applies on natural drain).

## Endpoints + contracts

`AgentEndpoints.cs` (group `/agents`, `RequireAuthorization("Authenticated").RequireOperationalTenant()`):

- **`PUT /api/v1/agents/me/state` — pending-aware.** Behavior table:
  - target is **deferrable** ({Break, Lunch, Training, DND}) **AND** active work > 0 → record **pending** (set `PendingState/PendingReason/PendingSince`, **do not** change `State`) + block new work (eligibility + voice `QueuePause`).
  - deferrable **AND no active work** → **apply immediately** (`ApplyPendingState` semantics, ordinary transition).
  - **re-request** (already pending, new deferrable target) → **update** the pending target (re-publish the pending event with the new target).
  - **routable or Offline while pending** → **cancel** the pending (unpause) and apply the requested routable/Offline transition.
- **`POST /api/v1/agents/me/pause/cancel`** — clears pending, unpauses (stays routable). Idempotent (`200` no-op when not pending).
- **`POST /api/v1/agents/me/pause/force`** — `ApplyPendingState()` now (active work continues). Idempotent (`200` no-op when not pending).
- **DTO** `AgentMeResponseDto` gains `pendingState` / `pendingReason` / `pendingSince` / `activeWorkCount` (registered in `ApiJsonContext`; `GetCurrentAgent` passes `activeWorkCount` from `CountActiveWorkAsync`).

## Flicker contract (event publishing)

The exact event set per action — a review caught and fixed a flicker case — is:

- **SET pending** → `AgentPendingStateChangedEvent(target)` → `QueuePause(true)` (block new voice work; keep the active call). No `AgentStateChangedEvent` (the visible state has not changed).
- **CANCEL pending** → `AgentPendingStateChangedEvent(null)` → unpause (the agent is routable again).
- **APPLY** (natural drain / force / timeout) → `AgentStateChangedEvent(old → target)` **only**, **not** the pending event. The now-non-routable target keeps the pause via the normal state path, so re-publishing `pending(null)` would unpause-then-repause and flicker.
- **Review fix:** **cancel-and-apply to a NON-routable target** (e.g. requesting `Offline` while pending) must **also** skip the `pending(null)` event — otherwise it unpauses and immediately re-pauses for the non-routable destination, flickering the queue membership.

## Ordering invariant

When **setting** pending, `SaveAsync` (persist `PendingState` so `HasPendingPause` flips for the eligibility filter) **before** publishing the event. Otherwise there is a window where `QueuePause` has fired but the digital eligibility filter still routes new work to the agent — exactly the bug W4 exists to prevent.

## Per-tenant configuration

`TenantAuthConfig.PendingPauseTimeoutMinutes` (`int`, default **30**) carried end-to-end (record + XML doc; Postgres threading; column in migration `030`), same pattern as `SessionIdleTimeoutMinutes` / `AgentLivenessTimeoutSeconds`. `0` disables the timeout force-apply for that tenant. (An admin editor for this value is deferred — see below.)

## Client module (`Verbara.Platform.Web`)

- **Hooks** (`src/core/api/hooks/use-agents.ts`): `Agent` type gains `pendingState / pendingReason / pendingSince / activeWorkCount`; new `useCancelPendingPause` (`POST /me/pause/cancel`) and `useForcePendingPause` (`POST /me/pause/force`), modeled on `useUpdateAgentState`, both invalidating `['agent-me']`.
- **`agent-status-selector.tsx`:** shows "{state} (pending)" + a "finish N active items" hint + **Apply now** (force) and **Cancel** (cancel) buttons, shown only while pending. Requesting a deferrable state still calls `updateState.mutate` as before — the backend decides whether it defers or applies. A contextual toast distinguishes "pause pending" from "state updated".
- **Casing fix (long-standing bug):** the PascalCase `state` / `pendingState` from `/agents/me` is normalized with `.toLowerCase()` (and `Break → on_break`) before comparison — fixing a latent bug where the selector compared a PascalCase value against lowercase constants.
- **SSE:** `agent.state_changed` (`use-sse.ts`) now invalidates `['agent-me']`, so the **applied** transition is reflected when the drain worker flips the state (the set-pending result is reflected from the response/invalidation). A dedicated `agent.pending_state_changed` browser push (instant cross-tab pending indicator) is deferred.
- **i18n:** new `agent_status.*` keys (`pending_label`, `finish_active_items`, `apply_now`, `cancel_pending`) in all 3 locales (EN-US, ES-419, PT-BR) — parity gate green.

## Rejected alternatives (with rationale)

- **Event-driven apply** — subscribe to `AgentCapacityChangedEvent` / `ConversationStateChangedEvent` / `CallEndedEvent` and apply inline. Rejected: the in-process bus is **per-pod**, the apply condition is **compound** (pending ∧ no active work), and `AgentCapacityChangedEvent` is never published today — far more wiring and idempotency surface than a single sweep that polls the compound condition uniformly and is cluster-safe.
- **Inline-at-release** — apply the transition at the point work is released. Rejected: it couples the deferred-pause logic to the **hot capacity-release path** and still has to handle the compound condition and cross-pod voice pause.

## Deferred (recorded in ADR-0009 as W4.x)

- **Offline deferred sign-off** — "log me off when my work drains", on the same PendingState machinery. Offline stays immediate for now.
- **A dedicated `agent.pending_state_changed` browser push** — for an instant cross-tab pending indicator; today the indicator reflects from the response + `['agent-me']` invalidation.
- **Admin UI to edit `PendingPauseTimeoutMinutes`** — the per-tenant value ships server-side; the admin editor is deferred (align with the `AgentLivenessTimeoutSeconds` admin surface when built).

## Testing

- **Backend (xUnit, `Method_ShouldExpected_WhenCondition`):** `ApplyPendingState` (set / no-op-when-none / from-ACW); pending round-trip + `StreamPendingPauseAgentsAsync` (only-pending); `PendingPauseTimeoutMinutes` (default-30 / round-trip); `CountActiveWorkAsync` (counts engaged, excludes parked / pre-accept / closed, counts voice); eligibility exclusion (`!HasPendingPause`); `AgentPendingStateChangedEvent` → `QueuePause` true-on-set / false-on-clear + `AgentStateChanged` regression; endpoints (`PUT /me/state` set-pending-with-work / apply-without-work / re-request / cancel-and-apply-on-routable / publishes-pending-event; `pause/cancel` pending + no-op; `pause/force` pending + no-op; DTO carries pending + count); drain worker (no-op-not-leader / apply-without-work / no-apply-with-work-under-timeout / force+audit-past-timeout / idempotent-twice / publishes-state+pending-cleared / skip-when-timeout-zero). Gates: `dotnet build -warnaserror` **0 warnings**; **Queues 58, Storage.InMemory 152, Api.Tests 1235**.
- **Client (Vitest):** status selector shows pending-label / shows finish-hint / force + cancel clicks / casing regression (PascalCase `state`/`pendingState` normalized). Gate: `npm run build` (tsc -b) + `npm run lint` (eslint + i18n:check) + `npm run test` → **vitest 1264**, build clean, lint 0, i18n parity OK.
- **Manual E2E (key):** (1) voice on a call requests Break → pending, new calls blocked, current call continues; on hang-up + wrap-up → Break applies within ≤ ~5 s. (2) digital with 2 active chats requests Lunch → pending "finish 2 items"; close both → Lunch applies. (3) a parked chat does **not** block → applies immediately. (4) force-now applies despite active work. (5) cancel returns to routable + unpause. (6) low timeout + active work → force-apply + audit `agent.pending_pause.forced_timeout` + supervisor alert.

## Delivery

- **Platform (`w4-deferred-pause`):** `f0247cb` (A1 — model + migration `030` + store threading + `StreamPendingPauseAgentsAsync`), `7332d8a` (A2 tenant timeout + A3 active-work query), `047a5b6` (A4 — eligibility exclusion + `AgentPendingStateChangedEvent` + cross-pod registration + `RealtimeStateBridge` pause), `46feaea` (A5 — endpoints + DTO), `48060a7` (A5 flicker fix), `a00f1b27` (A6 — drain worker + leader gating + timeout force/alert). Gates: `dotnet build -warnaserror` 0 warnings; Queues 58, Storage.InMemory 152, Api.Tests 1235.
- **Web (`w4-deferred-pause-web`):** `008c969` (Phase B — pending UX in the status selector + casing fix + hooks), `ab755af` (contextual toast: "pause pending" vs "state updated"). Gates: `npm run build` clean, lint 0, i18n parity OK, vitest 1264.

## Out of scope (recorded in ADR-0009 as W5–W6)

In-flight work failover (W5 — including the reassignment of the stuck work this design marks on timeout), capacity configurability (W6).
