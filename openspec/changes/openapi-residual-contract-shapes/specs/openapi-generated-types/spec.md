## MODIFIED Requirements

### Requirement: Analytics module hooks adopt generated types now that the numeric union is gone

The Analytics-module hook files under `src/core/api/hooks/` — `use-analytics.ts`, `use-surveys.ts`,
`use-recording.ts`, `use-csat.ts` (~39 hand-written declarations, authoritative list in this change's
`tasks.md`) — SHALL adopt the generated types from `src/core/api/generated/openapi.d.ts` (behind
`client.ts`'s existing generic `<T>`, swap-the-T) where the regenerated document now carries a clean
structural match, which the corrected numeric typing unblocks. This completes the sibling
`openapi-typed-client-analytics` child (which was HELD on exactly this `number | string` union). Once
a shape is adopted, its hand-written interface MUST be removed and every usage updated to the
generated type.

Two shapes the sibling `openapi-numeric-schema-truth` child logged as **structural-divergence
that SHALL stay hand-written** are now **corrected at the source** by the Platform host change
`openapi-residual-contract-shapes` (`Platform/ADR-0036`) and SHALL therefore adopt the generated
type instead (see the "Residual contract-shape shadows adopt the corrected generated types"
requirement for the field-level detail and golden-fixture citations):

- **`TopicTrendsResponse`** — the generated document already emits `trends` (not `topics`) and drops
  `from`/`to`; the stale hand-written `{ topics, totalAnalyzed, from, to }` shadow SHALL be dropped
  and its consumer repointed to the generated `trends` shape.
- **`ComplianceRuleSummaryDto.severity`** — Platform narrows `severity` back from bare `string` to
  the `Info | Warning | Critical` literal union; the hand-written `ComplianceRuleSummaryDto` /
  `ComplianceSummaryResponse` shadows SHALL be dropped and their severity display/filter/sort
  consumers repointed to the generated union (this adoption is gated on Platform shipping the union
  — buildOrder-2).

The remaining structural-divergence and no-generated-counterpart shapes SHALL stay hand-written —
these are separate Platform contract concerns, NOT fixed by this change: the `PagedResult<T>`
envelope (the generated `PagedResultOf<T>` monomorphization is by-design and already matches the
contract fields `items`, `totalCount`, `page`, `pageSize`, `totalPages`, `hasNextPage`,
`hasPreviousPage` — see the residual-shapes requirement), and no-generated-counterpart shapes
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

#### Scenario: The two corrected residual shadows adopt the generated type instead of staying hand-written

- **GIVEN** `TopicTrendsResponse` (now generated with `trends`, not `topics`, and without
  `from`/`to`) and `ComplianceRuleSummaryDto.severity` (now narrowed to `Info | Warning | Critical`
  by the Platform host change `openapi-residual-contract-shapes`, `Platform/ADR-0036`)
- **WHEN** this change regenerates `openapi.d.ts` and completes the Analytics migration
- **THEN** each such shadow is dropped and its consumer repointed to the generated type — reversing
  the earlier "SHALL stay hand-written" posture, which held only while Platform's document diverged

#### Scenario: The PagedResult envelope stays hand-written by design as a still-sanctioned exception

- **GIVEN** the `PagedResult<T>` envelope, whose generated `PagedResultOf<T>` monomorphization is
  by-design and already carries `items`, `totalCount`, `page`, `pageSize`, `totalPages`,
  `hasNextPage`, `hasPreviousPage`
- **WHEN** this change completes the Analytics migration
- **THEN** the envelope exception remains sanctioned — the one hand-written `AuditEventsPagedResult`
  is retired by that hook's own separate future migration, not this change, and no forced swap is
  made here

## ADDED Requirements

### Requirement: Residual contract-shape shadows adopt the corrected generated types

The two Analytics wire shapes the Platform host change `openapi-residual-contract-shapes`
(`Platform/ADR-0036`) corrects — `TopicTrendsResponse` and `ComplianceRuleSummaryDto.severity` — SHALL
be migrated from their hand-written shadows in `src/core/api/hooks/use-analytics.ts` to the generated
types in `src/core/api/generated/openapi.d.ts`, behind `client.ts`'s existing generic `<T>`
(swap-the-T). Once a shape is adopted, its hand-written shadow MUST be removed and every consumer
usage updated to the generated type. The consumed field names MUST match the Platform host change's
golden fixtures verbatim — no paraphrase, rename, reorder, or invention.

**API-contract dependency (API-first, `Platform/ADR-0036`):**

- **TopicTrends (INDEPENDENT — already unblocked):** the endpoint
  `/api/v1/call-analytics/topics/trends` already emits the corrected shape today. Per the golden
  fixture `topic-trends-response.v1.json`, the response carries `trends` — an array of
  `{ topic, occurrences, avgConfidence }` — and `totalAnalyzed`. It carries **no** `topics` key and
  **no** `from`/`to` keys. The hand-written shadow `TopicTrendsResponse`
  (`{ topics, totalAnalyzed, from, to }`) SHALL be dropped and the consumer
  `src/analytics/speech-analytics/speech-analytics-page.tsx` repointed from `data?.topics` to the
  generated `trends`.
- **ComplianceRuleSummary severity (DEPENDS on Platform, buildOrder 1 — the barrier):** Web narrows
  `severity` to the enum ONLY AFTER Platform ships the `Info | Warning | Critical` literal union in
  its emitted document. Per the golden fixture `compliance-rule-summary.v1.json`, a rule summary
  carries `ruleId`, `ruleName`, `severity` (one of `Info`, `Warning`, `Critical`), `occurrences`,
  `sessionsAffected`, `firstSeen`, and `lastSeen`. After Platform's document ships the union and
  `openapi.d.ts` is regenerated, the hand-written `ComplianceRuleSummaryDto` and its transitive
  `ComplianceSummaryResponse` shadow SHALL be dropped and the severity display/filter/sort consumers
  in `speech-analytics-page.tsx` repointed to the generated union.

The `PagedResult` envelope requires **no Web action** (recorded for completeness): per the golden
fixture `paged-result-envelope.v1.json`, the envelope carries `items`, `totalCount`, `page`,
`pageSize`, `totalPages`, `hasNextPage`, and `hasPreviousPage`, and the generated `PagedResultOf<T>`
monomorphization already matches it field-for-field. The by-design monomorphization stays; the one
hand-written `AuditEventsPagedResult` in `src/admin/security/audit/use-audit-events.ts` is retired by
that hook's OWN separate future migration, NOT this change.

The adoption ratchet `scripts/check-generated-types-adoption.mjs` (baseline floor 37) is unaffected —
`use-analytics.ts` already adopts the generated `components`, so no baseline entry changes under this
change.

#### Scenario: The TopicTrends shadow is dropped and the consumer repointed to the generated trends field

- **GIVEN** the golden fixture `topic-trends-response.v1.json` declares the response with `trends`
  (an array of `{ topic, occurrences, avgConfidence }`) and `totalAnalyzed`, and with no `topics` key
  and no `from`/`to` keys
- **WHEN** this change drops the hand-written `TopicTrendsResponse` shadow and repoints
  `src/analytics/speech-analytics/speech-analytics-page.tsx` from `data?.topics` to the generated
  `trends`
- **THEN** the hook resolves the generated type, `totalAnalyzed` is read unchanged, the consumer
  reads `trends` (not `topics`), no code references the removed `from`/`to` keys, and `tsc -b` (the
  existing blocking `build` CI job) passes

#### Scenario: The compliance severity shadow adopts the generated literal union only after Platform ships it

- **GIVEN** the golden fixture `compliance-rule-summary.v1.json` declares a rule summary with
  `ruleId`, `ruleName`, `severity` (one of `Info`, `Warning`, `Critical`), `occurrences`,
  `sessionsAffected`, `firstSeen`, and `lastSeen`, and Platform's host change
  `openapi-residual-contract-shapes` (buildOrder 1) narrows `severity` from bare `string` to that
  literal union in its emitted document
- **WHEN** Platform ships the union, `openapi.d.ts` is regenerated, and this change drops the
  hand-written `ComplianceRuleSummaryDto` / `ComplianceSummaryResponse` shadows and repoints the
  severity display/filter/sort consumers in `speech-analytics-page.tsx` to the generated union
- **THEN** the severity value is the generated `Info | Warning | Critical` union (not bare `string`),
  the severity-keyed display/filter/sort compiles against the narrowed type, and `tsc -b` passes —
  and this adoption occurs only after Platform's buildOrder-1 stage ships the union (the buildOrder-2
  barrier)

