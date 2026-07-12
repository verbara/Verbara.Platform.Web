## 1. Planning (this change's scope)

- [ ] 1.1 Resolve design.md's open question 1 (ADR timing for the codegen delivery
      mechanism) — either write the Platform-repo ADR now, or record an explicit
      re-check trigger and defer it
- [ ] 1.2 Resolve design.md's open question 2 (migration grouping: per-module children vs.
      one batched change) once Platform's OpenAPI document CI artifact (buildOrder 1,
      Platform/ADR-0035) is live
- [ ] 1.3 Resolve design.md's open question 3 (numeric-coercion helper) — gather the 2-3
      concrete migrated call sites this question's spec scenario requires before deciding
      to generalize vs. keep per-hook normalization
- [ ] 1.4 Once 1.1-1.3 are resolved, either update this change's tasks with an
      implementation phase (Phase B) and run `/opsx:apply`, or split the resolved scope
      into fresh child change(s) and archive this one as superseded

## 2. Carried context (source: archived `openapi-typed-client` tasks.md Phase 4)

- [x] 2.1 Confirm all three Phase 4 follow-up items from the archived change have a
      tracked home in this change's proposal.md / design.md (this task itself — done by
      the closing routine that created this change)
