## Context

Web is the **decoupled UI surface** and **HTTP consumer** (`buildOrder: 2`) of the `csat-completion`
cross-repo change (host: Verbara.Platform, `decision_ref: Platform/ADR-0020`). The wire contract is
fixed upstream by `Verbara.Platform/openspec/changes/csat-completion/impact.yaml` and its golden
fixtures; this repo consumes two of the three (API-first — the API contract leads):

- `fixtures/csat-aggregate-analytics.v1.json` — the NEW `GET /api/v1/analytics/csat` scope-wide
  aggregate read. Envelope: `totalResponses`, `averageRating`, `rangeStart`, `rangeEnd`, `queues[]`;
  each `queues[]` row: `queueName`, `channel`, `totalResponses`, `averageRating`, `rangeStart`,
  `rangeEnd` (rows reuse the existing per-queue projection verbatim; `channel` echoes the requested
  filter and is `all` when unfiltered).
- `fixtures/csat-response-recorded-payload.v1.json` — the typed `OnCsatResponseRecorded` SignalR
  push to `supervisor:{tenantId}`. Payload: `tenantId`, `responseId`, `surveyId`, `conversationId`,
  `channel`, `queueName`, `rating`, `comment` (nullable), `capturedAt`.

The third fixture, `csat-voice-capture.v1.json`, is backend-only (voice IVR capture) and is NOT
consumed by Web.

Current state (what `csat-runner` shipped as a skeleton):

- `src/operations/wallboard/wallboard-page.tsx:45` renders
  `<CsatKpiCard queueId={sortedQueues[0]?.queueId} />` — the card is hard-wired to the first sorted
  queue, contradicting the `csat-operator-views` living-spec promise ("for the queues in the
  supervisor's scope").
- `src/operations/wallboard/csat-kpi-card.tsx` reads `useCsatQueueAnalytics(queueId)` against
  `GET /api/v1/analytics/csat/queues/{queueId}`; emptiness is derived from `totalResponses > 0`.
- `src/core/api/hooks/use-analytics.ts:508-558` — `useCsatQueueAnalytics` + `CsatQueueSummary`,
  which normalize the AOT-safe `number | string` union to `number` in TanStack Query `select`.
- `src/core/realtime/platform-hub.ts` — registers only `OnPresenceUpdated` / `OnSupervisionStarted`
  / `OnWhisperReceived`; no CSAT realtime consumption exists (the card is pure polling). The file
  already exposes `onHubEvent<T>(method, handler)` and the `conn.on(...)` registration idiom used by
  the three existing handlers.

## Goals / Non-Goals

**Goals:**

- Replace the single-queue KPI read with the scope-wide aggregate endpoint so the wallboard score
  reflects the supervisor's whole scope (fulfilling `csat-operator-views`, resolving Platform/ADR-0020's
  KPI question in favor of aggregation).
- Add the typed `OnCsatResponseRecorded` SignalR handler and wire it to refresh the aggregate KPI
  query, so the score updates on push rather than only on the poll interval.
- Consume both wire shapes through generated OpenAPI types, mirroring the `useCsatQueueAnalytics`
  `number | string` AOT-union normalization precedent.
- Keep i18n parity (EN-US / ES-419 / PT-BR) and `data-*` E2E selectors; `@base-ui/react` `render`
  prop throughout (never `asChild`); `npm run build` clean.

**Non-Goals:**

- The Platform aggregate endpoint / DTO or the Pro typed hub method + voice adapter — those are the
  host and producer children (`Verbara.Platform` / `Verbara.Sdk.Pro`).
- Voice IVR capture (`csat-voice-capture.v1.json`) — backend-only, not a Web surface.
- Any change to the frozen fixtures or `impact.yaml` (this child cites them verbatim).
- A shared `number | string` coercion helper — deferred to `openapi-typed-client-phase2`'s tracked
  open question; this hook follows the established per-hook `select` normalization as the second
  data point.

## Decisions

### D1 — Aggregate KPI card reads the envelope roll-up, drops the queue prop

`CsatKpiCard` stops taking `queueId` and reads a new `useCsatAggregateAnalytics()` hook against
`GET /api/v1/analytics/csat`. It renders the envelope `averageRating` as the score and
`totalResponses` as the count over the `rangeStart`–`rangeEnd` window; emptiness stays derived from
`totalResponses === 0` (never a zero `averageRating`), exactly as today. `wallboard-page.tsx:45`
drops the `queueId={sortedQueues[0]?.queueId}` prop. The card does not iterate `queues[]` for the
headline number — the envelope already carries the scope roll-up; `queues[]` rows (`queueName`,
`channel`, `totalResponses`, `averageRating`, `rangeStart`, `rangeEnd`) are available for a future
per-queue breakdown but are out of scope for this card's single-score surface. **Alternative
rejected:** summing `sortedQueues[]` client-side or re-fanning N per-queue reads — that pushes the
roll-up into the client, the exact anti-pattern the product owner rejected in favor of the server
aggregate (Platform host design D6).

### D2 — `useCsatAggregateAnalytics` hook mirrors the AOT-union normalization precedent

