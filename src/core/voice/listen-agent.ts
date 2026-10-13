import {
  Registerer,
  RegistererState,
  SessionState,
  UserAgent,
  type Invitation,
  type SessionDescriptionHandlerModifier,
} from 'sip.js';
import { deriveDomain } from './sip-domain';
import { useListenStore } from './listen-store';

/**
 * The supervisor's listen credentials, field for field as `POST /api/v1/supervisor/listen-endpoint`
 * answers them (`supervisor-sip-credentials.v1.json`).
 *
 * Interim until openapi.d.ts regenerates (supervisor-silent-listen): typed locally from the fixture
 * copy; gate G2 swaps it for `components['schemas']['SupervisorListenEndpointDto']`.
 */
export interface ListenCredentials {
  endpointId: string;
  authorizationUsername: string;
  sipPassword: string;
  displayName: string;
  listenCallerName: string;
}

/**
 * The receive-only listen user agent (design D1 of `supervisor-silent-listen`). It is NOT the agent
 * softphone: a separate SIP.js core `UserAgent` + `Registerer` under the supervisor's own listen
 * endpoint, which never asks for the microphone, never places a call, and answers only the INVITE of
 * a listen this console started (caller ID number = that listen's conversation id). Every other
 * INVITE is rejected at once, with no ring, no tone and no store change.
 *
 * One registration per endpoint (the host's AOR holds one contact, the latest REGISTER wins). Every
 * explicit registration is announced on a `BroadcastChannel`; a tab that hears another tab register
 * the same endpoint goes to `moved`, stops refreshing and never takes the slot back on its own.
 *
 * The SIP secret lives only in this module's closure (the `UserAgent` options); it is never stored,
 * persisted or logged (Verbara.Platform.Web/ADR-0011).
 */

const CHANNEL_NAME = 'verbara-listen';

/**
 * The listen leg answers without STUN and with a short ICE gathering window: with SIP.js's default
 * (public STUN, 5 s gathering timeout) the 200 OK waited about 5 s, and without STUN the lab measured
 * about 0.3 s from accept to audio (host lab 0.3, delta a).
 */
const ICE_GATHERING_TIMEOUT_MS = 500;

/**
 * SIP.js 0.21.2 answers `a=sendrecv` when the session has no local track (host lab 0.3, delta d);
 * this modifier makes the answer say what the leg is: receive-only.
 */
export const forceRecvOnly: SessionDescriptionHandlerModifier = (description) =>
  Promise.resolve({
    ...description,
    sdp: description.sdp
      ?.replaceAll('a=sendrecv', 'a=recvonly')
      .replaceAll('a=sendonly', 'a=inactive'),
  });

interface Running {
  userAgent: UserAgent;
  registerer: Registerer;
  endpointId: string;
  channel: BroadcastChannel | null;
  stopping: boolean;
}

let running: Running | null = null;
let leg: Invitation | null = null;
let audioEl: HTMLAudioElement | null = null;
const tabId = Math.random().toString(36).slice(2) + Date.now().toString(36);
const legEndedListeners = new Set<() => void>();

export function isListenAgentRunning(): boolean {
  return running !== null;
}

/** Called when the answered browser leg ends on its own, so the console re-reads the listen. */
export function subscribeListenLegEnded(listener: () => void): () => void {
  legEndedListeners.add(listener);
  return () => legEndedListeners.delete(listener);
}

/** The conversation ids this console is waiting on: the pending start and the held listen. */
function expectedConversationIds(): string[] {
  const { pendingConversationId, activeListen } = useListenStore.getState();
  const ids: string[] = [];
  if (pendingConversationId) ids.push(pendingConversationId);
  if (activeListen && (activeListen.state === 'dialing' || activeListen.state === 'listening')) {
    ids.push(activeListen.conversationId);
  }
  return ids;
}

function removeAudio(): void {
  if (audioEl) {
    audioEl.srcObject = null;
    audioEl.remove();
    audioEl = null;
  }
  useListenStore.getState().setAudioBlocked(false);
}

function attachRemoteAudio(invitation: Invitation): void {
  const sdh = invitation.sessionDescriptionHandler as unknown as
    { remoteMediaStream?: MediaStream } | undefined;
  if (!sdh?.remoteMediaStream) return;
  removeAudio();
  audioEl = document.createElement('audio');
  audioEl.autoplay = true;
  audioEl.hidden = true;
  audioEl.setAttribute('data-testid', 'listen-remote-audio');
  document.body.appendChild(audioEl);
  audioEl.srcObject = sdh.remoteMediaStream;
  playAudio();
}

function playAudio(): void {
  const el = audioEl;
  if (!el) return;
  void el.play().then(
    () => useListenStore.getState().setAudioBlocked(false),
    () => useListenStore.getState().setAudioBlocked(true),
  );
}

/** "Click to hear": retries playback from a user gesture after autoplay was refused. */
export function resumeListenAudio(): void {
  playAudio();
}

