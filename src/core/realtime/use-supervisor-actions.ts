import { useCallback } from 'react';
import { toast } from 'sonner';
import { invokeHub } from './platform-hub';

export type SupervisionMode = 'Listen' | 'Whisper' | 'Barge';

/**
 * Hub-backed supervisor actions for a specific conversation. Replaces the legacy
 * REST-based `useSendWhisper` mutation with a SignalR-invoked pipeline so
 * whispers, start, and stop supervision are delivered in-band with the presence
 * hub. Errors are surfaced through `sonner` toasts so callers don't have to wire
 * per-action error handlers.
 */
export function useSupervisorActions(conversationId: string | undefined) {
  const startSupervision = useCallback(
    async (mode: SupervisionMode) => {
      if (!conversationId) return;
      try {
        await invokeHub('StartSupervisionAsync', conversationId, mode);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to start supervision');
      }
    },
    [conversationId],
  );

  const whisper = useCallback(
    async (text: string) => {
      if (!conversationId) return;
      const payload = text.trim();
      if (!payload) return;
      try {
        await invokeHub('WhisperToAgentAsync', conversationId, payload);
        toast.success('Whisper sent');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Whisper failed');
      }
    },
    [conversationId],
  );

  const stopSupervision = useCallback(async () => {
    if (!conversationId) return;
    try {
      await invokeHub('StopSupervisingAsync', conversationId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to stop supervision');
    }
  }, [conversationId]);

  return { startSupervision, whisper, stopSupervision };
}
