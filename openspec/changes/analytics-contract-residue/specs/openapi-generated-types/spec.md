## MODIFIED Requirements

### Requirement: Analytics module hooks adopt generated types now that the numeric union is gone

Every hand-written declaration remaining in the Analytics-module hook files under
`src/core/api/hooks/` — `use-analytics.ts`, `use-csat.ts`, `use-recording.ts`, `use-surveys.ts` —
SHALL carry an explicit, document-cited verdict, and each declaration whose verdict is ADOPT SHALL
consume the generated type from `src/core/api/generated/openapi.d.ts` behind `client.ts`'s existing
generic `<T>` (swap-the-T), with the hand-written shape removed and every usage updated.

The authoritative per-declaration list lives in this change's `tasks.md`. As measured on the branch
point (`main` @ `9d0718da`) the residue is **22 hand-written declarations**: 15 in
`use-analytics.ts`, 6 in `use-surveys.ts`, 1 in `use-csat.ts`, and 0 in `use-recording.ts`, which is
fully adopted. The earlier "~39 hand-written declarations" figure described the four files before
`openapi-numeric-schema-truth` migrated 21 of them and is superseded by this count.

Exactly three verdicts are permitted, and each MUST cite what the committed `openapi.d.ts` emits:

- **ADOPT** — the document names a counterpart on the endpoint the hook calls and the shape matches
  structurally. The hand-written declaration MUST be deleted.
- **KEEP** — a field-level divergence, reproducible against the committed document today, makes the
  swap lossy or breaking. The rationale MUST quote the divergence. A rationale that cannot be
  reproduced against the document is NOT a KEEP; the declaration is unadjudicated and MUST be
  re-adjudicated.
- **BLOCKED** — the document and the consumer contradict each other, so the shape is a Platform
  contract question. Web SHALL NOT adopt it and SHALL NOT reshape the consumer to match; the
  divergence goes to Platform and the recorded outcome governs.

The previously sanctioned exception list is corrected in three places where it does not hold against
the committed document, and those declarations are now subject to the verdict rule above rather than
exempt from it:

- **`IntervalData`** was listed as having no generated counterpart. The document emits `IntervalDto`
  with the same eleven fields in the same order (`queueName`, `intervalStart`, `intervalSeconds`,
  `callsOffered`, `callsAnswered`, `callsAbandoned`, `slaPercent`, `asaMs`, `ahtMs`,
  `abandonRatePercent`, `slaMetCount`). It is a zero-divergence ADOPT.
- **`CsatCaptureRequest`** was listed as having no generated counterpart. The document names
  `components['schemas']['CsatResponseRequest']` as the request body of
  `POST /api/v{version}/csat/responses/webchat`, matching field-for-field. Its adjudication MUST
  weigh the one real divergence (`comment?: string | null` hand-written against
  `comment: null | string` in the document) and the webchat bundle boundary, and MUST record that
  the document declares the 200 body as `CsatResponseDto` while the hook types it `void`.
- **The hand-written `PagedResult<T>` in `use-analytics.ts`** was covered by the sanctioned
  `PagedResultOf<T>` exception, but it is never used on a `PagedResultOf<T>` route. Its only two
  call sites are the CDR and QA list reads (`use-analytics.ts:193` and `:222`), and those two
  endpoints return `PagedDataResponseOfCdrRowDto` and `PagedDataResponseOfQaRowDto` —
  `{ data, hasMore, page, pageSize }`, a different envelope. That is a BLOCKED contract divergence,
  not a sanctioned exception; the `PagedResultOf<T>` exception itself is unaffected and stands.

Shapes with no counterpart in the document SHALL stay hand-written, and this remains true as
measured today: `BotAnalyticsSummary` (the `/analytics/bot` route declares no response schema),
`SurveyAnswer` and `SurveyResponse` (`/api/v{version}/analytics/surveys/{id}/responses` declares
none), and `TranscriptSegment` (the transcript route is absent from the document entirely — zero
occurrences of `transcript`). `CdrFilters` and `QaFilters` are query-parameter bags, not wire DTOs,
and are outside this requirement. SignalR payloads under `src/core/realtime/` remain out of scope.

#### Scenario: An Analytics hook with a now-clean match drops its hand-written interface

- **GIVEN** a hand-written declaration in an Analytics hook whose counterpart the document names on
  the endpoint that hook calls, matching field-for-field
- **WHEN** `openapi.d.ts` is regenerated from the corrected document and the shape gives a clean
  structural match
- **THEN** its verdict is ADOPT, the hook consumes `components['schemas']['<SchemaName>']` via
  `customFetch<T>`, the hand-written interface is removed, every usage imports the generated type,
  and `tsc -b` (the existing blocking `build` CI job) passes

#### Scenario: The two corrected residual shadows adopt the generated type instead of staying hand-written

- **GIVEN** `TopicTrendsResponse` (generated with `trends`, not `topics`, and without `from`/`to`)
  and `ComplianceRuleSummaryDto.severity` (narrowed to `Info | Warning | Critical` by the Platform
  host change `openapi-residual-contract-shapes`, `Platform/ADR-0036`)
