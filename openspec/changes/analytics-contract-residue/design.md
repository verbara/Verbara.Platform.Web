## Context

This is a **harvest change**, not a new capability. `verbara-meta/ADR-0023` fixed the rule for
clearing a repo's archived-task backlog — per box, either `- [x]` **with evidence**, or move it into
an open change; never tick without proof — and this repo's
`openspec validate --archived --no-interactive` was failing on three archived changes. Two of them
held work that is genuinely undone; this change is where that work now lives.

**Mechanism (do not re-derive — inherited verbatim):**
`openspec/changes/archive/2026-07-12-openapi-typed-client/design.md` records the settled decisions:
`openapi-typescript` codegen, a committed `openapi.d.ts` refreshed by `npm run generate:api-types`
(not CI-fetch), swap-the-T at each hook (`T` → generated schema type, `client.ts` untouched), and
the structural-vs-nominal grep-before-delete discipline. Nothing here changes any of that.

**What is new here is the adjudication discipline, not the swap.** The archived record shows the
failure mode this change must not repeat: a declaration was annotated KEEP with a rationale nobody
re-checked against the document, and the annotation then outlived the fact. Three such rationales
are false today — two in `use-surveys.ts` and one in the living spec's exception list for
`CsatCaptureRequest`. So every declaration gets an explicit verdict with a citation of what the
committed document actually emits, and a KEEP is as much a deliverable as an ADOPT.

## Goals / Non-Goals

**Goals**

- Every one of the 22 remaining hand-written declarations in the four Analytics hook files carries a
  verdict — ADOPT, KEEP or BLOCKED — each citing the committed document.
- The declarations whose verdict is ADOPT are adopted; the hand-written shape is deleted and every
  usage updated.
- The three divergences that Platform must decide are opened as Platform-side questions and their
  outcomes recorded, with Web adopting nothing until the answer lands.
- The speech-analytics page gets the E2E acceptance the residual-shapes change owed it, and the two
  latent defects in `tests/e2e/tests/r4-t27-bridge.spec.ts` are fixed.

**Non-Goals**

- Migrating any Admin / Agent / Operations hook — those children are archived complete, and their
  stale `number | string` comments belong to them.
- Touching `src/core/realtime/platform-hub.ts` (SignalR payloads stay hand-written by standing
  requirement).
- Retiring `AuditEventsPagedResult` in `src/admin/security/audit/use-audit-events.ts`.
- Reshaping any hook to match a surface Platform has not blessed — a BLOCKED shape stays exactly as
  it is until Platform answers.
- Introducing a shared numeric-coercion helper. That question is closed, not deferred: the
  `number | string` wire union is extinct at the source (`Platform/ADR-0036`) and the committed
  document carries zero occurrences.

## Decisions

**1. A KEEP is a deliverable, not a default.** Each KEEP must name the field-level divergence and
quote what the document emits. A rationale that cannot be reproduced against the committed
`openapi.d.ts` is not a KEEP — it is an unadjudicated declaration.

**2. `IntervalData` → `IntervalDto` goes first.** It is the only adoption with zero divergence: both
carry `queueName`, `intervalStart`, `intervalSeconds`, `callsOffered`, `callsAnswered`,
`callsAbandoned`, `slaPercent`, `asaMs`, `ahtMs`, `abandonRatePercent`, `slaMetCount`, in that
order. Landing it first proves the recipe still holds before any contested shape is touched.

**3. The three Platform reconciliations are answered before the shapes they govern are touched.**
`openapi.d.ts` is generated from the document Platform exports, so the document is already
Platform's word and the client is what contradicts it. The API-first rule therefore points the fix
at Platform, not at the hook. Concretely:

| divergence     | client today                                                                                                            | document today                                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| CDR/QA paging  | `PagedResult<T>` = `{ items, totalCount, page, pageSize, hasNextPage }`, used only at `use-analytics.ts:193` and `:222` | `PagedDataResponseOfCdrRowDto` / `…OfQaRowDto` = `{ data, hasMore, page, pageSize }` — not the sanctioned `PagedResultOf<T>` |
| CDR row fields | `cdr-page.tsx:185,191` read `r.channelType`, `r.recordingStreamUrl`                                                     | `CdrRowDto` has neither; `recordingStreamUrl` is on `CdrDetailDto`                                                           |
| survey summary | `SurveySummary` = `{ surveyId, surveyName, … }`                                                                         | `SurveyScoreSummary` = `{ totalResponses, averageScore, promoters, passives, detractors, npsScore }`                         |

