# ADR-0009 — Agent Presence, Session & Work-Continuity architecture

**Status:** Accepted
**Date:** 2026-06-04
**Supersedes:** none
**Context track:** Session/Auth Overhaul (cross-repo: `Verbara.Platform` API + `Verbara.Platform.Web`)

## Context

Users reported two session symptoms: (1) the session closes while they are actively working and they must re-authenticate; (2) when they step away, the session expires silently — the screen stays intact and only prompts for a password on the next action.

A deep cross-repo investigation (frontend + backend) found a single **root cause** that explains both symptoms, and surfaced a much larger set of related gaps in the agent-presence / work-continuity model that were never designed deliberately.

### Root cause (verified)

The refresh-token cookie is emitted with `Path = "/api/auth"` (`AuthEndpoints.SetRefreshCookie`, and inline in `OidcEndpoints`), but the web client calls `POST /api/v1/auth/refresh` directly. By RFC 6265 a cookie scoped to `/api/auth` is **not** sent to `/api/v1/auth/refresh`, so every refresh arrives without the cookie → `401` → forced logout at the 15-minute access-token ceiling. It is a leftover from the `/api → /api/v1` migration (a `VersionRedirectMiddleware` internally rewrote the old unversioned path, which is why the old cookie path once matched). Tests missed it because they inject the cookie directly into request headers, bypassing browser path-matching. Both reported symptoms are the **same bug**, differing only by whether the current screen has background polling (which triggers the logout at ~15 min) or not (which leaves the screen frozen until the next user action).

### What the analysis uncovered (the real scope)

The problem space is ~6 subsystems, most of which exist only by accident today:

- **Session/auth (W1):** the cookie-path bug; refresh-token rotation hard-revokes the whole token family on any reuse (a multi-tab race once the cookie is fixed); refresh-token absolute lifetime is 7 days.
- **Idle UX (W2):** there is no client-side idle timeout, no proactive refresh, and `AuthGuard` does not re-evaluate expiry on a timer — so expiry is invisible until the next request. A per-tenant config `sessionIdleTimeoutMinutes` exists but has **no consumer**.
- **Server-side liveness (W3):** the ACD trusts the persisted `agent.State ∈ {Available,Busy}` with **no** liveness check. On an ungraceful disconnect (power/internet loss, crash) nothing reverts the routing state — the agent becomes a **routing zombie** and work is offered to a dead session. SignalR `OnDisconnectedAsync` only updates a separate presence-display tracker; SSE drop only logs; Asterisk `qualify`/ContactStatus is built but unwired; `autopause` is disabled; there is no heartbeat/TTL sweep.
- **Deferred pause (W4):** changing to a non-routable state is immediate and only blocks **new** routing; it does not wait for in-flight work to drain, and nothing watches the load to auto-transition. There is no "pause-when-free" concept.
- **Work failover (W5):** when an agent vanishes, **accepted** digital work (chat/WhatsApp/email) is stranded with the absent owner (no re-queue, no Active→Queued auto-path), and an active voice caller is simply dropped. Only the pre-accept `Offered` state recovers (a 30 s offer timeout → re-queue). There is no bulk supervisor reassignment and no admin force-logout.
- **Capacity (W6):** per-channel capacity is hard-coded (Voice 1 / Chat 3 / Email 5 / SMS 3), `MaxTotal` is defined but **not enforced**, and capacity is not configurable anywhere.

## Decision

Adopt a layered, defense-in-depth target architecture for agent presence, session liveness and work continuity, and **implement it incrementally** as sequenced tracks W1–W6. This ADR records the full north-star; only **W1 + W2** are implemented in the first track (W1 ships together with W2 as one session-layer delivery). W3–W6 get their own specs/plans later.

**Session policy (decided):** access token 15 min (unchanged); refresh token **24 h absolute**; **idle timeout 30 min** (per-tenant via `sessionIdleTimeoutMinutes`) with a 60 s warning + countdown; active users are never interrupted (proactive refresh + activity-aware idle).

