import { create } from 'zustand';

export type CampaignStatus = 'active' | 'paused' | 'completed';

export interface CampaignMetrics {
  campaignId: string;
  campaignName: string;
  status: CampaignStatus;
  contactsRemaining: number;
  contactsDialed: number;
  connectRate: number;
  abandonRate: number;
  activeCalls: number;
  pacingRate: number;
}

interface CampaignMetricsState {
  campaigns: CampaignMetrics[];
  initialize: (campaigns: CampaignMetrics[]) => void;
  updateMetrics: (campaignId: string, metrics: Partial<CampaignMetrics>) => void;
  updateStatus: (campaignId: string, newStatus: CampaignStatus) => void;
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
