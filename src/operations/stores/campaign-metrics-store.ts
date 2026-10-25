import { create } from 'zustand';
import type { CampaignSummaryStatus } from '@/core/api/hooks/use-campaigns';

/**
 * A campaign as the Operations monitor holds it: keyed by its `campaignId` as a string, its status
 * the console's one campaign status (`use-campaigns.ts`), normalized at the read boundary.
 */
export interface CampaignMetrics {
  campaignId: string;
  campaignName: string;
  status: CampaignSummaryStatus;
  contactsRemaining: number;
  contactsDialed: number;
  connectRate: number;
  abandonRate: number;
  activeCalls: number;
  pacingRate: number;
}

/** The members a `campaign.metrics_updated` event changes; the key, name, status and pacing stay. */
export type CampaignMetricsUpdate = Partial<
  Pick<
    CampaignMetrics,
    'contactsDialed' | 'contactsRemaining' | 'connectRate' | 'abandonRate' | 'activeCalls'
  >
>;

interface CampaignMetricsState {
  campaigns: CampaignMetrics[];
  initialize: (campaigns: CampaignMetrics[]) => void;
  updateMetrics: (campaignId: string, metrics: CampaignMetricsUpdate) => void;
  updateStatus: (campaignId: string, newStatus: CampaignSummaryStatus) => void;
}

export const useCampaignMetricsStore = create<CampaignMetricsState>()((set) => ({
  campaigns: [],

  initialize: (campaigns) => set({ campaigns }),

  updateMetrics: (campaignId, metrics) =>
    set((state) => ({
      campaigns: state.campaigns.map((c) =>
        c.campaignId === campaignId ? { ...c, ...metrics } : c,
      ),
    })),

  updateStatus: (campaignId, newStatus) =>
    set((state) => ({
      campaigns: state.campaigns.map((c) =>
        c.campaignId === campaignId ? { ...c, status: newStatus } : c,
      ),
    })),
}));
