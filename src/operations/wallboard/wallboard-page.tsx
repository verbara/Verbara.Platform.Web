import { useMemo, useEffect } from 'react';
import { useQueueMetricsStore } from '@/operations/stores/queue-metrics-store';
import { useQueueMetrics } from '@/core/api/hooks/use-queue-metrics';
import { GlobalKpis } from '@/operations/wallboard/global-kpis';
import { QueueCard } from '@/operations/wallboard/queue-card';
import { KioskWrapper } from '@/operations/wallboard/kiosk-wrapper';

export default function WallboardPage() {
  const { queues, totalActive, totalAgents, globalSla, setQueues } = useQueueMetricsStore();
  const { data: apiMetrics } = useQueueMetrics();

  useEffect(() => {
    if (apiMetrics) {
      setQueues(apiMetrics);
    }
  }, [apiMetrics, setQueues]);

  const sortedQueues = useMemo(() => {
    return [...queues].sort((a, b) => {
      // Breached first (SLA < 60), then by waiting count descending
      const aBreach = a.slaPercent < 60 ? 0 : 1;
      const bBreach = b.slaPercent < 60 ? 0 : 1;
      if (aBreach !== bBreach) return aBreach - bBreach;
      return b.waiting - a.waiting;
    });
  }, [queues]);

  const content = (
    <div className="space-y-6">
      <GlobalKpis totalActive={totalActive} totalAgents={totalAgents} globalSla={globalSla} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sortedQueues.map((q) => (
          <QueueCard key={q.queueId} queue={q} />
        ))}
      </div>
    </div>
  );

  return <KioskWrapper>{content}</KioskWrapper>;
}