### Target model per subsystem

- **W1 — Auth correctness:** scope the refresh cookie to `/api/v1/auth` (set + delete), shorten its absolute lifetime to 24 h, and harden rotation against multi-tab races with **both** a client-side cross-tab refresh lock (Web Locks) **and** a short server-side rotation grace window (a just-rotated token replayed within ~15 s converges idempotently instead of family-revoking).
- **W2 — Idle UX:** an activity-aware idle manager where "activity" = real user input **OR** an active voice call **OR** an active conversation (background polling excluded); a 60 s warning alertdialog; proactive refresh while active; cross-tab coordination (BroadcastChannel). **Agent-aware safe teardown:** an idle logout of a routable agent first forces them non-routable (`PUT /agents/me/state → Offline`) to avoid the routing zombie; deliberate non-routable states (break/lunch/…) suppress the nag; non-agent roles get a plain timeout.
- **W3 — Server-side liveness:** ✅ **DESIGNED + SHIPPED 2026-06-06** (see the W3 record below). The original framing here — _bridge the `PresenceTracker.AgentOffline` delta to routing_ — was corrected by deep analysis (the SignalR `PresenceTracker` is feature-gated, display-only, and lives in a separate process; see the W3 record). The shipped design is a transport-agnostic, Api-owned **heartbeat + TTL + leader-gated reaper** authority, accelerated by a graceful `pagehide` departure beacon and an admin force-offline endpoint. Spec: [`docs/specs/2026-06-06-w3-agent-liveness.md`](../specs/2026-06-06-w3-agent-liveness.md).
- **W4 — Deferred ("pause-when-free") pause:** ✅ **DESIGNED + SHIPPED 2026-06-06** (see the W4 record below). The original framing here — _a watcher over `AgentCapacityChangedEvent` / `ConversationStateChangedEvent` / `CallEndedEvent` that applies when `GetCurrentLoadAsync` reaches 0_ — was refined by deep analysis: `AgentCapacityChangedEvent` is never published, the in-process bus is per-pod, and `GetCurrentLoadAsync` counts parked chats (which keep capacity reserved). The shipped design adds a `PendingState` to the agent, blocks new work immediately (digital eligibility exclusion + voice `QueuePause` via a new cross-pod event), and applies the real transition via a leader-gated **drain sweep** when _active_ work (`{Active,OnHold,Consulting,WrapUp}`, parked excluded) reaches 0 — with force-now / cancel and a per-tenant max-pending timeout that force-applies + alerts. Spec: [`docs/specs/2026-06-06-w4-deferred-pause.md`](../specs/2026-06-06-w4-deferred-pause.md).
- **W5 — Work failover:** an `Active→Queued` auto-path when the owner goes offline/non-routable (digital), gated by an owner-absent timeout → re-queue/redistribute; voice caller-rescue on agent-leg drop instead of dropping the caller; supervisor bulk reassignment + a stuck-work view.
- **W6 — Capacity configurability:** an admin editor for `ChannelCapacity` on create/update agent, and enforcement of `MaxTotal`.

## Consequences

- The reported logout bug is fixed by W1 (a small, high-value change) and ships with the W2 idle UX as one coherent session-layer delivery.
- Fixing the cookie also re-enables long-lived sessions, which makes the idle policy (W2) and server-side liveness (W3) necessary rather than optional — a tab left open would otherwise stay alive up to the absolute cap regardless of presence.
- W3–W6 are deferred but recorded here so no architectural intent is lost; each ships as its own spec → plan → implementation cycle. W4's max-pending timeout depends on W5's re-queue.
- A regression test asserting the `Set-Cookie` Path == `/api/v1/auth` closes the gap that let this bug ship (header-injected cookie tests bypassed browser path-matching).

