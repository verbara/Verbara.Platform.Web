---
date: 2026-05-03
track: v1.15.0 — Track 2A Test coverage tracking
status: snapshot
---

# Coverage baseline — v1.15.0 (Track 2A)

First measurement of test coverage after introducing `@vitest/coverage-v8` in
[`vitest.config.ts`](../../vitest.config.ts). Captured on 2026-05-03 with
**205/205 Vitest specs passing**.

## Aggregate

| Metric         | Coverage                   |
| -------------- | -------------------------- |
| **Lines**      | **12.92%** (1 159 / 8 970) |
| **Statements** | 12.46% (1 226 / 9 834)     |
| **Branches**   | 13.82% (818 / 5 916)       |
| **Functions**  | 10.86% (455 / 4 188)       |

## Why the baseline is low

The 205 unit tests were written reactively against bug fixes and feature work
during v1.0..v1.13 — they never targeted breadth. They cover:

- `src/core/i18n` (73.68% lines) — `useFormatDate` / `useFormatNumber` were
  the most recent track work and have direct unit coverage.
- `src/core/security/mfa` (72.34% lines) — TOTP enroll wizard was the only
  area with explicit unit tests.
- `src/admin/license` (84.48% lines) — license-key validators tested in
  isolation.
- `src/admin/shared` (58.49%), `src/agent/stores` (52.72%),
  `src/analytics/qa` (54.12%) — partial coverage from Zustand store tests
  and a handful of widget tests.

Everything else (most pages, all hooks in `src/core/api/hooks/**`, all stores
outside `agent/stores`, all UI components beyond the core primitives, the
shell, the operations wallboard, the agent inbox) sits at **0%**.

## Threshold strategy — ratchet floor, not 70%

The roadmap acceptance for Track 2A reads _"threshold inicial 70% líneas.
Sube a 80% en Track 2C"_. The 70% number is **aspirational** — it assumes
Track 2C (API hooks coverage with MSW + 50+ hooks) has already lifted the
baseline, which is what allows the lift to 80% afterwards.

Setting `lines: 70` on day 1 against a 12.92% baseline would fail CI on
every commit. Instead, this track installs the **tooling** and a **ratchet
floor** at the current baseline so a regression breaks CI but cleanup work
is not blocked. Same shape as the `lint (non-blocking)` job from Track 1C.

Configured thresholds (slightly below baseline so flakey numbers are not
false-positive failures):

| Metric     | Floor | Baseline |
| ---------- | ----- | -------- |
| Lines      | 12    | 12.92    |
| Statements | 12    | 12.46    |
| Branches   | 13    | 13.82    |
| Functions  | 10    | 10.86    |

The progressive lift schedule:

| Track | Version  | Expected impact                                                                 | Floor after track     |
| ----- | -------- | ------------------------------------------------------------------------------- | --------------------- |
| 2A    | 1.15.0   | tooling + baseline (this)                                                       | 12% lines             |
| 2C    | 1.15.5   | MSW + 50+ API hooks tested                                                      | ~50% lines (estimate) |
| 3A    | 1.16.0   | barrel-export refactor — neutral on coverage but lifts measured branch coverage | ~52%                  |
| later | 1.16.x → | UI primitive coverage, page snapshots                                           | progressive           |

70% lines is the v1.20.x target, not the v1.15.0 target.

> **Current state:** this document is the Track 2A point-in-time snapshot (2026-05-03). The
> ratchet floor has since moved with later tracks; as of this writing `vitest.config.ts` enforces
> **29% lines** (see the `coverage.thresholds` block), not the 12% floor set here.

## Highest-value gaps to attack first (Track 2C input)

Ordered by `(LOC × business criticality) ÷ current coverage`:

1. **`src/core/api/hooks/**`** — 54 hooks at ~16% coverage. These wrap
   every backend call; bugs here are user-facing in every screen. MSW-based
   tests would lift this to 80%+ and contribute the largest single delta to
   the global ratchet. **Target: 80% lines (matches Track 2C acceptance).\*\*
2. **`src/core/auth`** — 6.49% lines. Auth/JWT refresh logic. Bugs are
   silent and high-blast-radius (logged-out users mid-session, leaking
   tenant headers). Target: 70%+.
3. **`src/core/api/client.ts`** — `customFetch` is the single chokepoint
   for all API traffic. Already partially covered by hook tests but
   deserves direct branch tests for the 401 refresh path. Target: 90%+.
4. **`src/core/stores`** — 0% on `tenant-store`, `notification-store`,
   `ui-store`, `permissions-store`. Pure Zustand stores — cheap to test
   (`act` + selector assertions). Target: 80%+.
5. **`src/operations/stores`** — 6.89% lines. Real-time metrics stores
   driven by SignalR. Target: 70% with mocked hub.

Pages and shell components are deliberately **not** prioritised — they
compose hooks and primitives and benefit more from E2E (Playwright) than
from Vitest.

## What this baseline does NOT include

- **E2E coverage** — 64 Playwright specs run separately and do not
  contribute to V8 coverage. They cover golden paths across login, MFA,
  admin CRUD, agent conversation, analytics dashboards.
- **Type-level coverage** — TypeScript strict-mode + `tsc -b` already
  catches a large class of errors that runtime coverage cannot.
- **i18n parity** — separate gate from `npm run i18n:check`.

## How to read the report

```sh
npm run test:coverage
# Text summary in stdout
# HTML report in ./coverage/index.html
# JSON summary in ./coverage/coverage-summary.json
# LCOV in ./coverage/lcov.info (consumed by Codecov / GitHub badge)
```

The `coverage/` directory is gitignored. CI uploads `coverage/` as an
artifact for inspection; future tracks will wire Codecov for PR comments.
