# Verbara Web

> Frontend for the **Verbara** open-core contact-center platform.
> Repository name (`Asterisk.Platform.Web`) is transitional — the project is rebranding to **Verbara** ([ADR-0006](docs/decisions/0006-license-and-commercial-tier-strategy.md)). Repo rename to `verbara-web` will happen after Track 1A ships.

React 19 frontend for the Verbara omnichannel contact-center platform. Admin configuration, real-time operations monitoring, historical analytics, and an agent workspace.

**Version:** 1.15.1 — see [`CLAUDE.md`](CLAUDE.md) for the project overview and conventions.

## Stack

| Library                   | Version                                       |
| ------------------------- | --------------------------------------------- |
| React                     | 19.2.x                                        |
| TypeScript                | 5.9.x (strict mode)                           |
| Vite                      | 8.0.x                                         |
| TailwindCSS               | 4.2.x (`@tailwindcss/vite`)                   |
| shadcn/ui                 | 4.1.x — uses **`@base-ui/react`** (NOT Radix) |
| TanStack Query            | 5.95.x                                        |
| TanStack Table            | 8.21.x                                        |
| React Router              | 7.13.x                                        |
| Zustand                   | 5.0.x                                         |
| React Hook Form + Zod     | 7.72.x / 4.3.x                                |
| Recharts                  | 3.8.x                                         |
| AG Grid                   | 35.1.x                                        |
| XY Flow (`@xyflow/react`) | 12.10.x                                       |
| Lucide React              | 0.577.x                                       |
| i18next                   | 25.10.x — locales: `es-419`, `en-US`, `pt-BR` |
| date-fns                  | 4.1.x                                         |
| Vitest + Testing Library  | 4.1.x / 16.3.x                                |
| Node (Docker base)        | 22-alpine                                     |

## Setup

```sh
# Clone + install
git clone git@github.com:Harol-Reina/Asterisk.Platform.Web.git
cd Asterisk.Platform.Web
npm install

# Run dev server (proxies /api/v1 → http://localhost:5000)
npm run dev

# Run unit tests
npm run test

# Run lint (ESLint + i18n parity check — required to pass before merge)
npm run lint

# Build for production (TypeScript check + Vite build)
npm run build

# Run E2E tests (requires demo backend running on :5000)
npx playwright test -c tests/e2e/playwright.config.ts
```

