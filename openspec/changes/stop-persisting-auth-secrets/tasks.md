Execution follows Subagent-Driven Development with FCM batching: **Phase A** (groups 1–2) is
foundation and ships batched; **Phase B** (groups 3–4) is the critical path and gets one focused
subagent per group; **Phase C** (groups 5–7) is integration and verification, batched.

## 1. Store: stop persisting credentials

- [x] 1.1 Add `partialize` to the `auth-store` persist config so the written slice is exactly `user`, `tenantId`, `permissions`, `features`, `rememberMe`, `sessionIdleTimeoutMinutes`
- [x] 1.2 Bump the persist `version` to `1` and add a `migrate` that deletes `accessToken`, `tokenExpiry`, `mfaPending` and `impersonation` from a v0 entry (design D3 — this is what clears secrets already on disk)
- [x] 1.3 Add a `hasSession` selector (persisted `user !== null`) as the single source of truth for "there is a session worth restoring", so the guard and the fetch pre-flight cannot drift
- [x] 1.4 Confirm `endImpersonation` still works from in-memory `originalToken` and needs no change (design D4); adjust only if 1.1 broke it

## 2. Store tests

- [x] 2.1 Extend `src/core/auth/auth-store.test.ts`: after `setAuth`, the raw `sessionStorage` entry parses to an object containing none of `accessToken`, `tokenExpiry`, `mfaPending`, `impersonation`
- [x] 2.2 Test the same for `setMfaPending` (no MFA token anywhere in the serialised entry) and for `startImpersonation` (no `originalToken`)
- [x] 2.3 Test the v0 → v1 `migrate`: seed a legacy entry containing a token, create the store, assert the token is gone from both memory-after-hydrate and the rewritten entry, and that `user` survives
- [x] 2.4 Test that `endImpersonation` restores the operator's token within a single session

## 3. Session restore module

- [x] 3.1 Create the `session-restore` module exposing `restoreSession(): Promise<boolean>`, memoised in a module variable so concurrent callers share one in-flight promise and later callers get the settled result (design D1)
- [x] 3.2 Have it delegate to the existing `refreshAccessToken` — no second refresh implementation, so the per-tab `_refreshPromise` dedupe and the cross-tab Web Locks serialisation keep applying
- [x] 3.3 Return `false` without issuing any request when `hasSession` is false, so a fresh browser never pays a round-trip
- [x] 3.4 Unit-test: concurrent callers produce exactly one refresh call; a failed refresh resolves `false` and does not poison later calls within the page load

## 4. AuthGuard restoring phase

- [x] 4.1 Add a hook reporting `restoring | authenticated | unauthenticated`, driven by the token state plus `restoreSession()`
- [x] 4.2 Render `PageSkeleton` while restoring, carrying a `data-*` attribute for E2E and no text at all (design D6 — avoids new i18n keys and keeps the parity gate untouched)
- [x] 4.3 Preserve the existing redirect on failure, including `state={{ from: location }}` so post-login return still works
- [x] 4.4 Unit-test the three phases, including that mounting several guards concurrently issues one refresh

## 5. Consumers that must wait for the token

- [x] 5.1 Widen the pre-flight refresh in `customFetch` to cover the rehydrated-but-tokenless case, expressed once via the 1.3 selector and applied to BOTH the main function and the metrics-aware variant that duplicates the condition (design D5)
- [x] 5.2 Gate the SSE hook, the realtime hub, the presence heartbeat and the departure beacon so none opens a connection while restoring, and all start once it succeeds
- [x] 5.3 Verify `mfa-verify` and `login-page` behave sanely now that `mfaPending` is memory-only — a reload mid-challenge returns to the login step rather than a broken screen

## 6. End-to-end fixture rebuild

- [x] 6.1 Rework `createAuthenticatedPage` to log in through the browser context so the httpOnly refresh cookie lands in that context, seeding only the non-secret slice and letting the restore mint the token (design D7)
- [x] 6.2 Remove the stale `asterisk-auth` key across the ~9 test files that still write or read it; nothing should seed a token under any key
- [x] 6.3 Add an E2E spec asserting a fixture-authenticated page renders a guarded route, so a silently unauthenticated fixture fails instead of passing
- [x] 6.4 Add an E2E spec for reload-restores-session using `data-*` selectors, with no `waitForTimeout` or wall-clock waits — assert via `expect(...)` polling and `waitForResponse` on the refresh call, respecting the suite posture (workers:1, retries:1)
- [x] 6.5 Add an E2E spec asserting `sessionStorage` holds no token after login — the regression fence for this whole change

## 7. Verification and record

- [x] 7.1 `npm run build` clean (type-check + bundle)
- [x] 7.2 `npx vitest run` green
- [x] 7.3 i18n parity green (`npm run lint` includes the `i18n:check` gate) — expected trivially, since the design adds no strings
- [x] 7.4 `npx playwright test` green, with attention to the specs touched in group 6 — **320 passed · 16 skipped · 0 failed** against the containerised lab stack. Getting there needed six specs fixed, and only two of the six were about this change:
  - `customer-suspend-confirm` / `partner-dunning-toggle` — **caused by this change.** Both inject a permission into `sessionStorage`, which the restore refresh then overwrites (`client.ts` prefers a non-empty server-side set). New `grantPermissions` helper patches the `/auth/refresh` response as well as storage. Dunning also had a second, older defect: its pause/resume mock answered `200` with an empty body, which `customFetch` cannot parse (it only short-circuits on `204`), so the mutation rejected and the query was never invalidated — the real endpoints return `Ok<DunningRecordDto>`.
  - `impersonation-lifecycle` — **caused by this change.** Its skip-gate read `page.url()` immediately after `goto()`, but `PermissionGuard` redirects client-side and only once the restore resolves the permission set, so the skip never fired. Now gated on rendered state, with a new `data-testid="unauthorized-page"` so the check is locale-proof. Skips cleanly: the platform admin genuinely lacks `platform:tenant:impersonate`.
  - `flows` ×2 and `skills` delete — **pre-existing Platform bugs, unrelated to this change**, fixed in `Verbara.Platform` (`fix/flows-list-aot-and-audit-jsonb`): `GET /admin/flows` returned 500 in every AOT image (`IReadOnlyList<FlowDefinition>` unregistered in `ApiJsonContext`) and `DELETE /admin/skills/{name}` deleted the skill then answered 500 (a bare identifier reaching a `::jsonb` cast in the audit store). The flows specs additionally filter by `data-table-search` now — flows have no delete endpoint, so the demo tenant accumulates rows and the list has no `ORDER BY`. **These specs stay red until a Platform image carrying those fixes is deployed.**
- [x] 7.5 Manually verify the deploy path from design D3: load the app on the current build to write a v0 entry with a token, then load the new build and confirm the token is gone from storage and the session did not drop
- [x] 7.6 Write ADR-0011 in `docs/decisions/` recording the durable rule — the browser never persists bearer credentials; sessions rehydrate from the httpOnly refresh cookie — citing this change as its first application (design D8)
- [x] 7.7 `openspec validate --all --strict` before opening the PR
