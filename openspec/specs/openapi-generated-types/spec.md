# openapi-generated-types Specification

## Purpose

Generates and maintains TypeScript types from Platform's published OpenAPI document
(`openapi-typescript`, committed `src/core/api/generated/openapi.d.ts`), so wire-shape
drift between this repo's hand-written consumer interfaces and the real Platform contract
is caught at compile time (`tsc -b`) instead of silently at runtime — the failure class
that caused the csat-runner incident (v3.13.1-web). Migration is phased and adopted
**only where the generated document actually carries a matching named schema**: this
capability covers the codegen tooling + the CSAT analytics slice
(`useCsatQueueAnalytics`/`CsatResponseDto`) + the Admin module's genuine structural
matches (`openapi-typed-client-admin`, archived 2026-07-16 — 6 of 44 Admin hook files
migrated). The migratable surface is bounded by an **upstream response-schema scarcity**:
Platform's captured OpenAPI document emits request bodies (`*Request`) and nested
value-object `*Dto`s but almost no top-level response DTOs, so most consumer response
interfaces have no generated schema to swap onto, and most request schemas diverge
(optional→required-nullable, `number`→the AOT `number | string` union, literal unions
widened to `string`) — a swap there would break the hook's public type, which the
structural-match discipline forbids. Hooks with no clean match stay hand-written, by
design, until that upstream bound moves. The remaining Agent/Analytics/Operations module
children are HELD as backlog pending a cross-repo thread that has Platform emit named
response DTOs in its OpenAPI document (see those children's proposals). The realtime
SignalR boundary (`src/core/realtime/platform-hub.ts`) is explicitly out of scope — no REST
paths, not representable in an OpenAPI document (ADR-0020's deferred follow-up, owner: Pro).

## Requirements

### Requirement: Generated types are produced from Platform's OpenAPI document

The repo SHALL generate TypeScript types from the OpenAPI document published by the
Platform Api host via `openapi-typescript`, and SHALL commit the generated output as a
single declaration file refreshed by an npm script — not fetched at CI build time. The
generated types are the single source of truth for any wire shape they cover; hand-written
interfaces for those shapes MUST be removed once migrated **and only where the document
carries a matching named schema** — a hook whose response shape has no generated schema, or
whose generated request schema diverges (optional→required-nullable, `number`→the AOT
`number | string` union, literal unions widened to `string`), stays hand-written by design,
not as a defect. The capability's migration is phased: Phase 1 (archived,
`openapi-typed-client`) covers tooling + the CSAT analytics slice; the Admin phase
(`openapi-typed-client-admin`, archived 2026-07-16) migrated **6 of its 44 hook files** —
the genuine clean matches — and left the other 38 hand-written because Platform's document
emits almost no top-level response DTOs (the upstream response-schema scarcity described in
the Purpose). Platform's real OpenAPI document is LIVE as a CI artifact (Platform/ADR-0035 +
the `ci.yml` "Export OpenAPI document (CI-runtime capture)" step) and the committed
`openapi.d.ts` is generated from it (324 paths, 182 schemas); the tooling is unblocked, but
the _migratable surface_ is capped by that scarcity. The remaining per-module children
`openapi-typed-client-agent`, `-analytics`, and `-operations` are HELD as backlog pending a
cross-repo thread to have Platform emit named response DTOs — until then their migratable
surface would be as thin as Admin's.

#### Scenario: Generated file matches the golden envelope shape

- **GIVEN** the OpenAPI document envelope matches the golden fixture
  `Verbara.Platform/openspec/changes/archive/2026-07-12-openapi-typed-client/fixtures/openapi-document.v1.sample.json`
  — a document with top-level `openapi`, `info`, `paths`, and `components.schemas` keys
- **WHEN** `npm run generate:api-types` runs against that document
- **THEN** the generated declaration file exposes a type for the
  `components.schemas.CsatResponseDto` schema reachable from the document's
  `paths` entry for `/api/v1/analytics/csat/queues/{queueId}`

#### Scenario: Build fails on drift between generated types and a consumer

- **GIVEN** a hook consumes a generated type via `customFetch<T>`
- **WHEN** the generated declaration file's shape no longer matches how the hook uses it
  (e.g. a field renamed upstream)
