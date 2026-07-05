# ADR-0006: License + Commercial Tier Strategy + Rebrand to Verbara

- **Status:** Accepted
- **Date:** 2026-05-03
- **Deciders:** Verbara maintainer (Harol A. Reina H.)
- **Related:** ADR-0003 (Operational Foundation priority), Track 1A in [v1.14.x roadmap](../plans/completed/2026-05-03-v1.14.x-operational-foundation-roadmap.md), planning doc `resolvamos-qu-license-para-kind-trinket.md` (local Claude Code plan notes, not part of this repo)

## Context

Track 1A (v1.14.0) requires shipping a `LICENSE` file for `Asterisk.Platform.Web`. The repo had no license declaration and `package.json` lacked a `license` field. Without a published license, contributions cannot be accepted, the repo cannot be made publicly visible, and the migration matrix (also part of Track 1A) cannot reference a license per component.

The decision is bounded by these realities of the broader ecosystem:

| Repo                    | Existing license                    | Nature                                                                             |
| ----------------------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| `Asterisk.Sdk`          | MIT                                 | Open-source telephony primitives; community attractor                              |
| `Asterisk.Sdk.Pro`      | Commercial proprietary, ECDSA-gated | Enterprise overlays; the value engine                                              |
| `Asterisk.Platform`     | None (README says "Open-core")      | Full-featured commercial backend; runtime-requires Pro via `LicenseGateMiddleware` |
| `Asterisk.Platform.Web` | None                                | UI for the Platform; no Pro code embedded                                          |

A deep multi-pass analysis evaluated 35+ license options against three criteria: (1) coherence with the Sdk/Pro ecosystem, (2) friction to enterprise evaluation, and (3) actual revenue protection vs theoretical.

The initial proposal (BUSL-1.1 for Platform, Apache-2.0 for Web) was reversed after a financial analysis showed:

1. **Pro license keys (ECDSA validated by `LicenseGateMiddleware`) are the only enforceable moat at runtime.** Any source-license restriction (BSL, ELv2, AGPL) is paper enforcement requiring litigation — and BSL has zero court precedent globally as of May 2026.
2. **BSL adds 2-4 weeks of legal review on every enterprise evaluation.** Open Core Ventures (2024) reports AGPL is a "non-starter for most companies"; BSL is worse because it's non-OSI-approved (GitHub badge shows "Other") and unfamiliar to corporate legal teams.
3. **Funnel modeling** (1000 GitHub visitors/month → evaluation → legal review → conversion to Pro paid): Apache-2.0 yields ~3 conversions/month at $30k/customer = **$1.08M ARR**, vs BSL ~1.5 conversions = **$540k ARR**. Apache-2.0 generates ~2× the ARR.
4. **CCaaS market reality** (NICE 22.3% share, Genesys $2.4B ARR +33% YoY): no successful CCaaS competitor uses BSL/source-available licenses. The market is bipolar: AGPL community plays (Vicidial, Erxes — infrautilized in enterprise) vs fully closed proprietary (Twilio, Genesys, Five9). Apache + commercial Pro engine + hosted SaaS is an unoccupied sweet spot.
5. **Single-founder risk profile**: BSL non-compete enforcement against a foreign competitor costs $150k-500k in legal fees, 1-3 years, with uncertain outcome. Not viable pre-revenue.

The decision must also include a commercial tier structure, because the license alone does not generate revenue — the tier model does. The license enables the model.

## Decision

### Rebrand: Asterisk → Verbara

The product family is rebranded to **Verbara** (verbara.io). Triggers for the rebrand:

1. **Trademark conflict.** "Asterisk" is a registered trademark of Sangoma Technologies / Digium (acquired Digium in 2018). FreePBX had to rename in v2.0 for the same reason. Continuing to use "Asterisk" in product names exposes the project to cease-and-desist and forced rename post-launch.
2. **Brand independence.** "Verbara" is from Latin _verbum_ ("word") + suffix _-ara_. Strong communication semantic, Spanish/Portuguese-friendly (matches LATAM market focus), and defensible legally as an invented word.
3. **Domain availability.** `verbara.io`, `verbara.dev`, `verbara.app` available; `.com` parked at squatter (acquirable later).
4. **Verification.** GitHub username `verbara` available; no major brand conflict in CCaaS or telecom space; USPTO basic search clean.

Effective immediately: all new branding, public materials, and licenses use **Verbara**. Repository names (`Asterisk.Sdk`, `Asterisk.Sdk.Pro`, `Asterisk.Platform`, `Asterisk.Platform.Web`) remain temporarily as a transitional state and will be renamed to `verbara-sdk`, `verbara-sdk-pro`, `verbara-platform`, `verbara-web` in a coordinated rebrand track post-Track 1A. Internal package names (e.g., `asterisk-platform-web` in `package.json`) follow the same migration plan.

