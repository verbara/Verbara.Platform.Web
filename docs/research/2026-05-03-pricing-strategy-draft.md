# Pricing strategy — public-page draft v0

**TL;DR:** Five-tier commercial model for the Asterisk Open-Core ecosystem (Community / Pro Self-Host / SaaS Business / SaaS Enterprise / White-label) priced against Genesys ($115-240/agent) and Five9 ($119-229/agent), with positioning **17% below market** at the entry tier and **near parity** at enterprise. License decision in [ADR-0006](../decisions/0006-license-and-commercial-tier-strategy.md). This is a v0 draft of the public pricing page; copy and structure will iterate before publication.

---

## Section 1 — Page hero (above the fold)

> # Open-source contact center, enterprise-ready engine.
>
> Self-host the full platform for free. Pay only when you need the enterprise overlays.
>
> [ Start self-host (free) ] [ Try hosted SaaS ] [ Talk to sales ]

**Subheadline candidates** (A/B):

- _"100% open-source UI and backend (Apache 2.0). Commercial license keys for the Pro engine. From $0 to enterprise — pay for what you actually use."_
- _"Vicidial-style transparency with Genesys-class operations. Without the per-minute Twilio bill."_

**Trust strip (logos when available):**

- "Built on `Verbara.Sdk` (MIT) — see the source on GitHub"
- "Apache 2.0 licensed Platform — auditable, no vendor lock-in"
- "Self-host or hosted — your choice"

---

## Section 2 — Tier comparison table (the centerpiece)

|                                    | **Community**                           | **Pro Self-Host**                                                      | **SaaS Business**                          | **SaaS Enterprise**                        | **White-label**                           |
| ---------------------------------- | --------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------ | ----------------------------------------- |
| **Price**                          | **Free**                                | **From $5,000/year** per cluster                                       | **$99 / agent / month**                    | **$249 / agent / month**                   | **From $5,000/year** + rev share          |
| **Best for**                       | Devs, evaluators, startups (1-3 agents) | PYMES, regulated industries (banks, hospitals, govt), data sovereignty | Mid-market 50-500 agents, BPOs, e-commerce | Fortune 500, telcos, mission-critical 24/7 | VARs, system integrators, regional telcos |
| **Hosting**                        | You host                                | You host                                                               | We host                                    | We host (with redundancy)                  | We host or you host                       |
| **Multi-tenant**                   | — (single tenant)                       | ✅ Unlimited                                                           | ✅ Unlimited                               | ✅ Unlimited                               | ✅ Unlimited                              |
| **Cluster (multi-server)**         | —                                       | ✅                                                                     | ✅                                         | ✅                                         | ✅                                        |
| **Real-time analytics**            | Basic                                   | ✅ Full                                                                | ✅ Full                                    | ✅ Full                                    | ✅ Full                                   |
| **Advanced routing (skills, IVR)** | Basic                                   | ✅                                                                     | ✅                                         | ✅                                         | ✅                                        |
| **Channels (11)**                  | All 11                                  | All 11                                                                 | All 11                                     | All 11                                     | All 11                                    |
| **AI assist + workflows**          | —                                       | ✅                                                                     | ✅                                         | ✅                                         | ✅                                        |
| **SSO (SAML / OIDC)**              | —                                       | ✅                                                                     | Basic                                      | ✅ Full enterprise                         | ✅ Full enterprise                        |
| **IP allowlist**                   | —                                       | ✅                                                                     | —                                          | ✅                                         | ✅                                        |
| **Audit log + compliance reports** | —                                       | ✅ Local                                                               | ✅                                         | ✅ SOC2/HIPAA/PCI ready                    | ✅                                        |
| **SLA**                            | — (best effort)                         | — (your infra)                                                         | **99.5%** uptime                           | **99.9%** uptime, custom available         | **99.9%** + custom                        |
| **Support**                        | Community forum                         | Email + forum (next-business-day)                                      | Business hours (M-F 9am–6pm)               | **24 / 7 / 365**, P1 < 15 min response     | Tier-2 partner + 24/7                     |
| **Dedicated CSM**                  | —                                       | —                                                                      | —                                          | ✅                                         | ✅                                        |
| **Custom branding / theming**      | —                                       | —                                                                      | Logo only                                  | Logo + colors                              | ✅ Full white-label                       |
| **Roadmap influence**              | —                                       | —                                                                      | —                                          | ✅                                         | ✅                                        |
| **Setup**                          | Self-service docs                       | License key delivery, install docs                                     | 1-2 hour onboarding call                   | Weeks white-glove implementation           | Reseller agreement + theming              |

