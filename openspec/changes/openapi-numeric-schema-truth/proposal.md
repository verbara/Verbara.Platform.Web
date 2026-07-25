---
tier: MEDIANO
owner: Harol
approver: Harol
stakeholder: Platform API maintainers (producer of the corrected OpenAPI document), Platform.Web frontend team (typed-client consumer)
decision_ref: Platform/ADR-0036
---

# Proposal: openapi-numeric-schema-truth (Web child — regenerate the corrected document, finish analytics, retire the coercion class)

## Why

Every numeric body/response field in `src/core/api/generated/openapi.d.ts` is typed as a
`number | string` union — **543 of them** in the committed generated file
(`grep -c "number | string"`). This was **never a Platform precision policy**: it is a .NET 10
`Microsoft.AspNetCore.OpenApi` + `JsonSchemaExporter` artifact driven by ASP.NET Core's
framework-default `JsonNumberHandling.AllowReadingFromString` (root cause
[dotnet/aspnetcore #64145](https://github.com/dotnet/aspnetcore/issues/64145)); no Verbara code
produces it, and the server never writes string-typed numbers.

This Web change is the **downstream consumer half** of the cross-repo change
`openapi-numeric-schema-truth`. Upstream, **Verbara.Platform** (host change, `Platform/ADR-0036`,
which amends ADR-0035) adds an `IOpenApiSchemaTransformer` that strips the spurious `string` arm
from the emitted document — **document-only**, AOT-safe, no runtime deserialization change (the
serializer keeps `AllowReadingFromString`). **After Platform's document is corrected**, the
generated union goes **extinct at the source**. This repo then:

1. **Regenerates** `openapi.d.ts` via `npm run generate:api-types` — the 543 `number | string`
   unions collapse to clean single-typed `number`.
2. **Completes the now-unblocked `openapi-typed-client-analytics` migration** (the sibling
   Analytics child, `decision_ref Platform/ADR-0035`, held on exactly this union). With clean
   types, most of the ~39 currently-hand-written analytics shapes across
   `use-analytics.ts`, `use-surveys.ts`, `use-recording.ts`, and `use-csat.ts` alias cleanly to
   `components['schemas'][...]`. Genuine structural-divergence shapes STAY hand-written and are
   logged as separate Platform contract bugs (NOT fixed here).
3. **Retires the now-dead `Number()` coercion class** across production hooks — the ~30 sites that
   only existed to strip a `string` arm that never arrives.

Correcting the document at the source removes the whole class for every current and future
consumer, rather than pushing a per-consumer workaround over a contract that lies. This change is
the Web child of the parent cross-repo change; its host is `Verbara.Platform`'s
`openapi-numeric-schema-truth` change (fixture:
`../Verbara.Platform/openspec/changes/openapi-numeric-schema-truth/fixtures/openapi-numeric-schema.v1.json`).

## What Changes

- **Regenerate `src/core/api/generated/openapi.d.ts`** from Platform's corrected document via
  `npm run generate:api-types` — the 543 `number | string` unions become single-typed `number`
  (e.g. `CsatAggregateDto.totalResponses`, `DashboardKpisDto.avgWaitMs`, `QueueMetricsDto.waiting`).
- **Complete the analytics aliasing** — most of the ~39 hand-written analytics shapes in
  `use-analytics.ts`, `use-surveys.ts`, `use-recording.ts`, and `use-csat.ts` become
  `components['schemas'][...]` aliases now that the numeric union no longer blocks a clean structural
  match. This finishes the `openapi-typed-client-analytics` sibling child.
- **Keep hand-written the genuine structural-divergence shapes** — logged as separate Platform
  contract bugs, NOT fixed here:
  - `TopicTrendsResponse` — generated renames `topics`→`trends` and drops `from`/`to`.
  - `ComplianceRuleSummaryDto.severity` — widened from the `'Info' | 'Warning' | 'Critical'` literal
    union to `string`.
  - `PagedResult<T>` envelope — `{ items, hasNextPage }` vs the generated `{ data, hasMore }`.
  - No-generated-counterpart shapes — `BotAnalyticsSummary`, `TranscriptSegment`, `IntervalData`,
    and request shapes like `CsatCaptureRequest`.
- **Retire the ~30 now-dead `Number()` coercion sites** across production hooks: `use-billing.ts`,
  `use-partner.ts`, `use-queue-metrics.ts` (the `toQueueMetrics` mapper), `use-analytics.ts` (the
  `CsatQueueSummary` / `CsatAggregateSummary` `select`-normalizers), `use-teams.ts` (memberCount),
  `use-notifications.ts` (count), `use-supervisor.ts` (failoverAttempts), and
  `use-typification-llm.ts` (latencyMs) — plus matching test updates (the string-arm assertions in
  `use-csat-aggregate.test.ts` become obsolete). Full enumerated list in `tasks.md`.
- **Correct `openspec/specs/openapi-generated-types/spec.md`** — the "Numeric AOT wire unions get a
  tracked normalization decision" requirement says "the tally stands at 2 genuine active sites";
  reality was 30+. This change makes the union EXTINCT at the source, so it **closes the deferred
  "shared coercion helper at ≥3 sites" decision as OBSOLETE** — the helper must never be built
  because the class it would generalize no longer exists.
- **Ratchet `generated-types-adoption-baseline.json` DOWN** — `scripts/check-generated-types-adoption.mjs`
  auto-forces the floor down as `use-csat.ts`, `use-recording.ts`, and `use-surveys.ts` adopt
  generated types (all three are currently on the unadopted list; floor moves from 39).

## Capabilities

### Modified Capabilities

- `openapi-generated-types`: the `number | string` AOT wire union is now **extinct at the source**
  (Platform's corrected document), so the "tracked normalization decision" requirement's tally is
  corrected (30+ sites, not 2) and the deferred ≥3-sites shared-coercion-helper decision is closed
  **OBSOLETE**. This change also completes the Analytics module's migration (the sibling
  `openapi-typed-client-analytics` child was held on precisely this union). Mechanism otherwise
  unchanged (swap-the-T; `client.ts` untouched).

## Impact

- **Regenerated file**: `src/core/api/generated/openapi.d.ts` — 543 `number | string` unions →
  single-typed `number`. Compile-time-only; no runtime behavior change (Platform's transformer is
  document-only, serializer stays lenient).
- **Analytics hooks completed**: `use-analytics.ts`, `use-surveys.ts`, `use-recording.ts`,
  `use-csat.ts` — most hand-written shapes alias to generated types; the divergence keep-list above
  stays hand-written.
- **Coercion class retired**: ~30 `Number()` sites across `use-billing.ts`, `use-partner.ts`,
  `use-queue-metrics.ts`, `use-analytics.ts`, `use-teams.ts`, `use-notifications.ts`,
  `use-supervisor.ts`, `use-typification-llm.ts` — plus obsolete string-arm test assertions.
- **Adoption ratchet**: `generated-types-adoption-baseline.json` floor forced down by the script.
- **No new dependency, no new CI job**: the existing blocking `build` job (`tsc -b`) gates the
  regenerated types for free.
- **Not fixed here (separate Platform contract bugs)**: `TopicTrendsResponse` rename/drop,
  `ComplianceRuleSummaryDto.severity` widening, `PagedResult` envelope divergence — each stays
  hand-written and is logged upstream, not forced onto a diverging generated type.
- **Depends on**: Platform's `openapi-numeric-schema-truth` host change landing first (staged by
  the cross-repo `buildOrder` — this Web child regenerates against the corrected document). Sibling
  `openapi-typed-client-analytics` is completed/subsumed by this change.
