# ADR-0011 — The browser never persists bearer credentials

**Status:** Accepted
**Date:** 2026-07-29
**Relates to:** [ADR-0009](0009-agent-presence-session-work-continuity.md) (W1 established the
httpOnly refresh cookie this decision depends on)
**First application:** openspec change `stop-persisting-auth-secrets`

## Context

`auth-store` persisted its entire state into `sessionStorage` under `verbara-auth` — the store was
wrapped in Zustand's `persist` with **no `partialize`**, so every field was written, credentials
included:

| Field                         | What it is                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| `accessToken`                 | the bearer JWT sent on every request                                                       |
| `tokenExpiry`                 | its expiry                                                                                 |
| `mfaPending.mfaToken`         | a **pre-authentication** credential — it stands in for the first factor                    |
| `impersonation.originalToken` | the platform operator's own token, strictly more privileged than the impersonated tenant's |

Anything in `sessionStorage` is readable by any script running on the origin: an XSS, a compromised
transitive dependency, a browser extension with page access. It is also plainly visible in DevTools.

The decisive point is that persisting them bought nothing that was not already available. Since
ADR-0009 W1 the refresh token lives in an **httpOnly** cookie scoped to `/api/v1/auth`, which
JavaScript cannot read, and `refreshAccessToken` already exchanges it for a fresh access token —
deduplicated per tab and serialised across tabs via the Web Locks API. Persisting the access token
therefore duplicated a secret into a readable location to buy exactly one thing: surviving a page
reload. The cookie does that better, and without the exposure.

## Decision

**No credential is ever written to browser storage.** Concretely, and binding on future work:

1. The persisted slice of any auth-bearing store is an explicit allow-list of **non-secret** session
   facts (identity, tenant, permissions, features, preferences). Tokens, pre-auth challenges and
   impersonation credentials stay in memory only.
2. A reload restores the session by re-minting from the httpOnly refresh cookie, not by reading a
   stored token. Guarded routes hold a `restoring` phase while that happens, and fall through to
   `/login` only when the refresh genuinely fails.
3. Changing what a store persists is a **versioned migration**, not just a `partialize`. `partialize`
   governs writes only; an entry written by a previous build must be actively stripped on read, or
   yesterday's secret survives on disk until something happens to trigger a write.
4. Test fixtures authenticate through a mechanism the application honours. Seeding a token blob into
   storage is forbidden — it does not reflect how the app works and, when the shape or key drifts,
   it fails silently.

## Consequences

**Accepted costs.**

- A reload pays one network round-trip before guarded content paints, covered by a skeleton. It is
  the same round-trip already paid whenever the token had expired, and it is not paid on in-app
  navigation.
- **Impersonation does not survive a reload.** The refresh cookie belongs to the operator's original
  login, so a reload can only ever produce the operator's own session. Persisting the non-secret
  impersonation fields was rejected: it would rehydrate `active: true` with no way back to the
  operator's session, which is a worse state than not resuming at all.
- An MFA challenge does not survive a reload; the user restarts the login. Correct for a pre-auth
  credential.

**Gained.**

- The exposure window for a stolen access token collapses from "as long as the tab lives" to "as long
  as the page's JS heap lives", and the operator token and MFA token leave storage entirely.
- A latent inconsistency disappears: previously, a refresh fired while impersonating already swapped
  in the operator's token while the store still reported `impersonation.active` — the UI claimed a
  read-only impersonated session while the user actually held full operator permissions.

**Explicitly out of scope.** Moving the access token out of the JS heap altogether (a worker-held or
cookie-only bearer design). In-memory is the accepted resting place; this ADR governs _persistence_.

## Alternatives considered

- **Encrypt the token before persisting it.** The key would have to live where the same script can
  read it. Obfuscation, not protection.
- **Move it to `localStorage` with a short TTL.** Strictly worse — same readability, wider scope.
- **Keep persisting and rely on CSP to prevent XSS.** Defence in depth argues for both; a CSP is a
  control that can regress silently, whereas not storing the secret is structural.

## Addendum — 2026-08-09 · follow-ups harvested at archive time

Recorded here, per the archive-on-merge closing routine, so that neither item survives only in the
archived change's prose. Neither blocks anything shipped.

1. **`storageState` for the end-to-end suite (deferred optimisation, design D7).** The rebuilt
   `createAuthenticatedPage` logs in through the browser context on every worker. Playwright's
   `storageState`, captured once in a global setup, would be faster across a large suite, but it
   snapshots cookies whose lifetime the suite then has to manage — including the refresh cookie's
   rotation grace. Deferred deliberately: it is an optimisation, and it trades a fixture that
   exercises the real login for one that replays a frozen one. Revisit only if fixture login becomes
   a measured bottleneck.

2. **The Web and the API gate the same two surfaces on different permission vocabularies.** This
   change moved the audit and impersonation route guards onto the canonical
   `domain:resource:action` keys (`system:audit:view`, `platform:tenant:impersonate`), while
   `Verbara.Platform`'s `Program.cs` still gates the matching endpoints on the dot-notation aliases
   `audit.read` and `security.impersonation.manage`. **This is not simply Platform-side debt to
   retire** — as the change's own commit message framed it. Those aliases are the second lock of the
   deliberate `PlatformAdminRequirement` double-lock (host/partner-tenant gate **plus** a seeded
   dot-notation permission), a pattern Platform documents in its own ADR-0019 and applies uniformly
   across the `/management/*` admin surfaces. Retiring them there would unpick that decision, not
   pay down debt.

   What is genuinely fragile is the **coupling neither side states**: the two vocabularies only stay
   interchangeable because the R5.2 P0.9 seeder grants both spellings to the same role template. If
   a future seeder change drops one spelling, the Web lets a user through to a screen whose API
   calls answer 403 — a silent, confusing failure rather than a clean "unauthorized". Any work that
   touches either the seeder or `PlatformAdminRequirement` should make the mapping explicit
   (canonical key ↔ alias) rather than leaving it as a coincidence two repos rely on.

For the record, a third item found during this work needed no follow-up: `POST /api/v1/auth/refresh`
serialising an unresolvable RBAC lookup as `[]` — indistinguishable from "genuinely no permissions" —
was fixed at the source by Platform `#213` (role-default permission fallback on refresh, with tests,
both in `main`). The Web's defensive "keep the current set when the server returns an empty array"
stays as belt-and-braces.