The W1+W2 implementation plan lives at `docs/plans/active/2026-06-04-session-auth-idle-w1-w2.md`; the technical design at `docs/specs/2026-06-04-session-auth-idle-w1-w2-design.md`.

---

## W3 — Server-side agent liveness / anti-zombie (DESIGNED + SHIPPED 2026-06-06)

**Status:** Designed, implemented and shipped (cross-repo). Spec: [`docs/specs/2026-06-06-w3-agent-liveness.md`](../specs/2026-06-06-w3-agent-liveness.md); plan: [`docs/plans/active/w3-agent-liveness.md`](../plans/active/w3-agent-liveness.md).

### Problem (restated)

When an agent's browser disappears ungracefully — power/internet loss, crash, a tab killed without a clean unload — the ACD keeps trusting the persisted `agent.State ∈ {Available,Busy}` and offers calls/chats/emails to a dead session: the **routing zombie**. W3 gives the server a reliable liveness signal that pulls a dead agent out of routing (Offline) so it stops receiving **new** work. (Rescuing **in-flight** work remains W5.)

### Correction to the original W3 framing

This ADR originally proposed bridging the SignalR `PresenceTracker.AgentOffline` delta into routing. Three rounds of code-level analysis (plus feasibility verification) showed that framing was unsound for the production topology:

- **Split transport topology (ADR-0022 Phase A):** SSE lives in **Platform.Api** (the universal channel, always open); SignalR + `PresenceTracker` live in **Platform.Realtime** — a _separate process_ — and are gated behind the `realtimePushSignalR` feature flag.
- The SignalR delta therefore only covers the subset of agents on SignalR, crosses a process boundary, and couples the **display** presence (deliberately separate from routing) to routing.
- SSE has **no per-agent connection registry**, and `RequestAborted` is unreliable on an abrupt disconnect (the TCP socket can hang; behind nginx without `proxy_buffering off` the upstream socket can stay open after the browser dies).

Conclusion: routing-liveness must be owned by **Platform.Api** (where routing lives) and be **transport-agnostic** — not derived from the feature-gated, display-only, cross-process SignalR presence.

### Decision — layered "Option 1" (three pillars)

After the deep analysis the user chose a layered, defense-in-depth design: one universal authority plus cheap accelerators, all in Platform.Api.

1. **Authority — heartbeat + TTL + reaper.** The web client POSTs `POST /api/v1/agents/me/heartbeat` every ~20 s (fixed, **activity-independent**). The Api writes a Redis presence key `presence:agent:{tenant}:{agentId}` with `TTL = AgentLivenessTimeoutSeconds` (per-tenant, default 60). A leader-gated `AgentLivenessReaper : BackgroundService` (resource `agent-liveness:sweep`) sweeps ~every 15 s. Reconciliation rule = **"Postgres says routable ({Available,Busy}) AND Redis says dead (key missing)"** → `Agent.ForceOffline()` → publish `AgentStateChangedEvent("Offline")` → the existing `RealtimeStateBridge` sends an AMI `QueuePause` to Asterisk. Postgres is the truth of _who should be routable_; Redis is the _proof of life_.
2. **Accelerator — graceful departure beacon.** On `pagehide` the client fires `POST /api/v1/agents/me/offline` via `fetch(keepalive:true)` with `Authorization` + `X-Tenant-Id` headers (deliberately **not** `sendBeacon` — the token is a Bearer in memory, not a cookie) → immediate Offline on tab close, no 60 s wait. `visibilitychange:hidden` deliberately does **not** trigger departure (switching tabs ≠ leaving).
3. **Manual — admin force-offline.** `POST /api/v1/admin/agents/{id}/force-offline` (AdminOnly + RequireOperationalTenant, tenant-scoped, no cross-tenant) forces Offline + removes the key + optionally revokes the refresh-token family (`RevokeAllForUserAsync`) + writes an audit entry.

### Key invariants / decisions

