# Tasks

> **Execution posture (`openspec/config.yaml` → `rules.tasks`).** Three phases: **A** foundation
> (batched), **B** critical components (one focused subagent each), **C** integration (batched). A
> **fresh subagent per task**, never inline in the main session.
>
> **Test ordering — stated explicitly rather than left implicit.** This change is **new capability**
> (adjudicating and adopting contract shapes, and adding an E2E spec that never existed), so its
> tests **batch into Phase C**. There are exactly **two exceptions**, both genuine bug fixes in
> `tests/e2e/tests/r4-t27-bridge.spec.ts`: per `rules.tasks`, each is preceded by its **failing
> evidence captured against the unfixed code and pasted verbatim below** (tasks 2.6 and 2.7).
>
> **API-first (`operations.apply.guidance`).** A declaration whose verdict is BLOCKED is not swapped
> and its consumer is not reshaped. `openapi.d.ts` is generated from the document Platform exports,
> so the document is already Platform's word — the fix goes there.

## 1. Phase A — Adjudicate every remaining declaration against the committed document (batched)

Each task produces a verdict per declaration — **ADOPT** / **KEEP** / **BLOCKED** — and each verdict
cites what `src/core/api/generated/openapi.d.ts` actually emits (schema name, route, field). A KEEP
whose rationale cannot be reproduced against the committed document is not a KEEP. No `src/` edit
lands in this phase; the deliverable is the verdict table, written into this file under each task.

- [ ] 1.1 Adjudicate the **15** hand-written declarations in `src/core/api/hooks/use-analytics.ts`
      (`DashboardData`, `CdrRow`, `CdrDetail`, `CdrTimelineEvent`, `CdrQaSummary`, `QaRow`,
      `QaDetail`, `QaCriterion`, `ComplianceViolationInfo`, `TranscriptSegment`, `IntervalData`,
      `PagedResult<T>`, `CdrFilters`, `QaFilters`, `BotAnalyticsSummary`). Verify: a verdict table in
      this file with one row per declaration, each citing the document. **11 of the 15 have a
      counterpart the document names on the endpoint the hook calls** and each needs a verdict —
      `DashboardData` → `DashboardDto`, `CdrRow` → `CdrRowDto`, `CdrDetail` → `CdrDetailDto`,
      `CdrTimelineEvent` → `CdrTimelineEventDto`, `CdrQaSummary` → `CdrQaSummaryDto`,
      `QaRow` → `QaRowDto`, `QaDetail` → `QaDetailDto`, `QaCriterion` → `QaCriterionDto`,
      `ComplianceViolationInfo` → `ComplianceViolationDto`, `IntervalData` → `IntervalDto`, and
      `PagedResult<T>` → `PagedDataResponseOfCdrRowDto` / `…OfQaRowDto`. Two of those are already
      established: `IntervalData` is ADOPT (field-for-field identical, zero divergence) and
      `PagedResult<T>` is BLOCKED (its only two call sites, `:193` and `:222`, hit routes returning
      `PagedDataResponseOf…`, not the sanctioned `PagedResultOf<T>`). `DashboardData` has a
      counterpart but also a real divergence to weigh — `previousPeriodKpis?: DashboardKpis`
      hand-written against `previousPeriodKpis: null | DashboardKpisDto` in the document. **The
      remaining 4 have no counterpart**: `BotAnalyticsSummary` and `TranscriptSegment` (no response
      schema on their routes; the transcript route is absent from the document entirely), and
      `CdrFilters` / `QaFilters`, which are query-parameter bags rather than wire DTOs
- [ ] 1.2 Re-adjudicate the **6** hand-written declarations in `src/core/api/hooks/use-surveys.ts`
      (`SurveyType`, `SurveyQuestion`, `Survey`, `SurveySummary`, `SurveyAnswer`, `SurveyResponse`).
      Verify: the two false rationales are replaced with what the document emits — `use-surveys.ts:7-8`
      claims "No generated enum" while the document carries
      `SurveyType: 'Csat' | 'Nps' | 'Custom'`, and `use-surveys.ts:15-17` claims the generated
      `SurveyQuestionDto` types `options` as required-nullable while the document emits
      `options?: null | string[]` — and each of the 6 carries a verdict re-derived from the true facts
