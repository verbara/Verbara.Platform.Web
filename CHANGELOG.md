# Changelog

All notable changes to **Verbara.Platform.Web** are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) ·
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Security

- **The browser no longer persists bearer credentials (`#247`; `Verbara.Platform.Web/ADR-0011`,
  openspec `stop-persisting-auth-secrets`).** `auth-store` wrapped its whole state in Zustand's
  `persist` with no `partialize`, so every field reached `sessionStorage` under `verbara-auth` in
  the clear: the **access token**, its expiry, the pre-authentication **`mfaPending.mfaToken`**
  (a credential that bypasses the first factor), and, while impersonating, the operator's own
  **`impersonation.originalToken`** — strictly more valuable than the impersonated tenant's. Any
  script on the origin (an XSS, a compromised dependency, an extension with page access) could
  read them. The persisted slice is now exactly the non-secret session facts — `user`, `tenantId`,
  `permissions`, `features`, `rememberMe`, `sessionIdleTimeoutMinutes` — and the credential is
  **rehydrated instead of stored**, from the httpOnly refresh cookie that has existed since
  ADR-0009 W1 (**Platform ≥ 2.9.0**, so no new floor).
  - **`restoring` phase in `AuthGuard`.** On a reload the store rehydrates with a user but no
    token; rather than bouncing to `/login`, the guard re-mints an access token exactly once per
    page load, rendering `PageSkeleton` meanwhile (carrying a `data-*` attribute and **no text**,
    so no new i18n keys and the parity gate is untouched) and falling back to `/login` — with
    `state={{ from: location }}` preserved — only when the refresh genuinely fails.
  - **One in-flight refresh, shared.** The new `session-restore` module memoises a single promise
    per page load and delegates to the existing `refreshAccessToken`, so the per-tab dedupe and
    the cross-tab Web Locks serialisation keep applying; mounting several guards concurrently
    still issues one request. A `hasSession` selector is the single source of truth for "there is
    a session worth restoring", shared by the guard and `customFetch`'s pre-flight (widened to
    cover the rehydrated-but-tokenless case in **both** the main function and the metrics-aware
    variant), so the two cannot drift. A fresh browser issues no request at all.
  - **Secrets already on disk are erased.** The persist `version` moves to `1` with a `migrate`
    that strips the four fields from any v0 entry. The cleanup happens the first time a user loads
    the new build, **without dropping the session** (verified by hand against a v0 entry).
  - **Two behaviour changes, both deliberate.** Impersonation no longer survives a reload — the
    refresh cookie belongs to the original login, so a refresh already swapped the operator's
    token back in while the store still reported `impersonation.active`; it is now honest instead
    of inconsistent. Within a session `endImpersonation` is unaffected. A reload **mid-MFA
    challenge** now returns to the login step rather than a broken screen.
  - **Rollback impact.** Reverting to a build older than this one forces every open session to log
    in again: the old `AuthGuard` expects a token in storage, finds none, and redirects. No data
    loss, and rolling forward again is clean.
  - Fixes a latent defect the work surfaced: `refreshAccessToken` **keeps the current permission
    set when the server returns `[]`**. `/auth/refresh` serialises an unresolvable RBAC lookup as
    an empty array, indistinguishable from "genuinely none", and overwriting stripped the very set
    the route guards depend on.
  - **E2E fixture rebuilt around the cookie.** `createAuthenticatedPage` now logs in through the
    browser context so the httpOnly cookie lands there, seeding only the non-secret slice; the
    stale `asterisk-auth` key is gone from the ~9 specs that still wrote or read it. Three new
    specs fence the behaviour: a fixture-authenticated page renders a guarded route (so a silently
    unauthenticated fixture fails instead of passing), a reload restores the session, and
    **`sessionStorage` holds no token after login** — the regression fence for the whole change.

### Fixed

