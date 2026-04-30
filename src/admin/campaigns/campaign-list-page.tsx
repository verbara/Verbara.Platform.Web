import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, Megaphone, Play, Pause, Square } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';
import {
  useCampaigns,
  useStartCampaign,
  usePauseCampaign,
  useStopCampaign,
  type CampaignSummary,
} from '@/core/api/hooks/use-campaigns';

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed';
export type DialingMode = 'preview' | 'progressive' | 'predictive' | 'power' | 'agentless';

const STATUS_VARIANT: Record<CampaignStatus, 'default' | 'secondary' | 'outline'> = {
  draft: 'secondary',
  active: 'default',
  paused: 'outline',
  completed: 'secondary',
};

const columnHelper = createColumnHelper<CampaignSummary>();

export default function CampaignListPage() {
  const { t } = useTranslation(['admin']);
  const navigate = useNavigate();

  const { data, isLoading } = useCampaigns();
  const campaigns: CampaignSummary[] = data ?? [];

  const startCampaign = useStartCampaign();
  const pauseCampaign = usePauseCampaign();
  const stopCampaign = useStopCampaign();

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('admin:campaigns.name'),
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.display({
        id: 'status',
        header: () => t('admin:campaigns.status'),
        cell: (info) => {
          const status = info.row.original.status;
          return (
            <Badge variant={STATUS_VARIANT[status]}>
              {t(`admin:campaigns.status_${status}`)}
            </Badge>
          );
        },
      }),
      columnHelper.accessor('queueName', {
        header: () => t('admin:campaigns.queue'),
      }),
      columnHelper.accessor('mode', {
        header: () => t('admin:campaigns.mode'),
        cell: (info) => (
          <span className="capitalize">{info.getValue()}</span>
        ),
      }),
      columnHelper.display({
        id: 'progress',
        header: () => t('admin:campaigns.progress'),
        cell: (info) => {
          const { totalContacts, contactsDialed } = info.row.original;
          const pct = totalContacts > 0 ? Math.round((contactsDialed / totalContacts) * 100) : 0;
          return (
            <div className="flex items-center gap-2">
              <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{pct}%</span>
            </div>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: () => t('admin:campaigns.actions'),
        cell: (info) => {
          const { id, status } = info.row.original;
          return (
            <div className="flex gap-1">
              {status === 'draft' && (
                <Button
                  variant="ghost"
                  size="icon"
                  title={t('admin:campaigns.start')}
                  onClick={(e) => { e.stopPropagation(); startCampaign.mutate(id); }}
                >
                  <Play className="h-4 w-4" />
                </Button>
              )}
              {status === 'active' && (
                <Button
                  variant="ghost"
                  size="icon"
                  title={t('admin:campaigns.pause')}
                  onClick={(e) => { e.stopPropagation(); pauseCampaign.mutate(id); }}
                >
                  <Pause className="h-4 w-4" />
                </Button>
              )}
              {status === 'paused' && (
                <Button
                  variant="ghost"
                  size="icon"
                  title={t('admin:campaigns.start')}
                  onClick={(e) => { e.stopPropagation(); startCampaign.mutate(id); }}
                >
                  <Play className="h-4 w-4" />
                </Button>
              )}
              {(status === 'active' || status === 'paused') && (
                <Button
                  variant="ghost"
                  size="icon"
                  title={t('admin:campaigns.stop')}
                  onClick={(e) => { e.stopPropagation(); stopCampaign.mutate(id); }}
                >
                  <Square className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        },
      }),
    ],
    [t, startCampaign, pauseCampaign, stopCampaign],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('admin:campaigns.title')}>
          <Button onClick={() => navigate('/admin/campaigns/new')}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t('admin:campaigns.create')}
          </Button>
        </PageHeader>
        <div className="flex h-64 items-center justify-center text-muted-foreground">{t('common:status.loading')}</div>
      </div>
    );
  }

  const isEmpty = campaigns.length === 0;

  return (
    <div className="space-y-6" data-testid="campaigns-page">
      <PageHeader title={t('admin:campaigns.title')}>
        <Button data-testid="campaigns-create-btn" onClick={() => navigate('/admin/campaigns/new')}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:campaigns.create')}
        </Button>
      </PageHeader>

      {isEmpty ? (
        <EmptyState
          icon={Megaphone}
          message={t('admin:campaigns.empty')}
        />
      ) : (
        <DataTable
          data={campaigns}
          columns={columns}
          searchPlaceholder={t('admin:campaigns.searchPlaceholder')}
          noResultsMessage={t('admin:campaigns.noResults')}
          onRowClick={(campaign) => navigate(`/admin/campaigns/${campaign.id}`)}
        />
      )}
    </div>
  );
}
