## 1. Phase A — Migrate Admin-module hook files (swap-the-T, per file)

Each task: replace the file's hand-written request/response interface(s) with the generated
`components['schemas']['<SchemaName>']` type (aliased locally), grep the repo for every usage of
each removed interface name and update imports, then delete the hand-written declaration. `tsc -b`
must stay green after each. Counts in parens = hand-written declarations in the file today (199
total).

> **BATCH 1 (files 1.1–1.22) — reality note (2026-07-16).** The committed
> `openapi.d.ts` (generated from Platform's real captured document) exposes **request-body
> schemas** (`*Request`/`*Body`, 134) and nested value-object `*Dto`s (32), but **almost no
> top-level response DTOs** — Platform's response bodies are not emitted as named `components/schemas`.
> So for most Admin hooks the migratable surface is (a) response DTOs with **no matching generated
> schema**, or (b) request bodies whose generated schema **diverges** (optional keys become
> required-nullable, `number` becomes the AOT `number | string` union, literal unions widen to
> `string`) — a direct swap there would be a **breaking change** to the hook's public input type,
> which the design forbids ("no breaking changes … each generated type is a structural match").
> Per the structural-match discipline + the interim posture precedent (archived
> `2026-07-14-csat-completion` task 1.1: schema-absent hooks stay hand-written, not force-swapped),
> batch 1 migrates **only the genuine clean matches** and leaves the rest hand-written, each
> annotated below. No `openapi.d.ts` hand-editing; no invented schema paths.

- [x] 1.1 `use-agent-assist-feature.ts` (4) — **kept hand-written.** `AgentAssistFeature` (response)
      has no generated schema; `AgentAssistCredentialsInput`/`AgentAssistFeatureUpdate` map to
      `AgentAssistCredentialsDto`/`AgentAssistFeatureUpdateRequest` but those make the optional
      `apiKey?`/`endpoint?` into required-nullable `apiKey: null | string` — a breaking tightening
      on callers. Stays hand-written.
- [x] 1.2 `use-agent-assist.ts` (3) — **kept hand-written.** File header already documents its DTOs
      drift from the backend (`enabled`/`samplingRate` don't exist server-side); `KeywordRule` uses
      `id` where generated `KeywordRuleDto` uses `ruleId` (field-name mismatch, + generated drops
      `isActive`); `ComplianceRule`'s literal `severity`/`action` unions widen to `string` in
      `ComplianceRuleDto` (loses discrimination). No clean match.
- [x] 1.3 `use-agent-memberships.ts` (1) — **kept hand-written.** `AgentQueueMembership` (response)
      has no generated schema.
- [x] 1.4 `use-agents.ts` (6) — **kept hand-written.** `Agent` (response) has no generated schema
      (no `AgentDto`). `ChannelCapacityOverride` maps to `ChannelCapacityOverrideDto` but every field
      is the AOT `null | number | string` union vs hand-written `number | null` — a genuine Q3
      numeric-union site (recorded in Phase B), NOT swapped (it is read as `capacityOverride` and
      would need coercion). `CreateAgentInput`/`QueueMembershipInput` vs `CreateAgentRequest`/
      `QueueMembershipRequest` diverge (optional→required-nullable, numeric union).
- [x] 1.5 `use-api-keys.ts` (3) — **kept hand-written.** `ManagementApiKey`/`CreateApiKeyResponse`
      (responses) have no generated schema; `CreateApiKeyRequest` vs `CreateMgmtApiKeyRequest`
      diverges (required `name` → optional-nullable, `expiresInDays` → `null | number | string`).
- [x] 1.6 `use-audit-events.ts` (2) — **no-op (nothing to migrate).** No wire DTOs — only the
      `UseAuditEventsArgs` hook-arg interface and a re-export of `AuditEntry` from `use-audit.ts`.
- [x] 1.7 `use-audit.ts` (3) — **kept hand-written.** `AuditEntry` (response) + local
      `PagedResult`/`AuditSearchParams` have no generated schema.
- [x] 1.8 `use-auth-admin.ts` (9) — **MIGRATED (1 of 9): `ChangePasswordRequest`** → generated
      `components['schemas']['ChangePasswordRequest']` (non-breaking superset: same two required
      fields, adds optional `mfaCode`). The 8 response types (`AuthConfig`, `AuthEvent`,
      `ActiveSession`, `MfaSetupResponse`, `UserSession`, `RecoveryCodesResponse`, `PasswordPolicy`,
      local `PagedResult`) have no generated schema — kept hand-written.
- [x] 1.9 `use-billing.ts` (14) — **kept hand-written.** All response DTOs (`RateCard`, `Invoice`,
      `Quota`, `QuotaStatus`, `DunningStatus`, `UsageSummary`, `UsageRecord`, …) have no generated
      schema. `RateEntry`/`RateTier` map to `RateEntryDto`/`RateTierDto` but those carry AOT
      `number | string` unions (`unitPrice`, `includedQuantity`, `fromQuantity`, `toQuantity`) vs
      hand-written `number` — genuine Q3 sites (recorded in Phase B), and swapping only the nested
      types while `RateCard` stays hand-written adds no drift protection. Request inputs
      (`CreateRateCardInput`, `GenerateInvoiceInput`, `UpdateQuotaInput`) diverge (optional→required).
- [x] 1.10 `use-bots.ts` (1) — **kept hand-written.** `Bot` (response) has no generated schema; the
      mutations use `Partial<Omit<Bot, …>>` inline, not `Create/UpdateBotRequest`.
- [x] 1.11 `use-caller-id-pools.ts` (2) — **kept hand-written.** `CallerIdPoolSummary`/`CallerIdEntry`
      (responses) have no generated schema; mutations use `Partial<Omit<…>>` inline.
- [x] 1.12 `use-campaigns.ts` (8) — **MIGRATED (1 of 8): `ScheduleDay`** → generated
      `components['schemas']['ScheduleDayDto']` (exact structural match: `day`/`enabled`/`start`/`end`;
      the `campaign-wizard.tsx` copy is an independent decl, no import bridge to update). The other
      response DTOs (`CampaignSummary`, `CampaignDetail`, `ContactList`, `DispositionCode`,
      `CampaignMetrics`) have no generated schema; `ContactImportRow` vs `ContactImportRowDto`
      diverges (optional→required-nullable). Kept hand-written.
- [x] 1.13 `use-canned-responses.ts` (3) — **kept hand-written.** `CannedResponse` (response) has no
      generated schema; `Create/UpdateCannedResponseRequest` name-match `Create/UpdateCannedResponseRequest`
      but generated makes optional `category?`/`tags?` into required-nullable — breaking on callers.
- [x] 1.14 `use-cases.ts` (7) — **kept hand-written.** `Case` (response) + `CasePriority`/`CaseStatus`
      literal unions + local `PagedResult`/`CaseFilters` have no generated schema;
      `Create/UpdateCaseRequest` name-match but generated widens `priority: CasePriority` →
      `priority: string` (loses the literal union) and optional→required-nullable — breaking.
- [x] 1.15 `use-channels.ts` (1) — **kept hand-written.** `ChannelConfig` (response, also the PUT
      body) has no generated schema (`UpdateChannelConfigRequest` is the write-only body; the hook
      inlines the PUT shape).
- [x] 1.16 `use-dialer-settings.ts` (1) — **kept hand-written.** `DialerSettings` (response) has no
      generated schema; the PUT uses `Partial<DialerSettings>` inline, not `UpdateDialerSettingsRequest`.
- [x] 1.17 `use-did-routes.ts` (3) — **kept hand-written.** `DidRouteSummary` (response) has no
      generated schema; `CreateDidRouteFields` vs `CreateDidRouteRequest` matches on required fields
      but `UpdateDidRouteFields = Partial<…>` vs `UpdateDidRouteRequest` diverges (optional→required-nullable).
- [x] 1.18 `use-dnc-lists.ts` (3) — **kept hand-written.** `DncListSummary`/`DncEntry`/`DncCheckResult`
      (responses) have no generated schema; mutations use `Partial<Omit<…>>` inline.
- [x] 1.19 `use-endpoint-profiles.ts` (3) — **kept hand-written.** `EndpointProfile` (response) has no
      generated schema; `Create/UpdateEndpointProfilePayload` map to `Create/UpdateEndpointProfileRequest`
      but those turn optional numbers into required `null | number | string` AOT unions
      (`maxContacts`, `qualifyFrequency`) — genuine Q3 sites (recorded in Phase B) AND a breaking
      request-body tightening.
- [x] 1.20 `use-flows.ts` (2) — **kept hand-written.** `FlowDefinition` (response) has no generated
      schema; `FlowNodeDto` name-matches `FlowNodeDto` but generated makes required `config`/`edges`
      into optional-nullable (`config?: null | …`) — consumers read `node.config`/`node.edges`
      non-null, so swapping introduces null-handling fallout. Kept hand-written.
- [x] 1.21 `use-gdpr.ts` (7) — **kept hand-written.** All response DTOs (`GdprExportResult`,
      `PurgeResult`, `PurgeEntry`, `RetentionPolicy`, `PurgePreview`) have no generated schema;
      `UpdateRetentionPolicyRequest` name-matches but generated diverges both ways
      (optional→required AND `number | null` → `null | number | string`).
- [x] 1.22 `use-holiday-calendars.ts` (2) — **kept hand-written.** `HolidayCalendarSummary`/`Holiday`
      (responses) have no generated schema; mutations use `Partial<Omit<…>>` inline.

  > **BATCH 2 (files 1.23–1.44) — reality note (2026-07-16).** Same structural reality as batch 1
  > (see the note above 1.1): the committed `openapi.d.ts` is overwhelmingly request bodies + nested
  > value-object `*Dto`s, with almost no top-level response DTOs. Batch 2 migrates **only the genuine
  > clean matches** (exact structural match or non-breaking superset) and leaves the rest hand-written,
  > each annotated. **4 migrations across the 22 files** (`SystemSettings`, `UpdateLicenseRequest`,
  > `TypificationFieldOption`, `CreateWebhookSubscriptionRequest`) — all dead-simple exact matches with
  > no numeric fields. No `openapi.d.ts` hand-editing; no invented schema paths.

- [x] 1.23 `use-impersonation.ts` (1) — **kept hand-written.** `ImpersonateResponse` (response) has no
      generated schema; the only same-named generated schema is `ImpersonateRequest` (the request
      body: `targetTenantId`, `readOnly`, `reason?`) — an entirely different shape (no `accessToken`/
      `expiresAt`/`targetTenantName`), and it isn't used as a named type here (the mutation inlines
      the body). No response counterpart.
- [x] 1.24 `use-knowledge.ts` (2) — **kept hand-written.** `Article`/`ArticleSearchResult` (responses)
      have no generated schema; write inputs use `Omit<Article,…>` inline. `Create/UpdateArticleRequest`
      would be breaking anyway (field-name mismatch `isPublished`≠`published`; `tags?` → required
      `string[]` / optional-nullable).
- [x] 1.25 `use-mfa-users.ts` (4) — **kept hand-written.** `MfaUserStatus` (literal union),
      `MfaUserSummary` (response), local `PagedResult<T>` (generic), `MfaUserListFilter` (client-side
      query-param filter) — none has a generated schema.
- [x] 1.26 `use-notification-rules.ts` (13) — **kept hand-written.** The generated document has NO
      notification-rule schema at all (`NotificationRule`, `Rule*`, `DryRunResult`,
      `NotificationEventType` absent). All 13 decls (3 literal unions, `RuleTriggerConfig`/
      `RuleCondition`/`RuleAction`/`RuleSchedule`/`RuleThrottling`, `NotificationRule`, `DryRunResult`,
      `RuleFiringEntry`, `NotificationEventType`, generic `PagedResult<T>`) have no counterpart.
- [x] 1.27 `use-onboarding.ts` (2) — **kept hand-written.** `ChecklistItem`/`OnboardingStatus`
      (responses) have no generated schema. `ApplyTemplateRequest` (`{ template: string }`) exists and
      matches the apply-template body, but the hook inlines `data: { template }` — there is no
      hand-written interface for that body to migrate.
- [x] 1.28 `use-partner.ts` (10) — **kept hand-written.** Six response DTOs (`PartnerCustomer`,
      `PartnerRevenueSnapshot`, `PartnerGenerateInvoiceResponse`, `PartnerRevenueSummary`,
      `PartnerRevenueDetail`, `StatusUpdateResponse`) have no generated schema. `CreatePartnerCustomerInput`
      vs `CreatePartnerCustomerRequest` diverges (`plan?`/`template?` optional → optional-nullable
      `null | string`); `UpdatePartnerCustomerInput` vs `UpdatePartnerCustomerRequest` diverges
      (`maxConcurrentChannels`/`maxActiveCampaigns` → `null | number | string` AOT union — latent Q3);
      `SuspendCustomerInput` vs `SuspendCustomerRequest` mismatches (hand-written carries the route
      `id`, hook sends an empty body); `TenantSettings` is an index-signature bag (no schema).
- [x] 1.29 `use-queue-members.ts` (1) — **kept hand-written.** `QueueMember` (response) has no
      generated schema (no `displayName`/`source`/`isPaused` on any request body); the write bodies
      (`AddQueueMemberRequest`, `AddMemberBody`, `UpdateMemberBody`, `PauseMemberBody`,
      `QueueMembershipRequest`) are all inlined in the hooks with no hand-written interface and their
      `penalty` is `null | number | string` (latent Q3, writer-side).
- [x] 1.30 `use-queues.ts` (2) — **kept hand-written.** `Queue` (response) has no generated schema
      (`Create/UpdateQueueRequest` lack `id`/`createdAt`, make everything optional-nullable, and
      `maxWaiting` → `null | number | string`); `PagedResult<T>` is a local generic. Mutations use
      `Partial<Omit<Queue,…>>` inline. (Latent Q3: `QueueOverflowRuleDto`, `SlaPolicyTargetDto`,
      `WrapUpConfigDto`, `CreateQueueRequest.maxWaiting` — none adopted.)
- [x] 1.31 `use-rbac.ts` (5) — **kept hand-written.** `Permission`, `PermissionCategory`, `TenantRole`,
      `RoleTemplate`, `UserRoleAssignment` (all responses) have no generated schema; the create/update
      role bodies (`Create/UpdateTenantRoleRequest`, `ReplaceUserRolesRequest`, `ApplyTemplateRequest`)
      are unrelated shapes not used as named types here.
- [x] 1.32 `use-reason-hints.ts` (3) — **kept hand-written.** `ReasonHint` (response) has no generated
      schema (carries `id`, no request body does). `CreateReasonHintFields` name-aligns with
      `CreateReasonHintRequest` but `priority: number` → `priority: number | string` (AOT union — a
      breaking widening; latent Q3). `UpdateReasonHintFields = Partial<…>` vs `UpdateReasonHintRequest`
      diverges (optional → required-nullable `null | …`, + same `priority` union).
- [x] 1.33 `use-reports.ts` (4) — **kept hand-written.** `ScheduledReport`/`ReportExecution`
      (responses) have no generated schema; `ReportType`/`ReportFormat` literal unions widen to
      `string` in `CreateScheduledReportRequest` (breaking), which also adds `reportType`/`effectiveType`
      and drops `id`/`createdAt`.
- [x] 1.34 `use-routes.ts` (1) — **kept hand-written.** `OutboundRouteSummary` (response) has no
      generated schema; `CreateOutboundRouteRequest` diverges hard (all int fields → AOT unions
      `trunkId`/`priority`/`overflowTrunkId` = `number | string`; adds `campaignId`; drops `id`) —
      latent Q3.
- [x] 1.35 `use-skills.ts` (2) — **kept hand-written.** `Skill` name-aligns with `CreateSkillRequest`
      but `category`/`description` go required `string` → required-nullable `null | string` (breaking);
      `AgentSkillAssignment` has no matching schema (`AssignSkillRequest` lacks `agentId` and widens
      `proficiency: number` → `null | number | string` — latent Q3, writer-side).
- [x] 1.36 `use-system.ts` (7) — **MIGRATED (2 of 7).** `SystemSettings` → generated
      `components['schemas']['SystemSettingsRequest']` (exact 3-field `string` match: `platformName`/
      `defaultTimezone`/`defaultLanguage`, all required; serves as both the GET response type and the
      PUT body). `UpdateLicenseRequest` → generated `components['schemas']['UpdateLicenseRequest']`
      (exact `{ licenseKey: string }` match; the hand-written name collides with the generated schema
      name, so the swap keeps the name). Kept hand-written: `SystemInfo`, `LicenseInfo`,
      `UpdateLicenseResponse`, `SetupResponse` (responses, no schema) and `SetupInput` (vs `SetupRequest`
      the optional fields become required-nullable — breaking).
- [x] 1.37 `use-teams.ts` (2) — **kept hand-written.** `Team` (response) has no generated schema
      (`memberCount`/`createdAt` on no request body); `PagedResult<T>` is a local generic. The
      create/update mutations use inline object literals, not named interfaces.
- [x] 1.38 `use-tenants.ts` (7) — **kept hand-written.** `TenantStatus`/`TenantType` (literal unions),
      `Tenant`/`TenantStats`/`StatusUpdateResponse` (responses) have no generated schema.
      `CreateTenantInput` vs `CreateMgmtTenantRequest` and `UpdateTenantInput` vs `UpdateMgmtTenantRequest`
      both diverge (`maxConcurrentChannels`/`maxActiveCampaigns` → `null | number | string` AOT union + optional-nullable widening) — latent Q3.
- [x] 1.39 `use-trunks.ts` (3) — **kept hand-written.** `TrunkSummary` (response, `id: number`) has no
      generated schema; `TrunkWriteFields` (`Partial<Omit<TrunkSummary,'id'>> & {authPassword?}`) vs
      `Create/UpdateTrunkRequest` diverges (`maxChannels: number` → `number | string`; carrier fields
      optional → required-nullable) — latent Q3; `TrunkConnectivityResult` (response, `authMode` literal
      union) has no counterpart.
- [x] 1.40 `use-typification-llm.ts` (10) — **kept hand-written.** `AiSource` is structurally identical
      to the generated `AiSource` enum but is a local `type` alias (not a DTO swap target, and used
      inside other kept types). `LlmProviderType` maps to generated `ProviderType` (name mismatch, out
      of swap scope). `LlmProviderSettings` vs `ProviderSettings` diverges (every field gains `| null`);
      `TestLlmConnectionInput` vs `TestLlmConnectionRequest` diverges (every optional → required-nullable
      `null | T`); `UpsertLlmConfigInput` vs `UpsertLlmConfigRequest` diverges (`aiSource` required →
      optional; nested `settings` widens). `TenantLlmConfig`, `LlmConfigEmpty`, `TenantLlmConfigResult`,
      `AiCreditsResponse`, `TestLlmConnectionResult` (responses/unions) have no schema.
- [x] 1.41 `use-typification.ts` (22) — **MIGRATED (1 of 22): `TypificationFieldOption`** → generated
      `components['schemas']['FieldOptionDto']` (exact match: `{ value: string; label: string }`,
      unused outside this file). Everything else kept hand-written: the enclosing `*Dto`s all widen
      their literal unions to `string` and turn optional members required-nullable —
      `TypificationCondition`/`ConditionExprDto` (`refType`/`op` → `string`, `value` required-nullable),
      `TypificationFieldValidation`/`FieldValidationDto` (`min`/`max`/`maxLength` → `null | number | string`),
      `TypificationFieldPrefillSource`/`PrefillSourceDto` (`kind` → `string`),
      `TypificationField`/`TypificationFieldDto`, `LeafOutcome`/`LeafOutcomeDto`,
      `TypificationNode`/`TypificationNodeDto` (`sortOrder` → `number | string`),
      `TypificationAiConfig`/`AiConfigDto` (thresholds → `number | string`); the request inputs
      (`Create/UpdateSchemaInput` vs `Create/UpdateSchemaRequest`, `Create/UpdateBindingInput` vs
      `Create/UpdateBindingRequest`, `TypifyInput` vs `TypifyRequest`) inherit those divergences plus
      `maxDepth`/`priority`/`aiConfidence` numeric unions; the pure response DTOs
      (`TypificationSchema`, `SchemaBinding`, `PublishError`, `PublishResult`,
      `TypificationFormResponse`, `TypificationSuggestionResponse`, `TypificationCalibrationStatus`) and
      the standalone literal-union aliases (`TypificationFieldType`, `TypificationAiMode`) have no
      schema. Heaviest concentration of latent Q3 sites (see Phase B).
- [x] 1.42 `use-users.ts` (2) — **kept hand-written.** `User` (response) has no generated schema
      (`Create/UpdateUserRequest` are request bodies with `role` as a `UserRole` enum ref + different
      shape); `PagedResult<T>` is a local generic. The create/update mutations use inline object
      literals, not named interfaces.
- [x] 1.43 `use-voice-codecs.ts` (1) — **kept hand-written.** `VoiceCodecsResponse` (response,
      `source: 'asterisk' | 'fallback'` literal union + `codecs: string[]`) has no generated schema.
- [x] 1.44 `use-webhooks.ts` (7) — **MIGRATED (1 of 7): `CreateWebhookSubscriptionRequest`** → generated
      `components['schemas']['CreateWebhookSubscriptionRequest']` (exact match:
      `{ name; endpointUrl; eventTypes }`, all required; the hand-written name collides with the
      generated schema name, so the swap keeps the name). Kept hand-written: `WebhookSubscription`,
      `WebhookEventType`, `WebhookDelivery`, `CircuitBreakerStatus` (responses, no schema),
      `PagedResult<T>` (generic), and `UpdateWebhookSubscriptionRequest` (its generated counterpart turns
      every optional field into required-nullable `null | T` — breaking).

## 2. Phase B — Q3 numeric-coercion site gathering (this child's extra obligation)

- [x] 2.1 As each hook migrates, record any field whose generated type is a genuine
      `number | string` AOT-wire-union that a consumer must normalize to `number`, appended to a
      running tally in this task (site: file + field). **Tally seed (already at 2, both in
      `use-analytics.ts`):** (1) `CsatResponseDto.totalResponses`/`.averageRating` (phase-1); (2)
      `CsatAggregateAnalyticsDto` envelope + each `queues[]` row (archived `2026-07-14-csat-completion`,
      its "second concrete call site"). Exclude `ai-credits-readout.tsx`'s `as number` casts — a
      hand-written `number | null` nullable-narrowing gap, NOT this pattern (retro run 4).

      **BATCH 1 finding (files 1.1–1.22, 2026-07-16): 0 NEW *ACTIVE* Q3 sites; tally stays at 2.**
      A "genuine site" per the design is a `number | string` union a consumer *must normalize* —
      which only exists once the generated type is **actually adopted/consumed**. The only two
      types batch 1 adopted (`ScheduleDayDto`, `ChangePasswordRequest`) have **no numeric fields**,
      so no new active site was introduced. The AOT `number | string` unions *do* appear in
      generated `*Dto`/`*Request` schemas that batch 1 **encountered but did NOT adopt** (they were
      kept hand-written precisely because the union is a divergence from the hand-written `number`).
      Recorded as **latent/candidate sites** (would become active only if/when a future batch
      swaps that hook onto the generated type):
        - `use-agents.ts` — `ChannelCapacityOverrideDto.{maxVoice,maxChat,maxEmail,maxSms,maxTotal}`
          (`null | number | string`; read via the `capacityOverride` response field).
        - `use-billing.ts` — `RateEntryDto.{unitPrice,includedQuantity}` + `RateTierDto.{fromQuantity,toQuantity,unitPrice}`
          (`number | string`; read inside the `RateCard.rates` response).
        - `use-endpoint-profiles.ts` — `Create/UpdateEndpointProfileRequest.{maxContacts,qualifyFrequency}`
          (`null | number | string`; request-body fields — writer-side, not a read-normalization site).
      None of these were adopted, so per the design's definition the active tally is unchanged.

- [x] 2.2 At the end of migration, report the tally. It already stands at **2 genuine sites**, so a
      single additional genuine site reaches **≥3**; at that point open a follow-up change to
      introduce a shared `src/core/api/` coercion helper. If no third genuine site turns up, record
      "helper still deferred at 2 sites" and keep per-hook `select` coercion. (Decision point from
      phase2 design open question 3.)

      **BATCH-1 REPORT: helper still deferred at 2 active sites.** Batch 1 added no new active
      Q3 site (see 2.1), so the threshold is not reached. Batch 2 (files 1.23–1.44) continues the
      gathering; the ≥3 decision stays open until then. The latent sites above are the strongest
      candidates to flip active if/when their hooks are swapped.

      **BATCH 2 finding (files 1.23–1.44, 2026-07-16): 0 NEW *ACTIVE* Q3 sites; tally stays at 2.**
      The 4 shapes batch 2 adopted (`SystemSettings`/`SystemSettingsRequest`, `UpdateLicenseRequest`,
      `TypificationFieldOption`/`FieldOptionDto`, `CreateWebhookSubscriptionRequest`) are **all
      numeric-free** — every field is `string` or `string[]` — so no consumer read-normalization site
      was introduced. The AOT `number | string` unions again appear only in generated schemas batch 2
      **encountered but did NOT adopt** (kept hand-written precisely because the union is the divergence
      that blocks a clean swap). Additional latent/candidate sites logged this batch (would flip active
      only if a future batch swaps that hook onto the generated type):
        - `use-partner.ts` — `UpdatePartnerCustomerRequest.{maxConcurrentChannels,maxActiveCampaigns}`
          (`null | number | string`; request-body/writer-side).
        - `use-queue-members.ts` — `AddQueueMemberRequest`/`AddMemberBody`/`UpdateMemberBody`/
          `QueueMembershipRequest`.`penalty` (`null | number | string`; writer-side).
        - `use-queues.ts` — `CreateQueueRequest.maxWaiting`, `QueueOverflowRuleDto.overflowAfterSeconds`,
          `WrapUpConfigDto.defaultWrapUpSeconds`, `SlaPolicyTargetDto.*` (`number | string`; unadopted).
        - `use-reason-hints.ts` — `Create/UpdateReasonHintRequest.priority` (`number | string`; writer-side).
        - `use-routes.ts` — `Create/UpdateOutboundRouteRequest.{trunkId,priority,overflowTrunkId,campaignId}`
          (`number | string` / `null | number | string`; writer-side).
        - `use-skills.ts` — `AssignSkillRequest.proficiency` (`null | number | string`; writer-side).
        - `use-tenants.ts` — `Create/UpdateMgmtTenantRequest.{maxConcurrentChannels,maxActiveCampaigns}`
          (`null | number | string`; writer-side).
        - `use-trunks.ts` — `Create/UpdateTrunkRequest.maxChannels` (`number | string`; writer-side).
        - `use-typification.ts` — `FieldValidationDto.{min,max,maxLength}`, `TypificationFieldDto.sortOrder`,
          `TypificationNodeDto.sortOrder`, `LeafOutcomeDto.retryDelayMinutes`,
          `AiConfigDto.{suggestThreshold,autoApplyThreshold,autonomousThreshold,dailyTokenBudget}`,
          `CreateSchemaRequest.maxDepth`, `Create/UpdateBindingRequest.priority`, `TypifyRequest.aiConfidence`
          (`number | string` / `null | number | string`; the heaviest cluster — all unadopted).
      None adopted, so per the design's definition the active tally is **unchanged at 2**.

## 3. Phase C — Validation (batch)

> Phase C is a **batch-wide gate**; it runs at the end of EACH batch. The checks below are
> ticked for **batch 1** (files 1.1–1.22); batch 2 re-runs them for the full set before archive.

- [x] 3.1 `npm run build` — type-check + bundle clean (`tsc -b` is the drift-catching CI gate).
      **Batch 1: `tsc -b && vite build` exit 0** (the two pre-existing `@microsoft/signalr`
      `INVALID_ANNOTATION` third-party warnings only, non-blocking — same as csat-completion 3.5).
      **Batch 2 (FULL set): `tsc -b` exit 0, `npm run build` exit 0** (same two signalr third-party
      warnings only — non-blocking, unchanged).
- [x] 3.2 `npx vitest run` — unit tests green. **Batch 1: 185 files / 1456 tests pass, 0 failures.**
      **Batch 2 (FULL set): 185 files / 1456 tests pass, 0 failures.**
- [x] 3.3 `npx eslint .` — clean (no new errors; i18n:check remains green). **Batch 1: the two
      migrated files (`use-campaigns.ts`, `use-auth-admin.ts`) lint clean; no i18n-affecting change.**
      **Batch 2: `npx eslint .` exit 0. The 3 changed hook files (`use-system.ts`, `use-typification.ts`,
      `use-webhooks.ts`) lint clean; the 8 repo-wide warnings are pre-existing React-Compiler /
      TanStack-Virtual advisories in unrelated files, none in a migrated file. No i18n-affecting change.**
- [x] 3.4 Confirm no hand-written interface remains for any migrated Admin shape
      (`grep` each removed interface name returns only the generated re-export/alias). **Batch 1:
      `ScheduleDay` and `ChangePasswordRequest` are now `export type … = components['schemas'][…]`
      aliases (the only two shapes with a clean generated match); all other batch-1 shapes are
      intentionally still hand-written — see the per-file notes in Phase A for why (no generated
      response schema / divergent request schema).** **Batch 2: `SystemSettings`,
      `UpdateLicenseRequest`, `TypificationFieldOption`, `CreateWebhookSubscriptionRequest` are now
      `export type … = components['schemas'][…]` aliases (the only four shapes with a clean generated
      match across files 1.23–1.44); external type consumers (`use-system.test.tsx` imports
      `SystemSettings`) keep compiling via the re-export. All other batch-2 shapes are intentionally
      still hand-written — see the per-file Phase A notes.**
- [x] 3.5 No `npx playwright test` task required unless a migration alters a user-facing flow —
      swap-the-T is compile-time-only; existing E2E coverage exercises unchanged runtime behavior.
      **Batch 1: both swaps are pure compile-time type aliases (structural match / superset), no
      runtime or user-facing change; no E2E needed.** **Batch 2: all four swaps are pure compile-time
      type aliases (exact structural matches), no runtime or user-facing change; no E2E needed.**
