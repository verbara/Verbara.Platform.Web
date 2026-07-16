## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Numeric AOT wire unions get a tracked normalization decision before proliferating

Fields whose generated type is a `number | string` union (Platform's AOT-safe numeric wire
encoding) MUST NOT each grow an independent, ad-hoc normalization at every new call site
once a second and third migrated hook hits the same pattern. The repo SHALL track the
decision of whether to introduce a shared coercion helper (vs. continuing per-hook
`select`/cast normalization) as an open design question until at least 2-3 concrete migrated
call sites exist to generalize from.

#### Scenario: A second migrated hook hits the same union pattern

- **GIVEN** `useCsatQueueAnalytics` already normalizes `totalResponses`/`averageRating` via
  a per-hook `select`
- **WHEN** a subsequent migration phase migrates another hook whose generated type also
  exposes a `number | string` union field
- **THEN** the design decision in `openapi-typed-client-phase2/design.md` (open question 3)
  is revisited with the new data point before a third ad-hoc normalization is added, rather
  than silently repeating the pattern indefinitely