The new hook mirrors `useCsatQueueAnalytics` (`use-analytics.ts:543-558`): a `useQuery` keyed
`['analytics', 'csat', 'aggregate', …]` fetching the aggregate DTO, with a `select` that normalizes
the AOT-safe `number | string` fields (`totalResponses`, `averageRating`, and the same on each
`queues[]` row) to `number` so consumers do plain numeric formatting. Its wire type is the generated
`components['schemas'][…]` for the aggregate envelope (NOT hand-declared), following the
`openapi-typed-client` precedent. **This hook is the second concrete call site** of the
`number | string` union normalization that `openapi-typed-client-phase2` tracks as an open design
question (whether to introduce a shared coercion helper once 2-3 sites exist); it is cited for
consistency and adds the data point, but does NOT itself introduce the helper — that decision stays
with phase2. **Alternative rejected:** hand-declaring the aggregate type or skipping the union
normalization — both diverge from the generated-types precedent and would silently yield `undefined`
or `string`-typed arithmetic.

### D3 — Typed `OnCsatResponseRecorded` handler wired to invalidate the aggregate query

Register `OnCsatResponseRecorded` in `platform-hub.ts`'s `registerHandlers`, following the existing
`conn.on('OnSupervisionStarted', …)` / `conn.on('OnWhisperReceived', …)` idiom, with a local
`CsatResponseRecordedPayload` interface typed 1:1 to the fixture (`tenantId`, `responseId`,
`surveyId`, `conversationId`, `channel`, `queueName`, `rating`, `comment` — nullable — `capturedAt`).
The handler invalidates the aggregate KPI query key (`queryClient.invalidateQueries` on
`['analytics', 'csat', 'aggregate']`) so the next fetch re-reads the server-computed roll-up; a
`null` `comment` (voice DTMF) does not gate the refresh. Invalidation (re-fetch the authoritative
aggregate) is preferred over client-side patching of the average because recomputing a scope average
from a single row on the client would drift from the server's windowed computation. The handler is
pure enrichment: if the SignalR channel is down, the card's TanStack-Query poll still keeps the score
correct within one interval. **Alternative rejected:** patching `averageRating` in the query cache
from the pushed `rating` — the client cannot correctly re-derive a scope-wide windowed average from
one response, so it would show a wrong number until the next poll.

### D4 — i18n keys extend the existing `operations.csat.*` namespace

The card already labels through `operations.csat.*` (title/score/responses/empty/period). Any
scope-wording additions (e.g. an "all queues in scope" qualifier) extend that namespace and MUST land
in all three locales (EN-US / ES-419 / PT-BR) in the same change to keep the CI parity gate green.
Numeric values stay locale-formatted via the existing `useFormatNumber`. **Alternative rejected:**
reusing the per-queue label copy unchanged — the score is no longer per-queue, so the copy must not
imply a single queue.

## Risks / Trade-offs

- **Generated aggregate type absent until Platform ships (API-first)** → the card cannot type against
  `openapi.d.ts` before the host endpoint lands. Mitigation: Web is `buildOrder: 2` decoupled; the
  interim posture is governed by `openapi-typed-client-phase2`; the card degrades to the empty state
  when no data is returned, so it never renders a wrong number pre-availability.
- **Realtime handler could over-invalidate on a busy tenant** → a high CSAT volume fans many
  `OnCsatResponseRecorded` pushes. Mitigation: TanStack Query coalesces concurrent invalidations of
  the same key and de-dupes in-flight fetches; the aggregate read is a single bounded server query.
- **Wire drift breaks consumption silently** → renaming any consumed field (`totalResponses`,
  `averageRating`, `rangeStart`, `rangeEnd`, or the push payload fields) yields `undefined` at
  runtime. Mitigation: cite the frozen fixtures verbatim and add a contract test asserting the
  consumed keys equal the fixtures' keys (the `csat-runner` guard precedent).
- **Dropping the `queueId` prop is a public-ish component signature change** → any other caller of
  `CsatKpiCard` would break. Mitigation: the only caller is `wallboard-page.tsx:45`; the type-check
  (`npm run build`) catches any stray caller at compile time.

## Migration Plan

1. Host child (`Verbara.Platform`, `buildOrder: 2`) ships `GET /api/v1/analytics/csat`; Pro child
   (`buildOrder: 1`) ships the typed `IPlatformHubClient.OnCsatResponseRecorded`. Both are cross-repo
   prerequisites (decoupled — Web does not block their build).
2. Regenerate `openapi.d.ts` once Platform's endpoint is in the served contract; add
   `useCsatAggregateAnalytics` against the generated aggregate schema.
3. Migrate `CsatKpiCard` to the aggregate hook + drop the `queueId` prop from `wallboard-page.tsx:45`.
4. Register the `OnCsatResponseRecorded` handler in `platform-hub.ts` and wire the aggregate-query
   invalidation.
5. Add/extend the `operations.csat.*` i18n keys in all three locales; keep parity green.
6. **Rollback:** all additive/substitutive on the Web side — revert the branch to restore the
   single-queue card and drop the realtime handler; no persisted state, no schema, no data migration.

## Open Questions

- None blocking. The KPI-scope question (Platform/ADR-0020) is resolved to aggregation by the
  product-owner decision (2026-07-13), recorded in the proposal and D1. Whether a shared
  `number | string` coercion helper replaces per-hook normalization is deliberately left to
  `openapi-typed-client-phase2`'s tracked open question (this hook is the second data point, not the
  decision point). No durable Web-only architectural decision emerges here that would warrant a new
  ADR under `Verbara.Platform/docs/decisions/` (the shared-workstream home).
