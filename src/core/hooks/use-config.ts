let config: { apiBaseUrl: string; version: string; defaultLocale: string } | null = null;

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
