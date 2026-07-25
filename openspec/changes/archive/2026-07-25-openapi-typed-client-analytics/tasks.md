## 1. Phase A — Migrate Analytics-module hook files (swap-the-T, per file)

Each task: replace the file's hand-written request/response interface(s) with the generated
`components['schemas']['<SchemaName>']` type (aliased locally), grep the repo for every usage of
each removed interface name and update imports, then delete the hand-written declaration. `tsc -b`
must stay green after each. Counts in parens = hand-written declarations in the file today (43
total).

- [ ] 1.1 `use-analytics.ts` (34) — migrate the remaining hand-written declarations; **preserve
      the two already-migrated CSAT coercions unchanged**: `useCsatQueueAnalytics` /
      `CsatResponseDto` (phase-1) and `useCsatAggregateAnalytics` / `CsatAggregateAnalyticsDto`
      (archived `2026-07-14-csat-completion`) — both normalize a `number | string` union via
      `select` and are the two genuine coercion sites tallied so far. `CsatAggregateAnalyticsDto`
      is still an interim hand-declared type pending its generated schema (Platform's
      `GET /api/v1/analytics/csat`); migrate it to the generated
      `components['schemas'][…]` once `openapi.d.ts` carries it, else leave the documented interim
      type in place
- [ ] 1.2 `use-csat.ts` (1) — CSAT capture endpoint (consumed by `src/webchat/embed/transport`)
- [ ] 1.3 `use-recording.ts` (1)
- [ ] 1.4 `use-surveys.ts` (7)

## 2. Phase B — Coercion sites (report to the Admin child's tally)

- [ ] 2.1 If any migrated Analytics hook exposes a NEW genuine `number | string` AOT-wire-union
      field a consumer must normalize to `number` (beyond the already-counted `CsatResponseDto` and
      `CsatAggregateAnalyticsDto` — the tally already stands at 2), record it and report it to the
      shared tally tracked in `openapi-typed-client-admin` (the ≥3-genuine-sites decision point
      lives there). Exclude `ai-credits-readout.tsx`'s `as number` casts (not this pattern — retro
      run 4).

## 3. Phase C — Validation (batch)

- [ ] 3.1 `npm run build` — type-check + bundle clean (`tsc -b` is the drift-catching CI gate)
- [ ] 3.2 `npx vitest run` — unit tests green, including the existing CSAT contract + coercion tests
- [ ] 3.3 `npx eslint .` — clean (no new errors; i18n:check remains green)
- [ ] 3.4 Confirm no hand-written interface remains for any migrated Analytics shape, and the CSAT
      slice's public type is unchanged
- [ ] 3.5 No `npx playwright test` task required unless a migration alters a user-facing flow —
      swap-the-T is compile-time-only
