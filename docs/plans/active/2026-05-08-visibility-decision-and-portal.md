# Web Visibility Decision (Decision 3) + Customer Portal Surface

**Created:** 2026-05-08
**Status:** Active (planning, not yet executed)
**Repo:** `/media/Data/Source/Verbara/Verbara.Platform.Web/`
**Origin:** Cross-repo licensing & visibility audit run 2026-05-08 in `Verbara.Sdk` session. Full findings in SDK auto-memory `project_2026_05_08_licensing_audit.md`.

## Context

`Verbara.Platform.Web` declares **Apache 2.0** license in `LICENSE`, README, and ADR-0006 (Accepted 2026-05-03). README opens with _"Frontend for the Verbara open-core contact-center platform"_. ADR-0006 builds the financial model on the premise of public visibility:

> _"Funnel modeling (1000 GitHub visitors/month → evaluation → legal review → conversion to Pro paid): Apache-2.0 yields ~3 conversions/month at $30k/customer = $1.08M ARR, vs BSL ~1.5 conversions = $540k ARR. Apache-2.0 generates ~2× the ARR."_

But the GitHub repo is **private**. The Apache 2.0 license is not breached by being private (it only governs distribution), but the strategic rationale documented in ADR-0006 cannot operate while the repo is unobservable.

This plan mirrors the Platform plan (`Verbara.Platform/docs/plans/active/2026-05-08-visibility-decision-and-alignment.md`) for the Web side, and additionally surfaces Web-specific work: the **Tier 0.5 Developer auto-issue portal** (the form that lets evaluators self-serve a free Pro license) is a Web concern even though the issuer service lives elsewhere.

## Goal

By end of this plan: Web has (a) an Accepted ADR formalizing Decision 3 (mirror of Platform ADR-0018) with shared trigger checklist, (b) README updated to clarify current visibility, (c) trigger checklist tracked toward the coordinated public flip with Platform.

**Out of scope (clarified 2026-05-09):** the Tier 0.5 Developer portal, public legal pages, and pricing page do NOT live in this repo. They belong on the future verbara.io marketing site (separate repository). This repo is the contact-center operator UI; it serves authenticated customers, not public prospects. See "Phase 1 + Phase 2 — REMOVED" below.

## Non-goals

- **Flipping visibility today** — gated by trigger checklist
- **Building the issuer backend** — owned by Pro plan / verbara.io stack
- **Pro EULA writing** — owned by Pro plan
- **Pricing UI / billing flow** — Tier 1+ today is Stripe Payment Link out-of-app, not in Web

---

## Phase 0 — ADR foundation (Wk 1, ~3h)

### 0.1 — Write ADR-0007: Visibility Decision (Decision 3)

- [x] New ADR `docs/decisions/0007-visibility-decision-3-private-now-public-on-trigger.md` — **DONE 2026-05-08**
- [x] Status: Accepted — **DONE**
- [ ] Mirror Platform ADR-0018 structure with Web-specific considerations:
  - **Context** — Apache 2.0 chosen per ADR-0006 with funnel rationale; repo currently private; this ADR documents the gap
  - **Decision** — Web stays private until trigger checklist met (shared with Platform); flip is coordinated cross-repo
  - **Trigger checklist** — same 7 triggers as Platform ADR-0018 (gitleaks clean / Op Foundation closed / security review / threat model / LicenseGuard hardened / verbara.io setup / first customer)
  - **Web-specific consequences** — exposes 60+ pages of UI/UX (per ADR-0006 §metrics), 879 Vitest + 64 Playwright tests; competitors can copy UX but not branding (trademark) or backend (LicenseGuard binary moat)
  - **Alternatives considered** — same as Platform ADR-0018
  - **References** — ADR-0006, Platform ADR-0018, this plan, audit memory

### 0.2 — README addendum (transparency)

- [x] Add visibility-status note near top of README (after rebrand block) — **DONE 2026-05-08**:

  ```
  > **Visibility status:** This repository is currently private. The Apache 2.0
  > license has been chosen (see [ADR-0006](docs/decisions/0006-license-and-commercial-tier-strategy.md))
  > with a planned transition to public when all triggers in
  > [ADR-0007](docs/decisions/0007-visibility-decision-3-private-now-public-on-trigger.md)
  > are met. Tier 0 (Community) self-host becomes available at that time.
  ```

- [ ] Audit the rest of the README for present-tense public claims; adjust to future-tense where needed — **TODO** (low priority)

**Phase 0 exit:** ADR-0007 Accepted; README clarifies current status.

**Phase 0 status 2026-05-08:** 0.1 ✅ DONE / 0.2 ✅ DONE (full README sweep deferred).

---

## Phase 1 + Phase 2 — REMOVED (scope correction 2026-05-09)

**Original (incorrect) scope:** build the Tier 0.5 Developer portal (`/developer-license`), the legal pages (`/legal/eula`, `/legal/privacy`, `/legal/terms`), and the public pricing page (`/pricing`) inside this repository.

**Correction (maintainer-flagged 2026-05-09):** these are **public marketing-site pages** that belong on `verbara.io`, NOT inside `Verbara.Platform.Web`.