**CTA row:**
| [ Get the source ] | [ Buy a license ] | [ Start free trial ] | [ Contact sales ] | [ Become a partner ] |

---

## Section 3 — Per-tier detail (cards / sections)

### 🧪 Community — Free

> **Self-host. No license keys. Apache 2.0.**

Everything you need to evaluate and run a small contact center on your own infrastructure. Source code, full UI, full backend — Apache 2.0 licensed.

**Includes:**

- Full Asterisk Platform backend (Apache 2.0)
- Full Asterisk Platform Web UI (Apache 2.0)
- All 11 communication channels (WhatsApp, SMS, Email, Voice, WebChat, Telegram, Messenger, Instagram, Twitter, RCS, Video)
- Basic analytics, single-tenant, single-server
- Community forum support

**Limits:**

- One organization (no multi-tenant)
- One server (no cluster)
- No advanced routing or AI workflows
- No SSO / IP allowlist
- No SLA (best effort)

**Get started:**

```bash
git clone https://github.com/verbara/Verbara.Platform
docker compose up
```

---

### 🏗️ Pro Self-Host — From $5,000 / year

> **Your infrastructure. Your data. Pro engine activated.**

For organizations that need data sovereignty, regulatory compliance (HIPAA, banking, government), or simply prefer to control their own infrastructure. We deliver a license key; you host.

**Adds to Community:**

- ✅ Multi-tenant isolation (run multiple organizations)
- ✅ Cluster mode (multi-server, high availability)
- ✅ Real-time analytics dashboard
- ✅ Advanced routing (skills, time-of-day, IVR builder)
- ✅ AI assist and workflow automation
- ✅ Audit log and compliance exports
- ✅ License gate enforcement (`Pro.Licensing` ECDSA-validated)
- ✅ Email and forum support (next-business-day)

**Pricing tiers:**
| Cluster size | Annual price |
|---|---|
| Up to 50 agents | $5,000 / year |
| 51 - 200 agents | $15,000 / year |
| 201 - 500 agents | $35,000 / year |
| 500+ agents | Contact sales |

**Includes 1-year of updates and email support. Renewable annually.**

[ Get a quote ] [ Request a license key ]

---

### 🏬 SaaS Business — $99 / agent / month

> **Hosted by us. Production-ready in days, not months.**

For mid-market operations that want to scale fast without managing infrastructure. Includes hosting, updates, monitoring, business-hours support, and the full Pro engine.

**Adds to Pro Self-Host:**

- ✅ Hosted infrastructure (we manage AWS/GCP)
- ✅ Automatic updates and security patches
- ✅ Daily backups + point-in-time recovery
- ✅ 99.5% uptime SLA (~3.6 hours/month max downtime)
- ✅ Business-hours support (Monday-Friday 9am-6pm in your timezone)
- ✅ Onboarding call (1-2 hours, scheduled)
- ✅ Basic SAML SSO

**What you save vs Five9 Core ($119/agent):** ~$2,400/year per 100 agents. Same tier of service.

**Pricing example:**
| Agents | Monthly | Annual |
|---|---|---|
| 50 | $4,950 | $59,400 |
| 100 | $9,900 | $118,800 |
| 250 | $24,750 | $297,000 |
| 500 | $49,500 | $594,000 |

[ Start 14-day free trial ] [ See full features ]

---

### 🏢 SaaS Enterprise — $249 / agent / month

