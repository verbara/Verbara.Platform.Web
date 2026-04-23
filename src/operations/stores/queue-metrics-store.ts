import { create } from 'zustand';

export interface QueueMetrics {
  queueId: string;
  queueName: string;
  /**
   * Calls currently waiting in the queue. `null` when the Pro.Analytics.Live
   * provider is unavailable (unregistered) or has no snapshot for this queue
   * yet (R5.1 Task H). UI renders an em-dash placeholder with a "Metrics
   * unavailable" tooltip when null.
   */
  waiting: number | null;
  /**
   * Average wait time (seconds) for the current interval. `null` under the
   * same conditions as {@link waiting} above.
   */
  avgWaitSeconds: number | null;
  slaPercent: number;
  agentsAvailable: number;
  agentsBusy: number;
  agentsAway: number;
}

interface QueueMetricsState {
  queues: QueueMetrics[];
  totalActive: number;
  totalAgents: number;
  globalSla: number;
  setQueues: (queues: QueueMetrics[]) => void;
  updateQueue: (queueId: string, metrics: Partial<QueueMetrics>) => void;
}

function computeGlobals(queues: QueueMetrics[]) {
  const totalActive = queues.reduce((sum, q) => sum + (q.waiting ?? 0), 0);
  const totalAgents = queues.reduce(
    (sum, q) => sum + q.agentsAvailable + q.agentsBusy + q.agentsAway,
    0,
  );
  const globalSla =
    queues.length > 0
      ? Math.round(queues.reduce((sum, q) => sum + q.slaPercent, 0) / queues.length)
      : 0;
  return { totalActive, totalAgents, globalSla };
}

export const useQueueMetricsStore = create<QueueMetricsState>()((set) => ({
  queues: [],
  totalActive: 0,
  totalAgents: 0,
  globalSla: 0,

  setQueues: (queues) => set({ queues, ...computeGlobals(queues) }),

  updateQueue: (queueId, metrics) =>
    set((state) => {
      const queues = state.queues.map((q) =>
        q.queueId === queueId ? { ...q, ...metrics } : q,
      );
      return { queues, ...computeGlobals(queues) };
    }),
}));
