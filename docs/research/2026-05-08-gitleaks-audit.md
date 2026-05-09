# gitleaks audit — 2026-05-08

**Tool:** `gitleaks detect` (apt-installed, Debian package)
**Scope:** full git history, 581 commits scanned
**Result:** 0 findings
**Verdict:** ✅ **clean** — safe for going public per ADR-0007 trigger 1

## Findings

None.

## Significance

Verbara.Platform.Web is React + tooling configs. Common leak surfaces in frontend repos:

- `.env*` files committed accidentally
- API keys hardcoded in `vite.config.ts`, `playwright.config.ts`, MSW handlers
- JWT signing keys in test setup
- Sentry/PostHog/analytics tokens in source

None found. The clean baseline aligns with the repo's existing hygiene (no `.env` in git, env-driven config via Vite, `.env.example` template only).

## Re-scan command

```sh
gitleaks detect --source . --no-banner
```

Expected: zero findings. Investigate any new findings.

## Cross-references

- Audit context: SDK auto-memory `project_2026_05_08_licensing_audit.md`
- Trigger source: ADR-0007 trigger 1
- Active plan: `docs/plans/active/2026-05-08-visibility-decision-and-portal.md`
