---
tier: MEDIANO
owner: hreina
approver: hreina
stakeholder: Platform product
decision_ref: Platform/ADR-0020
---

## Why

The CSAT Runner train (cross-repo `csat-runner`, host: Verbara.Platform) ships an
end-to-end customer-satisfaction capture pipeline: Pro produces the engine, Platform
exposes `POST /api/v1/csat/responses/*` and records `CsatResponseRecordedEvent`, and the
Web UI is the visitor-facing surface that **sends** the capture payload and the operator
surfaces that read the results back. The post-conversation 1–5 star rating panel was
explicitly deferred from webchat v3.0.0-web (`docs/specs/2026-05-09-track-7c.md:184`,
"CSAT rating prompt … Defer"); this change lands it now that the API contract exists.

This is a **skeleton child change derived from the cross-repo contract**
(`Verbara.Platform/openspec/changes/csat-runner/impact.yaml` + golden fixture
`fixtures/csat-response-capture.v1.json`), pending a full Web spec. Web is the decoupled
UI surface and HTTP consumer on the same wire boundary as the fixture.

## What Changes

- **Webchat embed rating panel** (NET-NEW): a post-conversation 1–5 star panel rendered in
  the embed iframe that `POST`s the capture payload to `/api/v1/csat/responses/webchat`
  using the golden wire shape. Deferred from v3.0.0-web; now unblocked by the Platform API.
- **Supervisor CSAT KPI card** (NET-NEW): a card on the supervisor/operations dashboard
  reading the aggregated CSAT score for the operator's queues.
- **Admin CSAT template tab** (EXTEND): `src/admin/surveys/survey-list-page.tsx` already
  renders the `CSAT` survey type; this surfaces the CSAT template management affordances
  (question, rating scale) alongside the existing survey list.
- i18n keys added for all three surfaces across EN-US / ES-419 / PT-BR (CI parity gate).
- No breaking changes; additive UI + one new outbound API call.

## Capabilities

### New Capabilities

- `csat-capture`: the visitor-facing webchat embed rating panel that captures a 1–5 star
  rating (+ optional comment) after a conversation and sends it to the Platform CSAT
  capture endpoint on the shared HTTP boundary. Cites the golden wire fixture verbatim.
- `csat-operator-views`: the operator-facing read surfaces — supervisor dashboard CSAT KPI
  card and the admin CSAT survey-template tab.

### Modified Capabilities

<!-- None. This repo's openspec/specs/ is intentionally near-empty (hub rule, verbara-meta/ADR-0005);
     Web-behavior living specs are hosted in Verbara.Platform. No existing Web living spec changes. -->

## Impact

- **New UI**: webchat embed rating panel (embed bundle), supervisor CSAT KPI card
  (Operations module), admin CSAT template tab (extends `src/admin/surveys/`).
- **New outbound API call**: `POST /api/v1/csat/responses/webchat` (Platform, consumer role).
  Wire shape is the golden fixture — same HTTP boundary, cited verbatim in the delta specs.
- **i18n**: new keys in EN-US, ES-419, PT-BR (CI parity enforced).
- **Version re-pin**: 3.2.0-web → 3.13.0-web (baseline 3.12.0-web; the frozen plan target
  3.2.0-web was superseded — next-minor across the train, operator decision 2026-07-07).
- **Depends on**: Platform `POST /api/v1/csat/responses/*` (buildOrder 2, consumer) —
  API-first, decoupled repo.
- **Pending**: a full Web CSAT spec; this child is a contract-derived skeleton.
