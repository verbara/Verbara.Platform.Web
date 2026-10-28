const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/** True for a host that is an IP address: an IPv4 dotted quad or a bracketed IPv6 literal. */
function isIpAddress(host: string): boolean {
  return host.startsWith('[') || IPV4.test(host);
}

/**
 * The tenant label the console's host carries, ignoring the build-time default. The host is
 * normalised once (lowercased, one trailing `.` dropped) before any check, mirroring the host rules
 * of Platform/ADR-0038 §1 row 3: an IP address never names a tenant (its first label is an octet),
 * `www` / `api` / `localhost` in any case never do, and a trailing dot never adds a label. On any of
 * these it returns `null` (spec `console-host-tenant-guess`). The sign-in page looks the host's brand
 * up by this label (`licensee-branding-in-the-console`, design D1).
 */
export function hostTenantLabel(): string | null {
  const host = window.location.hostname.toLowerCase().replace(/\.$/, '');
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

/**
 * Resolve the current tenant ID from available sources.
 * Priority: env var > the host's tenant label ({@link hostTenantLabel}). On a host that carries no
 * label the caller gets `null` and asks the user (spec `console-host-tenant-guess`).
 */
export function resolveDefaultTenant(): string | null {
  // 1. Explicit env var (demo, single-tenant deployments)
  const envTenant = import.meta.env.VITE_DEFAULT_TENANT_ID as string | undefined;
  if (envTenant) return envTenant;

  // 2. Subdomain extraction (multi-tenant deployment, tenant per subdomain)
  return hostTenantLabel();
}
