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
- **W3 — Server-side liveness:** bridge the `PresenceTracker.AgentOffline` delta (a CRDT that fires only when the agent's **last** connection drops — multi-tab/multi-pod safe) to `IAgentPresenceService.UpdateStateAsync(non-routable)`, reusing the existing `AgentStateChangedEvent → RealtimeStateBridge → Asterisk pause` chain (~30 s). Optional backstops: a client heartbeat + TTL sweep for half-open sockets, the Asterisk ContactStatus path for voice, and an admin force-logout/force-state endpoint.
- **W4 — Deferred ("pause-when-free") pause:** add a `PendingState` to the agent; requesting a non-routable state while holding work blocks new offers immediately and shows a "pending" indicator; a watcher over `AgentCapacityChangedEvent` / `ConversationStateChangedEvent` / `CallEndedEvent` applies the real transition when `GetCurrentLoadAsync` reaches 0; with force-now / cancel and a max-pending timeout (uses W5).
- **W5 — Work failover:** an `Active→Queued` auto-path when the owner goes offline/non-routable (digital), gated by an owner-absent timeout → re-queue/redistribute; voice caller-rescue on agent-leg drop instead of dropping the caller; supervisor bulk reassignment + a stuck-work view.
- **W6 — Capacity configurability:** an admin editor for `ChannelCapacity` on create/update agent, and enforcement of `MaxTotal`.

## Consequences

- The reported logout bug is fixed by W1 (a small, high-value change) and ships with the W2 idle UX as one coherent session-layer delivery.
- Fixing the cookie also re-enables long-lived sessions, which makes the idle policy (W2) and server-side liveness (W3) necessary rather than optional — a tab left open would otherwise stay alive up to the absolute cap regardless of presence.
- W3–W6 are deferred but recorded here so no architectural intent is lost; each ships as its own spec → plan → implementation cycle. W4's max-pending timeout depends on W5's re-queue.
- A regression test asserting the `Set-Cookie` Path == `/api/v1/auth` closes the gap that let this bug ship (header-injected cookie tests bypassed browser path-matching).

The W1+W2 implementation plan lives at `docs/plans/active/2026-06-04-session-auth-idle-w1-w2.md`; the technical design at `docs/specs/2026-06-04-session-auth-idle-w1-w2-design.md`.
