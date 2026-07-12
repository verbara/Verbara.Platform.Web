## Context

`openapi-typed-client` (archived 2026-07-12, Web PR#161) shipped:

- Codegen tooling (`openapi-typescript`, `npm run generate:api-types`) producing the
  committed `src/core/api/generated/openapi.d.ts`.
- One migrated slice: `useCsatQueueAnalytics` in `src/core/api/hooks/use-analytics.ts`
  consuming the generated `CsatResponseDto` type.

61 hook files (~271 hand-written declarations) across Admin, Agent, Analytics, and
Operations remain unmigrated. This change carries forward the three items its `tasks.md`
Phase 4 flagged as deferred-but-tracked, per the closing-routine follow-up-harvest rule.

## Open Questions (to resolve before `/opsx:apply` on this change)

1. **ADR timing**: does the committed-file-vs-CI-fetch delivery mechanism decision warrant
   its own ADR now, or only if/when a later phase actually reconsiders it? Leaning toward
   deferring the ADR write until there's a concrete trigger (e.g. CI artifact fetch becomes
   viable and is weighed against the current committed-file approach) — recorded here so the
   question isn't silently dropped either way.
2. **Migration grouping**: once Platform's real OpenAPI document is live as a CI artifact
   (buildOrder 1, Platform/ADR-0035), should the remaining 61 files migrate module-by-module
   (Admin, Agent, Analytics, Operations) as separate child changes, or as one larger batched
   change with per-module task phases (mirroring this capability's own Phase A/B/C
   structure)? Leaning toward per-module children — smaller review surface, matches the
   precedent this capability itself set.
3. **Coercion helper shape**: a shared helper to normalize the generated schema's
   `number | string` unions (AOT numeric wire encoding) to `number` at the hook boundary,
   replacing each hook's ad-hoc `select`/`as number` cast. Candidate location:
   `src/core/api/` alongside `client.ts`. Needs at least 2-3 concrete migrated call sites
   (this change plus the next module) before generalizing the shape, to avoid guessing at
   an abstraction from a single data point (`CsatResponseDto` + `ai-credits-readout.tsx`'s
   existing precedent).

## Non-Goals (this change)

- Does not implement the migration of any of the 61 remaining files.
- Does not implement the coercion helper.
- Does not write the Platform-repo ADR for item 1 — that, if warranted, is a separate
  Platform-repo artifact this change only points at.
