## 1. Phase A — Migrate Admin-module hook files (swap-the-T, per file)

Each task: replace the file's hand-written request/response interface(s) with the generated
`components['schemas']['<SchemaName>']` type (aliased locally), grep the repo for every usage of
each removed interface name and update imports, then delete the hand-written declaration. `tsc -b`
must stay green after each. Counts in parens = hand-written declarations in the file today (199
total).

- [ ] 1.1 `use-agent-assist-feature.ts` (4)
- [ ] 1.2 `use-agent-assist.ts` (3)
- [ ] 1.3 `use-agent-memberships.ts` (1)
- [ ] 1.4 `use-agents.ts` (6)
- [ ] 1.5 `use-api-keys.ts` (3)
- [ ] 1.6 `use-audit-events.ts` (2)
- [ ] 1.7 `use-audit.ts` (3)
- [ ] 1.8 `use-auth-admin.ts` (9)
- [ ] 1.9 `use-billing.ts` (14)
- [ ] 1.10 `use-bots.ts` (1)
- [ ] 1.11 `use-caller-id-pools.ts` (2)
- [ ] 1.12 `use-campaigns.ts` (8)
- [ ] 1.13 `use-canned-responses.ts` (3)
- [ ] 1.14 `use-cases.ts` (7)
- [ ] 1.15 `use-channels.ts` (1)
- [ ] 1.16 `use-dialer-settings.ts` (1)
- [ ] 1.17 `use-did-routes.ts` (3)
- [ ] 1.18 `use-dnc-lists.ts` (3)
- [ ] 1.19 `use-endpoint-profiles.ts` (3)
- [ ] 1.20 `use-flows.ts` (2)
- [ ] 1.21 `use-gdpr.ts` (7)
- [ ] 1.22 `use-holiday-calendars.ts` (2)
- [ ] 1.23 `use-impersonation.ts` (1)
- [ ] 1.24 `use-knowledge.ts` (2)
- [ ] 1.25 `use-mfa-users.ts` (4)
- [ ] 1.26 `use-notification-rules.ts` (13)
- [ ] 1.27 `use-onboarding.ts` (2)
- [ ] 1.28 `use-partner.ts` (10)
- [ ] 1.29 `use-queue-members.ts` (1)
- [ ] 1.30 `use-queues.ts` (2)
- [ ] 1.31 `use-rbac.ts` (5)
- [ ] 1.32 `use-reason-hints.ts` (3)
- [ ] 1.33 `use-reports.ts` (4)
- [ ] 1.34 `use-routes.ts` (1)
- [ ] 1.35 `use-skills.ts` (2)
- [ ] 1.36 `use-system.ts` (7)
- [ ] 1.37 `use-teams.ts` (2)
- [ ] 1.38 `use-tenants.ts` (7)
- [ ] 1.39 `use-trunks.ts` (3)
- [ ] 1.40 `use-typification-llm.ts` (10)
- [ ] 1.41 `use-typification.ts` (22)
- [ ] 1.42 `use-users.ts` (2)
- [ ] 1.43 `use-voice-codecs.ts` (1)
- [ ] 1.44 `use-webhooks.ts` (7)

## 2. Phase B — Q3 numeric-coercion site gathering (this child's extra obligation)

- [ ] 2.1 As each hook migrates, record any field whose generated type is a genuine
      `number | string` AOT-wire-union that a consumer must normalize to `number`, appended to a
      running tally in this task (site: file + field). **Tally seed (already at 2, both in
      `use-analytics.ts`):** (1) `CsatResponseDto.totalResponses`/`.averageRating` (phase-1); (2)
      `CsatAggregateAnalyticsDto` envelope + each `queues[]` row (archived `2026-07-14-csat-completion`,
      its "second concrete call site"). Exclude `ai-credits-readout.tsx`'s `as number` casts — a
      hand-written `number | null` nullable-narrowing gap, NOT this pattern (retro run 4).
- [ ] 2.2 At the end of migration, report the tally. It already stands at **2 genuine sites**, so a
      single additional genuine site reaches **≥3**; at that point open a follow-up change to
      introduce a shared `src/core/api/` coercion helper. If no third genuine site turns up, record
      "helper still deferred at 2 sites" and keep per-hook `select` coercion. (Decision point from
      phase2 design open question 3.)

## 3. Phase C — Validation (batch)

- [ ] 3.1 `npm run build` — type-check + bundle clean (`tsc -b` is the drift-catching CI gate)
- [ ] 3.2 `npx vitest run` — unit tests green
- [ ] 3.3 `npx eslint .` — clean (no new errors; i18n:check remains green)
- [ ] 3.4 Confirm no hand-written interface remains for any migrated Admin shape
      (`grep` each removed interface name returns only the generated re-export/alias)
- [ ] 3.5 No `npx playwright test` task required unless a migration alters a user-facing flow —
      swap-the-T is compile-time-only; existing E2E coverage exercises unchanged runtime behavior
