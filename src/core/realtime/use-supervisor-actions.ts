import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { invokeHub } from './platform-hub';

export type SupervisionMode = 'Listen' | 'Whisper' | 'Barge';

/**
 * Hub-backed supervisor actions for a specific conversation. Replaces the legacy
 * REST-based `useSendWhisper` mutation with a SignalR-invoked pipeline so
 * whispers, start, and stop supervision are delivered in-band with the presence
 * hub. Errors are surfaced through `sonner` toasts so callers don't have to wire
 * per-action error handlers.
 *
 * A failure always shows the action's translated message, never the error's own
 * text: that text is English (a `HubNotConnectedError` when the hub is down — a
 * call never starts the hub — or a server `HubException`), and would reach
 * ES-419 and PT-BR users untranslated.
 */
export function useSupervisorActions(conversationId: string | undefined) {
  const { t } = useTranslation('common');

  const startSupervision = useCallback(
    async (mode: SupervisionMode) => {
      if (!conversationId) return;
      try {
        await invokeHub('StartSupervisionAsync', conversationId, mode);
      } catch {
        toast.error(t('toasts.supervisor.startSupervisionFailed'));
      }
    },
    [conversationId, t],
  );

  const whisper = useCallback(
    async (text: string) => {
      if (!conversationId) return;
      const payload = text.trim();
      if (!payload) return;
      try {
        await invokeHub('WhisperToAgentAsync', conversationId, payload);
        toast.success(t('toasts.supervisor.whisperSent'));
      } catch {
        toast.error(t('toasts.supervisor.whisperFailed'));
      }
    },
    [conversationId, t],
  );

  const stopSupervision = useCallback(async () => {
    if (!conversationId) return;
    try {
      await invokeHub('StopSupervisingAsync', conversationId);
    } catch {
      toast.error(t('toasts.supervisor.stopSupervisionFailed'));
    }
  }, [conversationId, t]);

  return { startSupervision, whisper, stopSupervision };
}
