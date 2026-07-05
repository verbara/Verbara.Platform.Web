# Session/Auth Overhaul — W1+W2 Technical Design

**Date:** 2026-06-04
**Status:** Approved (implementation in progress)
**ADR:** [0009 — Agent Presence, Session & Work-Continuity](../decisions/0009-agent-presence-session-work-continuity.md)
**Plan:** [`docs/plans/completed/2026-06-04-session-auth-idle-w1-w2.md`](../plans/completed/2026-06-04-session-auth-idle-w1-w2.md)
**Repos:** `Verbara.Platform` (W1 backend) + `Verbara.Platform.Web` (W1 client + W2)

## Goal

Fix the refresh-cookie `Path` bug that forces logout at the 15-minute access-token ceiling, shorten the refresh-token absolute lifetime to 24 h, and add an agent-aware idle-timeout (warning + countdown), proactive token refresh, and cross-tab coordination — so active users are never interrupted and idle expiry is explicit and safe.

## Data flow (today → target)

**Today (broken):** login → refresh cookie set at `Path=/api/auth` → client posts `/api/v1/auth/refresh` → browser omits the cookie → 401 → logout at 15 min. No idle handling; expiry invisible until next request.

**Target:** login → refresh cookie at `Path=/api/v1/auth` (24 h) + `TokenResponse.sessionIdleTimeoutMinutes` → client `SessionManager` tracks activity, proactively refreshes ~60 s before the 15-min access expiry (cross-tab-serialized), and after `idle − 60 s` of no activity opens a warning alertdialog with a 60 s countdown; "Stay connected" refreshes, expiry logs out (after a safe agent teardown). Cross-tab via BroadcastChannel.

## Components

### Backend (W1 — `Verbara.Platform`)

