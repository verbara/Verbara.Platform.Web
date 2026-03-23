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
}

const mockQueues: QueueMetrics[] = [
  {
    queueId: 'q-1',
    queueName: 'Soporte General',
    waiting: 12,
    avgWaitSeconds: 45,
    slaPercent: 72,
    agentsAvailable: 4,
    agentsBusy: 8,
    agentsAway: 2,
  },
  {
    queueId: 'q-2',
    queueName: 'Ventas',
    waiting: 3,
    avgWaitSeconds: 18,
    slaPercent: 91,
    agentsAvailable: 6,
    agentsBusy: 4,
    agentsAway: 1,
  },
  {
    queueId: 'q-3',
    queueName: 'Facturacion',
    waiting: 8,
    avgWaitSeconds: 62,
    slaPercent: 55,
    agentsAvailable: 2,
    agentsBusy: 5,
    agentsAway: 3,
  },
  {
    queueId: 'q-4',
    queueName: 'Soporte Tecnico',
    waiting: 1,
    avgWaitSeconds: 10,
    slaPercent: 96,
    agentsAvailable: 5,
    agentsBusy: 3,
    agentsAway: 0,
  },
  {
    queueId: 'q-5',
    queueName: 'Retencion',
    waiting: 5,
    avgWaitSeconds: 35,
    slaPercent: 78,
    agentsAvailable: 3,
    agentsBusy: 6,
    agentsAway: 1,
  },
  {
    queueId: 'q-6',
    queueName: 'WhatsApp',
    waiting: 15,
    avgWaitSeconds: 90,
    slaPercent: 42,
    agentsAvailable: 1,
    agentsBusy: 7,
    agentsAway: 2,
  },
];

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

export const useQueueMetricsStore = create<QueueMetricsState>()(() => ({
  queues: mockQueues,
  ...computeGlobals(mockQueues),
}));
