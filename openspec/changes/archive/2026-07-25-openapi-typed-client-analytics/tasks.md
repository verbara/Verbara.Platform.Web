## 1. Phase A — Migrate Analytics-module hook files (swap-the-T, per file)

Each task: replace the file's hand-written request/response interface(s) with the generated
`components['schemas']['<SchemaName>']` type (aliased locally), grep the repo for every usage of
each removed interface name and update imports, then delete the hand-written declaration. `tsc -b`
must stay green after each. Counts in parens = hand-written declarations in the file today (43
total).

- 1.1 `use-analytics.ts` (34) — PARTIALLY EXECUTED, then superseded in place: 17 of the 34
  hand-written declarations now alias `components['schemas'][…]`, migrated by #222 (`8f85a6ea`)
  and #226 (`80deb767`), not by this change — including the `CsatAggregateAnalyticsDto`
  follow-up this box named, now
  `CsatAggregateSummary = components['schemas']['CsatAggregateDto']` (`use-analytics.ts:494`).
  The box's "preserve the two already-migrated CSAT coercions unchanged" instruction was
  deliberately reversed by Platform/ADR-0036, which stripped the `number | string` union at the
  source and retired both `select` normalizers. The 15 hand-written interfaces still in the
  file — 11 of them with an unadopted counterpart the document names on the very endpoint the
  hook calls (all 11 verified present in `openapi.d.ts` 2026-09-20; enumerated in
  `analytics-contract-residue` task 1.1) — moved to `analytics-contract-residue`.
- 1.2 `use-csat.ts` (1) — NOT EXECUTED: the file was never touched by the superseding work (its
  only commit is `496af57a`, 2026-07-11) and still hand-declares `CsatCaptureRequest` with 0
  generated-type references, although the document names
  `components['schemas']['CsatResponseRequest']` as the request body of
  `POST /api/v{version}/csat/responses/webchat` and `CsatResponseDto` as its 200 body (the hook
  types the response `void`). Moved to `analytics-contract-residue`.
- [x] 1.3 `use-recording.ts` (1) — done by #222 (`8f85a6ea`, CI `build`/`test`/`lint` SUCCESS):
      `src/core/api/hooks/use-recording.ts:7` is
      `export type RecordingMetadata = components['schemas']['RecordingMetadataDto'];`, the
      schema the document names for `GET /api/v{version}/recordings/{sessionId}`; 0
      hand-written declarations remain in the file.
- 1.4 `use-surveys.ts` (7) — PARTIALLY EXECUTED by #222 (`8f85a6ea`): `QuestionType` now
  aliases `components['schemas']['SurveyQuestionType']` and the other 6 declarations were
  annotated KEEP-hand-written; 4 of those rationales verify against the committed document and
  2 do not — `SurveyType`'s "No generated enum" (`components['schemas']['SurveyType']` exists)
  and `SurveyQuestion`'s "required-nullable `options`" (the document emits
  `options?: null | string[]`) — while `SurveySummary` types a
  `GET /api/v{version}/analytics/surveys/{id}/summary` response the document declares as
  `SurveyScoreSummary`. Re-adjudication moved to `analytics-contract-residue`.

## 2. Phase B — Coercion sites (report to the Admin child's tally)

- 2.1 (never a task — the condition never fired and can no longer fire) The committed
  `src/core/api/generated/openapi.d.ts` carries 0 `number | string` unions across its 360
  schemas: Platform/ADR-0036 (`openapi-numeric-schema-truth`) stripped the AOT wire union at
  the source and #222 (`8f85a6ea`) retired the coercion class outright, so no migrated
  Analytics hook can expose a NEW genuine site. The shared tally in
  `openapi-typed-client-admin` closes at its 2 now-retired sites instead of advancing toward
  the ≥3-genuine-sites decision point. Do not re-open.

## 3. Phase C — Validation (batch)

- 3.1 `npm run build` — not run for this change (archived 0/10, unimplemented). The Analytics
  migration that did ship was type-checked green as the required `build` check on #222 and #226
  (both merged 2026-07-25); the batch re-runs over the residue in `analytics-contract-residue`.
- 3.2 `npx vitest run` — not run for this change. The shipped subset passed the required `test`
  check on #222 and #226 (both SUCCESS, 2026-07-25); note the box's "including the existing
  CSAT coercion tests" no longer describes the tree — #222 rewrote them to assert the union is
  extinct (`use-analytics.test.tsx:567`, `use-csat-aggregate.test.ts:19`). The batch re-runs
  over the residue in `analytics-contract-residue`.
- 3.3 `npx eslint .` — not run for this change. The shipped subset passed the required `lint`
  and `i18n` checks on #222 and #226 (both SUCCESS, 2026-07-25); the batch re-runs over the
  residue in `analytics-contract-residue`.
- 3.4 Confirm no hand-written interface remains for any migrated Analytics shape — verified
  true today for the 19 already-migrated shapes (the only name collision,
  `interface TrendPoint` at `src/admin/partner/revenue-page.tsx:76`, is a local Partner-revenue
  chart shape, not an Analytics wire type) — but the sweep cannot close while 22 hand-written
  declarations remain across the four files; and this box's second clause ("the CSAT slice's
  public type is unchanged") is SUPERSEDED: `CsatQueueSummary` went from
  `interface … extends Omit<…>` with a `Number()` `select` to
  `export type CsatQueueSummary = CsatResponseDto` (`use-analytics.ts:469`) by
  Platform/ADR-0036's design. The remaining sweep moved to `analytics-contract-residue`.
- 3.5 (never a task) A scoping statement, not work: no `npx playwright test` task is required
  because swap-the-T is compile-time-only (this change's `design.md`, "Mechanism"), and the
  repo runs Playwright opt-in via the `e2e` PR label
  (`.github/workflows/playwright.yml:31-38`), never as a required check — #222 and #226 both
  merged with no e2e check in their rollup. Do not re-open.
