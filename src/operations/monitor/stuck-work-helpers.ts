/**
 * Shared helpers for the W5 Stuck Work view. Kept out of the component file so the
 * tab module exports a component only (avoids `react-refresh/only-export-components`).
 */

/**
 * Maps a wire conversation state (PascalCase, e.g. "WaitingForCustomer") to the
 * snake_case i18n label key used by the existing `monitor` block, so we reuse the
 * friendly translations already shipped for the digital monitor.
 */
export function conversationStateLabelKey(state: string): string {
  const snake = state
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
  return `stuck_work.states.${snake}`;
}