Why this was wrong:

- `Verbara.Platform.Web` is the **operator UI** of the contact-center product. Its routes (`/admin/*`, `/agent/*`, `/operations/*`, `/analytics/*`, plus auth flows `/login` / `/setup`) are all in-product surfaces consumed by deployed customers' operators and agents.
- Public marketing pages (pricing, EULA, license-request portal) are consumed by **prospects who have not yet adopted the product**. Bundling them into the operator UI conflates two audiences, increases bundle size, and creates a confusing surface (operators looking up settings should not be one click away from a "buy now" page).
- The verbara.io marketing site is a separate concern with its own repository, deploy, and tech-stack choice (likely a static-site generator like Astro / Next.js / MkDocs, not a heavy SPA).

**Where this work moves instead:** a NEW separate repository for the verbara.io marketing site, to be created when verbara.io brand setup is in progress (per Platform ADR-0018 / this repo's ADR-0007 trigger 6). Suggested name: `verbara-website` or `verbara-marketing` (avoid `verbara-web` due to confusion with `Verbara.Platform.Web`).

**Pro Phase 3.3** (issuer API contract spec at `Verbara.Sdk.Pro/docs/specs/2026-05-09-developer-license-issuer-contract.md`) remains the authoritative consumer-side spec — when the marketing repo is built, its `/developer-license` page implements that contract. The spec is portable and does not depend on living in any particular repo.

**Phase 1 + 2 status 2026-05-09:** ❌ REMOVED from this plan. Tracked instead in the future verbara.io marketing repo. No work occurs in `Verbara.Platform.Web` for these pages.

---

## Phase 3 — Trigger checklist execution (parallel, shared with Platform)

Same 7 triggers as Platform ADR-0018; tracked there. Web-specific gating:

### Trigger 2.5 — Operational Foundation closed (Web-owned)

- This is `docs/plans/active/2026-05-03-v1.14.x-operational-foundation-roadmap.md`
- [ ] All v1.14.x track items green before visibility flip
- This plan does NOT duplicate that roadmap; treats it as gate

### Trigger 1 — gitleaks audit on Web repo

- [x] `gitleaks detect --source . --no-banner` on Web — **DONE 2026-05-08**: 0 findings (581 commits scanned)
- [x] Web is React; lower secret-leak risk vs backend — confirmed clean. Audit documented in `docs/research/2026-05-08-gitleaks-audit.md`.

**Trigger 1 status: ✅ GREEN.**

---

## Phase 4 — The flip (Wk N, coordinated with Platform)

### 4.1 — Coordinated visibility flip

- [ ] Trigger checklist fully green per ADR-0007
- [ ] `gh api -X PATCH repos/verbara/Verbara.Platform.Web -f visibility=public`
- [ ] Re-enable secret scanning + push protection
- [ ] Verify no in-product surface accidentally exposes admin-only / billing internals to unauthenticated users (separate readiness task; out of scope for this checklist)
- (Removed: "Wire Tier 0.5 portal" / "Wire /legal/\* pages" — those live in the verbara.io marketing repo, not here)

### 4.2 — Launch checklist

(Marketing announcements — HN "Show HN", verbara.io blog, ProductHunt, social — coordinated from the marketing-site repo, not this one. They reference the now-public Platform.Web operator UI as one of the open-source artifacts of the Verbara stack, alongside SDK and Platform.)

**Phase 4 exit:** this repo is public + Apache 2.0; the operator UI is auditable by enterprise evaluators. The marketing-site launch (which is what evaluators actually visit first) is a separate gating event tracked in the marketing-site repo.

---

## Risks & mitigations

| Risk                                                                                                             | Mitigation                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marketing-site repo not started when this repo is ready to flip                                                  | Decoupled flip: this repo can flip public independently of the marketing site. Operators and evaluators reach this repo only after they have the product running.             |
| Confusion between "Verbara.Platform.Web" (this repo) and the future "verbara-website" / "verbara-marketing" repo | Naming: avoid `verbara-web` as the marketing repo name (collides). Document the distinction in the marketing-site repo's README + in this repo's README.                      |
| Operator UI exposes information meant only for authenticated users post-flip                                     | Pre-flip readiness check: confirm `AuthGuard` blocks all in-product routes; only `/login`, `/forgot-password`, `/reset-password`, `/setup`, `/unauthorized` remain anonymous. |

## Dependencies

- **Platform plan** `2026-05-08-visibility-decision-and-alignment.md` — coordinated flip, shared triggers
- **Pro plan** `2026-05-08-pro-licensing-eula-overhaul.md` — owns issuer service spec, EULA content, tier model ADR
- **Web v1.14.x Operational Foundation** — gate (trigger 2)

## Cross-references

- Audit findings: SDK auto-memory `project_2026_05_08_licensing_audit.md`
- Strategy default: SDK auto-memory `feedback_licensing_strategy.md`
- License decision: ADR-0006 (this repo, Accepted 2026-05-03) — NOT superseded by this plan
- Platform mirror ADR: ADR-0018 (Platform repo, when shipped)
- Stewardship pledge: SDK ADR-0027