- **THEN** `tsc -b` (the existing blocking `build` CI job) fails, surfacing the drift at
  compile time instead of at runtime

#### Scenario: Unmigrated hooks remain hand-written until their own phase lands

- **GIVEN** a hook outside the CSAT slice still declares its own hand-written
  request/response interface
- **WHEN** the repo is at any commit between Phase 1's archive and a later migration phase
  for that hook
- **THEN** the hand-written interface is expected and not itself a defect — only the CSAT
  slice's `CsatQueueSummary` was required to be removed by Phase 1

### Requirement: CSAT analytics hook consumes the generated CsatResponseDto type

`useCsatQueueAnalytics` in `src/core/api/hooks/use-analytics.ts` SHALL consume the
generated type for the `CsatResponseDto` schema instead of the hand-written
`CsatQueueSummary` interface it replaces. The generated type's fields MUST match the
golden wire fixture verbatim — the same fixture cited by the csat-runner train's Web
child: `Verbara.Platform/openspec/changes/archive/2026-07-12-openapi-typed-client/fixtures/openapi-document.v1.sample.json`,
schema name `CsatResponseDto`, with these 6 fields exactly:

- `queueName`
- `channel`
- `totalResponses`
- `averageRating`
- `rangeStart`
- `rangeEnd`

served at the sample path `/api/v1/analytics/csat/queues/{queueId}`. This matches the
golden wire fixture verbatim.

#### Scenario: Hook return type carries every fixture field

- **GIVEN** `useCsatQueueAnalytics` resolves a successful response
- **WHEN** a caller reads the resolved data's fields
- **THEN** the type exposes exactly `queueName`, `channel`, `totalResponses`,
  `averageRating`, `rangeStart`, and `rangeEnd`, matching the golden fixture's
  `CsatResponseDto` schema field-for-field with no extra or renamed keys

#### Scenario: No hand-written duplicate remains for the migrated shape

- **GIVEN** the CSAT slice has migrated to the generated type
- **WHEN** the repo is searched for a hand-written `CsatQueueSummary` interface
  declaration
- **THEN** none remains in `src/core/api/hooks/use-analytics.ts` — the generated type is
  the only declaration of that shape

### Requirement: Realtime SignalR payloads remain hand-written and out of scope

The 4 hand-written hub payload interfaces in `src/core/realtime/platform-hub.ts`
(`PresenceUpdatedPayload`, `SupervisionStartedPayload`, `WhisperReceivedPayload`, and the
hub connection state mapping) SHALL NOT be migrated to generated types by this capability.
Hub messages have no REST paths and are not representable in the OpenAPI document this
capability consumes.

#### Scenario: Hub payload interfaces are untouched

- **GIVEN** `src/core/realtime/platform-hub.ts` declares its 4 hand-written payload
  interfaces
- **WHEN** the CSAT slice (or any future phase of this capability) migrates hook types to
  generated types
- **THEN** `platform-hub.ts`'s interfaces are not modified, removed, or replaced — that
  boundary is ADR-0020's deferred follow-up (owner: Pro), explicitly out of scope

### Requirement: Numeric AOT wire unions get a tracked normalization decision before proliferating

Fields whose generated type is a `number | string` union (Platform's AOT-safe numeric wire
encoding) MUST NOT each grow an independent, ad-hoc normalization at every new call site
once a second and third migrated hook hits the same pattern. The repo SHALL track the
decision of whether to introduce a shared coercion helper (vs. continuing per-hook
`select`/cast normalization) as an open design question until at least 3 concrete migrated
call sites exist to generalize from. **The tally stands at 2 genuine active sites**, both in
`use-analytics.ts`: `CsatResponseDto` (phase-1) and `CsatAggregateAnalyticsDto` (archived
`2026-07-14-csat-completion`). The `openapi-typed-client-admin` child (archived 2026-07-16)
adopted no numeric-bearing generated schema, so it added **0 new active sites** — the ≥3
threshold is not yet reached; its `tasks.md` logs the latent candidates that would flip active
if a future phase adopted their schema. `ai-credits-readout.tsx`'s `as number` casts
(a hand-written `number | null` nullable-narrowing gap) do NOT count as such a site.

#### Scenario: A second migrated hook hits the same union pattern

