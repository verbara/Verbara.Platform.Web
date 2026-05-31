import { Web } from 'sip.js';
import { useVoiceCallStore } from '@/agent/stores/voice-call-store';

/**
 * Everything the in-browser softphone needs to REGISTER to Asterisk as the
 * logged-in agent. The SIP identity mirrors the realtime endpoint provisioned
 * by the SDK (Verbara.Sdk.Pro.Realtime): the From/AOR user is the endpoint id
 * `{tenantId}-agent-{agentId}`, while the digest auth username is the
 * tenant-prefixed extension `{tenantId}-{extension}`.
 */
export interface SoftphoneConfig {
  wssUrl: string;
  tenantId: string;
  agentId: string;
  extension: string;
  sipPassword: string;
  displayName: string;
}

// Module-level singleton — Phase 3A handles a single concurrent call (mirrors
// SIP.js SimpleUser's own single-session limitation) and one softphone per tab.
let simpleUser: Web.SimpleUser | null = null;
let audioEl: HTMLAudioElement | null = null;

export function isSoftphoneRunning(): boolean {
  return simpleUser !== null;
}

function deriveDomain(wssUrl: string): string {
  try {
    return new URL(wssUrl).hostname;
  } catch {
    return 'localhost';
  }
}

/**
 * Connect + REGISTER the softphone. No-op when already running or when the
 * agent lacks SIP credentials (the boot hook also gates on voice capacity).
 * Failures surface via the voice-call-store error field; the softphone is torn
 * down so a later attempt can retry cleanly.
 */
export async function startSoftphone(config: SoftphoneConfig): Promise<void> {
  if (simpleUser) return;
  if (
    !config.wssUrl ||
    !config.tenantId ||
    !config.agentId ||
    !config.extension ||
    !config.sipPassword
  ) {
    return;
  }

  const domain = deriveDomain(config.wssUrl);
  const aor = `sip:${config.tenantId}-agent-${config.agentId}@${domain}`;

  // SimpleUser attaches the remote MediaStream to this element once a call is
  // answered. Hidden + autoplay so the agent simply hears the caller.
  audioEl = document.createElement('audio');
  audioEl.autoplay = true;
  audioEl.hidden = true;
  audioEl.setAttribute('data-testid', 'softphone-remote-audio');
  document.body.appendChild(audioEl);

  const su = new Web.SimpleUser(config.wssUrl, {
    aor,
    media: {
      constraints: { audio: true, video: false },
      remote: { audio: audioEl },
    },
    userAgentOptions: {
      displayName: config.displayName,
      authorizationUsername: `${config.tenantId}-${config.extension}`,
      authorizationPassword: config.sipPassword,
    },
  });

  su.delegate = {
    onServerConnect: () => useVoiceCallStore.getState().setRegistration('connecting'),
    onServerDisconnect: () => useVoiceCallStore.getState().setRegistration('disconnected'),
    onRegistered: () => useVoiceCallStore.getState().setRegistration('registered'),
    onUnregistered: () => useVoiceCallStore.getState().setRegistration('disconnected'),
    // 3A: caller identity is not exposed by SimpleUser; the call card shows a
    // generic "incoming call". 3B populates callerId from the Conversation.
    onCallReceived: () => useVoiceCallStore.getState().incoming('', ''),
    onCallAnswered: () => useVoiceCallStore.getState().answered(),
    onCallHangup: () => useVoiceCallStore.getState().ended(),
  };

  simpleUser = su;
  useVoiceCallStore.getState().setRegistration('connecting');

  try {
    await su.connect();
    await su.register();
  } catch (err) {
    useVoiceCallStore
      .getState()
      .setError(err instanceof Error ? err.message : 'Softphone failed to connect');
    await stopSoftphone();
  }
}

export async function answerCall(): Promise<void> {
  if (!simpleUser) return;
  await simpleUser.answer({
    sessionDescriptionHandlerOptions: { constraints: { audio: true, video: false } },
  });
}

export async function rejectCall(): Promise<void> {
  if (!simpleUser) return;
  await simpleUser.decline();
}

export async function hangupCall(): Promise<void> {
  if (!simpleUser) return;
  await simpleUser.hangup();
}

export async function stopSoftphone(): Promise<void> {
  const su = simpleUser;
  simpleUser = null;
  if (su) {
    try {
      await su.unregister();
    } catch {
      /* best-effort */
    }
    try {
      await su.disconnect();
    } catch {
      /* best-effort */
    }
  }
  if (audioEl) {
    audioEl.remove();
    audioEl = null;
  }
  useVoiceCallStore.getState().reset();
  useVoiceCallStore.getState().setRegistration('offline');
}
