# Contributing to Verbara Web

Thanks for your interest in contributing to **Verbara Web** — the React 19 frontend for the Verbara contact-center platform.

This repository is licensed under the [Apache License 2.0](LICENSE). By submitting a contribution, you agree that your contribution is licensed under the same terms (Apache 2.0 inbound = outbound).

## Quick start

```bash
# 1. Fork and clone
git clone https://github.com/<your-username>/verbara-web.git
cd verbara-web

# 2. Install dependencies (Node 22+)
npm ci

# 3. Run dev server (proxies /api/v1 to localhost:5000)
npm run dev

# 4. Run tests
npm run test         # Vitest unit tests
npx playwright test  # E2E (requires running backend)

# 5. Lint + i18n parity
npm run lint

# 6. Format code (prettier)
npm run format         # write
npm run format:check   # CI-style check, no writes
```

After `npm ci`, the `prepare` script auto-installs git hooks via [husky](https://typicode.github.io/husky/) at `.husky/`. The hooks enforce:

- **`pre-commit`** — runs [`lint-staged`](https://github.com/lint-staged/lint-staged) on staged files. Currently scoped to `prettier --write` for `*.{ts,tsx,js,jsx,mjs,cjs,json,md,yml,yaml,css}`. ESLint is NOT in the pre-commit gate yet — 111 deferred eslint errors block enforcement until [Track 3A](docs/plans/completed/2026-05-03-v1.14.x-operational-foundation-roadmap.md) clears them. Track 3A flips eslint to blocking when the count reaches 0.
- **`commit-msg`** — validates [Conventional Commits](https://www.conventionalcommits.org/) format on the first line. Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`, `revert`. Optional scope in parentheses, optional `!` for breaking changes. Examples in `.husky/commit-msg`.

### Hook bypass policy (`--no-verify`)

Bypass git hooks **only for emergencies** (production hotfix, urgent revert). When you bypass, document the reason in the commit body:

```bash
git commit --no-verify -m "fix: emergency hotfix for outage

Bypassed pre-commit hooks: ran out of time to format properly during
the incident. Will rebase + format in a follow-up PR."
```

For routine commits, never use `--no-verify` — fix the underlying issue (run `npm run format` to satisfy prettier; restructure the code to satisfy eslint when Track 3A enables it).

See [`CLAUDE.md`](CLAUDE.md) for the full architecture overview, stack, and conventions.

## Reporting bugs

Use [GitHub Issues](https://github.com/verbara/verbara-web/issues) for non-security bugs. Include:

- What you expected to happen.
- What actually happened.
- Steps to reproduce.
- Browser, OS, and Verbara Web version.
- Console / network logs if relevant.

For **security vulnerabilities**, do not open a public issue. Email `security@verbara.io` with details. We aim to acknowledge within 72 hours.

## Suggesting features

Open a GitHub Discussion (or Issue with the `enhancement` label) describing:

- The problem you are trying to solve.
- Why this fits Verbara Web's scope (admin, agent, analytics, or operations).
- Any prior art or links to similar features in other tools.

The core team triages weekly. Larger features (multi-week) may need a `docs/specs/` proposal before code review.

## Pull request process

1. **Branch** off `main`. Use a descriptive branch name: `feat/skill-routing-ui`, `fix/queue-metrics-rounding`, `docs/contributing-update`.
2. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat: add skill-based routing dropdown`
   - `fix: round queue metrics to 2 decimals`
   - `docs: clarify e2e setup in README`
   - `refactor:`, `test:`, `chore:`, `perf:` are also accepted.
3. **Write tests** when changing behavior. Vitest for unit, Playwright for E2E. New components without tests will be asked for tests in review.
4. **Run locally before pushing:**
   ```bash
   npm run build        # type check + production build
   npm run test -- --run
   npm run lint         # ESLint + i18n:check
   ```
5. **Open a PR** against `main` with:
   - A summary of what changed and why.
   - Screenshots / GIFs for UI changes.
   - Link to the related issue or discussion.
   - Test plan in the description.
6. **Sign your commits with DCO** (Developer Certificate of Origin) — append `-s` to `git commit`:
   ```bash
   git commit -s -m "feat: add skill-based routing dropdown"
   ```
   This adds a `Signed-off-by:` line and certifies you wrote the code or have the right to contribute it. We do not require a CLA at this time; DCO is sufficient.
7. **Wait for review.** A maintainer will review within a few business days. Address feedback by pushing additional commits to the same branch (do not force-push during review unless asked).

## Coding standards

- **TypeScript strict mode** is non-negotiable (`strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`).
- **Path alias `@/`** maps to `src/`. Use it consistently.
- **TailwindCSS v4 only** — no CSS modules, no styled-components.
- **shadcn/ui v4** uses `@base-ui/react`, NOT Radix. Use `render` prop, NOT `asChild`.
- **Forms:** React Hook Form + Zod via `@hookform/resolvers`.
- **Icons:** Lucide React exclusively.
- **Routes:** lazy-loaded with `React.lazy()` + `<Suspense>`.
- **Drag-and-drop:** `@dnd-kit` for sortable lists.
- **Comments:** default to none. Only add when the _why_ is non-obvious.
- **No emojis in code or commits unless explicitly relevant** to a UX feature (e.g., reaction picker).

See [`CLAUDE.md`](CLAUDE.md) for the canonical conventions.

## i18n parity

Every key in `public/locales/es-419/*.json` must exist in `public/locales/en-US/*.json` and `public/locales/pt-BR/*.json` (and vice versa). CI enforces this — `npm run lint` runs both ESLint and `npm run i18n:check`. Drift fails CI. See [ADR-0001](docs/decisions/0001-i18n-parity-ci-gate.md) for the rationale.

## License of contributions

By contributing to this repository, you agree that:

- Your contributions are licensed under the [Apache License 2.0](LICENSE) (inbound = outbound).
- You have the right to submit the contribution (the DCO sign-off attests to this).
- You retain copyright on your contribution; you grant Verbara and downstream users the rights described in Apache 2.0.

We do not require a CLA at this time. If we ever need to relicense this codebase, we will ask contributors at that time and respect anyone who declines.

For questions about contributing, reach out at `hello@verbara.io` or open a discussion.
