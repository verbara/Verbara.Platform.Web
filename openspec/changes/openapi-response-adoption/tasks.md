## 1. Phase A (foundation, batch) — Regenerate the document

Regenerate the committed generated types from the new Platform OpenAPI document (which now emits the
admin-remainder named response schemas) before any hook migration. This is the seam the whole child
hangs on — do it first and commit the refreshed file so every later `tsc -b` runs against the real
response schemas.

- [x] 1.1 Run `scripts/generate-api-types.mjs` (`npm run generate:api-types`) against the Platform
      `openapi-response-schemas` document; commit the refreshed `src/core/api/generated/openapi.d.ts`.
- [x] 1.2 Confirm the admin-remainder response schemas are present in the regenerated file (spot-check
      the core set — `UserDto`, `QueueDto`, `TeamDto`, `AdminAgentResponseDto`, and the
      `PagedResultOf*` wrappers — against `response-schema-manifest.v1.json`'s `admin-remainder`
      group; the manifest is authoritative for the full set).
- [x] 1.3 `tsc -b` green with the regenerated file and no hook changes yet (baseline).

## 2. Phase B (critical, focused per file) — Migrate admin-remainder hooks (swap-the-T)

Each task: replace the file's hand-written **response** interface(s) with the generated
`components['schemas']['<SchemaName>']` type (aliased locally), grep the repo for every usage of each
removed interface name (component props, tests) and update imports, then delete the hand-written
declaration. `tsc -b` must stay green after each file. The authoritative migratable set is the ~38
admin-remainder hooks the archived `openspec/changes/archive/2026-07-16-openapi-typed-client-admin/`
kept hand-written for response-schema scarcity, mapped to the manifest's `admin-remainder` group.

Migrate in batches, one file per task, `tsc -b` green after each. Representative core bindings (the
full per-file assignment is resolved from the Admin child's per-file annotations at implementation
time; the manifest is the source of truth for each schema's name + fields):

- [x] 2.1 `use-users.ts` → `UserDto` / `PagedResultOfUserDto`.
- [ ] 2.2 `use-queues.ts` → `QueueDto` / `PagedResultOfQueueDto`.
- [ ] 2.3 `use-teams.ts` → `TeamDto` / `PagedResultOfTeamDto`.
- [ ] 2.4 `use-agents.ts` → `AdminAgentResponseDto` / `PagedResultOfAdminAgentResponseDto`.
- [ ] 2.5 RBAC hooks → `RoleTemplate`, `TenantRole`, `PermissionGroupDto`, `PermissionDefinition`,
      `UserPermissionsDto`, `UserRoleAssignment` (per manifest).
- [ ] 2.6 Management/tenant hooks → `MgmtTenantDto`, `TenantSettingsDto`, `SystemSettingsDto`,
      `SystemInfoDto`, `QuotaDto` / `QuotaStatusDto`, `RetentionPolicyDto` (per manifest).
- [ ] 2.7 Billing/partner hooks → `InvoiceDto`, `RateCardDto`, `UsageRecordDto` / `UsageSummaryDto`,
      `DunningRecordDto`, `PartnerCustomerDto`, `PartnerRevenueDetailDto` / `PartnerRevenueSummaryDto`
      (per manifest).
- [ ] 2.8 Webhook / cluster / license / session hooks → `WebhookSubscription`, `CircuitStatusResponse`,
      `MgmtClusterStatusDto` / `MgmtClusterNodeDto`, `LicenseInfoDto` / `LicenseStatusSnapshot`,
      `ActiveSession`, `MgmtApiKeyDto` / `CreateMgmtApiKeyResponse` (per manifest).
- [ ] 2.9 Remaining admin-remainder hooks per the Admin child's per-file list — one file per commit,
      each binding to its manifest schema, `tsc -b` green after each.

## 3. Phase B-out — Q3 coercion-site gathering (flip latents, report to shared tally)

- [ ] 3.1 As each admin-remainder hook adopts its now-named response type, record any field whose
      generated type is a genuine `number | string` AOT-wire-union a consumer must normalize to
      `number`. Many such unions were logged as **latent** in the Admin child precisely because those
      hooks stayed hand-written — adopting the response type here can flip them **active**. Append
      each newly-active site to the shared tally (currently 2 active). The ≥3-genuine-active-sites
      decision point governs whether the shared coercion helper is introduced. Exclude
      `ai-credits-readout.tsx`'s `as number` casts (not this pattern — retro run 4).

## 4. Phase C (integration, batch) — Validation

- [ ] 4.1 `npm run build` — type-check + bundle clean (`tsc -b` is the drift-catching CI gate).
- [ ] 4.2 `npx vitest run` — unit tests green.
- [ ] 4.3 `npx eslint .` — clean (no new errors); i18n parity (EN-US / ES-419 / PT-BR) remains green.
- [ ] 4.4 Confirm no hand-written response interface remains for any migrated admin-remainder shape,
      and every migrated hook binds to its manifest-named `components['schemas']['<SchemaName>']`.
- [ ] 4.5 No `npx playwright test` task required unless a migration alters a user-facing flow —
      swap-the-T is compile-time-only; if a data-\* selector'd flow changes, add coverage per the
      anti-flake fences (no wall-clock waits; workers:1, retries:1; data-testid selectors).
