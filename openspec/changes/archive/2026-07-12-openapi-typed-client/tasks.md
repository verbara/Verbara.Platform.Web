## 1. Phase A — Foundation (batch)

- [x] 1.1 Add `openapi-typescript` as a dev dependency
- [x] 1.2 Add `npm run generate:api-types` script that runs `openapi-typescript` against a
      local OpenAPI document path/URL and writes `src/core/api/generated/openapi.d.ts`
- [x] 1.3 Commit a generated `openapi.d.ts` produced from the golden fixture envelope
      (`Verbara.Platform/openspec/changes/openapi-typed-client/fixtures/openapi-document.v1.sample.json`)
      as the initial checked-in artifact, pending the real Platform document
      — generated from the stage-1 captured real Platform document (324 paths, 182
      schemas) rather than the smaller envelope sample, since both were available and
      the real document is a strict superset that also verbatim-matches the fixture's
      `CsatResponseDto` shape.
- [x] 1.4 Re-pin `package.json` 3.13.1-web → 3.14.0-web

## 2. Phase B — Critical components (focused)

- [x] 2.1 Migrate `useCsatQueueAnalytics` in `src/core/api/hooks/use-analytics.ts` to
      consume the generated `CsatResponseDto` type from `openapi.d.ts` in place of the
      hand-written `CsatQueueSummary` interface
- [x] 2.2 Grep the repo for other usages of `CsatQueueSummary` (component props, tests,
      etc.) and update their imports to the generated type before deleting the old
      interface
      — only `csat-kpi-card.test.tsx` imports the name; it keeps working unchanged
      since `CsatQueueSummary` is still exported (now derived from the generated type).
- [x] 2.3 Remove the now-unused hand-written `CsatQueueSummary` interface once every
      usage is migrated
      — `CsatQueueSummary` is no longer an independent hand-declaration: it's now
      `Omit<CsatResponseDto, 'totalResponses' | 'averageRating'> & { …: number }`, kept
      only to normalize the generated type's `number | string` union fields (Native AOT
      number handling) to `number` for existing consumers (`CsatKpiCard`'s numeric
      comparisons/`formatNumber` calls). No field is hand-declared independently of the
      generated schema.
- [x] 2.4 Add a doc comment on the generated-types file pointing back to
      `npm run generate:api-types` and this change, so future contributors know it is
      generated, not hand-authored

## 3. Phase C — Integration & verification (batch)

