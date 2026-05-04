---
date: 2026-05-03
track: v1.15.1 — Track 2B Performance budget + bundle consolidation
status: snapshot
---

# Bundle baseline — v1.15.1 (Track 2B)

First measurement of bundle composition after introducing
`build.rolldownOptions.output.codeSplitting.groups` in
[`vite.config.ts`](../../vite.config.ts).

## Pre-split (v1.15.0 baseline)

The default Rolldown chunking strategy bundled almost everything into two
giant files: `index.js` (the entry shell) absorbed all shared dependencies,
and `cdr-page.js` absorbed ag-grid + recharts because the CDR page was the
first lazy chunk to import them.

| Chunk               | Raw             | Gzip      | What it contained                                        |
| ------------------- | --------------- | --------- | -------------------------------------------------------- |
| `cdr-page.js`       | **1 113.94 kB** | 312.44 kB | ag-grid + recharts + page code                           |
| `index.js`          | **811.88 kB**   | 248.91 kB | shell + react + tanstack + sentry + i18n + ui primitives |
| `CartesianChart.js` | 310.18 kB       | 91.62 kB  | recharts internal split                                  |
| `flow-designer.js`  | 177.05 kB       | 50 kB     | xyflow only (already pulled out by Vite)                 |

Two chunks crossed the 500 kB warning threshold. The shell bundle (loaded
on every page) carried ~250 kB gzip — meaning every visit, even to
`/login`, had to download Sentry + TanStack + i18n + the entire UI
component library before rendering anything.

## Post-split (this track)

Vendor chunks are pulled out by regex against `node_modules` paths and
shared across all consumer pages (lazy-loaded entry points). The shell
bundle now carries only the routing/auth/error-boundary glue, so a cold
visit to `/login` downloads `index` + `vendor-react` + `vendor-ui` +
`vendor-form` (~840 kB raw / ~250 kB gzip) — but these are **cached** on
every subsequent navigation and shared across the whole app.

| Chunk                                                           | Raw             | Gzip         | Cached?                                |
| --------------------------------------------------------------- | --------------- | ------------ | -------------------------------------- |
| `vendor-grid.js` (ag-grid-community)                            | **1 092.22 kB** | 306.50 kB    | ✅ lazy, only on cdr-page + users-page |
| `vendor-charts.js` (recharts)                                   | 400.55 kB       | 114.10 kB    | ✅ lazy, only on analytics pages       |
| `vendor-ui.js` (@base-ui + lucide + cva + clsx + cmdk + sonner) | 339.99 kB       | 109.04 kB    | ✅ shared on every page                |
| `vendor-react.js` (react + react-dom + react-router)            | 283.53 kB       | 90.07 kB     | ✅ shared on every page                |
| `vendor-flow.js` (@xyflow/react)                                | 163.44 kB       | 51.67 kB     | ✅ lazy, only on flow-designer         |
| `index.js` (shell only)                                         | **114.28 kB**   | **29.35 kB** | ✅ shared on every page                |
| `vendor-form.js` (react-hook-form + @hookform + zod)            | 101.88 kB       | 32 kB        | ✅ on every form page                  |
| `vendor-tanstack.js` (@tanstack/react-query + react-table)      | 87.85 kB        | 25 kB        | ✅ shared                              |
| `vendor-i18n.js` (i18next + react-i18next + detectors)          | 75.78 kB        | 22 kB        | ✅ shared                              |
| `vendor-realtime.js` (@microsoft/signalr)                       | 54.93 kB        | 17 kB        | ✅ lazy on agent + operations          |
| `vendor-sentry.js` (@sentry/react)                              | ~50 kB          | ~16 kB       | ✅ shared (only when DSN set)          |
| `vendor-dnd.js` (@dnd-kit/\*)                                   | 44.30 kB        | 14 kB        | ✅ lazy, only on sortable pages        |
| `vendor-media.js` (wavesurfer + @wavesurfer/react)              | 39.28 kB        | 12 kB        | ✅ lazy, only on QA + recordings       |
| `vendor-date.js` (date-fns)                                     | 36.23 kB        | 12 kB        | ✅ shared                              |
| `cdr-page.js` (page code only)                                  | **21.44 kB**    | 6.13 kB      | lazy                                   |

## Headline deltas

