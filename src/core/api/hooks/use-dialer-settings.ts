import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

export interface DialerSettings {
  maxGlobalChannels: number;
  defaultRingTimeoutSeconds: number;
  campaignPollIntervalSeconds: number;
  maxConcurrentCampaigns: number;
  blendModeEnabled: boolean;
  jitterMinMs: number;
  jitterMaxMs: number;
  ahtCacheDurationSeconds: number;
  scheduledCallbackPollSeconds: number;
}

export function useDialerSettings() {
  return useQuery({
    queryKey: ['dialer-settings'],
    queryFn: () =>
      customFetch<DialerSettings>({ url: '/api/v1/admin/dialer/settings', method: 'GET' }),
  });
}

export function useUpdateDialerSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<DialerSettings>) =>
      customFetch<DialerSettings>({
        url: '/api/v1/admin/dialer/settings',
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dialer-settings'] });
      toast.success('Dialer settings updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
