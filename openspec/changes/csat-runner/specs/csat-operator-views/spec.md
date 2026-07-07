## ADDED Requirements

### Requirement: Supervisor dashboard shows a CSAT KPI card

The supervisor/operations dashboard SHALL render a CSAT KPI card summarizing the aggregated
customer-satisfaction score for the queues in the supervisor's scope over the selected period.
The card MUST use `@base-ui/react` primitives via the `render` prop (never `asChild`), expose
`data-*` selectors for E2E, and label all copy through EN-US / ES-419 / PT-BR i18n keys (CI
parity gate). Numeric values MUST render locale-formatted; E2E MUST assert via `data-*`, never
`toContainText` on the dynamic score.

#### Scenario: Card renders the queue CSAT score

- **GIVEN** the supervisor dashboard is open for a scope with recorded CSAT responses
- **WHEN** the CSAT KPI card loads
- **THEN** it displays the aggregated CSAT score and the response count for the selected period

#### Scenario: No responses yet

- **GIVEN** a scope with zero recorded CSAT responses in the period
- **WHEN** the CSAT KPI card loads
- **THEN** it shows an empty/placeholder state rather than a misleading zero score

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

## Architectural Risk

**Level**: LOW

**Affected**: the Operations dashboard and the admin Surveys page in Platform.Web; the read-side
Platform CSAT analytics endpoints.

**API-contract dependency (API-first)**: the KPI card depends on a Platform read endpoint
exposing aggregated CSAT results (Surveys/`ISurveyAnalytics` extension, per
`Verbara.Platform/openspec/changes/csat-runner`); the exact route/DTO is defined by the host
change and consumed here. The admin tab reads the existing survey/questions shape.

**Mitigation**: gate the card behind the analytics endpoint's availability, degrade to the
empty state when no data is returned, and keep the admin tab additive over the existing
`survey-list-page.tsx` so no current behavior regresses.
