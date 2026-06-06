/**
 * Agent-status token mapping between the backend `AgentState` enum and the UI
 * tokens used by the status selector. Kept in a non-component module so they can
 * be unit-tested and reused without tripping the `react-refresh/only-export-components`
 * rule on the selector component file.
 */

/**
 * RESPONSE path. The backend serializes `state` / `pendingState` in PascalCase
 * ("Available", "Break"), but the UI tokens are lowercase and the Break aux state
 * maps to the `on_break` token. Normalize before any lookup — skipping this is the
 * long-standing casing bug that fell every PascalCase state through to the
 * "offline" fallback.
 */
export function normalizeStateToken(s?: string | null): string {
  const t = (s ?? '').toLowerCase();
  return t === 'break' ? 'on_break' : t;
}

/**
 * REQUEST path (inverse of {@link normalizeStateToken}). The backend binds `state`
 * to the AgentState enum (case-insensitive), so most UI tokens round-trip as-is —
 * but the Break aux state is the `on_break` UI token, which is NOT a case variant
 * of the enum member `Break` and would be rejected (400). Map it back to the enum
 * name before sending.
 */
export function toWireState(token: string): string {
  return token === 'on_break' ? 'Break' : token;
}
