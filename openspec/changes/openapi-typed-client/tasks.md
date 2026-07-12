## 1. Phase A — Foundation (batch)

- [ ] 1.1 Add `openapi-typescript` as a dev dependency
- [ ] 1.2 Add `npm run generate:api-types` script that runs `openapi-typescript` against a
      local OpenAPI document path/URL and writes `src/core/api/generated/openapi.d.ts`
- [ ] 1.3 Commit a generated `openapi.d.ts` produced from the golden fixture envelope
      (`Verbara.Platform/openspec/changes/openapi-typed-client/fixtures/openapi-document.v1.sample.json`)
      as the initial checked-in artifact, pending the real Platform document
- [ ] 1.4 Re-pin `package.json` 3.13.1-web → 3.14.0-web

## 2. Phase B — Critical components (focused)

- [ ] 2.1 Migrate `useCsatQueueAnalytics` in `src/core/api/hooks/use-analytics.ts` to
      consume the generated `CsatResponseDto` type from `openapi.d.ts` in place of the
      hand-written `CsatQueueSummary` interface
- [ ] 2.2 Grep the repo for other usages of `CsatQueueSummary` (component props, tests,
      etc.) and update their imports to the generated type before deleting the old
      interface
- [ ] 2.3 Remove the now-unused hand-written `CsatQueueSummary` interface once every
      usage is migrated
- [ ] 2.4 Add a doc comment on the generated-types file pointing back to
      `npm run generate:api-types` and this change, so future contributors know it is
      generated, not hand-authored

## 3. Phase C — Integration & verification (batch)

- [ ] 3.1 Add a unit test asserting `useCsatQueueAnalytics`'s resolved type exposes
      exactly the 6 fixture fields (`queueName`, `channel`, `totalResponses`,
      `averageRating`, `rangeStart`, `rangeEnd`) with no extra or renamed keys
      (verbatim-fixture-citation guard, mirrors the csat-runner precedent's contract test)
- [ ] 3.2 `npx vitest run` — unit tests green, including 3.1
- [ ] 3.3 `npx eslint .` — clean (0 errors, per CI `lint` job)
- [ ] 3.4 `npm run build` (type-check + bundle) clean — `tsc -b` gates the generated
      types file and the migrated hook; this is the CI enforcement mechanism, no new CI
      job needed
- [ ] 3.5 Confirm i18n parity remains green (no locale-affecting change in this child,
      but the CI gate always runs)
- [ ] 3.6 No `npx playwright test` task added: this child changes only compile-time
      types and an internal analytics hook's type signature, with no new or altered
      user-facing flow — existing E2E coverage for any CSAT-consuming view already
      exercises the runtime behavior unchanged by this migration

## 4. Follow-up (tracked, not blocking this child)

- [ ] 4.1 Record the codegen delivery mechanism (committed file vs CI fetch) as a
      durable decision in `Verbara.Platform/docs/decisions/` if a later phase revisits it
      (per the shared-workstream rule — this child's design.md documents the initial
      decision but does not itself author a Platform-repo ADR)
- [ ] 4.2 Plan the next migration phase (remaining 61 hook files) grouped by module
      (Admin, Agent, Analytics, Operations) once the Platform host CI artifact
      (buildOrder 1) is live and a real generated document can replace the
      fixture-derived interim file from 1.3
