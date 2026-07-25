# ADR-0010 — Audit gate: production-scoped vuln floor + non-blocking full-tree companion

**Status:** Accepted
**Date:** 2026-07-25
**Supersedes:** none (refines the `audit` job introduced ad hoc in `ci.yml`)

## Context

The required merge-queue check `audit` ran bare `npm audit --audit-level=high` over the **full**
dependency tree. That froze the merge queue for **every** Web PR whenever a HIGH advisory appeared
anywhere in the tree — including advisories confined to **build/dev tooling that never ships to
users**. This surfaced concretely while landing `openapi-numeric-schema-truth`: 7 HIGH advisories
blocked the queue, of which 5 were a `brace-expansion`/`minimatch` ReDoS reachable only through
`eslint-plugin-jsx-a11y` and `@redocly/openapi-core` (a transitive dep of the `openapi-typescript`
codegen tool). Verified facts:

- **The 5 are build-only.** All three parents are `devDependencies`; none is imported by `src/`; a
  fresh `dist/` provably contains none of the code. End users cannot reach the vulnerable parsers.
- **They cannot be remediated at the dependency level.** `eslint-plugin-jsx-a11y@6.10.2` (latest)
  pins `minimatch@^3.1.2`; `openapi-typescript@7.13.0` (latest) pins `@redocly/openapi-core`, which
  pins `minimatch@^5`. Both `minimatch` lines predate the fix; forcing `minimatch@10` via
  `overrides` **breaks both tools** (v10 dropped the callable default export — `mm10 is not a
function`), and npm rejects the nested override as `invalid`. There is no fixed `1.x`/`2.x`
  `brace-expansion`. No self-service fix exists until the upstream tools re-pin.
- The one genuinely-shipped advisory in the same batch (`react-router` GHSA-qwww-vcr4-c8h2, a
  production dependency) was remediated on its merits in this PR by migrating to `react-router@8.3.0`
  — **not** suppressed.

This blunt gate also **contradicted the ecosystem's own CI-gating reasoning**: verbara-meta ADR-0003
§2 argues supply-chain checks should not be queue-required because they hang delivery on checks that
gate risk which may never reach production. It was already logged as a known drift liability in
verbara-meta `docs/workflows/cross-repo-release.md` ("Web `audit` gate drifts"). ADR-0014 §2 G8 fences
only _that a vuln floor exists_; the tool and scope are left per-repo.

## Decision

Split the audit check into two jobs, preserving the `audit` required-check context name:

1. **`audit` (queue-required):** `npm audit --omit=dev --audit-level=high` — a **production vuln
   floor**. HIGH/CRITICAL in a shipped dependency still blocks the queue (the only class that reaches
   users justifies freezing delivery). This is the ADR-0014 §2 G8 floor for this repo.
2. **`audit-full` (NOT queue-required, informational):** `npm audit --audit-level=high` over the full
   tree with `continue-on-error: true` — surfaces build/dev-tooling advisories for visibility without
   blocking delivery. Proactive remediation cadence is Dependabot's job (the existing weekly
   `npm-security` group + auto-merge), so no separate cron is added here.

The `overrides` block additionally pins `brace-expansion@5` → `5.0.8` (patches the one 5.x node it
_can_ reach) and `shadcn` was moved from `dependencies` to `devDependencies` (a CLI scaffolding tool
misclassified into the production graph, with zero `src/` imports).

## Consequences

- The merge queue is no longer frozen by advisories that never ship. `npm audit --omit=dev
--audit-level=high` reports **0** on the current tree.
- Build-machine advisories remain **visible** (the `audit-full` job log) and **tracked** (Dependabot),
  not silenced — this is a scope decision, not a suppression. No new dependency is added to the
  security gate itself (unlike an allowlist runner).
- Trade-off accepted: a dev-tooling HIGH no longer blocks delivery. Mitigation: Dependabot's
  `npm-security` group + the informational `audit-full` job. A production HIGH still blocks, as before.
- **Cross-repo follow-up (tracked, not resolved here):** Web is the only repo with a queue-blocking
  audit gate (siblings use non-blocking `dependency-review-action` or none). Concretizing
  "production-scoped vuln floor" as the ecosystem-wide G8 instantiation is a candidate verbara-meta
  ADR amendment + `/xr:rollout`, left as backlog. This ADR is the Web-local instance.
