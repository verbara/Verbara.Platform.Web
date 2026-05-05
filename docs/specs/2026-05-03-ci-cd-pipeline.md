# CI/CD Pipeline Design

**Date:** 2026-05-03
**Parent track:** v1.14.x Operational Foundation — Track 1C
**Scope:** Platform.Web only. GitHub Actions on `verbara/Verbara.Platform.Web`. Zero backend changes.

## Context

El repo no tiene CI/CD configurado: `find .github/workflows -type f` retorna 0 archivos. Tests, lint, build y audit corren solo cuando un desarrollador los invoca localmente. No hay branch protection ni required checks. Cualquier PR puede mergear con código que rompe tests, falla lint o introduce vulnerabilidades.

Stack: Node 22 (Docker base), npm, Vite 8, Vitest 4, Playwright (E2E opt-in que requiere backend running), ESLint 9 + i18n parity check.

Decisión meta en [ADR-0003](../decisions/0003-operational-foundation-priority.md): la Operational Foundation (incluyendo CI/CD) precede a features customer-facing. Este spec define el pipeline.

## Approved approach

Tres workflows en `.github/workflows/`:

### `ci.yml` — required en todo PR

**Trigger:** `push` a `main` + `pull_request` a `main`.

**Concurrency:** `group: ci-${{ github.ref }}`, `cancel-in-progress: true` — evita acumular runs en push rápido a la misma branch.

**Jobs (en paralelo donde sea posible, dependencia explícita donde no):**

```yaml
jobs:
  setup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci

  lint:
    needs: setup
    steps:
      - run: npm run lint # incluye eslint . && npm run i18n:check

  test:
    needs: setup
    steps:
      - run: npm run test -- --run --reporter=default --reporter=junit --outputFile=./test-results/junit.xml
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: junit, path: ./test-results/junit.xml }

  build:
    needs: setup
    steps:
      - run: npm run build # tsc -b && vite build, valida TypeScript
      - uses: actions/upload-artifact@v4
        with: { name: dist, path: ./dist, retention-days: 7 }

  audit:
    needs: setup
    steps:
      - run: npm audit --audit-level=high # fails on HIGH/CRITICAL
```

**Caching:** `actions/setup-node` con `cache: 'npm'` cubre `~/.npm`. Adicional para Vite: `actions/cache@v4` con key `vite-${{ hashFiles('package-lock.json', 'vite.config.ts') }}` sobre `node_modules/.vite`.

### `playwright.yml` — opt-in via PR label `e2e`

**Trigger:** `pull_request` con label `e2e`. Skip si la label no está aplicada (`if: contains(github.event.pull_request.labels.*.name, 'e2e')`).

**Razón del opt-in:** los E2E necesitan el backend Platform demo running. Hasta que tengamos un docker-compose stack en CI o un staging endpoint público, los E2E corren en máquinas locales o en runs explícitos.

**Jobs:**

1. Setup + checkout + Node 22 + `npm ci`
2. Build + start nginx local
3. Wait for backend health (`http://platform-demo.local:5000/health`) — TBD: cómo proveerlo en CI (skip si no disponible)
4. `npx playwright test -c tests/e2e/playwright.config.ts`
5. Upload `playwright-report/` artifact en failure

### `lighthouse.yml` — defer a Track 2B

Documentado aquí para visibilidad pero no implementar en Track 1C. Se construye en Track 2B (Performance budget). Trigger: `pull_request`. Ejecuta Lighthouse CI contra build preview. Comenta en PR con scores LCP/CLS/INP.

## Branch protection en `main`

Configurar via GitHub UI o `gh api`:

- **Require a pull request before merging** ✅
- **Require status checks to pass before merging** ✅
  - Required: `setup`, `lint`, `test`, `build`, `audit` (todos del `ci.yml`)
  - NO required: `playwright` (opt-in), `lighthouse` (futuro)
- **Require branches to be up to date before merging** ✅
- **Require linear history** ✅ (no merge commits, force `--ff-only` o squash)
- **Restrict force pushes** ✅
- **Allow deletions** ❌

Decisión: requirir 1 PR review de un colaborador. Para single-maintainer hoy, este check es no-op (uno mismo no puede aprobar su propio PR), pero queda preparado para crecer el equipo.

## Implementation outline

