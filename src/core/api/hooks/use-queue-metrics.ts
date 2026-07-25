import { useQuery } from '@tanstack/react-query';
import { customFetchWithHeaders } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';
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

/**
 * Server response is the named `QueueMetricsDto[]` schema (openapi-response-adoption,
 * Platform/ADR-0035). The numeric fields are now single-typed (`number` / `null | number`)
 * on the regenerated document (openapi-numeric-schema-truth, Platform/ADR-0036 strips the
 * spurious AOT `string` arm at the source), so the store's {@link QueueMetrics} domain type
 * and its consumers (`queue-metrics-store.computeGlobals`, `queue-card.tsx`) read them
 * directly — no boundary coercion. This mapper only projects the DTO onto the store shape.
 */
function toQueueMetrics(dto: components['schemas']['QueueMetricsDto']): QueueMetrics {
  return {
    queueId: dto.queueId,
    queueName: dto.queueName,
    waiting: dto.waiting,
    avgWaitSeconds: dto.avgWaitSeconds,
    slaPercent: dto.slaPercent,
    agentsAvailable: dto.agentsAvailable,
    agentsBusy: dto.agentsBusy,
    agentsAway: dto.agentsAway,
  };
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
      const { data, headers } = await customFetchWithHeaders<
        components['schemas']['QueueMetricsDto'][]
      >({
        url: '/api/v1/operations/queue-metrics',
        method: 'GET',
      });
      return {
        metrics: data.map(toQueueMetrics),
        isMetricsAvailable: parseMetricsAvailable(headers),
      };
    },
    refetchInterval: 30_000,
  });
}
