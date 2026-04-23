import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

// --- Types ---

export type AgentAssistProvider = 'deepgram' | 'whisper' | 'azure-whisper' | 'google';

/**
 * Read projection of the AgentAssist runtime feature toggle.
 * Credentials are always masked server-side (`"***"` or omitted); the client
 * never sees the ciphertext or plaintext after an initial save.
 */
export interface AgentAssistFeature {
  enabled: boolean;
  provider: AgentAssistProvider | null;
  credentialsConfigured: boolean;
  apiKeyMasked: string | null;
  endpointMasked: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface AgentAssistCredentialsInput {
  apiKey?: string;
  endpoint?: string;
}

export interface AgentAssistFeatureUpdate {
  enabled: boolean;
  provider: AgentAssistProvider | null;
  credentials: AgentAssistCredentialsInput | null;
}

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
  return useMutation({
    mutationFn: (body: AgentAssistFeatureUpdate) =>
      customFetch<AgentAssistFeature>({
        url: '/api/v1/admin/features/agent-assist',
        method: 'PUT',
        data: body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-assist-feature'] });
      toast.success('Agent Assist feature updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update Agent Assist'),
  });
}