The dev server expects the Platform backend running on `localhost:5000`. See the [Asterisk.Platform repo](https://github.com/Harol-Reina/Asterisk.Platform) for backend setup. A demo docker-compose is documented in the Platform repo.

## Available scripts

| Script                  | What it does                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`           | Vite dev server with HMR                                                                                                |
| `npm run build`         | Production build (`tsc -b && vite build`)                                                                               |
| `npm run preview`       | Preview the production build locally                                                                                    |
| `npm run test`          | Run unit tests (Vitest, excludes `tests/e2e/**`)                                                                        |
| `npm run test:watch`    | Vitest in watch mode                                                                                                    |
| `npm run test:coverage` | Run tests with V8 coverage report (HTML in `coverage/`) — see [baseline](docs/research/2026-05-03-coverage-baseline.md) |
| `npm run lint`          | ESLint + i18n parity check ([ADR-0001](docs/decisions/0001-i18n-parity-ci-gate.md))                                     |
| `npm run i18n:check`    | Standalone i18n locale parity check                                                                                     |
| `npm run e2e`           | Playwright E2E (requires backend running)                                                                               |
| `npm run e2e:ui`        | Playwright UI mode                                                                                                      |
| `npm run e2e:debug`     | Playwright debug mode                                                                                                   |

## Architecture overview

Four layout areas, all behind `AuthGuard`:

| Layout     | Path            | Purpose                                                              |
| ---------- | --------------- | -------------------------------------------------------------------- |
| Admin      | `/admin/*`      | Configuration: users, agents, queues, campaigns, flows, billing, ... |
| Operations | `/operations/*` | Real-time monitoring: wallboard, agent states, campaign monitor      |
| Analytics  | `/analytics/*`  | Historical: dashboards, CDR, QA, surveys                             |
| Agent      | `/agent/*`      | Agent workspace: inbox, conversation, AI assist                      |

Each layout is wrapped in an `AreaErrorBoundary` ([ADR-0002](docs/decisions/0002-area-error-boundary-pattern.md)) so a render-time crash in one area does not tumble the others.

For deeper detail see [`CLAUDE.md`](CLAUDE.md) (project overview) or [`docs/`](docs/) (specs, decisions, plans, research).

## Documentation layout

All documentation lives under `docs/`, git-tracked:

| Folder                                           | Purpose                                          | Lifecycle                     |
| ------------------------------------------------ | ------------------------------------------------ | ----------------------------- |
| [`docs/specs/`](docs/specs/)                     | Technical designs (input to implementation)      | Add on new feature            |
| [`docs/decisions/`](docs/decisions/)             | Architecture Decision Records (ADRs)             | Append-only                   |
| [`docs/plans/active/`](docs/plans/active/)       | Execution plans currently in progress            | Moves to `completed/` on ship |
| [`docs/plans/completed/`](docs/plans/completed/) | Shipped plans (historical record)                | Append-only                   |
| [`docs/plans/archived/`](docs/plans/archived/)   | Skeletons / superseded / abandoned plans         | Append-only                   |
| [`docs/research/`](docs/research/)               | Exploratory findings, market analysis, discovery | Freeform                      |

Roadmap: [`docs/plans/active/2026-05-03-v1.14.x-operational-foundation-roadmap.md`](docs/plans/active/2026-05-03-v1.14.x-operational-foundation-roadmap.md) — 7 niveles · 24 tracks · ~3 months calendar para llegar a `v1.21.0`.

## Conventions

- **Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- **No `Co-Authored-By` in commits** — ever
- **Spanish for conversation, English for code/commits/docs**
- **TypeScript strict mode** + `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`
- **i18n parity required** — every key in `es-419/*.json` must exist in `en-US/*.json` and `pt-BR/*.json` ([ADR-0001](docs/decisions/0001-i18n-parity-ci-gate.md))
- **shadcn/ui v4** uses `@base-ui/react` — use the `render` prop, NOT Radix's `asChild`:
  ```tsx
  // CORRECT
  <Dialog.Trigger render={<Button />} />
  // WRONG
  <Dialog.Trigger asChild><Button /></Dialog.Trigger>
  ```
- **Path alias** `@/` → `src/`
- **All routes lazy-loaded** with `React.lazy()` + `<Suspense>`

## Versioning

Track-end versioning ([ADR-0005](docs/decisions/0005-versioning-track-end-tags.md)): patches inside a track ship without git tags; only the final patch of a track receives a tag (`v1.X.Y-web`) and a GitHub release. Releases summarize the whole track narrative.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full contribution guide.

Quick version: branch from `main`, [Conventional Commits](https://www.conventionalcommits.org/), sign commits with DCO (`git commit -s`), and ensure `npm run lint && npm run test && npm run build` all pass before opening a PR.

For security disclosure use `security@verbara.io`. For commercial licensing inquiries use `licensing@verbara.io`.

## License

This repository is licensed under the **[Apache License 2.0](LICENSE)**. See [`NOTICE`](NOTICE) for attributions.

This is the open-source UI of the **Verbara** open-core contact-center stack:

| Repository                                           | License        | Role                                                              |
| ---------------------------------------------------- | -------------- | ----------------------------------------------------------------- |
| **Verbara Sdk** (currently `Asterisk.Sdk`)           | MIT            | Telephony primitives (AMI/ARI/SIP wrappers) — community attractor |
| **Verbara Web** (this repository)                    | **Apache 2.0** | Frontend UI (admin / agent / analytics / operations)              |
| **Verbara Platform** (currently `Asterisk.Platform`) | Apache 2.0     | Backend application — full contact-center engine                  |
| **Verbara Sdk Pro** (currently `Asterisk.Sdk.Pro`)   | Commercial     | Enterprise overlays (multi-tenant, analytics, cluster, licensing) |

**Why Apache 2.0 + commercial Pro:** the engineering moat is the runtime ECDSA license-key validation in Pro, not source-license restrictions. Apache maximizes adoption and trial-to-Pro conversion. See [ADR-0006](docs/decisions/0006-license-and-commercial-tier-strategy.md) for the full rationale (license decision + 5-tier commercial model).

**Trademark note:** "Asterisk" is a registered trademark of Sangoma Technologies/Digium and is unrelated to the Verbara project. The repository names that begin with `Asterisk.` are transitional and will be renamed to `verbara-*` as part of the v1.14.0 rebrand.
