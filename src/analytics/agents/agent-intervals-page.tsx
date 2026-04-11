import { useAgentIntervals } from '@/core/api/hooks/use-analytics';
import { useAnalyticsFilterStore } from '@/core/stores/analytics-filter-store';
import { PageHeader } from '@/admin/shared/page-header';

function IntervalTable({ intervals }: { readonly intervals: ReturnType<typeof useAgentIntervals>['data'] & object[] }) {
  if (intervals.length === 0) {
    return <p className="text-sm text-muted-foreground">No agent interval data for this period.</p>;
  }
  return (
    <div className="rounded-lg border" data-testid="agent-intervals-table">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Agent</th>
            <th className="px-4 py-2 text-left font-medium">Interval</th>
            <th className="px-4 py-2 text-right font-medium">Handled</th>
            <th className="px-4 py-2 text-right font-medium">AHT</th>
            <th className="px-4 py-2 text-right font-medium">Occupancy</th>
            <th className="px-4 py-2 text-right font-medium">RNA</th>
            <th className="px-4 py-2 text-right font-medium">Transfers</th>
          </tr>
        </thead>
        <tbody>
          {intervals.map((row) => (
            <tr key={`${row.agentId}-${row.intervalStart}`} className="border-b last:border-0">
              <td className="px-4 py-2">{row.agentId}</td>
              <td className="px-4 py-2">{new Date(row.intervalStart).toLocaleString()}</td>
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
  const { from, to } = useAnalyticsFilterStore();
  const { data: intervals = [], isLoading } = useAgentIntervals({ from, to });

  return (
    <div className="space-y-6" data-testid="agent-intervals-page">
      <PageHeader title="Agent Intervals" />
      {isLoading
        ? <p className="text-sm text-muted-foreground">Loading...</p>
        : <IntervalTable intervals={intervals} />
      }
    </div>
  );
}
