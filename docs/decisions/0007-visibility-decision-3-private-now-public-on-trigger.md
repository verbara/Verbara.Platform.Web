# ADR-0007: Visibility — Private Now, Public on Trigger Checklist (Decision 3)

- **Status:** Accepted
- **Date:** 2026-05-08
- **Deciders:** Verbara maintainer (Harol A. Reina H.)
- **Related:**
  - [ADR-0006 License and Commercial Tier Strategy](0006-license-and-commercial-tier-strategy.md) — establishes Apache 2.0 + 5-tier commercial model + funnel rationale; this ADR does NOT supersede 0006
  - [Platform ADR-0018 Visibility Decision (mirror)](https://github.com/verbara/Verbara.Platform/blob/main/docs/decisions/0018-visibility-decision-3-private-now-public-on-trigger.md) — Platform-side mirror of this decision
  - [SDK ADR-0027 Stewardship Pledge](https://github.com/verbara/Verbara.Sdk/blob/main/docs/decisions/0027-stewardship-pledge-mit-commercial.md)
  - Active plan: `docs/plans/active/2026-05-08-visibility-decision-and-portal.md`

## Context

ADR-0006 (Accepted 2026-05-03) chose **Apache License 2.0** for this repository. The financial rationale documented there is built on the premise of public visibility:

> _"Funnel modeling (1000 GitHub visitors/month → evaluation → legal review → conversion to Pro paid): Apache-2.0 yields ~3 conversions/month at $30k/customer = $1.08M ARR, vs BSL ~1.5 conversions = $540k ARR. Apache-2.0 generates ~2× the ARR."_

The `LICENSE` file (Apache 2.0) was committed 2026-05-03 per ADR-0006. The README declares _"Frontend for the Verbara open-core contact-center platform"_ with the 4-row stack table showing Web under Apache 2.0.

However, the GitHub repository at `github.com/verbara/Verbara.Platform.Web` is currently **private**. Discovery during a cross-repo licensing & visibility audit (2026-05-08, originating in `Verbara.Sdk` session) surfaced this gap. The asymmetry is:

- Apache 2.0 license is **not breached** by being private (Apache governs distribution, not source publication).
- The strategic rationale of ADR-0006 — funnel-driven evaluator-to-Pro conversion — **cannot operate** while the repository is unobservable.
- Tier 0 Community ($0, self-host) per ADR-0006 is **not honorable** today because the source is not available.
- Public repos receive free GitHub secret scanning + push protection; private repos require paid GHAS for equivalent posture.

Three paths were evaluated and the same logic as Platform ADR-0018 applies — see that ADR for the full alternatives analysis. The decision is identical: **Decision 3 — private now, public on explicit trigger checklist**, coordinated with the Platform repo.

## Decision

This repository remains **private** until ALL trigger conditions below are met. Once all are green, the repository flips to **public** in a single coordinated change with `Verbara.Platform`, at which point ADR-0006's Apache 2.0 economics begin operating and the Tier 0.5 Developer self-issue portal becomes accessible.

### Trigger checklist (shared with Platform ADR-0018)

1. **`gitleaks detect` clean across full history.** Web is React + tooling configs; lower secret-leak surface than backend, but verify `.env`, MSW mock-server credentials, hardcoded API keys, JWT signing keys.
2. **Operational Foundation closed.** This is Web's own plan `docs/plans/active/2026-05-03-v1.14.x-operational-foundation-roadmap.md` — CI/CD pipeline, error tracking, pre-commit hooks, npm vulns resolved.
3. **Internal security review of sensitive endpoints** (Platform side; Web consumes them).
4. **Public threat model documented** (Platform side; Web consumes it).
5. **`LicenseGuard` tamper-resistance baseline shipped** (Pro side; Web doesn't consume Pro directly, but the public Tier 0 narrative depends on Pro being a credible binary moat).
6. **`verbara.io` brand setup complete.** Apex page, doc subdomain, email aliases active. The Tier 0.5 issuer endpoint at `issuer.verbara.io/api/developer-license` is reachable.
7. **First signed Tier 1+ customer demo.** Per Platform ADR-0018.

### Web-specific work that must be ready at flip

- Tier 0.5 portal page (`/developer-license`) implemented and wired to live issuer endpoint
- `/legal/eula`, `/legal/privacy`, `/legal/terms` pages populated with lawyer-drafted content (Pro plan Phase 1)
- `/pricing` page rendering the 6-tier model with CTA per tier (Tier 0.5 = "Get developer license", Tier 1+ = Stripe Payment Link, Tier 3+ = sales contact)
- All three locales (en-US, es-419, pt-BR) have parity for the new pages

### What this ADR does NOT change

- **License**: Apache 2.0 stands. ADR-0006 is not superseded.
- **5-tier commercial model**: per ADR-0006, with Tier 0.5 added per Pro plan tier-model ADR.
- **Trademark / brand**: Verbara stands.
- **Repository name**: `Verbara.Platform.Web` stands.

## Consequences

**Positive:**

- Honors ADR-0006 economics by establishing a credible path to public visibility.
- Forces concrete pre-launch hygiene (gitleaks, Operational Foundation closure, portal page implementation) that improves quality regardless of visibility.
- When triggered, the Tier 0.5 self-serve portal launches simultaneously with the public repo — a substantially stronger public-launch event than just opening source.
- Coordinated flip with Platform avoids the awkward state of one half being public.

**Negative:**

- Public-launch delay equals trigger-completion time (estimated 4-8 weeks).
- Web-side work (portal page, legal pages, pricing page) is part of the gate; if those drag, Platform is also blocked even if Platform-side triggers are green.

**Trade-off:**

- Trades immediate funnel activation for a real launch event that includes self-serve evaluation. The composite launch (public source + working Tier 0.5 portal + populated legal pages) is materially stronger than just open-sourcing the repos.

## Alternatives considered

Same as Platform ADR-0018:

- Decision 1 (publish today): rejected, no audit
- Decision 2 (private forever): rejected, breaks ADR-0006 economics
- Time-based commitment: rejected, no trigger validation
- Weaker checklist: rejected, security cost asymmetric

## Status update

(append-only; do not modify the original ADR text above)

- **2026-05-08**: ADR Accepted. Trigger checklist active. Tracking in `docs/plans/active/2026-05-08-visibility-decision-and-portal.md`.

## References

- ADR-0006 (this repo) — license + 5-tier commercial strategy
- Platform ADR-0018 (when shipped) — Platform-side mirror
- Platform ADR-0016 — Platform license decision
- SDK ADR-0027 — stewardship pledge
- SDK auto-memory `project_2026_05_08_licensing_audit.md`
- Active plan `docs/plans/active/2026-05-08-visibility-decision-and-portal.md`
