import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

export interface ChannelConfig {
  channel: string;
  isActive: boolean;
  credentials?: Record<string, string>;
}

export function useChannel(channelId: string | undefined) {
  return useQuery({
    queryKey: ['channels', channelId],
    queryFn: () =>
      customFetch<ChannelConfig>({
        url: `/api/v1/admin/channels/${channelId}`,
        method: 'GET',
      }),
    enabled: !!channelId,
  });
}

export function useUpdateChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      channelId,
      ...data
    }: {
      channelId: string;
      isActive: boolean;
      credentials?: Record<string, string>;
    }) =>
      customFetch<ChannelConfig>({
        url: `/api/v1/admin/channels/${channelId}`,
        method: 'PUT',
        data,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ['channels', variables.channelId],
      });
      toast.success('Channel updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
