import { useQuery } from '@tanstack/react-query';
import { customFetchWithHeaders } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';

/**
 * One queue's live metrics, the domain shape {@link useQueueMetrics} returns. It lives here,
 * not in the wallboard's store, so `src/core` does not depend on `src/operations`.
 */
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
 * spurious AOT `string` arm at the source), so the {@link QueueMetrics} domain type and its
 * consumers (the wallboard store's `computeGlobals`, `queue-card.tsx`) read them
 * directly — no boundary coercion. This mapper only projects the DTO onto that shape.
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