> **Mission-critical operations. 24/7. Compliance-ready.**

For Fortune 500, banks, telcos, airlines, and any operation where downtime costs more than the contract. Premium SLA, dedicated CSM, certified compliance, custom integrations.

**Adds to SaaS Business:**

- ✅ **99.9% uptime SLA** (max ~43 minutes/month) — penalty credits if breached
- ✅ **24 / 7 / 365 support** — P1 response under 15 minutes (call, chat, email)
- ✅ **Dedicated Customer Success Manager** (named contact)
- ✅ Full SAML SSO + IP allowlist + custom auth
- ✅ Compliance reports: SOC 2 Type II, HIPAA BAA, PCI-DSS attestation
- ✅ Geo-redundant disaster recovery
- ✅ White-glove onboarding (4-8 weeks structured implementation)
- ✅ Roadmap influence (your asks get priority weighting)
- ✅ Custom SLA negotiable up to 99.99% with addtl cost

**Position vs market:**
| Vendor | Enterprise tier price |
|---|---|
| Genesys CX 4 | $240/agent/month |
| Five9 Ultimate | $229/agent/month |
| NICE CXone | $135-300/agent/month |
| **Asterisk SaaS Enterprise** | **$249/agent/month** |

Why we cost ~4% more than Genesys: **the source is fully auditable. No vendor lock-in. Your compliance team can verify every line.**

[ Talk to enterprise sales ] [ Request a custom demo ]

---

### 👔 White-label / Embedded — From $5,000 / year + revenue share

> **Your brand. Our engine. Built for resellers.**

For VARs, system integrators, regional telcos, and software companies that want to embed contact-center capabilities into their own product without building from scratch.

**Includes:**

- ✅ Everything in Enterprise
- ✅ Full white-label rights (remove Asterisk branding)
- ✅ Custom theming (logo, colors, custom domain)
- ✅ Reseller agreement with margin protection
- ✅ Tier-2 partner support (your team supports your customers; you escalate to us)
- ✅ Co-marketing opportunities

**Pricing model:**

- **Setup fee**: $5,000 - $50,000 / year (depending on scope and exclusivity terms)
- **Revenue share**: 10% - 30% of your contract value with your end customers (negotiable based on volume commitments)

[ Apply to the partner program ]

---

## Section 4 — Add-ons (orthogonal to tiers)

| Add-on                                                                                    | Price                                | Description                                                                    |
| ----------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------ |
| **Professional Services**                                                                 | $250 / hour                          | Custom integrations, migrations from competitors, performance tuning           |
| **Training (live)**                                                                       | $1,500 / course (up to 12 attendees) | Admin, agent, supervisor curricula                                             |
| **Certification**                                                                         | $500 - $2,000 / certification        | Asterisk Platform Administrator, Solution Architect, Implementation Specialist |
| **Custom Integrations**                                                                   | Project-priced                       | CRM connectors (HubSpot, Salesforce, Zoho), payment gateways, ticketing        |
| **Compliance acceleration**                                                               | Project-priced                       | HIPAA BAA execution, PCI-DSS attestation support, SOC 2 audit prep             |
| **Premium support upgrade** (Business → Enterprise SLA without other Enterprise features) | $50 / agent / month                  | For Business customers needing 24/7 only                                       |

---

## Section 5 — FAQ (public)

**Q: Is the source code really fully open?**
A: Yes. `Verbara.Sdk` is MIT-licensed. `Verbara.Platform` (backend) and `Verbara.Platform.Web` (UI) are Apache 2.0. You can inspect, modify, fork, and redistribute. The only commercial component is `Verbara.Sdk.Pro`, which provides enterprise overlays (multi-tenant, advanced analytics, cluster, license gate). You only need it if you want those features — Community tier runs without it.

**Q: What happens if I don't renew my Pro license?**
A: At expiry, the `LicenseGateMiddleware` puts the system into read-only mode. No data loss. Renew within 30 days to restore full functionality. After 90 days the system requires re-installation against a fresh license key.