- **Decoupling invariant:** client heartbeat interval (20 s, fixed client-side) ≪ server TTL (60 s, per-tenant) with a ≥2× margin → 1–2 dropped beats do not false-reap. The TTL is **not** exposed on `TokenResponse` (server-only).
- **Activity-independent heartbeat:** an agent idling between calls is alive and must stay routable — the heartbeat is deliberately separate from the W2 idle-timeout activity tracking, which it must never reuse.
- **Reaper idempotency:** the reaper re-loads the agent and re-checks `IsRoutable` immediately before `ForceOffline` (anti-stale); only the **leader** pod acts; single-node deployments use an `AlwaysLeader` stub so the sweep still runs.
- **Per-tenant threshold:** `AgentLivenessTimeoutSeconds` lives in `TenantAuthConfig` (same pattern as `SessionIdleTimeoutMinutes`); `<= 0` disables reaping for that tenant.

### Rejected alternatives (with rationale)

- **N1 — TCP keepalive on the SSE socket.** nginx (no `proxy_buffering off`, keep-alive upstream) holds the upstream socket open after the browser dies → it detects nginx, not the browser. Unreliable in this topology.
- **N2 — SSE per-agent connection registry + `RequestAborted`.** `RequestAborted` lags far behind real browser death behind the proxy; it reinvents presence counting unreliably.
- **A2 — Piggyback liveness on existing client traffic.** `GET /agents/me` is not polled; an idle-but-present agent makes no requests → false reap.

### Deferred to future W3.x (recorded, not built)

- **SignalR `PresenceTracker.AgentOffline` cross-process fast-path** — a latency optimizer (~30 s) for the SignalR subset only; the 60 s heartbeat TTL already covers those agents. Add later if data shows the latency matters.
- **Asterisk `ContactStatus` / PJSIP-registration backstop** — a voice-only corroborator; defer.
- **Admin force-offline UI button (B4)** — the backend endpoint shipped; the UI affordance + 3-locale i18n are deferred to keep W3 focused and avoid opening the i18n-parity surface for a non-critical convenience.

### Latent fix found during implementation

The `cluster_distributed_lock` schema-migration gate was broadened from `clusterConn && Ari:BaseUrl` to `clusterConn` alone — a real bug that prevented the lock table (needed by the leader lease) from migrating on AMI-only deployments with no ARI configured.

### Delivery

- **Platform (`w3-agent-liveness`):** `6143610` (foundations: liveness store + per-tenant config + migration 029 + routable-agent stream), `a120333` (heartbeat + offline endpoints), `7cfa7b3` (reaper + leader gating + `AlwaysLeader` stub), `b270060` (admin force-offline), `cb72e575` (cross-tenant + already-offline hardening tests). Gates: `dotnet build -warnaserror` 0 warnings; Queues.Tests 52, Storage.InMemory.Tests 142, Api.Tests 1211.
- **Web (`w3-agent-liveness-web`):** `2453144` (heartbeat hook + departure beacon + agent-layout mount; new `src/core/presence/*`). Gates: `npm run build` clean, lint 0, i18n parity OK, vitest 1258 (14 new presence tests).

---

## W4 — Deferred pause / "pause-when-free" (DESIGNED + SHIPPED 2026-06-06)

**Status:** Designed, implemented and shipped (cross-repo). Spec: [`docs/specs/2026-06-06-w4-deferred-pause.md`](../specs/2026-06-06-w4-deferred-pause.md); plan: [`docs/plans/active/w4-deferred-pause.md`](../plans/active/w4-deferred-pause.md).

### Problem (restated)

Requesting an aux pause (Break/Lunch/Training/DND) while handling work today is either **impossible** (`Busy→Break` is an invalid transition — the agent is on a call) or **applies instantly**, showing "Break" while two chats are still open — a state that _lies_. The user reported it explicitly: _"asking for a pause is initially so that no more messages or calls arrive, and the pause should not become effective until they have actually completely finished whatever they have pending."_ W4 makes a pause request **block new work immediately** but only flip the visible state once the agent's **active** work drains to zero. Rescuing the leftover/stuck work is W5; W4 only blocks, defers, and (on timeout) force-applies + raises a supervisor alert marking the stuck work.

