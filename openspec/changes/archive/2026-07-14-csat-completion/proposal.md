---
tier: MEDIANO
owner: hreina
approver: hreina
stakeholder: Contact-center supervisors watching the Operations wallboard
decision_ref: Platform/ADR-0020
---

## Why

The supervisor CSAT KPI card shipped in `csat-runner` as a **skeleton derived from the cross-repo
contract** and is hard-wired to a single queue — `wallboard-page.tsx:45` renders
`<CsatKpiCard queueId={sortedQueues[0]?.queueId} />`, reading only the first sorted queue's
per-queue endpoint. That silently contradicts the living-spec promise (`csat-operator-views`:
"for the queues in the supervisor's scope") and leaves the wallboard score misrepresenting a
multi-queue scope. The product owner resolved Platform/ADR-0020's ⟨NEEDS PRODUCT-OWNER INPUT⟩
wallboard-card question in favor of a scope-wide aggregate (2026-07-13); that decision is API-first,
so Platform cascades a NEW aggregate read endpoint the wallboard can consume, plus a typed
supervisor push so the card updates in realtime instead of only on poll.

## What Changes

This is the **Web consumer child** (`web/csat-completion`, `buildOrder: 2`, decoupled HTTP consumer)
of the `csat-completion` cross-repo change (contract: `Verbara.Platform/openspec/changes/csat-completion/impact.yaml`;
Pro producer + Platform host children are fanned out by `/xr:propagate`). Web is on the same wire
boundary as two of the three golden fixtures — it consumes them, it does not define them. All changes
are additive; the digital CSAT slice and every pre-existing survey consumer are unaffected.

- **Aggregate KPI card** (MODIFY) — replace the hard-wired single-queue read in
  `src/operations/wallboard/wallboard-page.tsx:45` + `src/operations/wallboard/csat-kpi-card.tsx`
  with consumption of the NEW `GET /api/v1/analytics/csat` scope-wide aggregate endpoint
  (`fixtures/csat-aggregate-analytics.v1.json`). The card renders the envelope roll-up
  (`totalResponses`, `averageRating`, `rangeStart`, `rangeEnd`) instead of `sortedQueues[0]`'s
  score, **fulfilling** the existing `csat-operator-views` promise ("for the queues in the
  supervisor's scope") rather than adding a parallel surface.
- **Realtime CSAT push** (NET-NEW) — register the `OnCsatResponseRecorded` SignalR handler on
  `src/core/realtime/platform-hub.ts` (today only `OnPresenceUpdated` / `OnSupervisionStarted` /
  `OnWhisperReceived` are registered; the CSAT card is pure TanStack-Query polling). The typed
  payload (`fixtures/csat-response-recorded-payload.v1.json`) invalidates/patches the aggregate KPI
  query so the wallboard score updates on push, not only on the poll interval.
- **Generated aggregate wire type** (EXTEND the api-hooks layer) — consume the aggregate endpoint via
  generated OpenAPI types (precedent: `src/core/api/hooks/use-analytics.ts:508-558`
  `useCsatQueueAnalytics`, including its `number | string` AOT-union normalization in `select`). The
  new `useCsatAggregateAnalytics` hook is the **second concrete call site** of that AOT-union
  normalization pattern, which `openapi-typed-client-phase2` tracks as an open design question — cited
  for consistency (its scope is governance, not this endpoint).
- i18n keys added for the aggregate-scope labels across EN-US / ES-419 / PT-BR (CI parity gate).
- No breaking changes; additive realtime consumption + one migrated outbound read.

## Capabilities

### New Capabilities

<!-- None. The realtime push handler and the aggregate read both land inside the existing
     csat-operator-views capability (the KPI card is already that spec's subject); no new
     frontend-independent capability is introduced. -->

### Modified Capabilities

- `csat-operator-views`: MODIFY the "Supervisor dashboard shows a CSAT KPI card" requirement — the
  card now reads the scope-wide aggregate endpoint (`totalResponses`, `averageRating`, `rangeStart`,
  `rangeEnd` from the `csat-aggregate-analytics` envelope) instead of a single queue, and gains a
  realtime-update scenario driven by the typed `OnCsatResponseRecorded` push
  (`tenantId`, `responseId`, `surveyId`, `conversationId`, `channel`, `queueName`, `rating`,
  `comment`, `capturedAt`). The admin CSAT survey-template requirement is unchanged.

## Impact

- **UI**: `src/operations/wallboard/csat-kpi-card.tsx` (aggregate envelope, drops the `queueId` prop),
  `src/operations/wallboard/wallboard-page.tsx:45` (no longer passes `sortedQueues[0]?.queueId`).
- **API layer**: `src/core/api/hooks/use-analytics.ts` — new `useCsatAggregateAnalytics` hook against
  `GET /api/v1/analytics/csat`, mirroring the `useCsatQueueAnalytics` `number | string` normalization.
- **Realtime**: `src/core/realtime/platform-hub.ts` — new `OnCsatResponseRecorded` typed handler that
  invalidates the aggregate KPI query key; store/typing additions as needed.
- **Types**: consumes the generated `openapi.d.ts` aggregate schema, which lands **only after Platform
  ships** the endpoint (API-first). Interim before the generated type exists is governed by
  `openapi-typed-client-phase2`; the card degrades to its empty state until data is available.
- **i18n**: new keys in EN-US, ES-419, PT-BR (CI parity enforced).
- **Depends on** (cross-repo, decoupled): Platform `GET /api/v1/analytics/csat` (host child,
  `buildOrder: 2`) and Pro's typed `IPlatformHubClient.OnCsatResponseRecorded` (`buildOrder: 1`) —
  both API-first; Web observes the wire, defining neither.
