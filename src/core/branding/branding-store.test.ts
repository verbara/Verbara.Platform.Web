/**
 * The one brand store (design D2): which brand is painted and from where, the host lookup's own
 * state, the queued tenant commit, drop-stale for lookups by tenant, and the sign-in chain
 * generation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBrandingFetch, resetBrandingFetch, type BrandingFetch } from './branding-api';
import { useBrandingStore } from './branding-store';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

/** A seam whose answers the test releases one by one, by URL. */
function deferredFetch() {
  const pending = new Map<string, (response: Response) => void>();
  const fn = vi.fn<BrandingFetch>(
    (input) =>
      new Promise<Response>((resolve) => {
        pending.set(input, resolve);
      }),
  );
  const release = async (url: string, response: Response) => {
    const resolve = pending.get(url);
    if (!resolve) throw new Error(`no request for ${url}`);
    pending.delete(url);
    resolve(response);
    // Let the lookup read the body and settle before the next release.
    await new Promise((r) => setTimeout(r, 0));
  };
  return { fn, release };
}

const state = () => useBrandingStore.getState();

beforeEach(() => {
  document.head.innerHTML = '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />';
});

afterEach(() => {
  state().reset();
  resetBrandingFetch();
  document.head.innerHTML = '';
});

describe('useBrandingStore', () => {
  it('useBrandingStore_ShouldStartOnTheDefaults_WhenNothingWasLookedUp', () => {
    expect(state().brand).toBeNull();
    expect(state().source).toBe('default');
    expect(state().key).toBeNull();
    expect(state().queued).toBeNull();
  });

  it('lookupTenant_ShouldPaintTheTenantBrand_WhenTheTenantIsFound', async () => {
    setBrandingFetch(vi.fn<BrandingFetch>().mockResolvedValue(json(200, { displayName: 'Acme' })));

    await state().lookupTenant('acme');

    expect(state().brand?.displayName).toBe('Acme');
    expect(state().source).toBe('tenant');
    expect(state().key).toBe('acme');
  });

  it('lookupTenant_ShouldReturnToTheDefaults_WhenTheLatestLookupFindsNothing', async () => {
    const fn = vi
      .fn<BrandingFetch>()
      .mockResolvedValueOnce(json(200, { displayName: 'Acme', primaryColor: '#336699' }))
      .mockResolvedValueOnce(json(404, null));
    setBrandingFetch(fn);

    await state().lookupTenant('acme');
    await state().lookupTenant('nobody');

    expect(state().brand).toBeNull();
    expect(state().source).toBe('default');
    expect(document.documentElement.style.getPropertyValue('--color-brand')).toBe('');
  });

  it('lookupTenant_ShouldResetWithoutARequest_WhenTheValueIsEmpty', async () => {
    const fn = vi.fn<BrandingFetch>().mockResolvedValue(json(200, { displayName: 'Acme' }));
    setBrandingFetch(fn);
    await state().lookupTenant('acme');

    await state().lookupTenant('  ');

    expect(fn).toHaveBeenCalledTimes(1);
    expect(state().source).toBe('default');
  });

  /** Spec `console-tenant-branding`, "A late answer for an earlier value is dropped". */
  it('lookupTenant_ShouldDropALateAnswer_WhenItIsForAnEarlierValue', async () => {
    const { fn, release } = deferredFetch();
    setBrandingFetch(fn);

    const first = state().lookupTenant('acme');
    const second = state().lookupTenant('globex');
    await release('/api/v1/branding/globex', json(200, { displayName: 'Globex' }));
    await release('/api/v1/branding/acme', json(200, { displayName: 'Acme' }));
    await Promise.all([first, second]);

    expect(state().brand?.displayName).toBe('Globex');
    expect(state().key).toBe('globex');
  });

  it('lookupTenant_ShouldPaintTheTheme_WhenTheBrandSetsFaviconAndColour', async () => {
    setBrandingFetch(
      vi
        .fn<BrandingFetch>()
        .mockResolvedValue(json(200, { faviconUrl: '/acme.svg', primaryColor: '#336699' })),
    );

    await state().lookupTenant('acme');

    expect(document.head.querySelector('link[rel="icon"]')?.getAttribute('href')).toBe('/acme.svg');
    expect(document.documentElement.style.getPropertyValue('--color-brand')).toBe('#336699');
  });

  it('lookupHost_ShouldPaintTheHostBrandAndDiscardTheQueue_WhenTheHostIsFound', async () => {
    const { fn, release } = deferredFetch();
    setBrandingFetch(fn);

    const lookup = state().lookupHost('acme');
    expect(state().host).toBe('pending');
    state().queueCommit('globex');
    state().queueCommit('initech');
    expect(state().queued).toBe('initech');
    await release('/api/v1/branding/by-subdomain/acme', json(200, { displayName: 'Acme' }));

    await expect(lookup).resolves.toBe('found');
    expect(state().host).toBe('found');
    expect(state().source).toBe('host');
    expect(state().key).toBe('acme');
    expect(state().queued).toBeNull();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['not-found', () => Promise.resolve(json(404, null))],
    ['failed', () => Promise.reject(new TypeError('Failed to fetch'))],
  ] as const)(
    'lookupHost_ShouldRecordTheOutcomeAndKeepTheQueue_WhenTheHostFindsNothing %s',
    async (outcome, answer) => {
      setBrandingFetch(vi.fn<BrandingFetch>(answer));

      const lookup = state().lookupHost('acme');
      state().queueCommit('globex');

      await expect(lookup).resolves.toBe(outcome);
      expect(state().host).toBe(outcome);
      expect(state().source).toBe('default');
      expect(state().takeQueued()).toBe('globex');
      expect(state().queued).toBeNull();
    },
  );

  it('markNoHost_ShouldSetHostNotFoundWithoutARequest_WhenThereIsNoLabel', () => {
    const fn = vi.fn<BrandingFetch>();
    setBrandingFetch(fn);

    state().markNoHost();

    expect(state().host).toBe('not-found');
    expect(fn).not.toHaveBeenCalled();
  });

  it('lookupHost_ShouldCommitNothing_WhenTheChainGenerationAdvancedWhileItWasPending', async () => {
    const { fn, release } = deferredFetch();
    setBrandingFetch(fn);

    const lookup = state().lookupHost('acme');
    state().advanceGeneration();
    await release('/api/v1/branding/by-subdomain/acme', json(200, { displayName: 'Acme' }));

    await expect(lookup).resolves.toBe('stale');
    expect(state().brand).toBeNull();
    expect(state().source).toBe('default');
  });

  it('lookupTenant_ShouldCommitNothing_WhenTheChainGenerationAdvancedWhileItWasPending', async () => {
    const { fn, release } = deferredFetch();
    setBrandingFetch(fn);

    const lookup = state().lookupTenant('acme');
    state().advanceGeneration();
    await release('/api/v1/branding/acme', json(200, { displayName: 'Acme' }));
    await lookup;

    expect(state().brand).toBeNull();
  });

  it('reset_ShouldReturnToTheDefaultsAndRestoreTheTheme_WhenABrandIsPainted', async () => {
    setBrandingFetch(
      vi
        .fn<BrandingFetch>()
        .mockResolvedValue(
          json(200, { displayName: 'Acme', faviconUrl: '/acme.svg', primaryColor: '#336699' }),
        ),
    );
    await state().lookupTenant('acme');
    state().queueCommit('globex');

    state().reset();

    expect(state().brand).toBeNull();
    expect(state().source).toBe('default');
    expect(state().key).toBeNull();
    expect(state().queued).toBeNull();
    expect(document.head.querySelector('link[rel="icon"]')?.getAttribute('href')).toBe(
      '/favicon.svg',
    );
    expect(document.documentElement.style.getPropertyValue('--color-brand')).toBe('');
  });

  it('reset_ShouldDropAnAnswerStillInFlight_WhenItArrivesAfterTheReset', async () => {
    const { fn, release } = deferredFetch();
    setBrandingFetch(fn);

    const lookup = state().lookupTenant('acme');
    state().reset();
    await release('/api/v1/branding/acme', json(200, { displayName: 'Acme' }));
    await lookup;

    expect(state().brand).toBeNull();
  });
});
