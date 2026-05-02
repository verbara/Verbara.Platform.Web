import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('common');
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
      toast.success(t('toasts.channels.updated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
