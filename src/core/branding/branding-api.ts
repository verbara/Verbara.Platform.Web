import { parsePublicBranding, type PublicBrandingDto } from './public-branding';

/**
 * The anonymous branding requests (design D2 of `licensee-branding-in-the-console`). They do not go
 * through `customFetch`: before sign-in there is no token, and `customFetch` adds the tenant header
 * and runs the refresh-on-401 path. They go through this module's own fetch seam instead, so a test
 * stubs them apart from the global `fetch` stub or MSW handlers of its harness (design D8).
 */

/** The fetch function the module sends with. */
export type BrandingFetch = (input: string, init: RequestInit) => Promise<Response>;

/** The outcome of one lookup. `not-found` is a 404 only; anything else that is not a brand fails. */
export type BrandingResult =
  | { readonly status: 'found'; readonly brand: PublicBrandingDto }
  | { readonly status: 'not-found' }
  | { readonly status: 'failed' };

/** A lookup that has not answered by then is aborted and fails. */
export const BRANDING_TIMEOUT_MS = 3000;

const browserFetch: BrandingFetch = (input, init) => fetch(input, init);

let brandingFetch: BrandingFetch = browserFetch;

/** Replace the function branding requests are sent with (tests). */
export function setBrandingFetch(fn: BrandingFetch): void {
  brandingFetch = fn;
}

/** Restore the production default, the browser `fetch`. */
export function resetBrandingFetch(): void {
  brandingFetch = browserFetch;
}

/**
 * Send one branding request. No `Authorization` or `X-Tenant-Id` header is sent, the request is
 * aborted after {@link BRANDING_TIMEOUT_MS}, and it never throws. Registered with the API route guard
 * (`scripts/check-api-routes.py`, `WRAPPERS`), so each call's literal URL is checked against the
 * OpenAPI document.
 */
async function brandingRequest(config: { url: string; method: 'GET' }): Promise<BrandingResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BRANDING_TIMEOUT_MS);
  try {
    const response = await brandingFetch(config.url, {
      method: config.method,
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (response.status === 404) return { status: 'not-found' };
    if (!response.ok) return { status: 'failed' };
    const brand = parsePublicBranding(await response.json());
    return brand ? { status: 'found', brand } : { status: 'failed' };
  } catch {
    return { status: 'failed' };
  } finally {
    clearTimeout(timer);
  }
}

/** The white-label brand of a host label, looked up as a subdomain. */
export function fetchBrandingBySubdomain(label: string): Promise<BrandingResult> {
  return brandingRequest({
    url: `/api/v1/branding/by-subdomain/${encodeURIComponent(label)}`,
    method: 'GET',
  });
}

/** The effective brand of a tenant. */
export function fetchBrandingByTenant(tenant: string): Promise<BrandingResult> {
  return brandingRequest({ url: `/api/v1/branding/${encodeURIComponent(tenant)}`, method: 'GET' });
}
