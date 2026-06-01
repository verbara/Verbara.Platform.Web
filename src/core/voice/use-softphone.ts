import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAgentMe } from '@/core/api/hooks/use-agents';
import { getConfig } from '@/core/hooks/use-config';
import { useVoiceCallStore } from '@/agent/stores/voice-call-store';
import {
  startSoftphone,
  stopSoftphone,
  autoAnswerCall,
  isAutoAnswerEffective,
} from './softphone-manager';

/**
 * Boots the in-browser SIP.js softphone for the logged-in agent and tears it
 * down on unmount. Mounted from the always-present agent shell (agent-layout)
 * so the softphone survives navigation between conversations.
 *
 * Only starts when the deployment exposes an Asterisk WSS URL AND the agent has
 * voice capacity + SIP credentials — digital-only agents and dev/no-voice
 * deployments are a no-op.
 */
export function useSoftphone(): void {
  const { t } = useTranslation('agent');
  const { data: agent } = useAgentMe();
  const agentId = agent?.agentId;
  const tenantId = agent?.tenantId;
  const extension = agent?.extension;
  const sipPassword = agent?.sipPassword;
  const displayName = agent?.displayName ?? '';
  const maxVoice = agent?.capacity?.maxVoice ?? 0;
  const autoAnswerFlag = agent?.autoAnswer;

  useEffect(() => {
    if (!agentId || !tenantId || !extension || !sipPassword || maxVoice <= 0) return;

    let wssUrl: string;
    try {
      wssUrl = getConfig().asteriskWssUrl ?? '';
    } catch {
      wssUrl = '';
    }
    if (!wssUrl) return;

    void startSoftphone({ wssUrl, tenantId, agentId, extension, sipPassword, displayName });
    return () => {
      void stopSoftphone();
    };
  }, [agentId, tenantId, extension, sipPassword, displayName, maxVoice]);

  // Auto-answer (3B.2b): effective = agent override ?? the call's queue default. The agent-`true`
  // override fires immediately on ring; the inherit case fires once the screen-pop delivers the queue
  // default (the effect re-runs when queueAutoAnswerDefault updates). One-shot per call via the store
  // `autoAnswered` guard (re-armed on `incoming`). The actual answer is gated on a secure context +
  // a granted mic inside autoAnswerCall — never auto-answer into a permission prompt.
  const phase = useVoiceCallStore((s) => s.phase);
  const queueAutoAnswerDefault = useVoiceCallStore((s) => s.queueAutoAnswerDefault);
  const autoAnswered = useVoiceCallStore((s) => s.autoAnswered);

  useEffect(() => {
    if (phase !== 'ringing' || autoAnswered) return;
    if (!isAutoAnswerEffective(autoAnswerFlag, queueAutoAnswerDefault)) return;

    useVoiceCallStore.getState().markAutoAnswered();
    void autoAnswerCall().then((result) => {
      if (result === 'mic-not-granted' || result === 'insecure-context') {
        toast.info(t('voice.auto_answer_skipped'));
      }
    });
  }, [phase, autoAnswered, autoAnswerFlag, queueAutoAnswerDefault, t]);
}
