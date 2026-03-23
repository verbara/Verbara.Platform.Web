import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, Megaphone, Play, Pause, Square } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed';
export type DialingMode = 'preview' | 'progressive' | 'predictive' | 'power' | 'agentless';

export interface CampaignSummary {
  id: string;
  name: string;
  status: CampaignStatus;
  queueName: string;
  mode: DialingMode;
  totalContacts: number;
  contactsDialed: number;
}

export const MOCK_CAMPAIGNS: CampaignSummary[] = [
  { id: 'c1', name: 'Q1 Retention', status: 'active', queueName: 'Retention', mode: 'predictive', totalContacts: 5000, contactsDialed: 2340 },
  { id: 'c2', name: 'Product Launch', status: 'draft', queueName: 'Sales', mode: 'preview', totalContacts: 1200, contactsDialed: 0 },
  { id: 'c3', name: 'Survey 2026', status: 'completed', queueName: 'Support', mode: 'agentless', totalContacts: 800, contactsDialed: 800 },
  { id: 'c4', name: 'Debt Collection', status: 'paused', queueName: 'Collections', mode: 'power', totalContacts: 3000, contactsDialed: 1500 },
];

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

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => MOCK_CAMPAIGNS,
  });

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
          const { status } = info.row.original;
          return (
            <div className="flex gap-1">
              {status === 'draft' && (
                <Button variant="ghost" size="icon" title={t('admin:campaigns.start')}>
                  <Play className="h-4 w-4" />
                </Button>
              )}
              {status === 'active' && (
                <Button variant="ghost" size="icon" title={t('admin:campaigns.pause')}>
                  <Pause className="h-4 w-4" />
                </Button>
              )}
              {status === 'paused' && (
                <Button variant="ghost" size="icon" title={t('admin:campaigns.start')}>
                  <Play className="h-4 w-4" />
                </Button>
              )}
              {(status === 'active' || status === 'paused') && (
                <Button variant="ghost" size="icon" title={t('admin:campaigns.stop')}>
                  <Square className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        },
      }),
    ],
    [t],
  );

  const isEmpty = campaigns.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin:campaigns.title')}>
        <Button onClick={() => navigate('/admin/campaigns/new')}>
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
