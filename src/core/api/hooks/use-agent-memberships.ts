import { useQuery } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';

/**
 * ADR-0026 Phase A.6 — agent-centric queue membership projection.
 *
 * Mirrors `AgentQueueMembershipDto` from `AdminEndpoints.cs`. Used by
 * `/admin/agents/{agentId}/queues` to render the membership editor without
 * an N+1 fetch loop across every queue.
 */
export interface AgentQueueMembership {
  queueId: string;
  queueName: string;
  penalty: number;
  isExcluded: boolean;
  /**
   * `null` = member for all channels the queue accepts (pre-v2.6.0 implicit
   * behavior). A populated list restricts membership to the listed channels
   * only and gates Asterisk sync (voice in list ⇒ sync; voice out ⇒ no sync).
   */
  allowedChannels?: string[] | null;
  source: 'Manual' | 'Skill';
}

export function useAgentMemberships(agentId: string | undefined) {
  return useQuery({
    queryKey: ['agent-memberships', agentId],
    queryFn: () =>
      customFetch<AgentQueueMembership[]>({
        url: `/api/v1/admin/agents/${agentId}/queue-memberships`,
        method: 'GET',
      }),
    enabled: !!agentId,
  });
}
