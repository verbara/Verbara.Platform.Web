import { useQuery } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';

/** A channel a conversation can be started on: registered, and active for the tenant. */
export type AvailableChannel = components['schemas']['AvailableChannelDto'];

/** The channels the `+` dialog offers. Its own key: `['channels', id]` is the admin's concern. */
export function useAvailableChannels(enabled: boolean) {
  return useQuery({
    queryKey: ['available-channels'],
    queryFn: () =>
      customFetch<AvailableChannel[]>({ url: '/api/v1/channels/available', method: 'GET' }),
    enabled,
  });
}
