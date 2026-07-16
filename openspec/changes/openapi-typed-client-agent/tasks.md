## 1. Phase A — Migrate Agent-module hook files (swap-the-T, per file)

Each task: replace the file's hand-written request/response interface(s) with the generated
`components['schemas']['<SchemaName>']` type (aliased locally), grep the repo for every usage of
each removed interface name and update imports, then delete the hand-written declaration. `tsc -b`
must stay green after each. Counts in parens = hand-written declarations in the file today (22
total).

- [ ] 1.1 `use-contacts.ts` (3)
- [ ] 1.2 `use-conversations.ts` (5)
- [ ] 1.3 `use-media.ts` (1)
- [ ] 1.4 `use-me.ts` (2)
- [ ] 1.5 `use-mfa-enroll.ts` (3)
- [ ] 1.6 `use-notifications.ts` (5)
- [ ] 1.7 `use-recovery-codes.ts` (2)
- [ ] 1.8 `use-user-sessions.ts` (1)

## 2. Phase B — Coercion sites (report to the Admin child's tally)

- [ ] 2.1 If any migrated Agent hook exposes a genuine `number | string` AOT-wire-union field a
      consumer must normalize to `number`, record it and report it to the shared tally tracked in
      `openapi-typed-client-admin` (the ≥3-genuine-sites decision point lives there). Exclude
      `ai-credits-readout.tsx`'s `as number` casts (not this pattern — retro run 4).

## 3. Phase C — Validation (batch)

- [ ] 3.1 `npm run build` — type-check + bundle clean (`tsc -b` is the drift-catching CI gate)
- [ ] 3.2 `npx vitest run` — unit tests green
- [ ] 3.3 `npx eslint .` — clean (no new errors; i18n:check remains green)
- [ ] 3.4 Confirm no hand-written interface remains for any migrated Agent shape
- [ ] 3.5 No `npx playwright test` task required unless a migration alters a user-facing flow —
      swap-the-T is compile-time-only
