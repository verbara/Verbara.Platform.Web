import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';
import type { ApiErrorMap } from '@/core/api/api-error';
import { toastApiError } from '@/core/api/toast-api-error';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

/**
 * A tenant's configuration of one channel (Platform 2.28.0). Credentials are reported as
 * `{ key, isSet }` only: the API never returns a credential value, so the console never shows one.
 */
export type ChannelConfig = components['schemas']['ChannelConfigResponse'];
export type ChannelCredentialStatus = components['schemas']['ChannelCredentialStatus'];
/** `POST /admin/channels/{channel}/test`: 200 means the test ran; `success` says whether it passed. */
export type ChannelTestResult = components['schemas']['ChannelTestResponse'];

/**
 * The `credentials` of a PUT. Platform merges them into what is stored: a key left out (or blank)
 * keeps its value, a value replaces it and `null` removes the key.
 */
export type ChannelCredentialUpdate = NonNullable<
  components['schemas']['UpdateChannelConfigRequest']['credentials']
>;

export const CHANNEL_UPDATE_ERRORS: ApiErrorMap = {
  codes: {
    'unknown-credential-key': {
      code: 'unknown-credential-key',
      key: 'admin:channels.errors.unknown_credential_key',
    },
    'invalid-channel': { code: 'invalid-channel', key: 'admin:channels.errors.invalid_channel' },
  },
  fallback: { code: 'channel-update-failed', key: 'admin:channels.errors.update_failed' },
};

export const CHANNEL_TEST_ERRORS: ApiErrorMap = {
  codes: {
    'invalid-channel': { code: 'invalid-channel', key: 'admin:channels.errors.invalid_channel' },
  },
  fallback: { code: 'channel-test-failed', key: 'admin:channels.errors.test_request_failed' },
};

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
      credentials: ChannelCredentialUpdate;
    }) =>
      customFetch<ChannelConfig>({
        url: `/api/v1/admin/channels/${channelId}`,
        method: 'PUT',
        data,
      }),
    onSuccess: (saved, variables) => {
      // The PUT answers the merged configuration, so the badges update without a refetch.
      qc.setQueryData(['channels', variables.channelId], saved);
      toast.success(t('toasts.channels.updated'));
    },
    onError: (err: unknown) => {
      toastApiError(err, CHANNEL_UPDATE_ERRORS, t);
    },
  });
}

export function useTestChannel() {
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (channelId: string) =>
      customFetch<ChannelTestResult>({
        url: `/api/v1/admin/channels/${channelId}/test`,
        method: 'POST',
      }),
    onError: (err: unknown) => {
      toastApiError(err, CHANNEL_TEST_ERRORS, t);
    },
  });
}