### License (per repo)

| Repo (current name)                 | Future name        | License                                | Notes                                                                                         |
| ----------------------------------- | ------------------ | -------------------------------------- | --------------------------------------------------------------------------------------------- |
| `Asterisk.Sdk`                      | `verbara-sdk`      | **MIT** (no change)                    | Already published                                                                             |
| `Asterisk.Sdk.Pro`                  | `verbara-sdk-pro`  | **Commercial proprietary** (no change) | Already published, ECDSA license keys enforce                                                 |
| `Asterisk.Platform`                 | `verbara-platform` | **Apache License 2.0**                 | NEW — supersedes ambiguous "open-core" mention in README                                      |
| `Asterisk.Platform.Web` (this repo) | `verbara-web`      | **Apache License 2.0**                 | NEW — `package.json` license field set to `"Apache-2.0"`; LICENSE/NOTICE/CONTRIBUTING shipped |

Copyright line: `Copyright 2026-present Harol A. Reina H. and Verbara Contributors` for all new license files. Year format `YYYY-present` per industry convention for living repositories.

CLA (Contributor License Agreement) is **not required at day 1** for either Apache repo. Apache 2.0's outbound license is sufficient. We use **DCO** (Developer Certificate of Origin) via `git commit -s` instead — lighter weight, used by Linux Kernel and Docker. CLA can be introduced later if a future re-licensing (e.g., dual Apache + AGPL) requires it.

### Identity infrastructure

- **Domain:** `verbara.io` (primary)
- **Email aliases (Cloudflare Email Routing, free):**
  - `legal@verbara.io` — copyright disputes, DMCA, legal matters
  - `security@verbara.io` — vulnerability disclosure (RFC 9116)
  - `licensing@verbara.io` — commercial license inquiries, partnerships
  - `hello@verbara.io` — general contact
- **GitHub organization:** `github.com/verbara` (under personal account until LLC formed)
- **Brand:** `Verbara`. Tagline: _"Open-core honest contact-center platform — auditable engine, commercial overlays."_

### Commercial tier structure

Five-tier monetization, designed to match the price-point bands of Genesys and Five9 in CCaaS:

| Tier                          | Price                                 | Includes                                                                                                            | Target customer                                                               | Margin     |
| ----------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------- |
| **1. Community**              | $0                                    | Self-host Platform + Web (Apache); no Pro key → no multi-tenant, no analytics, no cluster                           | Devs, hobbyists, startups (1-3 agents), evaluators                            | — (funnel) |
| **2. Pro Self-Host**          | $5k–50k/year per cluster              | Pro license key (ECDSA), all Pro features, email/forum support                                                      | PYMES, regulated industries (banks, hospitals, govt) needing data sovereignty | ~95%       |
| **3. SaaS Business**          | $99/agent/month                       | Tier 2 + hosted infra, business-hours support, 99.5% SLA, basic SAML                                                | Mid-market (50-500 agents), BPOs, e-commerce                                  | 60-80%     |
| **4. SaaS Enterprise**        | $249/agent/month                      | Tier 3 + 24/7 support, 99.9% SLA, dedicated CSM, SAML+IP allowlist, compliance reports (SOC2/HIPAA/PCI), custom SLA | Fortune 500, banks, telcos, critical operations                               | ~60%       |
| **5. White-label / Embedded** | $5k–50k/year setup + 10–30% rev share | Tier 4 + branding removal, custom theming, reseller agreement, tier-2 partner support                               | VARs, system integrators, regional telcos                                     | ~90%       |

Add-ons (orthogonal to tiers): Professional Services ($250/hr), Training ($1500/course), Certifications ($500-2000), Custom Integrations (project-priced).

Pricing rationale (pegged to market, May 2026):

- Tier 3 ($99) is **17% below Five9 Core** ($119) and **14% below Genesys CX 2** ($115) — clear "easy switch" angle.
- Tier 4 ($249) is **near parity with Genesys CX 4** ($240) and **9% above Five9 Ultimate** ($229) — premium justified by differentiator (open-source backend + commercial overlays).
- Tier 2 (Self-Host) covers PYMES and compliance-bound buyers that no major CCaaS competitor serves well.

### Differentiator narrative

> _"Asterisk Open-Core: 100% open-source platform (Apache) + commercial enterprise engine (Pro). Self-host free or hosted from $99/agent. Pay only for the engine, never for the UI or the backend base."_

Distinguishes from Twilio (closed, per-minute), Genesys/Five9/NICE (closed, per-seat with no source visibility), and Vicidial/Erxes (AGPL but infrautilized in enterprise due to OSS friction).