- [ ] 1.3 Adjudicate the **1** hand-written declaration in `src/core/api/hooks/use-csat.ts`
      (`CsatCaptureRequest`). Verify: the verdict weighs all three recorded facts — the document names
      `components['schemas']['CsatResponseRequest']` as the request body of
      `POST /api/v{version}/csat/responses/webchat` matching field-for-field; the one divergence is
      `comment?: string | null` hand-written against `comment: null | string` in the document; and the
      only consumer, `src/webchat/embed/transport/csat-api.ts`, compiles in the separate webchat
      bundle (`tsconfig.webchat.json`) — and it records that the document declares the 200 body as
      `CsatResponseDto` while `use-csat.ts:46` types it `customFetch<void>`
- [ ] 1.4 Raise the **three** API-first reconciliations with `Verbara.Platform` and record each
      outcome in this file. Verify: one recorded Platform-side question and answer per divergence —
      (a) the CDR/QA paging envelope (`PagedDataResponseOfCdrRowDto` / `…OfQaRowDto` =
      `{ data, hasMore, page, pageSize }` against the consumed
      `{ items, totalCount, page, pageSize, hasNextPage }`, read at `src/analytics/cdr/cdr-page.tsx:221`
      — note these two routes do NOT return the sanctioned `PagedResultOf<T>`, so the question is
      which envelope the CDR and QA list reads should carry, not whether the monomorphization is
      by-design),
      (b) `src/analytics/cdr/cdr-page.tsx:185,191` reading `r.channelType` and `r.recordingStreamUrl`
      off a row whose `CdrRowDto` carries neither (`recordingStreamUrl` is on `CdrDetailDto`), and
      (c) `SurveySummary` against the document's `SurveyScoreSummary` on
      `GET /api/v{version}/analytics/surveys/{id}/summary`

## 2. Phase B — Land each adjudicated change (one focused subagent each)

- [ ] 2.1 Adopt `IntervalData` → `components['schemas']['IntervalDto']` in
      `src/core/api/hooks/use-analytics.ts`, delete the hand-written interface, and update every
      usage. Verify: `npx tsc -b` green with zero `as` casts introduced, and
      `grep -rn 'IntervalData' src/` returns only the generated alias. This is the zero-divergence
      swap and lands first, as the shape check on the recipe before any contested declaration is
      touched
- [ ] 2.2 Apply the ADOPT verdicts from task 1.1 to `src/core/api/hooks/use-analytics.ts`, skipping
      every BLOCKED declaration untouched. Verify: each adopted declaration is gone, its usages
      import the generated type, `npx tsc -b` is green, and every declaration left hand-written maps
      to a KEEP or BLOCKED row in 1.1's table
- [ ] 2.3 Apply the verdicts from task 1.2 to `src/core/api/hooks/use-surveys.ts`. Verify: every
      declaration is either adopted and deleted, or annotated with a rationale that reproduces
      against the committed document — no annotation left citing a fact the document contradicts
- [ ] 2.4 Apply the verdict from task 1.3 to `src/core/api/hooks/use-csat.ts`, and correct the
      `_comment` in `generated-types-adoption-baseline.json`, which asserts the generated counterpart
      does not exist. Verify: on ADOPT, `use-csat.ts` is removed from `unadopted_hooks` and
      `npm run lint:generated-types` passes at floor 36; on KEEP, the hook stays listed at floor 37
      and the `_comment` states the divergence that actually holds
- [ ] 2.5 Add `tests/e2e/tests/analytics/speech-analytics.spec.ts` covering the topics, sentiment and
      compliance tabs and the severity filter. Verify: selectors are only the page's existing
      `data-testid` values (`speech-analytics-page`, `topics-tab`, `topics-table`, `sentiment-tab`,
      `compliance-tab`, `severity-filter`, `compliance-table`, `empty-state`); no `waitForTimeout` or
      wall-clock wait appears; assertions poll via `expect(...)` or `waitForResponse`; no dynamic
      content is asserted with `toContainText`; and the suite posture in
      `tests/e2e/playwright.config.ts` (`workers: 1`, `retries: 1`) is untouched
- [ ] 2.6 **Bug fix, regression evidence first.** Capture the failing type-check of the _unfixed_
      `tests/e2e/tests/r4-t27-bridge.spec.ts` and paste it verbatim into this file, before any edit,
      under the "Regression evidence for 2.6" block below. Verify: the re-run reproduces that block
      exactly, confirming both defects are live against the unfixed file
