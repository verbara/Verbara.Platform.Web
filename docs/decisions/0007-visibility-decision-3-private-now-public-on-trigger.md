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

- **2026-05-09 (Trigger 7 met by Option B per Platform ADR-0018)**: This ADR mirrors Platform ADR-0018 trigger 7. The Platform ADR's 2026-05-09 Status update declares Trigger 7 ✅ GREEN via Option B (Tier 0.5 e2e validation through verbara.io self-issuance loop in lieu of waiting for a paying-Tier 1+ customer). Web side has nothing additional to validate for this trigger (the issuer Worker lives in the verbara-website repo; this repo consumes nothing from it). Trigger 7 is therefore ✅ GREEN for the coordinated flip from this repo's perspective as well.

- **2026-05-09 (Trigger 3 ❌ BLOCKED on Platform side)**: Platform ADR-0018 Status update (2026-05-09) records that Trigger 3 reverted to BLOCKED by 2 P0 + 4 P1 findings in the Platform repo. The coordinated-flip requirement of this ADR (Web does not flip without Platform) means this repo also remains 🟡 PARTIAL until the Platform v2.0.x patch train remediation lands. No Web-side code work is needed for that remediation; this is a wait gate.

  **Trigger dashboard delta (Web view, 2026-05-09):** identical to Platform — 5/7 GREEN (1, 2, 4, 6, 7), 1/7 PARTIAL (5), 1/7 BLOCKED (3).

- **2026-05-09 (later — Trigger 3 ✅ GREEN; Platform v2.0.1 ships closures)**: Platform ADR-0018 Status update of even date records all 6 P0+P1 findings closed in v2.0.1; full Platform slnx test suite passes; new ADR-0019 documents the management-key permission model change (back-compat through v3.0.0 — wildcard removal is a breaking SemVer change). No Web code work was needed for the remediation. From this repo's perspective the coordinated-flip requirement is now satisfied for Trigger 3.

  **Trigger dashboard delta (Web view, 2026-05-09 end of session):** mirrors Platform — 6/7 GREEN (1, 2, 3, 4, 6, 7), 1/7 PARTIAL (5 — Pro v2.3.x execution), 0/7 BLOCKED. Visibility flip is now gated **only** by Trigger 5.

- **2026-05-10 (Trigger 5 ✅ GREEN; visibility flip 7/7 across both repos)**: Platform ADR-0018 Status update of even date records the closure of Trigger 5: Pro v2.3.0-pro shipped, Verbara.Platform v2.1.0 tagged + workflow run 25636962512 published the first signed image (`ghcr.io/verbara/platform/api@sha256:f82a9041dc7f26018f6b6b11addf3ddbda6a7833827434f6b8d5ca2486349902`), digest registered in `verbara-website/data/authorized-digests.json` (commit `2e41314`). RC1-RC4 cycle pivoted from file-based digest baking to operator-side `IMAGE_DIGEST` env var (Pro ADR-0011 Status update). Web code unchanged for this trigger; the Web side of the visibility flip is operationally gated on the same `gh api -X PATCH ... visibility=public` step but no Web release is required.

  **Trigger dashboard delta (Web view, 2026-05-10):** mirrors Platform — **✅ 7/7 GREEN** (1, 2, 3, 4, 5, 6, 7) · 🟡 0/7 · ❌ 0/7. Visibility flip can proceed at the maintainer's discretion (coordinated `gh api` PATCH on Platform + Web).

- **2026-05-10 19:04 UTC (🎉 visibility flip EXECUTED — coordinated with Platform)**: `gh api -X PATCH repos/verbara/Verbara.Platform.Web -f visibility=public` succeeded. Secret scanning + push protection enabled (free tier post-flip). License `Apache-2.0` declared in repo metadata. Web active plan `docs/plans/active/2026-05-08-visibility-decision-and-portal.md` moves to `docs/plans/completed/` with closure status header. See Platform ADR-0018 Status update of even date for the full operations log + state at flip time + next-quarter follow-ups.

## References

- ADR-0006 (this repo) — license + 5-tier commercial strategy
- Platform ADR-0018 (when shipped) — Platform-side mirror
- Platform ADR-0016 — Platform license decision
- SDK ADR-0027 — stewardship pledge
- SDK auto-memory `project_2026_05_08_licensing_audit.md`
- Active plan `docs/plans/active/2026-05-08-visibility-decision-and-portal.md`
