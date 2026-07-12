## Context

Child change of the cross-repo `csat-runner` train (host: Verbara.Platform, `decision_ref:
Platform/ADR-0020`). Web is the **decoupled UI surface** and the **HTTP consumer** that sends the
CSAT capture payload and reads results back. The contract is fixed upstream by
`Verbara.Platform/openspec/changes/csat-runner/impact.yaml` and the golden fixture
`fixtures/csat-response-capture.v1.json`; this repo consumes it (API-first).

Current state: `src/admin/surveys/survey-list-page.tsx` already renders the `CSAT` survey type;
the webchat embed shipped v3.0.0-web with the CSAT rating prompt explicitly deferred
(`docs/specs/2026-05-09-track-7c.md:184`). No Web CSAT spec has been authored — this design and
its specs are a **skeleton derived from the cross-repo contract**, to be superseded by a full
Web spec.

## Goals / Non-Goals

**Goals:**

- Land the webchat embed 1–5 star rating panel that POSTs the golden capture payload to
  `/api/v1/csat/responses/webchat`, cited verbatim against the fixture.
- Add a supervisor CSAT KPI card and surface the admin CSAT template tab.
- Keep i18n parity (EN-US / ES-419 / PT-BR) and `data-*` E2E selectors throughout.

**Non-Goals:**

- Designing the Platform CSAT endpoints/DTOs or the Pro engine (host + producer children own those).
- Voice/email/SMS capture surfaces (webchat only for this child).
- A full Web CSAT spec — deferred; this is a contract-derived skeleton.
- Minting or validating `responseToken` client-side (the token is server-issued; the panel echoes it).

## Decisions

- **Wire DTO pinned to the golden fixture.** A single typed request model mirrors
  `csat-response-capture.v1.json` field-for-field (`responseToken`, `surveyId`, `questionId`,
  `channel`, `queueName`, `rating`, `comment`, `capturedAt`, `conversationId`). Alternative — an
  ad-hoc object literal at the call site — was rejected: it invites silent key drift on a shared
  HTTP boundary, which the verbatim-fixture-citation rule exists to prevent.
- **Session-context sourcing.** `responseToken`, `surveyId`, `questionId`, `channel`,
  `queueName`, `conversationId` come from the embed session context, not re-derived in the panel,
  so the panel only owns `rating`, `comment`, and `capturedAt`.
- **@base-ui/react star control via `render` prop** (never `asChild`), consistent with the repo
  UI constraint. A bespoke button-group was considered but base-ui gives us focus/keyboard
  semantics for free.
- **TanStack Query mutation** for the capture POST (embed surface uses the same server-state
  layer); the KPI card uses a query hook against the Platform CSAT analytics endpoint.

## Risks / Trade-offs

- **Payload drift from the fixture breaks capture silently** → pin the DTO to the fixture keys
  (spec `csat-capture`) and add a contract test asserting serialized body keys equal the fixture keys.
- **API-first dependency**: capture and KPI card both depend on Platform endpoints not yet
  shipped in this repo's world → Web is buildOrder 2, decoupled; gate the KPI card on endpoint
  availability and degrade to an empty state.
- **Skeleton risk**: specs are contract-derived, not from a full Web spec → tracked explicitly;
  a follow-up Web spec supersedes this.

## Migration Plan

Additive only — new UI plus one new outbound API call; no existing behavior changes. Re-pin
3.2.0-web → 3.13.0-web (baseline 3.12.0-web). Rollback = revert the branch; the embed panel is
feature-additive and the admin/supervisor surfaces degrade to their pre-change state.

## Open Questions

- Exact route/DTO for the supervisor CSAT analytics read endpoint (defined by the Platform host child).
- Whether the admin CSAT template tab needs edit affordances in this child or read-only for the skeleton.
- Final ADR reference if any durable Web-side decision emerges (would be authored under
  `Verbara.Platform/docs/decisions/` per the shared-workstream rule).
