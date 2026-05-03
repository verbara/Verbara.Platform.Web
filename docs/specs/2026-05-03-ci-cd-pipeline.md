# CI/CD Pipeline Design

**Date:** 2026-05-03
**Parent track:** v1.14.x Operational Foundation — Track 1C
**Scope:** Platform.Web only. GitHub Actions on `Harol-Reina/Asterisk.Platform.Web`. Zero backend changes.

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
      - run: npm run lint   # incluye eslint . && npm run i18n:check

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
      - run: npm run build   # tsc -b && vite build, valida TypeScript
      - uses: actions/upload-artifact@v4
        with: { name: dist, path: ./dist, retention-days: 7 }

  audit:
    needs: setup
    steps:
      - run: npm audit --audit-level=high   # fails on HIGH/CRITICAL
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
3. Configurar branch protection vía `gh api repos/Harol-Reina/Asterisk.Platform.Web/branches/main/protection ...`
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