| Metric                  | Pre         | Post          | Δ        |
| ----------------------- | ----------- | ------------- | -------- |
| Shell `index.js` raw    | 811.88 kB   | 114.28 kB     | **–86%** |
| Shell `index.js` gzip   | 248.91 kB   | 29.35 kB      | **–88%** |
| `cdr-page.js` raw       | 1 113.94 kB | 21.44 kB      | **–98%** |
| Chunks > 500 kB warning | 2           | 1 (justified) | —        |

**The 86% drop in shell size is the headline win.** Every cold visit
(to any route) now pays 29 kB gzip for the shell instead of 249 kB. The
remaining vendor bundles only load on routes that actually use them, and
they cache forever (vendor chunks have content-hashed filenames, so they
revalidate only when their internals change).

## Acceptance per Track 2B spec

| Acceptance criterion                                                                              | Status                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `manualChunks` (now `codeSplitting.groups`) split into vendor-react / charts / grid / flow / i18n | ✅ + 8 more vendor groups (tanstack, sentry, form, ui, date, media, dnd, realtime)                                                                                                                                                                                                                                                                           |
| `web-vitals` package + beacon to Sentry for LCP/INP/CLS                                           | ✅ — see [`src/core/observability/web-vitals.ts`](../../src/core/observability/web-vitals.ts)                                                                                                                                                                                                                                                                |
| Lighthouse CI in `.github/workflows/lighthouse.yml` (PR comments)                                 | ✅ — opt-in via `lighthouse` PR label, non-blocking                                                                                                                                                                                                                                                                                                          |
| Documenting baseline in `docs/research/bundle-baseline-2026-05-XX.md`                             | ✅ — this file                                                                                                                                                                                                                                                                                                                                               |
| **No chunk > 500 kB except justified**                                                            | ⚠️ vendor-grid is 1 092 kB raw / 306 kB gzip. Justified: ag-grid-community is a single monolithic library; lazy-loaded so it does not affect first paint. `chunkSizeWarningLimit` bumped to 1 200 kB with comment. Splitting ag-grid further is a consumer-level refactor (pull rarely-used grid features into separate dynamic imports) tracked separately. |
| **LCP < 2.5s on 3G profile**                                                                      | ⏳ measurable only after Lighthouse CI runs against a real PR, or in production via web-vitals → Sentry. Acceptance flips to PASS once first run lands ≤ 2.5s on the login page.                                                                                                                                                                             |

## Web Vitals integration

`src/core/observability/web-vitals.ts` subscribes to `onCLS`, `onFCP`,
`onINP`, `onLCP`, `onTTFB` from the `web-vitals` package and forwards
them to Sentry in two ways:

- **Every metric** → breadcrumb (level scaled by rating: `good=info`,
  `needs-improvement=warning`, `poor=error`). Visible in the Sentry
  event timeline, no quota cost.
- **`poor` rated metrics only** → captured as a Sentry message with
  tags `web-vital`, `rating`, `nav_type`. This surfaces real-user
  performance regressions in the Sentry Issues feed without spamming.

Initialised from `main.tsx` after `initSentry()`. No-op when the Sentry
DSN is not configured (gated by `isSentryInitialized()`), so dev mode
incurs zero overhead.

The thresholds for `good / needs-improvement / poor` come from
web-vitals' own ratings (aligned with Google Core Web Vitals
recommendations as of 2026): LCP ≤ 2.5s good, ≤ 4.0s needs improvement;
INP ≤ 200ms good, ≤ 500ms needs improvement; CLS ≤ 0.1 good, ≤ 0.25
needs improvement.

## Deferred

- **Manual ag-grid lazy splitting**: pull individual grid features
  (charts module, master-detail module, etc.) behind dynamic imports
  instead of loading the whole `ag-grid-community` chunk. Would lift
  `vendor-grid` from 1 092 kB to ~600 kB. Tracked for a later track.
- **Brotli pre-compression**: currently shipping gzip-only. Brotli would
  shave another ~15% off transfer sizes. Tracked for the
  hosting/deployment track (Nivel 5+).
- **Lighthouse blocking gate**: workflow runs with
  `continue-on-error: true` and is opt-in via `lighthouse` label. Flips
  to blocking when Track 4+ defines hard performance budgets.
