# Web-behavior specs live in Verbara.Platform (hub rule)

This repo's `openspec/specs/` being (nearly) empty is **not a gap**: Platform + Platform.Web share
an authoritative workstream (API-first), so changes and living specs that describe Web behavior are
authored in **`Verbara.Platform/openspec/`**. See verbara-meta `docs/workflows/openspec-guide.md`
("Regla hub") and verbara-meta/ADR-0005.

Platform-hosted living specs that currently govern Web behavior:

| Spec (in Verbara.Platform)          | Governs                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `openspec/specs/ai-credits-readout` | `ai-credits-readout.tsx` — exhaustion badge, near-exhaustion band, i18n parity |

This repo's own `openspec/` exists for genuinely frontend-independent changes (none to date) and
carries the repo's `config.yaml` context/rules for when a change IS authored here.
