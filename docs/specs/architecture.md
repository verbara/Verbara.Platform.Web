# Architecture — Verbara.Platform.Web

> The React 19 UI of the Verbara omnichannel contact center. **Decoupled** leaf of the
> `Verbara.Sdk → Verbara.Sdk.Pro → Verbara.Platform ← Verbara.Platform.Web` chain — it links
> to Platform only over the HTTP DTO contract, never a compile-time dependency. **Public**,
> Apache-2.0. This document is the repo's charter prose (verbara-meta/ADR-0014 §1); the
> machine-checkable gate manifest lives beside it in [`gates.yaml`](../../gates.yaml).

## 1. Role & boundaries

Verbara.Platform.Web renders four product modules over the Platform API: **Admin** (configuration),
**Operations** (real-time monitoring), **Analytics** (historical reporting) and the **Agent**
workspace. The product is **API-first**: the Platform API owns all behavior specs; this repo is a
pure consumer that renders them.

What it owns:

- Presentation, client-side routing/guards, and client state for the four modules.
- The typed API client generated from Platform's OpenAPI (`src/core/api/generated/`).
- Its own Docker image (nginx serving a static bundle) and the webchat embed/SDK builds.

What it must **not** reach into:

- No compile-time coupling to Platform, Sdk, or Pro — the boundary is the HTTP DTO contract only.
  Web is `coupling: http-contract` in `build-chain.yaml`, not a NuGet consumer.
- **Behavior specs for Web live in Platform's `openspec/`** (the API is the hub). This repo's
  own `openspec/` carries only Web-local UI/UX changes; anything that changes API behavior is
  authored in Platform first, then consumed here.
- No company-specific references in code — the product ships generic.

## 2. Architecture style

A **feature-module SPA**: four peer domain folders under `src/` — `admin/`, `agent/`, `analytics/`,
`operations/` — plus a shared core:

- `src/core/` — the shared substrate: `api/` (the `customFetch` client + one TanStack Query hook
  per domain + the generated OpenAPI types), `auth/` (guards, permissions, auth-store), `session/`
  - `presence/` (idle-timeout, refresh, heartbeat, departure beacon — ADR-0009), `stores/`,
    `tenant/`, `ui/` (shadcn/@base-ui components), `i18n/`.
- `src/shell/` — app shell, rail nav, command palette, notifications, user menu.
- `src/pages/` — the four lazy-loaded layout shells; `src/router.tsx` wires routes.
- Separate build targets: the main app (`vite build`) plus `build:webchat-sdk` and
  `build:webchat-embed` (`vite.webchat-*.config.ts`) for the embeddable webchat widget.

Ships as a **static nginx-served Docker image** (multi-arch amd64+arm64, `:latest` + pinned
`vX.Y.Z-web` tag, cosign-signed by manifest digest). Because it is a static asset bundle — not a
binary that consumes Pro IP — it carries **no AOT / IL-split obligation and no authorized-digests
binding**; cosign signature verification is the whole supply-chain story on the image (contrast
Platform.Api, which is Native AOT precisely to keep Pro IP out of decompilable IL).

## 3. Design principles (as actually practiced here)

- **API-first, generated over hand-rolled.** `npm run generate:api-types` (openapi-typescript)
  emits DTOs into `src/core/api/generated/openapi.d.ts`; a lint gate
  (`check-generated-types-adoption.mjs`) freezes the not-yet-migrated hooks as a baseline that
  only shrinks, so no new hook may hand-maintain a DTO the server contract already defines. Drift
  from the server is a build failure, not a runtime surprise.
- **One responsibility per hook, one client per stack.** All authenticated data access goes through
  `customFetch<T>()` in `src/core/api/client.ts` (JWT auto-refresh + `X-Tenant-Id` injection);
  never raw `fetch`. Each domain gets exactly one TanStack Query hook with stable query-key arrays;
  server state lives in TanStack Query, cross-component client state in Zustand stores — the two
  never overlap.