### Future re-licensing path (optional, year 3+)

If post-launch a major cloud provider strip-mines the Platform as managed service AND ARR exceeds $5M, the path forward is **Triple licensing** (modeled on Elastic 2024 and Redis 2025): keep historical versions under Apache, ship new versions under AGPL-3.0 + commercial exception. This requires CLA from contributors at the time of the change. Not in scope today.

## Consequences

**Positive:**

- Maximizes evaluator-to-Pro-customer conversion funnel (~2× vs BSL based on legal-review-friction analysis).
- Zero legal infrastructure overhead at day 1 — no CLA infrastructure, no "Additional Use Grant" wording, no Change Date strategy. Estimated 6-8 weeks of engineering time recovered.
- Apache 2.0 is OSI-approved, recognized by every enterprise compliance team, badge displays cleanly on GitHub. Removes a soft barrier to first-touch evaluation.
- Apache 2.0's explicit patent grant protects both contributors and downstream users — relevant for a UI with substantial original code (60+ pages, 28 components, 54 hooks).
- The 5-tier commercial structure leverages the existing `LicenseGateMiddleware` + `PlanFeature` enum + `Pro.MultiTenant` infrastructure. No new technical investment required to start tiering customers.
- Reversible at-the-top: if revenue grows and competitive pressure justifies, can move to AGPL or BSL via triple-licensing model — at which point the company has revenue, brand, and customer relationships to defend the change.

**Negative:**

- Forfeits the (theoretical) "first BSL CCaaS" marketing angle. Analysis concluded the angle is not material for actual buyers, who evaluate by features/price/SLA/AI/compliance, not by license model.
- Apache 2.0 in theory allows a well-funded competitor to fork the Platform + Web and reverse-engineer Pro to offer a competing managed service. In practice this requires 12-18 months of engineering, brand-building, and certification work — comparable barriers to any other CCaaS startup. The Pro ECDSA gate remains as the binary-level moat.
- No source-level non-compete protection. Mitigation: Pro license key enforcement at runtime, plus the option to dual-license later if conditions warrant.

**Trade-off:**

- Trades theoretical legal protection (BSL non-compete) for measurable adoption velocity (Apache zero-friction). Given pre-revenue stage and single-founder constraints, this favors revenue acceleration over defense of an asset that does not yet generate revenue. Acceptable.

## Alternatives considered

- **MIT for both Platform and Web.** Rejected because Apache 2.0 adds explicit patent grant + NOTICE attribution mechanism without meaningful adoption cost. For a substantial codebase (Platform 19 197 LOC, Web 60+ pages original UI), patent protection is materially valuable.

- **AGPL-3.0 for Platform.** Rejected because Open Core Ventures (2024) and multiple sources confirm AGPL is rejected at corporate policy level by 40-60% of enterprise buyers. AGPL would protect against SaaS strip-mining but at the cost of approximately half the addressable market in enterprise CCaaS.

- **BUSL-1.1 + Commercial dual + CLA for Platform.** Initially recommended in the planning analysis (V1). Rejected after funnel modeling and risk analysis revealed: (a) zero court precedent for BSL enforcement globally, (b) 2-4 weeks added to enterprise legal review on every evaluation, (c) ~50% reduction in legal-review pass-through rate, (d) 6-8 weeks of legal infrastructure setup pre-launch. The runtime ECDSA gate (already implemented in Pro) provides equivalent protection without any of these costs.

- **Elastic License v2 (ELv2) for Platform.** Rejected for the same reasons as BSL plus: ELv2 is widely associated with re-licensing controversy (Elastic 2021, Redis 2024, MinIO 2024) and triggers immediate suspicion from buyers who remember those events. Starting day 1 with ELv2 would inherit the negative brand association without earning it.

- **Closed proprietary for both Platform and Web (matching Sdk.Pro).** Rejected. Eliminates evaluation funnel entirely, requires a sales motion before any product touch, and removes the "open-core honest" differentiator that distinguishes from Twilio/Genesys. Closed source is appropriate where the IP itself is the moat (Sdk.Pro algorithms, license keys); for the UI and integration layer, openness is a feature.

- **Single-tier commercial pricing (one-size-fits-all).** Rejected because it caps revenue per Enterprise customer (a Genesys-class deal can be $1-15M/year vs. an SMB self-host $5-15k) and simultaneously prices out small evaluators. Five tiers match the natural segmentation of the CCaaS market by company size and operational criticality.

- **Tags inside the same tier instead of separate tiers** (e.g., one SaaS plan with optional add-ons). Rejected because the 99.5% vs 99.9% SLA gap, the 24/7 vs business-hours support gap, and the dedicated CSM are all binary choices with substantially different cost structures — they should be priced as separate tiers to align cost with revenue.
