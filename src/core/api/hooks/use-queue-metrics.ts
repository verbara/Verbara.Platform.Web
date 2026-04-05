import { useQuery } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import type { QueueMetrics } from '@/operations/stores/queue-metrics-store';

export function useQueueMetrics() {
  return useQuery({
    queryKey: ['queue-metrics'],
    queryFn: () =>
      customFetch<QueueMetrics[]>({ url: '/api/v1/operations/queue-metrics', method: 'GET' }),
    refetchInterval: 30_000,
  });
}
