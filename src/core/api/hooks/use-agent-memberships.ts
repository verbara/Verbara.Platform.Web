import { useQuery } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';

/**
 * ADR-0026 Phase A.6 — agent-centric queue membership projection.
 *
 * Server response is the named `AgentQueueMembershipDto` schema
 * (openapi-response-adoption, Platform/ADR-0035), returned by
 * `/admin/agents/{agentId}/queue-memberships` to render the membership editor
 * without an N+1 fetch loop across every queue.
 *
 * Note the generated shape widens `source` to `string` (was the client-only
 * `'Manual' | 'Skill'`) and types `penalty` as the AOT-wire `number | string`
 * union; the sole numeric consumer (`agent-queues.tsx`) coerces at its `useState`
 * boundary.
 */
export type AgentQueueMembership = components['schemas']['AgentQueueMembershipDto'];

export function useAgentMemberships(agentId: string | undefined) {
  return useQuery({
    queryKey: ['agent-memberships', agentId],
    queryFn: () =>
      customFetch<components['schemas']['AgentQueueMembershipDto'][]>({
        url: `/api/v1/admin/agents/${agentId}/queue-memberships`,
        method: 'GET',
      }),
    enabled: !!agentId,
  });
}
