## Context

Per-module child of the `openapi-generated-types` migration, split out by
`openapi-typed-client-phase2` (archived as superseded, resolution 2 = per-module children). This
is the **Analytics** child. Thin by design — the mechanism is fixed by the archived phase-1
design; this file adds only the Analytics-module file list and the note that the CSAT slice is
already migrated.

**Mechanism (do not re-derive — see archived phase-1 design):**
`openspec/changes/archive/2026-07-12-openapi-typed-client/design.md` records the settled decisions
this child inherits verbatim: `openapi-typescript` codegen; committed `openapi.d.ts` refreshed by
`npm run generate:api-types` (not CI-fetch); swap-the-T at each hook (`T` → generated schema type,
`client.ts` untouched); structural-vs-nominal grep-before-delete discipline; and the two existing
`select`-based `number | string` → `number` coercions in `use-analytics.ts`
(`CsatResponseDto` from phase-1 and `CsatAggregateAnalyticsDto` from the archived
`2026-07-14-csat-completion` change — the two genuine coercion sites tallied so far), which this
child preserves.

## Scope — Analytics module (4 files, 43 hand-written declarations)

Ownership: Analytics owns historical reporting (dashboard, CDR, QA, surveys, CSAT, recording
metadata). The authoritative file list (with per-file declaration counts) is in this change's
`tasks.md`. `use-analytics.ts` (34 declarations) is the bulk and is already partially migrated —
its `useCsatQueueAnalytics` / `CsatResponseDto` slice shipped in phase-1 and MUST be preserved;
this child migrates its remaining hand-written declarations. `use-csat.ts` is the CSAT capture
endpoint (consumed by `src/webchat/embed/transport`), grouped under Analytics per phase2's CSAT
grouping rule.

## Non-Goals

- Migrating any Admin / Agent / Operations hook (sibling children own those).
- Regressing the already-migrated CSAT slice or its coercion.
- Implementing the shared coercion helper (the Admin child gathers sites; helper deferred to ≥3).
- Touching `src/core/realtime/platform-hub.ts` (SignalR — out of scope).
- Any Platform endpoint/DTO change — this child only consumes the document.

## Open Questions

None. Mechanism fixed by the archived phase-1 design; grouping fixed by phase2's resolution 2. Any
real upstream drift surfaces at `tsc -b` during migration and is handled per-hook.
