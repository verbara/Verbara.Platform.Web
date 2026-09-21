---
tier: GRANDE
owner: Harol A. Reina H.
approver: Harol A. Reina H.
stakeholder: Harol A. Reina H.
decision_ref: verbara-meta/ADR-0023
---

## Why

**This change exists because two archived changes were closed with work outstanding.** It is the
harvest that `verbara-meta/ADR-0023` requires: every task box in an archived change must be either
`- [x]` **with evidence**, or moved into an open change — never ticked without proof. The two
archived changes are:

- **`archive/2026-07-25-openapi-typed-client-analytics`** — archived **0/10, unimplemented**, on the
  grounds that `openapi-numeric-schema-truth` (`Platform/ADR-0036`) subsumed its scope. It did not:
  that sibling migrated 21 of the 43 declarations this child enumerated and left 22 hand-written.
- **`archive/2026-07-25-openapi-residual-contract-shapes`** — task 5.4, the speech-analytics E2E
  acceptance, was archived unticked under the label _"N/A this apply"_. `openspec/config.yaml`
  (`operations.archive.guidance`) is explicit that such a label "does not exempt a finding recorded
  in `tasks.md`".

Their unticked boxes are dispositioned in place under this change's branch: the ones that were
genuinely done are ticked with their evidence inline, the ones that were never tasks are recorded as
non-task bullets saying why, and the ones below are moved here.

**What the tree actually holds today** (measured on the branch point, `main` @ `9d0718da`, clean):

| file                                  | hand-written declarations | generated aliases | on the ratchet baseline |
| ------------------------------------- | ------------------------- | ----------------- | ----------------------- |
| `src/core/api/hooks/use-analytics.ts` | 15                        | 17 (+1 derived)   | no                      |
| `src/core/api/hooks/use-csat.ts`      | 1                         | 0                 | yes                     |
| `src/core/api/hooks/use-recording.ts` | 0                         | 1                 | no                      |
| `src/core/api/hooks/use-surveys.ts`   | 6                         | 1                 | no                      |
| **total**                             | **22**                    | **19**            |                         |

Repo-wide, the adoption ratchet `scripts/check-generated-types-adoption.mjs` reports
**25 of 62 hooks adopted, 37 unadopted (floor 37)** — that count is the gate's own definition
(`src/core/api/hooks/**`, `.ts`/`.tsx`, excluding `*.test.ts(x)`; adoption = the file imports
`@/core/api/generated`), reproduced independently and matching the baseline file entry-for-entry.

