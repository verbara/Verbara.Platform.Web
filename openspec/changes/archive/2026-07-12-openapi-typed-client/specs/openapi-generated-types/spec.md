## ADDED Requirements

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

## Architectural Risk

**Level**: MEDIUM

**Affected**: `src/core/api/` (new generated types directory + codegen script),
`src/core/api/hooks/use-analytics.ts` (the CSAT slice's consumer swap), and the `build` CI
job in `.github/workflows/ci.yml` (absorbs the new generated file into its existing
`tsc -b` gate — no new job). The Platform Api host is the upstream producer of the
consumed OpenAPI document (buildOrder 1, Platform/ADR-0035); this child cannot regenerate
real types until that document is published, though the CSAT slice's shape is already
fixed by the golden fixture.

**API-contract dependency (API-first)**: this capability depends on the Platform Api host
exporting `/openapi/v1.json` reliably as a CI artifact (Platform host child, buildOrder 1).
Until then, the generated file for the CSAT slice is produced against the golden fixture
shape, which is already verbatim-verified against the real `CsatResponseDto`.

**Mitigation**: commit the generated file (reviewable diff, same protection the
verbatim-fixture-citation rule gives hand-written DTOs), gate it with the existing
blocking `tsc -b` build job, and scope the first migrated slice to the one shape with a
golden fixture in hand (`CsatResponseDto`) rather than guessing at unfixtured shapes.
