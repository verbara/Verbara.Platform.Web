# auth-token-storage Specification

## Purpose

Governs what an authenticated session may leave behind in the browser, and how a session survives a
page reload without it. The rule is structural rather than defensive: **no credential is ever written
to browser storage** — not the access token, not the pre-authentication MFA token, not the operator's
original token during impersonation — so a script running on the origin (an XSS, a compromised
transitive dependency, an extension with page access) has nothing to read. The persisted slice is an
explicit allow-list of non-secret session facts; the credential itself is re-minted on demand from
the httpOnly refresh cookie established by ADR-0009 W1.

That trade has consequences this capability owns rather than hides: a reload spends one round-trip
behind a restoring phase before guarded content paints, an MFA challenge does not survive a reload,
and impersonation cannot resume across one (the refresh cookie belongs to the operator's original
login). It also binds the test suite — fixtures authenticate the way the application actually does,
because a seeded token blob both misrepresents the app and fails silently when the shape drifts.

Recorded as [ADR-0011](../../../docs/decisions/0011-no-persisted-bearer-credentials.md); first
applied by the archived change `stop-persisting-auth-secrets`.

## Requirements

### Requirement: Persisted session state MUST NOT contain credentials

The browser-persisted slice of `auth-store` SHALL carry only non-secret session facts. The access
token, its expiry, the pending-MFA token, and the impersonation object (which holds the operator's
original token) MUST NOT be written to `sessionStorage`, `localStorage`, IndexedDB, or any other
JavaScript-readable store.

#### Scenario: Authenticated session writes no token to storage

- **GIVEN** a user has signed in and the store holds an access token
- **WHEN** the persisted `verbara-auth` entry is read back from `sessionStorage`
- **THEN** it contains `user`, `tenantId`, `permissions`, `features`, `rememberMe` and
  `sessionIdleTimeoutMinutes`
- **AND** it contains none of `accessToken`, `tokenExpiry`, `mfaPending`, `impersonation`

#### Scenario: Pending MFA challenge is never persisted

- **GIVEN** a user has passed the first factor and the store holds `mfaPending`
- **WHEN** the persisted entry is read back
- **THEN** no MFA token appears anywhere in it

#### Scenario: Impersonation does not leak the operator token

- **GIVEN** a platform operator has started impersonating a tenant
- **WHEN** the persisted entry is read back
- **THEN** it contains no `impersonation` object and therefore no `originalToken`

### Requirement: A reload MUST restore the session from the httpOnly refresh cookie

When persisted state shows an authenticated user but no access token is held in memory, the
application SHALL attempt exactly one silent re-mint via `POST /api/v1/auth/refresh` before deciding
the user is unauthenticated. The attempt MUST run at most once per page load regardless of how many
guarded routes mount.

#### Scenario: Reload of an authenticated tab restores the session silently

- **GIVEN** a signed-in user whose refresh cookie is still valid
- **WHEN** the user reloads the page
- **THEN** a restoring indicator is shown instead of the login page
- **AND** an access token is re-minted from the refresh cookie
- **AND** the user lands on the route they reloaded, not on `/login`

#### Scenario: Expired or missing refresh cookie falls back to login

- **GIVEN** persisted state naming a user but a refresh cookie that is absent or rejected
- **WHEN** the user reloads the page
- **THEN** the restore attempt fails
- **AND** the user is redirected to `/login` with the attempted location preserved for post-login return

#### Scenario: A single restore serves concurrently mounted guards

- **GIVEN** a reload on a route whose tree mounts more than one guarded boundary
- **WHEN** the restore runs
- **THEN** exactly one `POST /api/v1/auth/refresh` request is issued

#### Scenario: No persisted user does not trigger a restore

- **GIVEN** a browser with no persisted `verbara-auth` entry
- **WHEN** a guarded route is opened
- **THEN** no refresh request is issued
- **AND** the user is redirected to `/login` immediately

### Requirement: Credential-dependent side effects MUST wait for the restore to settle

Connections and requests that carry the bearer token SHALL NOT be opened while the session is
restoring. The pre-flight refresh in `customFetch` MUST also cover the rehydrated-but-tokenless case,
so a request issued during that window does not travel unauthenticated.

#### Scenario: Realtime consumers do not connect with a null token

- **GIVEN** a reload of an authenticated agent workspace
- **WHEN** the session is still restoring
- **THEN** the SSE stream, the realtime hub, the presence heartbeat and the departure beacon have not
  been started
- **AND** they start once the restore succeeds

#### Scenario: A request during the restore window is authenticated

- **GIVEN** a rehydrated session that holds a user but no access token
- **WHEN** a request is issued through `customFetch`
- **THEN** the token is re-minted before the request is sent
- **AND** the request carries an `Authorization` header

### Requirement: Impersonation MUST NOT survive a reload

Because the refresh cookie belongs to the operator's original login, a reload SHALL return the
operator to their own session rather than resuming a privileged one. Ending impersonation in-memory
MUST NOT depend on a stored `originalToken`.

#### Scenario: Reload during impersonation returns the operator to their own session

- **GIVEN** an operator impersonating a tenant
- **WHEN** the page is reloaded
- **THEN** the restored session is the operator's own
- **AND** no impersonation banner or read-only mode is shown

#### Scenario: Ending impersonation without a stored original token

- **GIVEN** an active impersonation in memory
- **WHEN** the operator ends it
- **THEN** the operator's own session is in effect
- **AND** the store reports no active impersonation

### Requirement: End-to-end authentication fixtures MUST establish sessions the supported way

Test fixtures SHALL authenticate through a mechanism the application actually honours, rather than by
seeding a token blob into `sessionStorage`.

#### Scenario: Fixture-authenticated page reaches a guarded route

- **GIVEN** an end-to-end test using the authenticated-page fixture
- **WHEN** it navigates to a route behind `AuthGuard`
- **THEN** the route renders
- **AND** the test did not write an access token into browser storage