**Three of the remaining adoptions are blocked on Platform, not on Web.** This repo is API-first
(`openspec/config.yaml`, `operations.apply.guidance`: _"If apply reveals the API shape is wrong, fix
it there — never reshape the client to match an unblessed surface"_), and `openapi.d.ts` is
generated from Platform's own exported document, so the document is already Platform's word and it
is the **client** that contradicts it:

1. **The CDR/QA paging envelope is incompatible, with runtime risk.** The hooks type
   `PagedResult<T>` = `{ items, totalCount, page, pageSize, hasNextPage }` and the consumers read
   exactly that (`src/analytics/cdr/cdr-page.tsx:221`), but the document declares
   `PagedDataResponseOfCdrRowDto` / `PagedDataResponseOfQaRowDto` = `{ data, hasMore, page,
pageSize }`. Every unit test mocks the hook, so nothing in CI detects the divergence. The living
   spec blessed this shape as by-design, but it did so about a **different envelope**: the sanctioned
   `PagedResultOf<T>` monomorphization (13 schemas, carrying `items`/`totalCount`/`hasNextPage`) is
   genuinely fine, and the hand-written `PagedResult<T>` is never used on one of its routes — its
   only two call sites are `use-analytics.ts:193` (CDR) and `:222` (QA), the two routes that return
   the other envelope. The exception and the divergence were conflated.
2. **`src/analytics/cdr/cdr-page.tsx:185,191` reads `r.channelType` and `r.recordingStreamUrl` off a
   CDR row.** `CdrRowDto` carries neither; `recordingStreamUrl` lives on `CdrDetailDto`.
3. **`SurveySummary` vs `SurveyScoreSummary`** on the same route
   `GET /api/v{version}/analytics/surveys/{id}/summary`.

**Two recorded rationales are false against the committed document**, so the decisions resting on
them are unverified: `use-surveys.ts:7-8` says _"No generated enum"_ when the document carries
`SurveyType: 'Csat' | 'Nps' | 'Custom'`; `use-surveys.ts:15-17` says the generated
`SurveyQuestionDto` types `options` as _"required-nullable (`null | string[]`)"_ when the document
emits `options?: null | string[]`. The living spec makes the same error for `use-csat.ts`, listing
`CsatCaptureRequest` among "no-generated-counterpart shapes" when
`components['schemas']['CsatResponseRequest']` is the request body the document names for that exact
route.

**The speech-analytics page is the only Analytics page with no E2E spec**, and the one spec that
touches it is broken twice over. `tests/e2e/tests/analytics/` holds five specs (dashboard, cdr,
agent-intervals, intervals, qa) out of 73 repo-wide; none covers speech-analytics.
`tests/e2e/tests/r4-t27-bridge.spec.ts` does drive `/analytics/speech`, but it is a T27 push-bridge
spec skipped unless `E2E_FULL_STACK=true`, and it (a) references `API_BASE` at lines 47 and 70
without ever importing it, and (b) destructures `const { page, token }` from `authenticatedPage`,
which returns `Promise<Page>`. Nothing catches either: no `tsconfig` includes `tests/e2e`
(`tsconfig.app.json` includes only `src`) and `npx eslint tests/e2e/tests/r4-t27-bridge.spec.ts`
exits 0. The `skip` hides both.

## What Changes

- **Adjudicate all 22 remaining hand-written declarations** in the four Analytics hook files against
  the committed `src/core/api/generated/openapi.d.ts`, one verdict per declaration: ADOPT (a clean
  structural match), KEEP (a divergence verified against the document today), or BLOCKED (a
  divergence Platform must resolve first). Every KEEP rationale must cite what the document actually
  emits — the two false rationales in `use-surveys.ts` and the false "no-generated-counterpart"
  claim for `CsatCaptureRequest` are re-adjudicated under this rule.
- **Adopt the declarations whose verdict is ADOPT**, swap-the-T behind `client.ts`'s existing
  generic `<T>` — no new mechanism. `IntervalData` → `IntervalDto` is the one adoption that is a
  pure swap with zero divergence (field-for-field identical), so it lands first as the shape check
  on the recipe.
- **Open the three API-first reconciliations with Platform** (the paging envelope, the two CDR-row
  fields, `SurveySummary`) and record each outcome. Web does **not** reshape a hook to match an
  unblessed surface, and does **not** adopt a BLOCKED shape until Platform's answer lands.
- **Add `tests/e2e/tests/analytics/speech-analytics.spec.ts`**, covering the topics / sentiment /
  compliance tabs and the severity filter through the page's existing `data-testid` surface, under
  the suite's anti-flake fences. This is the acceptance `openapi-residual-contract-shapes` owed for
  the `trends` and `severity` adoptions it shipped.
- **Fix the two defects in `tests/e2e/tests/r4-t27-bridge.spec.ts`** (unimported `API_BASE`,
  wrong destructuring of `authenticatedPage`), each with its failing regression evidence captured
  first.
- **Ratchet `generated-types-adoption-baseline.json` down** for any hook that adopts, and correct
  its `_comment` where it records a rationale the document contradicts.

Not in scope: the Admin, Agent and Operations modules (their children are archived complete);
`src/core/realtime/platform-hub.ts` (SignalR payloads stay hand-written by standing requirement);
retiring `AuditEventsPagedResult` in `src/admin/security/audit/use-audit-events.ts` (its own hook's
separate migration); and the obsolete `number | string` comments in `use-agent-memberships.ts:14`,
`use-system.ts:19`, `use-webhooks.ts:251`, `use-cluster.ts:74` and `agent-detail.tsx:53` — those are
Admin/Operations files, noted here only so the next reader does not mistake them for this module's
debt.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `openapi-generated-types`: corrects the Analytics adoption requirement, whose sanctioned-exception
  list is false against the committed document in three places (`IntervalData`, `CsatCaptureRequest`,
  and the `PagedResult<T>` envelope); requires every KEEP to carry a rationale verifiable against the
  document; realigns the ratchet requirement with the floor as it actually stands (37, not 39); and
  adds the end-to-end acceptance the residual-shapes adoptions never received.

## Impact

- **Code (apply-time, not this planning step):** `src/core/api/hooks/use-analytics.ts`,
  `use-csat.ts`, `use-surveys.ts`; `src/analytics/cdr/cdr-page.tsx` and
  `src/analytics/speech-analytics/speech-analytics-page.tsx` if a reconciliation changes a consumed
  field; `generated-types-adoption-baseline.json`; a new
  `tests/e2e/tests/analytics/speech-analytics.spec.ts`; and `tests/e2e/tests/r4-t27-bridge.spec.ts`.
- **API-contract dependency (API-first):** three reconciliations must be answered by Platform before
  the shapes they govern can be adopted — the CDR/QA paging envelope
  (`PagedDataResponseOfCdrRowDto` / `…OfQaRowDto` vs the consumed `PagedResult<T>`), the missing
  `channelType` / `recordingStreamUrl` on `CdrRowDto`, and `SurveySummary` vs `SurveyScoreSummary`.
  Each is a Platform-side decision recorded in `Verbara.Platform`; Web consumes the outcome.
- **Runtime risk this change surfaces:** the paging divergence is the only item here that can fail at
  runtime rather than at `tsc -b`. It is invisible to the current suite because every CDR/QA unit
  test mocks the hook, which is why the E2E work and the reconciliation belong in one change.
- **Gates:** the adoption ratchet floor moves down only as hooks adopt, never up. No i18n keys
  change, so parity is unaffected. `npx playwright test` is opt-in via the `e2e` PR label
  (`.github/workflows/playwright.yml`), not a required check, so the new spec is run deliberately.
- **Why GRANDE:** three of the adoptions cannot be decided inside this repo — they need a Platform
  contract answer first — which puts the change over the MEDIANO "one repo" line.