The paging row is the one with runtime consequences: a response keyed `data`/`hasMore` read as
`items`/`totalCount` yields an empty grid, and no test catches it because every CDR/QA unit test
mocks the hook. That is why the E2E work and the reconciliation sit in one change. It also shows how
the exception list went stale: the living spec blessed `PagedResult<T>` by pointing at the
`PagedResultOf<T>` monomorphization, which is by-design and still correct — but the hand-written
`PagedResult<T>` is never used on a `PagedResultOf<T>` route. Two envelopes were read as one.

**4. `use-csat.ts` is adjudicated, not assumed.** Both the living spec and
`generated-types-adoption-baseline.json` record a decision about it, and they disagree on the facts.
The living spec lists `CsatCaptureRequest` under "no-generated-counterpart shapes", which is false —
`components['schemas']['CsatResponseRequest']` is the request body the document names for
`POST /api/v{version}/csat/responses/webchat`, matching field-for-field. The baseline's rationale is
the verifiable one, and it names two things to weigh: `comment` is `comment?: string | null`
hand-written against `comment: null | string` in the document (optional vs required-nullable, which
would force every caller to pass the field), and the only consumer,
`src/webchat/embed/transport/csat-api.ts`, sits in the separately-compiled webchat bundle
(`tsconfig.webchat.json`; `tsconfig.app.json` includes only `src`), so adopting pulls the generated
document into that bundle's type graph. A third fact is recorded nowhere: the document declares the
200 body as `CsatResponseDto` while `use-csat.ts:46` types it `customFetch<void>`. Whatever the
verdict, the false rationale is replaced with the true one.

**5. Test ordering follows `openspec/config.yaml` `rules.tasks`, and the two halves are ordered
differently.** The speech-analytics spec is **new capability**, so its tests batch into Phase C. The
two defects in `r4-t27-bridge.spec.ts` are **bug fixes**, so each gets its failing evidence captured
first, against the unfixed code, pasted verbatim into `tasks.md`. Both defects are invisible to
every existing gate — no `tsconfig` includes `tests/e2e`, and `npx eslint` on the file exits 0 — so
the failing evidence is produced by type-checking the file directly:

```
npx tsc --noEmit --ignoreConfig --skipLibCheck --target es2022 --module esnext \
  --moduleResolution bundler tests/e2e/tests/r4-t27-bridge.spec.ts
```

which reports, among others:

```
tests/e2e/tests/r4-t27-bridge.spec.ts(36,15): error TS2339: Property 'page' does not exist on type 'Page'.
tests/e2e/tests/r4-t27-bridge.spec.ts(36,21): error TS2339: Property 'token' does not exist on type 'Page'.
tests/e2e/tests/r4-t27-bridge.spec.ts(47,50): error TS2304: Cannot find name 'API_BASE'.
tests/e2e/tests/r4-t27-bridge.spec.ts(70,48): error TS2304: Cannot find name 'API_BASE'.
```

## Risks / Trade-offs

- **The reconciliations can stall the change.** Mitigated by sequencing: the unblocked adoptions and
  the whole E2E half proceed independently, and a BLOCKED shape is recorded as BLOCKED rather than
  held open — the change closes with its verdicts complete even if Platform's answer lands later, in
  which case the adoption itself is harvested forward rather than assumed.
- **Adopting `CsatResponseRequest` would widen the webchat bundle's type graph.** Weighed
  explicitly in decision 4 rather than settled by the swap.
- **The new E2E spec is not a required check.** Playwright is opt-in via the `e2e` PR label, so the
  spec is run deliberately during Phase C and the result recorded, not assumed from a green PR.
- **Adjudication without adoption looks like no progress.** Accepted: a declaration with a verified
  KEEP is materially different from one with an unchecked annotation, which is the failure this
  change is correcting.

## Open Questions

None blocking authorship. The three Platform reconciliations are _tasks_ of this change, not open
questions about it — each has a named owner repo, a named divergence, and a recorded outcome, and
none of them changes what this change builds.
