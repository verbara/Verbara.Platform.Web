# csat-operator-views Specification

## Purpose

Defines the operator-facing CSAT surfaces in Platform.Web: the supervisor/operations wallboard KPI
card (a scope-wide aggregated customer-satisfaction score with realtime push refresh) and the admin
CSAT survey-template review tab. It governs how these surfaces read the Platform analytics contract
(the `GET /api/v1/analytics/csat` scope-wide aggregate and the typed `OnCsatResponseRecorded`
SignalR push), and holds them to the Web conventions — `@base-ui/react` `render` prop, `data-*` E2E
selectors, locale-formatted numbers, and EN-US / ES-419 / PT-BR i18n parity.

## Requirements

### Requirement: Supervisor dashboard shows a CSAT KPI card

The supervisor/operations dashboard SHALL render a CSAT KPI card summarizing the aggregated
customer-satisfaction score across **the queues in the supervisor's scope** over the selected
period, sourced from the scope-wide aggregate read `GET /api/v1/analytics/csat`
(NOT the per-queue `GET /api/v1/analytics/csat/queues/{queueId}`, and NOT a single queue picked
from the wallboard list). The card MUST read the aggregate envelope's `averageRating` as the
displayed score and `totalResponses` as the response count, and MUST treat the reporting window as
`rangeStart` / `rangeEnd`; emptiness MUST be derived from `totalResponses` being `0`, never from a
zero `averageRating`. The score MUST reflect the full scope, so it MUST NOT be scoped to
`sortedQueues[0]` or any single queue. The card MUST use `@base-ui/react` primitives via the
`render` prop (never `asChild`), expose `data-*` selectors for E2E, and label all copy through
EN-US / ES-419 / PT-BR i18n keys (CI parity gate). Numeric values MUST render locale-formatted; E2E
MUST assert via `data-*`, never `toContainText` on the dynamic score.

The card SHALL update in realtime when a new CSAT response is recorded within the supervisor's
scope: the `OnCsatResponseRecorded` SignalR push (typed payload, camelCase over the wire —
`tenantId`, `responseId`, `surveyId`, `conversationId`, `channel`, `queueName`, `rating`,
`comment`, `capturedAt`) MUST cause the aggregate KPI query to refresh (invalidate or patch) so the
displayed score does not wait for the next poll interval. `comment` MAY be `null` (voice DTMF
captures carry no free text) and MUST NOT be required for the refresh to occur. The push is realtime
enrichment only — the card MUST remain correct on the aggregate poll alone if the realtime channel
is unavailable.

#### Scenario: Card renders the scope-wide aggregate CSAT score

- **GIVEN** the supervisor dashboard is open for a scope with recorded CSAT responses across
  multiple queues
- **WHEN** the CSAT KPI card loads and reads `GET /api/v1/analytics/csat`
- **THEN** it displays the envelope `averageRating` as the aggregated score and `totalResponses`
  as the response count for the `rangeStart`–`rangeEnd` period, aggregated across all queues in
  scope (not a single queue's figures)

#### Scenario: No responses yet

- **GIVEN** a scope whose aggregate `totalResponses` is `0` for the period
- **WHEN** the CSAT KPI card loads
- **THEN** it shows an empty/placeholder state rather than a misleading zero `averageRating`

#### Scenario: Realtime push refreshes the aggregate score

- **GIVEN** the CSAT KPI card is mounted and showing the current aggregate score
- **WHEN** an `OnCsatResponseRecorded` push arrives for the supervisor's tenant (payload carrying
  `tenantId`, `responseId`, `surveyId`, `conversationId`, `channel`, `queueName`, `rating`,
  `comment`, `capturedAt`)
- **THEN** the aggregate KPI query is refreshed so the displayed `averageRating` / `totalResponses`
  reflect the new response without waiting for the next poll, and a `null` `comment` does not
  suppress the refresh

### Requirement: Admin CSAT survey-template tab surfaces the CSAT template

The admin Surveys surface SHALL surface CSAT template management — the rating question and the
1–5 scale used by the capture panel — so operators can review the template driving `surveyId` /
`questionId`. It extends the existing `src/admin/surveys/survey-list-page.tsx` (which already
renders the `CSAT` survey type), not a new module. All controls
MUST use `@base-ui/react` (`render` prop), carry `data-*` selectors, and be fully translated
(EN-US / ES-419 / PT-BR).

#### Scenario: Admin views the CSAT template

- **GIVEN** a CSAT survey exists
- **WHEN** the admin opens it from the survey list
- **THEN** the CSAT rating question and 1–5 scale are shown alongside the existing survey fields