- **Domain isolation over convenience imports.** `admin / agent / analytics / operations` are peers
  that must not import each other; shared primitives move down into `@/core`. Enforced, not
  aspirational — see §5.
- **Guard, don't trust the role.** `AuthGuard` checks the access token; `PermissionGuard` checks the
  `permissions[]` array (`domain:resource:action`) — holding the Admin role alone is never enough,
  the specific permission must be present. Every route is lazy (`React.lazy()` + `<Suspense>`) and
  wrapped in the correct guard.
- **`render`, not `asChild`.** shadcn v4 sits on `@base-ui/react` (**NOT Radix**); composition uses
  the `render` prop (`<Dialog.Trigger render={<Button />} />`). `asChild` silently breaks — the
  single most common trap in this codebase.
- **Tokens over ad-hoc styling.** TailwindCSS v4 only (CSS-first `@theme`, no `tailwind.config`, no
  CSS modules, no styled-components, no ad-hoc hex). Forms are React Hook Form + Zod.
- **Locale-complete or it doesn't ship.** Every user-facing string exists in EN-US, ES-419, PT-BR
  at the same key; a string added to one locale and not the others fails CI.

## 4. Constraints & banned dependencies

- **No Radix UI.** shadcn v4 is on `@base-ui/react`; Radix's `asChild` API is banned by convention
  (use `render`). Dependabot even groups `@base-ui/react` with any stray `@radix-ui/*` so a
  reintroduction is visible.
- **TypeScript strict, maximal.** `tsconfig.app.json` sets `strict`, `noUncheckedIndexedAccess`,
  `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`.
  `npm run build` = `tsc -b && vite build` — a type error is a broken build.
- **ESLint is the "warnings-as-errors" analog.** JS has no compiler TWAE switch, so blocking ESLint
  (0 errors, `jsx-a11y` recommended at error level, `no-unused-vars` at error) plays that role.
- **No cross-domain imports.** `no-restricted-imports` forbids `@/admin ↔ @/agent ↔ @/analytics ↔
@/operations` (ADR-0012 gate #4).
- **No god-components.** `max-lines: 1250` (generated types + tests exempt; ratchets down as large
  files are split).
- **No NuGet coupling.** Web links to Platform only over HTTP — the Native-AOT / no-Dapper mandate
  (verbara-meta/ADR-0022) governs the .NET repos, not this one; Web's parallel obligation is
  keeping DTOs generated-not-guessed (§3) and the bundle within budget (§5).
- **AOT/IL split is N/A here.** The 4-image AOT/IL posture applies to Platform.Api (Pro IP must not
  ship as decompilable IL). Web is a static bundle — its ship-shape invariant is _bundle size +
  signed image_, not AOT.

## 5. The Gate Contract

This is the heart: each invariant above maps to a concrete gate that **fails the build**. Machine
form + status in [`gates.yaml`](../../gates.yaml); it is cross-checked by verbara-meta `/xr:doctor`.
Branch protection on `main` requires: **build, test, coverage, i18n, audit, lint, openspec**
(all run on `pull_request` **and** `merge_group`).

| #   | Invariant (principle)                                     | Gate that enforces it                                                                         | CI job / script                                                                                                                                    |
| --- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | Compiles + type-checks clean; tests pass                  | `tsc -b && vite build`; `vitest run`                                                          | `build`, `test` jobs (`.github/workflows/ci.yml`)                                                                                                  |
| G2  | No lint errors; a11y; layering; file-size; no Radix drift | Blocking ESLint (0 errors) — the JS "TWAE"                                                    | `lint` job → `npx eslint .` (`eslint.config.js`)                                                                                                   |
| G3  | Coverage can't silently regress                           | ADR-0013 triplet: patch-coverage + two-sided band + exclusion baseline                        | `coverage` job → `check-patch-coverage.py`, `check-coverage-floor.py`, `check-exclusion-baseline.py`; guards self-tested by `coverage-scripts` job |
| G4  | Domain modules stay isolated                              | ESLint `no-restricted-imports` (admin/agent/analytics/operations)                             | `lint` job (`domainIsolation` in `eslint.config.js`)                                                                                               |
| G5  | i18n parity + generated-types adoption                    | `i18n-parity-check.mjs` (EN-US/ES-419/PT-BR) + `check-generated-types-adoption.mjs`           | `i18n` job + `lint` job (`npm run lint:generated-types`)                                                                                           |
| G6  | Bundle stays within budget                                | `size-limit` (brotli app JS ≤ 1.45 MB, ratchets down)                                         | `build` job → `npm run size` (`.size-limit.json`)                                                                                                  |
| G7  | Ship-shape image is signed                                | Docker multi-arch build + cosign sign+verify — **release-time only** (no PR-time image probe) | `release` job on `v*` tag (`.github/workflows/release.yml`) — _partial vs the class_                                                               |
| G8  | No known-vuln dependencies                                | `npm audit --audit-level=high` (blocking) + Dependabot + CodeQL SAST                          | `audit` job + `.github/dependabot.yml` + `.github/workflows/codeql.yml`                                                                            |

Plus a non-gate-class required check: **openspec** (`openspec validate --all --strict`) validates
the agent-edited spec/change markdown like code.

**G7 is deliberately partial.** ADR-0014's G7 reference is a _PR-time_ publish probe (Platform's
`aot-probe`). Web has no PR-time image build; its ship-shape invariant (a multi-arch image, cosign
signed + verified against the committed `.github/cosign.pub`) is validated only at release, on a
`v*` tag push. This is correct for a static bundle — there is no per-arch AOT publish to prove
green at PR time — but it means an image-build regression surfaces at release, not on the PR.

