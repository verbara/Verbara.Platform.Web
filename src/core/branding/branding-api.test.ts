/**
 * The anonymous branding requests (design D2): one path through the module's own fetch seam, three
 * outcomes, never a throw, never a token or tenant header, aborted after 3 seconds.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BRANDING_TIMEOUT_MS,
  fetchBrandingBySubdomain,
  fetchBrandingByTenant,
  resetBrandingFetch,
  setBrandingFetch,
  type BrandingFetch,
} from './branding-api';
import { useAuthStore } from '@/core/auth/auth-store';
import { useTenantStore } from '@/core/tenant/tenant-store';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const brandingFetchMock = vi.fn<BrandingFetch>();

beforeEach(() => {
  brandingFetchMock.mockReset();
  setBrandingFetch(brandingFetchMock);
});

afterEach(() => {
  useAuthStore.setState({ accessToken: null, tenantId: null });
  useTenantStore.setState({ activeTenantId: null });
  resetBrandingFetch();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('fetchBrandingByTenant', () => {
  it('fetchBrandingByTenant_ShouldResolveFound_WhenTheRouteAnswers200WithAnObject', async () => {
    brandingFetchMock.mockResolvedValue(json(200, { displayName: 'Acme' }));

    const result = await fetchBrandingByTenant('acme');

    expect(result.status).toBe('found');
    expect(result.status === 'found' && result.brand.displayName).toBe('Acme');
    expect(brandingFetchMock).toHaveBeenCalledTimes(1);
    expect(brandingFetchMock.mock.calls[0]?.[0]).toBe('/api/v1/branding/acme');
    expect(brandingFetchMock.mock.calls[0]?.[1]?.method).toBe('GET');
  });

  it('fetchBrandingByTenant_ShouldEncodeTheTenant_WhenItHoldsPathCharacters', async () => {
    brandingFetchMock.mockResolvedValue(json(404, null));

    await fetchBrandingByTenant('a/b?c');

    expect(brandingFetchMock.mock.calls[0]?.[0]).toBe('/api/v1/branding/a%2Fb%3Fc');
  });

  it('fetchBrandingByTenant_ShouldResolveNotFound_WhenTheRouteAnswers404', async () => {
    brandingFetchMock.mockResolvedValue(json(404, { title: 'Not Found' }));

    await expect(fetchBrandingByTenant('acme')).resolves.toEqual({ status: 'not-found' });
  });

  it('fetchBrandingByTenant_ShouldResolveFailed_WhenTheRouteAnswers500', async () => {
    brandingFetchMock.mockResolvedValue(json(500, { title: 'boom' }));

    await expect(fetchBrandingByTenant('acme')).resolves.toEqual({ status: 'failed' });
  });

  it('fetchBrandingByTenant_ShouldResolveFailed_WhenTheNetworkFails', async () => {
    brandingFetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(fetchBrandingByTenant('acme')).resolves.toEqual({ status: 'failed' });
  });

  it('fetchBrandingByTenant_ShouldResolveFailed_WhenTheSeamThrowsSynchronously', async () => {
    brandingFetchMock.mockImplementation(() => {
      throw new Error('sync');
    });

    await expect(fetchBrandingByTenant('acme')).resolves.toEqual({ status: 'failed' });
  });

  it.each([['"Acme"'], ['[1,2]'], ['null'], ['not json']])(
    'fetchBrandingByTenant_ShouldResolveFailed_WhenThe200BodyIsNotAnObject %s',
    async (raw) => {
      brandingFetchMock.mockResolvedValue(new Response(raw, { status: 200 }));

      await expect(fetchBrandingByTenant('acme')).resolves.toEqual({ status: 'failed' });
    },
  );

  it('fetchBrandingByTenant_ShouldResolveFailed_WhenNoAnswerArrivesWithinThreeSeconds', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    brandingFetchMock.mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          signal = init.signal ?? undefined;
          signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );

    const pending = fetchBrandingByTenant('acme');
    await vi.advanceTimersByTimeAsync(BRANDING_TIMEOUT_MS - 1);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    expect(BRANDING_TIMEOUT_MS).toBe(3000);
    expect(signal?.aborted).toBe(true);
    await expect(pending).resolves.toEqual({ status: 'failed' });
  });

  it('fetchBranding_ShouldSendNoTokenOrTenantHeader_WhenTheUserIsSignedIn', async () => {
    // Signed in, so a regression that adds the headers only when there is a session is caught.
    useAuthStore.setState({ accessToken: 'signed-in-token', tenantId: 'acme' });
    useTenantStore.getState().setActiveTenant('acme');
    brandingFetchMock.mockResolvedValue(json(404, null));

    await fetchBrandingByTenant('acme');
    await fetchBrandingBySubdomain('acme');

    expect(brandingFetchMock).toHaveBeenCalledTimes(2);
    for (const [, init] of brandingFetchMock.mock.calls) {
      const headers = new Headers(init.headers);
      expect(headers.has('Authorization')).toBe(false);
      expect(headers.has('X-Tenant-Id')).toBe(false);
    }
  });

  it('fetchBrandingByTenant_ShouldNeverCallTheGlobalFetch_WhenASeamIsInstalled', async () => {
    const globalFetch = vi.fn();
    vi.stubGlobal('fetch', globalFetch);
    brandingFetchMock.mockResolvedValue(json(404, null));

    await fetchBrandingByTenant('acme');
    await fetchBrandingBySubdomain('acme');

    expect(globalFetch).not.toHaveBeenCalled();
    expect(brandingFetchMock).toHaveBeenCalledTimes(2);
  });

  it('resetBrandingFetch_ShouldRestoreTheBrowserFetch_WhenTheSeamIsReset', async () => {
    const globalFetch = vi.fn().mockResolvedValue(json(404, null));
    vi.stubGlobal('fetch', globalFetch);

    resetBrandingFetch();
    await expect(fetchBrandingByTenant('acme')).resolves.toEqual({ status: 'not-found' });

    expect(globalFetch).toHaveBeenCalledTimes(1);
    expect(brandingFetchMock).not.toHaveBeenCalled();
  });
});

describe('fetchBrandingBySubdomain', () => {
  it('fetchBrandingBySubdomain_ShouldRequestTheSubdomainRoute_WhenGivenALabel', async () => {
    brandingFetchMock.mockResolvedValue(json(200, { displayName: 'Acme' }));

    const result = await fetchBrandingBySubdomain('acme');

    expect(result.status).toBe('found');
    expect(brandingFetchMock.mock.calls[0]?.[0]).toBe('/api/v1/branding/by-subdomain/acme');
  });

  it('fetchBrandingBySubdomain_ShouldResolveNotFound_WhenTheRouteAnswers404', async () => {
    brandingFetchMock.mockResolvedValue(json(404, null));

    await expect(fetchBrandingBySubdomain('acme')).resolves.toEqual({ status: 'not-found' });
  });

  it('fetchBrandingBySubdomain_ShouldResolveFailed_WhenTheNetworkFails', async () => {
    brandingFetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(fetchBrandingBySubdomain('acme')).resolves.toEqual({ status: 'failed' });
  });
});