- **`AuthEndpoints` / `OidcEndpoints` cookie handling** — `SetRefreshCookie` and the OIDC inline append scope the `refresh_token` cookie to `Path=/api/v1/auth`, `MaxAge=24h`. A shared `RefreshCookiePath` constant + `DeleteRefreshCookie` helper ensure logout/MFA-revoke delete on the matching path (today they delete on `/`, leaving a dangling cookie). The OIDC **state** cookie (`Path=/api/auth/oidc`) is correct (its callback `redirect_uri` is unversioned) and is left unchanged.
- **`RefreshTokenService`** — `RefreshTokenLifetime` 7 d → 24 h. `RotateAsync` gains a **grace window** (constructor param, default 15 s): a token that was legitimately rotated (`ReplacedBy != null`, `RevokedAt` within grace) and whose replacement is still active converges idempotently — it mints a fresh token chained to the replacement instead of family-revoking. Genuine reuse (hard-revoked, `ReplacedBy == null`, or replayed after grace) still family-revokes. Requires a new `IRefreshTokenStore.GetByTokenIdAsync` (Postgres + InMemory + the tests' in-memory copy). Because the store keeps only the SHA-256 hash, the graced replay cannot return the replacement's raw token — hence the chained-new-token strategy; client cross-tab serialization (below) means the grace path is hit only on genuine races.
- **`TokenResponse`** — gains an optional `SessionIdleTimeoutMinutes` (already-registered record → no new `[JsonSerializable]`), populated in `IssueTokensAsync` and `Refresh` from `ITenantAuthConfigStore` (default 30). OIDC issues tokens by URL fragment and does not carry it (falls back to 30 — documented gap).
- **`AgentStateMachine` / `Agent`** — add the `(Busy, Offline)` transition (a legitimate sign-off edge) and an `Agent.ForceOffline()` helper (bounded bypass reserved for teardown). The client teardown uses the existing `PUT /agents/me/state` (now valid from both Available and Busy).

### Client (W1 client + W2 — `Verbara.Platform.Web`)

New module `src/core/session/`:

- **`idle-config.ts`** (pure) — `resolveIdleMinutes` (default 30), `idleMs`, `warningAtMs`, `WARNING_BEFORE_MS=60_000`, `COUNTDOWN_SECONDS=60`, `ACTIVITY_THROTTLE_MS=5_000`.
- **`session-channel.ts`** — BroadcastChannel(`verbara-session`) wrapper, messages `activity | logout | refreshed`, no-op fallback when unavailable.
- **`use-session-manager.ts`** — the orchestrator hook (timers in refs; minimal React state `{warningOpen, secondsLeft}`). Reads cross-store state via `getState()`/`subscribe` (no hooks → no re-render churn; stores never import this module → no cycle). Activity = throttled DOM input (`mousemove/keydown/pointerdown/scroll/touchstart`, passive) OR `voice-call-store.phase ∈ {ringing,active}` OR `conversation-store` any state ∈ {active,on_hold,consulting}. Schedules warning at `warningAtMs`, logout at `idleMs`, and an independent proactive refresh at `tokenExpiry − 60 s`.
- **`session-warning-dialog.tsx`** — reuses `core/ui/dialog.tsx` (base-ui render-prop) as `role="alertdialog"`, `showCloseButton={false}`, no backdrop-close, initial focus on "Stay connected", countdown announced via `core/ui/live-region.tsx` (assertive), `motion-reduce` honored.
- **`agent-teardown.ts`** — `safeAgentTeardown(queryClient)`: reads cached `['agent-me']`; if routable (`available|busy`) awaits `PUT /agents/me/state {state:'offline'}` (short timeout) before logout; deliberate non-routable suppresses the nag; non-agent → plain timeout.
- **`session-manager.tsx`** — mounts the hook + dialog inside `shell/app-shell.tsx` (authenticated scope). `onLogout` = teardown → `auth-store.logout()` → broadcast `logout` → redirect `/login`; a received `logout` does the local logout without re-teardown or re-broadcast.

Changes to existing files: `auth-store.ts` (carry/clear `sessionIdleTimeoutMinutes`), `login-page.tsx` + `client.ts` (pass it through), `client.ts` (`refreshAccessToken` wrapped in `navigator.locks.request('verbara-refresh', …)` with per-tab `_refreshPromise` fallback + already-fresh skip + `refreshed` broadcast; exported for proactive use).

## Error handling

- Refresh failure still falls back to the existing logout+redirect; the cross-tab lock must never deadlock (Web Locks auto-releases on callback completion; fallback path when unavailable).
- Teardown PUT is awaited with a short timeout and errors are swallowed so logout never blocks.
- Grace-window: genuine reuse must still family-revoke — covered by an explicit after-grace/hard-revoke test.

## Testing

- **Backend (xUnit, `Method_ShouldExpected_WhenCondition`):** regression test asserting `Set-Cookie` Path `/api/v1/auth` + `max-age=86400`; logout delete-on-path; 24 h lifetime; rotation grace (idempotent within grace vs family-revoke after grace — update the existing reuse test); `Busy→Offline` + `ForceOffline`.
- **Client (Vitest, fake timers):** idle-config math; session-channel broadcast + no-op; idle manager (warning timing, DOM/voice/conversation activity, countdown→logout, stay-connected, cross-tab); alertdialog a11y; refresh-lock (single fetch, lock usage, already-fresh skip, fallback); agent-teardown (routable→PUT, else skip); session-manager integration (teardown order, dnd suppression, broadcast logout no double-PUT). Gate: `npm run build` (tsc -b) + `npm run lint` (eslint + i18n:check) + `npm run test`.
- **Manual E2E (key):** browser idle >15 min on a polling screen must NOT log out; DevTools confirms `POST /api/v1/auth/refresh` sends the cookie and returns 200; warning appears at 29:00 with countdown; "Stay connected" persists; expiry redirects to `/login`; a routable agent that expires ends up Offline server-side. Optional Playwright spec.

## Out of scope (recorded in ADR-0009 as W3–W6)

Server-side liveness/anti-zombie (W3), deferred "pause-when-free" (W4), in-flight work failover (W5), capacity configurability (W6).
