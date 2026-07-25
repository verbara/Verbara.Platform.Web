## Context

Web child of the cross-repo `openapi-numeric-schema-truth`. Thin by design — the **mechanism is
fixed** (swap-the-T at each hook, committed `openapi.d.ts` refreshed by `npm run generate:api-types`,
`client.ts` untouched; settled in `openspec/changes/archive/2026-07-12-openapi-typed-client/design.md`).
The trigger is upstream: Platform's host change adds an `IOpenApiSchemaTransformer` (`Platform/ADR-0036`,
amends ADR-0035) that strips the spurious .NET 10 `number | string` arm from the emitted document
(document-only; root cause dotnet/aspnetcore #64145). Once that lands, this repo regenerates, and the
543 unions collapse to single-typed `number` — which unblocks the Analytics migration that was HELD
on exactly this union and makes the entire `Number()` coercion class dead.

There is no new type-migration mechanism to design here. The one real design decision is the
**keep-hand-written list**: which analytics shapes must NOT be forced onto a generated type even
after the numeric union is gone.

## The one design point — the structural-divergence keep-list

A clean numeric single-type is necessary but not sufficient for a swap. Three shapes diverge
_structurally_ (not just numerically) from their generated counterparts, and one class has no
generated counterpart at all. Forcing a swap there would break the hook's public shape, which the
structural-match discipline forbids. These STAY hand-written and are logged as **separate Platform
contract bugs** (not fixed by this change):

| Shape                                                                                       | Divergence                                                                 | Verdict                              |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------ |
| `TopicTrendsResponse`                                                                       | generated renames `topics`→`trends`, drops `from`/`to`                     | keep; log contract bug               |
| `ComplianceRuleSummaryDto.severity`                                                         | widened from `'Info' \| 'Warning' \| 'Critical'` literal union to `string` | keep; log contract bug               |
| `PagedResult<T>` envelope                                                                   | `{ items, hasNextPage }` vs generated `{ data, hasMore }`                  | keep local generic; log contract bug |
| `BotAnalyticsSummary`, `TranscriptSegment`, `IntervalData`, `CsatCaptureRequest` (requests) | no generated counterpart                                                   | keep hand-written                    |

Everything else with a now-clean match adopts the generated schema.

## The coercion-class retirement is a deletion, not a redesign

The ~30 `Number()` sites (`use-billing.ts`, `use-partner.ts`, `use-queue-metrics.ts`,
`use-analytics.ts`, `use-teams.ts`, `use-notifications.ts`, `use-supervisor.ts`,
`use-typification-llm.ts`) existed only to strip a `string` arm the server never sends. With the
regenerated field already `number`, each site is a plain deletion — read the field directly. This
also **closes the deferred shared-coercion-helper decision as OBSOLETE**: the helper generalized a
class that no longer exists, so it must never be built. `tsc -b` (the blocking `build` job) is the
safety net for every deletion.

## Non-Goals

- Designing any new codegen or client mechanism — fixed by the archived phase-1 design.
- Any Platform endpoint/DTO change — this child only consumes the corrected document.
- Fixing the three structural-divergence shapes — logged as separate Platform contract bugs.
- Building the shared coercion helper — the decision is closed OBSOLETE (the union class is extinct).

## Open Questions

None. The mechanism is fixed; the trigger (Platform's transformer) is the host change; the keep-list
above is the sole judgment call and is enumerated. Any residual upstream drift on an adopted hook
surfaces at `tsc -b` and is handled per-hook.
