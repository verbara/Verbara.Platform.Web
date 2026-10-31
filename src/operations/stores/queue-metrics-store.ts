import { create } from 'zustand';
import type { QueueMetrics } from '@/core/api/hooks/use-queue-metrics';

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
      const queues = state.queues.map((q) => (q.queueId === queueId ? { ...q, ...metrics } : q));
      return { queues, ...computeGlobals(queues) };
    }),
}));
