/**
 * Resolve the current tenant ID from available sources.
 * Priority: env var > subdomain extraction.
 */
export function resolveDefaultTenant(): string | null {
  // 1. Explicit env var (demo, single-tenant deployments)
  const envTenant = import.meta.env.VITE_DEFAULT_TENANT_ID as string | undefined;
  if (envTenant) return envTenant;

  // 2. Subdomain extraction (multi-tenant SaaS)
  const host = window.location.hostname;
  const parts = host.split('.');
  if (parts.length >= 3) {
    const subdomain = parts[0] ?? '';
    if (subdomain && !['www', 'api', 'localhost'].includes(subdomain)) {
      return subdomain;
    }
  }

  return null;
}
