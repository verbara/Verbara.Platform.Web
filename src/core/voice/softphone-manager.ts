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

/**
 * Call control (3B.2a) — pure-media operations SimpleUser already exposes. SimpleUser is the source
 * of truth; each wrapper mirrors the resulting state into the voice-call-store for the UI toggles.
 * All no-op when no softphone is running. Hold (SIP re-INVITE) and mute (local track) are
 * independent; do not couple them.
 */
export async function holdCall(): Promise<void> {
  if (!simpleUser) return;
  await simpleUser.hold();
  useVoiceCallStore.getState().setHeld(true);
}

export async function unholdCall(): Promise<void> {
  if (!simpleUser) return;
  await simpleUser.unhold();
  useVoiceCallStore.getState().setHeld(false);
}

export function muteCall(): void {
  if (!simpleUser) return;
  simpleUser.mute();
  useVoiceCallStore.getState().setMuted(true);
}

export function unmuteCall(): void {
  if (!simpleUser) return;
  simpleUser.unmute();
  useVoiceCallStore.getState().setMuted(false);
}

/** Send a single DTMF tone (0-9, *, #) on the active call — drives the dialpad. */
export async function sendDtmf(tone: string): Promise<void> {
  if (!simpleUser) return;
  await simpleUser.sendDTMF(tone);
}

/**
 * The effective auto-answer decision (3B.2b): the agent's own override wins, else the call's queue
 * default. `agentFlag` is tri-state (null/undefined = inherit). Pure + exported for unit testing.
 */
export function isAutoAnswerEffective(
  agentFlag: boolean | null | undefined,
  queueDefault: boolean,
): boolean {
  return (agentFlag ?? queueDefault) === true;
}

/** Outcome of an auto-answer attempt so the caller can surface the right UX (toast on skip). */
export type AutoAnswerResult = 'answered' | 'no-softphone' | 'insecure-context' | 'mic-not-granted';

async function isMicGranted(): Promise<boolean> {
  try {
    if (!navigator.permissions?.query) return false;
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return status.state === 'granted';
  } catch {
    // Browsers that don't support querying the microphone permission: treat as not-granted so we
    // never auto-answer into a permission prompt.
    return false;
  }
}

/** Short local zip-tone so the agent notices a call was auto-answered. Best-effort, local-only. */
function playZipTone(): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
    osc.onended = () => void ctx.close();
  } catch {
    /* best-effort — a zip-tone failure must never block the answer */
  }
}

/**
 * Auto-accept the ringing call (3B.2b). Gated on a secure context + an ALREADY-granted microphone —
 * we never auto-answer into a permission prompt; the caller leaves the call ringing for manual answer
 * and surfaces a toast. Plays a local zip-tone before answering.
 */
export async function autoAnswerCall(): Promise<AutoAnswerResult> {
  if (!simpleUser) return 'no-softphone';
  if (!window.isSecureContext) return 'insecure-context';
  if (!(await isMicGranted())) return 'mic-not-granted';
  playZipTone();
  await answerCall();
  return 'answered';
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
