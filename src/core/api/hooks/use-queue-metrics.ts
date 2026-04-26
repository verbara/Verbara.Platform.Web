import { useQuery } from '@tanstack/react-query';
import { customFetchWithHeaders } from '@/core/api/client';
import type { QueueMetrics } from '@/operations/stores/queue-metrics-store';

/**
 * Shape returned by {@link useQueueMetrics}. `isMetricsAvailable` mirrors the
 * backend `X-Metrics-Available` response header (R5.1 Pro.Analytics.Live):
 * `false` when the live snapshot writer is not running OR Postgres is
 * unreachable, `true` (default) when the header is absent or `"true"`.
 *
 * Surfaced wallboard-side via {@link MetricsAvailabilityBanner} (R5.2 PC.2 / B.2).
 */
export interface QueueMetricsResult {
  readonly metrics: readonly QueueMetrics[];
  readonly isMetricsAvailable: boolean;
}

const METRICS_AVAILABLE_HEADER = 'X-Metrics-Available';

function parseMetricsAvailable(headers: Headers): boolean {
  const raw = headers.get(METRICS_AVAILABLE_HEADER);
  // Default-true when header is absent (back-compat with backends that don't
  // emit it yet) and only `"false"` (case-insensitive) flips the banner on.
  if (raw === null) return true;
  return raw.trim().toLowerCase() !== 'false';
}

export function useQueueMetrics() {
  return useQuery<QueueMetricsResult>({
    queryKey: ['queue-metrics'],
    queryFn: async () => {
      const { data, headers } = await customFetchWithHeaders<QueueMetrics[]>({
        url: '/api/v1/operations/queue-metrics',
        method: 'GET',
      });
      return {
        metrics: data,
        isMetricsAvailable: parseMetricsAvailable(headers),
      };
    },
    refetchInterval: 30_000,
  });
}
