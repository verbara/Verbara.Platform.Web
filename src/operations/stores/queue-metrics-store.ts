import { create } from 'zustand';

export interface QueueMetrics {
  queueId: string;
  queueName: string;
  waiting: number;
  avgWaitSeconds: number;
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
}

function computeGlobals(queues: QueueMetrics[]) {
  const totalActive = queues.reduce((sum, q) => sum + q.waiting, 0);
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
}));
