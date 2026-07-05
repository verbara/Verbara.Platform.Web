# ADR-0003: Operational Foundation before customer-facing features

- **Status:** Accepted
- **Date:** 2026-05-03
- **Deciders:** Platform.Web maintainer
- **Related:** [`docs/plans/completed/2026-05-03-v1.14.x-operational-foundation-roadmap.md`](../plans/completed/2026-05-03-v1.14.x-operational-foundation-roadmap.md), ADR-0004

## Context

Following the v1.13.x i18n closure, an initial roadmap proposal listed customer-facing features as next-up: IP Allowlist UI (backend already shipped), SAML SSO admin UI, recording stereo player, etc. These are visible, marketable, and the backend is ready for several of them.

A deep multi-axis audit (product/backlog · technical posture · UX maturity) revealed gaps that the original proposal had silently assumed were handled:

- **No CI/CD pipeline.** No GitHub Actions, no required checks. Tests, lint, and build run only when a developer remembers to invoke them locally.
- **No error tracking in production.** No Sentry, no Datadog RUM, no alerting. A customer-side crash is invisible to operators unless a user files a ticket.
- **No pre-commit hooks.** No husky/lint-staged. Quality gates depend on the developer's discipline.
- **No coverage tracking.** 205/205 tests pass, but the actual line coverage is unknown.
- **9 npm audit vulnerabilities** including 3 HIGH severity (vite path-traversal RCE potential, picomatch method injection, i18next-http-backend path traversal).
- **No README / LICENSE / CONTRIBUTING** at repo root. Developer onboarding is an oral-tradition task.

The audit estimated production-readiness at ~60/100. Shipping IP Allowlist UI on top of this foundation would compound risk: each new feature widens the surface area we cannot observe in production.

The forces in play:

- **Time-to-market pressure:** features sell. Operational scaffolding does not.
- **Compound risk:** shipping features without observability means each subsequent feature inherits the blindness.
- **Refactor cost:** retrofitting CI gates onto a divergent main branch (e.g. forcing pre-commit hooks after months of unguarded commits) is more expensive than adding them now while the codebase is small enough to fix in a single PR.
- **Auditability:** SOC 2 / GDPR / customer audits will ask for these foundations. Better to have them before the customer asks.

## Decision

The next minor (`v1.14.x`) is dedicated entirely to **Operational Foundation**, even though customer-facing features are visibly demanded. Specifically, in this order:

1. `1.14.0` — Public docs (README, LICENSE, CONTRIBUTING, MIGRATION matrix)
2. `1.14.1` — Vulnerability remediation + Dependabot
3. `1.14.2` — CI/CD pipeline (GitHub Actions, branch protection)
4. `1.14.3` — Pre-commit hooks (husky + lint-staged + commit-msg validation)
5. `1.14.4` — Error tracking in production (Sentry integration with PII filtering)

Customer-facing features (IP Allowlist UI, SAML SSO, WebChat widget) are deferred to **Nivel 7** of the roadmap (`v1.20.0+`). They wait through Niveles 2 (quality), 3 (code quality), 4 (Backend-to-UI Bridge), 5 (UX maturity), 6 (i18n expansion). The estimate for reaching `v1.20.0` is ~2-3 months of focused work.

## Consequences

**Positive:**

- Every PR after `v1.14.2` is gated by CI: tests, lint, audit, i18n parity. Quality regressions caught before merge.
- Production errors become visible from `v1.14.4`. Operators stop being blind.
- New contributors can onboard from the README without oral context transfer.
- Customer-facing features ship onto a stable, observable platform — fewer "ship and pray" moments.
- SOC 2 / GDPR auditor questions ("how do you track production errors?") have actual answers.

**Negative:**

- Customer-visible delay: IP Allowlist UI (the most-requested feature with backend ready) waits ~2-3 months. Sales/customer-success will push back.
- Internal motivation challenge: the team ships nothing user-visible for two minor versions. Hard to celebrate in standups.
- Operational tracks risk being seen as "yak shaving" by stakeholders without engineering visibility.

**Trade-off:**

- We are explicitly choosing **engineering hygiene > feature velocity** for the next quarter. Reversible if a critical customer commitment forces interleaving (e.g. a contract that requires IP Allowlist UI by Q3). The plan should be reviewed at each major milestone.

## Alternatives considered

- **Ship IP Allowlist first, do operational foundation in parallel.** Rejected. Without CI, the IP Allowlist PR cannot be confidently reviewed (no automated regressions). Without error tracking, a bug in the allowlist enforcement is invisible until a customer is locked out. The "parallel" framing hides the dependency: every feature PR shipped before CI accumulates verification debt.
- **Mix one feature per operational track.** Rejected. The operational tracks are interdependent (CI before pre-commit before error tracking). Interleaving makes each track take longer and dilutes focus.
- **Skip operational foundation entirely; focus on features.** Rejected. The audit findings make this irresponsible: known HIGH-severity vulnerabilities, blind production, no onboarding docs. Continuing to ship would be a "go-faster" decision against engineering judgment.
- **Hire someone to do operational foundation while I do features.** Out of scope. Single-maintainer reality.
