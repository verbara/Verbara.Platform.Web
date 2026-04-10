import { Bot, ArrowRightLeft, CheckCircle, XCircle } from 'lucide-react';
import { useBotAnalytics } from '@/core/api/hooks/use-analytics';

interface KpiMiniProps {
  label: string;
  value: string;
  color: string;
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
  from?: string;
  to?: string;
}

export function BotAnalyticsCard({ from, to }: BotAnalyticsCardProps) {
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
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Bot Performance</h3>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiMini
          label="Conversations"
          value={data.totalConversations.toLocaleString()}
          color="text-slate-900 dark:text-white"
        />
        <KpiMini
          label="Resolution"
          value={`${(data.resolutionRate * 100).toFixed(0)}%`}
          color={resColor}
        />
        <KpiMini
          label="Handoff"
          value={`${(data.handoffRate * 100).toFixed(0)}%`}
          color={handoffColor}
        />
        <KpiMini label="Avg Turns" value={data.avgTurns.toFixed(1)} color="text-slate-900 dark:text-white" />
      </div>

      {/* Summary bar */}
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
        <div
          className="bg-green-500 transition-all"
          style={{ width: `${data.resolutionRate * 100}%` }}
          title={`Resolved: ${data.resolved}`}
        />
        <div
          className="bg-amber-500 transition-all"
          style={{ width: `${data.handoffRate * 100}%` }}
          title={`Handed off: ${data.handedOff}`}
        />
        <div
          className="bg-red-500 transition-all"
          style={{ width: `${data.failureRate * 100}%` }}
          title={`Failed: ${data.failed}`}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <CheckCircle className="h-2.5 w-2.5 text-green-500" />
          Resolved ({data.resolved})
        </span>
        <span className="flex items-center gap-1">
          <ArrowRightLeft className="h-2.5 w-2.5 text-amber-500" />
          Handoff ({data.handedOff})
        </span>
        <span className="flex items-center gap-1">
          <XCircle className="h-2.5 w-2.5 text-red-500" />
          Failed ({data.failed})
        </span>
      </div>
    </div>
  );
}
