# Session/Auth Overhaul — W3 Technical Design (server-side agent liveness / anti-zombie)

**Date:** 2026-06-06
**Status:** Shipped
**ADR:** [0009 — Agent Presence, Session & Work-Continuity](../decisions/0009-agent-presence-session-work-continuity.md) (W3 section)
**Plan:** [`docs/plans/active/w3-agent-liveness.md`](../plans/active/w3-agent-liveness.md)
**Repos:** `Verbara.Platform` (backend authority + endpoints + reaper) + `Verbara.Platform.Web` (heartbeat + departure beacon)

## Goal

Give the server a reliable liveness signal for agents so that an ungraceful disconnect (power/internet loss, crash, a tab killed without a clean unload) pulls the agent out of routing (Offline) and stops the ACD offering **new** work to a dead session — the *routing zombie*. Rescuing **in-flight** work is out of scope (that is W5).

## Problem (today → target)

**Today (broken):** the ACD trusts the persisted `agent.State ∈ {Available,Busy}` with **no** liveness check. On an ungraceful disconnect nothing reverts the routing state — the agent stays routable and work is offered to a session nobody is watching. SignalR `OnDisconnectedAsync` only updates a separate presence-**display** tracker; an SSE drop only logs; the Asterisk `qualify`/ContactStatus path is built but unwired; there is no heartbeat/TTL sweep.

**Target:** the client emits a steady, activity-independent heartbeat; the Api records it as a Redis presence key with a per-tenant TTL; a leader-gated background reaper reconciles *"Postgres says routable AND Redis says dead"* into Offline through the existing `AgentStateChangedEvent → RealtimeStateBridge → Asterisk QueuePause` chain. A `pagehide` departure beacon makes a clean tab-close instant; an admin endpoint lets a supervisor evict a stuck/zombie agent on demand.

## Transport-topology analysis (why this shape)

The original ADR-0009 framing proposed bridging the SignalR `PresenceTracker.AgentOffline` delta into routing. Code-level analysis showed that framing is unsound for the production topology:

- **Split processes (ADR-0022 Phase A):** SSE lives in **Platform.Api** (the universal channel, always open). SignalR + `PresenceTracker` live in **Platform.Realtime** — a *separate process* — behind the `realtimePushSignalR` feature flag.
- The SignalR delta therefore (a) only covers agents on SignalR, (b) crosses a process boundary, and (c) couples **display** presence (deliberately separate from routing) to routing.
- SSE has **no per-agent connection registry**, and `RequestAborted` is unreliable on abrupt death: the TCP socket can hang, and behind nginx (no `proxy_buffering off`, keep-alive upstream) the upstream socket can stay open after the browser is gone.

Conclusion: routing-liveness must be **owned by Platform.Api** (where routing lives) and **transport-agnostic** — derived from an explicit client proof-of-life, not from the feature-gated, display-only, cross-process SignalR presence.

## Layered design (three pillars)

### Pillar 1 — Authority: heartbeat + TTL + reaper

- **Client heartbeat:** `POST /api/v1/agents/me/heartbeat` every **~20 s**, fixed and **activity-independent**. The endpoint resolves tenant + agent, reads the tenant's `AgentLivenessTimeoutSeconds` (default 60; `<= 0` → `NoContent` without writing), and calls `livenessStore.TouchAsync(...)`. It **does not** change agent state. Responds `204 No Content`, no DTO.
- **Presence key (Redis):** `presence:agent:{tenant}:{agentId}` with `TTL = AgentLivenessTimeoutSeconds`. The value is a small diagnostic JSON `{ nodeId, touchedAt }` (its own `[JsonSerializable]` source-gen context for AOT). **Presence = existence of the key**; the reaper uses an exact `KeyExists` check (no scan → prefix-agnostic).
- **Reaper:** `AgentLivenessReaper : BackgroundService`, leader-gated on resource `agent-liveness:sweep`, modeled on `ImpersonationSessionTimeoutService` (public `SweepOnceAsync`, `PeriodicTimer` at ~15 s, OCE-shutdown swallow, fatal rethrow, `[LoggerMessage]` source-gen logs). Each sweep, if leader: cache per-tenant TTL once, then `await foreach` over `IAgentStore.StreamRoutableAgentsAsync(ct)` (cross-tenant, unpaged, `WHERE state IN (Available, Busy)`). For each agent: skip if `ttl <= 0`; skip if `IsAliveAsync` (key present); otherwise **re-load (`GetByIdAsync`) and re-check `IsRoutable`** before acting, then `ForceOffline()` → `SaveAsync` → publish `AgentStateChangedEvent("Offline")` → audit `agent.liveness.force_offline` (`severity:"warning"`, `actorType:"system"`).

**Reconciliation rule:** *Postgres says routable ({Available,Busy}) AND Redis says dead (key missing)*. Postgres is the truth of *who should be routable*; Redis is the *proof of life*.

