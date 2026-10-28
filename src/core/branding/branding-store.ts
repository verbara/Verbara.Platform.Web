import { create } from 'zustand';
import { fetchBrandingBySubdomain, fetchBrandingByTenant } from './branding-api';
import { applyBrandTheme, resetBrandTheme } from './brand-theme';
import type { PublicBranding } from './public-branding';

/** Which brand is painted: the Verbara defaults, the host label's, or a tenant's. */
export type BrandSource = 'default' | 'host' | 'tenant';

/**
 * The host lookup's own state, so "nothing painted yet" and "host still in flight" are never the
 * same state. `not-found` is also the state with no host label at all (nothing to wait for).
 */
export type HostLookup = 'pending' | 'found' | 'not-found' | 'failed';

interface BrandingState {
  /** The painted brand, or `null` for the Verbara defaults. */
  readonly brand: PublicBranding | null;
  readonly source: BrandSource;
  /** The host label or tenant id whose brand is painted; `null` on the defaults. */
  readonly key: string | null;
  readonly host: HostLookup;
  /** A tenant commit made while the host lookup was pending; only the latest is kept. */
  readonly queued: string | null;
  /** Sequence number of the latest lookup by tenant; an answer for an earlier one is dropped. */
  readonly tenantSeq: number;
  /**
   * The sign-in chain generation. Sign-in completing, the sign-in page unmounting and `reset()`
   * advance it; an answer whose request started under an earlier generation is dropped.
   */
  readonly generation: number;

  /**
   * Look the host label up as a subdomain. On a brand it is painted with source `host` and any
   * queued commit is discarded. Resolves to the outcome, or `stale` when the chain generation
   * advanced meanwhile (nothing was committed and the caller must not fall back).
   */
  lookupHost: (label: string) => Promise<HostLookup | 'stale'>;
  /** Record that the host carries no label: no request, nothing to wait for. */
  markNoHost: () => void;
  /**
   * Look a tenant up and paint the answer with source `tenant`; anything but a brand returns to the
   * defaults. An empty value returns to the defaults without a request. Only the latest lookup's
   * answer, under the current chain generation, is committed.
   */
  lookupTenant: (tenant: string) => Promise<void>;
  /** Queue a tenant commit made while the host lookup is pending, replacing an earlier one. */
  queueCommit: (tenant: string) => void;
  /** Take the queued commit, clearing the queue. */
  takeQueued: () => string | null;
  /** End the sign-in chain: answers to the requests it started are dropped. */
  advanceGeneration: () => void;
  /** Return to the Verbara defaults, restore the theme, and drop every answer still in flight. */
  reset: () => void;
}

const DEFAULTS = {
  brand: null,
  source: 'default',
  key: null,
  host: 'not-found',
  queued: null,
} as const;

export const useBrandingStore = create<BrandingState>()((set, get) => {
  /** The one place a brand is committed, so the theme layer always follows the store. */
  function paint(brand: PublicBranding | null, source: BrandSource, key: string | null): void {
    set(brand ? { brand, source, key } : { brand: null, source: 'default', key: null });
    applyBrandTheme(brand);
  }

  return {
    ...DEFAULTS,
    tenantSeq: 0,
    generation: 0,

    lookupHost: async (label) => {
      const { generation } = get();
      set({ host: 'pending' });
      const result = await fetchBrandingBySubdomain(label);
      if (get().generation !== generation) return 'stale';
      if (result.status === 'found') {
        paint(result.brand, 'host', label);
        set({ host: 'found', queued: null });
        return 'found';
      }
      set({ host: result.status });
      return result.status;
    },

    markNoHost: () => set({ host: 'not-found' }),

    lookupTenant: async (tenant) => {
      const seq = get().tenantSeq + 1;
      const { generation } = get();
      set({ tenantSeq: seq });
      if (tenant.trim() === '') {
        paint(null, 'default', null);
        return;
      }
      const result = await fetchBrandingByTenant(tenant);
      if (get().tenantSeq !== seq || get().generation !== generation) return;
      paint(result.status === 'found' ? result.brand : null, 'tenant', tenant);
    },

    queueCommit: (tenant) => set({ queued: tenant }),

    takeQueued: () => {
      const { queued } = get();
      set({ queued: null });
      return queued;
    },

    advanceGeneration: () => set((s) => ({ generation: s.generation + 1 })),

    reset: () => {
      set((s) => ({ ...DEFAULTS, tenantSeq: s.tenantSeq + 1, generation: s.generation + 1 }));
      resetBrandTheme();
    },
  };
});
