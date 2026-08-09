## Context

`auth-store` is a Zustand store wrapped in `persist` with `createJSONStorage(() => sessionStorage)`
and **no `partialize`**, so every field is written to `verbara-auth` — bearer token included. The
refresh token has lived in an httpOnly cookie scoped to `/api/v1/auth` since ADR-0009 W1, and
`refreshAccessToken` in `src/core/api/client.ts` already exchanges it for a fresh access token,
deduplicating per tab (`_refreshPromise`) and serialising across tabs (Web Locks `verbara-refresh`)
while broadcasting `'refreshed'` so sibling tabs reschedule their proactive timers.

So the durable credential is already safe and the re-mint machinery already exists and is in
production. What is missing is only the willingness to _not_ keep a copy of the access token where
JavaScript can read it, plus the small piece of glue that runs the re-mint on reload before the guard
concludes the user is signed out.

Constraint that shapes the design: `AuthGuard` today is a 14-line synchronous component. It reads
`accessToken`, and if it is falsy it navigates to `/login`. It wraps the four layout shells, so
whatever restore mechanism is added can mount more than once concurrently.

## Goals / Non-Goals

**Goals:**

- No credential (access token, MFA token, operator token) is readable from browser storage.
- A reload of an authenticated tab is visually a brief skeleton, not a logout.
- Exactly one refresh request per page load no matter how many guards mount.
- Old `verbara-auth` entries written by the current build stop holding secrets on first load after
  deploy — removing the secret going forward is not enough if yesterday's copy lingers.
- Reuse the existing refresh path; do not grow a second implementation.

**Non-Goals:**

- Changing anything in the Platform API. The refresh contract is consumed as-is.
- Moving the access token out of JavaScript memory entirely (a worker- or cookie-only bearer design).
  In-memory is the accepted resting place; only _persistence_ is in scope.
- Reworking idle-timeout, proactive refresh, or presence/heartbeat behaviour from ADR-0009.
- Making impersonation survive a reload. The specs narrow it deliberately.

## Decisions

### D1 — Restore in `AuthGuard`, backed by a module-level memoised promise

A small `session-restore` module owns `restoreSession(): Promise<boolean>`, memoised in a module
variable so concurrent callers share one in-flight promise and later callers get the settled result.
`AuthGuard` consumes it through a hook that reports `restoring | authenticated | unauthenticated`.

_Why not a root-level `<SessionBootstrap>` gating the whole router?_ It would delay the public routes
(`/login`, `/forgot-password`, `/reset-password`) behind a refresh attempt that is meaningless for
them, and it would show a skeleton to first-time visitors. `AuthGuard` is already precisely the
boundary "this content needs a session", so the restore belongs there.

_Why not a React Router loader?_ Loaders would spread the concern across every route definition and
would still need the same cross-mount deduplication. The guard is one place.

### D2 — The "is there a session to restore?" signal is the persisted `user`

With the token gone, the discriminator between _fresh browser_ and _reloaded authenticated tab_ is
`user !== null` in the rehydrated slice. No extra "was logged in" flag is introduced: `user` is
already persisted, is not a secret, and is exactly the fact in question.

`createJSONStorage(() => sessionStorage)` is a **synchronous** storage, so `persist` rehydrates during
store creation and the value is present on the first render. The design therefore does not need
`onRehydrateStorage` / `hasHydrated` gating — a point worth stating explicitly, because switching this
store to an async storage later would silently break the assumption.

### D3 — Bump the persist `version` and strip secrets in `migrate`

`partialize` only governs _writes_. A `verbara-auth` entry written by the current build still holds a
token, and on the first load after deploy `persist` would merge it back into memory and leave it on
disk until something triggers a write. Bumping `version` from `0` to `1` with a `migrate` that deletes
`accessToken`, `tokenExpiry`, `mfaPending` and `impersonation` makes the upgrade actively clean: the
stale secret is dropped on read and the rewritten entry no longer contains it.

The cost is that everyone is mid-session logged out on the deploy — except they are not: the migrated
state still names the user, so D1's restore mints a fresh token from the cookie. The upgrade is
therefore invisible.

### D4 — Keep `originalToken` in memory, drop the whole `impersonation` object from storage

`endImpersonation` keeps working unchanged _within_ a session, because `originalToken` still lives in
the in-memory state — only the persisted projection loses it.

