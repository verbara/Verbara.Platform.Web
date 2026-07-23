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
 * Platform/ADR-0035). Every numeric field is generated as the AOT-safe `number | string`
 * wire union; the store's {@link QueueMetrics} domain type and its consumers
 * (`queue-metrics-store.computeGlobals`, `queue-card.tsx`) do arithmetic on them, so they
 * are coerced to `number` at the fetch boundary here (mirrors the `use-teams` CSAT precedent).
 * Genuine `number | string` coercion site — reported to the shared tally in
 * `openapi-typed-client-admin` (6 fields: waiting, avgWaitSeconds, slaPercent,
 * agentsAvailable, agentsBusy, agentsAway).
 */
function toQueueMetrics(dto: components['schemas']['QueueMetricsDto']): QueueMetrics {
  return {
    queueId: dto.queueId,
    queueName: dto.queueName,
    waiting: dto.waiting == null ? null : Number(dto.waiting),
    avgWaitSeconds: dto.avgWaitSeconds == null ? null : Number(dto.avgWaitSeconds),
    slaPercent: Number(dto.slaPercent),
    agentsAvailable: Number(dto.agentsAvailable),
    agentsBusy: Number(dto.agentsBusy),
    agentsAway: Number(dto.agentsAway),
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
