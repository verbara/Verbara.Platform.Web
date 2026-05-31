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
  config = await res.json();
  return config!;
}

export function getConfig() {
  if (!config) throw new Error('Config not loaded. Call loadConfig() first.');
  return config;
}