### Refinement to the original W4 framing

This ADR originally proposed a watcher over `AgentCapacityChangedEvent` / `ConversationStateChangedEvent` / `CallEndedEvent` that applies when `GetCurrentLoadAsync` reaches 0. Deep analysis (3 explorations + verification) refined that:

- **State is not the signal.** `Busy` is automatic (set on voice answer; `Busy→ACW` on hang-up); digital leaves the agent `Available` with load carried by `IAgentCapacityService`. "Work in progress" must be derived from conversations the agent **owns**, not from the agent's `State`.
- **"load == 0" is insufficient.** After a call the agent moves to **ACW** (wrap-up — which _is_ work) with load already 0, and `ACW→Lunch/Training/DND` is an invalid transition. The real apply condition is **"pending ∧ no ACTIVE work"**.
- **Parked chats keep capacity reserved** (`WaitingForCustomer`/`Snoozed`), so a capacity-based trigger would hold the agent hostage. Drain over **active work** `{Active,OnHold,Consulting,WrapUp}`, excluding parked + pre-accept.
- **No fin-de-trabajo signal exists** — there is no `PendingState`, and `AgentCapacityChangedEvent` is defined but **never published**; an event-driven trigger has nothing reliable to subscribe to.

### The 4 confirmed decisions (user, after deep analysis)

1. **Apply mechanism = leader-gated periodic sweep (~5 s)** — `PendingPauseDrainWorker`, mirroring the W3 `AgentLivenessReaper` (resource `pending-pause:sweep`, single-node `AlwaysLeader` stub). Chosen over event-driven and inline-at-release because the apply condition is **compound** (pending ∧ no active work) and the in-process bus is **per-pod**; the sweep covers it uniformly and is cluster-safe.
2. **Drain condition = "no ACTIVE work"** — zero conversations the agent owns in `{Active,OnHold,Consulting,WrapUp}`. Parked `{WaitingForCustomer,Snoozed}` and pre-accept `{Queued,Offered}` do **not** block (they stay assigned, resume on return). Uses a new `IConversationStore.CountActiveWorkAsync` — **not** capacity load (parked chats keep capacity reserved).
3. **Deferrable states = {Break, Lunch, Training, DND}** with re-request (change the target while pending). **Offline stays immediate** (deferred sign-off is a future extension on the same machinery). ACW is automatic, not deferrable.
4. **Max-pending timeout = force-apply + supervisor alert/audit** marking the stuck work. Per-tenant `PendingPauseTimeoutMinutes` (default 30; `0` disables). The stuck-work **reassignment** is W5 (out of scope) — W4 just force-applies + raises the audit `agent.pending_pause.forced_timeout`.

### Decision — PendingState + immediate block + drain sweep

- **`PendingState` model.** `Agent.PendingState` / `PendingReason` / `PendingSince` + `Agent.ApplyPendingState()` (a **bounded bypass** mirroring W1's `ForceOffline()`: force-set the target + clear pending without widening the public `EnsureTransition` table — required because e.g. `ACW→Lunch` is an invalid table transition). Migration `030`. `IAgentStore.StreamPendingPauseAgentsAsync` (mirrors W3's `StreamRoutableAgentsAsync`).
- **Immediate block of new work** on SET pending: **digital** → exclude pending agents from `GetAvailableAgentsAsync` (`&& !HasPendingPause`, propagating to routing eligibility + the round-robin sticky bypass); **voice** → a new `AgentPendingStateChangedEvent(target)` → `RealtimeStateBridge` → AMI `QueuePause(true)` (blocks new calls, keeps the active call). **Cross-pod:** the event is registered in `PlatformPushJsonContext` + dispatched via `RemoteEventDispatcher` (like `AgentStateChangedEvent`).
- **Apply** (natural drain / force / timeout): `ApplyPendingState()` + publish **only** `AgentStateChangedEvent(old → target)` (**not** the pending event) → keeps the pause for the now-non-routable state.

