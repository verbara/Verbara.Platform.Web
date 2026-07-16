## Context

`openapi-typed-client` (archived 2026-07-12, Web PR#161) shipped:

- Codegen tooling (`openapi-typescript`, `npm run generate:api-types`) producing the
  committed `src/core/api/generated/openapi.d.ts`.
- One migrated slice: `useCsatQueueAnalytics` in `src/core/api/hooks/use-analytics.ts`
  consuming the generated `CsatResponseDto` type.

61 hook files (~271 hand-written declarations) across Admin, Agent, Analytics, and
Operations remain unmigrated. This change carries forward the three items its `tasks.md`
Phase 4 flagged as deferred-but-tracked, per the closing-routine follow-up-harvest rule.

## Resolved Questions (resolved 2026-07-16; this change is archived as superseded by the four per-module children)

The three open questions below are now RESOLVED. This planning change is archived as
superseded; the resolutions are carried into the four per-module child changes
(`openapi-typed-client-admin`, `-agent`, `-analytics`, `-operations`) it spawns.

1. **ADR timing → DEFER the Platform-repo ADR.** The committed-file-vs-CI-fetch delivery
   mechanism is already recorded as a Decision in the phase-1 archived design.md and is not
   being reconsidered now, so no new Platform-repo ADR is written. **Explicit re-check
   trigger:** revisit the ADR decision if/when a CI-artifact-fetch delivery is actually
   weighed against the committed-file approach — e.g. the fixture-parity gate changes, or a
   schema-drift incident makes the stale-committed-file risk material. Until such a trigger,
   Platform/ADR-0035 (the CI-export contract) plus phase-1's design Decision are the durable
   record; no separate ADR is owed.
2. **Migration grouping → per-module child changes (4 children).** The remaining 61 files
   migrate as four separate child changes — `openapi-typed-client-admin`,
   `openapi-typed-client-agent`, `openapi-typed-client-analytics`,
   `openapi-typed-client-operations` — one per product module. Rationale: smaller review
   surface, and it matches the precedent this capability itself set (phase-1's Migration Plan
   named "by module: Admin, Agent, Analytics, Operations" as the natural grouping). **The gate
   that motivated waiting is now LIVE** — Platform/ADR-0035 + the `ci.yml` "Export OpenAPI
   document (CI-runtime capture)" step ship the real document, and the committed
   `openapi.d.ts` is already generated from it (324 paths, 182 schemas) — so all four children
   are unblocked to start.
3. **Coercion helper shape → DEFER generalizing (revisit at ≥3 genuine sites).** No shared
   helper is introduced yet. Today only `CsatResponseDto`
   (`totalResponses`/`averageRating`) is a genuine `number | string` AOT-wire-union instance.
   The **admin child** carries a task to gather concrete `number | string` union call sites as
   it migrates; the decision point is recorded as "revisit whether to introduce a shared
   coercion helper once ≥3 genuine sites exist", so the abstraction is designed from real data,
   not guessed from one. **Warning preserved:** `ai-credits-readout.tsx`'s `as number` casts
   are NOT an instance of this pattern (retro run 4, 2026-07-12) — its `AiCreditsResponse` is a
   hand-written `number | null` interface and the casts work around a TS nullable-narrowing
   gap, a different root cause. Do not model the helper on them, and do not count them toward
   the ≥3 threshold.

## Non-Goals (this change)

- Does not implement the migration of any of the 61 remaining files.
- Does not implement the coercion helper.
- Does not write the Platform-repo ADR for item 1 — that, if warranted, is a separate
  Platform-repo artifact this change only points at.