- [x] 3.1 Add a unit test asserting `useCsatQueueAnalytics`'s resolved type exposes
      exactly the 6 fixture fields (`queueName`, `channel`, `totalResponses`,
      `averageRating`, `rangeStart`, `rangeEnd`) with no extra or renamed keys
      (verbatim-fixture-citation guard, mirrors the csat-runner precedent's contract test)
      — plus a coercion test covering the `number | string` wire union.
- [x] 3.2 `npx vitest run` — unit tests green, including 3.1 (1449/1449 passed)
- [x] 3.3 `npx eslint .` — clean (0 errors, 8 pre-existing unrelated warnings, per CI
      `lint` job)
- [x] 3.4 `npm run build` (type-check + bundle) clean — `tsc -b` gates the generated
      types file and the migrated hook; this is the CI enforcement mechanism, no new CI
      job needed
- [x] 3.5 Confirm i18n parity remains green (no locale-affecting change in this child,
      but the CI gate always runs) — `npm run i18n:check` OK across 3 locales × 6
      namespaces
- [x] 3.6 No `npx playwright test` task added: this child changes only compile-time
      types and an internal analytics hook's type signature, with no new or altered
      user-facing flow — existing E2E coverage for any CSAT-consuming view already
      exercises the runtime behavior unchanged by this migration

## 4. Follow-up (tracked, not blocking this child)

> Carried forward at archive time (2026-07-12) into
> `openspec/changes/openapi-typed-client-phase2/` — see that change's `proposal.md` /
> `design.md` for the tracked, actionable form of each item below. Left unchecked here
> deliberately **at archive time (2026-07-12)**: this archived change did not itself
> resolve them. All three were resolved downstream and are ticked below (re-verified
> against the tree 2026-09-20, `verbara-meta/ADR-0023`), each citing the artifact that
> resolved it.

- [x] 4.1 Record the codegen delivery mechanism (committed file vs CI fetch) as a
      durable decision in `Verbara.Platform/docs/decisions/` if a later phase revisits it
      (per the shared-workstream rule — this child's design.md documents the initial
      decision but does not itself author a Platform-repo ADR)
      — RESOLVED 2026-07-16 in `openapi-typed-client-phase2` design.md § "Resolved
      Questions" 1: "no new Platform-repo ADR is written ... no separate ADR is owed" —
      the durable record is `Platform/ADR-0035` plus this child's design.md Decision. The
      conditional never fired: no later phase weighed CI-fetch against the committed file.
      All three per-module children restate it as settled (`openapi-typed-client-admin`
      design.md:15 "**Delivery**: committed generated file"; `-agent` design.md:11 and
      `-analytics` design.md:12 "`npm run generate:api-types` (not CI-fetch)"), and the one
      real drift incident (543 `number | string` unions, `Platform/ADR-0036`) was resolved
      by regenerating the committed file, not by changing delivery. Re-check trigger
      preserved: write the ADR if a CI-artifact-fetch delivery is ever actually weighed
      against the committed-file approach.
- [x] 4.2 Plan the next migration phase (remaining 61 hook files) grouped by module
      (Admin, Agent, Analytics, Operations) once the Platform host CI artifact
      (buildOrder 1) is live and a real generated document can replace the
      fixture-derived interim file from 1.3
      — DONE 2026-07-16: this box owed the _plan_, not the migration.
      `openapi-typed-client-phase2` design.md § "Resolved Questions" 2 adopted exactly the
      per-module grouping ("four separate child changes ... one per product module") and
      recorded the gate as satisfied ("The gate that motivated waiting is now LIVE" —
      `Platform/ADR-0035`'s CI export; the committed `openapi.d.ts` is generated from the
      real document, 324 paths / 182 schemas, per 1.3). All four children were created and
      archived: `2026-07-16-openapi-typed-client-admin` (51/51),
      `2026-07-23-openapi-typed-client-agent` (14/14),
      `2026-07-23-openapi-typed-client-operations` (12/12),
      `2026-07-25-openapi-typed-client-analytics` (0/10, never executed). Execution of the
      plan is floored by a CI ratchet (`scripts/check-generated-types-adoption.mjs`,
      `npm run lint:generated-types`): 45 unadopted hooks frozen 2026-07-20 → 37 today
      ("25/62 hooks adopted, 37 unadopted (floor 37)"). The residual hook migration is not
      this box's debt, and no single change carries it: the Analytics slice is in
      `analytics-contract-residue`, while the other 36 unadopted hooks (Admin / Operations
      files) are carried by `generated-types-adoption-baseline.json` itself — the ratchet's
      own down-only list, which is the tracked home for them.
- [x] 4.3 Consider whether `totalResponses`/`averageRating`'s generated `number | string`
      union (Native AOT number handling) should get a repo-wide coercion convention
      (e.g. a shared helper) once more numeric AOT-typed fields migrate in later phases,
      rather than each hook re-deriving its own `select` normalization
      (`ai-credits-readout.tsx` already has a similar `as number` cast precedent).
      — CONSIDERED AND ANSWERED: no coercion convention. First deferred in
      `openapi-typed-client-phase2` design.md § "Resolved Questions" 3 ("revisit ... once >=3 genuine sites exist"); the threshold was then blown past (543 unions / ~30
      `Number()` sites) and the answer was to delete the class at its source rather than
      abstract it — `Platform/ADR-0036`'s `NumericSchemaTruthTransformer` strips the
      spurious `string` arm from the emitted document, and the Web child
      `2026-07-25-openapi-numeric-schema-truth` (26/26) regenerated `openapi.d.ts` and
      retired the ~30 `Number()` coercion sites (its Phase C). Verified in the tree
      2026-09-20: `grep -c 'number | string' src/core/api/generated/openapi.d.ts` = 0;
      `CsatResponseDto.totalResponses` is `number` (openapi.d.ts:17321); the task-2.3
      `Omit<...>` wrapper is gone — `use-analytics.ts:469` is now
      `export type CsatQueueSummary = CsatResponseDto;`; no shared coercion helper exists,
      deliberately. `ai-credits-readout.tsx` was explicitly ruled out as an instance of the
      pattern (phase2 § 3, retro run 4).
