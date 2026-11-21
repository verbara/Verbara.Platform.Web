import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// --- Types ---

/**
 * Every provider a stored row can name. GET still returns a row stored with a provider that is
 * not live (`agent-assist-feature.v2.json` `refusedProviders`), so the read type keeps all four.
 */
export type AgentAssistProvider = 'deepgram' | 'whisper' | 'azure-whisper' | 'google';

/**
 * The providers Platform accepts with `enabled` true (`liveProviders`, today `deepgram` alone).
 * The selector and the PUT body take this type, so a refused provider cannot be sent.
 */
export type LiveAgentAssistProvider = 'deepgram';

export const LIVE_AGENT_ASSIST_PROVIDERS: readonly LiveAgentAssistProvider[] = ['deepgram'];

export function isLiveAgentAssistProvider(
  provider: AgentAssistProvider | null | undefined,
): provider is LiveAgentAssistProvider {
  return LIVE_AGENT_ASSIST_PROVIDERS.includes(provider as LiveAgentAssistProvider);
}

/**
 * Read projection of the AgentAssist runtime feature toggle.
 * Credentials are always masked server-side (`"***"` or omitted); the client
 * never sees the ciphertext or plaintext after an initial save. Platform leaves a null member
 * absent (`_omittedWhileNull`), so those members are optional here.
 */
export interface AgentAssistFeature {
  enabled: boolean;
  provider?: AgentAssistProvider | null;
  credentialsConfigured: boolean;
  apiKeyMasked?: string | null;
  endpointMasked?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export interface AgentAssistCredentialsInput {
  apiKey?: string;
  endpoint?: string;
}

export type AgentAssistFeatureUpdate =
  | {
      enabled: true;
      provider: LiveAgentAssistProvider;
      credentials: AgentAssistCredentialsInput;
    }
  | { enabled: false; provider: null; credentials: null };

// --- Hooks ---

export function useAgentAssistFeature() {
  return useQuery({
    queryKey: ['agent-assist-feature'],
    queryFn: () =>
      customFetch<AgentAssistFeature>({
        url: '/api/v1/admin/features/agent-assist',
        method: 'GET',
      }),
  });
}

export function useUpdateAgentAssistFeature() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (body: AgentAssistFeatureUpdate) =>
      customFetch<AgentAssistFeature>({
        url: '/api/v1/admin/features/agent-assist',
        method: 'PUT',
        data: body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-assist-feature'] });
      toast.success(t('toasts.agentAssist.featureUpdated'));
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update Agent Assist'),
  });
}
