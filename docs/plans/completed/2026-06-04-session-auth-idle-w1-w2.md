# Plan — Session/Auth Overhaul · Track W1+W2 (+ ADR north-star W1–W6)

> Mirrored from the approved ExitPlanMode plan (2026-06-04). ADR: [0009](../../decisions/0009-agent-presence-session-work-continuity.md) · Spec: [W1+W2 design](../../specs/2026-06-04-session-auth-idle-w1-w2-design.md). Execute via **Subagent-Driven Development** with FCM batching. Auth-sensitive tasks flagged 🔒 get individual focused review.

## Context

**Why:** Users report (1) the session closing while actively working and (2) silent expiry while away (screen frozen, password only on next action). **Root cause (verified):** the refresh cookie is scoped to `Path=/api/auth` (`AuthEndpoints.cs:968`, `OidcEndpoints.cs:265`) but the client posts `/api/v1/auth/refresh` (`client.ts:32`) — per RFC 6265 the cookie is not sent → refresh 401 → forced logout at the 15-min access-token ceiling. Leftover from the `/api → /api/v1` migration. Both symptoms are the same bug (polling screen vs not). The full problem is ~6 subsystems (ADR-0009); this track is **W1 (auth fix) + W2 (idle UX)**, W1 shipping with W2.

## Confirmed decisions

1. Access 15 min (unchanged); refresh **24 h absolute** (was 7 d).
2. **Idle 30 min** default (per-tenant `sessionIdleTimeoutMinutes`); warning at 29:00 + 60 s countdown + "Stay connected"; logout at 30:00.
3. **Activity** = user input (throttled 5 s) OR active call (phase ∈ {ringing,active}) OR active conversation (∈ {active,on_hold,consulting}); polling excluded.
4. **Agent-aware:** routable agent idle → `PUT /agents/me/state → Offline` then logout; deliberate non-routable → suppress nag; non-agent → plain idle.
5. **Proactive refresh** while active (before 15-min expiry).
6. **Multi-tab** coordination via BroadcastChannel.
7. **Refresh race:** client Web Locks **+** server grace window (~15 s) — both.
8. **Cookie Delete on matching path** so logout clears it.
9. **Forced → Offline** from any state (today `Busy→Offline` invalid).

## Phase A — W1 Backend (`Verbara.Platform`, branch `feat/session-auth-fix`)

> FCM: A1–A4 batch; A5 + A6 individual. AOT: only an already-registered `TokenResponse` gains a field. TreatWarningsAsErrors on.

- **A1 🔒** Cookie `Path=/api/v1/auth` + `MaxAge=24h` (`AuthEndpoints.SetRefreshCookie`, `OidcEndpoints` inline) + regression test asserting `Set-Cookie` path. Do **not** touch the OIDC state cookie.
- **A2 🔒** `DeleteRefreshCookie` with matching path (`AuthEndpoints.cs:266,325`; `OidcEndpoints.cs:306`).
- **A3** `RefreshTokenLifetime` → 24 h.
- **A4** `TokenResponse.SessionIdleTimeoutMinutes` populated from `ITenantAuthConfigStore` (default 30) in `IssueTokensAsync` + `Refresh`.
- **A5 🔒 INDIVIDUAL** Rotation grace window in `RotateAsync` (idempotent within ~15 s, family-revoke otherwise) + `GetByTokenIdAsync` on the store (Postgres + InMemory ×2). Update the existing reuse test.
- **A6 🔒** `(Busy, Offline)` edge + `Agent.ForceOffline()`.
- **A7** Gate: `dotnet build -warnaserror` + `dotnet test` green.

## Phase B — W1/W2 Client (`Verbara.Platform.Web`, branch `feat/session-idle-timeout`)

> Gate per task: `npm run build` (tsc -b) + `npm run lint` (eslint + i18n:check). Tests: `npm run test`. base-ui render-prop. i18n baseline es-419.

New: `src/core/session/{idle-config.ts, session-channel.ts, use-session-manager.ts, session-warning-dialog.tsx, agent-teardown.ts, session-manager.tsx}` + specs.

