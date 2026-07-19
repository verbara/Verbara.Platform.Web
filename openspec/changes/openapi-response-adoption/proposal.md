---
tier: MEDIANO
owner: hreina
approver: hreina
stakeholder: Platform product
decision_ref: Platform/ADR-0035
---

## Why

`openapi-typed-client` (archived 2026-07-12, Web PR#161) proved the swap-the-T mechanism and
migrated the CSAT slice onto the generated `src/core/api/generated/openapi.d.ts`. The **Admin**
child (`openapi-typed-client-admin`, archived 2026-07-16) then hit a hard bound: across **44 Admin
files / 199 hand-written declarations it could migrate only 6 shapes** (`ScheduleDayDto`,
`ChangePasswordRequest`, and 4 request bodies) — **38 files stayed hand-written**. Its final tally
named the exact root cause: the committed `openapi.d.ts` exposed request-body schemas (134
`*Request`/`*Body`) and nested value-object `*Dto`s but **almost no top-level response DTOs**, so
the swap-the-T mechanism had nothing to swap onto for most read paths. It recorded the follow-up
verbatim: have the Platform host "emit response DTOs as named `components/schemas` so the consumer
side has response types to migrate onto."

That follow-up is now **delivered**. The cross-repo change `openapi-response-schemas`
(Platform/ADR-0035, committed) makes the Platform Api host emit **named response schemas** for the
admin-remainder endpoint group into `/openapi/v1.json` `components/schemas`, asserted verbatim by
`scripts/verify-openapi-fixture.py` against the fixture manifest
(`response-schema-manifest.v1.json`, group `admin-remainder`, status `complete`). This child is the
**consumer half**: it regenerates `openapi.d.ts` from the new document and migrates the
admin-remainder hooks — the ~38 files the archived Admin child marked no-match for response-schema
scarcity — onto the now-named schemas via swap-the-T.

The consumption machinery is already built and proven: `scripts/generate-api-types.mjs` (codegen),
`src/core/api/generated/openapi.d.ts` (committed generated types), and `customFetch<T>` at
`src/core/api/client.ts:222`. Nothing new is introduced here — only the document grows response
types and the hooks adopt them.

## What Changes

- **Regenerate `openapi.d.ts`** from the new Platform OpenAPI document (which now emits the
  admin-remainder response schemas) via `scripts/generate-api-types.mjs` — not a CI-time fetch; the
  refreshed generated file is committed, same delivery as phase-1.
- **Migrate the admin-remainder hooks** (~38 files under `src/core/api/hooks/` that the archived
  `openspec/changes/archive/2026-07-16-openapi-typed-client-admin/` marked no-match due to
  response-schema scarcity) to consume the now-named response schemas behind `client.ts`'s existing
  generic `<T>` (swap-the-T, no call-site plumbing), one file at a time. The authoritative schema
  set is the manifest's `admin-remainder` group.
- **Grep-and-update** any component prop / test import that referenced a now-removed hand-written
  interface, before deleting each old declaration (structural-vs-nominal swap discipline from the
  phase-1 design).
- **Numeric-coercion site gathering (Q3, inherited):** as each admin-remainder hook migrates, record
  any field whose generated type is a genuine `number | string` AOT-wire-union a consumer must
  normalize to `number`, appended to the shared tally. Many such unions were logged as **latent
  candidates** in the archived Admin child precisely because their hooks stayed hand-written for
  lack of a response schema — adopting the response types here is what can flip them **active** and
  trip the ≥3 threshold. `ai-credits-readout.tsx`'s `as number` casts are NOT an instance of this
  pattern (retro run 4) and do not count.
- No breaking changes to any migrated hook's public return type — each generated response type is a
  structural match for the hand-written interface it replaces (or a thin coercion wrapper where a
  `number | string` union needs normalizing, mirroring the CSAT slice precedent).

## Capabilities

### Modified Capabilities

- `openapi-generated-types`: extends the migrated surface to the admin-remainder response shapes —
  the ~38 hooks the Admin child could not migrate for lack of named response DTOs. The capability's
  mechanism is unchanged; this child only advances which hooks consume the generated types, now that
  the document carries the response schemas they read.

## Impact

- **Migrated hooks (~38 admin-remainder)**: the files the archived Admin child kept hand-written and
  annotated per-file for response-schema scarcity — hand-written response interfaces removed,
  generated response types consumed. No other module's hooks touched.
- **Un-gates the three HELD siblings — but does NOT include them.** The pre-existing HELD children
  `openapi-typed-client-agent`, `openapi-typed-client-analytics`, and `openapi-typed-client-operations`
  each carried a GATE waiting on this same cross-repo response-schema thread. This child un-gates
  that thread for them, but they **run as their own backlog items** (each consuming its own group —
  `agent`, `analytics`, `operations` — from the same manifest); they are **NOT part of this
  change's scope**.
- **No new dependency, no new CI job**: the existing blocking `build` job (`tsc -b && vite build`)
  gates the generated types for free; `scripts/generate-api-types.mjs` and `openapi.d.ts` already
  exist from phase-1.
- **No runtime behavior change**: swap-the-T is compile-time-only; a hook's resolved data shape is
  unchanged (structural match), so existing unit/E2E coverage exercises the same runtime.
- **Depends on**: the Platform host `openapi-response-schemas` change (Platform/ADR-0035, committed)
  — the source of the admin-remainder named response schemas this child regenerates against. The
  golden contract for the emitted schema names + field names is the fixture manifest
  `response-schema-manifest.v1.json` (`admin-remainder` group, status `complete`) in that change.
- **Not in scope**: the Agent / Analytics / Operations modules (the un-gated sibling children, above);
  `src/core/realtime/platform-hub.ts` and the `*-state-stream` SignalR hub payloads (no REST paths —
  ADR-0020's deferred follow-up, owner: Pro); implementing the shared coercion helper (deferred to
  ≥3 genuine active sites — this child only gathers sites and may flip latents active).