- [ ] 2.7 Fix both defects in `tests/e2e/tests/r4-t27-bridge.spec.ts`: import `API_BASE` from
      `tests/e2e/helpers/credentials.ts` (used at lines 47 and 70), and correct the
      `const { page, token }` destructuring at line 36 against `authenticatedPage`'s
      `Promise<Page>` return, sourcing the token the way the other E2E specs do. Verify: re-running
      the exact command from 2.6 reports neither `TS2304: Cannot find name 'API_BASE'` nor
      `TS2339: Property 'page'/'token' does not exist on type 'Page'`, and the post-fix output is
      recorded beside 2.6's block

**Regression evidence for 2.6** — captured on the branch point, `main` @ `9d0718da`, against the
unfixed file. Neither defect is visible to any existing gate: no `tsconfig` includes `tests/e2e`
(`tsconfig.app.json` includes only `src`) and `npx eslint tests/e2e/tests/r4-t27-bridge.spec.ts`
exits 0, so the type-check is run directly.

```
npx tsc --noEmit --ignoreConfig --skipLibCheck --target es2022 --module esnext \
  --moduleResolution bundler tests/e2e/tests/r4-t27-bridge.spec.ts
```

```
tests/e2e/tests/r4-t27-bridge.spec.ts(36,15): error TS2339: Property 'page' does not exist on type 'Page'.
tests/e2e/tests/r4-t27-bridge.spec.ts(36,21): error TS2339: Property 'token' does not exist on type 'Page'.
tests/e2e/tests/r4-t27-bridge.spec.ts(47,50): error TS2304: Cannot find name 'API_BASE'.
tests/e2e/tests/r4-t27-bridge.spec.ts(70,48): error TS2304: Cannot find name 'API_BASE'.
```

`TS2591 process` and `TS7006 req` appear in the same run and are artefacts of the ad-hoc config, not
defects — do not "fix" them.

## 3. Phase C — Integration and verification (batched)

Tests for the new capability batch here, per `rules.tasks`. None of these may be checked off until
it actually ran (`operations.apply.guidance`).

- [ ] 3.1 `npm run build` — type-check + bundle clean. Verify: exit 0, output pasted here
- [ ] 3.2 `npx vitest run` — unit tests green, including
      `src/analytics/speech-analytics/speech-analytics-page.test.tsx` and any test that imported a
      declaration adopted in Phase B. Verify: exit 0 with the pass count recorded
- [ ] 3.3 `npx eslint .` — no new errors. Verify: exit 0, and any pre-existing warning count recorded
      so a new one is distinguishable
- [ ] 3.4 i18n parity green across EN-US, ES-419 and PT-BR (`npm run i18n:check`). Verify: exit 0.
      No key changes in this change, but parity is CI-enforced so the run is not assumed
- [ ] 3.5 `npm run lint:generated-types` — the adoption ratchet. Verify: exit 0 at the floor task 2.4
      established (36 if `use-csat.ts` adopted, 37 if it stayed), with the reported
      `N/62 hooks adopted` line pasted here
- [ ] 3.6 `npx playwright test tests/e2e/tests/analytics/` — the new speech-analytics spec plus the
      five existing analytics specs. Verify: the run is executed and its result pasted here, not
      inferred from a green PR — Playwright is opt-in via the `e2e` PR label
      (`.github/workflows/playwright.yml`) and is never a required check
- [ ] 3.7 Sweep for hand-written shadows of any shape adopted in Phase B: no `interface` or `type`
      in `src/` re-declares a shape now aliased from `components['schemas']`. Verify: the grep and
      its result pasted here. Known non-collision to keep excluding:
      `interface TrendPoint` at `src/admin/partner/revenue-page.tsx:76` is a local Partner-revenue
      chart shape, not an Analytics wire type
- [ ] 3.8 Run the fast, deterministic, non-service steps of this repo's own
      `.github/workflows/ci.yml` on the integrated branch — tree-scanning guards included, per
      `openspec/config.yaml` `context`. Verify: each step's exit code recorded; build plus the
      touched tests plus `openspec validate` is a strict subset and does not satisfy this task
- [ ] 3.9 `openspec validate --all --strict --no-interactive` and
      `openspec validate --archived --no-interactive`. Verify: both exit 0, output pasted here
- [ ] 3.10 Add the `CHANGELOG.md [Unreleased]` entry for this change, leaving its `(#N)` citation for
      close-out. Verify: the entry is present and names the adopted shapes plus the new E2E spec
