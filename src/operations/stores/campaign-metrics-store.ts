import { create } from 'zustand';
import {
  normalizeCampaignStatus,
  type CampaignSummaryStatus,
} from '@/core/api/hooks/use-campaigns';
import { onSseEvent } from '@/core/hooks/use-sse';

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

/**
 * `campaign.status_changed` (`CampaignStatusChangedEvent`; host fixture
 * `campaign-status-changed.event.json`). Not in Platform's OpenAPI document, so typed here by hand
 * (design D2); the envelope members (`tenantId`, `type`, `timestamp`, `metadata`, `eventType`) are
 * never read.
 */
interface CampaignStatusChangedPayload {
  campaignId: number;
  campaignName: string;
  oldStatus: string;
  newStatus: string;
}

/** `campaign.metrics_updated` (`CampaignMetricsUpdatedEvent`; host fixture `campaign-metrics-updated.event.json`). */
interface CampaignMetricsUpdatedPayload {
  campaignId: number;
  contactsDialed: number;
  contactsRemaining: number;
  connectRate: number;
  abandonRate: number;
  activeCalls: number;
}

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

// The store feeds itself, from when the monitor's chunk loads (design D5). Nothing counted before
// that: the list is empty until the first entry, and every entry replaces it with the API's.
onSseEvent('campaign.status_changed', (data) => {
  const event = data as CampaignStatusChangedPayload;
  useCampaignMetricsStore
    .getState()
    .updateStatus(String(event.campaignId), normalizeCampaignStatus(event.newStatus));
});

onSseEvent('campaign.metrics_updated', (data) => {
  // Only the metric members: the event's envelope and its numeric `campaignId` never reach the
  // stored campaign, whose key, name, status and pacing stay (design D2).
  const { campaignId, contactsDialed, contactsRemaining, connectRate, abandonRate, activeCalls } =
    data as CampaignMetricsUpdatedPayload;
  useCampaignMetricsStore.getState().updateMetrics(String(campaignId), {
    contactsDialed,
    contactsRemaining,
    connectRate,
    abandonRate,
    activeCalls,
  });
});
