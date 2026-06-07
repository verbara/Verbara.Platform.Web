import type { ChannelCapacityOverride } from '@/core/api/hooks/use-agents';

/**
 * W6 — the editable per-agent capacity override fields surfaced in the agent form.
 * MaxVoice is intentionally absent: it is server-pinned to 1 until simultaneous
 * voice (W5b ARI mixing-bridge) ships, so the form renders it read-only and never
 * collects it. Each async field is tri-state: a number (0–50) sets an explicit
 * per-channel limit; `null` (empty input) inherits the tenant default.
 */
export interface CapacityFormGroup {
  maxChat: number | null;
  maxEmail: number | null;
  maxSms: number | null;
  maxTotal: number | null;
}

/**
 * Build the `ChannelCapacityOverride` create/update body from the form's capacity
 * group. `maxVoice` is always `null` (server pins it to 1 = inherit the pinned
 * default); each async field is the entered number or `null` to inherit the tenant
 * default. An all-null override means "fully inherit" (the server skips the audit
 * on create).
 */
export function toCapacityOverride(
  capacity: CapacityFormGroup | undefined,
): ChannelCapacityOverride {
  return {
    maxVoice: null,
    maxChat: capacity?.maxChat ?? null,
    maxEmail: capacity?.maxEmail ?? null,
    maxSms: capacity?.maxSms ?? null,
    maxTotal: capacity?.maxTotal ?? null,
  };
}
