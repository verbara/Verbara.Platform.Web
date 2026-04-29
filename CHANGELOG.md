# Changelog

All notable changes to **Asterisk.Platform.Web** are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) ·
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

_No unreleased changes._

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
