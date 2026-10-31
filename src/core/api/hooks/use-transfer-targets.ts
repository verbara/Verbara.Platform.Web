import { useQuery } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';

/** What the transfer dialogs list. The admin `QueueDto` and agent rows stay on the admin routes. */
export type TransferTargetQueue = components['schemas']['TransferTargetQueueDto'];
export type TransferTargetAgent = components['schemas']['TransferTargetAgentDto'];

/** The first page, large enough to pick from; a longer list is reached by `search`. */
function targetParams(term: string): Record<string, string> {
  const search = term.trim();
  const page = { page: '1', pageSize: '100' };
  return search === '' ? page : { search, ...page };
}

/** The queues the actor may transfer to, active ones matching `term`, ordered by the server. */
export function useTransferTargetQueues(term: string, enabled: boolean) {
  return useQuery({
    queryKey: ['transfer-targets', 'queues', term],
    queryFn: async () => {
      const result = await customFetch<
        components['schemas']['PagedResultOfTransferTargetQueueDto']
      >({
        url: '/api/v1/transfer-targets/queues',
        method: 'GET',
        params: targetParams(term),
      });
      return result.items;
    },
    enabled,
  });
}

/** The agents the actor may transfer to, without the actor, matching `term`. */
export function useTransferTargetAgents(term: string, enabled: boolean) {
  return useQuery({
    queryKey: ['transfer-targets', 'agents', term],
    queryFn: async () => {
      const result = await customFetch<
        components['schemas']['PagedResultOfTransferTargetAgentDto']
      >({
        url: '/api/v1/transfer-targets/agents',
        method: 'GET',
        params: targetParams(term),
      });
      return result.items;
    },
    enabled,
  });
}