- **WHEN** the adoption is applied
- **THEN** each such shadow is dropped and its consumer repointed to the generated type — reversing
  the earlier "SHALL stay hand-written" posture, which held only while Platform's document diverged.
  This adoption has shipped: both now alias `components['schemas'][…]` in `use-analytics.ts`. What it
  never received is the end-to-end acceptance, which this change adds

#### Scenario: The PagedResult envelope stays hand-written by design as a still-sanctioned exception

- **GIVEN** the generated `PagedResultOf<T>` monomorphization, which the document emits across 13
  schemas carrying `items`, `totalCount`, `page`, `pageSize`, `totalPages`, `hasNextPage` and
  `hasPreviousPage`
- **WHEN** this change re-examines the envelope exception
- **THEN** the `PagedResultOf<T>` exception remains sanctioned and no forced swap is made for the
  endpoints that return it — the monomorphization is by-design, and the one hand-written
  `AuditEventsPagedResult` in `src/admin/security/audit/use-audit-events.ts` is still retired by that
  hook's own separate future migration, not this change

#### Scenario: The CDR and QA list endpoints return a different envelope, which is BLOCKED

- **GIVEN** the hand-written `PagedResult<T>` (`{ items, totalCount, page, pageSize, hasNextPage }`)
  used at exactly two call sites, `use-analytics.ts:193` (CDR) and `:222` (QA), whose endpoints the
  document declares as `PagedDataResponseOfCdrRowDto` and `PagedDataResponseOfQaRowDto` —
  `{ data, hasMore, page, pageSize }` — and a consumer reading `data?.items` at
  `src/analytics/cdr/cdr-page.tsx:221`
- **WHEN** this change adjudicates that envelope
- **THEN** its verdict is BLOCKED, no hook and no consumer is reshaped, the divergence is raised as a
  Platform contract question, and the recorded Platform outcome governs whether a later adoption
  happens — because this repo is API-first and the generated document is Platform's own word

#### Scenario: A KEEP rationale that the document contradicts is re-adjudicated

- **GIVEN** a declaration annotated KEEP with a rationale such as "No generated enum" or "the
  generated type is required-nullable", and a committed document that emits the enum
  (`SurveyType: 'Csat' | 'Nps' | 'Custom'`) or emits the field as optional-and-nullable
  (`options?: null | string[]`)
- **WHEN** this change re-adjudicates the declaration against the committed document
- **THEN** the false rationale is replaced with what the document actually emits, and the verdict is
  re-derived from that — ADOPT if the divergence does not survive, KEEP with the true divergence
  quoted if it does

### Requirement: Generated-types adoption baseline ratchets down as analytics hooks adopt

The adoption ratchet `scripts/check-generated-types-adoption.mjs` (`npm run lint:generated-types`)
SHALL force `generated-types-adoption-baseline.json`'s floor DOWN as each Analytics hook adopts, and
its `_comment` SHALL NOT record a rationale the committed document contradicts. The gate fails if a
hook not on the unadopted list is unadopted; as a hook adopts, it MUST be removed from the list,
which only ever ratchets down, never up.

The floor stands at **37** as measured on the branch point, over **62** hook files
(`src/core/api/hooks/**`, `.ts`/`.tsx`, excluding `*.test.ts(x)`), of which **25** adopt. The earlier
"floor 39" figure and its three-hook list are superseded: `use-recording.ts` and `use-surveys.ts`
already came off the list under `openapi-numeric-schema-truth`, and `use-csat.ts` is the only one of
the four Analytics hook files still on it. If `use-csat.ts` adopts under this change it MUST be
removed from the list and the floor MUST fall to 36; if its verdict is KEEP it stays, and the
`_comment`'s rationale for keeping it MUST be the one that reproduces against the document.

#### Scenario: Adopting analytics hooks trims the unadopted list

- **GIVEN** `use-csat.ts` on `generated-types-adoption-baseline.json`'s `unadopted_hooks` list
  (floor 37, after `use-recording.ts` and `use-surveys.ts` were trimmed at floor 39)
- **WHEN** this change migrates it to consume generated types and removes it from the list
- **THEN** `npm run lint:generated-types` passes with the lower floor, and no hook that already
  adopts generated types remains on the unadopted list

#### Scenario: A hook that stays hand-written keeps a rationale the document supports

- **GIVEN** `use-csat.ts` adjudicated KEEP, and a baseline `_comment` asserting the generated
  counterpart does not exist
- **WHEN** this change re-adjudicates it against the committed document, which names
  `components['schemas']['CsatResponseRequest']` on that route
- **THEN** the baseline `_comment` states the divergence that actually holds — optional versus
  required-nullable `comment`, and the webchat bundle boundary — rather than the absence of a
  counterpart, and the floor stays at 37

## ADDED Requirements

### Requirement: Adopted Analytics contract shapes carry end-to-end acceptance on the speech-analytics page

The speech-analytics page SHALL carry a Playwright spec at
`tests/e2e/tests/analytics/speech-analytics.spec.ts` that exercises the topics, sentiment and
compliance tabs and the severity filter through the page's `data-testid` surface, and every E2E spec
that drives that page MUST compile — an identifier a spec references SHALL be imported.

