import { useQuery, useMutation } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

export interface ActiveSession {
  sessionId: string;
  agentId: string;
  agentName: string;
  queueName: string;
  callerIdNum: string;
  connectedAt: string;
  sentiment?: string | null;
}

export function useActiveSessions() {
  return useQuery({
    queryKey: ['supervisor', 'sessions', 'active'],
    queryFn: () =>
      customFetch<ActiveSession[]>({ url: '/api/supervisor/sessions/active', method: 'GET' }),
    refetchInterval: 10_000,
  });
}

export function useSendWhisper() {
  return useMutation({
    mutationFn: ({ sessionId, message }: { sessionId: string; message: string }) =>
      customFetch<void>({
        url: `/api/supervisor/sessions/${sessionId}/whisper`,
        method: 'POST',
        data: { message },
      }),
    onSuccess: () => toast.success('Whisper sent'),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useStartListening() {
  return useMutation({
    mutationFn: (sessionId: string) =>
      customFetch<void>({
        url: `/api/supervisor/sessions/${sessionId}/listen`,
        method: 'POST',
      }),
    onError: (err: Error) => toast.error(err.message),
  });
}
