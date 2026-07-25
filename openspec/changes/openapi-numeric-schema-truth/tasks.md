## 1. Phase A — Regenerate against the corrected document

- [x] 1.1 Confirm Platform's `openapi-numeric-schema-truth` host change has landed (its
      `IOpenApiSchemaTransformer` strips the `number | string` arm; document-only, `Platform/ADR-0036`).
      This Web child is staged AFTER the host by the cross-repo `buildOrder`.
- [x] 1.2 Run `npm run generate:api-types` (`node scripts/generate-api-types.mjs`) to regenerate
      `src/core/api/generated/openapi.d.ts` from the corrected document.
- [x] 1.3 Verify the union is extinct: `grep -c "number | string" src/core/api/generated/openapi.d.ts`
      returns **0** (baseline before this change: 543). Spot-check the fixture-cited fields —
      `CsatAggregateDto.totalResponses`/`averageRating`, `DashboardKpisDto.avgWaitMs`/`slaPercent`,
      `QueueMetricsDto.waiting`/`avgWaitSeconds` — are single-typed `number` / `number | null`.

## 2. Phase B — Complete the analytics aliasing (finishes `openapi-typed-client-analytics`)

Adopt the generated `components['schemas'][...]` type for each Analytics-module shape that now has a
clean structural match (the numeric union no longer blocks the match). Swap-the-T at the hook;
`client.ts` untouched. Grep every usage of each removed hand-written interface and update imports
before deleting the declaration. `tsc -b` stays green after each file.

- [x] 2.1 `use-analytics.ts` — alias the now-matching shapes (`DashboardKpis`/`DashboardData`,
      `TrendPoint`, `ChannelDistribution`, `CdrRow`/`CdrDetail`, `QaRow`/`QaDetail`, `LiveState`,
      `CurrentInterval`/`AgentInterval`, `SentimentTrendPointDto`/`SentimentTrendsResponse`,
      `ComplianceSeverityBreakdownDto`/`ComplianceSummaryResponse`, etc.) to their generated schemas.
      Retire the CSAT `select`-normalizers (`CsatQueueSummary` / `CsatAggregateSummary`) — the
      regenerated `totalResponses`/`averageRating` are already `number` (see Phase C).
- [x] 2.2 `use-surveys.ts` — alias `Survey`, `SurveyQuestion`, `SurveySummary`, `SurveyAnswer`,
      `SurveyResponse` (and the `SurveyType`/`QuestionType` literal unions where the generated enum
      matches) to their generated schemas.
- [x] 2.3 `use-recording.ts` — alias `RecordingMetadata` to its generated schema.
- [x] 2.4 `use-csat.ts` — adopt the generated type for the CSAT capture flow where a clean match
      exists (see the `CsatCaptureRequest` keep-list note in Phase B-keep).

### Phase B-keep — structural-divergence shapes STAY hand-written (log as separate Platform contract bugs; do NOT fix here)

- [x] 2.5 `TopicTrendsResponse` (`use-analytics.ts`) — keep hand-written; the generated schema
      renames `topics`→`trends` and drops `from`/`to`. Log as a Platform contract bug.
- [x] 2.6 `ComplianceRuleSummaryDto.severity` (`use-analytics.ts`) — keep hand-written; generated
      `severity` is widened from the `'Info' | 'Warning' | 'Critical'` literal union to `string`. Log
      as a Platform contract bug.
- [x] 2.7 `PagedResult<T>` envelope (`use-analytics.ts`) — keep the local generic wrapper; generated
      is `{ data, hasMore }` vs the hook's `{ items, hasNextPage }`. Log as a Platform contract bug.
- [x] 2.8 No-generated-counterpart shapes — keep hand-written: `BotAnalyticsSummary`,
      `TranscriptSegment`, `IntervalData` (all in `use-analytics.ts`), and request shapes like
      `CsatCaptureRequest` (`use-csat.ts`). Kept per this keep-list. NOTES (reconciliation on
      apply): (a) a generated `IntervalDto` does in fact exist and matches `IntervalData`
      field-for-field, but it is kept hand-written per this explicit keep-list to avoid scope
      creep; (b) `CdrRow`/`CdrDetail`/`QaRow`/`QaDetail` and their nested leaves
      `QaCriterion`/`ComplianceViolationInfo` are ALSO kept — the generated counterparts type
      nullable fields as required-nullable (`null | X`) whereas the consumer shape uses optional
      (`?: X`), an optional-vs-nullable structural divergence the swap cannot bridge (and `CdrRow`
      additionally carries `channelType`/`recordingStreamUrl` fields absent from `CdrRowDto`);
      (c) `CsatCaptureRequest` has a generated `CsatResponseRequest`, but it widens the optional
      `comment?` to required-nullable and is a verbatim-fixture-cited webchat-SDK boundary type
      outside the app tsconfig — kept hand-written. The exact-match leaves `TopicInfo`→`TopicDto`
      and `TurnSentimentInfo`→`TurnSentimentDto` WERE adopted (fully-required, clean match).