function onInvite(invitation: Invitation): void {
  const caller = invitation.remoteIdentity.uri.user ?? '';
  // Only the caller ID number qualifies a call; the display name (listenCallerName) never does.
  if (!caller || !expectedConversationIds().includes(caller) || leg !== null) {
    void invitation.reject().catch(() => undefined);
    return;
  }
  leg = invitation;
  invitation.stateChange.addListener((state) => {
    if (state === SessionState.Established) {
      attachRemoteAudio(invitation);
    } else if (state === SessionState.Terminated) {
      if (leg === invitation) leg = null;
      removeAudio();
      for (const listener of [...legEndedListeners]) listener();
    }
  });
  void invitation
    .accept({
      sessionDescriptionHandlerOptions: { constraints: { audio: false, video: false } },
      sessionDescriptionHandlerModifiers: [forceRecvOnly],
    })
    .catch(() => {
      if (leg === invitation) leg = null;
    });
}

/** Sends a REGISTER through the Registerer (which always carries the Contact) and announces it. */
async function register(r: Running): Promise<void> {
  await r.registerer.register({
    requestDelegate: {
      onAccept: () => {
        r.channel?.postMessage({ endpointId: r.endpointId, tabId });
      },
    },
  });
}

function onChannelMessage(r: Running, data: unknown): void {
  const msg = data as { endpointId?: unknown; tabId?: unknown } | null;
  if (!msg || msg.endpointId !== r.endpointId || msg.tabId === tabId) return;
  // Another window of this browser took the slot: stop refreshing, never unregister (our contact is
  // already gone), and never take it back on our own.
  (r.registerer as unknown as { clearTimers: () => void }).clearTimers();
  useListenStore.getState().setRegistration('moved');
}

function isMoved(): boolean {
  return useListenStore.getState().registration === 'moved';
}

/**
 * Connect + REGISTER the listen user agent. No-op when already running. A failure sets `failed`
 * and tears the agent down, so a later start can retry cleanly.
 */
export async function startListenAgent(
  wssUrl: string,
  credentials: ListenCredentials,
): Promise<void> {
  if (running) return;
  const domain = deriveDomain(wssUrl);
  const uri = UserAgent.makeURI(`sip:${credentials.endpointId}@${domain}`);
  if (!uri) {
    useListenStore.getState().setRegistration('failed');
    return;
  }

  const userAgent = new UserAgent({
    uri,
    transportOptions: { server: wssUrl },
    authorizationUsername: credentials.authorizationUsername,
    authorizationPassword: credentials.sipPassword,
    displayName: credentials.displayName,
    logLevel: 'error',
    sessionDescriptionHandlerFactoryOptions: {
      peerConnectionConfiguration: { iceServers: [] },
      iceGatheringTimeout: ICE_GATHERING_TIMEOUT_MS,
    },
  });
  const registerer = new Registerer(userAgent);
  const channel =
    typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL_NAME) : null;
  const r: Running = {
    userAgent,
    registerer,
    endpointId: credentials.endpointId,
    channel,
    stopping: false,
  };
  running = r;

  if (channel) channel.onmessage = (e) => onChannelMessage(r, e.data);

  userAgent.delegate = {
    onInvite,
    onDisconnect: (error) => {
      // A transport loss re-registers unless this tab lost the slot to another window.
      if (!error || r.stopping || running !== r || isMoved()) return;
      useListenStore.getState().setRegistration('connecting');
      void userAgent
        .reconnect()
        .then(() => register(r))
        .catch(() => {
          if (running === r && !isMoved()) useListenStore.getState().setRegistration('failed');
        });
    },
  };

  registerer.stateChange.addListener((state) => {
    if (running !== r || r.stopping || isMoved()) return;
    if (state === RegistererState.Registered) {
      useListenStore.getState().setRegistration('registered');
    } else if (state === RegistererState.Unregistered) {
      // An expiry: register again (the moved state returned above).
      useListenStore.getState().setRegistration('connecting');
      void register(r).catch(() => {
        if (running === r && !isMoved()) useListenStore.getState().setRegistration('failed');
      });
    }
  });

  useListenStore.getState().setRegistration('connecting');
  try {
    await userAgent.start();
    await register(r);
  } catch {
    await stopListenAgent();
    useListenStore.getState().setRegistration('failed');
  }
}

/** "Listen here": take the registration back from another window of this browser. */
export async function listenHere(): Promise<void> {
  const r = running;
  if (!r) return;
  useListenStore.getState().setRegistration('connecting');
  try {
    await register(r);
    useListenStore.getState().setRegistration('registered');
  } catch {
    if (running === r) useListenStore.getState().setRegistration('failed');
  }
}

/** Hangs up the browser leg if it is still up (after Stop listening, or a 404 from stop). */
export async function hangupListenLeg(): Promise<void> {
  const current = leg;
  leg = null;
  removeAudio();
  if (!current) return;
  try {
    if (current.state === SessionState.Established) await current.bye();
    else if (current.state !== SessionState.Terminated) await current.reject();
  } catch {
    /* best-effort: the server ends the leg on stop anyway */
  }
}

/** Unregister, disconnect and drop the credentials (sign-out, principal change, leaving the shell). */
export async function stopListenAgent(): Promise<void> {
  const r = running;
  running = null;
  await hangupListenLeg();
  if (r) {
    r.stopping = true;
    if (r.channel) {
      r.channel.onmessage = null;
      r.channel.close();
    }
    try {
      await r.registerer.dispose();
    } catch {
      /* best-effort */
    }
    try {
      await r.userAgent.stop();
    } catch {
      /* best-effort */
    }
  }
  useListenStore.getState().setRegistration('offline');
}
