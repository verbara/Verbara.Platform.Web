import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/admin/shared/page-header';
import { Button } from '@/core/ui/button';
import { useCampaignMetricsStore, type CampaignStatus } from '@/operations/stores/campaign-metrics-store';
import { CampaignCard } from './campaign-card';

type FilterValue = 'all' | CampaignStatus;

const filterOptions: FilterValue[] = ['all', 'active', 'paused'];

export default function CampaignMonitorPage() {
  const { t } = useTranslation('operations');
  const campaigns = useCampaignMetricsStore((s) => s.campaigns);
  const [filter, setFilter] = useState<FilterValue>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return campaigns;
    return campaigns.filter((c) => c.status === filter);
  }, [campaigns, filter]);

  const handlePause = useCallback((id: string) => {
    useCampaignMetricsStore.setState((state) => ({
      campaigns: state.campaigns.map((c) =>
        c.campaignId === id ? { ...c, status: 'paused' as const, activeCalls: 0 } : c,
      ),
    }));
  }, []);

  const handleResume = useCallback((id: string) => {
    useCampaignMetricsStore.setState((state) => ({
      campaigns: state.campaigns.map((c) =>
        c.campaignId === id ? { ...c, status: 'active' as const } : c,
      ),
    }));
  }, []);

  const handleStop = useCallback((id: string) => {
    useCampaignMetricsStore.setState((state) => ({
      campaigns: state.campaigns.map((c) =>
        c.campaignId === id ? { ...c, status: 'completed' as const, activeCalls: 0 } : c,
      ),
    }));
  }, []);

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
