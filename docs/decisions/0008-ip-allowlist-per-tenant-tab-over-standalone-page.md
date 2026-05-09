# ADR-0008 — IP Allowlist: per-tenant tab over standalone admin page

**Status:** Accepted
**Date:** 2026-05-08
**Supersedes:** none
**Context track:** Track 7A — IP Allowlist UI (originally planned for `v1.20.0-web`)

## Context

The roadmap entry for Track 7A (`docs/plans/active/2026-05-03-v1.14.x-operational-foundation-roadmap.md`) called for:

- A standalone admin page at `/admin/security/ip-allowlist`
- A sidebar entry under "Security"
- Permission gating `system:tenant:configure`
- Hook `use-tenant-ip-allowlist.ts`

When Track 4A (Tenant Lifecycle UI, shipped `v1.17.0-web`) was implemented, IP allowlist functionality was instead placed as a **tab inside `tenant-detail-page`** with feature gating via `enabledFeatures.includes('IpAllowlist')`. The tab provides full CRUD: list entries, add CIDR (Zod-validated), remove with confirm dialog. Hooks are per-tenant only (`useIpAllowlist(tenantId)`, `useAddIpAllowlistEntry(tenantId)`, `useRemoveIpAllowlistEntry(tenantId)`).

When Track 7A came up for execution post-Nivel 6, the audit revealed:

1. The backend exposes only **per-tenant endpoints** (`/api/v1/management/tenants/{id}/ip-allowlist`). No cross-tenant aggregation endpoint exists.
2. A standalone `/admin/security/ip-allowlist` page would need to either:
   - **(a)** Show the active tenant's allowlist — redundant with the tenant-detail tab (same content, second URL).
   - **(b)** Show all tenants' allowlists in a flat table — a different value proposition (cross-tenant superadmin audit), which requires a backend endpoint that doesn't exist.
3. Track 4A's hook design (per-tenant only) supports option (a) but not (b).

## Decision

**Keep IP allowlist management as a per-tenant tab inside `tenant-detail-page`. Do NOT ship a separate standalone admin page.**

This closes Track 7A as functionally satisfied by Track 4A.

## Rationale

- IP allowlist is **per-tenant by data model.** Each tenant has its own list. There is no global "platform-wide allowlist" — that would be a different feature.
- The tenant-detail tab places the UI in the **right context.** When an operator manages a tenant's allowlist, they have already chosen which tenant they are operating on. The tab makes that context visible (tenant name in breadcrumb / page header) and keeps the URL canonical (`/admin/tenants/{id}` with the IP Allowlist tab active).
- A standalone page that operates on "the current tenant" introduces UX ambiguity ("which tenant is this for?") and duplicates a navigation path with no functional gain.
- A standalone cross-tenant audit page (option (b)) would be a separately-valuable feature, but it requires backend coordination (cross-tenant aggregation endpoint) and is **scope creep** for this track. If demand emerges, open a follow-up track with explicit backend coordination.

## Consequences

**Positive:**

- No code work needed for Track 7A — already shipped.
- UX consistency: per-tenant features live under tenant-detail-page (matches tenant settings, retention policy, billing tab patterns).
- Hooks are minimal and focused (per-tenant only).

**Negative / accepted:**

- The roadmap entry for Track 7A is technically not satisfied to-the-letter (no `/admin/security/ip-allowlist` page; no sidebar entry). Reconciled by this ADR.
- If a future need emerges for cross-tenant audit, that feature must be opened as its own track with backend coordination — it cannot be retroactively claimed as Track 7A scope.

## Alternatives considered

- **Ship a thin redirect page** at `/admin/security/ip-allowlist` listing tenants with the IpAllowlist feature enabled, deep-linking to each tenant's tab. **Rejected:** cosmetic only, adds maintenance surface for ~zero user value. Tenant list page already exists at `/admin/tenants`; an IP-allowlist-filtered view of it is achievable via a column filter if needed later.
- **Ship a cross-tenant aggregation page** (option (b)). **Rejected:** out of scope without backend endpoint. Open a separate track if demand emerges.

## Closure

Track 7A is marked DONE 2026-05-08, satisfied by Track 4A's `<IpAllowlistTab>` (commit history under `src/admin/tenants/`). No tag, no version bump (Track 4A's `v1.17.0-web` already covered the functional shipment).

Roadmap entry updated to reference this ADR. Memory and CLAUDE.md updated to reflect Track 7A as ✅ DONE via 4A.
