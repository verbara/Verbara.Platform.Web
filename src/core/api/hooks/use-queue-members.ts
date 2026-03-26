import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

export function useAddQueueMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { queueId: string; agentId: string }) =>
      customFetch<void>({ url: '/api/admin/queue-members', method: 'POST', data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queues'] });
      qc.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Member added to queue');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveQueueMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ queueId, agentId }: { queueId: string; agentId: string }) =>
      customFetch<void>({ url: `/api/admin/queue-members/${queueId}/${agentId}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queues'] });
      qc.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Member removed from queue');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
