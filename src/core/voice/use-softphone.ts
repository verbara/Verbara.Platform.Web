import { useEffect } from 'react';
import { useAgentMe } from '@/core/api/hooks/use-agents';
import { getConfig } from '@/core/hooks/use-config';
import { startSoftphone, stopSoftphone } from './softphone-manager';

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
  const { data: agent } = useAgentMe();
  const agentId = agent?.agentId;
  const tenantId = agent?.tenantId;
  const extension = agent?.extension;
  const sipPassword = agent?.sipPassword;
  const displayName = agent?.displayName ?? '';
  const maxVoice = agent?.capacity?.maxVoice ?? 0;

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
}
