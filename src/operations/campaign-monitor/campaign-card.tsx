import { useTranslation } from 'react-i18next';
import { Pause, Play, Square } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/core/ui/badge';
import { Button } from '@/core/ui/button';
import { useFormatNumber } from '@/core/i18n/use-format';
import type { CampaignMetrics, CampaignStatus } from '@/operations/stores/campaign-metrics-store';

const statusBadge: Record<CampaignStatus, { variant: 'default' | 'secondary' | 'outline'; className: string }> = {
  active: { variant: 'default', className: 'bg-emerald-600' },
  paused: { variant: 'secondary', className: 'bg-amber-500 text-white' },
  completed: { variant: 'outline', className: '' },
};

interface CampaignCardProps {
  campaign: CampaignMetrics;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onStop: (id: string) => void;
}

export function CampaignCard({ campaign, onPause, onResume, onStop }: CampaignCardProps) {
  const { t } = useTranslation('operations');
  const { formatNumber, formatPercent } = useFormatNumber();

  const total = campaign.contactsDialed + campaign.contactsRemaining;
  const progressPct = total > 0 ? (campaign.contactsDialed / total) * 100 : 0;

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate font-medium text-foreground">{campaign.campaignName}</h3>
        <Badge
          variant={statusBadge[campaign.status].variant}
          className={statusBadge[campaign.status].className}
        >
          {t(`campaigns.${campaign.status}`)}
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t('campaigns.remaining')}: {formatNumber(campaign.contactsRemaining)}</span>
          <span>{Math.round(progressPct)}%</span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Metrics grid */}
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Metric label={t('campaigns.dialed')} value={formatNumber(campaign.contactsDialed)} />
        <Metric label={t('campaigns.connect_rate')} value={formatPercent(campaign.connectRate)} />
        <Metric label={t('campaigns.abandon_rate')} value={formatPercent(campaign.abandonRate)} />
        <Metric label={t('campaigns.active_calls')} value={String(campaign.activeCalls)} />
        <Metric label={t('campaigns.pacing')} value={`${campaign.pacingRate}x`} />
      </div>

      {/* Actions */}
      {campaign.status !== 'completed' && (
        <div className="mt-4 flex gap-2">
          {campaign.status === 'active' ? (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                onPause(campaign.campaignId);
                toast.info(`${campaign.campaignName} paused`);
              }}
            >
              <Pause className="mr-1 h-3.5 w-3.5" />
              {t('campaigns.pause')}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                onResume(campaign.campaignId);
                toast.info(`${campaign.campaignName} resumed`);
              }}
            >
              <Play className="mr-1 h-3.5 w-3.5" />
              {t('campaigns.resume')}
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              onStop(campaign.campaignId);
              toast.info(`${campaign.campaignName} stopped`);
            }}
          >
            <Square className="mr-1 h-3.5 w-3.5" />
            {t('campaigns.stop')}
          </Button>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