## 3. Phase C — Retire the now-dead `Number()` coercion class (~30 sites)

The regenerated numeric fields are single-typed `number`, so every `Number()` coercion that only
stripped the (never-arriving) `string` arm is dead. Remove the coercion and read the field directly.
`tsc -b` catches any real type mismatch.

- [x] 3.1 `use-billing.ts` — remove the `Number()` coercion sites (billing/invoice numeric fields).
- [x] 3.2 `use-partner.ts` — remove the `Number()` coercion sites (partner numeric fields).
- [x] 3.3 `use-queue-metrics.ts` — remove the `toQueueMetrics` mapper's `Number()` coercions over the
      `QueueMetricsDto` fields (`waiting`, `avgWaitSeconds`, `slaPercent`, `agentsAvailable`,
      `agentsBusy`, `agentsAway` — all now single-typed on the regenerated schema).
- [x] 3.4 `use-analytics.ts` — remove the `Number()` coercions in the `CsatQueueSummary` /
      `CsatAggregateSummary` `select`-normalizers (`totalResponses`/`averageRating` now `number`).
- [x] 3.5 `use-teams.ts` — remove the `memberCount` `Number()` coercion.
- [x] 3.6 `use-notifications.ts` — remove the `count` `Number()` coercion.
- [x] 3.7 `use-supervisor.ts` — remove the `failoverAttempts` `Number()` coercion (the
      `normalizeStuckConversation` wrapper).
- [x] 3.8 `use-typification-llm.ts` — remove the `latencyMs` `Number()` coercion.
- [x] 3.9 Update tests whose assertions covered the string arm — `use-csat-aggregate.test.ts`'s
      string-input assertions become obsolete (the union no longer exists); drop/adjust them. Sweep
      the test suite for any other string-arm coercion assertion tied to a retired site.

## 4. Phase D — Adoption ratchet + spec/tally correction

- [x] 4.1 Run `npm run lint:generated-types` (`node scripts/check-generated-types-adoption.mjs`) and
      let it force `generated-types-adoption-baseline.json` DOWN: remove `use-recording.ts` and
      `use-surveys.ts` from `unadopted_hooks` as they adopt generated types (floor 39 → 37). Never
      add to the list. NOTE (reconciliation on apply): `use-csat.ts` STAYS on the list — its only
      shape `CsatCaptureRequest` is kept hand-written (see 2.8), so the file does not import the
      generated module; the ratchet only ratchets down on _actual_ adoption, and removing an
      unadopted hook would fail the checker's "new unadopted, not baselined" condition. The gate
      passes green with the two genuine adoptions removed.
- [x] 4.2 Correct `openspec/specs/openapi-generated-types/spec.md`'s "Numeric AOT wire unions get a
      tracked normalization decision" requirement: the union is now extinct at the source; the tally
      of record is 30+ (not 2); close the deferred "shared coercion helper at ≥3 sites" decision as
      OBSOLETE (the helper MUST NEVER be built — the class no longer exists). This is applied by
      archiving this change's `MODIFIED Requirements` delta into the living spec.

## 5. Phase E — Validation (batch)

- [x] 5.1 `npm run build` — `tsc -b && vite build` clean (the drift-catching CI gate; proves every
      retired coercion site and every adopted alias type-checks against the regenerated document).
- [x] 5.2 `npx vitest run` — full unit suite green (with the obsolete string-arm assertions removed).
- [x] 5.3 `npx eslint .` — clean, including `npm run i18n:check` and `npm run lint:generated-types`
      (ratchet floor lowered, no unadopted regression).
- [x] 5.4 Final grep: `grep -c "number | string" src/core/api/generated/openapi.d.ts` is 0, and no
      `Number()` coercion remains at a retired wire-boundary site.

## 6. Follow-up (cross-repo, for the archive record)

The three structural-divergence keep-list shapes (Phase B-keep) are **Platform-side contract bugs**,
not Web defects: `TopicTrendsResponse` (`topics`→`trends`, dropped `from`/`to`),
`ComplianceRuleSummaryDto.severity` (literal union widened to `string`), and the `PagedResult`
envelope (`{ items, hasNextPage }` vs `{ data, hasMore }`). Logged here; each should be filed against
Platform separately (not actionable from this repo).
