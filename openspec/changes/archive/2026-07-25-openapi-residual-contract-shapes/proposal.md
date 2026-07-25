---
tier: MEDIANO
owner: Harol
approver: Harol
stakeholder: Harol
decision_ref: Platform/ADR-0036
---

## Why

Two Analytics wire shapes that this repo still carries as **hand-written shadows** of the
generated `openapi.d.ts` types were only shadows because of Platform contract bugs that are
now being fixed at the source. The sibling `openapi-numeric-schema-truth` change explicitly
logged `TopicTrendsResponse` and `ComplianceRuleSummaryDto.severity` as
structural-divergence shapes that "SHALL stay hand-written" — but Platform's host change
`openapi-residual-contract-shapes` (`Platform/ADR-0036`) removes those divergences, so the
shadows become stale duplicates that the compiler can no longer protect. This is the Web
CONSUMER child of that Platform-hosted change: Web owns none of these DTOs, it only consumes
Platform's OpenAPI document via the generated typed client, so the entire fix is by existing
machinery (regenerate → drop the shadow → repoint the consumer). A third shape,
the `PagedResult` envelope, is checked for completeness and confirmed already-correct — no
Web action.

## What Changes

- **TopicTrends `topics`→`trends` (INDEPENDENT of Platform — Platform already emits `trends`).**
  The Web-side shadow interface `TopicTrendsResponse` in `src/core/api/hooks/use-analytics.ts`
  (`{ topics, totalAnalyzed, from, to }`) is stale against a contract that already ships
  `trends`. At apply time: drop the shadow and repoint the consumer
  `src/analytics/speech-analytics/speech-analytics-page.tsx` from `data?.topics` to the
  generated `trends`. The generated shape carries `trends` (array of
  `{ topic, occurrences, avgConfidence }`) and `totalAnalyzed` — **no** `topics`, **no**
  `from`/`to`.
- **`ComplianceRuleSummaryDto.severity` narrows back to the literal union (DEPENDS on Platform, buildOrder 1).**
  After Platform emits the `Info | Warning | Critical` literal union in its document,
  regenerate `openapi.d.ts`, drop the hand-written `ComplianceRuleSummaryDto` /
  `ComplianceSummaryResponse` shadows in `use-analytics.ts`, and repoint the severity
  display/filter/sort consumers in `speech-analytics-page.tsx` to the generated union. Web
  narrows to the enum **only after** Platform ships it (the buildOrder-2 barrier).
- **`PagedResult` envelope — NO Web action (by-design).** The generated envelope already
  matches the contract (`items`, `totalCount`, `page`, `pageSize`, `totalPages`,
  `hasNextPage`, `hasPreviousPage`); the `PagedResultOf<T>` monomorphization is intentional.
  The one remaining hand-written `AuditEventsPagedResult` in
  `src/admin/security/audit/use-audit-events.ts` is retired by that hook's own separate
  future migration, not this change. Recorded here for completeness only.

No BREAKING changes: these are internal consumer type swaps behind `client.ts`'s existing
generic `<T>`; the resolved hook data keeps the same field names the UI already reads
(`totalAnalyzed`, `severity`, the compliance rule fields), so no product behavior changes.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `openapi-generated-types`: flips the two structural-divergence exceptions logged by
  `openapi-numeric-schema-truth` — `TopicTrendsResponse` and
  `ComplianceRuleSummaryDto.severity` — from "SHALL stay hand-written" to "SHALL adopt the
  generated type", and keeps the `PagedResult` hand-written exception as still-sanctioned
  (by-design monomorphization; the `AuditEventsPagedResult` retirement is out of scope).

## Impact

- **Code (apply-time, not this planning step):** `src/core/api/hooks/use-analytics.ts`
  (drop `TopicTrendsResponse`, `ComplianceRuleSummaryDto`, `ComplianceSummaryResponse`
  shadows), `src/analytics/speech-analytics/speech-analytics-page.tsx` (repoint topic and
  severity consumers), and a regenerated `src/core/api/generated/openapi.d.ts`.
- **API-contract dependency (API-first):** Platform host change
  `openapi-residual-contract-shapes` (`Platform/ADR-0036`). The `severity` narrowing is
  buildOrder-gated on Platform emitting the `Info | Warning | Critical` literal union; the
  `topics`→`trends` swap is already unblocked (Platform emits `trends` today).
- **Gates unaffected:** the adoption ratchet `scripts/check-generated-types-adoption.mjs`
  (baseline floor 37) is untouched — `use-analytics.ts` already adopts the generated
  `components`. No i18n keys change.
