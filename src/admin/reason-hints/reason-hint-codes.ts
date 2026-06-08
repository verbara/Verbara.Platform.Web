// Pure helpers + the scope vocabulary shared by the reason-hint form, page, and
// tests. Kept out of the component file so React Fast Refresh stays happy
// (a component file may only export components).

/** The scope vocabulary the backend accepts verbatim (PascalCase). */
export const REASON_HINT_SCOPES = ['Did', 'Channel', 'Queue'] as const;
export type ReasonHintScope = (typeof REASON_HINT_SCOPES)[number];

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
