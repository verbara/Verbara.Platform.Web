---
tier: MEDIANO
owner: Harol A. Reina H.
approver: Harol A. Reina H.
stakeholder: Harol A. Reina H.
decision_ref: ADR-0009
---

## Why

`auth-store` persists its **entire** state into `sessionStorage` under `verbara-auth` — including the
access token (a bearer JWT), its expiry, the pre-authentication MFA token, and, during impersonation,
the operator's original token. Any script running on the origin (an XSS, a compromised dependency, a
browser extension with page access) reads them as plain text, and they sit in DevTools in the clear.

The durable credential is already held safely: since ADR-0009 W1 the refresh token lives in an
**httpOnly** cookie scoped to `/api/v1/auth`, which JavaScript cannot read. Persisting the access
token duplicates a secret into a place JavaScript _can_ read, and buys only one thing — surviving a
page reload — which the refresh cookie can do better and without exposure. The two other secrets are
worse than the access token: `mfaPending.mfaToken` is a pre-auth credential that bypasses the first
factor, and `impersonation.originalToken` is the operator's own privileged token, strictly more
valuable than the impersonated tenant's.

This is a genuinely frontend-independent change — the API contract is untouched, so it is authored
here rather than in the Platform hub (see `openspec/specs/README.md`).

## What Changes

- **Add a `partialize` to the `auth-store` persist config** so the persisted slice carries only
  non-secret session facts: `user`, `tenantId`, `permissions`, `features`, `rememberMe`,
  `sessionIdleTimeoutMinutes`. Dropped from storage: `accessToken`, `tokenExpiry`, `mfaPending`,
  and the whole `impersonation` object (its `originalToken` field is a secret, and the remaining
  fields describe a session that cannot survive a reload — see below).
- **Add a `restoring` phase to `AuthGuard`.** On a reload the store rehydrates with a user but no
  token; instead of bouncing to `/login`, the guard silently re-mints an access token from the
  httpOnly refresh cookie exactly once per page load, showing a skeleton meanwhile, and falls back to
  `/login` only when the refresh genuinely fails.
- **Widen the pre-flight refresh condition in `customFetch`.** It currently reads
  `isTokenExpired() && accessToken`, so a null token short-circuits the refresh; after this change a
  rehydrated-but-tokenless session must also trigger it.
- **Gate the early-start auth consumers** (`use-sse`, `platform-hub`, `use-agent-heartbeat`,
  `agent-departure`) behind the restored state so they do not open connections with a null token.
- **BREAKING (test-only): the E2E authentication fixture must change.** It seeds a JWT directly into
  `sessionStorage`, which will no longer be honoured. Note this is _already_ broken and this change
  forces the fix: the fixture writes the key `asterisk-auth` (9 files still use it) while the store
  has persisted under `verbara-auth` since the rebrand — the injected state is being ignored today.
- **Impersonation reload semantics become explicit.** Not persisting `impersonation` means a reload
  during impersonation returns the operator to their own session rather than resuming a privileged
  one. This also surfaces a latent inconsistency that exists today: the refresh cookie belongs to the
  original login, so any refresh fired while impersonating already swaps in the operator's token
  while the store still reports `impersonation.active`.

## Capabilities

### New Capabilities

- `auth-token-storage`: what the browser may persist of an authenticated session, and how a session
  is restored on reload without a stored bearer token.

### Modified Capabilities

<!-- No existing spec in this repo states requirements about auth persistence or guard behavior;
     the specs present (agent-presence-admin-controls, csat-capture, csat-operator-views,
     openapi-generated-types) are untouched by this change. -->

## Impact

**Code**

- `src/core/auth/auth-store.ts` — persist config gains `partialize`; `endImpersonation` can no longer
  assume a stored `originalToken`.
- `src/core/auth/auth-guard.tsx` — gains the restoring phase (currently 14 lines, token-only logic).
- `src/core/api/client.ts` — pre-flight refresh condition; `refreshAccessToken` already dedupes
  per-tab (`_refreshPromise`) and across tabs (Web Locks `verbara-refresh`), so the restore path
  reuses it as-is.
- `src/core/session/*`, `src/core/presence/*`, `src/core/realtime/platform-hub.ts`,
  `src/core/hooks/use-sse.ts` — consumers that read `accessToken` at start-up.
- `src/core/auth/mfa-verify.tsx`, `login-page.tsx` — `mfaPending` becomes in-memory only, so an MFA
  challenge no longer survives a reload (the user restarts the login).

**Tests**

- `tests/e2e/fixtures/auth.fixture.ts` plus the ~8 specs that read or rewrite the seeded blob.
- `src/core/auth/auth-store.test.ts` — add coverage that secrets are absent from the persisted slice.

**Not affected**

- The Platform API: no endpoint, DTO or cookie change. `POST /api/v1/auth/refresh` already behaves as
  required.
- Other persisted stores (`draft-store` uses `localStorage` and holds no credentials).

**Risk**: the restore path runs on every reload for every authenticated user, so a regression there
logs everyone out. It is mitigated by falling back to today's behaviour (redirect to `/login`) on any
failure, and by the refresh call already being battle-tested from ADR-0009 W1/W2.
