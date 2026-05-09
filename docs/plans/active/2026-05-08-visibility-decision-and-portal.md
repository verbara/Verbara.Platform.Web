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

By end of this plan: Web has (a) an Accepted ADR formalizing Decision 3 (mirror of Platform ADR-0018) with shared trigger checklist, (b) README updated to clarify current visibility, (c) Tier 0.5 portal page designed (form + flow) ready to wire up once the issuer service exists, (d) public-facing licensing pages (`/legal/eula`, `/legal/privacy`, `/legal/terms`) skeleton.

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

## Phase 1 — Tier 0.5 Developer portal page (Wk 2-3, ~10-15h)

### 1.1 — Page design

- [ ] Spec page route `/developer-license` (public, on `verbara.io` apex when launched, mirrored as a draft route in this repo for dev)
- [ ] Form fields: email (required), full name (required), company (optional), use case (optional, free text), checkbox "I agree to EULA + Privacy"
- [ ] Honeypot + reCAPTCHA invisible v3 (anti-spam baseline)
- [ ] Success state: "Check your email — you'll receive a 30-day developer license within 5 minutes. To extend, request a renewal from this same form anytime."
- [ ] Error states: invalid email, rate-limited (1 license per email per 30 days), service down

### 1.2 — Page implementation

- [ ] React component `src/pages/legal/DeveloperLicense.tsx`
- [ ] React Hook Form + Zod schema for validation
- [ ] TanStack Query mutation hooks/`useRequestDeveloperLicense.ts` posting to issuer endpoint (URL configurable via env var; placeholder until issuer service exists)
- [ ] Vitest unit test for component + hook
- [ ] Playwright E2E test stubbed (skipped until issuer service exists)
- [ ] i18n strings: en-US, es-419, pt-BR per existing parity gate

### 1.3 — Issuer service contract (this side: define what we call)

- [ ] Document `POST https://issuer.verbara.io/api/developer-license` contract:
  - Request: `{ email, fullName, company?, useCase?, eulaAccepted: true, captchaToken }`
  - Response 202: `{ requestId, message: "License will be emailed shortly" }`
  - Response 429: rate-limited
  - Response 4xx: validation error per field
- [ ] Issuer service implementation deferred to Pro plan / separate `verbara-licensing-issuer` repo

**Phase 1 exit:** portal page implemented + tested; issuer integration ready to wire when service exists.

---

## Phase 2 — Public-facing legal pages (Wk 3, ~6-8h)

### 2.1 — Page skeletons (content waits for lawyer)

- [ ] `/legal/eula` — placeholder page that renders the EULA.md from Pro repo (or fetches via build-time copy)
- [ ] `/legal/privacy` — placeholder until Privacy Policy drafted (Pro plan Phase 1.1)
- [ ] `/legal/terms` — Terms of Service for SaaS tiers (Tier 3-5 hosted)
- [ ] Footer link on every page → `/legal/*` routes

### 2.2 — Pricing page (Tier 0 → 5 visualized)

- [ ] `/pricing` — public page rendering the 6 tiers (Tier 0 free, Tier 0.5 free → CTA "Get developer license", Tier 1+ → Stripe Payment Link or contact sales)
- [ ] Match Pro plan Phase 2 ADR (canonical 6-tier model)
- [ ] Tier comparison feature matrix table (which Pro features each tier unlocks)
- [ ] i18n parity for the 3 locales

**Phase 2 exit:** legal + pricing surface area exists, content ready to fill in as Pro plan Phase 1 (EULA) ships.

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
- [ ] Wire Tier 0.5 portal to live issuer endpoint
- [ ] Wire `/legal/*` pages to actual lawyer-drafted EULA/Privacy/ToS

### 4.2 — Launch checklist

- [ ] HN "Show HN" post (open-core honest contact center)
- [ ] verbara.io blog post
- [ ] Twitter/Mastodon announcement
- [ ] ProductHunt scheduled

**Phase 4 exit:** Web is public, Apache 2.0, portal live, customers can self-serve Tier 0.5 in <2 minutes.

---

## Risks & mitigations

| Risk                                                     | Mitigation                                                                                                       |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Issuer service not ready when portal page is             | Portal renders "Coming soon" state, captures email, queues for later issuance                                    |
| EULA not ready (lawyer slow)                             | `/legal/eula` shows "Coming soon — for licensing inquiries email licensing@verbara.io"                           |
| First public-launch traffic spike crashes issuer service | Issuer is on serverless (e.g. Cloudflare Workers / Lambda); rate-limit at ingress; queue-then-issue if backed up |
| Tier 0.5 form abused for spam                            | reCAPTCHA + 1-license-per-email-per-30-days + email verification (click link before .lic ships)                  |

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
