const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/** True for a host that is an IP address: an IPv4 dotted quad or a bracketed IPv6 literal. */
function isIpAddress(host: string): boolean {
  return host.startsWith('[') || IPV4.test(host);
}

/**
 * Resolve the current tenant ID from available sources.
 * Priority: env var > subdomain extraction. An IP address never names a tenant (its first label is
 * an octet), so on one the caller gets `null` and asks the user (spec `sign-in-refusal-feedback`).
 */
export function resolveDefaultTenant(): string | null {
  // 1. Explicit env var (demo, single-tenant deployments)
  const envTenant = import.meta.env.VITE_DEFAULT_TENANT_ID as string | undefined;
  if (envTenant) return envTenant;

  // 2. Subdomain extraction (multi-tenant SaaS)
  const host = window.location.hostname;
  if (isIpAddress(host)) return null;
  const parts = host.split('.');
  if (parts.length >= 3) {
    const subdomain = parts[0] ?? '';
    if (subdomain && !['www', 'api', 'localhost'].includes(subdomain)) {
      return subdomain;
    }
  }

  return null;
}
