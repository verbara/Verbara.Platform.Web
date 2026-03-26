import { Activity } from 'lucide-react';
import { useCurrentInterval } from '@/core/api/hooks/use-analytics';

export function CurrentIntervalCard() {
  const { data: interval } = useCurrentInterval();
  if (!interval) return null;

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Current Interval</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><p className="text-muted-foreground">Offered</p><p className="text-lg font-bold">{interval.callsOffered}</p></div>
        <div><p className="text-muted-foreground">Answered</p><p className="text-lg font-bold">{interval.callsAnswered}</p></div>
        <div><p className="text-muted-foreground">SLA</p><p className="text-lg font-bold">{interval.slaPercent.toFixed(1)}%</p></div>
        <div><p className="text-muted-foreground">AHT</p><p className="text-lg font-bold">{(interval.ahtMs / 1000).toFixed(0)}s</p></div>
      </div>
    </div>
  );
}
