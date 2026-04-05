import { useMemo, useEffect } from 'react';
import { useQueueMetricsStore } from '@/operations/stores/queue-metrics-store';
import { useQueueMetrics } from '@/core/api/hooks/use-queue-metrics';
import { useAllLiveStates } from '@/core/api/hooks/use-analytics';
import { GlobalKpis } from '@/operations/wallboard/global-kpis';
import { QueueCard } from '@/operations/wallboard/queue-card';
import { KioskWrapper } from '@/operations/wallboard/kiosk-wrapper';

export default function WallboardPage() {
  const { queues, totalActive, totalAgents, globalSla, setQueues } = useQueueMetricsStore();
  const { data: apiMetrics } = useQueueMetrics();
  const { data: liveStates = [] } = useAllLiveStates();

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
    <div className="space-y-6" data-testid="wallboard-page">
      <GlobalKpis totalActive={totalActive} totalAgents={totalAgents} globalSla={globalSla} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="wallboard-queue-cards">
        {sortedQueues.map((q) => (
          <QueueCard key={q.queueId} queue={q} />
        ))}
      </div>

      {liveStates.length > 0 && (
        <div className="space-y-3" data-testid="wallboard-live-states">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Live Queue States
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {liveStates.map((state) => (
              <div key={state.queueName} className="rounded-lg border bg-card p-4">
                <p className="text-sm font-semibold truncate">{state.queueName}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Waiting</span>
                    <p className={`text-lg font-bold ${state.callsWaiting > 5 ? 'text-red-500' : 'text-foreground'}`}>
                      {state.callsWaiting}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Longest Wait</span>
                    <p className="text-lg font-bold">
                      {Math.round(state.longestWaitMs / 1000)}s
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-muted-foreground">Available: {state.agentsAvailable}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    <span className="text-muted-foreground">On Call: {state.agentsOnCall}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    <span className="text-muted-foreground">Paused: {state.agentsPaused}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-purple-500" />
                    <span className="text-muted-foreground">Wrap-Up: {state.agentsInWrapUp}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return <KioskWrapper>{content}</KioskWrapper>;
}
