# openapi-generated-types Specification

## Purpose

Generates and maintains TypeScript types from Platform's published OpenAPI document
(`openapi-typescript`, committed `src/core/api/generated/openapi.d.ts`), so wire-shape
drift between this repo's hand-written consumer interfaces and the real Platform contract
is caught at compile time (`tsc -b`) instead of silently at runtime — the failure class
that caused the csat-runner incident (v3.13.1-web). Migration is phased: this capability
currently covers codegen tooling + the CSAT analytics slice
(`useCsatQueueAnalytics`/`CsatResponseDto`); the remaining ~271 hand-written hook
declarations migrate in four per-module child changes — `openapi-typed-client-admin`,
`-agent`, `-analytics`, `-operations` (planning resolved by the archived
`openapi-typed-client-phase2`). The realtime
SignalR boundary (`src/core/realtime/platform-hub.ts`) is explicitly out of scope — no REST
paths, not representable in an OpenAPI document (ADR-0020's deferred follow-up, owner: Pro).

## Requirements

### Requirement: Generated types are produced from Platform's OpenAPI document

The repo SHALL generate TypeScript types from the OpenAPI document published by the
Platform Api host via `openapi-typescript`, and SHALL commit the generated output as a
single declaration file refreshed by an npm script — not fetched at CI build time. The
generated types are the single source of truth for any wire shape they cover; hand-written
interfaces for those shapes MUST be removed once migrated. The capability's migration is
phased: Phase 1 (archived, `openapi-typed-client`) covers tooling + the CSAT analytics
slice. Remaining hand-written hook declarations (61 files, ~271 declarations across Admin,
Agent, Analytics, and Operations) SHOULD migrate in subsequent phases; Platform's real
OpenAPI document is now LIVE as a CI artifact (Platform/ADR-0035 + the `ci.yml` "Export
OpenAPI document (CI-runtime capture)" step) and the committed `openapi.d.ts` is already
generated from it (324 paths, 182 schemas), so those phases are unblocked. Those subsequent
phases are the four per-module child changes `openapi-typed-client-admin`, `-agent`,
`-analytics`, and `-operations` (per this change's superseding resolution).

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
call sites exist to generalize from. **The tally already stands at 2 genuine sites**, both in
`use-analytics.ts`: `CsatResponseDto` (phase-1) and `CsatAggregateAnalyticsDto` (archived
`2026-07-14-csat-completion`); the `openapi-typed-client-admin` child gathers further sites, and
one more genuine site trips the ≥3 threshold. `ai-credits-readout.tsx`'s `as number` casts
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
