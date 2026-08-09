# csat-capture Specification

## Purpose

Defines the customer-facing half of CSAT: the dismissible post-conversation panel the webchat embed
shows a visitor, capturing a 1–5 star score plus an optional comment and submitting it to Platform —
never blocking a visitor who would rather just close the chat. It was the surface deferred from
webchat `v3.0.0-web`, unblocked once Platform shipped the capture endpoint. Its companion capability
`csat-operator-views` governs where that score surfaces for operators.

The second requirement — the capture payload matching a **committed golden fixture verbatim** — is
deliberate rather than ceremonial. This surface is written by the customer's browser, outside any
authenticated typed client, so a silent wire-shape drift produces ratings that are accepted and then
never counted. That failure class is exactly what the `v3.13.1-web` csat-runner incident cost, and
the fixture is the fence against its recurrence.

## Requirements

### Requirement: Webchat embed rating panel captures a 1–5 star rating

The webchat embed SHALL render a post-conversation rating panel offering a 1–5 star scale
and an optional free-text comment, and SHALL NOT block the visitor from closing the chat
without rating (the panel is dismissible). The panel is the surface deferred from webchat
v3.0.0-web (`docs/specs/2026-05-09-track-7c.md:184`) and is unblocked by the Platform CSAT
capture endpoint.

Star controls MUST be built with `@base-ui/react` primitives using the `render` prop (never
`asChild`), MUST expose `data-*` selectors for E2E (locale-proof), and all copy MUST have
EN-US / ES-419 / PT-BR i18n keys (CI parity gate).

#### Scenario: Visitor rates the conversation

- **GIVEN** a webchat conversation has ended in the embed iframe
- **WHEN** the visitor selects 5 stars and submits
- **THEN** the panel POSTs the capture payload to `/api/v1/csat/responses/webchat` and shows a thank-you acknowledgement

#### Scenario: Visitor dismisses without rating

- **GIVEN** the rating panel is shown after a conversation
- **WHEN** the visitor closes the chat without selecting a star
- **THEN** no capture request is sent and the panel is not shown again for that conversation

### Requirement: Capture payload matches the golden wire fixture verbatim

The rating panel SHALL POST to `/api/v1/csat/responses/webchat` a JSON body whose fields match
the golden wire fixture `Verbara.Platform/openspec/changes/csat-runner/fixtures/csat-response-capture.v1.json`
exactly. Web is on the SAME HTTP boundary as the fixture; the body MUST use these field names,
cited verbatim (verbatim-fixture-citation rule, `/xr:propagate`):

- `responseToken` — the opaque signed capture token (HMAC, 7-day TTL) issued for this conversation; the panel MUST echo it and MUST NOT mint or mutate it.
- `surveyId` — the CSAT survey identifier (fixture: `srv-csat-v1`).
- `questionId` — the rating question identifier (fixture: `csat-rating-v1`).
- `channel` — the capture channel, `webchat` for this surface.
- `queueName` — the routing queue the conversation was handled on (fixture: `support-tier1`).
- `rating` — the integer star value 1–5 the visitor selected (fixture: `5`).
- `comment` — the optional free-text comment; omitted or `null` when the visitor leaves it blank.
- `capturedAt` — the ISO-8601 UTC timestamp when the visitor submitted the rating.
- `conversationId` — the webchat conversation the rating belongs to (fixture: `conv-8f2a1c4e`).

The DTO SHALL be a typed request model (no ad-hoc object literals leaking extra keys), and the
`responseToken`, `surveyId`, `questionId`, `channel`, `queueName`, and `conversationId` values
SHALL be sourced from the embed session context, not re-derived client-side.

#### Scenario: Payload carries every fixture field

- **GIVEN** a visitor submits a rating of 4 with the comment "Helpful"
- **WHEN** the panel builds the request body
- **THEN** the body contains `responseToken`, `surveyId`, `questionId`, `channel`, `queueName`, `rating`, `comment`, `capturedAt`, and `conversationId` with `channel` equal to `webchat` and `rating` equal to `4`

#### Scenario: Blank comment sends no comment value

- **GIVEN** a visitor submits a rating of 3 without typing a comment
- **WHEN** the panel builds the request body
- **THEN** `comment` is omitted or `null` while every other fixture field is present