### Pillar 2 — Accelerator: graceful departure beacon

- On `pagehide` the client fires `POST /api/v1/agents/me/offline` via `fetch(keepalive:true)` with `Authorization: Bearer <token>` + `X-Tenant-Id` headers (deliberately **not** `sendBeacon` — the access token is a Bearer held in memory, not a cookie that the browser would attach automatically; `sendBeacon` cannot set the Authorization header).
- The endpoint resolves the agent, captures `oldState`, calls `ForceOffline()` (bypassing `EnsureTransition`), `SaveAsync`, `livenessStore.RemoveAsync`, and publishes `AgentStateChangedEvent(...,oldState,"Offline")` **only if** `oldState != Offline` (idempotent — avoids spamming `QueuePause`). Responds `204 No Content`.
- The client guard reuses the W2 `agent-teardown.ts` normalization (`(agent.state ?? '').toLowerCase()`, `ROUTABLE_STATES = {available, busy}`) so it only beacons for a routable agent and skips when there is no token.
- **`visibilitychange:hidden` deliberately does NOT trigger departure.** Switching tabs (or backgrounding the app) is not leaving; reaping there would create a false zombie. The heartbeat keeps beating while the tab is hidden; the real departure signal is `pagehide` (or, failing that, the TTL).

### Pillar 3 — Manual: admin force-offline

