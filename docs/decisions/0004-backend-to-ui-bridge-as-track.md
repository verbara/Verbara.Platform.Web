# ADR-0004: Backend-to-UI Bridge as a dedicated track, not opportunistic per feature

- **Status:** Accepted
- **Date:** 2026-05-03
- **Deciders:** Platform.Web maintainer
- **Related:** [`docs/specs/2026-05-03-backend-to-ui-bridge-catalog.md`](../specs/2026-05-03-backend-to-ui-bridge-catalog.md), ADR-0003

## Context

A cross-repo audit comparing Platform's `*Endpoints.cs` files (71 endpoint files, ~95 HTTP mappings) against Web's `src/core/api/hooks/use-*.ts` (54 hooks) revealed that **32 endpoint surfaces have no corresponding Web hook**. Notable examples:

- Webhook subscriptions + delivery DLQ + retry inspector (full subsystem, zero UI)
- Recording streaming + transcoding test (player not built)
- Tenant lifecycle (create/suspend/restore from Partner Portal — basic only)
- Retention dry-run mode + scheduled purges
- Compliance workflow (audit dashboard, consent manager, subject rights)
- Notification rules admin (channel routing, escalation rules)
- Setup wizard advanced steps
- Partner billing analytics (call attempt aggregations, revenue breakdowns)
- Media streaming endpoints

Each endpoint represents shipped backend capability that Web simply does not expose. Customers cannot use features that are technically available — bugs they may want to file are silently swallowed because the entry point doesn't exist in the UI.

The historical pattern in this repo has been **opportunistic addition**: when a new feature requires an admin UI, that feature's hook is added at that moment. This worked when the gap was small. With 32 endpoints behind, opportunistic additions mean perpetual catch-up — the gap grows faster than it closes.

## Decision

Treat the Backend-to-UI Bridge as a **dedicated, scoped track** (Nivel 4 of the v1.14.x roadmap, target version `v1.17.x`). Specifically:

1. Catalog all 32 endpoint gaps in [`docs/specs/2026-05-03-backend-to-ui-bridge-catalog.md`](../specs/2026-05-03-backend-to-ui-bridge-catalog.md) with priority (customer-visible vs internal), UI pattern (CRUD form, dashboard, wizard, list), and reuse references.
2. Group endpoints into 5 sub-tracks by domain affinity:
   - 4A — Tenant lifecycle (Partner Portal)
   - 4B — Webhooks management
   - 4C — Recording player + archive
   - 4D — Compliance dashboard
   - 4E — Retention dry-run + Notification rules admin
3. Each sub-track ships with its own version bump and patch tag, then a track-closure tag (`v1.17.5-web`) marks completion.
4. Use subagent-driven development per sub-track (one subagent per domain), since the work is mechanically similar (hook + page + tests).

Acceptance criteria for the track: 32 endpoints sin hook → ≤ 5 endpoints sin hook (the rest with documented justification, e.g. internal-only diagnostics).

## Consequences

**Positive:**
- Customer-visible feature parity with backend in 15-20 days of focused work, vs months of opportunistic catch-up.
- Spec catalog becomes a permanent reference for "what does the backend offer that the UI exposes?". New backend endpoints get tracked in the catalog as they ship.
- Domain grouping (Webhooks, Recording, Compliance) means each sub-track has consistent UX language and can be reviewed as a coherent unit.
- Subagent parallelism is feasible because endpoints in the same domain share patterns.

**Negative:**
- The track is large (32 endpoints, ~5 sub-tracks). Risk of fatigue mid-track.
- Some endpoints are low-traffic and may not warrant dedicated UI; the spec must justify the "≤ 5 deferred" cases.
- New backend endpoints shipped during the track create moving-target risk — needs catalog updates as we go.

**Trade-off:**
- We are committing to "feature parity" as a quality bar, not just "what marketing demands". Some of the 32 endpoints (e.g. webhook DLQ inspector) are internal-tools UX, not customer-facing. Including them is a decision: we are saying internal tooling matters as much as customer features. This is a deliberate culture choice.

## Alternatives considered

- **Continue opportunistic addition.** Rejected. The gap has grown past the point where opportunism can close it. Opportunistic addition also produces inconsistent UX — each feature gets its own pattern.
- **Only ship customer-visible endpoints, defer internal tooling.** Considered. Of the 32, ~12 are customer-visible (Recording, Compliance, Tenant lifecycle); ~20 are admin/internal (Webhook DLQ, Retention dry-run). Doing only the 12 leaves operational debt — the operators of the platform also need tools. Deferring the 20 means another track later, doubling the planning overhead. Verdict: do all 32 in one focused track, with deferred subset documented and reviewed.
- **Spread the 32 across multiple minors.** Considered. Argument: ship something every couple of weeks. Counter-argument: domain grouping (Webhooks together, Compliance together) requires concentration. Spreading dilutes the consistency benefit. Verdict: dedicated track with sub-track patches keeps both consistency and incremental shipping.
