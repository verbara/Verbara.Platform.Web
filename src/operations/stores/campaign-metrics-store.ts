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
}

const mockCampaigns: CampaignMetrics[] = [
  {
    campaignId: 'c-1',
    campaignName: 'Renovacion Q1',
    status: 'active',
    contactsRemaining: 1240,
    contactsDialed: 3760,
    connectRate: 0.42,
    abandonRate: 0.03,
    activeCalls: 12,
    pacingRate: 1.5,
  },
  {
    campaignId: 'c-2',
    campaignName: 'Encuesta Satisfaccion',
    status: 'active',
    contactsRemaining: 890,
    contactsDialed: 2110,
    connectRate: 0.38,
    abandonRate: 0.05,
    activeCalls: 8,
    pacingRate: 1.2,
  },
  {
    campaignId: 'c-3',
    campaignName: 'Cobranza Marzo',
    status: 'paused',
    contactsRemaining: 2300,
    contactsDialed: 700,
    connectRate: 0.31,
    abandonRate: 0.07,
    activeCalls: 0,
    pacingRate: 1.0,
  },
  {
    campaignId: 'c-4',
    campaignName: 'Promo Verano',
    status: 'completed',
    contactsRemaining: 0,
    contactsDialed: 5000,
    connectRate: 0.45,
    abandonRate: 0.02,
    activeCalls: 0,
    pacingRate: 0,
  },
];

export const useCampaignMetricsStore = create<CampaignMetricsState>()(() => ({
  campaigns: mockCampaigns,
}));
