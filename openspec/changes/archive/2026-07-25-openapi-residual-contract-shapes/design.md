## Context

Verbara.Platform.Web consumes Platform's published OpenAPI document via the committed generated
declaration file `src/core/api/generated/openapi.d.ts` (`openapi-typescript`). The living
`openapi-generated-types` capability's discipline is: adopt the generated type wherever the document
carries a matching named schema, and keep a hand-written interface only where the generated shape
genuinely diverges from what the consumer needs.

The sibling child `openapi-numeric-schema-truth` (`Platform/ADR-0036`) retired the AOT
`number | string` union and, in doing so, migrated most Analytics hooks — but it explicitly logged
three shapes as structural-divergence exceptions that "SHALL stay hand-written": `TopicTrendsResponse`
(generated renames `topics`→`trends`, drops `from`/`to`), `ComplianceRuleSummaryDto.severity` (widened
from the `Info | Warning | Critical` literal union to bare `string`), and the `PagedResult<T>`
envelope. Those exceptions existed because Platform's document was diverging, not because Web wanted a
shadow.

Platform's host change `openapi-residual-contract-shapes` (`Platform/ADR-0036`) now corrects the first
two divergences at the source. This Web child is the CONSUMER side: Web owns none of these DTOs, it
only consumes the regenerated document. The fix is entirely by existing machinery — regenerate, drop
the shadow, repoint the consumer — with no new dependency, no new pattern.

## Goals / Non-Goals

**Goals:**

- Flip the `TopicTrendsResponse` and `ComplianceRuleSummaryDto.severity` shadows from "stay
  hand-written" to "adopt the generated type", matching the corrected Platform contract.
- Repoint the two consumers in `speech-analytics-page.tsx` (topic list, severity display/filter/sort)
  to the generated shapes.
- Keep the `PagedResult` envelope exception sanctioned and record it as by-design (no Web action).
- Preserve the API-first sequencing: Web narrows `severity` to the enum only after Platform's
  buildOrder-1 stage ships the literal union.

**Non-Goals:**

- Implementing any code or regenerating `openapi.d.ts` — that happens at `/xr:apply`, not in this
  planning step.
- Retiring the hand-written `AuditEventsPagedResult` in `src/admin/security/audit/use-audit-events.ts`
  — that is a separate future migration of that hook, out of scope here.
- Migrating any no-generated-counterpart Analytics shape (`BotAnalyticsSummary`, `TranscriptSegment`,
  `IntervalData`, request shapes) — untouched by this change.
- Changing the adoption ratchet baseline (floor 37) — `use-analytics.ts` already adopts the generated
  `components`, so no baseline entry moves.

## Decisions

**Decision 1 — Two shapes adopt, one stays by-design.** The three residual shapes are NOT symmetric.
`TopicTrends` and `ComplianceRuleSummary.severity` are stale shadows of a contract Platform is fixing,
so they adopt. `PagedResult` is already correct (the generated `PagedResultOf<T>` monomorphization
matches `items`/`totalCount`/`page`/`pageSize`/`totalPages`/`hasNextPage`/`hasPreviousPage`
field-for-field), so it takes no action. _Alternative considered:_ also retire
`AuditEventsPagedResult` in this change — rejected, it is a different hook's migration with its own
scope and would blur this change's boundary.

**Decision 2 — TopicTrends first (INDEPENDENT), severity gated (buildOrder-2 barrier).** Platform
already emits `trends` today, so the `topics`→`trends` swap has no Platform dependency and can land
first. The `severity` narrowing depends on Platform's buildOrder-1 stage shipping the
`Info | Warning | Critical` literal union; Web must not narrow to an enum the document does not yet
emit. _Alternative considered:_ batch both behind the Platform dependency — rejected, it needlessly
holds the already-unblocked topic swap.

**Decision 3 — Swap-the-T behind the existing generic.** Both adoptions flow through `client.ts`'s
existing generic `customFetch<T>`; the change is type-only (drop the shadow interface, point the hook's
`<T>` at `components['schemas'][...]`, update the consumer). No call-site plumbing, no runtime change.
This is the same mechanism every prior `openapi-typed-client-*` child used. _Alternative considered:_ a
mapping/adapter layer — rejected as over-engineering for a pure type swap the compiler already guards.

## Risks / Trade-offs

- **[Regenerated document diverges from the shadow's assumed fields]** → `tsc -b` (the existing
  blocking `build` CI job) fails at compile time on any mismatch between the hook usage and the
  regenerated `openapi.d.ts`, surfacing drift before runtime. This is exactly the protection the
  capability exists to provide.
- **[Web narrows `severity` before Platform ships the union]** → sequenced away: the `severity`
  adoption is buildOrder-gated on Platform's buildOrder-1 stage. `/xr:apply` stages Platform first,
  packs, then applies Web, so the regenerated document already carries the union when Web adopts.
- **[Consumer still references removed `from`/`to` or `topics` keys]** → caught at `tsc -b`; the
  consumer repoint in `speech-analytics-page.tsx` (`data?.topics` → `trends`) is part of the same
  change, so no dangling reference survives.
- **[i18n / E2E regression]** → none expected: no i18n keys change and the UI reads the same resolved
  values (`totalAnalyzed`, `severity`, the rule fields) under new type names; data-* E2E selectors are
  unaffected.

## Migration Plan

At `/xr:apply` (not this planning step), after Platform's buildOrder-1 stage ships and packs:

1. Regenerate `src/core/api/generated/openapi.d.ts` from Platform's corrected document.
2. Drop the `TopicTrendsResponse` shadow; repoint `speech-analytics-page.tsx` `data?.topics` →
   generated `trends`.
3. Drop the `ComplianceRuleSummaryDto` / `ComplianceSummaryResponse` shadows; repoint the severity
   display/filter/sort consumers in `speech-analytics-page.tsx` to the generated
   `Info | Warning | Critical` union.
4. Verify: `npm run build` (type-check + bundle), `npx vitest run`, i18n parity, and the relevant
   Playwright coverage for the speech-analytics page.

Rollback: revert the regeneration + the two file edits; the shadows return and the hooks compile
against the prior document. No data migration, no persisted state.

## Open Questions

None. The scope, sequencing, and by-design PagedResult exception are all resolved by the Platform host
change and the golden fixtures.
