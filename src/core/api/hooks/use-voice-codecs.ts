import { useQuery } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';

export interface VoiceCodecsResponse {
  source: 'asterisk' | 'fallback';
  codecs: string[];
}

/** Server-driven codec catalog. Long staleTime — the installed codec set rarely changes. */
export function useVoiceCodecs() {
  return useQuery({
    queryKey: ['voice-codecs'],
    queryFn: () =>
      customFetch<VoiceCodecsResponse>({ url: '/api/v1/admin/voice/codecs', method: 'GET' }),
    staleTime: 60 * 60 * 1000,
  });
}
