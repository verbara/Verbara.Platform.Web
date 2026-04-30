# Changelog

All notable changes to **Asterisk.Platform.Web** are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) ·
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

_No unreleased changes._

---

## [1.13.15] — 2026-04-30 — i18n Coverage Phase 4I (fill missing JSON keys for canned-responses + roles + webhooks)

**Closes the inline-fallback gap.** Three admin pages
(`canned-responses-page`, `roles-page`, `webhooks-page`) were
already calling `t('admin:…')` for every user-facing string but
had no matching JSON keys. Two of them (roles, webhooks) used
the inline-default-value pattern (`t(key, 'English fallback')`)
so the English UI worked but Spanish/Portuguese fell through to
the same English. Canned-responses had no fallbacks at all and
was rendering raw key strings (e.g. `cannedResponses.shortcut`)
in the column headers.

This phase adds the 35 missing JSON keys across 3 locales —
no TSX changes required. Switching languages now actually
translates these surfaces.

### Locales

`admin.json` (3 locales):

- **`cannedResponses`** — `title`, `create`, `shortcut`,
  `titleColumn`, `body`, `category`, `tags`, `searchPlaceholder`,
  `noResults`, `empty` (10 keys; section previously held only
  `entity_type`).
- **`roles`** — `title`, `description`, `create`, `name`,
  `name_placeholder`, `description_label`,
  `description_placeholder`, `template`, `no_template`, `clone`,
  `clone_name`, `default`, `custom`, `source`, `permissions`,
  `users` (16 keys; section previously held only `entity_type`).
- **`webhooks`** — `title`, `description`, `create`,
  `searchPlaceholder`, plus a new `columns` sub-section with
  `name`, `endpointUrl`, `eventTypes`, `status`, `created`
  (9 keys total under existing `webhooks.{status, detail, form,
  entity_type}`).

### Verification

Tests: 199/199 Vitest · 0 TS errors · prod build clean.
Post-merge audit confirms zero missing-key gaps in these 3
files (40 total keys called, 40 found in es-419).

### Coverage

Three full pages move from "calls `t()` but renders English
everywhere" to fully localized. The remaining hardcoded strings
in these pages are limited to a `Loading…` literal in
canned-responses (cosmetic, deferred to a future polish pass).

---

## [1.13.14] — 2026-04-30 — i18n Coverage Phase 4H (remaining ConfirmDeleteDialog callers)

**Closes the entityType migration loop.** All 9 remaining
`ConfirmDeleteDialog` callers that were still passing English
literals into the now-localized template (which would render
as broken Spanglish like "Delete Bot?" inside an otherwise
Spanish UI) now read their entity noun from i18n.

### Migrated callers

| File | Before | After (key) |
|---|---|---|
| `admin/bots/bot-list-page.tsx` | `"Bot"` | `admin:bots.entity_type` |
| `admin/canned-responses/canned-responses-page.tsx` | `"Canned Response"` | `admin:cannedResponses.entity_type` |
| `admin/campaigns/campaign-detail-page.tsx` | `"Campaign"` | `admin:campaigns.entity_type` |
| `admin/reports/reports-page.tsx` | `"Report"` | `admin:reports.entity_type` |
| `admin/roles/roles-page.tsx` | `"role"` | `admin:roles.entity_type` |
| `admin/routes/routes-page.tsx` | `"Route"` | `admin:routes.entity_type` |
| `admin/surveys/survey-list-page.tsx` | `"Survey"` | `admin:surveys.entity_type` |
| `admin/trunks/trunks-page.tsx` | `"Trunk"` | `admin:trunks.entity_type` |
| `admin/webhooks/webhooks-page.tsx` | `"webhook subscription"` | `admin:webhooks.entity_type` |

### Locales

`admin.json` (3 locales):
- Added `entity_type` to existing sections: `bots`, `campaigns`,
  `reports`, `routes`, `surveys`, `trunks`, `webhooks`.
- Created new minimal sections: `cannedResponses.entity_type`
  and `roles.entity_type`. The full canned-responses and roles
  page i18n is a separate follow-up — those pages already call
  `t('admin:cannedResponses.*' / 'admin:roles.*')` keys with
  inline default-value fallbacks, so the existing display does
  not change.

`AuditTimeline entityType="user" / "campaign"` props are
intentionally **not** migrated — those are domain identifiers
sent to the audit log API, not display strings.

### Verification

Tests: 199/199 Vitest · 0 TS errors · prod build clean.

### Coverage

ConfirmDeleteDialog migration is now 100%: every literal-string
caller has been moved to `t()`. The remaining ~9 admin pages
themselves still have hardcoded copy (column headers, button
labels, etc.), but their delete dialogs now render correctly
in Spanish/Portuguese.

This concludes the broader Phase 4 i18n batch (4A → 4H, 9
sub-phases shipped 2026-04-29 / 2026-04-30).

---

## [1.13.13] — 2026-04-30 — i18n Coverage Phase 4F (flow designer + 11 node types)

**Closes the visual flow editor.** The XYFlow-based flow designer
is the most visual surface in admin — operators drag node types
from a palette, drop them on a canvas, and edit per-node
properties in a side panel. Every label, header, group title,
field label, and placeholder fallback is now translated.

### Refactored to `useTranslation`

**`src/admin/flows/node-palette.tsx`** — "Nodes" header, 4 group
titles (Standard / Routing / Integration / AI), 11 draggable item
labels (Send Message / Collect Input / Condition / Set Variable /
Wait / End / Enqueue / HTTP Request / Knowledge Search / AI
Classify / AI Generate). Refactored `PaletteItem.label` →
`labelKey` and `PaletteGroup.title` → `titleKey` so the data
shape carries i18n keys instead of frozen English strings.

