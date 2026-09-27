# Verbara Web

> Frontend for the **Verbara** open-core contact-center platform.
> Repository rebranded to **Verbara** (ADR-0006).
>
> **Visibility status:** This repository is **public**. The Apache 2.0 license has been chosen (ADR-0006); all triggers in ADR-0007 were met and the repo transitioned to public. Tier 0 (Community) self-host and the Tier 0.5 Developer self-issue portal are available.

React 19 frontend for the Verbara omnichannel contact-center platform. Admin configuration, real-time operations monitoring, historical analytics, and an agent workspace.

**Version:** 3.11.0-web — see [`CLAUDE.md`](CLAUDE.md) for the project overview and conventions.

## Install (Docker image)

For **operators / self-hosters** running Verbara end-to-end, the React frontend ships as a public, cosign-signed nginx image on `ghcr.io/verbara/platform/web`. Built for **`linux/amd64`** and **`linux/arm64`** (Apple Silicon, AWS Graviton, Raspberry Pi 5, ARM cloud) from a single manifest list — `docker pull` auto-resolves to the host's architecture.

### Quick try (`:latest` — mutable, evaluation only)

```bash
# Verify signature (no clone needed; key lives at verbara.io)
cosign verify --key https://verbara.io/keys/cosign.pub --insecure-ignore-tlog \
  ghcr.io/verbara/platform/web:latest

# Pull + run (point VITE_API_BASE_URL at a Platform.Api instance)
docker run -d --name verbara-web -p 8080:80 \
  ghcr.io/verbara/platform/web:latest
# → http://localhost:8080
```

### Reproducible install (pinned `vX.Y.Z-web` — recommended for production)

```bash
TAG=v3.11.0-web   # ← bump per release; see https://github.com/verbara/Verbara.Platform.Web/releases

cosign verify --key https://verbara.io/keys/cosign.pub --insecure-ignore-tlog \
  ghcr.io/verbara/platform/web:$TAG

docker pull ghcr.io/verbara/platform/web:$TAG
```

`:latest` is **not signed for pinned reproducibility** — it's an alias that moves to the most recent release at each tag push. The pinned `vX.Y.Z-web` reference is the canonical install used by `docker-compose.reference-smb.yml`, the Helm chart, and the customer manuales in [`Verbara.Platform`](https://github.com/verbara/Verbara.Platform). cosign signs by manifest-list digest, so both tag references at release-time inherit the same signature.

For the full SMB on-premise deployment context (Asterisk + Postgres + Redis + Realtime + nginx-gateway + Web), see [`Verbara.Platform/docs/manuales/smb/`](https://github.com/verbara/Verbara.Platform/tree/main/docs/manuales/smb).

## Stack

| Library                   | Version                                       |
| ------------------------- | --------------------------------------------- |
| React                     | 19.2.x                                        |
| TypeScript                | 6.0.x (strict mode)                           |
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
git clone git@github.com:verbara/Verbara.Platform.Web.git
cd Verbara.Platform.Web
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

The dev server expects the Platform backend running on `localhost:5000`. See the [Verbara.Platform repo](https://github.com/verbara/Verbara.Platform) for backend setup. A demo docker-compose is documented in the Platform repo.

## Available scripts

| Script                  | What it does                                            |
| ----------------------- | ------------------------------------------------------- |
| `npm run dev`           | Vite dev server with HMR                                |
| `npm run build`         | Production build (`tsc -b && vite build`)               |
| `npm run preview`       | Preview the production build locally                    |
| `npm run test`          | Run unit tests (Vitest, excludes `tests/e2e/**`)        |
| `npm run test:watch`    | Vitest in watch mode                                    |
| `npm run test:coverage` | Run tests with V8 coverage report (HTML in `coverage/`) |
| `npm run lint`          | ESLint + i18n parity check (ADR-0001)                   |
| `npm run i18n:check`    | Standalone i18n locale parity check                     |
| `npm run e2e`           | Playwright E2E (requires backend running)               |
| `npm run e2e:ui`        | Playwright UI mode                                      |
| `npm run e2e:debug`     | Playwright debug mode                                   |

## Architecture overview

Four layout areas, all behind `AuthGuard`:

| Layout     | Path            | Purpose                                                              |
| ---------- | --------------- | -------------------------------------------------------------------- |
| Admin      | `/admin/*`      | Configuration: users, agents, queues, campaigns, flows, billing, ... |
| Operations | `/operations/*` | Real-time monitoring: wallboard, agent states, campaign monitor      |
| Analytics  | `/analytics/*`  | Historical: dashboards, CDR, QA, surveys                             |
| Agent      | `/agent/*`      | Agent workspace: inbox, conversation, AI assist                      |

Each layout is wrapped in an `AreaErrorBoundary` (ADR-0002) so a render-time crash in one area does not tumble the others.

For deeper detail see [`CLAUDE.md`](CLAUDE.md) (project overview) or [`docs/`](docs/) (specs, decisions, plans, research).

## Documentation layout

Public documentation lives under `docs/` (currently the CI docs-only fast-path note,
`docs/ci-docs-fast-path.md`). Architecture decision records, technical designs, plans and
research notes are internal development records kept outside the repository; they are cited
by opaque id (e.g. ADR-0006) where relevant.

## Conventions

- **Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- **No `Co-Authored-By` in commits** — ever
- **Spanish for conversation, English for code/commits/docs**
- **TypeScript strict mode** + `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`
- **i18n parity required** — every key in `es-419/*.json` must exist in `en-US/*.json` and `pt-BR/*.json` (ADR-0001)
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

Track-end versioning (ADR-0005): patches inside a track ship without git tags; only the final patch of a track receives a tag (`v1.X.Y-web`) and a GitHub release. Releases summarize the whole track narrative.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full contribution guide.

Quick version: branch from `main`, [Conventional Commits](https://www.conventionalcommits.org/), sign commits with DCO (`git commit -s`), and ensure `npm run lint && npm run test && npm run build` all pass before opening a PR.

For security disclosure use `security@verbara.io`. For commercial licensing inquiries use `licensing@verbara.io`.

## License

This repository is licensed under the **[Apache License 2.0](LICENSE)**. See [`NOTICE`](NOTICE) for attributions.

This is the open-source UI of the **Verbara** open-core contact-center stack:

| Repository                        | License        | Role                                                                                          |
| --------------------------------- | -------------- | --------------------------------------------------------------------------------------------- |
| **Verbara Sdk**                   | MIT            | Telephony primitives (AMI / AGI / ARI / Live API / Sessions / Voice AI) — community attractor |
| **Verbara Web** (this repository) | **Apache 2.0** | Frontend UI (admin / agent / analytics / operations)                                          |
| **Verbara Platform**              | Apache 2.0     | Backend application — full contact-center engine                                              |
| **Verbara Sdk Pro**               | Commercial     | Enterprise overlays (multi-tenant, analytics, cluster, licensing)                             |

**Why Apache 2.0 + commercial Pro:** the engineering moat is the runtime ECDSA license-key validation in Pro, not source-license restrictions. Apache maximizes adoption and trial-to-Pro conversion. See ADR-0006 for the full rationale (license decision + 5-tier commercial model).

**Trademark note:** "Asterisk" is a registered trademark of Sangoma Technologies/Digium. Verbara integrates with Asterisk PBX but is an independent project.