Persisting the non-secret impersonation fields while dropping `originalToken` was considered and
rejected: it would rehydrate `active: true` with no way to return to the operator's session, which is
a worse state than not resuming impersonation at all. Since the refresh cookie belongs to the
operator's original login, a reload can only ever produce the operator's own session — the spec states
that outcome rather than pretending otherwise.

### D5 — Widen the pre-flight refresh instead of adding a second gate

`customFetch` currently pre-flights with `isTokenExpired() && accessToken`, whose `&& accessToken`
term exists to avoid refreshing for anonymous callers. That term now also excludes the legitimate
rehydrated-but-tokenless case. It becomes "refresh when we believe there is a session and we lack a
usable token" — expressed once as a store selector so `customFetch` and the metrics-aware variant
(which duplicates the condition) cannot drift apart.

### D6 — Restoring UI is a text-free skeleton

Reuse `PageSkeleton` from `src/core/ui/`. Deliberately no copy: a new string would need EN-US, ES-419
and PT-BR entries to satisfy the i18n parity CI gate, for a state that is normally visible for a few
hundred milliseconds. A `data-*` attribute (not text) marks it for end-to-end assertions, per the
locale-proof selector rule.

### D7 — End-to-end fixtures authenticate via the cookie, not via storage seeding

`createAuthenticatedPage` performs its API login on a _separate_ `APIRequestContext`, so the
`Set-Cookie` never reaches the browser context — which is why it resorted to injecting a token blob.
The fixture instead logs in through the browser context's own request so the refresh cookie lands in
the context, and seeds only the non-secret slice; the restore path then mints the token exactly as it
does for a real user.

This also settles a pre-existing defect the change forces into the open: the fixture writes the key
`asterisk-auth` while the store has persisted under `verbara-auth` since the rebrand, so the seeded
state is being ignored today. Nine test files reference the stale key.

_Alternative considered_: Playwright `storageState` captured in a global setup. Faster across a large
suite, but it snapshots cookies whose lifetime the suite would then have to manage; deferred as an
optimisation, not a prerequisite.

### D8 — Record the rule as an ADR

The durable decision — _the browser never persists bearer credentials; an authenticated session is
rehydrated from the httpOnly refresh cookie_ — outlives this change and should constrain future
stores. It is recorded as a new ADR in `docs/decisions/` (next free number: 0011), with this change as
its first application.

## Risks / Trade-offs

- **A defect in the restore path logs out every authenticated user** → every failure mode falls back
  to the current behaviour (redirect to `/login`), so the worst case is today's experience. The
  network call itself is the already-proven `refreshAccessToken`.
- **One extra round-trip before guarded content paints on reload** → covered by the skeleton, and it
  is the same round-trip already paid whenever the token had expired. Not paid on in-app navigation,
  only on a real page load.
- **Many tabs reloading at once stampede the refresh endpoint** → the existing Web Locks
  serialisation plus the `'refreshed'` broadcast already collapse this to one request per browser.
- **A user with a dead refresh cookie now waits for a failed request before reaching `/login`** →
  one request, no retry.
- **An MFA challenge no longer survives a reload** → the user restarts the login. Arguably the
  correct behaviour for a pre-authentication credential; called out because it is a visible change.
- **Rebuilding the end-to-end auth fixture touches ~9 files and can mask real regressions if it
  quietly stops authenticating** → the specs require a fixture-authenticated page to actually render
  a guarded route, so a silently unauthenticated fixture fails rather than passes.

## Migration Plan

Single deploy, no data migration, no API coordination — the endpoint it depends on already ships.

1. Land the store change (`partialize` + `version: 1` + `migrate`) together with the restore path; the
   migrate step is what makes the deploy safe for users who are mid-session, so they must not ship
   apart.
2. On first load after deploy, existing tabs read the old entry, `migrate` strips the secrets, and the
   restore mints a fresh token. No visible logout.

**Rollback**: revert the commit. The previous build reads a `version: 1` entry, finds no
`accessToken`, and treats it as signed out — users sign in again once. That is the only user-visible
cost of a rollback, and it is worth stating rather than discovering.

## Open Questions

- Should `permissions` and `features` also be dropped from persistence? They are not credentials, but
  they are the authorisation surface, and the restore already returns them from the refresh response —
  persisting them may be redundant. Kept for now to avoid a permissions-flash on reload; worth
  revisiting once the restore path is measured.
- Does the demo backend used by the end-to-end suite set the refresh cookie on the same origin
  Playwright drives? D7 assumes yes; if it does not, the fixture falls back to a UI login for the
  handful of specs that need a privileged session.