**`src/admin/flows/property-panel.tsx`** — "Properties" header,
"No configurable properties." empty state, 14 unique field labels
+ 2 disambiguating keys (`collect_input_variable` for "Save to
Variable", `set_variable_name` for "Variable") so the same `data`
key can carry different labels across node types. "Queue ID"
input placeholder. Refactored `PropertyField.label` → `labelKey`
under `flows.fields.*`.

**`src/admin/flows/flow-designer.tsx`** — default `flowName`
state value reads `flows.untitled` instead of hardcoded "Untitled
Flow".

**`src/admin/flows/flow-list-page.tsx`** — `handleCreate` payload
also uses `flows.untitled` so newly-created flows ship with a
locale-correct default name.

**11 node components in `src/admin/flows/nodes/`** — each pulls
its title from `flows.node_types.*` and any in-card fallback text
from `flows.node_body.*`:

- `send-message-node`: title + "No message" fallback.
- `collect-input-node`: title + "Ask..." prompt + "?" variable
  fallback.
- `condition-node`: title + "if ..." expression placeholder +
  "True"/"False" handle labels.
- `set-variable-node`: title + "var" / `""` fallbacks.
- `wait-node`: title + "0s" duration fallback.
- `end-node`: title + "hangup" disposition fallback.
- `enqueue-node`: title + "Queue" name fallback.
- `http-request-node`: title + "https://..." url placeholder
  (HTTP method `GET` left literal — it's a protocol token).
- `knowledge-search-node`: title + "input" query default + "query:"
  prefix label.
- `ai-classify-node`: title + 2 default categories ("Category 1",
  "Category 2") shown when none configured.
- `ai-generate-node`: title + "Generate..." prompt fallback.

`base-node.tsx` is a layout wrapper with no user-facing strings.

### Locales

Added under `admin.json` → `flows.*` (extends existing `flows.{title,
create, name, version, status, lastModified, publishedLabel, draft,
saveDraft, publish, ...}`):

- `flows.untitled`, `flows.nodes_header`, `flows.properties_header`,
  `flows.no_properties`, `flows.queue_id_placeholder`
- `flows.palette_groups.{standard, routing, integration, ai}`
- `flows.node_types.*` (11 keys)
- `flows.fields.*` (16 keys including the 2 variable-disambiguators)
- `flows.node_body.*` (16 keys for default placeholders, true/false
  handle labels, query prefix, etc.)

### Verification

Tests: 199/199 Vitest · 0 TS errors · prod build clean.

### Coverage

The 14 admin flow files (designer + list + toolbar + palette +
property-panel + 11 nodes) are now all translated. base-node
counts as scaffolding (no strings). Combined with prior phases,
admin coverage continues climbing.

This wraps the originally-planned Phase 4 i18n batch (4A → 4G).
The remaining ~10 untranslated admin files (bots, surveys,
reports, roles, routes-page, trunks-page, webhooks-page,
canned-responses, campaigns/campaign-detail) are smaller
follow-ups; their `entityType` callers will migrate as each
page is i18n'd.

---

## [1.13.12] — 2026-04-30 — i18n Coverage Phase 4G (confirm-delete-dialog + 9 callers)

**Translates the shared deletion dialog and migrates 9 already-i18n'd
callers to pass localized `entityType` props.** Until now those
callers were passing English nouns (e.g. `"rate card"`,
`"Caller ID Pool"`) into a hardcoded English template, producing
broken Spanglish like "Delete tarjeta de tarifa?" once the rest of
the page was translated. This phase closes that loop for the 9
callers whose containing pages are already localized; the remaining
~10 callers (bots, surveys, reports, etc.) will be migrated when
their respective pages are i18n'd in later phases.

### Refactored to `useTranslation`

**`src/core/ui/confirm-delete-dialog.tsx`** — sources all dialog
strings from `common.confirm_delete_dialog.*`. Title interpolates
the caller-provided `entityType`. Description uses split prefix /
suffix around the bolded entity name. The confirmation-word path
(used for high-stakes deletes like cluster force-drain) translates
the "Type X to confirm." instruction. Button label cycles through
`Wait {{seconds}}s...` → `Delete` → `Deleting...`.

### Migrated callers (9 files, 10 dialog instances)

- `src/agent/context/contact-info.tsx` — "Contact" →
  `agent.context.contact_entity_type`.
- `src/admin/billing/rate-cards-page.tsx` — "rate card" →
  `admin.billing.rate_cards.entity_label` (re-introduced after
  Phase 4A pruning, now with a real consumer).
- `src/admin/partner/partner-rate-cards-page.tsx` — "rate card" →
  `admin.partner.rate_cards.entity_type` (partner-specific so
  Spanish can read "tarjeta de tarifa de partner" vs. plain
  "tarjeta de tarifa").
- `src/admin/caller-id-pools/caller-id-pools-page.tsx` — "Caller
  ID Pool" → existing `admin.caller-id-pools.entity_type`.
- `src/admin/holiday-calendars/holiday-calendars-page.tsx` →
  existing `admin.holiday-calendars.entity_type`.
- `src/admin/dnc-lists/dnc-lists-page.tsx` → existing
  `admin.dnc-lists.entity_type`.
- `src/admin/tenants/tenants-page.tsx` — "tenant" →
  `admin.tenants.list.entity_type`.
- `src/admin/cluster/cluster-page.tsx` — TWO instances: regular
  remove (`admin.cluster.remove_entity`) and force-drain
  (`admin.cluster.force_drain_entity`, also keeps the literal
  `confirmationWord="FORCE"` typed-gate, untranslated by design).
- `src/admin/gdpr/gdpr-page.tsx` — TWO instances: contact-data
  (`admin.gdpr.purge.contact_entity_type`) and user-data
  (`admin.gdpr.purge.user_entity_type`).

### Locales

- `common.confirm_delete_dialog.{title, description_prefix,
  description_suffix, type_to_confirm_prefix,
  type_to_confirm_suffix, cancel, delete, deleting, wait_seconds}`
  added in 3 locales.
- New entity nouns: `agent.context.contact_entity_type`,
  `admin.billing.rate_cards.entity_label`,
  `admin.partner.rate_cards.entity_type`,
  `admin.tenants.list.entity_type`,
  `admin.gdpr.purge.contact_entity_type`,
  `admin.gdpr.purge.user_entity_type`.

### Test mocks

`tests/unit/core/ui/confirm-delete-dialog.test.tsx` — adds a
`react-i18next` mock with a small lookup table mapping the dialog's
9 keys back to their English values. This keeps existing
assertions (`expect(btn.textContent).toBe('Delete')` and
`/Wait/`) passing without coupling the test to internal key names.

### Verification

Tests: 199/199 Vitest · 0 TS errors · prod build clean.

### Coverage

`core/ui/confirm-delete-dialog` (1 file) is now translated;
9 callers migrated. The remaining ~10 untranslated callers will
be migrated as their respective pages get i18n'd (bots, surveys,
reports, roles, routes, trunks, webhooks, canned-responses,
campaigns/campaign-detail).

---

## [1.13.11] — 2026-04-29 — i18n Coverage Phase 4E-2 (DNC lists + GDPR)

**Closes the compliance surfaces.** DNC list management (CRUD +
detail with phone-add/check + CSV import wizard) and GDPR data
ops (export, contact/user purge with preview, retention policy
sheet, and purge log) — the screens compliance officers and DPO-
designate admins use daily.

### Refactored to `useTranslation`

**`src/admin/dnc-lists/dnc-lists-page.tsx`** — page header, Create
CTA, loading/empty/no-results, 4 column headers (Name/Scope/
Entries/Created), localized scope badge (Global/Campaign),
Create/Edit dialog (title, name + scope labels, scope options,
Cancel/Saving.../Update/Create).

**`src/admin/dnc-lists/dnc-list-detail.tsx`** — loading + not-
found states, Back button, scope_summary header with `{{scope}}`
+ `{{count}}`, Import Numbers CTA, Add Number section + 2 input
labels (phone/reason) + placeholders + Add button, Check Number
section + button + result messages via `<Trans>` with `<strong>`
component for `{{phone}}`, blocked-by-list suffix with `{{list}}`,
not-blocked variant, Entries section + Importing.../Import CSV
toggle, loading-entries, no-entries, 3 column headers, never
expiry placeholder, Previous/`Page {{n}}`/Next pagination, remove
ConfirmDialog (title/description/confirm).

**`src/admin/dnc-lists/dnc-import-wizard.tsx`** — dialog title,
3 step descriptions (upload/preview/result), drop hint + Browse
button, preview count `{{total}}/{{shown}}`, 2 column-mapping
labels + None option, imported count `{{count}}`, Back/Importing.../
Import/Done buttons.

**`src/admin/gdpr/gdpr-page.tsx`** — page header + description,
2 tab labels (By Contact / By User), Data Export card (heading,
contact-id label + placeholder, Exporting.../Export Data button,
summary heading + 5 lines with `{{count}}` interpolation +
Found/Not-found token, Download JSON), Data Purge card (heading,
2 warning paragraphs for contact vs user, contact-id/user-id
labels + placeholders, reason label + placeholder + length-
validation message, Purge Contact Data + Purge User Data buttons),
Preview button + heading + 4 preview-line labels, Purge Complete
result heading + Purge ID via `<Trans>` with mono `<span>` + per-
entity line.

**`src/admin/gdpr/purge-log-page.tsx`** — page header +
description, 7 column headers (Purge ID/Tenant ID/Subject/
Performed By/Reason/Entities Deleted/Purged At), filter labels
(Tenant ID + placeholder, From, To), Apply/Clear buttons, search
placeholder + no-results.

**`src/admin/gdpr/retention-policy-section.tsx`** — sheet title,
description split with embedded `<span>` for `{{tenantId}}`,
4 retention fields (label + description per entity type:
conversation/auth_event/audit/usage), Saving.../Save button,
days input placeholder + suffix. Refactored `RetentionFieldConfig`
to use `i18nKey: 'conversation' | 'auth_event' | 'audit' | 'usage'`
instead of hardcoded label/description strings.

### Locales

Added under `admin.json` (3 locales):

- `dnc-lists.*` (incl. `.detail.*` + `.import_wizard.*`)
- `gdpr.*` (incl. `.tabs.*`, `.export.*`, `.purge.*` shared
  between contact + user variants)
- `purge-log.*` (new top-level)
- `retention.policy.*` (extends existing `retention.{title, nav}`)

### Verification

Tests: 199/199 Vitest · 0 TS errors · prod build clean.

### Coverage

Admin section: 109/133 (82%) → 115/133 (86%).

This closes Phase 4E. Remaining: 4F (flows + 12 nodes — ~15
files) and 4G (`core/ui/confirm-delete-dialog` with caller
migration).

---

## [1.13.10] — 2026-04-29 — i18n Coverage Phase 4E-1 (webchat + cases + telephony admin)

**Closes 5 mid-tier admin features.** WebChat widget config, cases
CRUD, caller-ID pool management (list + detail), and holiday
calendar management (list + detail) — admin features used by
tenant managers configuring outbound dialing and customer
ticketing.

### Refactored to `useTranslation`

**`src/admin/webchat/webchat-page.tsx`** — page header + description,
Embed Snippet section heading + HTML badge + insertion instructions
(split prefix/suffix around `<code>`), Configuration section + 2
field labels (API URL, WebSocket URL).

**`src/admin/caller-id-pools/caller-id-pools-page.tsx`** — page
header + description, Create CTA, loading/empty/no-results, Name
column header, Create/Edit dialog (titles, name label, Cancel,
Saving.../Update/Create).

**`src/admin/caller-id-pools/caller-id-pool-detail.tsx`** — loading
state, not-found state, Back button, page description, Add Entry
section + 2 input labels, Adding.../Add button, Entries section
title with `{{count}}`, no-entries empty state, 3 column headers
(Phone Number, Area Code, Active), aria-label for Active switch.

**`src/admin/holiday-calendars/holiday-calendars-page.tsx`** — page
header + description, Create CTA, loading/empty/no-results, Name
column header, Create/Edit dialog (titles, name label, Cancel,
Saving.../Update/Create).

**`src/admin/holiday-calendars/holiday-calendar-detail.tsx`** —
loading/not-found states, Back button, page description, Add
Holiday section + 4 input labels (Name + placeholder, Date,
Allowed Start/End), Adding.../Add Holiday button, Holidays
section title with `{{count}}`, no-holidays empty, 4 column
headers.

**`src/admin/cases/cases-page.tsx`** — page header, Create CTA,
loading/empty/no-results, 6 column headers (Case #, Subject,
Priority, Status, Conversations, Created), localized priority
(Low/Normal/High/Urgent) + status (Open/Pending/Resolved/Closed)
labels in cells AND select options, Create/Edit case sheet (title
with `{{number}}` interpolation when editing, Subject + placeholder,
Priority + Status selects, Contact label + Change button + search
placeholder + min-chars hint, Assigned Agent label + Unassigned
option, Create/Update submit). `contactDisplayName` helper now
takes a fallback string parameter so the unnamed-contact label
stays translatable.

### Locales

Added top-level under `admin.json` (3 locales):

- `webchat.*`
- `caller-id-pools.*` (incl. `.detail.*` sub-section)
- `holiday-calendars.*` (incl. `.detail.*` sub-section)
- `cases.*` (incl. `.priority.*`, `.status.*`, `.form.*`)

### Verification

Tests: 199/199 Vitest · 0 TS errors · prod build clean.

### Coverage

Admin section: 104/133 (78%) → 109/133 (82%).

`entityType="Caller ID Pool"` / `"Holiday Calendar"` props on
ConfirmDeleteDialog left untranslated (interpolate into the
dialog's hardcoded English template — addressed when the dialog
itself is translated).

---

## [1.13.9] — 2026-04-29 — i18n Coverage Phase 4D (campaigns wizard + callbacks)

**Closes the campaigns wizard.** The 5-step campaign creation wizard
(Basic / Dialing / Schedule / Compliance / Contacts) is the most
visible long-form UX in admin — partner managers and tenant admins
walk through it whenever they spin up a new outbound campaign.
Plus the callbacks tab on campaign detail.

### Refactored to `useTranslation`

**`src/admin/campaigns/steps/basic-step.tsx`** — 4 input labels +
4 placeholders (Campaign Name, Description, Queue, Agent Team).

**`src/admin/campaigns/steps/dialing-step.tsx`** — Mode + Pacing
fieldset legends, 5 dialing-mode option labels + descriptions
(Preview/Progressive/Predictive/Power/Agentless), 3 pacing-strategy
option labels + descriptions (Fixed/Adaptive/Time-Based), Use
Global Defaults switch label + help, 3 global-readonly field
labels (Max Global Channels, Ring Timeout, Max Concurrent
Campaigns), 3 custom-pacing field labels (Lines per Agent, Target
Wait, Max Channels), Caller ID Pool label + help + select
placeholder + None option. Removed local `DIALING_MODES` /
`PACING_STRATEGIES` arrays-of-objects in favor of t-keyed lookups
on bare value arrays.

**`src/admin/campaigns/steps/schedule-step.tsx`** — Calling
Windows label, "to" connector, Timezone label, Start/End Date
labels, Holiday Calendar label + help + select placeholder + None
option, Manual Holiday Exclusions label + Add button.

**`src/admin/campaigns/steps/compliance-step.tsx`** — DNC List
label + help + select placeholder + None option + plural entry
count badge, 3 attempt-limit field labels (Max Attempts, Retry
Interval, Time Between Attempts), Compliance Rule Summary label
+ placeholder.

**`src/admin/campaigns/steps/contacts-step.tsx`** — Upload Contact
List label, drop hint, Select File button, validation report
(File processed: {{name}}, plural counts for loaded/skipped/
duplicates/total_rows), Column Mapping label + skip option,
Preview header with `{{count}}` plural, +N more columns header,
empty cell placeholder, Upload Different File button.

**`src/admin/campaigns/callbacks-tab.tsx`** — Loading state,
Pending Callbacks heading, Schedule Callback CTA + dialog title,
empty state, contact label with `{{id}}` interpolation, 4 input
labels (Phone Number, Contact ID, Scheduled Time, Agent ID),
phone/agent placeholders, Cancel + Scheduling…/Schedule footer.

### Locales

Added under `admin.json` → `campaigns.{basic_step, dialing_step,
schedule_step, compliance_step, contacts_step, callbacks}`
(3 locales). Plural forms used for `compliance_step.dnc_entries`
and `contacts_step.preview_label`.

### Verification

Tests: 199/199 Vitest · 0 TS errors · prod build clean.

### Coverage

Admin section: 98/133 (74%) → 104/133 (78%).

---

## [1.13.8] — 2026-04-29 — i18n Coverage Phase 4C-2 (admin forms)

**Closes the 5 admin CRUD form sheets.** Webhooks, trunks, routes,
endpoint profiles, and dialer settings — the configuration entry
points platform admins use to provision the platform's plumbing.
Reuses existing `trunks.*`, `routes.*`, `realtime.*` field labels
from prior phases; new `*.form.*` sub-sections add only the
form-specific overrides (titles, descriptions, placeholders,
submit copy).

### Refactored to `useTranslation`

**`src/admin/webhooks/webhook-form.tsx`** — sheet title (create vs
edit), description, Name + placeholder, Endpoint URL + placeholder,
Active switch label (edit only), Event types group (label + error
fallback + loading state), submit button (Create/Save), Webhook
secret post-create dialog (title, description, HMAC warning, Done
button).

**`src/admin/trunks/trunk-form.tsx`** — sheet title (create vs
edit) + description, Name + placeholder, Display Name +
placeholder, Type label (reuses `trunks.type`) + select-type
placeholder, Max Channels label, Active switch label, submit
(Add/Save).

**`src/admin/routes/route-form.tsx`** — sheet title + description,
6 input labels (reuses `routes.{priority,pattern,patternType,
trunk}`), select-type/select-trunk/no-overflow/dial-prefix-optional
placeholders, submit (Add/Save).

**`src/admin/realtime/profile-form.tsx`** — sheet title + 9 input
labels (Name + placeholder, Type with Agent/Trunk options,
Transport, Codecs, Max Contacts, Context, Qualify Frequency,
WebRTC switch, Direct Media switch), submit (Add/Save).

**`src/admin/dialer-settings/dialer-settings-page.tsx`** — page
header (title + description), loading state, 4 section headings
(Capacity / Timing / Jitter / Blend Mode), 8 input field labels,
jitter help text, blend-mode label + help + aria, save button
(Saving…/Save Settings).

### Locales

Added under `admin.json` (3 locales):

- `webhooks.form.*` (new sub-section under existing `webhooks.*`)
- `trunks.form.*` (new sub-section)
- `routes.form.*` (new sub-section)
- `realtime.form.*` (new sub-section under realtime added in 4C-1)
- `dialer-settings.*` (new top-level, kebab-case to match URL)

### Verification

Tests: 199/199 Vitest · 0 TS errors · prod build clean.

### Coverage

Admin section: 93/133 (70%) → 98/133 (74%).

This wraps Phase 4C — all admin ops dashboards + forms now
i18n-ready. Next batches: 4D (campaigns/cases/holidays/dnc/
caller-id-pools/webchat/gdpr — ~14 files), 4E (flows + 12 nodes —
~15 files), 4F (`core/ui/confirm-delete-dialog` with caller
migration).

---

## [1.13.7] — 2026-04-29 — i18n Coverage Phase 4C-1 (admin ops dashboards)

**Closes the platform-admin operations surfaces.** Tenants, cluster,
system diagnostics, and endpoint profiles are the screens platform
operators (not partners) use to provision and observe the platform —
extracting hardcoded copy here unblocks Spanish/Portuguese rollouts
for the platform-admin role.

### Refactored to `useTranslation`

**`src/admin/tenants/tenants-page.tsx`** — page header, New CTA,
loading state, empty state, 5 column headers (ID/Name/Status/Max
Channels/Max Campaigns), 4 row-action tooltips (Retention, Manage
Billing, Suspend, Activate), Create sheet (title, description,
Tenant ID + placeholder, Name + placeholder, Max channels, Max
campaigns, Submit), Suspend confirm dialog (title + split
prefix/suffix description with embedded tenant name), Edit dialog
(title, 4 input labels, status select with 3 options, Cancel,
Saving…/Update).

**`src/admin/cluster/cluster-page.tsx`** — page header, Add Node
CTA, 4 SummaryCard titles (Nodes, Capacity, Agents, Instances) +
healthy count + capacity-of-max subtitles, search placeholder, no
nodes state, 6 column headers (Node ID/State/Max Capacity/Weight/
Tier/Asterisk + N/A fallback), 5 row dropdown actions (Edit, Drain,
Cancel Drain, Force Drain, Remove), Active Drains section title +
plural calls remaining/completed/force-disconnected + Cancel/Force
buttons, Platform Instances section title + empty state +
last-seen/channels/owned-nodes labels, Add Node sheet (title,
description, 8 input labels + 2 placeholders, submit), Edit Node
sheet (title with `{{nodeId}}` interpolation, 3 input labels,
submit), Drain Node dialog (title, prefix/suffix description with
embedded `{{nodeId}}`, grace period label, Cancel/Submit).

**`src/admin/system/diagnostics-page.tsx`** — page header, loading
state, 4 status pill labels (connected/error/warning/unknown), 3
StatusCard titles (Platform/License/Cluster), 9 field labels
across cards (Version, Tenant, Setup, Status, Max Nodes, Features,
Nodes, Total Channels, Total Agents) + Complete/Pending badge +
N/A fallback + Manage cluster link + auto-refresh footer.

**`src/admin/realtime/realtime-page.tsx`** — page header (title +
description), Seed Defaults + Create Profile CTAs, loading state,
empty state, search placeholder, no-results message, 6 column
headers (Name/Type/Default/Transport/Codecs/WebRTC) + Default
badge, Delete confirm dialog (title, description with `{{name}}`
interpolation, Confirm).

### Locales

Added under `admin.json` (3 locales):

- `tenants.list.*` (new sub-section under existing `tenants.{detail,
  settings}` block)
- `cluster.*` (new top-level — distinct from existing
  `cluster-nodes.detail` for the node-detail drawer)
- `system.diagnostics.*` (new sub-section under existing `system.*`
  block)
- `realtime.*` (new top-level)

Plural forms (`_one`/`_other`) used for cluster `drains.remaining`.

### Verification

Tests: 199/199 Vitest · 0 TS errors · prod build clean.

### Coverage

Admin section: 89/133 (67%) → 93/133 (70%).

`entityType="tenant"` / `"node"` / `"force drain on node"` props
on `ConfirmDeleteDialog` left untranslated — they interpolate into
the dialog's hardcoded English `Delete {{entityType}}?` template,
which will be addressed when `core/ui/confirm-delete-dialog`
itself is translated (deferred phase).

---

## [1.13.6] — 2026-04-29 — i18n Coverage Phase 4B (partner portal)

**Closes the partner portal CRUD surfaces.** The 4 partner pages
(customers, rate cards + form, settings) are how partner managers
provision and price their downstream tenants — extracting hardcoded
copy here unblocks Spanish/Portuguese partner deployments.

### Refactored to `useTranslation`

**`src/admin/partner/`**

- `customers-page.tsx` — page header, Add customer CTA, 5 column
  headers (Name, Tenant ID, Status, Plan, Created), search
  placeholder, Create Customer dialog (full: title, description,
  Tenant ID + placeholder, Display name + placeholder, Plan,
  Template + None option, Cancel/Creating…/Create), Edit Customer
  sheet (title, description, Name, Max channels/campaigns + shared
  "Leave empty to keep current" placeholder, Cancel/Saving…/Save).
- `partner-rate-cards-page.tsx` — page header, New CTA, search
  placeholder. Column headers + Default badge + plural entries cell
  reuse `billing.rate_cards.*` keys (identical copy).
- `partner-rate-card-form.tsx` — sheet titles reuse
  `billing.rate_cards.form.{create_title,edit_title}`; descriptions
  and name placeholder are partner-specific (partner pricing /
  Standard partner pricing). All other form labels (Name, Currency,
  Effective from/to, Default rate card, Rate entries, Add rate,
  Rate #, Unit price, Included qty, Select usage type, Create/Save)
  reuse `billing.rate_cards.form.*` to avoid duplication.
- `partner-settings-page.tsx` — page header, Edit settings CTA,
  loading state, Operational settings heading, 3 Field labels
  (Platform name, Default timezone, Default language), platform-
  managed-by-admin note, Edit dialog (title/description, 3 input
  labels with locale-aware tz/lang placeholders, Cancel/Saving…/
  Save).

### Locales

Added under `admin.json` → `partner.{customers, rate_cards, settings}`
(3 locales: es-419, en-US, pt-BR).

`partner.rate_cards.form.{create_description, edit_description,
name_placeholder}` are intentionally narrow — only partner-specific
overrides; other rate-card form keys are shared with billing.

### Verification

Tests: 199/199 Vitest · 0 TS errors · prod build clean.

### Coverage

Admin section: 85/133 (64%) → 89/133 (67%).

---

## [1.13.5] — 2026-04-29 — i18n Coverage Phase 4A (admin shared + billing)

**Closes the billing surface and shared admin building blocks.** Rate
cards, invoices, quotas, and usage are the screens billing operators
and tenant admins use daily; the admin shared components (data-table,
confirm-dialog, contact-search-panel, placeholder-page) propagate
translated copy across every CRUD surface that consumes them.

### Refactored to `useTranslation`

**`src/admin/shared/`**

- `placeholder-page.tsx` — `Pending implementation` body label.
- `data-table.tsx` — search placeholder default, no-results default,
  pagination footer (`Page X of Y`, Previous, Next). Default props for
  `searchPlaceholder` / `noResultsMessage` are now derived from i18n
  when the caller omits them, preserving call-site overrides.
- `confirm-dialog.tsx` — Cancel and Confirm button defaults; caller
  may still override `confirmLabel`.
- `contact-search-panel.tsx` — search placeholder, searching/empty
  states, min-chars hint, Unknown name fallback.

**`src/admin/billing/`**

- `rate-cards-page.tsx` — page header title/description, New rate
  card CTA, table column headers (Name, Currency, Default, Effective
  from/to, Rates), `{count} entries` plural cell, search placeholder,
  Default badge, no-tenant message via `<Trans>` (Tenants page link).
- `rate-card-form.tsx` — sheet title/description (create vs edit),
  form labels (Name, Currency, Effective from/to, Default rate card),
  rate-entries list (Rate #, Add rate, no-entries hint, Unit price,
  Included qty, Select usage type), submit button label.
- `invoices-page.tsx` — page header, Generate invoice CTA, table
  column headers (Invoice, Period, Total, Status, Generated), search
  placeholder, no-tenant message, Generate dialog (title, description,
  Period start/end, Cancel, Generating…/Generate), Invoice detail
  sheet (Subtotal, Tax, Total, Issued/Due dates, Line items + per-row
  `{type} · {qty} units @ {price}` summary).
- `quotas-page.tsx` — page header, Edit quotas CTA, dunning banner
  (Account overdue, `{count} day(s) overdue`, overdue amount, View
  Invoice), no-quota empty state, Enforcement label, all 6 QuotaRow
  labels, edit dialog title/description, all 7 input labels, save
  button (Saving…/Save), no-tenant message via `<Trans>`.
- `usage-page.tsx` — page header, filter labels (From, Until, Type,
  All types), Usage by type chart heading, summary cards `{count}
  records` plural, Detailed records heading, search placeholder, all
  6 table column headers (Time, Type, Quantity, Unit, Channel,
  Reference), no-tenant message via `<Trans>`.

### Locales

Added under `admin.json` (3 locales: es-419, en-US, pt-BR):

- `shared.{placeholder_pending, data_table.*, confirm_dialog.*,
  contact_search.*}`
- `billing.{select_tenant_*_prefix/suffix, tenants_link, rate_cards.*,
  invoices.*, quotas.*, usage.*}`

Plural forms (`_one` / `_other`) used for `entries_count`,
`records_count`, and dunning `days`.

### Test mocks

`tests/unit/admin/partner/revenue-{chart,csv}.test.tsx` —
`react-i18next` mock now interpolates `{{key}}` placeholders when
the second argument is an object (was previously treating it as a
default-string fallback). Required because these tests render
`PartnerRevenuePage` → `DataTable`, which now uses interpolation for
`Page {{current}} of {{total}}`. Also added a `Trans` stub.

### Verification

Tests: 199/199 Vitest · 0 TS errors · prod build clean · lint:
167 pre-existing errors, no new errors introduced.

### Coverage

Admin section: 76/133 (57%) → 85/133 (64%).

Skipped (no user-facing strings): `page-header.tsx`, `empty-state.tsx`
(both accept all text via props).

Deferred to a follow-up phase: `core/ui/confirm-delete-dialog.tsx` —
shared dialog used by every CRUD delete; needs coordinated update of
all callers and a `common`-namespace keyset.

---

## [1.13.4] — 2026-04-28 — i18n Coverage Phase 3 (analytics + operations)

**Closes the highest-traffic supervisor surfaces.** The wallboard,
digital monitor, and analytics dashboards are the screens supervisors
and managers spend the most time on. Phase 3 extracts hardcoded strings
across the analytics dashboard, agent intervals, CDR transcript, and
operations digital-monitor + wallboard live states.

### Refactored to `useTranslation`

**`src/analytics/`**

- `agents/agent-intervals-page.tsx` — page title (`Agent Intervals`),
  table headers (Agent, Interval, Handled, AHT, Occupancy, RNA,
  Transfers), empty state, loading state.
- `dashboard/overlay-chart.tsx` — `volumeLabel` / `slaLabel` /
  `emptyLabel` props now fall back to translated `dashboard.volume_label`
  / `dashboard.sla_label` / `dashboard.no_data` instead of hardcoded
  English defaults.
- `dashboard/current-interval-card.tsx` — title + 4 metric labels
  (Offered, Answered, SLA, AHT).
- `dashboard/bot-analytics-card.tsx` — card title (`Bot Performance`),
  4 KPI labels, 3 progress-bar tooltip prefixes, 3 legend labels.
- `dashboard/heatmap.tsx` — `dayLabels` prop now defaults to translated
  `dashboard.day_*` keys; `emptyLabel` falls back to `dashboard.no_data`.
- `cdr/synced-transcript.tsx` — speaker badges (Agent / Caller).

**`src/operations/`**

- `monitor/digital-conversation-detail.tsx` — Takeover / Close buttons,
  empty state ("No messages yet"), Coaching Note label + placeholder,
  Takeover dialog title + description, Close dialog title + description.
- `monitor/digital-monitor-tab.tsx` — empty list message, "Select a
  conversation to monitor" instruction.
- `wallboard/wallboard-page.tsx` — empty state, "Live Queue States"
  heading, plus 4 inline labels (Available, On Call, Paused, Wrap-Up)
  on each live-state card.

### Skipped (no user strings)

- `analytics/dashboard/kpi-card.tsx`, `trend-chart.tsx` — pure
  prop-renderers / composition.
- `analytics/cdr/waveform-player.tsx`, `audio-player.tsx` — only
  numeric speed selectors and timer formatting.
- `analytics/qa/score-gauge.tsx` — pure numeric data display.
- `operations/monitor/session-card.tsx` — pure data render.

### Added translation keys

**`analytics.json`** (3 locales):
- `agent_intervals.{title,col_agent,col_interval,col_handled,col_aht,col_occupancy,col_rna,col_transfers,empty}`
- `current_interval.{title,offered,answered,sla,aht}`
- `bot_analytics.{title,conversations,resolution,handoff,avg_turns,resolved_prefix,handed_off_prefix,failed_prefix,resolved_label,handoff_label,failed_label}`
- `transcript.{agent,caller}`

**`operations.json`** (3 locales):
- `monitor.{no_digital_sessions,select_to_monitor,no_messages_yet,takeover,close,coaching_note_label,coaching_note_placeholder,takeover_dialog_title,takeover_dialog_desc,close_dialog_title,close_dialog_desc}`
- `wallboard.{on_call,paused,live_queue_states,empty}`

### Tests

- 199/199 Vitest unchanged · 0 TS errors · 42 test files.

### Coverage check

analytics/ moved from 12/24 (50 %) to **18/24 (75 %)**; operations/
moved from 10/14 (71 %) to **13/14 (93 %)**. The remaining 6 files
across both areas are pure data-display / composition with no user
strings. Repo-wide: **153/267 ≈ 57 %** (was 144/267 ≈ 54 %).
Visibility-weighted gain is again significantly larger because the
wallboard + digital monitor are the supervisor's daily home screens.

---

## [1.13.3] — 2026-04-28 — i18n Coverage Phase 2 (agent workspace)

**Closes the agent workspace gap.** The agent UI is the highest-traffic
surface in production tenants — every conversation touches it. Phase 2
extracts the remaining hardcoded strings so toggling to `en-US` /
`pt-BR` produces a fully-translated experience for the agent role,
including date-fns relative time in the user's locale.

### Refactored to `useTranslation`

**`src/agent/conversation/`**

- `reply-composer.tsx` — `Write your reply…` placeholder, attach-file
  tooltip + aria-label, send tooltip + aria-label, `Ctrl+Enter` shortcut
  hint, attachment remove `aria-label` with `{{name}}` interpolation.
- `canned-responses.tsx` — search placeholder, search hint
  ("Start typing…"), loading state, empty state.
- `message-bubble.tsx` — image `alt` fallback, file fallback, plus
  `formatTimestamp` now uses the active i18next language for
  `date-fns` (was hardcoded `'h:mm a'` / `'MMM d, h:mm a'`; now `'p'` /
  `'PP p'` with the locale).

**`src/agent/inbox/`**

- `new-conversation-dialog.tsx` — title, contact label, search
  placeholder, change button, channel label, initial-message label +
  placeholder, submit button, "Unnamed contact" fallback.
- `inbox-item.tsx` — `formatDistanceToNow` now uses the active
  i18next-resolved `date-fns` locale.
- `agent-status-selector.tsx` — replaced the `label` field on each
  `AGENT_STATUSES` entry with a `labelKey` (`agent_status.*`), so all 8
  states (Available, Busy, Break, Lunch, Training, DND, ACW, Offline)
  translate.

### Skipped (no user strings)

- `message-thread.tsx` — pure composition.
- `system-event.tsx` — message text comes from backend data; only the
  icon is selected client-side.
- `sentiment-gauge.tsx` — speaker / label come from backend AI output.

### Added translation keys (under `agent.json`, all 3 locales)

- `composer.{attach_file,send,send_shortcut,remove_attachment}` (the
  last with `{{name}}` interpolation).
- `messages.{image_alt,file_fallback}`.
- `new_conversation.{title,contact,channel,initial_message,message_placeholder,search_placeholder,change,submit,unnamed_contact}`.
- `agent_status.{available,busy,on_break,lunch,training,dnd,acw,offline}`.
- `canned.{search_hint,loading}` (alongside existing
  `canned.search_placeholder` and `canned.no_results`).

### Tests

- 199/199 Vitest unchanged · 0 TS errors · 42 test files · prod build
  703 ms.

### Coverage check

agent/ moved from 15/24 (62 %) to **21/24 (88 %)**. The remaining 3
files (`message-thread`, `system-event`, `sentiment-gauge`) have no
user-facing strings — only data render and composition — so they are
effectively complete. Combined repo-wide coverage:
**144/267 ≈ 54 %** (was 138/267 ≈ 52 %); visibility-weighted gain is
again significantly larger because the agent workspace is the
highest-frequency surface for active users.

---

## [1.13.2] — 2026-04-28 — i18n Coverage Phase 1 (shell + pages + auth)

**Direct follow-up to 1.13.1.** Closes the highest-visibility part of the
i18n coverage gap documented in
`docs/research/i18n-coverage-gap-2026-04-28.md`. Switching to `en-US` or
`pt-BR` now produces a fully-translated experience across the parts of
the app every user touches on every session: the notification drawer
(seen on every page via the bell badge), the unauthorized error page
(rendered on RBAC failure), the agent workspace shell (visible to every
agent on every conversation), and the impersonation banner (visible to
support staff acting on tenant context).

### Refactored to `useTranslation`

- `src/shell/notification-bell.tsx` — accessible label
  (`notifications.aria_label_with_count` with `count` interpolation).
- `src/shell/notification-drawer.tsx` — sheet title, "Mark all read",
  "Loading…", "No notifications", "Load more", and the 5 category tabs
  (All, Operational, System, Security, Billing) keyed under
  `notifications.category.*`. Replaced the duplicated `CATEGORIES`
  array with a slim `CATEGORY_VALUES` list since labels now come from
  the translation table.
- `src/shell/notification-item.tsx` — `formatDistanceToNow` now uses the
  active i18next language to render `date-fns` relative time in the
  user's locale (e.g., "hace 5 minutos" / "5 minutes ago" /
  "há 5 minutos").
- `src/pages/unauthorized.tsx` — 403 title, description, "Go Home"
  button (`errors.*`).
- `src/pages/agent/agent-layout.tsx` — context-panel toggle `title`
  attribute.
- `src/pages/agent/conversation-view.tsx` — empty-state "Select a
  conversation".
- `src/core/auth/impersonation-banner.tsx` — "Operating as", "Read-Only"
  badge, "End Impersonation" button.

### Added translation keys

Under `common.json` for all 3 locales:

- `notifications.{title,aria_label,aria_label_with_count,mark_all_read,load_more,loading,empty,category.*}`
- `errors.{unauthorized_title,unauthorized_description,go_home}`
- `agent_layout.{toggle_context,select_conversation}`
- `impersonation.{operating_as,read_only,end}`

### Out of scope (still hardcoded — follow-up)

The remaining 8 files in the original Phase-1 list are pure
composition / routing wrappers with no user-visible strings
(`app-shell.tsx`, `rail-icon.tsx` — receives label as prop,
`admin-layout.tsx`, `operations-layout.tsx`, `analytics-layout.tsx`,
`auth-guard.tsx`, `permission-guard.tsx`, `role-guard.tsx`). They are
counted in the coverage gap purely on the `useTranslation` import
heuristic; no functional translation work is needed there.

### Tests

- 199/199 Vitest unchanged · 0 TS errors · 42 test files · prod build
  717 ms. No new test files; existing tests cover the refactored code
  (the `notification-item.test.tsx` already mocks `react-i18next`).

### Coverage check

7 files moved from "hardcoded" to "wired"; 138/267 `.tsx` files
(≈52 %) now use `useTranslation` (was 131/267 ≈ 49 %). The
visibility-weighted improvement is significantly larger than the 3-pp
raw-count gain, because the touched files are present on every page
view (notification bell + impersonation banner) or on the highest-
traffic surface (agent workspace).

---

## [1.13.1] — 2026-04-28 — Language Switcher + i18n Persistence

**First user-facing i18n feature.** Brings the existing translation
infrastructure (15 JSON bundles, 131 components already wired with
`useTranslation`) within reach of end users, who previously had no way
to change away from the default `es-419`.

### Added

- `i18next-browser-languagedetector` integrated into the i18n init
  (`src/core/i18n/i18n.ts`). Detection order: `localStorage` →
  `navigator` → `htmlTag`. Persisted in `localStorage` under the key
  `asterisk.lang`.
- `LanguageSwitcher` component (`src/core/i18n/language-switcher.tsx`)
  with two variants:
  - `icon` — globe icon button (used in unauthenticated screens).
  - `inline` — short-code chip with globe icon (default).
- Login page (`src/core/auth/login-page.tsx`) — language switcher
  pinned to top-right corner so users can pick their language before
  authenticating.
- User menu (`src/shell/user-menu.tsx`) — language sub-menu added next
  to the existing theme sub-menu, with check-mark indicating the active
  language.
- Translation keys for the switcher in all three locales (`common.json`):
  `language.label`, `language.es-419`, `language.en-US`,
  `language.pt-BR`, plus `theme.label` for symmetry with the new sub-menu.
- 6 Vitest unit tests covering: inline/icon variants, default variant,
  unknown-language fallback, prefix-match resolution, and click-to-switch.

### Exported

- `SUPPORTED_LANGUAGES` and `SupportedLanguage` type from
  `@/core/i18n/i18n` so the user menu (and any future consumer) can
  iterate the canonical list without duplication.
- `LANGUAGE_STORAGE_KEY` (`asterisk.lang`) for tooling that needs to
  read or clear the persisted choice.

### Tests

- 199/199 Vitest (was 193/193) · 0 TS errors · 42 test files (was 41).

### Known coverage gap

136 of 267 `.tsx` files (≈51 %) still hold hardcoded strings (default
`es-419`). That gap is now visible — switching to English or Portuguese
will only translate the ≈49 % of components already wired. A follow-up
plan (`docs/research/i18n-coverage-gap-2026-04-28.md`) catalogues the
gap by domain so subsequent work can extract strings incrementally
without blocking this slice.

---

## [1.13.0] — 2026-04-27 — Track Platform 1.14.0 "AHH Auth Hotpath Hardening"

**Cosmetic version bump only — no source change.** Coordinated with the
Platform-side AHH (Auth Hotpath Hardening) train shipped 2026-04-27 as
`Asterisk.Platform 1.14.0`. AHH lifts the `POST /auth/login` knee from
~75 req/s → ~220 req/s single-replica (~880 req/s 4-replica aggregate
projected) via:

1. Hot-read caching (`CachedTenantAuthConfigStore` + `CachedUserStore`)
   with cross-replica Redis pubsub invalidation.
2. Write-path deferral via `AuthWriteQueue` (`LastLoginAt`, lockout
   reset, success-path `AuthEvent` move off the request critical path;
   failure-path audit logging stays synchronous).
3. JWT rotation pool wire-up + RS256-aware `JwtKeyEntry` schema +
   `RedisJwtKeyStore` CAS upsert + multi-replica startup gate.
4. Argon2id password migration (OWASP-2025 floor m=19 MiB, t=2, p=1)
   with on-login transparent rehash from legacy BCrypt12.
5. Horizontal scaling baseline + operations runbook + 5 ADRs (0010-0014).

The login API contract is unchanged — token shape, refresh-token
semantics, MFA challenge flow, lockout responses all preserve verbatim
behavior. The Web UI is byte-identical to 1.12.0 builds; only `package.json`
moves to keep the version-track convention with the Platform release.

### Changed

- **Bump to track Platform 1.14.0:** `package.json` version 1.12.0 → 1.13.0.

### Tests

- 193/193 Vitest unchanged · 0 TS errors · 41 test files.

---

## [1.12.0] — 2026-04-26 — R5.4 "Production Validation"

**Final release of the R5 Production Readiness Release Train.** Coordinated
ship with **Pro 1.15.0-pro** + **Platform 1.13.0**. No frontend feature
changes — Web 1.12.0 bump is exclusively to track the Platform 1.13.0
contract (Pro NU1902 fix + JWT rotation infrastructure + suspend reason
payload + IAgentTenantResolver required-by-default).

### Changed

- **Bump to track Platform 1.13.0:** `package.json` version 1.11.0 → 1.12.0.

### Tests

- 193/193 Vitest unchanged · 0 TS errors · 41 test files.

### R5 train acceptance

R5.1 (1.9.0) + R5.2 (1.10.0) + R5.3 (1.11.0) + R5.4 (1.12.0) — **R5 Production
Readiness Release Train COMPLETE**. R4 Track A previously declared COMPLETE
in R5.3.