### Key invariants / decisions

- **Drain condition (active vs parked):** apply when `CountActiveWorkAsync == 0` over `{Active,OnHold,Consulting,WrapUp}`; parked `{WaitingForCustomer,Snoozed}` + pre-accept `{Queued,Offered}` stay assigned and resume on return — deliberately **not** `GetCurrentLoadAsync` (parked chats keep capacity reserved).
- **Flicker contract:** SET → `AgentPendingStateChangedEvent(target)` = pause; CANCEL → `AgentPendingStateChangedEvent(null)` = unpause; APPLY → `AgentStateChangedEvent(non-routable)` **only**. A review caught + fixed a flicker case: **cancel-and-apply to a NON-routable target** (e.g. Offline while pending) must **also** skip the `pending(null)` event — otherwise it unpauses then re-pauses and flickers queue membership.
- **Ordering invariant (from review):** when SETTING pending, `SaveAsync` (persist `PendingState` so `HasPendingPause` flips for the eligibility filter) **before** publishing the event — else a window where `QueuePause` fired but digital eligibility still routes.
- **Drain worker idempotency:** re-load + re-check pending immediately before applying; only the **leader** pod sweeps; single-node uses the `AlwaysLeader` stub.
- **Per-tenant threshold:** `PendingPauseTimeoutMinutes` lives in `TenantAuthConfig` (same pattern as `SessionIdleTimeoutMinutes` / `AgentLivenessTimeoutSeconds`); `0` disables the timeout force-apply for that tenant.

### Rejected alternatives (with rationale)

- **Event-driven apply** — subscribe to `AgentCapacityChangedEvent` / `ConversationStateChangedEvent` / `CallEndedEvent` and apply inline. Rejected: the in-process bus is per-pod, the apply condition is compound, and `AgentCapacityChangedEvent` is never published — far more wiring + idempotency surface than a single cluster-safe sweep.
- **Inline-at-release** — apply at the point work is released. Rejected: couples the deferred-pause logic to the **hot capacity-release path** and still must handle the compound condition + cross-pod voice pause.

### Deferred to future W4.x (recorded, not built)

- **Offline deferred sign-off** — "log me off when my work drains", on the same PendingState machinery. Offline stays immediate for now.
- **A dedicated `agent.pending_state_changed` browser push** — for an instant cross-tab pending indicator; today the indicator reflects from the response + `['agent-me']` invalidation.
- **Admin UI to edit `PendingPauseTimeoutMinutes`** — the per-tenant value ships server-side; the editor is deferred (align with the `AgentLivenessTimeoutSeconds` admin surface when built).

### Delivery

- **Platform (`w4-deferred-pause`):** `f0247cb` (A1: model + migration `030` + store threading + `StreamPendingPauseAgentsAsync`), `7332d8a` (A2 tenant timeout + A3 active-work query), `047a5b6` (A4: eligibility exclusion + `AgentPendingStateChangedEvent` + cross-pod registration + `RealtimeStateBridge` pause), `46feaea` (A5: endpoints + DTO), `48060a7` (A5 flicker fix), `a00f1b27` (A6: drain worker + leader gating + timeout force/alert). Gates: `dotnet build -warnaserror` 0 warnings; Queues 58, Storage.InMemory 152, Api.Tests 1235.
- **Web (`w4-deferred-pause-web`):** `008c969` (Phase B: pending UX + casing fix + hooks + SSE invalidation + 3-locale i18n), `ab755af` (contextual toast "pause pending" vs "state updated"). Gates: `npm run build` clean, lint 0, i18n parity OK, vitest 1264.
