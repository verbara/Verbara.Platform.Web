// Pure helpers + the scope vocabulary shared by the reason-hint form, page, and
// tests. Kept out of the component file so React Fast Refresh stays happy
// (a component file may only export components).

/** The scope vocabulary the backend accepts verbatim (PascalCase). */
export const REASON_HINT_SCOPES = ['Did', 'Channel', 'Queue'] as const;
export type ReasonHintScope = (typeof REASON_HINT_SCOPES)[number];

/**
 * The EXACT C# `ChannelType` enum names the backend matches via `channel.ToString()`
 * (case-sensitive) when resolving a `Channel`-scoped reason hint. Source of truth:
 * Verbara.Platform/src/Verbara.Platform.Core/ChannelType.cs. Casing is load-bearing
 * — "Sms" (not "SMS"), "WebChat" (not "Webchat"); a typo means the hint silently
 * never fires, so the form must offer these verbatim rather than free text.
 */
export const REASON_HINT_CHANNELS = [
  'Voice',
  'WhatsApp',
  'Sms',
  'WebChat',
  'Email',
  'Messenger',
  'Instagram',
  'Telegram',
  'Twitter',
  'Video',
  'Rcs',
] as const;
export type ReasonHintChannel = (typeof REASON_HINT_CHANNELS)[number];

/** "CITAS, REPROG" → ["CITAS", "REPROG"] (trimmed, blanks dropped). */
export function parseCodes(input: string): string[] {
  return input
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

/** A `reasonPath` JSON array string → "CITAS, REPROG" for friendly editing. */
export function codesToText(reasonPath: string): string {
  try {
    const parsed: unknown = JSON.parse(reasonPath);
    if (Array.isArray(parsed)) {
      return parsed.filter((c): c is string => typeof c === 'string').join(', ');
    }
  } catch {
    // Not valid JSON — fall back to showing the raw value so the operator can
    // still correct a malformed legacy row instead of losing it.
    return reasonPath;
  }
  return reasonPath;
}
