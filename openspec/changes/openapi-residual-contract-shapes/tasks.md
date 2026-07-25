## 1. Regenerate the typed client (Phase A — foundation, gated on Platform buildOrder-1)

- [ ] 1.1 Confirm Platform's host change `openapi-residual-contract-shapes` (`Platform/ADR-0036`) has shipped its buildOrder-1 stage and packed, so its emitted document carries the corrected `TopicTrendsResponse` (`trends`, no `topics`/`from`/`to`) and the `ComplianceRuleSummaryDto.severity` `Info | Warning | Critical` literal union
- [ ] 1.2 Run `npm run generate:api-types` to regenerate `src/core/api/generated/openapi.d.ts` from the corrected Platform document
- [ ] 1.3 Verify the regenerated `openapi.d.ts` exposes the corrected shapes: a topic-trends response with `trends` (array of `{ topic, occurrences, avgConfidence }`) and `totalAnalyzed`, and a `ComplianceRuleSummaryDto` whose `severity` is `Info | Warning | Critical` (not bare `string`) with `ruleId`, `ruleName`, `occurrences`, `sessionsAffected`, `firstSeen`, `lastSeen`

## 2. Adopt TopicTrends (Phase B — INDEPENDENT, already unblocked)

- [ ] 2.1 Drop the hand-written `TopicTrendsResponse` shadow (`{ topics, totalAnalyzed, from, to }`) in `src/core/api/hooks/use-analytics.ts` and point `useTopicTrends`'s `customFetch<T>` at the generated topic-trends response type
- [ ] 2.2 Repoint the consumer in `src/analytics/speech-analytics/speech-analytics-page.tsx` from `data?.topics` to the generated `trends` field; keep `data.totalAnalyzed` unchanged
- [ ] 2.3 Confirm no code references the removed `topics`, `from`, or `to` keys anywhere (grep the analytics module)

## 3. Adopt ComplianceRuleSummary severity (Phase B — DEPENDS on Platform buildOrder-1)

- [ ] 3.1 Drop the hand-written `ComplianceRuleSummaryDto` and its transitive `ComplianceSummaryResponse` shadow in `src/core/api/hooks/use-analytics.ts` and point `useComplianceSummary`'s `customFetch<T>` at the generated compliance-summary response type
- [ ] 3.2 Repoint the severity display/filter/sort consumers in `src/analytics/speech-analytics/speech-analytics-page.tsx` (the `SortKey` `Pick`, the `severity` filter `useState<'Info' | 'Warning' | 'Critical' | ''>`, and the severity color/sort usages) to the generated `Info | Warning | Critical` union
- [ ] 3.3 Confirm the severity-keyed color map and sort comparator compile against the generated union with no `as` casts to a hand-written literal type

## 4. Confirm PagedResult envelope by-design (Phase B — NO Web action)

- [ ] 4.1 Confirm the generated `PagedResultOf<T>` monomorphization already carries `items`, `totalCount`, `page`, `pageSize`, `totalPages`, `hasNextPage`, `hasPreviousPage` — record "no action / by-design", make NO edit here
- [ ] 4.2 Confirm the hand-written `AuditEventsPagedResult` in `src/admin/security/audit/use-audit-events.ts` is left untouched (retired by that hook's own separate future migration, out of scope)

## 5. Verification (Phase C — integration)

- [ ] 5.1 `npm run build` (type-check + bundle) passes clean — the compile-time drift gate confirms the hook usage matches the regenerated `openapi.d.ts`
- [ ] 5.2 `npx vitest run` passes; update or drop any unit test that asserted the old `topics`/`from`/`to` shape or the hand-written severity literal type
- [ ] 5.3 i18n parity green across EN-US, ES-419, PT-BR (no keys change, but run the parity check)
- [ ] 5.4 `npx playwright test` for the speech-analytics page passes using data-* selectors (anti-flake fences: no waitForTimeout, assert via expect(...) polling or waitForResponse, workers:1/retries:1)
- [ ] 5.5 Confirm the adoption ratchet is unaffected: `npm run lint:generated-types` passes with baseline floor 37 unchanged (`use-analytics.ts` already adopts `components`)