- **GIVEN** `useCsatQueueAnalytics` already normalizes `totalResponses`/`averageRating` via
  a per-hook `select`
- **WHEN** a subsequent migration phase migrates another hook whose generated type also
  exposes a `number | string` union field
- **THEN** the design decision recorded in the archived
  `openapi-typed-client-phase2/design.md` (open question 3, resolved: defer the shared helper
  until ≥3 genuine sites; the `openapi-typed-client-admin` child gathers the sites) is revisited
  with the new data point before a third ad-hoc normalization is added, rather than silently
  repeating the pattern indefinitely

### Requirement: Admin module hooks adopt generated types where a genuine match exists

Across the 44 Admin-module hook files under `src/core/api/hooks/`, each hook SHALL adopt the
generated type from `src/core/api/generated/openapi.d.ts` (behind `client.ts`'s existing
generic `<T>`, swap-the-T) **only where the generated document carries a matching named
schema that is an exact structural match or a non-breaking superset** of the hand-written
interface. A hook whose response shape has no generated schema, or whose generated request
schema diverges (optional→required-nullable, `number`→the AOT `number | string` union,
literal unions widened to `string`), SHALL stay hand-written — a forced swap there would
break the hook's public type, which the structural-match discipline forbids. Where a shape
IS adopted, its hand-written interface MUST be removed and every usage (component props,
tests) updated to the generated type. Where a field's generated type is a `number | string`
AOT-wire-union, the migrated hook MAY keep a thin per-hook coercion (as the CSAT slice does)
until the shared-helper decision is revisited at ≥3 genuine sites.

The shipped outcome of `openapi-typed-client-admin` (archived 2026-07-16) is **6 genuine
migrations across the 44 files** — `ScheduleDay`, `ChangePasswordRequest`, `SystemSettings`,
`UpdateLicenseRequest`, `TypificationFieldOption`, `CreateWebhookSubscriptionRequest` — with
the other 38 files kept hand-written (per-file rationale in the archived change's `tasks.md`).
This is the current upstream bound, not an incomplete migration: Platform's captured OpenAPI
document emits almost no top-level response DTOs, so most Admin response interfaces have no
schema to swap onto. Lifting this bound is the subject of the held cross-repo response-schema
thread; the Agent/Analytics/Operations children remain HELD against it.

#### Scenario: An Admin hook with a clean generated match drops its hand-written interface

- **GIVEN** an Admin-module hook whose hand-written interface has an exact structural match
  (or non-breaking superset) in the generated document (e.g. `SystemSettings` →
  `components['schemas']['SystemSettingsRequest']`)
- **WHEN** the migration adopts that generated type via `customFetch<T>`
- **THEN** the hand-written interface is removed, every usage imports the generated type, and
  `tsc -b` (the existing blocking `build` CI job) passes — surfacing any drift between the hook's
  usage and the real Platform contract at compile time

#### Scenario: An Admin hook with no clean match stays hand-written by design

- **GIVEN** an Admin-module hook whose response shape has no generated schema, or whose
  generated request schema diverges from the hand-written interface (e.g. `use-queues.ts`'s
  `Queue`, which has no generated response schema)
- **WHEN** the migration evaluates that hook
- **THEN** the hand-written interface is retained and annotated in the archived change's
  `tasks.md` — this is the documented upstream bound (response-schema scarcity), not a defect
  or an unfinished task

#### Scenario: Numeric AOT wire-union sites are tallied, not silently re-normalized

- **GIVEN** an Admin hook whose _adopted_ generated type exposes a genuine `number | string`
  AOT-wire-union field a consumer must read as `number`
- **WHEN** the migration adopts that hook's generated type
- **THEN** the site is recorded in the coercion-site tally, and the shared-coercion-helper
  decision (phase2 open question 3) is revisited only once ≥3 genuine sites exist — a per-hook
  `select`/cast coercion is used in the interim, and `ai-credits-readout.tsx`'s `as number` casts
  (a hand-written `number | null` nullable-narrowing gap) are NOT counted as such a site. The
  Admin phase adopted no numeric-bearing schema, so the active tally stays at 2, with latent
  candidates logged in the archived change's `tasks.md` for hooks that would flip active if
  their schema were ever adopted
