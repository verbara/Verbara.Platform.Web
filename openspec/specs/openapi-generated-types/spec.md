# openapi-generated-types Specification

## Purpose

Generates and maintains TypeScript types from Platform's published OpenAPI document
(`openapi-typescript`, committed `src/core/api/generated/openapi.d.ts`), so wire-shape
drift between this repo's hand-written consumer interfaces and the real Platform contract
is caught at compile time (`tsc -b`) instead of silently at runtime — the failure class
that caused the csat-runner incident (v3.13.1-web). Migration is phased: this capability
currently covers codegen tooling + the CSAT analytics slice
(`useCsatQueueAnalytics`/`CsatResponseDto`); the remaining ~271 hand-written hook
declarations migrate in later phases tracked by `openapi-typed-client-phase2`. The realtime
SignalR boundary (`src/core/realtime/platform-hub.ts`) is explicitly out of scope — no REST
paths, not representable in an OpenAPI document (ADR-0020's deferred follow-up, owner: Pro).

## Requirements

### Requirement: Generated types are produced from Platform's OpenAPI document

The repo SHALL generate TypeScript types from the OpenAPI document published by the
Platform Api host via `openapi-typescript`, and SHALL commit the generated output as a
single declaration file refreshed by an npm script — not fetched at CI build time. The
generated types are the single source of truth for any wire shape they cover; hand-written
interfaces for those shapes MUST be removed once migrated.

#### Scenario: Generated file matches the golden envelope shape

- **GIVEN** the OpenAPI document envelope matches the golden fixture
  `Verbara.Platform/openspec/changes/openapi-typed-client/fixtures/openapi-document.v1.sample.json`
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

### Requirement: CSAT analytics hook consumes the generated CsatResponseDto type

`useCsatQueueAnalytics` in `src/core/api/hooks/use-analytics.ts` SHALL consume the
generated type for the `CsatResponseDto` schema instead of the hand-written
`CsatQueueSummary` interface it replaces. The generated type's fields MUST match the
golden wire fixture verbatim — the same fixture cited by the csat-runner train's Web
child: `Verbara.Platform/openspec/changes/openapi-typed-client/fixtures/openapi-document.v1.sample.json`,
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
