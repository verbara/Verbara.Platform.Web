interface AppConfig {
  apiBaseUrl: string;
  version: string;
  defaultLocale: string;
  /**
   * SIP-over-WebSocket-Secure URL of the Asterisk PBX, e.g.
   * `wss://pbx.example.com:8089/ws`. When set (and the agent has voice
   * capacity + SIP credentials) the agent app boots an in-browser softphone
   * (Phase 3A). Absent/empty in dev and in deployments without voice.
   */
  asteriskWssUrl?: string;
}

let config: AppConfig | null = null;

export async function loadConfig() {
  if (config) return config;
  const res = await fetch('/config.json');
  if (!res.ok) throw new Error(`/config.json answered ${res.status}`);
  config = (await res.json()) as AppConfig;
  return config;
}

/**
 * Loads `/config.json` and then renders. A config that cannot be loaded never stops the
 * console: it still renders, and every `getConfig()` reader falls back to its default
 * (no softphone, no in-browser listen).
 */
export async function bootApp(render: () => void) {
  try {
    await loadConfig();
  } catch (error) {
    console.warn('Runtime config not loaded; continuing with defaults.', error);
  }
  render();
}

export function getConfig() {
  if (!config) throw new Error('Config not loaded. Call loadConfig() first.');
  return config;
}
