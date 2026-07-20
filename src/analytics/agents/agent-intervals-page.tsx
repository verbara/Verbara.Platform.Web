import { useTranslation } from 'react-i18next';
import { useAgentIntervals } from '@/core/api/hooks/use-analytics';
import { useAnalyticsFilterStore } from '@/core/stores/analytics-filter-store';
import { PageHeader } from '@/core/ui/page-header';
import { useFormatDate } from '@/core/i18n/use-format';

function IntervalTable({ intervals }: { readonly intervals: ReturnType<typeof useAgentIntervals>['data'] & object[] }) {
  const { t } = useTranslation('analytics');
  const { formatDateTime } = useFormatDate();
  if (intervals.length === 0) {
    return (
      <div data-testid="agent-intervals-table" className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">{t('agent_intervals.empty')}</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border" data-testid="agent-intervals-table">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left font-medium">{t('agent_intervals.col_agent')}</th>
            <th className="px-4 py-2 text-left font-medium">{t('agent_intervals.col_interval')}</th>
            <th className="px-4 py-2 text-right font-medium">{t('agent_intervals.col_handled')}</th>
            <th className="px-4 py-2 text-right font-medium">{t('agent_intervals.col_aht')}</th>
            <th className="px-4 py-2 text-right font-medium">{t('agent_intervals.col_occupancy')}</th>
            <th className="px-4 py-2 text-right font-medium">{t('agent_intervals.col_rna')}</th>
            <th className="px-4 py-2 text-right font-medium">{t('agent_intervals.col_transfers')}</th>
          </tr>
        </thead>
        <tbody>
          {intervals.map((row) => (
            <tr key={`${row.agentId}-${row.intervalStart}`} className="border-b last:border-0">
              <td className="px-4 py-2">{row.agentId}</td>
              <td className="px-4 py-2">{formatDateTime(row.intervalStart)}</td>
              <td className="px-4 py-2 text-right">{row.callsHandled}</td>
              <td className="px-4 py-2 text-right">{(row.ahtMs / 1000).toFixed(0)}s</td>
              <td className="px-4 py-2 text-right">{row.occupancyPercent.toFixed(1)}%</td>
              <td className="px-4 py-2 text-right">{row.rnaCount}</td>
              <td className="px-4 py-2 text-right">{row.transfers}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AgentIntervalsPage() {
  const { t } = useTranslation('analytics');
  const { from, to } = useAnalyticsFilterStore();
  const { data: intervals = [], isLoading } = useAgentIntervals({ from, to });

  return (
    <div className="space-y-6" data-testid="agent-intervals-page">
      <PageHeader title={t('agent_intervals.title')} />
      {isLoading
        ? <p className="text-sm text-muted-foreground">{t('intervals.loading')}</p>
        : <IntervalTable intervals={intervals} />
      }
    </div>
  );
}
