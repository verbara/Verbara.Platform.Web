# i18n Coverage Gap — 2026-04-28

## Context

`v1.13.1` shipped the language switcher and persistence layer, making
the existing `i18next` infrastructure user-reachable for the first time.
Before this slice, the app was effectively single-language (`es-419`)
even though all the wiring (i18n init, three locale bundles, 131
`useTranslation()` consumers) was already in place.

## Why this document

Switching language now works end-to-end, but only ≈49 % of `.tsx`
components actually consume translations — the rest still hold
hardcoded strings (mostly Spanish, occasionally English). This means
toggling to `en-US` or `pt-BR` will produce a partially-translated UI.

This document catalogues the gap so follow-up plans can extract the
remaining hardcoded strings incrementally without blocking the v1.13.1
ship.

## Coverage by domain

Numbers from `find src/<dir> -name '*.tsx' | xargs grep -l 'useTranslation'`
on 2026-04-28.

| Domain | Total .tsx | With i18n | Gap | Coverage | Priority |
|---|---:|---:|---:|---:|---|
| `src/core/ui/` | 28 | 5 | **23** | 17 % | LOW (mostly primitives, few user strings) |
| `src/pages/` | 6 | 0 | **6** | 0 % | MEDIUM (layout shells — small surface, high visibility) |
| `src/shell/` | 9 | 3 | **6** | 33 % | HIGH (rail nav, command palette, notification bell — visible everywhere) |
| `src/core/auth/` | 8 | 4 | **4** | 50 % | HIGH (auth surfaces include `permission-guard`, `role-guard` error UIs, `impersonation-banner`) |
| `src/admin/` | 133 | 76 | **57** | 57 % | MEDIUM (long tail — many low-traffic admin pages) |
| `src/agent/` | 24 | 15 | **9** | 62 % | HIGH (agent workspace is highest-traffic UI) |
| `src/analytics/` | 24 | 12 | **12** | 50 % | MEDIUM |
| `src/operations/` | 14 | 10 | **4** | 71 % | LOW (mostly real-time monitoring, near-complete) |
| **Total** | **267** | **131** | **136** | **49 %** | |

## Recommended extraction order

Order by **visibility × user-impact ÷ effort**:

1. **`src/shell/` (6 files)** — every authenticated user sees the shell
   on every page. Highest-leverage extraction. Estimated 1–2 days.
2. **`src/pages/` (6 files)** — layout shells; low file count, but each
   one is a top-level route. Often tiny strings ("Loading…", error
   states). Estimated half a day.
3. **`src/agent/` remaining 9 files** — agent workspace is the
   highest-traffic surface in production tenants. Already 62 % covered;
   closing the gap here is the single biggest jump in user-perceived
   completeness. Estimated 1 day.
4. **`src/core/auth/` remaining 4 files** — `permission-guard`,
   `role-guard`, `impersonation-banner`, `auth-guard`. Tiny strings but
   user-blocking when shown. Estimated half a day.
5. **`src/analytics/` 12 files** + **`src/operations/` 4 files** —
   reporting and monitoring. Estimated 1–2 days combined.
6. **`src/admin/` 57 files** — long tail. Extract per-domain (queues,
   campaigns, users, …) as those domains get touched for other work,
   to avoid a large mechanical pass. Estimated 3–5 days if done as a
   batch, or amortised over normal feature work.
7. **`src/core/ui/` 23 files** — most are presentation primitives
   (`button`, `dialog`, `input`, `tabs`, …) without user-facing strings;
   audit first to confirm which actually need extraction. Estimated
   half a day for the audit, then surgical edits.

## Hardcoded-string detection technique

For each file in the gap list, look for:

```regex
>[A-Z][a-záéíóúñ ]{2,}<       — JSX text content
placeholder="..."             — input placeholders
title="..." aria-label="..."  — accessibility text
toast.error("...")            — toast messages
throw new Error("...")        — user-facing error throws
```

Mechanical sweeps with `rg` work well; the harder cases are:

- Dynamically-built strings (`` `${count} items` ``) → use i18next
  interpolation (`t('items.count', { count })`).
- Conditional strings via boolean (`active ? 'On' : 'Off'`) → extract
  both branches as keys.
- Pluralization → use i18next's plural suffix (`_one`, `_other`).

## Translation budget

Bundle sizes today (per-language):

```
admin.json       40 KB   ← largest, expected to grow ≈ +30 KB
common.json       8 KB   ← steady; may grow modestly with shell/pages
agent.json        4 KB   ← expected to grow ≈ +5 KB
operations.json   4 KB   ← expected to grow ≈ +2 KB
analytics.json    8 KB   ← expected to grow ≈ +6 KB
```

Fully extracting the remaining 136 files should add ~40–50 KB per
locale, putting the per-locale total at ~120 KB and overall locale
payload at ~360 KB. Loaded lazily by namespace via `i18next-http-backend`,
so initial `common` payload stays small.

## Out of scope for this slice

Explicitly *not* tackled in v1.13.1:

- **Date/number/currency localisation audit.** `useFormatDate` and
  `useFormatNumber` exist but consumer audit is incomplete; some places
  still call `toLocaleString()` directly.
- **Right-to-left language support.** No RTL languages on the supported
  list yet; layout has not been verified for `dir="rtl"`.
- **Tenant-level language preference.** Per-user-per-tenant default
  language is not stored server-side; the current localStorage key is
  per-browser-per-origin.
- **Translation QA pipeline.** No automated check for missing keys
  across locales (e.g., a key present in `es-419/common.json` but
  absent in `en-US/common.json` will fall back silently).

These deserve their own follow-up plan once the extraction phase makes
significant progress on coverage.

## Acceptance criteria for "i18n complete"

- All `.tsx` files in `src/shell/`, `src/pages/`, `src/agent/`,
  `src/core/auth/`, `src/operations/`, `src/analytics/` use
  `useTranslation` for any user-visible string.
- A CI lint rule (or pre-commit hook) blocks new hardcoded JSX text in
  those directories.
- Locale bundle parity check: every key present in `es-419/*.json`
  exists in `en-US/*.json` and `pt-BR/*.json` (and vice versa).
- All three locales rendered visually on every top-level route during
  manual QA — recorded as a Playwright smoke spec.
- `src/core/ui/` and `src/admin/` extraction is opportunistic
  (per-feature) rather than a big-bang sweep, given the long tail.

## Status updates

**2026-05-03 — `1.13.33` (Phase 1 of v1.13.x closure plan):**
Locale bundle parity check ✅ enforced via `scripts/i18n-parity-check.mjs`,
wired to `npm run lint`. Patched `admin.json` for the 16 missing
`sidebar.*` keys in `en-US`/`pt-BR` plus `security_admin.audit.export.pending`
parity (`es-419`/`pt-BR`).
