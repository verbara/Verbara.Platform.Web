import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { invokeHub } from './platform-hub';

/**
 * Hub-backed supervisor actions for a specific conversation: the text whisper only. A silent listen
 * is not a hub action (`supervisor-silent-listen`, design D7): it starts and stops through the REST
 * routes, so the hub's supervision start and stop methods are never invoked from the console.
 *
 * A failure always shows the action's translated message, never the error's own text: that text is
 * English (a `HubNotConnectedError` when the hub is down — a call never starts the hub — or a server
 * `HubException`), and would reach ES-419 and PT-BR users untranslated.
 */
export function useSupervisorActions(conversationId: string | undefined) {
  const { t } = useTranslation('common');

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

  return { whisper };
}