#### Scenario: The PagedResult envelope is confirmed by-design with no Web action

- **GIVEN** the golden fixture `paged-result-envelope.v1.json` declares the envelope with `items`,
  `totalCount`, `page`, `pageSize`, `totalPages`, `hasNextPage`, and `hasPreviousPage`, and the
  generated `PagedResultOf<T>` monomorphization already matches those fields
- **WHEN** this change evaluates the envelope shape
- **THEN** no Web type is dropped or repointed for the envelope — the monomorphization is
  by-design and the one hand-written `AuditEventsPagedResult` is left to its own separate future
  migration, recorded here for completeness only

## Architectural Risk

**Level:** LOW

**Affected:** `src/core/api/hooks/use-analytics.ts` (drops the `TopicTrendsResponse`,
`ComplianceRuleSummaryDto`, and `ComplianceSummaryResponse` shadows),
`src/analytics/speech-analytics/speech-analytics-page.tsx` (topic + severity consumers), and a
regenerated `src/core/api/generated/openapi.d.ts`. Cross-repo: consumes Platform host change
`openapi-residual-contract-shapes` (`Platform/ADR-0036`); the `severity` narrowing is buildOrder-gated
on Platform.

**Mitigation:** All three shapes are consumed behind `client.ts`'s existing generic `<T>` — the swap
is type-only and any drift between the hook usage and the regenerated document is caught at `tsc -b`
(the existing blocking `build` CI job), not at runtime. The `severity` adoption is sequenced AFTER
Platform's buildOrder-1 stage ships the literal union, so Web never narrows to an enum the document
does not yet emit. The `topics`→`trends` swap is already unblocked (Platform emits `trends` today) and
independent of Platform staging. The `PagedResult` envelope takes no action, removing any risk there.
The adoption ratchet baseline (floor 37) is untouched. No i18n keys change, so parity is unaffected.