- **B1** Plumb `sessionIdleTimeoutMinutes` into `auth-store` (`setAuth`/`logout`), `login-page.tsx`, `client.ts`.
- **B2** `idle-config.ts` + `session-channel.ts`.
- **B3 🔒 INDIVIDUAL** `useSessionManager` (refs, activity sources, warning/countdown/logout scheduling, proactive refresh, cross-tab).
- **B4** Warning alertdialog (a11y, live-region, motion-reduce) — uses B7 keys.
- **B5 🔒 INDIVIDUAL** `client.ts` refresh wrapped in Web Locks + already-fresh skip + `refreshed` broadcast; preserve pre-flight & 401-retry.
- **B6 🔒 INDIVIDUAL** `agent-teardown.ts` + `session-manager.tsx` mounted in `shell/app-shell.tsx`; export `refreshAccessToken`.
- **B7** i18n `session.*` keys (3 locales, baseline es-419): `warning.title/description/countdown({{seconds}})/stayConnected/signOutNow/srCountdown({{seconds}})`.
- **B8 (optional)** Playwright e2e of the warning flow.
- **B9** Gate: `npm run build` + `npm run lint` + `npm run test` green.

## Phase C — Sequence & review

A1+A2+A3+A4 → A5 → A6 → A7 → B1+B2 → B7 → B3 → B4 → B5 → B6 → B8 → B9. Individual focused review 🔒: **A1, A2, A5, B3, B5, B6**.

## Verification

- Backend: `dotnet build -warnaserror` + `dotnet test` (cookie path regression, delete-path, 24 h lifetime, rotation grace vs family-revoke, Busy→Offline/ForceOffline).
- Client: `npm run build` + `npm run lint` (parity OK) + `npm run test`.
- Manual E2E: idle >15 min on a polling screen does NOT log out; `Set-Cookie` Path `/api/v1/auth`; refresh sends the cookie → 200; warning at 29:00; "Stay connected" persists; expiry → `/login`; routable agent that expires → Offline server-side.

## Status log

- 2026-06-04 — Plan approved; branches `feat/session-auth-fix` (Platform) and `feat/session-idle-timeout` (Web) created from `main`; ADR-0009 + spec + plan written. Implementation starting.
- 2026-06-04 → 2026-06-05 — **W1+W2 execution complete** (Subagent-Driven, two-stage review per task):
  - **W1 backend (A1–A7):** refresh cookie re-scoped `/api/v1/auth` (set + delete, centralized in `RefreshTokenCookie`); MaxAge + absolute lifetime 24h; `TokenResponse.sessionIdleTimeoutMinutes` (per-tenant, default 30); rotation grace window (~15s, fail-closed with guard-mismatch tests); `Busy→Offline` + `Agent.ForceOffline()`. Gates: `dotnet build -warnaserror` 0 warnings, `dotnet test` 1180 Api + 52 Queues. → PR #41 (open).
  - **W2 web (B1–B9):** activity-aware idle manager (30 min default, per-tenant) + 60s warning alertdialog + countdown + proactive refresh; activity = user input ∪ active voice call ∪ active conversation (polling excluded); cross-tab coordination (BroadcastChannel + Web Locks); agent-aware safe Offline teardown before logout; new module `src/core/session/*`; i18n `session.*` in 3 locales. Gates: `npm run build` (tsc -b) clean, `npm run lint` 0 errors, `npm run test` 1244, i18n parity OK. → PR #75 (open).
  - **Final holistic review** caught + fixed a Blocking bug: `GET /agents/me` returns PascalCase `state`, but the **Web** teardown/suppression compared lowercase literals → never matched real data; normalized with `.toLowerCase()` and re-based test fixtures to the real wire casing (the W2 anti-zombie protection now actually fires).
  - **Final holistic review** caught + fixed the Blocking casing bug above; both gates green.
- **2026-06-05 — ✅ SHIPPED.** Both PRs **MERGED** (auto-merge on green CI): Web **#75** → `verbara/Verbara.Platform.Web@739d8fb`; Platform **#41** → `verbara/Verbara.Platform@4a8cec76`. W1+W2 now on `main` in both repos. Plan moved `active/` → `completed/`. Branches `feat/session-idle-timeout` + `feat/session-auth-fix` retired. **Next:** W3–W6 (ADR-0009 north-star) — server-side liveness, deferred pause, work failover, capacity config.