**Q: Can I migrate from Self-Host to SaaS later?**
A: Yes. Database export/import is documented. Plan on a 1-2 day migration window for typical clusters; we provide migration support as part of any SaaS Business or Enterprise contract.

**Q: Can I migrate from SaaS back to Self-Host?**
A: Yes. Full data export at any time as part of every SaaS contract — no lock-in. Self-Host license discount available for in-flight conversions.

**Q: What if the company disappears?**
A: Apache 2.0 means the source survives. The community can fork and continue. For Pro features, license keys remain valid until expiry; we maintain a public commitment to release Pro source code under Apache 2.0 if the company ceases operations (escrow agreement available for Enterprise customers on request).

**Q: Do you offer a free trial of the SaaS tiers?**
A: Yes. SaaS Business has a 14-day free trial with full features. SaaS Enterprise trials are scheduled with sales (typically 30 days, scoped to a pilot use case).

**Q: How does pricing scale?**
A: SaaS tiers price per active agent (concurrent seat). Self-Host prices per cluster regardless of agent count up to the cluster size limit. White-label is custom-priced based on volume.

**Q: Are there volume discounts?**
A: Yes for Business (tiered at 250+ and 500+ agents) and negotiable for Enterprise (typically 10-25% off list at >1000 agents).

---

## Section 6 — Internal operational notes (NOT public)

### Pricing rationale (per ADR-0006)

| Tier            | Pegged to                                                         | Position                                          |
| --------------- | ----------------------------------------------------------------- | ------------------------------------------------- |
| Community       | OSS competitors (Vicidial, Erxes — both AGPL self-host)           | Match (free)                                      |
| Pro Self-Host   | Sangoma Asterisk PBX commercial support                           | Higher feature density at similar price           |
| SaaS Business   | Five9 Core ($119), Genesys CX 2 ($115)                            | **17% below** to attract switchers                |
| SaaS Enterprise | Five9 Ultimate ($229), Genesys CX 4 ($240), NICE CXone ($135-300) | **Near parity** with differentiator (open source) |
| White-label     | Twilio Partner Program revenue model                              | Match (rev share + setup fee)                     |

### Margin assumptions

| Tier            | Cost / unit / month                                          | Margin |
| --------------- | ------------------------------------------------------------ | ------ |
| Pro Self-Host   | $50/year amortized (license key generation, support load)    | ~95%   |
| SaaS Business   | $15-25 / agent (AWS infra + business-hours support)          | 75-85% |
| SaaS Enterprise | $80-100 / agent (24/7 support staff + redundant infra + CSM) | ~60%   |
| White-label     | $30 / agent (tier-2 support, partner enablement)             | ~80%   |

### Year-1 funnel target (per ADR-0006 financial analysis)

- **GitHub visitors / month:** 1,000 (organic + content marketing)
- **Initiate Community evaluation / month:** 100 (10%)
- **Pass legal review / month:** 95 (Apache 2.0 has near-zero friction)
- **Demo scheduled / month:** 30
- **Pilot to paid conversion / month:** 3
- **Average deal size:** $30k ARR (mix of Pro Self-Host + SaaS Business)
- **Year-1 ARR target:** $255,000

### Year 2-3 ARR targets

| Year   | ARR target | Mix                                                  |
| ------ | ---------- | ---------------------------------------------------- |
| Year 1 | $255k      | 5 Pro + 3 Business + 1 White-label                   |
| Year 2 | $3.5M      | 25 Pro + 20 Business + 2 Enterprise + 5 White-label  |
| Year 3 | $25.85M    | 80 Pro + 80 Business + 8 Enterprise + 15 White-label |

NRR target: > 110% (upgrades from Self-Host → SaaS, Business → Enterprise drive year-over-year growth).

### Capabilities required for full pricing-page launch