- `POST /api/v1/admin/agents/{id}/force-offline`, `AdminOnly` + `RequireOperationalTenant()`, **tenant-scoped** (no cross-tenant — a `GetByIdAsync` miss in the caller's tenant → `404`).
- Forces Offline + `SaveAsync` + `livenessStore.RemoveAsync`; publishes the Offline event when `oldState != Offline`; **optionally** revokes the agent's refresh-token family (`RevokeAllForUserAsync`, reusing W1) when `body.RevokeSessions` is true; writes audit `agent.force_offline`. Request DTO `ForceOfflineRequest(bool RevokeSessions)` registered in `ApiJsonContext`.

## Per-tenant configuration

`TenantAuthConfig.AgentLivenessTimeoutSeconds` (`int`, default **60**) carried end-to-end:

- migration `Storage.Postgres/Migrations/029_AgentLivenessTimeout.sql` → `ALTER TABLE tenant_auth_config ADD COLUMN IF NOT EXISTS agent_liveness_timeout_seconds integer NOT NULL DEFAULT 60;`
- `PostgresTenantAuthConfigStore` (SELECT / INSERT+ON CONFLICT / bind / row / `Map` / `ToTenantAuthConfig`), `InMemoryTenantAuthConfigStore`, and `CachedTenantAuthConfigStore` (follows automatically).
- Same pattern as `SessionIdleTimeoutMinutes` / `ImpersonationAutoTimeoutMinutes`. A value `<= 0` disables reaping for that tenant. The TTL is **server-only** — it is **not** exposed on `TokenResponse`.

## Key invariants

- **Decoupling invariant (the heart of the design):** client heartbeat interval (**20 s, fixed client-side**) ≪ server TTL (**60 s, per-tenant**) with a **≥2× margin** → 1–2 dropped beats do not false-reap. A genuinely dead agent is reaped within roughly `TTL + sweepInterval` (≈ 60–75 s); a clean tab-close is instant via the beacon.
- **Activity-independent heartbeat:** an agent idling between calls is alive and must stay routable. The heartbeat is deliberately separate from — and never reuses — the W2 idle-timeout activity tracking. (W2 protects the *human session*; W3 protects *routing liveness*. Different lifetimes, different signals.)
- **Reaper idempotency / safety:** re-load + re-check `IsRoutable` immediately before `ForceOffline` (anti-stale, safe to run twice); the Offline event is published only on a real `routable → Offline` transition; only the **leader** pod sweeps.
- **`pagehide` vs `visibilitychange`:** only `pagehide` (terminal page lifecycle) signals departure; `visibilitychange:hidden` (tab switch / background) does not.

## Leader gating + single-node fallback

The reaper runs on exactly one pod in a multi-replica cluster, gated through the cluster leader lease on resource `agent-liveness:sweep` (`AgentLivenessLeaderResources.Sweep`). On failover, a follower acquires the lease and resumes sweeping. Single-node deployments register an `AlwaysLeader` stub so the sweep still runs without a distributed lock.

> **Latent fix during implementation:** the `cluster_distributed_lock` schema-migration gate was broadened from `clusterConn && Ari:BaseUrl` to `clusterConn` alone — a real bug that stopped the lock table (required by the leader lease) from migrating on AMI-only deployments with no ARI configured.

## Client module (`Verbara.Platform.Web`)

New module `src/core/presence/` (separate from `src/core/session/`):

- **`use-agent-heartbeat.ts`** — `HEARTBEAT_INTERVAL_MS = 20_000` (fixed, activity-independent). One immediate beat on mount, then every 20 s while authenticated, via `customFetch POST /agents/me/heartbeat`; **keeps beating with the tab hidden**; errors swallowed; `clearInterval` on unmount.
- **`agent-departure.ts`** — `sendOfflineBeacon()` reads the in-memory `accessToken`, guards on routable state (reusing the `agent-teardown.ts` normalization), and fires best-effort `fetch('/api/v1/agents/me/offline', {method:'POST', keepalive:true, headers:{Authorization, X-Tenant-Id}})` (not `customFetch`, not `sendBeacon`). `useAgentDeparture()` registers `pagehide` → beacon and `visibilitychange:hidden` → **no** departure; removes listeners on unmount.
- **Mount:** both hooks mount in `src/pages/agent/agent-layout.tsx` alongside `useSoftphone()` (scoped to `/agent`), with no duplicate timers.

The admin force-offline **UI button + i18n** are deferred (see below); the backend endpoint is testable on its own.

## Error handling

- Heartbeat failures are swallowed (a missed beat is covered by the 2× TTL margin); the interval keeps running.
- The departure beacon is best-effort; if it never lands, the TTL reaps the agent within the normal window.
- The reaper swallows shutdown `OperationCanceledException`, rethrows fatal errors, and is safe to run repeatedly (re-check `IsRoutable`).

## Testing

- **Backend (xUnit, `Method_ShouldExpected_WhenCondition`):** liveness store (alive-within-ttl / not-after-ttl / never-touched / remove / refresh-expiry, `TimeProvider`-driven in-memory); config round-trip + migration (default-60-when-unset / custom round-trip); `StreamRoutableAgentsAsync` (only Available/Busy / across tenants / empty); heartbeat endpoint (204 / makes-alive / not-found / no-state-change-when-busy / no-key-when-timeout-zero); offline endpoint (offline-when-routable / event-when-from-routable / no-event-when-already-offline / removes-key / idempotent 204 / not-found); reaper (force-offline-when-no-key / publishes-offline / no-reap-when-alive / no-reap-when-non-routable / nothing-when-not-leader / skip-when-timeout-zero / emits-audit / idempotent-twice / per-tenant-timeout, with `FakeTimeProvider` + fake leader + event-bus capture); admin endpoint (offline-when-admin / publishes-event / removes-key / not-found-cross-tenant / revokes-tokens-when-true / no-revoke-when-false / emits-audit / idempotent). Gates: `dotnet build -warnaserror` 0 warnings; **Queues.Tests 52, Storage.InMemory.Tests 142, Api.Tests 1211**.
- **Client (Vitest, fake timers):** heartbeat (posts-immediately / every-20s / stops-on-unmount / keeps-when-hidden / swallows-error); departure (fetch-with-auth-header / uses-keepalive / skip-non-routable / skip-no-token / pagehide-sends / visibility-hidden-no-send / removes-listeners); agent-layout mount (starts-heartbeat-when-mounted). Gate: `npm run build` (tsc -b) + `npm run lint` (eslint + i18n:check) + `npm run test` → **vitest 1258 (14 new presence tests)**, build clean, lint 0, i18n parity OK.
- **Manual E2E (key):** (1) open `/agent` → `POST /heartbeat` 204 immediately and every ~20 s; Redis key with TTL ~60. (2) kill the network → within ≤ ~60 s the leader reaper sets Offline in Postgres + sends `QueuePause Paused=true` + writes audit `agent.liveness.force_offline`. (3) close the tab → `pagehide` → Offline **immediately** (no 60 s wait). (4) switch tabs (don't close) → still routable, heartbeat continues (validates the `visibilitychange` guard). (5) admin force-offline with permission → Offline + QueuePause (+ tokens revoked when requested); without permission → 403. (6) multi-replica: only the leader sweeps; on failover a follower resumes the lease.

## Deferred (recorded in ADR-0009 as W3.x)

- **SignalR `PresenceTracker.AgentOffline` cross-process fast-path** — a ~30 s latency optimizer for the SignalR subset only; the 60 s TTL already covers those agents. Add if data shows the latency matters.
- **Asterisk `ContactStatus` / PJSIP-registration backstop** — voice-only corroborator; defer.
- **Admin force-offline UI button (B4)** — endpoint shipped; the button + 3-locale i18n deferred to keep W3 focused and not open the i18n-parity surface for a non-critical convenience.
- **SSE response/nginx buffering hygiene** (`X-Accel-Buffering: no` + `proxy_buffering off;`) — not required by W3 (W3 does not depend on socket close); tracked as optional hygiene.

## Out of scope (recorded in ADR-0009 as W4–W6)

Deferred ("pause-when-free") pause (W4), in-flight work failover (W5), capacity configurability (W6).