1. Crear `.github/workflows/ci.yml` con los 5 jobs
2. Crear `.github/workflows/playwright.yml` con opt-in label
3. Configurar branch protection vía `gh api repos/verbara/Verbara.Platform.Web/branches/main/protection ...`
4. Verificar: PR de prueba con commit que rompe lint queda bloqueado; otro con todo verde queda mergeable
5. Documentar el flujo en CONTRIBUTING.md (Track 1A)

## Out of scope

- Auto-deploy: por ahora, build artifact se sube pero no se despliega. Deploy es manual.
- Preview deployments (Vercel/Netlify/Cloudflare Pages): defer hasta que el flujo de demos amerite.
- SAST tools (CodeQL, Snyk): defer a Track futuro de seguridad ampliada (Track 1B cubre Dependabot vulnerability scanning).
- Self-hosted runners: ubuntu-latest hosted suficiente.
- Performance regression testing: defer a Track 2B (Lighthouse).

## Open questions

1. **¿Separar `audit` job para que no bloquee en moderate?** Hoy `--audit-level=high` solo falla en HIGH/CRITICAL. ¿Subimos a moderate después de Track 1B (vulnerability cleanup)?
2. **¿E2E nightly cron además de PR-label opt-in?** Daría señal de regression sin necesidad de label, pero requiere backend stable en CI.
3. **¿Notify on failure?** GitHub notification default suficiente por ahora; webhook a Slack/Discord en futuro si el equipo crece.
4. **Coverage upload (Codecov/Coveralls):** decidir en Track 2A junto con setup de coverage threshold.

---

## Implementation notes (added 2026-05-03 during Track 1C ship)

### Lint job — split into `i18n` + `lint`, lint non-blocking until Track 3A

The original spec had a single `lint` job running `npm run lint`, which is `eslint . && npm run i18n:check`. Reality check at implementation time: there are **111 pre-existing eslint errors** explicitly deferred to Track 3A (lint-cleanup-2). Running `npm run lint` exits 1, which would block every PR.

**Resolution:** Split into two CI jobs:

- `i18n` — runs `npm run i18n:check` directly. **Required, blocking.** ([ADR-0001](../decisions/0001-i18n-parity-ci-gate.md) is non-negotiable; locale parity must enforce.)
- `lint` — runs `npx eslint .` directly with `continue-on-error: true`. **Non-blocking.** Surfaces lint warnings in PR checks for reviewer signal but does not block merge.

When Track 3A ships (eslint errors → 0), flip `continue-on-error` to `false` and add `lint` to required checks in branch protection.

### Parallel jobs without `needs: setup`

The spec showed `setup` as a separate job that other jobs `needs:`. In practice GitHub Actions runs each job on a separate VM, so `setup` cannot pass `node_modules/` to dependent jobs — each job must `npm ci` again. The `setup` job adds latency without benefit.

**Resolution:** Drop the `setup` job. Run `build`, `test`, `i18n`, `audit`, `lint` in parallel, each with its own `actions/checkout` + `actions/setup-node@v5` (`cache: 'npm'`) + `npm ci`. Concurrency control via `concurrency: group: ci-${{ github.ref }}, cancel-in-progress: true` at workflow level prevents stacked runs on rapid pushes.

### Dependabot auto-merge workflow added

Spec mentioned Dependabot config in Track 1B but didn't address auto-merge. With CI now in place, auto-merge of safe Dependabot PRs (patch + minor only) becomes possible. Adding `.github/workflows/dependabot-auto-merge.yml` here in Track 1C alongside `ci.yml`.

Auto-merge logic: `dependabot/fetch-metadata@v2` extracts update type; if `patch` or `minor`, run `gh pr merge --auto --squash`. Major updates are already filtered by the Dependabot config (Track 1B) — they don't reach this workflow.

### Branch protection: NOT including `lint` as required

Per the lint deferral above, branch protection required-checks list is:

- `build`, `test`, `i18n`, `audit` (4 required, all blocking)
- NOT `lint` (non-blocking until Track 3A)
- NOT `e2e` / `playwright` (opt-in)
- NOT `auto-merge` (informational, not a CI gate)

### Files shipped in Track 1C (v1.14.2)

- `.github/workflows/ci.yml` — 5 jobs (build / test / i18n / audit / lint)
- `.github/workflows/playwright.yml` — opt-in via `e2e` label, manual `workflow_dispatch`
- `.github/workflows/dependabot-auto-merge.yml` — auto-merge patch+minor Dependabot PRs
- `.nvmrc` — pin Node `22`
- This spec, updated with implementation notes
