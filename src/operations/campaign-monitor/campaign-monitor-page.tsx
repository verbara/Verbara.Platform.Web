import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/admin/shared/page-header';
import { Button } from '@/core/ui/button';
import { useCampaignMetricsStore, type CampaignStatus } from '@/operations/stores/campaign-metrics-store';
import {
  useActiveCampaignMetrics,
  usePauseCampaign,
  useResumeCampaign,
  useStopCampaign,
  type CampaignMetrics as ApiCampaignMetrics,
} from '@/core/api/hooks/use-campaigns';
import { CampaignCard } from './campaign-card';

type FilterValue = 'all' | CampaignStatus;

const filterOptions: FilterValue[] = ['all', 'active', 'paused'];

function toStoreCampaign(api: ApiCampaignMetrics) {
  return {
    campaignId: String(api.campaignId),
    campaignName: api.campaignName,
    status: (api.status as CampaignStatus) ?? 'active',
    contactsRemaining: api.contactsRemaining,
    contactsDialed: api.contactsDialed,
    connectRate: api.connectRate,
    abandonRate: api.abandonRate,
    activeCalls: api.activeCalls,
    pacingRate: api.pacingRate,
  };
}

export default function CampaignMonitorPage() {
  const { t } = useTranslation('operations');
  const { campaigns, initialize } = useCampaignMetricsStore();
  const [filter, setFilter] = useState<FilterValue>('all');

  const { data: apiMetrics } = useActiveCampaignMetrics();
  const pauseMutation = usePauseCampaign();
  const resumeMutation = useResumeCampaign();
  const stopMutation = useStopCampaign();

  useEffect(() => {
    if (apiMetrics) {
      initialize(apiMetrics.map(toStoreCampaign));
    }
  }, [apiMetrics, initialize]);

  const filtered = useMemo(() => {
    if (filter === 'all') return campaigns;
    return campaigns.filter((c) => c.status === filter);
  }, [campaigns, filter]);

  const handlePause = useCallback(
    (id: string) => {
      pauseMutation.mutate(Number(id));
    },
    [pauseMutation],
  );

  const handleResume = useCallback(
    (id: string) => {
      resumeMutation.mutate(Number(id));
    },
    [resumeMutation],
  );

  const handleStop = useCallback(
    (id: string) => {
      stopMutation.mutate(Number(id));
    },
    [stopMutation],
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t('campaigns.title')} />

      {/* Filter buttons */}
      <div className="flex gap-2">
        {filterOptions.map((opt) => (
          <Button
            key={opt}
            variant={filter === opt ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(opt)}
          >
            {t(`campaigns.${opt}`)}
          </Button>
        ))}
      </div>

      {/* Campaign grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((campaign) => (
          <CampaignCard
            key={campaign.campaignId}
            campaign={campaign}
            onPause={handlePause}
            onResume={handleResume}
            onStop={handleStop}
          />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
            No campaigns match the current filter.
          </div>
        )}
      </div>
    </div>
  );
}