- **Audit and impersonation routes gate on the canonical permission keys (`#247`).** Both guards
  required the dot-notation strings seeded in R5.2 P0.9 (`audit.read`,
  `security.impersonation.manage`) rather than the `domain:resource:action` vocabulary the rest of
  the app speaks. The seeder grants both spellings to the same role template, so the guards move
  to `system:audit:view` and `platform:tenant:impersonate`, retiring the app's last two callers of
  the legacy aliases. The API still gates the matching endpoints on the aliases
  (`PlatformAdminRequirement` in Platform's `Program.cs`) — retiring them there is a Platform-side
  follow-up.
- **Muted text now meets WCAG AA, and icon-only rail controls have accessible names (`#247`).**
  The axe-core baseline had only ever scanned unauthenticated screens: its fixture seeded a token
  under a key the store stopped reading at the rebrand, so every page it asserted on as
  "authenticated" was really the login page. Repairing it pointed the scan at the real shell and
  surfaced a backlog of genuine violations — `text-slate-400` on white fails at 2.8:1 and moves to
  `text-slate-500` (4.6:1) across 36 surfaces; the two link-style buttons using `text-brand` (3.4:1)
  move to `text-brand-dark`; the rail's icon-only search trigger and nav links had no accessible
  name (a tooltip is not one) and now reuse their already-translated label, so the i18n parity gate
  is untouched. Dark-mode variants already passed and are unchanged.
- **The webchat embed page is emitted at the outDir root with prefixed asset URLs (`#247`).**
  `vite.webchat-embed.config.ts` set no `root`, so Rollup kept the entry's source path in the
  output and the page landed at `public/webchat/embed/src/webchat/embed/index.html` — while the
  widget's public contract and `nginx.conf`'s `try_files $uri /webchat/embed/index.html` both
  expect it at the root. Setting `root` alone then emitted assets as `/assets/…`, which 404 against
  the host app's own asset folder, so `base` is pinned to `/webchat/embed/`. The embed's loading
  shell also gained a testid marking the point where the React app has registered its `postMessage`
  listener — `#root` being attached does not imply that, and `postMessage` has no buffering, so a
  spec's config could be dropped silently.

### Changed — CI

- **`release.yml` now creates the GitHub Release object itself.** The workflow built and
  cosign-signed the multi-arch image on every `v*` tag but never created the Release, so each
  version reopened the gap — 22 Release objects over 52 tags as of 2026-07-28, with
  `v3.14.0-web` / `v3.15.0-web` / `v3.16.0-web` backfilled by hand. The new final step runs
  **after** `cosign sign` + `cosign verify`, so a Release object can never exist for an image
  whose signature did not verify; it is **idempotent** (an existing themed Release created by
  `/xr:release` §H is left untouched); its body is this repo's own `CHANGELOG.md` section for the
  version, plus the signed digest and the customer verify command; and it claims the `Latest`
  badge **only when the tag is the highest version**, so a hotfix cut on an older line (as
  `v3.13.1-web` was) cannot steal it from a newer minor. Workflow `permissions` widened
  `contents: read` → `write` for this. Platform's `release.yml` and Sdk's `publish.yml` still do
  not create Releases — for those, `/xr:release` §H creates them by hand.
- **Line-coverage floor ratcheted `38` → `41` after the tests above (`#247`).** The band is
  two-sided on purpose: adding tests without raising the floor leaves a stale number that would let
  a later regression slip back under it unnoticed, so the gate fails on the ceiling too and prints
  the remedy. Measured 41.07% in CI (41.05% locally), so `floor(measured)` = 41. `branch` is a
  one-sided lower bound and stays at `28`.

## [3.18.0-web] - 2026-07-27

**Platform floor: ≥ 2.22.0.** This release's `pendingPauseTimeoutMinutes` editor reads and writes a
field that Platform first exposes in `v2.22.0` (cut in the same release train). Against an older
Platform the `GET` omits the field, so the control falls back to its hard-coded `30`
(`value={form.pendingPauseTimeoutMinutes ?? 30}` in `auth-config-page.tsx`) — it displays a
plausible number that is **not** the tenant's configured value — and a `PUT` carrying the field is
silently ignored by the older server. Degraded and misleading, not fatal. The other new surface,
force-offline, has been live since Platform **2.9.0**.

### Added

- **Agent-presence admin surfaces — ADR-0009 Grupo A W3/W4 UI (`#229`; `Verbara.Platform.Web/ADR-0009`).**
  Closes the two admin-facing affordances deferred when ADR-0009's backend shipped. **The two carry
  different Platform floors** — force-offline consumes an endpoint live since
  **Platform 2.9.0**, while the `pendingPauseTimeoutMinutes` editor requires
  **Platform ≥ 2.22.0**: `TenantAuthConfigResponse` did not carry that field at `v2.21.2`; Platform
  `#198` adds it, and it ships in the same train as this version.
  - **Force-offline button** on the admin agent-detail view (`src/admin/agents/agent-detail.tsx`).
    A destructive, `users:user:edit`-gated action reusing `confirm-delete-dialog.tsx` with
    `confirmationWord="FORCE"` plus a `revokeSessions` toggle (default off). Backed by a net-new
    `useForceOffline` mutation hook (`POST /api/v1/admin/agents/{id}/force-offline`, body
    `{ revokeSessions }`) that invalidates `['agents']` + `['agents', id]` and toasts. The
    operations agent-states stub stays a stub — this is the real admin surface.
  - **`pendingPauseTimeoutMinutes` editor** on the system auth-config page
    (`src/admin/system/auth-config-page.tsx`), mirroring the `sessionIdleTimeoutMinutes` control
    (`min={0}`, where `0` disables the deferred-pause force-apply per tenant). Backed by extending
    the hand-written `AuthConfig` type + `useAuthConfig`/`useUpdateAuthConfig`
    (`GET`/`PUT /api/v1/admin/auth/config`, partial PUT).
  - New i18n keys added across all three locales (`en-US`, `es-419`, `pt-BR`) so
    `scripts/i18n-parity-check.mjs` stays green. Unit tests for both hooks and a `data-testid`-only
    Playwright E2E cover both surfaces. All three consumed wire shapes are pinned to committed
    golden fixtures.

### Changed

- **ci: docs/data-only CI fast-path (gate job, ADR-0016) (`#231`).** `ci.yml` gains a lightweight
  `gate` job that classifies the PR/`merge_group` diff against the event-specific base
  (`scripts/ci/classify-docs-only.sh`, fail-closed strict allowlist: `docs/**`, `openspec/**`,
  `CHANGELOG.md`, top-level `*.md`, `**/README.md`). The six heavy required jobs (`build`, `test`,
  `coverage`, `i18n`, `lint`, `audit`) take `needs: gate` + a fail-closed `if:` guard and report
  `skipped` (which satisfies the required check) on a docs-only diff; `openspec` stays always-run
  with no gate edge. Additive §2 optimization: `codeql.yml` gains a `paths-ignore` (non-required,
  no `merge_group`) and the non-blocking Lighthouse workflow drops its `synchronize` trigger. The
  classifier ships with bash unit tests in the `Coverage Script Tests` job. No ruleset change. The
  **ADR-0016 §6 canary passed on 2026-07-27 in both phases**: `#242` (a throwaway docs-only PR,
  closed unmerged) exercised `pull_request` and `#243` exercised `merge_group`, each with `gate`
  green and `build`/`test`/`coverage`/`i18n`/`lint`/`audit` reporting `skipped` while still
  satisfying their required contexts. The fast path is validated and in effect
  (verbara-meta/ADR-0016).

### Security

- **`@hono/node-server` forced to the patched 2.x via `overrides` — GHSA-frvp-7c67-39w9 (`#244`).**
  Path traversal in `serve-static` through an encoded backslash (`%5C`). **MEDIUM, CVSS 5.9, and
  development-scope only** — the package is reachable exclusively through the `shadcn` CLI
  (a `devDependencies` entry since v3.17.0-web) → `@modelcontextprotocol/sdk` →
  `@hono/node-server`, so `npm ls --omit=dev @hono/node-server` is empty and it **never reaches the
  shipped bundle**; the exploit is additionally Windows-only and the hono server is never run in
  this repo. The installed `@modelcontextprotocol/sdk@1.29.0` declares `@hono/node-server: ^1.19.9`,
  which cannot reach the patched 2.x, so an `overrides` entry (`"@hono/node-server": "^2.0.5"`)
  forces it — resolving 1.19.14 → 2.0.12. Upstream has since caught up:
  `@modelcontextprotocol/sdk@1.30.0` (published 2026-07-27) widens the range to
  `^1.19.9 || ^2.0.5`, so the override becomes redundant once the lockfile picks that up and can be
  dropped then. Dependabot alert `#11` was already in state `fixed` before
  this release was cut, and the repo carries **zero open Dependabot alerts**. Recorded for
  completeness; **this is not an emergency and did not expedite the release.**

### Housekeeping

- **Routine dependency bumps (`#232`–`#240`)** — runtime: `react` + `react-dom` 19.2.8,
  `@tanstack/react-query` 5.101.4 + `@tanstack/react-virtual` 3.14.8, `react-i18next` 17.0.11,
  `react-is` 19.2.8, `@fontsource-variable/geist` 5.3.0; dev/tooling: `@vitejs/plugin-react` 6.0.4,
  `prettier` 3.9.6, `shadcn` 4.14.1; CI actions: `docker/login-action` 4 → 4.4.0 (`#238`) — note
  this one lives in `release.yml`, so this release is its first real execution. All are patch/minor,
  no behavior change.
- **OpenSpec housekeeping** — archived `surface-agent-presence-admin-controls` (`#230`). Grupo B
  (offline deferred sign-off + a dedicated `agent.pending_state_changed` push) stays deferred per
  ADR-0009 — no new open change.
- **Fast-path operator doc (`#243`)** — `docs/ci-docs-fast-path.md` records the ADR-0016 classifier
  allowlist and what a docs-only PR looks like in CI. This PR doubled as the §6 `merge_group` canary
  noted above.
- **ADR-0009 status markers refreshed** — the two W3.x/W4.x entries that `#229` actually built
  (admin force-offline UI, `PendingPauseTimeoutMinutes` editor) no longer read "deferred", so the
  `decision_ref` in these notes resolves to a document that agrees with them.

## [3.17.0-web] - 2026-07-25

### Security

- **`react-router-dom@7` → `react-router@8.3.0` — remediate the RSC-mode CSRF advisory
  GHSA-qwww-vcr4-c8h2 (`#223`; Platform/ADR-0010).** v8 consolidates the packages (every symbol
  imports from `react-router`, only `RouterProvider` from `react-router/dom`): 82 import rewrites + 7
  `vi.mock` specifier updates. This SPA is data-mode with zero route actions/loaders, so the advisory
  was not exploitable here, but `react-router` is a production dependency, so it gets a real version
  fix, not an allowlist. `shadcn` (a CLI scaffolding tool, zero `src/` imports) moved from
  `dependencies` → `devDependencies` where it belongs. The required `audit` merge-queue gate is scoped
  to production dependencies — clearing the **7 HIGH** advisories (2 production, remediated on merits;
  5 build/dev-only — `brace-expansion`/`minimatch` ReDoS et al., never shipped) that had frozen the
  queue for all Web PRs. **Compile-time only for the app — no runtime behavior change** beyond the
  react-router import surface.

### Changed

- **OpenAPI numeric wire-union extinct at the source — Analytics migration completed + coercion
  class retired (`openapi-numeric-schema-truth` #222; Platform/ADR-0036).** Regenerated
  `src/core/api/generated/openapi.d.ts` from Platform's corrected OpenAPI document: the spurious
  .NET 10 `number | string` AOT wire-union (543 occurrences, root cause dotnet/aspnetcore #64145) is
  now stripped upstream by an `IOpenApiSchemaTransformer`, so every numeric body/response field
  collapses to single-typed `number` / `number | null`. This unblocks and **completes the held
  Analytics typed-client migration** (`openapi-typed-client-analytics`): the now-cleanly-matching
  shapes in `use-analytics.ts`, `use-surveys.ts`, `use-recording.ts`, and `use-csat.ts` adopt
  `components['schemas'][...]` behind `client.ts`'s generic `<T>`, and **retires the whole `Number()`
  coercion class** (~30 wire-boundary sites across `use-billing.ts`, `use-partner.ts`,
  `use-queue-metrics.ts`, `use-analytics.ts`, `use-teams.ts`, `use-notifications.ts`,
  `use-supervisor.ts`, `use-typification-llm.ts`) that only existed to strip the never-arriving
  `string` arm. Structural-divergence shapes stay hand-written and are logged as separate Platform
  contract bugs (`TopicTrendsResponse` `topics`→`trends` rename, `ComplianceRuleSummaryDto.severity`
  literal-union widening, the `PagedResult` envelope). Adoption ratchet floor 39 → 37
  (`use-recording` + `use-surveys` adopted). **Compile-time only — no runtime behavior change**
  (Platform's transformer is document-only; the serializer stays lenient).
- **Residual contract-shape shadows retired — TopicTrends + compliance severity adopt the generated
  types (`openapi-residual-contract-shapes` #226; Platform/ADR-0036).** Consumer-side follow-up to the
  migration above: Platform's host change corrects two of the three logged structural divergences at
  the source, so the stale hand-written shadows in `use-analytics.ts` are dropped and repointed to
  `components['schemas'][...]` behind `client.ts`'s generic `<T>`. **`TopicTrendsResponse`** adopts
  the generated `{ trends, totalAnalyzed }` (the `topics`→`trends` rename; `from`/`to` gone) and the
  consumer `speech-analytics-page.tsx` reads `data?.trends` instead of `data?.topics`.
  **`ComplianceRuleSummaryDto` / `ComplianceSummaryResponse`** adopt the generated types now that
  Platform narrows `severity` back from bare `string` to the `Info | Warning | Critical` literal
  union, so the severity display/filter/sort drives off the generated union. The `PagedResult`
  envelope stays hand-written by design (its `PagedResultOf<T>` monomorphization already matches; the
  `AuditEventsPagedResult` retirement is a separate future migration). Adoption ratchet floor
  **unchanged at 37** (`use-analytics.ts` already adopts `components`). **Compile-time only — no
  runtime behavior change** (same resolved field values under generated type names).

## [3.16.0-web] - 2026-07-24

Maintenance + internal-quality release — **no user-facing feature or behavior changes.**
Advances the OpenAPI typed-client migration (Operations + Agent modules), clears the npm
audit gate (one HIGH), and stands up the ADR-0012 Ola-2 / ADR-0013 CI invariant-gate suite.

### Changed

- **OpenAPI typed-client migration — Operations + Agent modules (`openapi-typed-client-operations`
  #215, `openapi-typed-client-agent` #219; Platform/ADR-0035).** Two more per-module children of the
  swap-the-T trilogy land on the generated `src/core/api/generated/openapi.d.ts`: the 3 Operations
  REST hooks (`use-cluster.ts`, `use-queue-metrics.ts`, `use-supervisor.ts` — 14 hand-written
  declarations) and the 8 Agent-module hook files (22 declarations) now consume
  `components['schemas'][...]` behind `client.ts`'s generic `<T>`, so contract drift against Platform
  is caught at `tsc -b` instead of at runtime (the csat-runner / v3.13.1-web failure class).
  Compile-time only — no runtime behavior change; `number | string` AOT wire-unions normalized at the
  hook boundary. The 3 Operations `*-state-stream.ts` hub-event hooks stay hand-written (SignalR
  payloads have no REST path — ADR-0020 deferred follow-up, owner Pro). The **Analytics** child
  (`openapi-typed-client-analytics`) remains open and ships in a later release.
- **Domain isolation + component-size caps (ADR-0012 Ola 2, #210).** Removes 14 cross-domain imports
  that had let the admin / agent / analytics / operations modules reach into each other: 4 shared UI
  primitives relocated to their true home `@/core/ui` and `agent-ai-store` to `@/core/stores` (~90
  importers rewritten — relocation, not an eslint-disable allowlist). Compile-time refactor; no
  runtime behavior change.

### Security

- **`fast-uri` HIGH advisory remediated (#216).** `npm audit fix` bumps transitive `fast-uri`
  3.1.3 → 3.1.4 (lockfile-only, non-breaking), clearing the host-confusion HIGH
  (GHSA-v2hh-gcrm-f6hx / GHSA-4c8g-83qw-93j6) that had turned the blocking
  `npm audit --audit-level=high` CI gate red repo-wide.
- **Four npm audit advisories cleared (#212).** `js-yaml` HIGH (GHSA-52cp-r559-cp3m, YAML merge-key
  quadratic CPU — forced to patched 4.x via an `overrides` past redocly's exact pin),
  `brace-expansion` HIGH (GHSA-3jxr-9vmj-r5cp, DoS), and `body-parser` LOW, all in dev/tooling-
  transitive deps. `npm audit` now reports 0 vulnerabilities; no runtime dependency touched.

### Added

- **CI invariant-gate suite — ADR-0012 Ola 2 + ADR-0013 (#199, #209, #210).** New PR-blocking gates,
  all wired into existing required jobs (no ruleset change): **coverage gate v2** (patch-coverage +
  two-sided band + exclusion baseline, byte-identical to the Sdk reference; verbara-meta/ADR-0013),
  **bundle-size budget** (`size-limit`, brotli app-JS frozen at 1.45 MB, ratchet-down; Gate #10),
  **generated-types adoption ratchet** (every `src/core/api/hooks` file must import the generated
  module; 45-hook frozen shrinking baseline; Gate #5), **domain-isolation** `no-restricted-imports`
  (Gate #4) and a **`max-lines: 1250`** component cap (Gate #9b).

### Fixed

- **Patch-coverage liveness self-test over-fired on non-executable diffs (#213, ADR-0013).** The
  liveness guard now trips only when a diff adds a plausibly-executable line in a non-test file under
  a coverage-instrumented root — so import-path refactors, pure renames, comment/type-only edits, and
  config-only changes correctly measure 0 and pass as n/a, while a genuinely mis-wired report still
  fails loud. Byte-identical to the Sdk/Pro/Platform coverage-gate-v2 parity roll.

### Housekeeping

- **Architecture charter docs (#214)** — `architecture.md` + `gates.yaml` (ADR-0014 §1 charter + §2
  gate manifest).
- **Dependabot CI-load reduction (#200)** (R-010) and routine dependency bumps — runtime:
  `wavesurfer.js` 7.12.11, `libphonenumber-js` 1.13.9; dev/tooling: `prettier` 3.9.5, `@types/node`,
  `@sentry/vite-plugin`, `allure-playwright`, `@axe-core/playwright`, `actions/setup-python`.
- **OpenSpec housekeeping** — archived `openapi-typed-client-operations` (#218) and
  `openapi-typed-client-agent` (#220).

## [3.15.0-web] - 2026-07-20

### Changed

- **Admin-remainder API hooks bind to Platform's named response schemas (`openapi-response-adoption`,
  Platform/ADR-0035).** Regenerates `src/core/api/generated/openapi.d.ts` from the Platform
  `openapi-response-schemas` document (183 → 391 named schemas) and migrates the admin-remainder
  hooks — `use-users`, `use-queues`, `use-teams`, `use-agents` (+ `use-agent-memberships`),
  `use-api-keys`, `use-tenants`, `use-system`, `use-billing`, `use-partner`, `use-webhooks`,
  `use-impersonation`, `use-typification-llm` — from hand-written response interfaces to the
  generated `components['schemas'][...]` types via swap-the-T, so contract drift against Platform is
  now caught at `tsc -b`. Client-only display fields the DTOs don't emit are preserved via
  intersections; `EntityId` (`unknown`) and AOT `number | string` wire-unions are normalized at the
  hook/render boundary. Compile-time only — no user-facing behavior change (1456 unit tests green).
  The three HELD trilogy children (`openapi-typed-client-agent`/`-analytics`/`-operations`) un-gate
  on this thread but run as their own backlog items. (#183)
- **Admin-module hooks migrated to generated OpenAPI request/value types (`openapi-typed-client-admin`, Platform/ADR-0035).** Migrates the Admin-module API hooks onto `src/core/api/generated/openapi.d.ts` via swap-the-T. Honest outcome: of 44 Admin files / 199 hand-written declarations reviewed, **6 were genuine non-breaking migrations** and 38 were audited and kept hand-written (annotated) — the generated document is overwhelmingly request-body schemas (134 `*Request`/`*Body`) plus a few nested `*Dto` value objects, with almost no top-level response DTOs. Compile-time only. (#181)

## [3.14.0-web] - 2026-07-14

### Added

- **Scope-wide CSAT KPI card + realtime refresh (`csat-completion`, Platform/ADR-0020)** — the
  supervisor wallboard CSAT card now reads the NEW scope-wide aggregate endpoint
  `GET /api/v1/analytics/csat` (envelope roll-up: `totalResponses` / `averageRating` /
  `rangeStart` / `rangeEnd`, with `queues[]` rows) instead of the first sorted queue's per-queue
  read — fulfilling the `csat-operator-views` promise ("the queues in the supervisor's scope") and
  resolving ADR-0020's wallboard-card scope question in favor of aggregation. New
  `useCsatAggregateAnalytics` hook in `use-analytics.ts` (keyed `['analytics','csat','aggregate']`)
  mirrors `useCsatQueueAnalytics`' `number | string` AOT-union `select` normalization — the second
  concrete call site of the pattern `openapi-typed-client-phase2` tracks (interim wire type declared
  1:1 to the golden fixture until Platform ships the endpoint and `openapi.d.ts` is regenerated,
  API-first). Realtime: the typed `OnCsatResponseRecorded` SignalR push (payload `tenantId`,
  `responseId`, `surveyId`, `conversationId`, `channel`, `queueName`, `rating`, `comment` nullable,
  `capturedAt`) now invalidates the aggregate query so the score refreshes on push, not only on the
  poll — pure enrichment (poll stays authoritative if realtime is down); a `null` `comment` (voice
  DTMF) does not suppress the refresh. `CsatKpiCard` drops its `queueId` prop; new `csat.scope` i18n
  key added across EN-US / ES-419 / PT-BR. The shared TanStack `queryClient` singleton moved to
  `src/core/api/query-client.ts` so the realtime hub can invalidate it from outside React.
- **Generated Platform API types (`openapi-typed-client`, Platform/ADR-0035)** (#161).
  `openapi-typescript` codegen (`npm run generate:api-types`) produces the committed
  `src/core/api/generated/openapi.d.ts` (324 paths, 182 schemas) from Platform's CI-exported
  OpenAPI document (`openapi-document-<sha>` artifact). First migrated slice: the CSAT analytics
  hook (`use-analytics.ts`) — its response types now come from the generated file instead of
  hand-written interfaces, eliminating at the source the drift class that caused v3.13.1-web
  (AOT numeric `number | string` unions normalized once at the hook boundary via `select`).
  Realtime SignalR payloads (`src/core/realtime/`) stay hand-written — out of scope per
  ADR-0020's deferred typed-hub follow-up (owner: Pro).

---

## [3.13.1-web] - 2026-07-12

Star item: **fix the supervisor CSAT KPI card's analytics contract** (csat-runner follow-up).

### Fixed

- **Supervisor CSAT KPI card read the wrong analytics fields** — `CsatQueueSummary`
  (consumer of `GET /api/v1/analytics/csat/queues/{queueId}`) declared
  `queueId` / `avgScore` / `responseCount`, none of which the Platform
  `CsatResponseDto` actually returns. The card deserialized `undefined` for both
  the score and the count and silently fell through to its empty state even when
  responses existed. The interface now mirrors the server DTO camelCased over the
  wire (`queueName` / `channel` / `totalResponses` / `averageRating` /
  `rangeStart` / `rangeEnd`).
- **Empty-state gate keyed off a never-null score** — Platform returns
  `averageRating: 0` (not `null`) for a period with zero responses, so the old
  `avgScore !== null` check never triggered the placeholder. Emptiness is now
  derived from `totalResponses === 0`, so an empty queue shows the placeholder
  instead of a misleading "0".

### Tested

- Added `csat-kpi-card.test.tsx` locking the analytics contract: score +
  response count render on real data, and the empty state shows when
  `totalResponses` is 0 despite `averageRating` being `0`.

---

## [3.13.0-web] - 2026-07-11

Star item: **CSAT UI — csat-runner consumer** (Platform/ADR-0020; coordinated CSAT
train with Pro `2.9.0-pro` + Platform `2.18.0`).

### Added

- **Webchat embed rating panel** — posts to `POST /api/v1/csat/responses/webchat`
  (all 9 wire fields verbatim) from the embed transport, independent of the
  auth-gated app shell.
- **Supervisor CSAT KPI card** — aggregated per-queue CSAT score + response count
  on the Operations wallboard, reading `GET /api/v1/analytics/csat/queues/{id}`.
- **Admin CSAT template tab** — per-tenant CSAT template management surface.
- i18n keys added across EN-US / ES-419 / PT-BR (3-locale parity gate); contract
  test + vitest units + Playwright E2E for the rating panel.

---

## [3.12.0-web] - 2026-07-05

Star item: **AI credit exhaustion action + near-exhaustion warning** (#136).

### Added

- **AI credit exhaustion action + near-exhaustion warning** (#136) — the AI credits readout now surfaces the server-reported `actionOnExhaustion` policy (`Warn` / `SoftBlock` / `HardBlock`) as a badge, plus a near-exhaustion warning band shown once usage reaches 80% (hidden for unlimited plans). i18n parity maintained across EN-US / ES-419 / PT-BR.

### Changed

- Dependency maintenance — Dependabot bumps since `v3.11.0-web`: `@sentry/react`, `libphonenumber-js`, `react-router-dom`, `@base-ui/react`, `react-hook-form`, `@types/node`, `lucide-react`, `prettier`, the TanStack group, the eslint-toolchain group, and `actions/checkout` (#118–#137).
- Docs/CI housekeeping (#138–#144) — adopted the `decision_ref` + H2 architectural-risk OpenSpec rules, documented the Web/Platform OpenSpec hub split and the E2E/Playwright anti-flake rule, added an OpenSpec-validate CI job (made required), and fixed docs-drift audit findings (stale version/links/claims, changelog, misfiled plan).

---

## [3.11.0-web] — 2026-06-24 — Typification P2c.2 (platform-managed AI / AI Credits)

The UI for **P2c.2** (pairs with **Platform v2.15.0**): a tenant can switch its Typification AI provider between **BYO** and **Verbara-managed** (metered in AI Credits), gated by the `PlatformLlm` plan entitlement.

### Added

- **"Use Verbara-managed AI (credits)" toggle** on the LLM-config admin page — when on, the BYO provider/key/test fields are hidden and a **credit-usage readout** (allowance / consumed / remaining / usage %) is shown. Disabled (with an upgrade hint) when the tenant's plan lacks the entitlement — but never blocks switching **back** to BYO if entitlement was lost.
- `useAiCredits()` hook (`GET /admin/ai/credits`); `aiSource` + `platformLlmAvailable` on the LLM-config types.
- i18n for the new strings in **EN-US / ES-419 / PT-BR**.

---

## [3.10.0-web] — 2026-06-21 — Typification P2c.1 (per-tenant BYO LLM config UI)

Client half of Typification **P2c.1** ([ADR-0029](https://github.com/verbara/verbara-platform/blob/main/docs/decisions/0029-typification-cascading-conditional-ai-module.md)) — an admin page to configure a per-tenant **BYO** LLM provider. Pairs with **Platform v2.14.0**. PR #117. i18n parity EN-US / ES-419 / PT-BR maintained.

### Added

- **Per-tenant LLM provider config** (`/admin/typification/llm`) — provider-type selector (OpenAI-compatible / Azure OpenAI / Anthropic) with **conditional fields by type**, a **write-only masked API key** (shown as `••••last4`, only sent when changed), an `enabled` toggle, and a **"Test connection"** probe. "No provider configured" is surfaced as a **valid manual mode** (AI stays strictly opt-in). Gated on `typification:ai:configure`. New `use-typification-llm` hooks (`['typification','llm']`).

---

## [3.9.0-web] — 2026-06-21 — Typification AI AutoFill (safe) + entity prefill (P2b)

Client half of Typification **P2b** ([ADR-0029](https://github.com/verbara/verbara-platform/blob/main/docs/decisions/0029-typification-cascading-conditional-ai-module.md)) — human-in-the-loop AI **AutoFill** of the agent wrap-up form, gated by measured calibration. Pairs with **Platform v2.13.0** + **Pro v2.8.0-pro**. PRs #112 (frontend) + #113 (npm audit fix). i18n parity EN-US/ES-419/PT-BR maintained.

### Added

- **Calibration-gated AI mode selector + bands + status panel** (`src/admin/typification/*`) — admin sets the AutoFill band (Off / Shadow / SuggestOnly / AutoFill); the selector is gated by the server's calibration status, with a muted note when AI is enabled on a brand-new schema (the calibration panel is existing-schema only).
- **Anti-clobber AutoFill UX** in the agent wrap-up (`<DynamicTypificationForm>`) — when the band is `AutoFill`, the form prefills with an **Undo** affordance + a confidence badge; Undo restores any prior P1 prefill (the snapshot path is copied so it can never alias a later-mutated array).
- **Entity-field-map + PII allow-list editor** in the schema designer — configure entity extraction → field bindings under an explicit PII allow-list.

### Fixed

- **Cross-conversation AI-suggestion leak** — the wrap-up reused a single `<DynamicTypificationForm>` instance across conversation switches, so a band=`AutoFill` suggestion from conversation A could auto-fill (and tag AI-accepted) conversation B's freshly-loaded form. The form is now keyed `key={conversationId}` so it remounts per conversation (fresh suggestion mutation + clean state) while preserving in-progress state on reopen; internal cross-conversation scrubbing kept as defense-in-depth.
- **Autonomous + token-budget config wiped on designer save** — the schema PUT is a full replace and the designer hard-coded `autonomous:false` / omitted `dailyTokenBudget`, so any save (even a rename) silently reset a persisted `autonomous:true` and wiped a configured `dailyTokenBudget`. Both fields now round-trip (passthrough in `aiConfigSchema` + the schema mappers).

### Security

- **npm audit fix** (#113) — patched the 4 transitive advisories (2 HIGH) the CI `audit` gate flagged on every PR and on `main`: `ws` GHSA-96hv-2xvq-fx4p (HIGH, via `@microsoft/signalr`) 7.5.10→7.5.11, `hono` GHSA-wwfh-h76j-fc44 (HIGH, via shadcn→MCP SDK) 4.12.23→4.12.26, `js-yaml` GHSA-h67p-54hq-rp68 (moderate) 4.1.1→4.2.0, plus `@babel`.

### Changed

- Dependency maintenance — ~26 Dependabot bumps since `v3.8.0-web` (dompurify, wavesurfer.js, lucide-react, shadcn, react-hook-form, undici, the tailwind / eslint / vite / playwright toolchain groups, `github/codeql-action`, etc.). Build + lint + i18n parity + 1396 unit tests green.

---

## [3.8.0-web] — 2026-06-10 — Typification AI auto-disposition (P2a)

Client half of Typification **P2a** ([ADR-0029](https://github.com/verbara/verbara-platform/blob/main/docs/decisions/0029-typification-cascading-conditional-ai-module.md)) — the agent wrap-up gains an AI suggestion overlay. Pairs with **Platform v2.12.0** + **Pro v2.8.0-pro**. PR #93. i18n parity EN-US/ES-419/PT-BR maintained.

### Added

- **Wrap-up AI suggestion** (`<DynamicTypificationForm>`): after the form loads, calls `POST /conversations/{id}/typification-suggestion` → "AI analizando…" spinner → a suggestion card (suggested cascade path + confidence badge + translated sentiment) with **Accept** (seeds the cascade, reusing the P1 prefill seeding, and submits `Source=AutoAi` provenance) / **Dismiss**. Additive and agent-triggered — never auto-applies; a 402 (unlicensed) silently hides the AI affordance (via a new `suppressPaymentRequiredModal` option on `customFetch`).
- **`useTypificationSuggestion`** hook + **AiConfig** section in the schema designer (enable / confidence threshold / sentiment gating; mode shown read-only as `SuggestOnly` in P2a).

---

## [3.7.0-web] — 2026-06-08 — Typification shared taxonomy capture — P1

Client half of Typification **P1** ([ADR-0029](https://github.com/verbara/verbara-platform/blob/main/docs/decisions/0029-typification-cascading-conditional-ai-module.md)) — the agent wrap-up is now **pre-selected + pre-filled** from what the IVR/bot/routing captured. Pairs with **Platform v2.11.0**. PR #92. i18n parity EN-US/ES-419/PT-BR maintained.

### Added

- **Wrap-up prefill hydration** (`<DynamicTypificationForm>`) — seeds the cascade from `prefilledNodePath` (exact inverse of the subtree ancestor-chain) and fields from `prefilledFieldValues`; one-shot per form, agent can override.
- **`collect_reason`** flow designer node (palette + node with `collected`/`error` outputs + property panel: schema picker, subtree, prompts).
- **Reason-hints admin** (`/admin/reason-hints`) — list + form (scope Did/Channel/Queue; Channel as an exact-enum dropdown; codes↔JSON reason-path UX) + hook + lazy route + sidebar, gated `system:typification:configure`.
- **Field PrefillSource control** in the typification schema designer (metadata-key prefill).

### Fixed

- **Flow designer node-type casing** — the designer persisted PascalCase while the engine matches snake_case (no publish-time validation), so designer-built flows threw at runtime. Fixed with a pure bidirectional map in `flow-utils.ts` (wire/engine vocabulary = snake_case; PascalCase is a render-only detail).
- **Branch edge conditions** — `onConnect`/`toDomain` ignored the source handle, so `collected`/`error` (and Condition's `true`/`false`) all serialized to `'default'` and were indistinguishable. The source-handle id is now persisted as the edge condition and restored on load.

---

## [3.6.0-web] — 2026-06-07 — Typification (cascading + conditional disposition forms) — P0

Client half of the **Typification** feature ([ADR-0029](https://github.com/verbara/verbara-platform/blob/main/docs/decisions/0029-typification-cascading-conditional-ai-module.md)) — replaces the flat single-select disposition wrap-up with cascading, conditional, schema-driven disposition forms. Pairs with **Platform v2.10.0** + **Pro v2.7.5-pro**. PR #82 (+ release prep). i18n parity EN-US/ES-419/PT-BR maintained.

### Added

- **`use-typification.ts`** — TanStack Query hooks + types for schemas, bindings, publish, and the runtime form/typify.
- **`<DynamicTypificationForm>`** (agent wrap-up) — renders the resolved schema: level-by-level cascading node selectors (depth-aware, leaf-only submit) + conditional fields evaluated reactively (client mirror of the server `VisibleWhen`/active-field logic). Graceful no-schema fallback.
- **Admin Typification designer** (`src/admin/typification/`) — schema list + structured designer (nodes / fields / conditions / leaf outcomes / bindings) with publish + server-validation error surfacing. New route + sidebar item behind `system:typification:configure`.

### Changed

- Date fields submit as UTC ISO-8601 (so dialer callbacks schedule at the correct instant); `customFetch` now surfaces server field-level errors (`errors[].message` / `error`), not just `detail`.

### Removed

- Flat-disposition surfaces (`use-dispositions`, the old `useWrapUp`) and their orphaned i18n keys. The Pro Dialer campaign `DispositionCode` admin (campaign detail) is unchanged — it feeds the dialer bridge.

---

## [3.5.0-web] — 2026-06-07 — Session/Auth overhaul: presence, idle UX & work continuity (ADR-0009 W1–W6)

The client half of the [ADR-0009](docs/decisions/0009-agent-presence-session-work-continuity.md) north-star, shipped as six sequenced tracks (W1–W6, 2026-06-05→06-07) over PRs #75–#80. Pairs with **Platform v2.9.0**. i18n parity EN-US/ES-419/PT-BR maintained throughout.

### Added

- **W3 — client liveness (`src/core/presence/*`).** Activity-independent heartbeat (~20s) to `POST /agents/me/heartbeat` + `pagehide` graceful-departure beacon.
- **W5 — supervisor stuck-work view.** Tab listing orphaned digital work with manual reassign (queue/agent).
- **W5b — voice caller-rescue in supervisor stuck-work.** Voice callback-stuck rows (Phone icon, "Callback failed N×") with Retry-callback + Close.
- **W6 — agent channel-capacity UI.** Per-agent override form (MaxVoice pinned read-only to 1, async fields 0–50, inherited-default placeholders, reset-to-inherited, MaxTotal-below-cap advisory), effective-capacity detail card (inherited/overridden tags), and tenant default capacity in operational settings.

### Changed

- **W1+W2 — agent-aware idle timeout (`src/core/session/*`).** Activity-aware 30-min idle timeout + warning + proactive token refresh + cross-tab coordination (BroadcastChannel + Web Locks) + agent-aware safe Offline teardown. Closes the silent-logout / forced-logout UX.
- **W4 — deferred-pause pending UX** + agent-status casing fix.

### Dependencies

- June hygiene batch (#81, consolidating Dependabot #64/#68/#69/#72): libphonenumber-js 1.13.4, lucide-react 1.17.0, @sentry/react 10.55.0, shadcn 4.10.0. `npm audit` 0 vulnerabilities.

---

## [3.4.0-web] — 2026-06-01 — Telephony admin UX: trunk form, DID module, wizard, connectivity test

Pairs with **Platform v2.8.0**. Makes SIP telephony configurable from the admin UI (previously curl-only).

### Added

- **Complete trunk form** — connection/auth/IP-ACL fields (`matchHost`, `authUsername`/`authPassword`, `registrationUri`, `clientUri`) as Basic + `codecs`/`transport`/`context` as Advanced; `authPassword` write-only; client IP/CIDR validation. (Was a 5-field stub that couldn't create a working trunk.)
- **DID / inbound-routes module** (`/admin/did-routes`) — list + form + sidebar entry; target queue mandatory (no DID without destination).
- **Guided trunk creation wizard** — provider templates (Twilio/Telnyx/Flowroute/VoIP.ms/genérico) → connection/auth → media → outbound route → DID → summary, creating trunk + route + DID in one flow (reusable `WizardLayout`).
- **Trunk connectivity test** — "Probar conectividad" per trunk + result dialog (semaphore + per-check + server diagnostics).

### Notes

- i18n parity EN-US/ES-419/PT-BR maintained.

---

## [3.3.0-web] — 2026-06-01 — In-browser voice softphone (Inbound Conversation Delivery)

MINOR bump shipping the in-browser voice agent — pairs with **Platform v2.7.0**. An inbound call rings the agent's tab, they answer with two-way WebRTC audio, and the call is a tracked voice Conversation (screen-pop + agent-assist + wrap-up) with full in-call control.

### Added

- **SIP.js/WebRTC softphone (3A).** `core/voice/softphone-manager.ts` (`Web.SimpleUser` REGISTER over WSS from `config.json` `asteriskWssUrl`, path `/ws`), `voice-call-store`, floating `call-card` (ringing/active/timer), `<audio>` sink. Starts only when the agent has `extension` + `sipPassword` (self-scoped from `/agents/me`). Admin UI provisions agent extension + SIP password (generate button).
- **Voice as a tracked Conversation (3B.1).** `voice.screenpop` SSE → upsert voice Conversation + auto-nav; per-conversation agent-assist (transcript/sentiment/suggestions keyed by conversationId); wrap-up on hangup.
- **In-call control (3B.2).** hold/unhold, mute/unmute, DTMF dialpad; per-agent + per-queue **auto-answer** cascade (tri-state Select + zip-tone, gated on secure-context + granted mic); **blind transfer** dialog (queue/agent/external); **outbound click-to-dial** from contact info + "Dialing" call-card variant; tenant outbound caller-ID setting.

### Notes

- The agent app must run in a **secure context** (`https://` or `http://localhost`) for the microphone; the self-signed WSS cert at `https://host:8089` must be accepted once. i18n parity EN-US/ES-419/PT-BR maintained.

---

## [3.1.3-web] — 2026-05-18 — Dependency hygiene track: 20 Dependabot bumps (runtime + dev + CI), no product-surface changes

PATCH bump closing the v3.1.x dependency-hygiene track that accumulated after the `v3.0.3-web` Dependabot bootstrap (CI + Dependabot config landed 2026-05-17). All 20 PRs auto-merged or were merged manually after `build`, `test`, `coverage`, `i18n`, `audit`, `lint` checks passed. **No product-surface changes** — pure dependency hygiene. Follows the precedent set by `v3.0.3-web` ("Operations + CI hardening release, no new product surface").

### Runtime dependency bumps (npm)

- `@fontsource-variable/geist` 5.2.8 → 5.2.9 ([#39](https://github.com/verbara/Verbara.Platform.Web/pull/39))
- `@tanstack/react-query` group ([#29](https://github.com/verbara/Verbara.Platform.Web/pull/29))
- `ag-grid-community` 35.2.1 → 35.3.0 ([#34](https://github.com/verbara/Verbara.Platform.Web/pull/34))
- `ag-grid-react` 35.2.1 → 35.3.0 ([#33](https://github.com/verbara/Verbara.Platform.Web/pull/33))
- `date-fns` 4.1.0 → 4.2.1 ([#42](https://github.com/verbara/Verbara.Platform.Web/pull/42))
- `dompurify` 3.4.2 → 3.4.5 ([#41](https://github.com/verbara/Verbara.Platform.Web/pull/41)) — XSS sanitizer used by markdown rendering in WebChat
- `i18next` + ecosystem group ([#31](https://github.com/verbara/Verbara.Platform.Web/pull/31))
- `jspdf-autotable` 5.0.7 → 5.0.8 ([#38](https://github.com/verbara/Verbara.Platform.Web/pull/38))
- `lucide-react` 1.14.0 → 1.16.0 ([#40](https://github.com/verbara/Verbara.Platform.Web/pull/40))
- `react-hook-form` forms group ([#32](https://github.com/verbara/Verbara.Platform.Web/pull/32))
- `react-router-dom` react-ecosystem group ([#27](https://github.com/verbara/Verbara.Platform.Web/pull/27))
- `wavesurfer.js` 7.12.6 → 7.12.7 ([#37](https://github.com/verbara/Verbara.Platform.Web/pull/37)) — voice recording playback

### Dev dependency bumps (npm)

- `@sentry/react` 10.52.0 → 10.53.1 ([#36](https://github.com/verbara/Verbara.Platform.Web/pull/36))
- `@sentry/vite-plugin` 5.2.1 → 5.3.0 ([#43](https://github.com/verbara/Verbara.Platform.Web/pull/43))
- `@types/node` 24.12.3 → 24.12.4 ([#35](https://github.com/verbara/Verbara.Platform.Web/pull/35))
- `eslint-toolchain` group ([#28](https://github.com/verbara/Verbara.Platform.Web/pull/28))
- `vite-toolchain` group ([#30](https://github.com/verbara/Verbara.Platform.Web/pull/30))

### CI / GitHub Actions bumps

- `docker/build-push-action` 6 → 7 ([#25](https://github.com/verbara/Verbara.Platform.Web/pull/25))
- `docker/login-action` 3 → 4 ([#26](https://github.com/verbara/Verbara.Platform.Web/pull/26))
- `docker/setup-buildx-action` 3 → 4 ([#24](https://github.com/verbara/Verbara.Platform.Web/pull/24))

### Validation

- All 20 PRs passed CI (`build`, `test`, `coverage`, `i18n`, `audit`, `lint`) before merge
- 1047/1047 Vitest tests remain passing
- `release.yml` rebuilt successfully against the new docker-action major versions

### Coordinated cross-repo state (post-ship)

SDK `2.1.2` · Pro `2.4.0-pro` · Platform `2.2.0` · Web **`3.1.3`** (this release).

---

## [3.1.2-web] — 2026-05-18 — Follow-up i18n hotfix: drop `nonExplicitSupportedLngs` + `load: 'currentOnly'` (closes i18n hotfix track)

PATCH bump. Track-end closure for the v3.1.x i18n hotfix track (2 patches: 3.1.1 Suspense boundary + 3.1.2 supported-languages chain). Backfilled CHANGELOG entry — annotated tag not retroactively applied because the ghcr.io image `ghcr.io/verbara/platform/web:v3.1.2-web` was already built + cosign-signed against the existing lightweight tag (commit `8f2bf36`); the GitHub release was created post-hoc against that same tag to preserve image-tag mapping.

### Problem

After `v3.1.1-web` shipped the top-level `<Suspense>` boundary, a second i18n defect surfaced: the configured `supportedLngs: ['en-US', 'es-419', 'pt-BR']` chain was being silently emptied at runtime because i18next's `nonExplicitSupportedLngs: true` was promoting partial matches (`'en'`, `'es'`, `'pt'`) into the supported list, then the language-detection pipeline failed to converge on any of them and fell back to an empty languages array. The result was the same Suspense throw + raw-key render, just for a different reason.

### Fix

`src/core/i18n/init.ts`:

- **Removed** `nonExplicitSupportedLngs: true` (was overriding the explicit 3-locale list)
- **Changed** `load: 'currentOnly'` (was the default `'all'`, which queried `/locales/en/common.json` and `/locales/en-US/common.json` — the unqualified-language fetches always 404'd, polluting devtools + slowing first paint)

### Validation

- Playwright reproduction against rebuilt image confirms every `auth.*` and `app.*` key resolves
- Single fetch per locale (`/locales/en-US/common.json` only — no more `/locales/en/common.json` 404)
- `npm run build` succeeded, 1047/1047 Vitest pass

---

## [3.1.1-web] — 2026-05-18 — Critical UX fix: missing top-level Suspense boundary caused unauthenticated routes to render raw i18next keys

> **Superseded by [3.1.2-web]** — this patch fixed the Suspense protocol but left the supported-languages chain broken. Track closed at 3.1.2.

PATCH bump for a one-line UX bug visible on every unauthenticated route (login, forgot-password, reset-password, unauthorized). The i18next runtime was configured with `react: { useSuspense: true }` but the App tree had **NO** top-level `<Suspense>` boundary. When `useTranslation()` was called before `i18next-http-backend` finished fetching `/locales/{lng}/{ns}.json`, the thrown Promise (React Suspense protocol) bubbled past the only Suspense in the tree (which lives inside `router.tsx` `LazyLoad` and wraps lazy-loaded admin/agent pages only). The root `ErrorBoundary` silently absorbed the throw, the hook fell back to `ready: false`, and every `t('...')` call returned the raw key string.

### Symptom (reproduced via Playwright against the K8s lab v3.1.0-web image)

- `/login` rendered: `app.name` (header), `auth.sign_in` (subtitle), `auth.email`, `auth.password`, `auth.remember_me`, `auth.forgot_password`, `auth.sign_in`, `auth.or`, `auth.sign_in_sso`, `auth.use_api_key`, `a11y.required` — all as raw key strings
- Translation values WITH explicit `t(key, fallback)` defaults rendered the fallback (`'e.g. demo, platform'` for tenant placeholder)
- `0` network requests to `/locales/*` during initial page load (HttpBackend never fired)
- A manual `fetch('/locales/en-US/common.json')` in DevTools returned HTTP 200 + correct JSON → backend perfectly fine
- `localStorage.verbara.lang = 'en-US'`, `navigator.language = 'en-US'`, both supported

### Fix

`src/app.tsx` wraps `<RouterProvider>` in a top-level `<Suspense fallback={...}>` boundary so the Suspense protocol works as designed. This unblocks i18next-http-backend's first fetch + lets React resume the render once translations are loaded.

The router-internal `<LazyLoad>` wrappers for lazy-loaded admin/agent pages remain untouched (they catch the dynamic-import suspense for those routes specifically).

### Affected versions

- All v3.x-web releases prior to v3.1.1-web: the same gap existed since the original app.tsx scaffolding. Pre-v3 (Asterisk-rebrand era) had different routing + may have had different defaults; not investigated.
- Single-line gap: adding `import { Suspense }` + wrapping `<RouterProvider>` is the entire fix.

### Validation

- `npm run build` succeeded (8 chunks, dist size unchanged)
- Playwright reproduction against rebuilt image confirms every `auth.*` and `app.*` key now resolves to its English value
- Network panel: `/locales/en-US/common.json` HTTP 200, 16965 bytes, fired within ~10 ms of page load
- No regression in lazy-loaded admin/agent routes (their inner Suspense boundaries still fire for dynamic imports)

---

> **Note on the gap between [1.13.17] (2026-04-30) and the 3.x series**: the
> v1.14.x → v2.4.x cycles + the v3.0.0-web Verbara rebrand + v3.0.x post-rebrand
> tags shipped without inline CHANGELOG entries. The v3.x entries below are
> **backfilled 2026-05-18** sourced from `git log` ranges between tags +
> GitHub Releases page (https://github.com/verbara/Verbara.Platform.Web/releases)
>
> - cross-repo memory cross-refs. The v1.14 → v2.4 gap remains and may be
>   backfilled in a separate sweep if/when needed.

---

## [3.1.0] — 2026-05-18 — License upgrade modal (HTTP 402 UX) — closes Platform v2.2.0 follow-up

MINOR bump because this release introduces a new global modal that surfaces actionable upgrade / trial / contact-sales CTAs when the Platform API returns **HTTP 402 Payment Required** (the contract shipped in Platform v2.2.0 + Pro v2.4.0-pro per ADR-0012). Before this release, the Web client surfaced 402 errors via the generic Sonner error toast — losing the `tier_required` / `trial_url` / `upgrade_url` / `contact_sales_url` extension members that Pro v2.4.0-pro's `LicenseGuard.Evaluate` populates. Web 3.1.0 closes the loop end-to-end.

**Coordinated cross-repo state (post-ship):** SDK `2.1.2` · Pro `2.4.0-pro` · Platform `2.2.0` · Web **`3.1.0`** (this release).

### Added

- New cross-cutting module [`src/core/licensing/`](src/core/licensing/) with 6 files:
  - `types.ts` — `PaymentRequiredProblemDetails` interface mirroring the RFC 9457 ProblemDetails contract Platform v2.2.0 emits + `isPaymentRequiredProblemDetails` type-guard.
  - `payment-required-error.ts` — `PaymentRequiredError` typed exception (mirrors the existing `UnauthorizedError` pattern in `core/api/client.ts`).
  - `payment-required-store.ts` — Zustand singleton (`usePaymentRequiredStore`) bridging non-React API errors into the React render tree. Most-recent-wins semantics on concurrent 402s.
  - `payment-required-dialog.tsx` — `<PaymentRequiredDialog />` built on the existing `@base-ui/react` Dialog primitive. Renders tiered CTAs based on which extension members Pro populated (NotLicensed/Expired/GraceExhausted → Trial + Upgrade; Revoked → Contact Sales; UnauthorizedImage → acknowledge-only, no actionable URLs).
  - `payment-required-host.tsx` — `<PaymentRequiredDialogHost />` mounted once near app root, subscribes to the store, renders the dialog.
  - `index.ts` — barrel export.

### Changed

- [`src/core/api/client.ts`](src/core/api/client.ts) — `executeRequestRaw` now detects `response.status === 402`, parses the body via `isPaymentRequiredProblemDetails`, calls `usePaymentRequiredStore.getState().show(body)` to display the modal, then throws `PaymentRequiredError` so mutation/query callers still receive a typed error. Malformed 402 bodies fall through to a generic throw (defensive fail-closed).
- [`src/app.tsx`](src/app.tsx) — mount `<PaymentRequiredDialogHost />` inside `<ApiQueryProvider>` next to the existing `<Toaster />`. Order: theme → query → router + toaster + payment-required-host.

### i18n

- Added 8 new keys under `common:license_required.*` (3-locale parity enforced by `scripts/i18n-parity-check.mjs`):
  - `title` · `default_detail` · `tier_required` (with `{{tier}}` interpolation) · `dismiss` · `acknowledge` · `start_trial` · `upgrade` · `contact_sales`
- Translations for **en-US**, **es-419** (baseline), **pt-BR**. `npm run i18n:check` passes.

### Tests

- 17 new unit tests across 3 files:
  - `payment-required-store.test.ts` — 5 tests (init, show, replace-on-second-show, dismiss-keeps-payload, reopen).
  - `types.test.ts` — 7 tests for the `isPaymentRequiredProblemDetails` type-guard (valid shape, omitted extensions, wrong status, missing fields, null/primitive defenses).
  - `payment-required-dialog.test.tsx` — 5 render tests (NotLicensed → Trial+Upgrade buttons; Revoked → ContactSales; UnauthorizedImage → no CTAs; tier label interpolation; null-payload safety).

### What this release does NOT do

- No changes to existing 401/403/404/5xx handling paths — those continue to flow through the existing `UnauthorizedError` refresh-retry, route-error boundary, and per-mutation `onError → toast.error` patterns.
- No global TanStack Query `onError` override at the `QueryClient` defaults level — the 402 path is handled directly in the fetch layer (`client.ts`) before the error reaches TanStack Query.
- No new locale namespace — the new keys live in the existing `common` namespace under `license_required.*`.

### Cross-repo coordination

- Closes the follow-up explicitly called out in **Platform v2.2.0 CHANGELOG** "Risks / open questions": _"a follow-up Web PR should detect 402 + parse `upgrade_url` to render an upgrade modal instead of the generic error toast"._
- No Platform-side changes required.

---

## [3.0.3] — 2026-05-17 — CI + Dependabot bootstrap + ADR-0007 trigger mirroring

Backfilled 2026-05-18. **Operations + CI hardening release**, no new product
surface. Closes the post-rebrand setup gap between v3.0.1-web (2026-05-09)
and the v2.2.0 Platform consumer migration of v3.1.0-web (2026-05-18).

### Added

- **`feat(ci): release workflow for ghcr.io/verbara/platform/web image`** ([c67ef1e](https://github.com/verbara/Verbara.Platform.Web/commit/c67ef1e)) — first GitHub Actions release workflow for the Web repo. Triggered on `v*-web` tags; builds + pushes cosign-signed image to `ghcr.io/verbara/platform/web`. Mirrors the Platform API release pipeline so Web image-binding (ADR-0011 cascade) can verify the Web side of the deploy.
- **Dependabot bootstrap** — 9 incoming PRs ([#1-5, #15, #16, #18, #20, #21](https://github.com/verbara/Verbara.Platform.Web/pulls?q=is%3Apr)) covering: GitHub Actions version bumps (actions/checkout 5→6, github-script 7→9, upload-artifact 4→7, setup-node 5→6, dependabot/fetch-metadata 2→3); npm dependencies (`@tanstack/react-query` group, `i18next` group, `vite-toolchain` group, `@playwright/test` group, `msw 2.14.5→2.14.6`).
- **`fix(hooks): allow nested scopes in commit-msg`** ([763d1f9](https://github.com/verbara/Verbara.Platform.Web/commit/763d1f9)) — relaxes Commitlint to accept Dependabot's `chore(ci)(deps)` nested-scope convention.

### Changed

- **`fix(ci): add .npmrc with legacy-peer-deps`** ([c2a2478](https://github.com/verbara/Verbara.Platform.Web/commit/c2a2478)) — unblocks `npm ci` on the new release workflow against the current `@base-ui/react` peer-dep graph.
- **`fix(docker): copy .npmrc into build stage`** ([ed6c0e6](https://github.com/verbara/Verbara.Platform.Web/commit/ed6c0e6)) — Dockerfile build stage was missing the `.npmrc`, causing peer-dep resolution failures in CI build.

### Docs

- **ADR-0007 trigger mirroring** ([43ee6f8](https://github.com/verbara/Verbara.Platform.Web/commit/43ee6f8), [f4ee9b9](https://github.com/verbara/Verbara.Platform.Web/commit/f4ee9b9), [c51a053](https://github.com/verbara/Verbara.Platform.Web/commit/c51a053)) — mirrors Platform [ADR-0018](https://github.com/verbara/Verbara.Platform/blob/main/docs/decisions/0018-visibility-decision-3-private-now-public-on-trigger.md) visibility-flip trigger status into the Web repo's own ADR-0007 so the Web repo has an authoritative record of its share of the visibility-flip closure. Triggers 3, 5, 7 marked GREEN.
- **Plan archival** — Verbara rebrand + v1.14.x roadmap moved to `docs/plans/completed/` post-flip cleanup.

### Versioning note

v3.0.2-web was skipped intentionally — no functional work between v3.0.1-web (Track 7C-polish, 2026-05-09) and v3.0.3-web (this release, 2026-05-17) other than CI/deps housekeeping that didn't warrant a dedicated patch.

---

## [3.0.1] — 2026-05-09 — Track 7C-polish — 12 audit gaps + missing tests for WebChat Widget v1

Backfilled 2026-05-18. **Polish patch for v3.0.0-web's WebChat Widget v1**. Closes 12 quality-audit gaps identified in the post-3.0.0 review + the missing-tests gap for the new webchat-embed surface.

### Added

- **Sentry breadcrumbs at key lifecycle events** ([dce1a15](https://github.com/verbara/Verbara.Platform.Web/commit/dce1a15)) — webchat-embed iframe emits breadcrumbs at session-create / WS-open / WS-close / agent-message-received / visitor-message-sent for observability.
- **Virtualized message list** ([0a701f6](https://github.com/verbara/Verbara.Platform.Web/commit/0a701f6)) — `@tanstack/react-virtual` integration so long conversations (>500 messages) don't degrade scroll perf on low-end devices.
- **`prefers-reduced-motion` support** ([26d2635](https://github.com/verbara/Verbara.Platform.Web/commit/26d2635)) — iframe respects OS-level motion preference; disables transitions for accessibility.
- **Favicon badge for unread messages** ([c3e5cb4](https://github.com/verbara/Verbara.Platform.Web/commit/c3e5cb4)) — visitor sees count badge on the host page tab favicon when the iframe is in the background.
- **Inactivity timeout banner** ([b8b0aec](https://github.com/verbara/Verbara.Platform.Web/commit/b8b0aec)) — after 5 min of no agent activity, banner appears with "still here?" prompt.
- **Composer auto-focus on chat transition** ([fadaab2](https://github.com/verbara/Verbara.Platform.Web/commit/fadaab2)) — a11y: when pre-chat form completes, composer receives focus automatically.
- **Sound notifications with toggle UI** ([00869a5](https://github.com/verbara/Verbara.Platform.Web/commit/00869a5)) — visitor can mute incoming-message sound; preference persisted in localStorage.
- **Cross-visit message cache** ([23646de](https://github.com/verbara/Verbara.Platform.Web/commit/23646de)) — messages stored in localStorage so resumed visits show prior conversation history.
- **Theme CSS-var injection** ([327b1a3](https://github.com/verbara/Verbara.Platform.Web/commit/327b1a3)) — iframe consumes theme tokens (primary, accent, font) from the SDK init-config so each tenant brands the widget.

### Fixed

- **Drain offline queue on WS reconnect** ([837e963](https://github.com/verbara/Verbara.Platform.Web/commit/837e963)) — visitor messages queued while offline now drain reliably when the WebSocket reconnects.
- **`useFieldA11y` adoption in pre-chat-form** ([89e7178](https://github.com/verbara/Verbara.Platform.Web/commit/89e7178)) — pre-chat form now uses the same a11y field hook as the main app for parity with Track 5C accessibility baseline.
- **Lint cleanup** ([2a49e11](https://github.com/verbara/Verbara.Platform.Web/commit/2a49e11)) — rename `autoFocus`, defer `setMessages`, init ref in effect; satisfies the WebChat iframe's stricter ESLint config.
- **WebSocket attachment propagation** ([51b4f2d](https://github.com/verbara/Verbara.Platform.Web/commit/51b4f2d)) — agent-side attachments now propagate from WS frames into the message list (previously dropped).

---

## [3.0.0] — 2026-05-09 — WebChat Widget v1 + ROADMAP COMPLETE 🎉

Backfilled 2026-05-18. **MAJOR release closing the entire Web product roadmap.** Track 7C ships the customer-facing WebChat Widget v1 (embeddable iframe + JS SDK + shadow-DOM bubble + admin embed-snippet UI) — the last remaining roadmap item. All 7 niveles closed; the Web ROADMAP is declared **COMPLETE 🎉**.

The release is delivered as a 28-commit train, structured in 7 phases per the active spec at `docs/plans/completed/2026-05-08-track-7c-webchat-widget-mvp-spec.md`.

### Added — WebChat SDK (host page side)

- **`src/webchat/sdk/`** — JS SDK consumed by tenant host pages via `<script src="…/webchat-sdk.js">`. Auto-init on `[data-verbara-tenant]` body attribute.
- Shadow-DOM bubble button ([7247e99](https://github.com/verbara/Verbara.Platform.Web/commit/7247e99)) with unread count badge.
- Lazy iframe loader ([bd4d47e](https://github.com/verbara/Verbara.Platform.Web/commit/bd4d47e)) — sandbox, mobile breakpoint detection, responsive positioning.
- postMessage bridge ([b8c1092](https://github.com/verbara/Verbara.Platform.Web/commit/b8c1092)) with origin + source validation for security.
- Visitor-storage ([bd859ba](https://github.com/verbara/Verbara.Platform.Web/commit/bd859ba)) — localStorage UUID + profile so returning visitors resume sessions cleanly.
- API surface + index entrypoint ([469d3e9](https://github.com/verbara/Verbara.Platform.Web/commit/469d3e9)) with auto-init wiring.

### Added — WebChat embed (iframe side)

- **`src/webchat/embed/`** — isolated React app loaded inside the iframe; separate i18n bundle + Sentry init.
- iframe entrypoint with isolated i18n + Sentry ([76b846c](https://github.com/verbara/Verbara.Platform.Web/commit/76b846c)).
- DOMPurify-safe markdown renderer ([d565cde](https://github.com/verbara/Verbara.Platform.Web/commit/d565cde)).
- Pre-chat form (RHF + Zod, a11y baseline) ([b96a958](https://github.com/verbara/Verbara.Platform.Web/commit/b96a958)).
- Composer, message-list, message-bubble (a11y log + markdown) ([069c0da](https://github.com/verbara/Verbara.Platform.Web/commit/069c0da)).
- Chat-widget shell + status banner ([5ff3862](https://github.com/verbara/Verbara.Platform.Web/commit/5ff3862)).
- Notifications + a11y wiring ([19a8703](https://github.com/verbara/Verbara.Platform.Web/commit/19a8703)).
- Session-API client ([2fc82cd](https://github.com/verbara/Verbara.Platform.Web/commit/2fc82cd)) — createSession + fetchHistory.
- WebSocket client with exponential-backoff reconnect ([b52ee11](https://github.com/verbara/Verbara.Platform.Web/commit/b52ee11)).
- Offline message queue with localStorage + cap ([65de279](https://github.com/verbara/Verbara.Platform.Web/commit/65de279)).

### Added — Admin + demo

- **Admin embed-snippet UI** ([4dbdd42](https://github.com/verbara/Verbara.Platform.Web/commit/4dbdd42)) — replaces the `webchat-page` placeholder with a real UI that generates the per-tenant embed `<script>` snippet, copy-to-clipboard, preview.
- **`demo.html` page** ([181c440](https://github.com/verbara/Verbara.Platform.Web/commit/181c440)) — public demo page bundled with the SDK so E2E + customer pre-sales demos have a stable target.
- **Embedding guide README** ([3e0a758](https://github.com/verbara/Verbara.Platform.Web/commit/3e0a758)).

### Added — i18n + infrastructure

- **New `webchat` namespace** ([7eab2a0](https://github.com/verbara/Verbara.Platform.Web/commit/7eab2a0)) — 3 locales (en-US, es-419, pt-BR); parity check extended to enforce 6 namespaces (was 5).
- **Multi-config Vite build** ([d15009b](https://github.com/verbara/Verbara.Platform.Web/commit/d15009b)) — separate Vite configs for main app + webchat-sdk + webchat-embed iframe so each ships as an independent bundle.
- **Nginx location blocks** ([608758f](https://github.com/verbara/Verbara.Platform.Web/commit/608758f)) — `/webchat/sdk/*`, `/webchat/embed/*`, `/webchat/demo/*` served with appropriate CSP + cache headers.

### Tests

- **E2E Playwright spec** ([de5a6df](https://github.com/verbara/Verbara.Platform.Web/commit/de5a6df)) — full visitor flow: host page loads, bubble appears, click → iframe opens, pre-chat form, message exchange, close.
- **Integration test for full visitor flow** ([aef03e8](https://github.com/verbara/Verbara.Platform.Web/commit/aef03e8)) — exercises the cross-frame postMessage protocol end-to-end.

### Docs

- **Track 7C spec** ([7704280](https://github.com/verbara/Verbara.Platform.Web/commit/7704280)) — comprehensive design doc for the MVP (~600 lines): 7 phases, 25 tasks, security model, theming, embed UX, accessibility.
- **Track 7C plan** ([5f15287](https://github.com/verbara/Verbara.Platform.Web/commit/5f15287)) — execution plan, 25 tasks.
- **Scope correction** ([6f09fba](https://github.com/verbara/Verbara.Platform.Web/commit/6f09fba)) — marketing pages moved out of Platform.Web scope (handled by `verbara-website` repo).
- **Roadmap closure** ([b08b22b](https://github.com/verbara/Verbara.Platform.Web/commit/b08b22b)) — Nivel 7 marked complete, roadmap declared **COMPLETE**, plan moved to `docs/plans/completed/`. **End of the multi-month Web roadmap arc.**

---

## [1.13.17] — 2026-04-30 — i18n Coverage Phase 4K (campaign-detail extraction)

**Extracts the largest remaining hardcoded-string concentration.**
The hardcoded-strings audit flagged `campaign-detail-page.tsx` as
the top file with 43 untranslated UI strings — info-card section
labels, the disposition CRUD dialog, the dispositions table, the
contact-lists section, the stop confirmation, and the disposition
delete confirmation. All extracted in one pass.

### Refactored to `useTranslation`

**`src/admin/campaigns/campaign-detail-page.tsx`** — added
`useTranslation` to the inner `DispositionDialog` sub-component
and wired the main `CampaignDetailPage` body.

- **Header / actions**: "Campaign not found." fallback, Cancel /
  Saving... / Save / Edit / Delete buttons, Description (optional)
  placeholder.
- **Info card** (5 sections): Basic / Dialing / Schedule /
  Compliance / Contacts headers + 18 row labels (Queue, Team,
  Mode, Max Concurrent Calls, Power Ratio, Target Abandon Rate,
  Timezone, Campaign Period, Weekly Schedule, Closed,
  Holidays (No Dialing), DNC List Enabled, Yes/No, Max Attempts,
  Retry Interval, Time Between Attempts, Notes, Total Contacts,
  Contacts Dialed). `min` minutes-suffix shared.
- **Dispositions table**: heading, Add Disposition CTA, empty
  state, 6 column headers, 3 aria-labels, Edit row button.
- **DispositionDialog**: dialog title (add vs. edit), Code +
  Label fields with localized placeholders ("e.g. SALE" /
  "e.g. Sale Made"), Category select with 7 localized options
  (Success/Failure/Callback/No Answer/Busy/DNC/Other), Trigger
  Retry checkbox + Retry Delay (minutes), Trigger Callback
  checkbox, Cancel + Saving.../Update/Add submit.
- **Contact Lists**: heading, empty state, plural counts
  (`{{count}} total/pending/completed`).
- **Pending Callbacks** + **History** section headings.
- **Stop dialog**: prefix/suffix split around `<strong>{name}</strong>`,
  Stop Campaign confirm label.
- **Disposition delete dialog**: title, description, confirm.

### Locales

`admin.json` (3 locales) — 80 keys added under
`admin.campaigns.{detail,dispositions}.*`. Plural forms
(`{{count}}`) used for contact-list summaries.

### Verification

Tests: 199/199 Vitest · 0 TS errors · prod build clean.
Post-pass scan of campaign-detail-page reports zero remaining
JSX text or `placeholder/title/aria-label/label` props.

### Coverage

Top hardcoded-strings file (43 hits) reduced to **0**. The
remaining audit findings are concentrated in
`partner/customer-detail-page` (29), `agent-assist-config-page`
(13), and a long tail of smaller files.

---

## [1.13.16] — 2026-04-30 — i18n Coverage Phase 4J (cross-namespace audit + Loading literals)

**Two systematic cleanups in one commit.** A repo-wide audit found
177 `t()` calls referencing keys missing from the JSON; 13 pages
also had bare `Loading…` literals slipping past the existing
i18n wiring. Both gaps are closed.

### Audit-driven JSON fills (177 keys across 3 namespaces)

A Python audit walked every `t('ns:key')` call in `src/`,
cross-referenced against `es-419/{admin,agent,common}.json`,
and flagged 177 missing keys. Filling these means switching
languages now actually translates these surfaces; previously
they fell through to inline English defaults (or rendered raw
key strings where no default was provided).

**`admin.json`** (172 keys added):

- `agents.extension` (1)
- `auth.*` (43): full auth-config, auth-events, auth-sessions
  pages — password policy, MFA policy, session timeouts, OIDC
  config, lockout, all event/session columns + relative-time
  formatters (`{{count}} min ago` / `{{count}} hr ago`).
- `campaigns.{launching, saving}` (2): launch + save in-flight
  states for the campaign wizard.
- `deadLetter.*` (22): full webhook DLQ page — title,
  description, all column headers, search, retry, pagination,
  empty state.
- `knowledge.*` (21): full KB form + list — title/content/tags/
  language/published fields with placeholders, hints, columns,
  empty/no-results, create/edit/delete confirmations.
- `retention.*` (22): retention-admin-page — all column
  headers, dry-run mode toggle, run-now buttons, confirm-purge
  dialog, error/empty states.
- `security_admin.audit.*` (34): full audit-viewer-page —
  6 columns, 11 filters with placeholders, 4 drawer tabs +
  before/after/no-diff/no-metadata + retention disclosure,
  3 export options.
- `setup.*` (22): full setup wizard — agent/queue/channel/test
  steps, validation messages, test-message bubbles, step
  instructions.
- `users.*` (10): user-detail — assign role, auth provider,
  force logout (with `{{name}}` interpolation), MFA status,
  last login, role list.

**`agent.json`** (4 keys): `context.knowledge`,
`knowledge.{empty_state, no_results, search_placeholder}`.

**`common.json`** (1 key): `cancel`.

### Loading literal sweep (13 files)

Replaced bare `Loading…` / `Loading...` JSX text in 13 pages
with `{t('common:status.loading')}`:

- admin: `bots`, `campaigns/list`, `campaigns/detail`,
  `canned-responses`, `features/agent-assist`, `reports`,
  `routes`, `skills`, `surveys`, `system/auth-events`,
  `trunks`, `agent-assist/config` (3 instances),
  `profile/security`.

`auth-config-page` and `role-detail-page` already used
`t('status.loading')` (resolves via `defaultNS=common`) and
were left untouched.

### Verification

- Re-running the audit shows **0 missing keys** across all
  scanned namespaces (admin, common, agent, analytics,
  operations).
- Tests: 199/199 Vitest · 0 TS errors · prod build clean.
- Side note: this commit reformats the 3 admin.json files
  (~172 deep insertions made the textual-append approach
  impractical). The reformat normalizes a few inline-style
  objects to multi-line; locale content is unchanged for any
  pre-existing key.

### Coverage

This brings every `t()` call site in the codebase to a
fully-resolvable key. Future i18n work can focus on
extracting _more_ hardcoded strings rather than backfilling
already-extracted-but-unmapped ones.

---

## [1.13.15] — 2026-04-30 — i18n Coverage Phase 4I (fill missing JSON keys for canned-responses + roles + webhooks)

**Closes the inline-fallback gap.** Three admin pages
(`canned-responses-page`, `roles-page`, `webhooks-page`) were
already calling `t('admin:…')` for every user-facing string but
had no matching JSON keys. Two of them (roles, webhooks) used
the inline-default-value pattern (`t(key, 'English fallback')`)
so the English UI worked but Spanish/Portuguese fell through to
the same English. Canned-responses had no fallbacks at all and
was rendering raw key strings (e.g. `cannedResponses.shortcut`)
in the column headers.

This phase adds the 35 missing JSON keys across 3 locales —
no TSX changes required. Switching languages now actually
translates these surfaces.

### Locales

`admin.json` (3 locales):

- **`cannedResponses`** — `title`, `create`, `shortcut`,
  `titleColumn`, `body`, `category`, `tags`, `searchPlaceholder`,
  `noResults`, `empty` (10 keys; section previously held only
  `entity_type`).
- **`roles`** — `title`, `description`, `create`, `name`,
  `name_placeholder`, `description_label`,
  `description_placeholder`, `template`, `no_template`, `clone`,
  `clone_name`, `default`, `custom`, `source`, `permissions`,
  `users` (16 keys; section previously held only `entity_type`).
- **`webhooks`** — `title`, `description`, `create`,
  `searchPlaceholder`, plus a new `columns` sub-section with
  `name`, `endpointUrl`, `eventTypes`, `status`, `created`
  (9 keys total under existing `webhooks.{status, detail, form,
entity_type}`).

### Verification

Tests: 199/199 Vitest · 0 TS errors · prod build clean.
Post-merge audit confirms zero missing-key gaps in these 3
files (40 total keys called, 40 found in es-419).

### Coverage

Three full pages move from "calls `t()` but renders English
everywhere" to fully localized. The remaining hardcoded strings
in these pages are limited to a `Loading…` literal in
canned-responses (cosmetic, deferred to a future polish pass).

---

## [1.13.14] — 2026-04-30 — i18n Coverage Phase 4H (remaining ConfirmDeleteDialog callers)

**Closes the entityType migration loop.** All 9 remaining
`ConfirmDeleteDialog` callers that were still passing English
literals into the now-localized template (which would render
as broken Spanglish like "Delete Bot?" inside an otherwise
Spanish UI) now read their entity noun from i18n.

### Migrated callers

| File                                               | Before                   | After (key)                         |
| -------------------------------------------------- | ------------------------ | ----------------------------------- |
| `admin/bots/bot-list-page.tsx`                     | `"Bot"`                  | `admin:bots.entity_type`            |
| `admin/canned-responses/canned-responses-page.tsx` | `"Canned Response"`      | `admin:cannedResponses.entity_type` |
| `admin/campaigns/campaign-detail-page.tsx`         | `"Campaign"`             | `admin:campaigns.entity_type`       |
| `admin/reports/reports-page.tsx`                   | `"Report"`               | `admin:reports.entity_type`         |
| `admin/roles/roles-page.tsx`                       | `"role"`                 | `admin:roles.entity_type`           |
| `admin/routes/routes-page.tsx`                     | `"Route"`                | `admin:routes.entity_type`          |
| `admin/surveys/survey-list-page.tsx`               | `"Survey"`               | `admin:surveys.entity_type`         |
| `admin/trunks/trunks-page.tsx`                     | `"Trunk"`                | `admin:trunks.entity_type`          |
| `admin/webhooks/webhooks-page.tsx`                 | `"webhook subscription"` | `admin:webhooks.entity_type`        |

### Locales

`admin.json` (3 locales):

- Added `entity_type` to existing sections: `bots`, `campaigns`,
  `reports`, `routes`, `surveys`, `trunks`, `webhooks`.
- Created new minimal sections: `cannedResponses.entity_type`
  and `roles.entity_type`. The full canned-responses and roles
  page i18n is a separate follow-up — those pages already call
  `t('admin:cannedResponses.*' / 'admin:roles.*')` keys with
  inline default-value fallbacks, so the existing display does
  not change.

`AuditTimeline entityType="user" / "campaign"` props are
intentionally **not** migrated — those are domain identifiers
sent to the audit log API, not display strings.

### Verification

Tests: 199/199 Vitest · 0 TS errors · prod build clean.

### Coverage

ConfirmDeleteDialog migration is now 100%: every literal-string
caller has been moved to `t()`. The remaining ~9 admin pages
themselves still have hardcoded copy (column headers, button
labels, etc.), but their delete dialogs now render correctly
in Spanish/Portuguese.

This concludes the broader Phase 4 i18n batch (4A → 4H, 9
sub-phases shipped 2026-04-29 / 2026-04-30).

---

## [1.13.13] — 2026-04-30 — i18n Coverage Phase 4F (flow designer + 11 node types)

**Closes the visual flow editor.** The XYFlow-based flow designer
is the most visual surface in admin — operators drag node types
from a palette, drop them on a canvas, and edit per-node
properties in a side panel. Every label, header, group title,
field label, and placeholder fallback is now translated.

### Refactored to `useTranslation`

**`src/admin/flows/node-palette.tsx`** — "Nodes" header, 4 group
titles (Standard / Routing / Integration / AI), 11 draggable item
labels (Send Message / Collect Input / Condition / Set Variable /
Wait / End / Enqueue / HTTP Request / Knowledge Search / AI
Classify / AI Generate). Refactored `PaletteItem.label` →
`labelKey` and `PaletteGroup.title` → `titleKey` so the data
shape carries i18n keys instead of frozen English strings.

**`src/admin/flows/property-panel.tsx`** — "Properties" header,
"No configurable properties." empty state, 14 unique field labels

- 2 disambiguating keys (`collect_input_variable` for "Save to
  Variable", `set_variable_name` for "Variable") so the same `data`
  key can carry different labels across node types. "Queue ID"
  input placeholder. Refactored `PropertyField.label` → `labelKey`
  under `flows.fields.*`.

**`src/admin/flows/flow-designer.tsx`** — default `flowName`
state value reads `flows.untitled` instead of hardcoded "Untitled
Flow".

**`src/admin/flows/flow-list-page.tsx`** — `handleCreate` payload
also uses `flows.untitled` so newly-created flows ship with a
locale-correct default name.

**11 node components in `src/admin/flows/nodes/`** — each pulls
its title from `flows.node_types.*` and any in-card fallback text
from `flows.node_body.*`:

- `send-message-node`: title + "No message" fallback.
- `collect-input-node`: title + "Ask..." prompt + "?" variable
  fallback.
- `condition-node`: title + "if ..." expression placeholder +
  "True"/"False" handle labels.
- `set-variable-node`: title + "var" / `""` fallbacks.
- `wait-node`: title + "0s" duration fallback.
- `end-node`: title + "hangup" disposition fallback.
- `enqueue-node`: title + "Queue" name fallback.
- `http-request-node`: title + "https://..." url placeholder
  (HTTP method `GET` left literal — it's a protocol token).
- `knowledge-search-node`: title + "input" query default + "query:"
  prefix label.
- `ai-classify-node`: title + 2 default categories ("Category 1",
  "Category 2") shown when none configured.
- `ai-generate-node`: title + "Generate..." prompt fallback.

`base-node.tsx` is a layout wrapper with no user-facing strings.

### Locales

Added under `admin.json` → `flows.*` (extends existing `flows.{title,
create, name, version, status, lastModified, publishedLabel, draft,
saveDraft, publish, ...}`):

- `flows.untitled`, `flows.nodes_header`, `flows.properties_header`,
  `flows.no_properties`, `flows.queue_id_placeholder`
- `flows.palette_groups.{standard, routing, integration, ai}`
- `flows.node_types.*` (11 keys)
- `flows.fields.*` (16 keys including the 2 variable-disambiguators)
- `flows.node_body.*` (16 keys for default placeholders, true/false
  handle labels, query prefix, etc.)

### Verification

Tests: 199/199 Vitest · 0 TS errors · prod build clean.

### Coverage

The 14 admin flow files (designer + list + toolbar + palette +
property-panel + 11 nodes) are now all translated. base-node
counts as scaffolding (no strings). Combined with prior phases,
admin coverage continues climbing.

This wraps the originally-planned Phase 4 i18n batch (4A → 4G).
The remaining ~10 untranslated admin files (bots, surveys,
reports, roles, routes-page, trunks-page, webhooks-page,
canned-responses, campaigns/campaign-detail) are smaller
follow-ups; their `entityType` callers will migrate as each
page is i18n'd.

---

## [1.13.12] — 2026-04-30 — i18n Coverage Phase 4G (confirm-delete-dialog + 9 callers)

**Translates the shared deletion dialog and migrates 9 already-i18n'd
callers to pass localized `entityType` props.** Until now those
callers were passing English nouns (e.g. `"rate card"`,
`"Caller ID Pool"`) into a hardcoded English template, producing
broken Spanglish like "Delete tarjeta de tarifa?" once the rest of
the page was translated. This phase closes that loop for the 9
callers whose containing pages are already localized; the remaining
~10 callers (bots, surveys, reports, etc.) will be migrated when
their respective pages are i18n'd in later phases.

### Refactored to `useTranslation`

**`src/core/ui/confirm-delete-dialog.tsx`** — sources all dialog
strings from `common.confirm_delete_dialog.*`. Title interpolates
the caller-provided `entityType`. Description uses split prefix /
suffix around the bolded entity name. The confirmation-word path
(used for high-stakes deletes like cluster force-drain) translates
the "Type X to confirm." instruction. Button label cycles through
`Wait {{seconds}}s...` → `Delete` → `Deleting...`.

### Migrated callers (9 files, 10 dialog instances)

- `src/agent/context/contact-info.tsx` — "Contact" →
  `agent.context.contact_entity_type`.
- `src/admin/billing/rate-cards-page.tsx` — "rate card" →
  `admin.billing.rate_cards.entity_label` (re-introduced after
  Phase 4A pruning, now with a real consumer).
- `src/admin/partner/partner-rate-cards-page.tsx` — "rate card" →
  `admin.partner.rate_cards.entity_type` (partner-specific so
  Spanish can read "tarjeta de tarifa de partner" vs. plain
  "tarjeta de tarifa").
- `src/admin/caller-id-pools/caller-id-pools-page.tsx` — "Caller
  ID Pool" → existing `admin.caller-id-pools.entity_type`.
- `src/admin/holiday-calendars/holiday-calendars-page.tsx` →
  existing `admin.holiday-calendars.entity_type`.
- `src/admin/dnc-lists/dnc-lists-page.tsx` → existing
  `admin.dnc-lists.entity_type`.
- `src/admin/tenants/tenants-page.tsx` — "tenant" →
  `admin.tenants.list.entity_type`.
- `src/admin/cluster/cluster-page.tsx` — TWO instances: regular
  remove (`admin.cluster.remove_entity`) and force-drain
  (`admin.cluster.force_drain_entity`, also keeps the literal
  `confirmationWord="FORCE"` typed-gate, untranslated by design).
- `src/admin/gdpr/gdpr-page.tsx` — TWO instances: contact-data
  (`admin.gdpr.purge.contact_entity_type`) and user-data
  (`admin.gdpr.purge.user_entity_type`).

### Locales

- `common.confirm_delete_dialog.{title, description_prefix,
description_suffix, type_to_confirm_prefix,
type_to_confirm_suffix, cancel, delete, deleting, wait_seconds}`
  added in 3 locales.
- New entity nouns: `agent.context.contact_entity_type`,
  `admin.billing.rate_cards.entity_label`,
  `admin.partner.rate_cards.entity_type`,
  `admin.tenants.list.entity_type`,
  `admin.gdpr.purge.contact_entity_type`,
  `admin.gdpr.purge.user_entity_type`.

### Test mocks

`tests/unit/core/ui/confirm-delete-dialog.test.tsx` — adds a
`react-i18next` mock with a small lookup table mapping the dialog's
9 keys back to their English values. This keeps existing
assertions (`expect(btn.textContent).toBe('Delete')` and
`/Wait/`) passing without coupling the test to internal key names.

### Verification

Tests: 199/199 Vitest · 0 TS errors · prod build clean.

### Coverage

`core/ui/confirm-delete-dialog` (1 file) is now translated;
9 callers migrated. The remaining ~10 untranslated callers will
be migrated as their respective pages get i18n'd (bots, surveys,
reports, roles, routes, trunks, webhooks, canned-responses,
campaigns/campaign-detail).

---

## [1.13.11] — 2026-04-29 — i18n Coverage Phase 4E-2 (DNC lists + GDPR)

**Closes the compliance surfaces.** DNC list management (CRUD +
detail with phone-add/check + CSV import wizard) and GDPR data
ops (export, contact/user purge with preview, retention policy
sheet, and purge log) — the screens compliance officers and DPO-
designate admins use daily.

### Refactored to `useTranslation`

**`src/admin/dnc-lists/dnc-lists-page.tsx`** — page header, Create
CTA, loading/empty/no-results, 4 column headers (Name/Scope/
Entries/Created), localized scope badge (Global/Campaign),
Create/Edit dialog (title, name + scope labels, scope options,
Cancel/Saving.../Update/Create).

**`src/admin/dnc-lists/dnc-list-detail.tsx`** — loading + not-
found states, Back button, scope_summary header with `{{scope}}`

- `{{count}}`, Import Numbers CTA, Add Number section + 2 input
  labels (phone/reason) + placeholders + Add button, Check Number
  section + button + result messages via `<Trans>` with `<strong>`
  component for `{{phone}}`, blocked-by-list suffix with `{{list}}`,
  not-blocked variant, Entries section + Importing.../Import CSV
  toggle, loading-entries, no-entries, 3 column headers, never
  expiry placeholder, Previous/`Page {{n}}`/Next pagination, remove
  ConfirmDialog (title/description/confirm).

**`src/admin/dnc-lists/dnc-import-wizard.tsx`** — dialog title,
3 step descriptions (upload/preview/result), drop hint + Browse
button, preview count `{{total}}/{{shown}}`, 2 column-mapping
labels + None option, imported count `{{count}}`, Back/Importing.../
Import/Done buttons.

**`src/admin/gdpr/gdpr-page.tsx`** — page header + description,
2 tab labels (By Contact / By User), Data Export card (heading,
contact-id label + placeholder, Exporting.../Export Data button,
summary heading + 5 lines with `{{count}}` interpolation +
Found/Not-found token, Download JSON), Data Purge card (heading,
2 warning paragraphs for contact vs user, contact-id/user-id
labels + placeholders, reason label + placeholder + length-
validation message, Purge Contact Data + Purge User Data buttons),
Preview button + heading + 4 preview-line labels, Purge Complete
result heading + Purge ID via `<Trans>` with mono `<span>` + per-
entity line.

**`src/admin/gdpr/purge-log-page.tsx`** — page header +
description, 7 column headers (Purge ID/Tenant ID/Subject/
Performed By/Reason/Entities Deleted/Purged At), filter labels
(Tenant ID + placeholder, From, To), Apply/Clear buttons, search
placeholder + no-results.

**`src/admin/gdpr/retention-policy-section.tsx`** — sheet title,
description split with embedded `<span>` for `{{tenantId}}`,
4 retention fields (label + description per entity type:
conversation/auth_event/audit/usage), Saving.../Save button,
days input placeholder + suffix. Refactored `RetentionFieldConfig`
to use `i18nKey: 'conversation' | 'auth_event' | 'audit' | 'usage'`
instead of hardcoded label/description strings.

### Locales

Added under `admin.json` (3 locales):

- `dnc-lists.*` (incl. `.detail.*` + `.import_wizard.*`)
- `gdpr.*` (incl. `.tabs.*`, `.export.*`, `.purge.*` shared
  between contact + user variants)
- `purge-log.*` (new top-level)
- `retention.policy.*` (extends existing `retention.{title, nav}`)

### Verification

Tests: 199/199 Vitest · 0 TS errors · prod build clean.

### Coverage

Admin section: 109/133 (82%) → 115/133 (86%).

This closes Phase 4E. Remaining: 4F (flows + 12 nodes — ~15
files) and 4G (`core/ui/confirm-delete-dialog` with caller
migration).

---

## [1.13.10] — 2026-04-29 — i18n Coverage Phase 4E-1 (webchat + cases + telephony admin)

**Closes 5 mid-tier admin features.** WebChat widget config, cases
CRUD, caller-ID pool management (list + detail), and holiday
calendar management (list + detail) — admin features used by
tenant managers configuring outbound dialing and customer
ticketing.

### Refactored to `useTranslation`

**`src/admin/webchat/webchat-page.tsx`** — page header + description,
Embed Snippet section heading + HTML badge + insertion instructions
(split prefix/suffix around `<code>`), Configuration section + 2
field labels (API URL, WebSocket URL).

**`src/admin/caller-id-pools/caller-id-pools-page.tsx`** — page
header + description, Create CTA, loading/empty/no-results, Name
column header, Create/Edit dialog (titles, name label, Cancel,
Saving.../Update/Create).

**`src/admin/caller-id-pools/caller-id-pool-detail.tsx`** — loading
state, not-found state, Back button, page description, Add Entry
section + 2 input labels, Adding.../Add button, Entries section
title with `{{count}}`, no-entries empty state, 3 column headers
(Phone Number, Area Code, Active), aria-label for Active switch.

**`src/admin/holiday-calendars/holiday-calendars-page.tsx`** — page
header + description, Create CTA, loading/empty/no-results, Name
column header, Create/Edit dialog (titles, name label, Cancel,
Saving.../Update/Create).

**`src/admin/holiday-calendars/holiday-calendar-detail.tsx`** —
loading/not-found states, Back button, page description, Add
Holiday section + 4 input labels (Name + placeholder, Date,
Allowed Start/End), Adding.../Add Holiday button, Holidays
section title with `{{count}}`, no-holidays empty, 4 column
headers.

**`src/admin/cases/cases-page.tsx`** — page header, Create CTA,
loading/empty/no-results, 6 column headers (Case #, Subject,
Priority, Status, Conversations, Created), localized priority
(Low/Normal/High/Urgent) + status (Open/Pending/Resolved/Closed)
labels in cells AND select options, Create/Edit case sheet (title
with `{{number}}` interpolation when editing, Subject + placeholder,
Priority + Status selects, Contact label + Change button + search
placeholder + min-chars hint, Assigned Agent label + Unassigned
option, Create/Update submit). `contactDisplayName` helper now
takes a fallback string parameter so the unnamed-contact label
stays translatable.

### Locales

Added top-level under `admin.json` (3 locales):

- `webchat.*`
- `caller-id-pools.*` (incl. `.detail.*` sub-section)
- `holiday-calendars.*` (incl. `.detail.*` sub-section)
- `cases.*` (incl. `.priority.*`, `.status.*`, `.form.*`)

### Verification

Tests: 199/199 Vitest · 0 TS errors · prod build clean.

### Coverage

Admin section: 104/133 (78%) → 109/133 (82%).

`entityType="Caller ID Pool"` / `"Holiday Calendar"` props on
ConfirmDeleteDialog left untranslated (interpolate into the
dialog's hardcoded English template — addressed when the dialog
itself is translated).

---

## [1.13.9] — 2026-04-29 — i18n Coverage Phase 4D (campaigns wizard + callbacks)

**Closes the campaigns wizard.** The 5-step campaign creation wizard
(Basic / Dialing / Schedule / Compliance / Contacts) is the most
visible long-form UX in admin — partner managers and tenant admins
walk through it whenever they spin up a new outbound campaign.
Plus the callbacks tab on campaign detail.

### Refactored to `useTranslation`

**`src/admin/campaigns/steps/basic-step.tsx`** — 4 input labels +
4 placeholders (Campaign Name, Description, Queue, Agent Team).

**`src/admin/campaigns/steps/dialing-step.tsx`** — Mode + Pacing
fieldset legends, 5 dialing-mode option labels + descriptions
(Preview/Progressive/Predictive/Power/Agentless), 3 pacing-strategy
option labels + descriptions (Fixed/Adaptive/Time-Based), Use
Global Defaults switch label + help, 3 global-readonly field
labels (Max Global Channels, Ring Timeout, Max Concurrent
Campaigns), 3 custom-pacing field labels (Lines per Agent, Target
Wait, Max Channels), Caller ID Pool label + help + select
placeholder + None option. Removed local `DIALING_MODES` /
`PACING_STRATEGIES` arrays-of-objects in favor of t-keyed lookups
on bare value arrays.

**`src/admin/campaigns/steps/schedule-step.tsx`** — Calling
Windows label, "to" connector, Timezone label, Start/End Date
labels, Holiday Calendar label + help + select placeholder + None
option, Manual Holiday Exclusions label + Add button.

**`src/admin/campaigns/steps/compliance-step.tsx`** — DNC List
label + help + select placeholder + None option + plural entry
count badge, 3 attempt-limit field labels (Max Attempts, Retry
Interval, Time Between Attempts), Compliance Rule Summary label

- placeholder.

**`src/admin/campaigns/steps/contacts-step.tsx`** — Upload Contact
List label, drop hint, Select File button, validation report
(File processed: {{name}}, plural counts for loaded/skipped/
duplicates/total_rows), Column Mapping label + skip option,
Preview header with `{{count}}` plural, +N more columns header,
empty cell placeholder, Upload Different File button.

**`src/admin/campaigns/callbacks-tab.tsx`** — Loading state,
Pending Callbacks heading, Schedule Callback CTA + dialog title,
empty state, contact label with `{{id}}` interpolation, 4 input
labels (Phone Number, Contact ID, Scheduled Time, Agent ID),
phone/agent placeholders, Cancel + Scheduling…/Schedule footer.

### Locales

Added under `admin.json` → `campaigns.{basic_step, dialing_step,
schedule_step, compliance_step, contacts_step, callbacks}`
(3 locales). Plural forms used for `compliance_step.dnc_entries`
and `contacts_step.preview_label`.

### Verification

Tests: 199/199 Vitest · 0 TS errors · prod build clean.

### Coverage

Admin section: 98/133 (74%) → 104/133 (78%).

---

## [1.13.8] — 2026-04-29 — i18n Coverage Phase 4C-2 (admin forms)

**Closes the 5 admin CRUD form sheets.** Webhooks, trunks, routes,
endpoint profiles, and dialer settings — the configuration entry
points platform admins use to provision the platform's plumbing.
Reuses existing `trunks.*`, `routes.*`, `realtime.*` field labels
from prior phases; new `*.form.*` sub-sections add only the
form-specific overrides (titles, descriptions, placeholders,
submit copy).

### Refactored to `useTranslation`

**`src/admin/webhooks/webhook-form.tsx`** — sheet title (create vs
edit), description, Name + placeholder, Endpoint URL + placeholder,
Active switch label (edit only), Event types group (label + error
fallback + loading state), submit button (Create/Save), Webhook
secret post-create dialog (title, description, HMAC warning, Done
button).

**`src/admin/trunks/trunk-form.tsx`** — sheet title (create vs
edit) + description, Name + placeholder, Display Name +
placeholder, Type label (reuses `trunks.type`) + select-type
placeholder, Max Channels label, Active switch label, submit
(Add/Save).

**`src/admin/routes/route-form.tsx`** — sheet title + description,
6 input labels (reuses `routes.{priority,pattern,patternType,
trunk}`), select-type/select-trunk/no-overflow/dial-prefix-optional
placeholders, submit (Add/Save).

**`src/admin/realtime/profile-form.tsx`** — sheet title + 9 input
labels (Name + placeholder, Type with Agent/Trunk options,
Transport, Codecs, Max Contacts, Context, Qualify Frequency,
WebRTC switch, Direct Media switch), submit (Add/Save).

**`src/admin/dialer-settings/dialer-settings-page.tsx`** — page
header (title + description), loading state, 4 section headings
(Capacity / Timing / Jitter / Blend Mode), 8 input field labels,
jitter help text, blend-mode label + help + aria, save button
(Saving…/Save Settings).

### Locales

Added under `admin.json` (3 locales):

- `webhooks.form.*` (new sub-section under existing `webhooks.*`)
- `trunks.form.*` (new sub-section)
- `routes.form.*` (new sub-section)
- `realtime.form.*` (new sub-section under realtime added in 4C-1)
- `dialer-settings.*` (new top-level, kebab-case to match URL)

### Verification

Tests: 199/199 Vitest · 0 TS errors · prod build clean.

### Coverage

Admin section: 93/133 (70%) → 98/133 (74%).

This wraps Phase 4C — all admin ops dashboards + forms now
i18n-ready. Next batches: 4D (campaigns/cases/holidays/dnc/
caller-id-pools/webchat/gdpr — ~14 files), 4E (flows + 12 nodes —
~15 files), 4F (`core/ui/confirm-delete-dialog` with caller
migration).

---

## [1.13.7] — 2026-04-29 — i18n Coverage Phase 4C-1 (admin ops dashboards)

**Closes the platform-admin operations surfaces.** Tenants, cluster,
system diagnostics, and endpoint profiles are the screens platform
operators (not partners) use to provision and observe the platform —
extracting hardcoded copy here unblocks Spanish/Portuguese rollouts
for the platform-admin role.

### Refactored to `useTranslation`

**`src/admin/tenants/tenants-page.tsx`** — page header, New CTA,
loading state, empty state, 5 column headers (ID/Name/Status/Max
Channels/Max Campaigns), 4 row-action tooltips (Retention, Manage
Billing, Suspend, Activate), Create sheet (title, description,
Tenant ID + placeholder, Name + placeholder, Max channels, Max
campaigns, Submit), Suspend confirm dialog (title + split
prefix/suffix description with embedded tenant name), Edit dialog
(title, 4 input labels, status select with 3 options, Cancel,
Saving…/Update).

**`src/admin/cluster/cluster-page.tsx`** — page header, Add Node
CTA, 4 SummaryCard titles (Nodes, Capacity, Agents, Instances) +
healthy count + capacity-of-max subtitles, search placeholder, no
nodes state, 6 column headers (Node ID/State/Max Capacity/Weight/
Tier/Asterisk + N/A fallback), 5 row dropdown actions (Edit, Drain,
Cancel Drain, Force Drain, Remove), Active Drains section title +
plural calls remaining/completed/force-disconnected + Cancel/Force
buttons, Platform Instances section title + empty state +
last-seen/channels/owned-nodes labels, Add Node sheet (title,
description, 8 input labels + 2 placeholders, submit), Edit Node
sheet (title with `{{nodeId}}` interpolation, 3 input labels,
submit), Drain Node dialog (title, prefix/suffix description with
embedded `{{nodeId}}`, grace period label, Cancel/Submit).

**`src/admin/system/diagnostics-page.tsx`** — page header, loading
state, 4 status pill labels (connected/error/warning/unknown), 3
StatusCard titles (Platform/License/Cluster), 9 field labels
across cards (Version, Tenant, Setup, Status, Max Nodes, Features,
Nodes, Total Channels, Total Agents) + Complete/Pending badge +
N/A fallback + Manage cluster link + auto-refresh footer.

**`src/admin/realtime/realtime-page.tsx`** — page header (title +
description), Seed Defaults + Create Profile CTAs, loading state,
empty state, search placeholder, no-results message, 6 column
headers (Name/Type/Default/Transport/Codecs/WebRTC) + Default
badge, Delete confirm dialog (title, description with `{{name}}`
interpolation, Confirm).

### Locales

Added under `admin.json` (3 locales):

- `tenants.list.*` (new sub-section under existing `tenants.{detail,
settings}` block)
- `cluster.*` (new top-level — distinct from existing
  `cluster-nodes.detail` for the node-detail drawer)
- `system.diagnostics.*` (new sub-section under existing `system.*`
  block)
- `realtime.*` (new top-level)

Plural forms (`_one`/`_other`) used for cluster `drains.remaining`.

### Verification

Tests: 199/199 Vitest · 0 TS errors · prod build clean.

### Coverage

Admin section: 89/133 (67%) → 93/133 (70%).

`entityType="tenant"` / `"node"` / `"force drain on node"` props
on `ConfirmDeleteDialog` left untranslated — they interpolate into
the dialog's hardcoded English `Delete {{entityType}}?` template,
which will be addressed when `core/ui/confirm-delete-dialog`
itself is translated (deferred phase).

---

## [1.13.6] — 2026-04-29 — i18n Coverage Phase 4B (partner portal)

**Closes the partner portal CRUD surfaces.** The 4 partner pages
(customers, rate cards + form, settings) are how partner managers
provision and price their downstream tenants — extracting hardcoded
copy here unblocks Spanish/Portuguese partner deployments.

### Refactored to `useTranslation`

**`src/admin/partner/`**

- `customers-page.tsx` — page header, Add customer CTA, 5 column
  headers (Name, Tenant ID, Status, Plan, Created), search
  placeholder, Create Customer dialog (full: title, description,
  Tenant ID + placeholder, Display name + placeholder, Plan,
  Template + None option, Cancel/Creating…/Create), Edit Customer
  sheet (title, description, Name, Max channels/campaigns + shared
  "Leave empty to keep current" placeholder, Cancel/Saving…/Save).
- `partner-rate-cards-page.tsx` — page header, New CTA, search
  placeholder. Column headers + Default badge + plural entries cell
  reuse `billing.rate_cards.*` keys (identical copy).
- `partner-rate-card-form.tsx` — sheet titles reuse
  `billing.rate_cards.form.{create_title,edit_title}`; descriptions
  and name placeholder are partner-specific (partner pricing /
  Standard partner pricing). All other form labels (Name, Currency,
  Effective from/to, Default rate card, Rate entries, Add rate,
  Rate #, Unit price, Included qty, Select usage type, Create/Save)
  reuse `billing.rate_cards.form.*` to avoid duplication.
- `partner-settings-page.tsx` — page header, Edit settings CTA,
  loading state, Operational settings heading, 3 Field labels
  (Platform name, Default timezone, Default language), platform-
  managed-by-admin note, Edit dialog (title/description, 3 input
  labels with locale-aware tz/lang placeholders, Cancel/Saving…/
  Save).

### Locales

Added under `admin.json` → `partner.{customers, rate_cards, settings}`
(3 locales: es-419, en-US, pt-BR).

`partner.rate_cards.form.{create_description, edit_description,
name_placeholder}` are intentionally narrow — only partner-specific
overrides; other rate-card form keys are shared with billing.

### Verification

Tests: 199/199 Vitest · 0 TS errors · prod build clean.

### Coverage

Admin section: 85/133 (64%) → 89/133 (67%).

---

## [1.13.5] — 2026-04-29 — i18n Coverage Phase 4A (admin shared + billing)

**Closes the billing surface and shared admin building blocks.** Rate
cards, invoices, quotas, and usage are the screens billing operators
and tenant admins use daily; the admin shared components (data-table,
confirm-dialog, contact-search-panel, placeholder-page) propagate
translated copy across every CRUD surface that consumes them.

### Refactored to `useTranslation`

**`src/admin/shared/`**

- `placeholder-page.tsx` — `Pending implementation` body label.
- `data-table.tsx` — search placeholder default, no-results default,
  pagination footer (`Page X of Y`, Previous, Next). Default props for
  `searchPlaceholder` / `noResultsMessage` are now derived from i18n
  when the caller omits them, preserving call-site overrides.
- `confirm-dialog.tsx` — Cancel and Confirm button defaults; caller
  may still override `confirmLabel`.
- `contact-search-panel.tsx` — search placeholder, searching/empty
  states, min-chars hint, Unknown name fallback.

**`src/admin/billing/`**

- `rate-cards-page.tsx` — page header title/description, New rate
  card CTA, table column headers (Name, Currency, Default, Effective
  from/to, Rates), `{count} entries` plural cell, search placeholder,
  Default badge, no-tenant message via `<Trans>` (Tenants page link).
- `rate-card-form.tsx` — sheet title/description (create vs edit),
  form labels (Name, Currency, Effective from/to, Default rate card),
  rate-entries list (Rate #, Add rate, no-entries hint, Unit price,
  Included qty, Select usage type), submit button label.
- `invoices-page.tsx` — page header, Generate invoice CTA, table
  column headers (Invoice, Period, Total, Status, Generated), search
  placeholder, no-tenant message, Generate dialog (title, description,
  Period start/end, Cancel, Generating…/Generate), Invoice detail
  sheet (Subtotal, Tax, Total, Issued/Due dates, Line items + per-row
  `{type} · {qty} units @ {price}` summary).
- `quotas-page.tsx` — page header, Edit quotas CTA, dunning banner
  (Account overdue, `{count} day(s) overdue`, overdue amount, View
  Invoice), no-quota empty state, Enforcement label, all 6 QuotaRow
  labels, edit dialog title/description, all 7 input labels, save
  button (Saving…/Save), no-tenant message via `<Trans>`.
- `usage-page.tsx` — page header, filter labels (From, Until, Type,
  All types), Usage by type chart heading, summary cards `{count}
records` plural, Detailed records heading, search placeholder, all
  6 table column headers (Time, Type, Quantity, Unit, Channel,
  Reference), no-tenant message via `<Trans>`.

### Locales

Added under `admin.json` (3 locales: es-419, en-US, pt-BR):

- `shared.{placeholder_pending, data_table.*, confirm_dialog.*,
contact_search.*}`
- `billing.{select_tenant_*_prefix/suffix, tenants_link, rate_cards.*,
invoices.*, quotas.*, usage.*}`

Plural forms (`_one` / `_other`) used for `entries_count`,
`records_count`, and dunning `days`.

### Test mocks

`tests/unit/admin/partner/revenue-{chart,csv}.test.tsx` —
`react-i18next` mock now interpolates `{{key}}` placeholders when
the second argument is an object (was previously treating it as a
default-string fallback). Required because these tests render
`PartnerRevenuePage` → `DataTable`, which now uses interpolation for
`Page {{current}} of {{total}}`. Also added a `Trans` stub.

### Verification

Tests: 199/199 Vitest · 0 TS errors · prod build clean · lint:
167 pre-existing errors, no new errors introduced.

### Coverage

Admin section: 76/133 (57%) → 85/133 (64%).

Skipped (no user-facing strings): `page-header.tsx`, `empty-state.tsx`
(both accept all text via props).

Deferred to a follow-up phase: `core/ui/confirm-delete-dialog.tsx` —
shared dialog used by every CRUD delete; needs coordinated update of
all callers and a `common`-namespace keyset.

---

## [1.13.4] — 2026-04-28 — i18n Coverage Phase 3 (analytics + operations)

**Closes the highest-traffic supervisor surfaces.** The wallboard,
digital monitor, and analytics dashboards are the screens supervisors
and managers spend the most time on. Phase 3 extracts hardcoded strings
across the analytics dashboard, agent intervals, CDR transcript, and
operations digital-monitor + wallboard live states.

### Refactored to `useTranslation`

**`src/analytics/`**

- `agents/agent-intervals-page.tsx` — page title (`Agent Intervals`),
  table headers (Agent, Interval, Handled, AHT, Occupancy, RNA,
  Transfers), empty state, loading state.
- `dashboard/overlay-chart.tsx` — `volumeLabel` / `slaLabel` /
  `emptyLabel` props now fall back to translated `dashboard.volume_label`
  / `dashboard.sla_label` / `dashboard.no_data` instead of hardcoded
  English defaults.
- `dashboard/current-interval-card.tsx` — title + 4 metric labels
  (Offered, Answered, SLA, AHT).
- `dashboard/bot-analytics-card.tsx` — card title (`Bot Performance`),
  4 KPI labels, 3 progress-bar tooltip prefixes, 3 legend labels.
- `dashboard/heatmap.tsx` — `dayLabels` prop now defaults to translated
  `dashboard.day_*` keys; `emptyLabel` falls back to `dashboard.no_data`.
- `cdr/synced-transcript.tsx` — speaker badges (Agent / Caller).

**`src/operations/`**

- `monitor/digital-conversation-detail.tsx` — Takeover / Close buttons,
  empty state ("No messages yet"), Coaching Note label + placeholder,
  Takeover dialog title + description, Close dialog title + description.
- `monitor/digital-monitor-tab.tsx` — empty list message, "Select a
  conversation to monitor" instruction.
- `wallboard/wallboard-page.tsx` — empty state, "Live Queue States"
  heading, plus 4 inline labels (Available, On Call, Paused, Wrap-Up)
  on each live-state card.

### Skipped (no user strings)

- `analytics/dashboard/kpi-card.tsx`, `trend-chart.tsx` — pure
  prop-renderers / composition.
- `analytics/cdr/waveform-player.tsx`, `audio-player.tsx` — only
  numeric speed selectors and timer formatting.
- `analytics/qa/score-gauge.tsx` — pure numeric data display.
- `operations/monitor/session-card.tsx` — pure data render.

### Added translation keys

**`analytics.json`** (3 locales):

- `agent_intervals.{title,col_agent,col_interval,col_handled,col_aht,col_occupancy,col_rna,col_transfers,empty}`
- `current_interval.{title,offered,answered,sla,aht}`
- `bot_analytics.{title,conversations,resolution,handoff,avg_turns,resolved_prefix,handed_off_prefix,failed_prefix,resolved_label,handoff_label,failed_label}`
- `transcript.{agent,caller}`

**`operations.json`** (3 locales):

- `monitor.{no_digital_sessions,select_to_monitor,no_messages_yet,takeover,close,coaching_note_label,coaching_note_placeholder,takeover_dialog_title,takeover_dialog_desc,close_dialog_title,close_dialog_desc}`
- `wallboard.{on_call,paused,live_queue_states,empty}`

### Tests

- 199/199 Vitest unchanged · 0 TS errors · 42 test files.

### Coverage check

analytics/ moved from 12/24 (50 %) to **18/24 (75 %)**; operations/
moved from 10/14 (71 %) to **13/14 (93 %)**. The remaining 6 files
across both areas are pure data-display / composition with no user
strings. Repo-wide: **153/267 ≈ 57 %** (was 144/267 ≈ 54 %).
Visibility-weighted gain is again significantly larger because the
wallboard + digital monitor are the supervisor's daily home screens.

---

## [1.13.3] — 2026-04-28 — i18n Coverage Phase 2 (agent workspace)

**Closes the agent workspace gap.** The agent UI is the highest-traffic
surface in production tenants — every conversation touches it. Phase 2
extracts the remaining hardcoded strings so toggling to `en-US` /
`pt-BR` produces a fully-translated experience for the agent role,
including date-fns relative time in the user's locale.

### Refactored to `useTranslation`

**`src/agent/conversation/`**

- `reply-composer.tsx` — `Write your reply…` placeholder, attach-file
  tooltip + aria-label, send tooltip + aria-label, `Ctrl+Enter` shortcut
  hint, attachment remove `aria-label` with `{{name}}` interpolation.
- `canned-responses.tsx` — search placeholder, search hint
  ("Start typing…"), loading state, empty state.
- `message-bubble.tsx` — image `alt` fallback, file fallback, plus
  `formatTimestamp` now uses the active i18next language for
  `date-fns` (was hardcoded `'h:mm a'` / `'MMM d, h:mm a'`; now `'p'` /
  `'PP p'` with the locale).

**`src/agent/inbox/`**

- `new-conversation-dialog.tsx` — title, contact label, search
  placeholder, change button, channel label, initial-message label +
  placeholder, submit button, "Unnamed contact" fallback.
- `inbox-item.tsx` — `formatDistanceToNow` now uses the active
  i18next-resolved `date-fns` locale.
- `agent-status-selector.tsx` — replaced the `label` field on each
  `AGENT_STATUSES` entry with a `labelKey` (`agent_status.*`), so all 8
  states (Available, Busy, Break, Lunch, Training, DND, ACW, Offline)
  translate.

### Skipped (no user strings)

- `message-thread.tsx` — pure composition.
- `system-event.tsx` — message text comes from backend data; only the
  icon is selected client-side.
- `sentiment-gauge.tsx` — speaker / label come from backend AI output.

### Added translation keys (under `agent.json`, all 3 locales)

- `composer.{attach_file,send,send_shortcut,remove_attachment}` (the
  last with `{{name}}` interpolation).
- `messages.{image_alt,file_fallback}`.
- `new_conversation.{title,contact,channel,initial_message,message_placeholder,search_placeholder,change,submit,unnamed_contact}`.
- `agent_status.{available,busy,on_break,lunch,training,dnd,acw,offline}`.
- `canned.{search_hint,loading}` (alongside existing
  `canned.search_placeholder` and `canned.no_results`).

### Tests

- 199/199 Vitest unchanged · 0 TS errors · 42 test files · prod build
  703 ms.

### Coverage check

agent/ moved from 15/24 (62 %) to **21/24 (88 %)**. The remaining 3
files (`message-thread`, `system-event`, `sentiment-gauge`) have no
user-facing strings — only data render and composition — so they are
effectively complete. Combined repo-wide coverage:
**144/267 ≈ 54 %** (was 138/267 ≈ 52 %); visibility-weighted gain is
again significantly larger because the agent workspace is the
highest-frequency surface for active users.

---

## [1.13.2] — 2026-04-28 — i18n Coverage Phase 1 (shell + pages + auth)

**Direct follow-up to 1.13.1.** Closes the highest-visibility part of the
i18n coverage gap documented in
`docs/research/i18n-coverage-gap-2026-04-28.md`. Switching to `en-US` or
`pt-BR` now produces a fully-translated experience across the parts of
the app every user touches on every session: the notification drawer
(seen on every page via the bell badge), the unauthorized error page
(rendered on RBAC failure), the agent workspace shell (visible to every
agent on every conversation), and the impersonation banner (visible to
support staff acting on tenant context).

### Refactored to `useTranslation`

- `src/shell/notification-bell.tsx` — accessible label
  (`notifications.aria_label_with_count` with `count` interpolation).
- `src/shell/notification-drawer.tsx` — sheet title, "Mark all read",
  "Loading…", "No notifications", "Load more", and the 5 category tabs
  (All, Operational, System, Security, Billing) keyed under
  `notifications.category.*`. Replaced the duplicated `CATEGORIES`
  array with a slim `CATEGORY_VALUES` list since labels now come from
  the translation table.
- `src/shell/notification-item.tsx` — `formatDistanceToNow` now uses the
  active i18next language to render `date-fns` relative time in the
  user's locale (e.g., "hace 5 minutos" / "5 minutes ago" /
  "há 5 minutos").
- `src/pages/unauthorized.tsx` — 403 title, description, "Go Home"
  button (`errors.*`).
- `src/pages/agent/agent-layout.tsx` — context-panel toggle `title`
  attribute.
- `src/pages/agent/conversation-view.tsx` — empty-state "Select a
  conversation".
- `src/core/auth/impersonation-banner.tsx` — "Operating as", "Read-Only"
  badge, "End Impersonation" button.

### Added translation keys

Under `common.json` for all 3 locales:

- `notifications.{title,aria_label,aria_label_with_count,mark_all_read,load_more,loading,empty,category.*}`
- `errors.{unauthorized_title,unauthorized_description,go_home}`
- `agent_layout.{toggle_context,select_conversation}`
- `impersonation.{operating_as,read_only,end}`

### Out of scope (still hardcoded — follow-up)

The remaining 8 files in the original Phase-1 list are pure
composition / routing wrappers with no user-visible strings
(`app-shell.tsx`, `rail-icon.tsx` — receives label as prop,
`admin-layout.tsx`, `operations-layout.tsx`, `analytics-layout.tsx`,
`auth-guard.tsx`, `permission-guard.tsx`, `role-guard.tsx`). They are
counted in the coverage gap purely on the `useTranslation` import
heuristic; no functional translation work is needed there.

### Tests

- 199/199 Vitest unchanged · 0 TS errors · 42 test files · prod build
  717 ms. No new test files; existing tests cover the refactored code
  (the `notification-item.test.tsx` already mocks `react-i18next`).

### Coverage check

7 files moved from "hardcoded" to "wired"; 138/267 `.tsx` files
(≈52 %) now use `useTranslation` (was 131/267 ≈ 49 %). The
visibility-weighted improvement is significantly larger than the 3-pp
raw-count gain, because the touched files are present on every page
view (notification bell + impersonation banner) or on the highest-
traffic surface (agent workspace).

---

## [1.13.1] — 2026-04-28 — Language Switcher + i18n Persistence

**First user-facing i18n feature.** Brings the existing translation
infrastructure (15 JSON bundles, 131 components already wired with
`useTranslation`) within reach of end users, who previously had no way
to change away from the default `es-419`.

### Added

- `i18next-browser-languagedetector` integrated into the i18n init
  (`src/core/i18n/i18n.ts`). Detection order: `localStorage` →
  `navigator` → `htmlTag`. Persisted in `localStorage` under the key
  `asterisk.lang`.
- `LanguageSwitcher` component (`src/core/i18n/language-switcher.tsx`)
  with two variants:
  - `icon` — globe icon button (used in unauthenticated screens).
  - `inline` — short-code chip with globe icon (default).
- Login page (`src/core/auth/login-page.tsx`) — language switcher
  pinned to top-right corner so users can pick their language before
  authenticating.
- User menu (`src/shell/user-menu.tsx`) — language sub-menu added next
  to the existing theme sub-menu, with check-mark indicating the active
  language.
- Translation keys for the switcher in all three locales (`common.json`):
  `language.label`, `language.es-419`, `language.en-US`,
  `language.pt-BR`, plus `theme.label` for symmetry with the new sub-menu.
- 6 Vitest unit tests covering: inline/icon variants, default variant,
  unknown-language fallback, prefix-match resolution, and click-to-switch.

### Exported

- `SUPPORTED_LANGUAGES` and `SupportedLanguage` type from
  `@/core/i18n/i18n` so the user menu (and any future consumer) can
  iterate the canonical list without duplication.
- `LANGUAGE_STORAGE_KEY` (`asterisk.lang`) for tooling that needs to
  read or clear the persisted choice.

### Tests

- 199/199 Vitest (was 193/193) · 0 TS errors · 42 test files (was 41).

### Known coverage gap

136 of 267 `.tsx` files (≈51 %) still hold hardcoded strings (default
`es-419`). That gap is now visible — switching to English or Portuguese
will only translate the ≈49 % of components already wired. A follow-up
plan (`docs/research/i18n-coverage-gap-2026-04-28.md`) catalogues the
gap by domain so subsequent work can extract strings incrementally
without blocking this slice.

---

## [1.13.0] — 2026-04-27 — Track Platform 1.14.0 "AHH Auth Hotpath Hardening"

**Cosmetic version bump only — no source change.** Coordinated with the
Platform-side AHH (Auth Hotpath Hardening) train shipped 2026-04-27 as
`Verbara.Platform 1.14.0`. AHH lifts the `POST /auth/login` knee from
~75 req/s → ~220 req/s single-replica (~880 req/s 4-replica aggregate
projected) via:

1. Hot-read caching (`CachedTenantAuthConfigStore` + `CachedUserStore`)
   with cross-replica Redis pubsub invalidation.
2. Write-path deferral via `AuthWriteQueue` (`LastLoginAt`, lockout
   reset, success-path `AuthEvent` move off the request critical path;
   failure-path audit logging stays synchronous).
3. JWT rotation pool wire-up + RS256-aware `JwtKeyEntry` schema +
   `RedisJwtKeyStore` CAS upsert + multi-replica startup gate.
4. Argon2id password migration (OWASP-2025 floor m=19 MiB, t=2, p=1)
   with on-login transparent rehash from legacy BCrypt12.
5. Horizontal scaling baseline + operations runbook + 5 ADRs (0010-0014).

The login API contract is unchanged — token shape, refresh-token
semantics, MFA challenge flow, lockout responses all preserve verbatim
behavior. The Web UI is byte-identical to 1.12.0 builds; only `package.json`
moves to keep the version-track convention with the Platform release.

### Changed

- **Bump to track Platform 1.14.0:** `package.json` version 1.12.0 → 1.13.0.

### Tests

- 193/193 Vitest unchanged · 0 TS errors · 41 test files.

---

## [1.12.0] — 2026-04-26 — R5.4 "Production Validation"

**Final release of the R5 Production Readiness Release Train.** Coordinated
ship with **Pro 1.15.0-pro** + **Platform 1.13.0**. No frontend feature
changes — Web 1.12.0 bump is exclusively to track the Platform 1.13.0
contract (Pro NU1902 fix + JWT rotation infrastructure + suspend reason
payload + IAgentTenantResolver required-by-default).

### Changed

- **Bump to track Platform 1.13.0:** `package.json` version 1.11.0 → 1.12.0.

### Tests

- 193/193 Vitest unchanged · 0 TS errors · 41 test files.

### R5 train acceptance

R5.1 (1.9.0) + R5.2 (1.10.0) + R5.3 (1.11.0) + R5.4 (1.12.0) — **R5 Production
Readiness Release Train COMPLETE**. R4 Track A previously declared COMPLETE
in R5.3.