This is the acceptance the archived `openapi-residual-contract-shapes` change owed and did not
deliver: it adopted the generated `trends` shape and the `Info | Warning | Critical` severity union
and closed its task 5.4 with the label "N/A this apply", which `openspec/config.yaml`
(`operations.archive.guidance`) does not accept as an exemption. The page is the only Analytics page
without a spec — `tests/e2e/tests/analytics/` holds five (dashboard, cdr, agent-intervals, intervals,
qa) of the repo's 73 — and `openspec/config.yaml` `rules.tasks` requires `npx playwright test`
coverage with `data-*` selectors for user-facing flows.

The spec SHALL use the page's existing `data-testid` surface — `speech-analytics-page`,
`topics-tab`, `topics-table`, `sentiment-tab`, `compliance-tab`, `severity-filter`,
`compliance-table`, `empty-state` — and SHALL honour the suite's anti-flake fences: no
`waitForTimeout` or wall-clock wait, assertions via `expect(...)` polling or `waitForResponse`, and
the suite posture already set in `tests/e2e/playwright.config.ts` (`workers: 1`, `retries: 1`).
Dynamic content SHALL NOT be asserted with `toContainText`, which breaks under a locale switch.

`tests/e2e/tests/r4-t27-bridge.spec.ts` SHALL compile. It references `API_BASE` at lines 47 and 70
without importing it (it is exported from `tests/e2e/helpers/credentials.ts`), and it destructures
`const { page, token }` from `authenticatedPage`, which returns `Promise<Page>`. Both are latent: no
`tsconfig` includes `tests/e2e`, `npx eslint` on the file exits 0, and the spec is skipped unless
`E2E_FULL_STACK=true`, so nothing surfaces either defect. Each fix MUST be preceded by its failing
evidence captured against the unfixed file and pasted verbatim into `tasks.md`.

Component-level coverage remains in place and is not a substitute:
`src/analytics/speech-analytics/speech-analytics-page.test.tsx` passes 5/5 and asserts both adopted
shapes (`trends`, `severity: 'Critical'`), but it renders the page against mocked hooks and so cannot
observe a wire-shape divergence.

#### Scenario: The speech-analytics page gains a spec over its data-testid surface

- **GIVEN** a speech-analytics page exposing `speech-analytics-page`, `topics-tab`, `topics-table`,
  `sentiment-tab`, `compliance-tab`, `severity-filter`, `compliance-table` and `empty-state`, and no
  E2E spec covering it
- **WHEN** `tests/e2e/tests/analytics/speech-analytics.spec.ts` is added, selecting only by
  `data-testid`, asserting via `expect(...)` polling or `waitForResponse`, and using no
  `waitForTimeout`
- **THEN** the spec drives the topics, sentiment and compliance tabs and the severity filter, passes
  under the suite posture (`workers: 1`, `retries: 1`), and its run is recorded rather than inferred
  from a green PR, because Playwright is opt-in via the `e2e` PR label

#### Scenario: A spec that references an unimported identifier is fixed from failing evidence

- **GIVEN** `tests/e2e/tests/r4-t27-bridge.spec.ts` referencing `API_BASE` at lines 47 and 70 with no
  import, and destructuring `const { page, token }` from a helper returning `Promise<Page>`
- **WHEN** the file is type-checked before any edit, producing `error TS2304: Cannot find name
'API_BASE'` and `error TS2339: Property 'page' does not exist on type 'Page'`
- **THEN** that failure is pasted verbatim into `tasks.md` as the regression evidence, the import and
  the destructuring are then corrected, and re-running the same type-check reports neither error

## Architectural Risk

**Level:** MEDIUM

**Affected:** `src/core/api/hooks/use-analytics.ts`, `use-csat.ts` and `use-surveys.ts`;
`src/analytics/cdr/cdr-page.tsx` and `src/analytics/speech-analytics/speech-analytics-page.tsx` if a
Platform reconciliation changes a consumed field; `generated-types-adoption-baseline.json`;
`tests/e2e/tests/analytics/speech-analytics.spec.ts` (new) and
`tests/e2e/tests/r4-t27-bridge.spec.ts`. Cross-repo: three contract divergences are Platform's to
decide, and `src/webchat/embed/transport/csat-api.ts` sits in the separately-compiled webchat bundle.

**Mitigation:** The adoptions are type-only swaps behind `client.ts`'s existing generic `<T>`, so
drift between a hook and the regenerated document is caught at `tsc -b` (the blocking `build` job),
not at runtime. The level is MEDIUM rather than LOW on account of the one item that is _not_
compile-time: the CDR/QA envelope, whose divergence would surface as an empty grid and which every
CDR/QA unit test hides by mocking the hook. That item is therefore BLOCKED pending Platform rather
than swapped, and the new E2E spec is the coverage that would observe such a divergence on the one
Analytics page that had none. A BLOCKED verdict changes no code, so the blocked path carries no
regression risk. No i18n keys change, so parity is unaffected. The ratchet floor moves down only if a
hook adopts, never up.
