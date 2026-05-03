# ADR-0001: i18n locale parity enforced as a CI gate

- **Status:** Accepted
- **Date:** 2026-05-03
- **Deciders:** Platform.Web maintainer
- **Related:** [`docs/research/i18n-coverage-gap-2026-04-28.md`](../research/i18n-coverage-gap-2026-04-28.md), [`docs/plans/completed/2026-05-03-v1.13.x-closure-i18n-lint-resilience.md`](../plans/completed/2026-05-03-v1.13.x-closure-i18n-lint-resilience.md), `scripts/i18n-parity-check.mjs`

## Context

Platform.Web supports three locales (`es-419`, `en-US`, `pt-BR`) shipped as JSON namespaces under `public/locales/`. Drift between locales is silent: i18next falls back from the missing key to the key string itself, so a user who switches language sees raw identifiers like `admin:sidebar.billing` instead of translated text.

The v1.13.x i18n track discovered this exact failure mode in production: 16 sidebar keys existed only in `es-419`, plus 1 key exclusive to `en-US`. The drift had accumulated over multiple PRs because no automated check existed.

PR review caught some drift cases historically but not all — the missing-key surface area is too large (≥ 2700 keys per locale) to audit by eye on every change.

## Decision

A locale parity check runs as part of `npm run lint` (and therefore in CI) and is **required to pass before merge**. The check is implemented in [`scripts/i18n-parity-check.mjs`](../../scripts/i18n-parity-check.mjs) and exits non-zero on any divergence between `es-419` (canonical baseline, matches `fallbackLng` in `src/core/i18n/i18n.ts`) and either `en-US` or `pt-BR`.

The script is wired in two ways:
1. `npm run i18n:check` — standalone invocation, used by humans and CI.
2. `npm run lint` — runs `eslint . && npm run i18n:check` so any developer running lint locally also catches drift.

## Consequences

**Positive:**
- Drift is impossible to merge — CI blocks before review.
- Adding a new translation key requires immediate parity in all three locales (no "TODO: translate later" silently shipping).
- Script exit-code semantics are CI-friendly (`0` = OK, `1` = drift) without requiring extra tooling.

**Negative:**
- A small contributor friction: adding a key to one locale requires adding it to three. Acceptable given the alternative (silent broken UI for non-Spanish users).
- The script runs on every lint invocation, adding ~50 ms. Negligible.

**Trade-off:**
- The check requires `es-419` as canonical baseline. If we ever need to deprecate Spanish-first as the source-of-truth, the script needs a flag for the new baseline. Acceptable for now.

## Alternatives considered

- **Translation Management System (Lokalise, Crowdin, Phrase) integration:** rejected for cost and complexity at this stage. The repo has 3 locales and ~2 700 keys — manual parity is tractable. Revisit when adding a 4th locale or when translation volume warrants outsourcing.
- **Manual review checklist in PR template:** rejected as unreliable. Humans skim, especially on small PRs that only touch one locale "for now".
- **i18next-parser auto-extraction with fail-on-diff:** considered. Heavier setup (config + extraction phase + diff vs static keys); reconsider when key count makes manual maintenance unsustainable.