| #   | Capability                                                   | Status                              | Owner                          | Estimated effort |
| --- | ------------------------------------------------------------ | ----------------------------------- | ------------------------------ | ---------------- |
| 1   | Pricing page (this doc → web component)                      | Not started                         | Web team                       | 1-2 weeks        |
| 2   | Stripe Billing integration (Business / Enterprise auto-bill) | Not started                         | Platform team                  | 2-3 weeks        |
| 3   | Self-service license key generator portal                    | Not started                         | Pro / Web team                 | 3-4 weeks        |
| 4   | SaaS tenant onboarding wizard                                | Partial (multi-tenant infra exists) | Web team                       | 4-6 weeks        |
| 5   | Trial provisioning (14-day Business trial)                   | Not started                         | Platform / Web                 | 2-3 weeks        |
| 6   | Public docs site for self-host installation                  | Not started                         | Docs team                      | 2 weeks          |
| 7   | Reseller partner portal                                      | Not started                         | Year-2+                        | 6-8 weeks        |
| 8   | Compliance program (SOC 2 Type II audit)                     | Not started                         | Year-2 (pre-Enterprise launch) | 6-12 months      |
| 9   | CSM tooling (HubSpot or similar)                             | Not started                         | When 5+ Enterprise customers   | 1 week setup     |
| 10  | Renewal automation + churn alerts                            | Not started                         | When 20+ paying customers      | 2-3 weeks        |

**Critical path for revenue start:** items 1, 2, 3, 5, 6 = ~12 weeks of work before Tier 2/3 can self-serve. Tier 4 (Enterprise) and Tier 5 (White-label) can launch with sales-led motion before automation is built.

### Decisions still open

- **Pricing in non-USD currencies** (EUR, BRL, MXN local pricing for LATAM market): defer to launch + 90 days; observe demand by geography.
- **Annual prepay discount**: industry standard is ~15-20% discount for annual prepay vs monthly billing. Recommend 17% (matches monthly-to-annual savings of buyers and is psychologically meaningful).
- **Free trial card requirement**: require credit card at trial signup or not? Recommend **not** for Community + Self-Host (no charge); **yes** for SaaS Business trial (reduces no-shows and tire-kickers).
- **Education / non-profit pricing**: defer to year 2; common to offer 50% discount but volume is small.
- **Open-source maintainer / contributor benefit**: optional. Could offer free Pro Self-Host (up to 50 agents) to OSS project maintainers as community-building gesture. Decide post-launch based on contributor base.

### Brand and positioning notes

- **"Open-Core honest"** is the core positioning vs Twilio (closed) and Vicidial (AGPL but rough).
- **"Auditable backend"** is the differentiator vs Genesys/Five9 (closed binaries).
- **"From $0 to enterprise"** is the journey narrative (matches the 5-tier funnel).
- Avoid claiming "open source" without qualifier — Pro is commercial. Always say _"open-source platform + commercial enterprise engine"_ or similar.
- Do not compare on per-minute cost vs Twilio (different pricing model — apples to oranges); compare on total cost of ownership for a typical 100-agent operation.

### Things that are NOT in scope for this draft

- Marketing site copy beyond the pricing page (separate project).
- Localized pricing pages (single English version v0).
- Pricing comparison calculator widget (post-launch).
- Public dashboard of customer logos / testimonials (need actual customers first).

---

## Sources

Pricing benchmarks (May 2026):

- Genesys Cloud CX pricing — Platform28 [link](https://www.platform28.com/blog/genesys-cloud-pricing-guide)
- Five9 pricing — Platform28 [link](https://www.platform28.com/blog/five9-pricing-guide)
- Genesys ARR Q3 FY26 ($2.4B, +33% YoY) — investor reporting
- NICE CXone market share (22.3%) — Metrigy 2025
- Open-source CCaaS landscape (Vicidial, Erxes, FreeSWITCH, OSDial) — vicistack.com industry guide

Licensing analysis:

- Open Core Ventures — "AGPL is a non-starter for most companies" (2024)
- Termsfeed — "Legal Risks of Source-Available Licenses: SSPL, BSL, and Beyond" (2024)
- ADR-0006 in this repo — full decision rationale
