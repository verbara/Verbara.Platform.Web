## 1. Phase A — Foundation (batch)

- [x] 1.1 Add the typed CSAT capture request DTO mirroring the golden fixture field-for-field: `responseToken`, `surveyId`, `questionId`, `channel`, `queueName`, `rating`, `comment`, `capturedAt`, `conversationId` (single source of truth, no ad-hoc literals)
- [x] 1.2 Add the TanStack Query mutation hook posting the DTO to `/api/v1/csat/responses/webchat`
- [x] 1.3 Add i18n keys for all three surfaces (rating panel, KPI card, admin CSAT tab) across EN-US / ES-419 / PT-BR; keep parity green
- [x] 1.4 Re-pin `package.json` 3.2.0-web → 3.13.0-web (baseline 3.12.0-web)

## 2. Phase B — Critical components (focused)

- [ ] 2.1 Build the webchat embed rating panel: 1–5 star control via `@base-ui/react` `render` prop (never `asChild`), optional comment, dismissible; wire `data-*` selectors
- [ ] 2.2 Source `responseToken` / `surveyId` / `questionId` / `channel` / `queueName` / `conversationId` from the embed session context; panel owns only `rating`, `comment`, `capturedAt`
- [ ] 2.3 Build the supervisor CSAT KPI card (Operations dashboard) with empty/placeholder state when no responses; `@base-ui/react` + `data-*`, locale-formatted numbers
- [ ] 2.4 Extend `src/admin/surveys/survey-list-page.tsx` to surface the CSAT template tab (rating question + 1–5 scale)

## 3. Phase C — Integration & verification (batch)

- [ ] 3.1 Add a contract/unit test asserting the serialized capture body keys equal the golden fixture keys (verbatim-fixture-citation guard)
- [ ] 3.2 `npx vitest run` — unit tests green
- [ ] 3.3 `npx playwright test` — E2E for the rating-panel submit flow using `data-*`/`data-testid` selectors, `waitForResponse` on the capture POST (no `waitForTimeout`/wall-clock waits; workers:1, retries:1)
- [ ] 3.4 `npm run build` (type-check + bundle) clean and i18n parity green
