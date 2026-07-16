## 1. Planning (this change's scope)

- [x] 1.1 Resolve design.md's open question 1 (ADR timing for the codegen delivery
      mechanism) — either write the Platform-repo ADR now, or record an explicit
      re-check trigger and defer it
      — RESOLVED 2026-07-16: **DEFER** the Platform-repo ADR. Platform/ADR-0035 (CI-export
      contract) + phase-1's committed-file Decision are the durable record; no new ADR owed.
      Explicit re-check trigger recorded in design.md: revisit if/when a CI-artifact-fetch
      delivery is actually weighed against the committed-file approach (fixture-parity gate
      change or a schema-drift incident).
- [x] 1.2 Resolve design.md's open question 2 (migration grouping: per-module children vs.
      one batched change) once Platform's OpenAPI document CI artifact (buildOrder 1,
      Platform/ADR-0035) is live
      — RESOLVED 2026-07-16: **per-module child changes** — `openapi-typed-client-admin`,
      `-agent`, `-analytics`, `-operations` (4 children). The gate that motivated waiting is
      now LIVE: Platform/ADR-0035 + the `ci.yml` "Export OpenAPI document (CI-runtime capture)"
      step ship the real document, and the committed `openapi.d.ts` is already generated from
      it (324 paths, 182 schemas). All four children are unblocked.
- [x] 1.3 Resolve design.md's open question 3 (numeric-coercion helper) — gather the 2-3
      concrete migrated call sites this question's spec scenario requires before deciding
      to generalize vs. keep per-hook normalization
      — RESOLVED 2026-07-16: **DEFER generalizing; revisit at ≥3 genuine sites.** Today only
      `CsatResponseDto` is a genuine `number | string` AOT-wire-union instance. The admin child
      carries the site-gathering task; the decision point is "revisit whether to add a shared
      coercion helper once ≥3 genuine sites exist". `ai-credits-readout.tsx` is NOT an instance
      (retro run 4) and does not count toward the threshold.
- [x] 1.4 Once 1.1-1.3 are resolved, either update this change's tasks with an
      implementation phase (Phase B) and run `/opsx:apply`, or split the resolved scope
      into fresh child change(s) and archive this one as superseded
      — RESOLVED 2026-07-16: **split into 4 per-module child changes and archive this planning
      change as superseded.** Children created: `openapi-typed-client-admin`,
      `openapi-typed-client-agent`, `openapi-typed-client-analytics`,
      `openapi-typed-client-operations` (see each child's proposal/design/tasks). This change
      is then archived as superseded per the closing routine.

## 2. Carried context (source: archived `openapi-typed-client` tasks.md Phase 4)

- [x] 2.1 Confirm all three Phase 4 follow-up items from the archived change have a
      tracked home in this change's proposal.md / design.md (this task itself — done by
      the closing routine that created this change)
