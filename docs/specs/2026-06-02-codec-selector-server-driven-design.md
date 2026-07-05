# Server-Driven Codec Selector for SIP Trunks & Endpoint Profiles

**Version:** 3.2.0 (proposed)
**Status:** Shipped
**Created:** 2026-06-02
**Type:** Cross-cutting track (Web + `Verbara.Platform` API + AMI)
**Surfaces touched (Web):** [trunk-wizard.tsx](../../src/admin/trunks/trunk-wizard.tsx) · [trunk-form.tsx](../../src/admin/trunks/trunk-form.tsx) · [profile-form.tsx](../../src/admin/realtime/profile-form.tsx)

## Problem

Codecs are entered today as a **free-text comma-separated string** (e.g. `ulaw,alaw`) in three places:

1. **Trunk wizard** — [trunk-wizard.tsx:339-374](../../src/admin/trunks/trunk-wizard.tsx#L339-L374) (MediaStep), field `codecs: string`.
2. **Trunk edit form** — [trunk-form.tsx:389-396](../../src/admin/trunks/trunk-form.tsx#L389-L396) (advanced section), `codecs: z.string().optional()`.
3. **Realtime endpoint profiles** — [profile-form.tsx:207-221](../../src/admin/realtime/profile-form.tsx#L207-L221), `codecs` **required**, default `ulaw,alaw,g722`.

This forces operators to know exact Asterisk codec token strings. Two concrete failure modes:

- **No discoverability for non-technical users.** Nothing tells the operator which tokens are valid or what they mean (`g722` = HD voice, `g729` = low bandwidth, etc.).
- **Silent misconfiguration.** The backend stores the string **verbatim with zero validation** (`Verbara.Platform`: `TrunkEndpoints.cs:68,113`, `PostgresTrunkStore.cs:159`; `Verbara.Sdk.Pro`: `EndpointProfile.cs:24`) and passes it straight to the PJSIP `allow=` column (`RealtimeSyncEngine.cs:326` — `Allow = trunk.Codecs ?? "ulaw,alaw"`). A typo like `ulwa` makes Asterisk silently drop the codec or reject the endpoint — only discoverable via SSH + `pjsip show endpoint`.

Asterisk treats the `allow=` list as **ordered by negotiation preference**, so any replacement UI must preserve order. The backend already uses the `disallow=all` + ordered `allow=<tokens>` convention (`Verbara.Sdk.Pro`: `PjsipEndpointRow.cs:28-31`).

### Transport (related question, answered — minor UX change only)

The Transport field is **already a dropdown** (`udp/tcp/ws/wss`) — [trunk-form.tsx:400-421](../../src/admin/trunks/trunk-form.tsx#L400-L421). Leaving it blank sends `undefined` → backend stores `NULL` → `RealtimeSyncEngine` applies `trunk.Transport ?? "transport-udp"`. So the effective default **is UDP**; the blank state is intentional ("let the server decide"). Not a bug. This track only clarifies the placeholder/help text so the UDP default is obvious.

## Goals

1. **Server-driven catalog.** A new `GET /api/v1/admin/voice/codecs` endpoint in `Verbara.Platform` reports the codecs Asterisk actually has loaded (via AMI `core show codecs`), so the picker only offers negotiable codecs and never invents tokens the server can't use.
2. **A single reusable `CodecSelector` component** used by all three surfaces, designed for non-technical users **without** sacrificing power-user control:
   - **Presets** (pick an outcome, not codec names).
   - **Orderable selected list** (dnd-kit drag **+** ↑↓ buttons for a11y) — order = negotiation preference.
   - **Friendly labels + technical token + badges** (HD, WebRTC, license, module).
   - **Grouped, searchable "add" catalog** + **progressive disclosure** ("show all / advanced").
   - **Custom-token escape hatch** in advanced (zero data loss for legacy/exotic values).
   - **Guardrails** (soft warnings: missing G.711 fallback, empty list, duplicates, not-installed codec).
3. **Save-time validation (close the silent-failure hole).** Server-side: hard-reject tokens that are not real Asterisk codecs (typos); soft-warn (allow) tokens that are valid but not installed on this server.
4. **Backward compatibility.** Wire contract unchanged — the picker still serializes to a comma-separated string. Existing stored values (including unknown/exotic tokens) round-trip without loss.
5. **Graceful degradation.** If AMI is unavailable or this node isn't the AMI leader, the endpoint returns a static fallback catalog and the picker still works, with a subtle "couldn't verify against server" note.

## Acceptance

### Frontend (`Verbara.Platform.Web`)

- ✅ `<CodecSelector>` in `src/core/voice/codec-selector.tsx`, value `string` (comma-separated) in/out, internally `string[]`.
- ✅ `CODEC_CATALOG` presentation map in `src/core/voice/codec-catalog.ts`: `token → { i18nNameKey, tier, group, curated, webrtc?, needsLicense?, needsModule? }`.
- ✅ `useVoiceCodecs()` hook in `src/core/api/hooks/use-voice-codecs.ts` — TanStack Query GET `/admin/voice/codecs`, long `staleTime`, returns `{ source, codecs }`.
- ✅ Preset selector with: Recommended (`ulaw,alaw,g722`), HD (`opus,g722,ulaw,alaw`), Low-bandwidth (`g729,ulaw,alaw`), WebRTC (`opus,ulaw,alaw,vp8,h264`), Custom.
- ✅ Selected list reorderable by drag (dnd-kit, already a dependency) **and** ↑↓ buttons; remove (✕) per row; each row shows friendly label + token + badges.
- ✅ "Add" catalog grouped by tier (Standard / HD / Low-bandwidth / Video) with a search filter; codecs already selected are excluded from "add".
- ✅ Catalog reconciliation: installed∩catalog → friendly row; installed∖catalog → "Others (installed)" group with raw token; catalog∖installed → hidden by default, shown **disabled** with "not installed" in advanced.
- ✅ Advanced disclosure ("Show all codecs") reveals exotic/legacy codecs + a **custom-token** free-text add (validated as a plausible token; appended as a chip flagged "outside catalog").
- ✅ Guardrails (non-blocking warnings): missing G.711 (`ulaw`/`alaw`), empty selection, duplicate token, selected token reported not-installed by server.
- ✅ Integrated into all three surfaces, replacing the text inputs; provider seed defaults from [trunk-wizard-providers.ts](../../src/admin/trunks/trunk-wizard-providers.ts) preserved; profile keeps "≥1 codec required".
- ✅ Transport placeholder/help clarified to indicate UDP default (e.g. `trunks.form.transport_placeholder` → "Server default (UDP)").
- ✅ i18n: `es-419`, `en-US`, `pt-BR` keys for labels/groups/badges/presets/guardrails under `admin.json` `trunks.codecs.*` / shared `voice.codecs.*`; parity gate green. Codec **tokens** are not translated.
- ✅ A11y: keyboard reorder (↑↓), `aria-label` on every control, live-region announcement on reorder; selectors use `data-*`.
- ✅ Tests: Vitest unit coverage (serialization round-trip, presets, drag + ↑↓ reorder, custom token, legacy out-of-catalog value, endpoint fallback, each guardrail). Existing suite stays green. ≥1 Playwright E2E (pick preset → reorder → save trunk).
- ✅ Lint 0 (jsx-a11y green), TypeScript strict clean, build green, audit 0 vulns.

### Backend (`Verbara.Platform`)

- ✅ `GET /api/v1/admin/voice/codecs` — same permission gate as trunk management; returns typed record `VoiceCodecsResponse { string Source; string[] Codecs }` registered in `ApiJsonContext` (AOT, no reflection).
- ✅ When this node holds the AMI leadership lease: runs `CommandAction { Command = "core show codecs" }`, parses `Codec Name:\s+(\S+)`, filters non-negotiable formats (`slin*`, `wav`, `wav49`, `vorbis`, `jpeg`), returns `Source = "asterisk"`.
- ✅ When AMI is unavailable / not leader / command errors: returns `Source = "fallback"` with a static known-codec set. Endpoint never 5xx's for this reason.
- ✅ A shared **known-codec token set** (audio + video) added in `Verbara.Platform` (or SDK) — the allowlist used both for the fallback catalog and for save-time validation.
- ✅ Save-time validation on trunk + profile create/update: token not in the known set → `400` listing the invalid tokens; valid-but-not-installed → accepted (warning surfaced by the front, not a hard error). Existing rows are not re-validated unless edited.
- ✅ Response is cacheable; result rarely changes.
- ✅ Tests: parser (sample `core show codecs` output), format filtering, fallback path (no leader), validation 400 on bogus token, valid-not-installed accepted. `TreatWarningsAsErrors` clean, AOT-compatible.

## Out of Scope (explicit)

- **Changing the stored data shape.** Codecs remain a comma-separated string column; no migration to an array/jsonb. Order is preserved by the string order.
- **`allow=all` / `!exclusion` syntax in the UI.** The picker is an explicit ordered allow-list; `all` and `!`-prefixed tokens are never offered. (Backend keeps emitting `disallow=all` + `allow=<ordered>`.)
- **Video transcoding hints.** Asterisk does not transcode video; we surface video codecs (pass-through) but do not model transcode compatibility.
- **Per-codec advanced params** (bitrate, ptime, fmtp, Opus-specific `max_playback_rate`, etc.). Future enhancement.
- **Quality/bandwidth "intent slider"** (auto-deriving order). Presets cover the same need more transparently; revisit only if presets prove insufficient.
- **Dual-list transfer box.** Catalog is ~6–15 items; the lighter orderable-list + grouped-add is better UX at this size (PatternFly recommends transfer boxes only at 20+ items).
- **Re-validating / migrating existing trunk codec strings** in a batch job. Validation applies on next edit only.
- **Tenant-specific codec catalogs.** `core show codecs` is per-Asterisk-deployment, not per-tenant; one catalog per server.

## Architecture

### Unit 1 — Backend endpoint `GET /api/v1/admin/voice/codecs` (`Verbara.Platform`)

New endpoint group (e.g. `VoiceMetadataEndpoints.cs`). First reference-data/metadata endpoint in the API — establishes the pattern.

```csharp
public sealed record VoiceCodecsResponse(string Source, string[] Codecs); // in ApiJsonContext

// handler (sketch):
// 1. if (!amiLease.IsLeader) return Fallback();
// 2. var resp = await ami.SendAsync(new CommandAction { Command = "core show codecs" }, ct);
// 3. parse resp.Output with regex "Codec Name:\\s+(\\S+)", distinct, drop NonNegotiable set
// 4. return new VoiceCodecsResponse("asterisk", tokens);  // or Fallback() on any failure
```

- `CommandAction` / `CommandResponse` already exist in the SDK (`Verbara.Sdk.Ami`). Precedent: `TrunkConnectivityTester` already issues AMI commands and parses output.
- `NonNegotiable` filter: prefixes/exact `slin`, `slin*`, `wav`, `wav49`, `vorbis`, `jpeg`.
- `Fallback()` returns `("fallback", KnownCodecs.DefaultCatalog)`.

### Unit 2 — Shared known-codec token set + save validation (`Verbara.Platform`)

- `KnownCodecs` static: audio = `ulaw, alaw, g722, opus, g729, gsm, ilbc, g726, g726aal2, adpcm, speex, speex16, siren7, siren14, g719, g723, lpc10, silk`; video = `vp8, vp9, h264, h263p, h263, h261, mpeg4`.
- Trunk + profile create/update validate each token ∈ `KnownCodecs`. Unknown → `400 { error, invalidTokens[] }`. (Valid-but-not-installed is NOT rejected here — the front warns.)
- Applied in the trunk and profile endpoint handlers before persistence.

### Unit 3 — `CODEC_CATALOG` presentation map (Web, `src/core/voice/codec-catalog.ts`)

```ts
type CodecTier = 'standard' | 'hd' | 'lowband' | 'legacy' | 'video';
interface CodecMeta {
  token: string; // exact allow= token — load-bearing
  nameKey: string; // i18n key, e.g. 'voice.codecs.names.g722'
  tier: CodecTier;
  curated: boolean; // in default picker vs behind "show all"
  webrtc?: boolean; // badge
  needsLicense?: boolean; // g729 badge
  needsModule?: boolean; // opus / silk badge
}
export const CODEC_CATALOG: Record<string, CodecMeta>;
export const PRESETS: Record<string, string[]>;
```

Curated set: `ulaw, alaw, g722, opus, g729, gsm, ilbc` + video `vp8, h264`. Everything else `curated: false`.

### Unit 4 — `useVoiceCodecs()` hook (Web, `src/core/api/hooks/use-voice-codecs.ts`)

TanStack Query, `GET /admin/voice/codecs`, returns `{ source: 'asterisk' | 'fallback', codecs: string[] }`. Long `staleTime` (e.g. 1h). On error, the hook surfaces an empty/fallback so the component degrades to `CODEC_CATALOG`'s curated set.

### Unit 5 — `<CodecSelector>` component (Web, `src/core/voice/codec-selector.tsx`)

- Props: `value: string` (comma list), `onChange(value: string)`, `required?: boolean`, `seed?: string` (provider/profile default), `data-testid` base.
- Internal state: `string[]` ordered. Serializes to comma string on change.
- Subcomponents: `<PresetSelect>`, `<SelectedCodecRow>` (sortable, dnd-kit + ↑↓), `<CodecCatalogList>` (grouped + search), `<AdvancedDisclosure>` (all codecs + custom add), `<CodecGuardrails>`.
- Reconciles `useVoiceCodecs()` installed set with `CODEC_CATALOG` (see reconciliation rules in Acceptance).

### Unit 6 — Integration in the three surfaces (Web)

- **[trunk-wizard.tsx](../../src/admin/trunks/trunk-wizard.tsx)** MediaStep: replace the codecs `<Input>` with `<CodecSelector>`, seeded from the provider template.
- **[trunk-form.tsx](../../src/admin/trunks/trunk-form.tsx)** advanced section: replace the codecs `<Input>`; also clarify the Transport placeholder/help (Unit 7).
- **[profile-form.tsx](../../src/admin/realtime/profile-form.tsx)**: replace the codecs `<Input>`; keep Zod "≥1 codec" rule; WebRTC preset is the natural default here.

### Unit 7 — Transport placeholder clarification (Web)

Update i18n only: `trunks.form.transport_placeholder` and `transport_hint` to state the effective default is UDP. No behavior change.

## Data Flow

1. Form mounts → `useVoiceCodecs()` fetches installed set (cached).
2. `<CodecSelector value={field.value}>` parses the comma string to `string[]`, reconciles with catalog + installed set, renders.
3. User picks preset / adds / reorders / removes → component emits new comma string via `onChange` → RHF field updates.
4. Submit → existing `useCreateTrunk` / `useUpdateTrunk` / profile upsert send `codecs: "<comma string>"` (unchanged contract).
5. Backend validates tokens ∈ `KnownCodecs` (400 on typo) → persists → `RealtimeSyncEngine` writes `allow=<string>` to PJSIP (unchanged).

## Testing Strategy

- **Web unit (Vitest):** serialization round-trip; preset seeding; drag reorder; ↑↓ reorder; remove; add-from-catalog; search filter; custom token add; legacy out-of-catalog value renders + round-trips; `source:"fallback"` degradation; each guardrail fires correctly; profile "≥1 codec" validation.
- **Web E2E (Playwright):** open trunk wizard → choose "HD" preset → drag to reorder → save → assert payload via `data-*` selectors (locale-proof).
- **Backend (xUnit):** parse representative `core show codecs` output; filter `slin*`/`wav`/etc.; fallback when not AMI leader; validation 400 on `ulwa`; valid-not-installed (`silk` when module absent) accepted.

## Cross-Repo Coordination & Sequencing

This is a cross-cutting track. Suggested order:

1. **Backend first** (`Verbara.Platform`): `KnownCodecs`, `GET /admin/voice/codecs`, save-time validation, tests. Ship/deploy so the Web endpoint exists.
2. **Web**: `CODEC_CATALOG`, `useVoiceCodecs`, `<CodecSelector>`, integrate ×3, i18n ×3, transport text, tests.

Until the backend endpoint is deployed, the Web hook degrades to the static fallback catalog automatically — so Web can be developed/tested against the fallback path independently. Per `Verbara.Platform/CLAUDE.md`, the cross-cutting plan may live under `Verbara.Platform/docs/plans/`; this **spec** lives in the Web repo since that's the primary surface.

## Open Questions

None blocking. Confirmed during brainstorming:

- Validation = hard-reject typos + soft-warn not-installed. ✅
- Transport = clarify placeholder to "(UDP)". ✅
- Spec location = Web repo `docs/specs/`. ✅