## 6. Testing conventions

- **Unit — Vitest + Testing Library.** `npm run test` (`vitest run`; excludes `tests/**`, which
  holds Playwright specs). Co-located `src/**/*.test.{ts,tsx}`. Coverage via
  `@vitest/coverage-v8`; `vitest.config.ts` thresholds (lines 29 / functions 31 / branches 16 /
  statements 27) are a fast-fail liveness backstop _under_ the ADR-0013 ratchet (G3).
- **E2E — Playwright.** `tests/e2e/**` against a running demo backend. Selector discipline is
  non-negotiable: **`data-*` attributes only** (locale-proof) — never `toContainText` on
  dynamic/localized text; shadcn `Select` exposes `role=option` (use it, not `selectOption()`);
  `ConfirmDeleteDialog` has a 3s destructive-action countdown (wait it out); always
  `data-table-search.fill(id)` before clicking a freshly created row.
- **Guard self-tests.** The three coverage-gate scripts are themselves unit-tested
  (`scripts/tests/`, run by the `coverage-scripts` CI job) — a gate must be proven live, not
  assumed.
- **Accessibility + perf.** `@axe-core/playwright` in E2E; Lighthouse budgets in
  `.github/workflows/lighthouse.yml` (`.lighthouserc.json`).

## 7. Where decisions live

- **Repo ADRs** — `docs/decisions/` (append-only; catalog in its `README.md`). Load-bearing here:
  ADR-0001 (i18n parity gate), ADR-0002 (per-area error boundaries), ADR-0005 (track-end
  versioning — patches ship untagged, only the last patch of a track gets `vX.Y.Z-web` + a GH
  release), ADR-0006 (Apache-2.0 + commercial tiers), ADR-0009 (agent presence / session
  continuity).
- **Cross-repo standards** — the private **verbara-meta** repo: ADR-0014 (this charter's authority
  - the gate-class contract), ADR-0012/0013 (the gate catalog + coverage-gate-v2), ADR-0002
    (context hygiene), ADR-0003 (CI-gating baseline), ADR-0011 (model dispatch).
- **Path-scoped dev rules** — `.claude/rules/*.md` load on demand when you touch matching files
  (ui, api-layer, state, auth, routing, i18n, docker).
- **Expert agent** — `.claude/agents/platform-web-expert.md` encodes the stack, the `@base-ui`
  `render` trap, the guards, and the E2E selector rules for AI-assisted work.
