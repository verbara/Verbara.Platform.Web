import { useTranslation } from 'react-i18next';
import { Bot, ArrowRightLeft, CheckCircle, XCircle } from 'lucide-react';
import { useBotAnalytics } from '@/core/api/hooks/use-analytics';
import { useFormatNumber } from '@/core/i18n/use-format';

interface KpiMiniProps {
  readonly label: string;
  readonly value: string;
  readonly color: string;
}

function KpiMini({ label, value, color }: KpiMiniProps) {
  return (
    <div className="text-center">
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

interface BotAnalyticsCardProps {
  readonly from?: string;
  readonly to?: string;
}

export function BotAnalyticsCard({ from, to }: BotAnalyticsCardProps) {
  const { t } = useTranslation('analytics');
  const { formatNumber } = useFormatNumber();
  const { data, isLoading } = useBotAnalytics(from, to);

  if (isLoading) {
    return (
      <div
        className="h-36 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-700"
        data-testid="bot-analytics-card-loading"
      />
    );
  }

  if (!data || data.totalConversations === 0) return null;

  const resColor =
    data.resolutionRate > 0.6
      ? 'text-green-600'
      : data.resolutionRate > 0.3
        ? 'text-amber-600'
        : 'text-red-600';
  const handoffColor = data.handoffRate > 0.4 ? 'text-amber-600' : 'text-green-600';

  return (
    <div
      className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
      data-testid="bot-analytics-card"
    >
      <div className="mb-3 flex items-center gap-2">
        <Bot className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t('bot_analytics.title')}</h3>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiMini
          label={t('bot_analytics.conversations')}
          value={formatNumber(data.totalConversations)}
          color="text-slate-900 dark:text-white"
        />
        <KpiMini
          label={t('bot_analytics.resolution')}
          value={`${(data.resolutionRate * 100).toFixed(0)}%`}
          color={resColor}
        />
        <KpiMini
          label={t('bot_analytics.handoff')}
          value={`${(data.handoffRate * 100).toFixed(0)}%`}
          color={handoffColor}
        />
        <KpiMini label={t('bot_analytics.avg_turns')} value={data.avgTurns.toFixed(1)} color="text-slate-900 dark:text-white" />
      </div>

      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
        <div
          className="bg-green-500 transition-all"
          style={{ width: `${data.resolutionRate * 100}%` }}
          title={`${t('bot_analytics.resolved_prefix')}${data.resolved}`}
        />
        <div
          className="bg-amber-500 transition-all"
          style={{ width: `${data.handoffRate * 100}%` }}
          title={`${t('bot_analytics.handed_off_prefix')}${data.handedOff}`}
        />
        <div
          className="bg-red-500 transition-all"
          style={{ width: `${data.failureRate * 100}%` }}
          title={`${t('bot_analytics.failed_prefix')}${data.failed}`}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <CheckCircle className="h-2.5 w-2.5 text-green-500" />
          {t('bot_analytics.resolved_label')}{data.resolved})
        </span>
        <span className="flex items-center gap-1">
          <ArrowRightLeft className="h-2.5 w-2.5 text-amber-500" />
          {t('bot_analytics.handoff_label')}{data.handedOff})
        </span>
        <span className="flex items-center gap-1">
          <XCircle className="h-2.5 w-2.5 text-red-500" />
          {t('bot_analytics.failed_label')}{data.failed})
        </span>
      </div>
    </div>
  );
}
