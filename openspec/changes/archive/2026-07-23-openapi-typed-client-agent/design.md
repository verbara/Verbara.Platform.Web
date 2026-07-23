## Context

Per-module child of the `openapi-generated-types` migration, split out by
`openapi-typed-client-phase2` (archived as superseded, resolution 2 = per-module children). This
is the **Agent** child. Thin by design — the mechanism is fixed by the archived phase-1 design;
this file adds only the Agent-module file list.

**Mechanism (do not re-derive — see archived phase-1 design):**
`openspec/changes/archive/2026-07-12-openapi-typed-client/design.md` records the settled decisions
this child inherits verbatim: `openapi-typescript` codegen; committed `openapi.d.ts` refreshed by
`npm run generate:api-types` (not CI-fetch); swap-the-T at each hook (`T` → generated schema type,
`client.ts` untouched); structural-vs-nominal grep-before-delete discipline.

## Scope — Agent module (8 files, 22 hand-written declarations)

Ownership: the Agent workspace owns the conversation lifecycle plus agent self-service. The
authoritative file list (with per-file declaration counts) is in this change's `tasks.md`. Notable
folds into Agent: `use-me`, `use-mfa-enroll`, `use-user-sessions`, `use-recovery-codes`,
`use-notifications` — self-service/chrome hooks consumed from `src/profile/` and `src/shell/`,
grouped under Agent per phase2's Agent domain description; `use-contacts` and `use-media` — driven
from the conversation workspace (contact lifecycle and reply-composer upload) over incidental
admin-side lookups.

## Non-Goals

- Migrating any Admin / Analytics / Operations hook (sibling children own those).
- Implementing the shared coercion helper (the Admin child gathers sites; helper deferred to ≥3).
- Touching `src/core/realtime/platform-hub.ts` (SignalR — no REST paths, out of scope).
- Any Platform endpoint/DTO change — this child only consumes the document.

## Open Questions

None. Mechanism fixed by the archived phase-1 design; grouping fixed by phase2's resolution 2. Any
real upstream drift surfaces at `tsc -b` during migration and is handled per-hook.
