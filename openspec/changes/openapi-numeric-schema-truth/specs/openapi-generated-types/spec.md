## MODIFIED Requirements

### Requirement: Numeric AOT wire unions get a tracked normalization decision before proliferating

The `number | string` union was **never** a Platform precision policy — it was a .NET 10
`Microsoft.AspNetCore.OpenApi` artifact (framework-default `JsonNumberHandling.AllowReadingFromString`;
root cause [dotnet/aspnetcore #64145](https://github.com/dotnet/aspnetcore/issues/64145)). The
Platform host change `openapi-numeric-schema-truth` (`Platform/ADR-0036`, amends ADR-0035) adds an
`IOpenApiSchemaTransformer` that strips the spurious `string` arm from the emitted document
(document-only, AOT-safe, runtime deserialization unchanged). **After that correction the union is
EXTINCT at the source**: every numeric body/response field declares a SINGLE JSON type in the
regenerated `src/core/api/generated/openapi.d.ts`, so no `number | string` union remains to
normalize.

The earlier tally in this requirement ("**the tally stands at 2 genuine active sites**") was wrong:
the union had proliferated to **30+ hand-written `Number()` coercion sites** across production hooks
(`use-billing.ts`, `use-partner.ts`, `use-queue-metrics.ts`, `use-analytics.ts`, `use-teams.ts`,
`use-notifications.ts`, `use-supervisor.ts`, `use-typification-llm.ts`) — each existing only to
strip a `string` arm that never arrives at runtime. The corrected count of record is **30+**, and
this change **retires the entire class**.

Because the union no longer exists, the deferred open design question — "introduce a shared coercion
helper once ≥3 genuine active sites exist" (phase2 open question 3) — is **CLOSED as OBSOLETE**. The
shared helper MUST NOT be built: there is no `number | string` class left to generalize. Any numeric
field the regenerated document emits (`type: integer` or `type: number`, including `nullable`)
SHALL map to a plain TypeScript `number` (or `number | null`), and consumers SHALL read it directly
with no `Number()` coercion at the wire boundary.

The corrected single-typed shape is pinned in the Platform host change's golden fixture
`../Verbara.Platform/openspec/changes/openapi-numeric-schema-truth/fixtures/openapi-numeric-schema.v1.json`.
The regenerated `openapi.d.ts` MUST type each cited field with the single JSON type that fixture
declares, verbatim — never a `number | string` union:

- `CsatAggregateDto.totalResponses` — fixture `type: integer` / `format: int32` → `number`.
- `CsatAggregateDto.averageRating` — fixture `type: number` / `format: double` → `number`.
- `CsatResponseDto.totalResponses` — fixture `type: integer` / `format: int32` → `number`.
- `CsatResponseDto.averageRating` — fixture `type: number` / `format: double` → `number`.
- `DashboardKpisDto.avgWaitMs` — fixture `type: number` / `format: double` → `number`.
- `DashboardKpisDto.slaPercent` — fixture `type: number` / `format: double` → `number`.
- `QueueMetricsDto.waiting` — fixture nullable `type: integer` / `format: int32` (`nullable: true`)
  → `number | null` (nullable, never `| string`).
- `QueueMetricsDto.avgWaitSeconds` — fixture nullable `type: number` / `format: double`
  (`nullable: true`) → `number | null` (nullable, never `| string`).

#### Scenario: Regenerated numeric fields carry the fixture's single JSON type, never a string arm

- **GIVEN** the Platform host change's corrected document, whose golden fixture
  `../Verbara.Platform/openspec/changes/openapi-numeric-schema-truth/fixtures/openapi-numeric-schema.v1.json`
  declares `CsatAggregateDto.totalResponses` as `type: integer` / `format: int32`,
  `CsatAggregateDto.averageRating` as `type: number` / `format: double`,
  `DashboardKpisDto.avgWaitMs` as `type: number` / `format: double`, and `QueueMetricsDto.waiting`
  as a nullable `type: integer` / `format: int32`
- **WHEN** `npm run generate:api-types` regenerates `src/core/api/generated/openapi.d.ts` against
  that corrected document
- **THEN** the regenerated file types `CsatAggregateDto.totalResponses`, `CsatAggregateDto.averageRating`,
  and `DashboardKpisDto.avgWaitMs` as `number` (not `number | string`), and `QueueMetricsDto.waiting`
  as `number | null` (nullable, never `| string`) — matching each fixture field's single JSON type
  verbatim, and the whole-file count of `number | string` unions drops from 543 to 0

#### Scenario: The shared coercion helper decision is closed obsolete and the class is retired

- **GIVEN** the earlier requirement text claimed "the tally stands at 2 genuine active sites" while
  30+ `Number()` coercion sites actually existed, and deferred a shared coercion helper until ≥3
  genuine sites
- **WHEN** Platform's `IOpenApiSchemaTransformer` removes the `number | string` union from the
  document and this change regenerates `openapi.d.ts`
- **THEN** the corrected count of record is 30+, the ≥3-sites shared-coercion-helper decision is
  CLOSED as OBSOLETE (the helper MUST NOT be built — the union class no longer exists), and every
  retired site reads the regenerated `number` field directly with no `Number()` coercion at the wire
  boundary

### Requirement: CSAT analytics hook consumes the generated CsatResponseDto type

`useCsatQueueAnalytics` in `src/core/api/hooks/use-analytics.ts` SHALL consume the generated type for
the `CsatResponseDto` schema instead of a hand-written interface. With the numeric union now extinct
at the source (Platform host change `openapi-numeric-schema-truth`, `Platform/ADR-0036`), the CSAT
`select`-normalizers that previously coerced `CsatResponseDto`'s and `CsatAggregateAnalyticsDto`'s
`number | string` fields (`CsatQueueSummary` / `CsatAggregateSummary`) are **retired** — the
regenerated fields are already `number`. The generated type's fields MUST match the corrected golden
fixture `../Verbara.Platform/openspec/changes/openapi-numeric-schema-truth/fixtures/openapi-numeric-schema.v1.json`
verbatim: schema `CsatResponseDto` carries `queueName` (`type: string`), `channel` (`type: string`),
`totalResponses` (`type: integer` / `int32`), `averageRating` (`type: number` / `double`),
`rangeStart` (`type: string` / `date-time`), and `rangeEnd` (`type: string` / `date-time`).

#### Scenario: The CSAT numeric fields resolve as plain number with no coercion

- **GIVEN** the corrected fixture types `CsatResponseDto.totalResponses` as `type: integer` /
  `format: int32` and `CsatResponseDto.averageRating` as `type: number` / `format: double`
- **WHEN** `useCsatQueueAnalytics` resolves a successful response after `openapi.d.ts` is regenerated
- **THEN** `totalResponses` and `averageRating` are already `number` on the generated type, the
  `CsatQueueSummary` / `CsatAggregateSummary` `select`-normalizers' `Number()` coercions are removed,
  and the obsolete string-arm assertions in `use-csat-aggregate.test.ts` are dropped

### Requirement: Analytics module hooks adopt generated types now that the numeric union is gone

The Analytics-module hook files under `src/core/api/hooks/` — `use-analytics.ts`, `use-surveys.ts`,
`use-recording.ts`, `use-csat.ts` (~39 hand-written declarations, authoritative list in this change's
`tasks.md`) — SHALL adopt the generated types from `src/core/api/generated/openapi.d.ts` (behind
`client.ts`'s existing generic `<T>`, swap-the-T) where the regenerated document now carries a clean
structural match, which the corrected numeric typing unblocks. This completes the sibling
`openapi-typed-client-analytics` child (which was HELD on exactly this `number | string` union). Once
a shape is adopted, its hand-written interface MUST be removed and every usage updated to the
generated type.

Genuine **structural-divergence** shapes SHALL stay hand-written — these are separate Platform
contract bugs, NOT fixed by this change: `TopicTrendsResponse` (generated renames `topics`→`trends`
and drops `from`/`to`), `ComplianceRuleSummaryDto.severity` (widened from the
`'Info' | 'Warning' | 'Critical'` literal union to `string`), the `PagedResult<T>` envelope
(`{ items, hasNextPage }` vs generated `{ data, hasMore }`), and no-generated-counterpart shapes
(`BotAnalyticsSummary`, `TranscriptSegment`, `IntervalData`, and request shapes like
`CsatCaptureRequest`).

#### Scenario: An Analytics hook with a now-clean match drops its hand-written interface

- **GIVEN** an Analytics-module hook whose hand-written interface was previously unmatchable only
  because a numeric field was a `number | string` union
- **WHEN** `openapi.d.ts` is regenerated from the corrected document and that field is now a single
  `number`, giving a clean structural match
- **THEN** the hook adopts `components['schemas']['<SchemaName>']` via `customFetch<T>`, the
  hand-written interface is removed, every usage imports the generated type, and `tsc -b` (the
  existing blocking `build` CI job) passes

#### Scenario: A structural-divergence shape stays hand-written as a logged contract bug

- **GIVEN** `TopicTrendsResponse` (generated renames `topics`→`trends`, drops `from`/`to`),
  `ComplianceRuleSummaryDto.severity` (widened to `string` from `'Info' | 'Warning' | 'Critical'`),
  or the `PagedResult<T>` envelope (`{ items, hasNextPage }` vs generated `{ data, hasMore }`)
- **WHEN** this change completes the Analytics migration
- **THEN** each such shape is retained hand-written and logged as a separate Platform contract bug —
  a forced swap onto the diverging generated type would break the hook's public shape, which the
  structural-match discipline forbids

### Requirement: Generated-types adoption baseline ratchets down as analytics hooks adopt

The adoption ratchet `scripts/check-generated-types-adoption.mjs` (`npm run lint:generated-types`)
SHALL force `generated-types-adoption-baseline.json`'s floor DOWN as `use-csat.ts`,
`use-recording.ts`, and `use-surveys.ts` adopt generated types under this change. The gate fails if a
hook not on the unadopted list is unadopted; as each of these three hooks adopts, it MUST be removed
from the list (the list only ever ratchets down, never up).

#### Scenario: Adopting analytics hooks trims the unadopted list

- **GIVEN** `use-csat.ts`, `use-recording.ts`, and `use-surveys.ts` are on
  `generated-types-adoption-baseline.json`'s `unadopted_hooks` list (floor 39)
- **WHEN** this change migrates those hooks to consume generated types and removes them from the list
- **THEN** `npm run lint:generated-types` passes with the lower floor, and no hook that already
  adopts generated types remains on the unadopted list
