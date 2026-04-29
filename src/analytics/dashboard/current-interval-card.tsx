import { useTranslation } from 'react-i18next';
import { Activity } from 'lucide-react';
import { useCurrentInterval } from '@/core/api/hooks/use-analytics';

export function CurrentIntervalCard() {
  const { t } = useTranslation('analytics');
  const { data: interval } = useCurrentInterval();
  if (!interval) return null;

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{t('current_interval.title')}</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><p className="text-muted-foreground">{t('current_interval.offered')}</p><p className="text-lg font-bold">{interval.callsOffered}</p></div>
        <div><p className="text-muted-foreground">{t('current_interval.answered')}</p><p className="text-lg font-bold">{interval.callsAnswered}</p></div>
        <div><p className="text-muted-foreground">{t('current_interval.sla')}</p><p className="text-lg font-bold">{interval.slaPercent.toFixed(1)}%</p></div>
        <div><p className="text-muted-foreground">{t('current_interval.aht')}</p><p className="text-lg font-bold">{(interval.ahtMs / 1000).toFixed(0)}s</p></div>
      </div>
    </div>
  );
}
