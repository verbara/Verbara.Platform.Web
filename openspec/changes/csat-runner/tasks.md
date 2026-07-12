## 1. Phase A — Foundation (batch)

- [x] 1.1 Add the typed CSAT capture request DTO mirroring the golden fixture field-for-field: `responseToken`, `surveyId`, `questionId`, `channel`, `queueName`, `rating`, `comment`, `capturedAt`, `conversationId` (single source of truth, no ad-hoc literals)
- [x] 1.2 Add the TanStack Query mutation hook posting the DTO to `/api/v1/csat/responses/webchat`
- [x] 1.3 Add i18n keys for all three surfaces (rating panel, KPI card, admin CSAT tab) across EN-US / ES-419 / PT-BR; keep parity green
- [x] 1.4 Re-pin `package.json` 3.2.0-web → 3.13.0-web (baseline 3.12.0-web)

## 2. Phase B — Critical components (focused)

- [x] 2.1 Build the webchat embed rating panel: 1–5 star control via `@base-ui/react` `render` prop (never `asChild`), optional comment, dismissible; wire `data-*` selectors
- [x] 2.2 Source `responseToken` / `surveyId` / `questionId` / `channel` / `queueName` / `conversationId` from the embed session context; panel owns only `rating`, `comment`, `capturedAt`
- [x] 2.3 Build the supervisor CSAT KPI card (Operations dashboard) with empty/placeholder state when no responses; `@base-ui/react` + `data-*`, locale-formatted numbers
- [x] 2.4 Extend `src/admin/surveys/survey-list-page.tsx` to surface the CSAT template tab (rating question + 1–5 scale)

## 3. Phase C — Integration & verification (batch)

- [x] 3.1 Add a contract/unit test asserting the serialized capture body keys equal the golden fixture keys (verbatim-fixture-citation guard) — `src/webchat/embed/transport/csat-api.test.ts` reads the sibling golden fixture and asserts the serialized POST body has exactly those 9 keys
- [x] 3.2 `npx vitest run` — unit tests green (182 files / 1442 tests, incl. 3.1 contract test + `csat-panel.test.tsx`)
- [x] 3.3 `npx playwright test` — E2E for the rating-panel submit flow using `data-*`/`data-testid` selectors, `waitForResponse` on the capture POST (no `waitForTimeout`/wall-clock waits; workers:1, retries:1). Spec at `tests/e2e/tests/webchat/csat-panel.spec.ts`. NOTE: could not execute against the sandbox's default server (stale nginx static mirror returns 500 for the embed entry; no backend on :5000). The spec's mechanism was PROVEN green by building the embed (`npm run build:webchat-embed`) and serving it on a throwaway port — 1 passed. Runs in the opt-in CI Playwright job against a provisioned stack.
- [x] 3.4 `npm run build` (type-check + bundle) clean and i18n parity green (`✓ built`; i18n parity OK across 3 locales × 6 namespaces)
