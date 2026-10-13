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
 * REGISTER this tab gets accepted is announced on a `BroadcastChannel` with the time of that answer;
 * the announcement with the newest time names the tab that holds the slot. A tab goes to `moved`
 * only for an announcement newer than its own latest accepted REGISTER, stops refreshing and never
 * takes the slot back on its own. If a REGISTER it had already sent is accepted after it went to
 * `moved`, it holds the slot again: it announces (so the other tab goes to `moved`) and shows
 * `registered`. What a tab shows therefore always matches whether it holds the registration.
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

/**
 * Retries after a lost registration (transport loss, expiry, a refused REGISTER): the first at once,
 * then backing off. When they are spent the agent shows `failed` and stops; a new opening of the
 * operations shell starts again.
 */
const RETRY_DELAYS_MS = [0, 1_000, 2_000, 4_000, 8_000] as const;

/** A take-over announcement: this tab's REGISTER was accepted at `at` (ms since the epoch). */
interface Announcement {
  endpointId: string;
  tabId: string;
  at: number;
}

/**
 * One start of the agent. Every callback is scoped to its instance: once `running` names another
 * instance (or none), a late answer, failure or teardown of this one changes nothing that is shown.
 */
interface Running {
  userAgent: UserAgent;
  registerer: Registerer;
  endpointId: string;
  channel: BroadcastChannel | null;
  stopping: boolean;
  /** Time of this tab's latest accepted REGISTER (0: none yet). */
  registeredAt: number;
  /** Newest announcement time heard from another tab, so our next one is always newer. */
  heardAt: number;
  /** Another tab holds the slot: no refresh, no automatic re-register. */
  moved: boolean;
  /** The transport dropped: reconnect before the next REGISTER. */
  needsReconnect: boolean;
  retries: number;
  retryTimer: ReturnType<typeof setTimeout> | null;
  /** Resolved when the next REGISTER attempt settles (or the instance stops). */
  settleWaiters: (() => void)[];
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

function isCurrent(r: Running): boolean {
  return running === r && !r.stopping;
}

/** Writes the registration state only while `r` is the running instance. */
function show(r: Running, registration: 'connecting' | 'registered' | 'failed' | 'moved'): void {
  if (isCurrent(r)) useListenStore.getState().setRegistration(registration);
}

function settled(r: Running): void {
  const waiters = r.settleWaiters.splice(0);
  for (const resolve of waiters) resolve();
}

function untilSettled(r: Running): Promise<void> {
  if (!isCurrent(r)) return Promise.resolve();
  return new Promise((resolve) => r.settleWaiters.push(resolve));
}

function clearRetry(r: Running): void {
  if (r.retryTimer !== null) {
    clearTimeout(r.retryTimer);
    r.retryTimer = null;
  }
}

/**
 * The Registerer members this agent needs that sip.js 0.21.2 declares TS-private (they are
 * JS-public): whether a REGISTER is outstanding, its change event, and the refresh timers.
 * Re-check on a sip.js bump.
 */
interface RegistererInternals {
  readonly waiting: boolean;
  readonly waitingChange: { addListener: (listener: (waiting: boolean) => void) => void };
  clearTimers: () => void;
}

function internalsOf(registerer: Registerer): RegistererInternals {
  return registerer as unknown as RegistererInternals;
}

/** Stops SIP.js's refresh timers. */
function stopRefreshing(r: Running): void {
  internalsOf(r.registerer).clearTimers();
}

/** Is `m` newer than this tab's own latest accepted REGISTER? Ties go to the higher tab id. */
function isNewerThanOurs(r: Running, m: Announcement): boolean {
  return m.at > r.registeredAt || (m.at === r.registeredAt && m.tabId > tabId);
}

/** A REGISTER of this tab was accepted (explicit or SIP.js's own refresh): we hold the slot. */
function onAccepted(r: Running): void {
  r.registeredAt = Math.max(Date.now(), r.heardAt + 1, r.registeredAt + 1);
  r.moved = false;
  r.retries = 0;
  clearRetry(r);
  const announcement: Announcement = { endpointId: r.endpointId, tabId, at: r.registeredAt };
  r.channel?.postMessage(announcement);
  show(r, 'registered');
}

/**
 * Sends one REGISTER through the Registerer (which always carries the Contact). Never while one is
 * outstanding: SIP.js refuses that with RequestPendingError, so we wait for the outstanding one to
 * settle and act on its answer instead (the waiting listener).
 */
async function attemptRegister(r: Running): Promise<void> {
  if (!isCurrent(r) || r.moved) return;
  try {
    if (r.needsReconnect || !r.userAgent.isConnected()) {
      await r.userAgent.reconnect();
      r.needsReconnect = false;
      if (!isCurrent(r) || r.moved) return;
    }
    if (internalsOf(r.registerer).waiting) {
      // Nothing was sent, so this attempt does not count: the outstanding answer decides.
      r.retries = Math.max(0, r.retries - 1);
      return;
    }
    await r.registerer.register();
  } catch {
    if (!isCurrent(r) || r.moved) return;
    settled(r);
    scheduleRetry(r);
  }
}

/** The registration was lost or refused: try again with bounded backoff, unless moved. */
function scheduleRetry(r: Running): void {
  if (!isCurrent(r) || r.moved || r.retryTimer !== null) return;
  const delay = RETRY_DELAYS_MS[r.retries];
  if (delay === undefined) {
    show(r, 'failed');
    void teardown(r);
    return;
  }
  r.retries++;
  show(r, 'connecting');
  if (delay === 0) {
    void attemptRegister(r);
    return;
  }
  r.retryTimer = setTimeout(() => {
    r.retryTimer = null;
    void attemptRegister(r);
  }, delay);
}

/** An explicit registration (start, "Listen here"): a fresh retry budget, sent now. */
async function requestRegister(r: Running): Promise<void> {
  r.moved = false;
  r.retries = 0;
  clearRetry(r);
  show(r, 'connecting');
  const done = untilSettled(r);
  await attemptRegister(r);
  await done;
}

function onChannelMessage(r: Running, data: unknown): void {
  const msg = data as { endpointId?: unknown; tabId?: unknown; at?: unknown } | null;
  if (!msg || msg.endpointId !== r.endpointId || msg.tabId === tabId) return;
  if (!isCurrent(r)) return;
  // An announcement without a time comes from an older console: treat it as the newest.
  const at = typeof msg.at === 'number' ? msg.at : Number.MAX_SAFE_INTEGER;
  r.heardAt = Math.max(r.heardAt, at);
  if (!isNewerThanOurs(r, { endpointId: r.endpointId, tabId: String(msg.tabId), at })) return;
  // Another window of this browser took the slot after us: stop refreshing, never unregister (our
  // contact is already gone), and never take it back on our own.
  r.moved = true;
  clearRetry(r);
  stopRefreshing(r);
  show(r, 'moved');
}

/**
 * Connect + REGISTER the listen user agent. No-op when already running. Resolves once the first
 * REGISTER is answered (or the agent stopped). A failure to connect sets `failed` and tears this
 * agent down, so a later start can retry cleanly; it never touches an agent started after it.
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
    registeredAt: 0,
    heardAt: 0,
    moved: false,
    needsReconnect: false,
    retries: 0,
    retryTimer: null,
    settleWaiters: [],
  };
  running = r;

  if (channel) channel.onmessage = (e) => onChannelMessage(r, e.data);

  userAgent.delegate = {
    onInvite,
    onDisconnect: (error) => {
      // A transport loss re-registers unless this tab lost the slot to another window.
      if (!error || !isCurrent(r) || r.moved) return;
      r.needsReconnect = true;
      r.retries = 0;
      clearRetry(r);
      scheduleRetry(r);
    },
  };

  // The answer to every REGISTER, ours or SIP.js's own refresh, lands here once `waiting` drops:
  // after a refusal SIP.js emits `Unregistered` while still waiting, so a retry from the state
  // listener would be refused with RequestPendingError. Read on the next microtask, because SIP.js
  // may send its own REGISTER right after dropping `waiting` (a 423 answer); then that one decides.
  internalsOf(registerer).waitingChange.addListener((waiting) => {
    if (waiting) return;
    queueMicrotask(() => {
      if (!isCurrent(r) || internalsOf(registerer).waiting) return;
      if (registerer.state === RegistererState.Registered) onAccepted(r);
      else if (!r.moved) scheduleRetry(r);
      settled(r);
    });
  });

  registerer.stateChange.addListener((state) => {
    // An expiry with nothing outstanding: register again (the moved state does not).
    if (state === RegistererState.Unregistered && !internalsOf(registerer).waiting) {
      scheduleRetry(r);
    }
  });

  useListenStore.getState().setRegistration('connecting');
  try {
    await userAgent.start();
  } catch {
    if (isCurrent(r)) {
      useListenStore.getState().setRegistration('failed');
      running = null;
    }
    await teardown(r);
    return;
  }
  if (!isCurrent(r)) {
    // Stopped (sign-out, principal change) while connecting: this start is over.
    await teardown(r);
    return;
  }
  await requestRegister(r);
}

/** "Listen here": take the registration back from another window of this browser. */
export async function listenHere(): Promise<void> {
  const r = running;
  if (!r) return;
  await requestRegister(r);
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

/** Releases one instance. Changes nothing that is shown: the caller decides that. */
async function teardown(r: Running): Promise<void> {
  if (running === r) running = null;
  if (r.stopping) return;
  r.stopping = true;
  clearRetry(r);
  settled(r);
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

/**
 * Unregister, disconnect and drop the credentials (sign-out, principal change, leaving the shell).
 * The `offline` state is written at once, before the teardown awaits, so an agent started while
 * this one is still being torn down never has its state overwritten by it.
 */
export async function stopListenAgent(): Promise<void> {
  const r = running;
  running = null;
  const hangup = hangupListenLeg();
  useListenStore.getState().setRegistration('offline');
  await hangup;
  if (r) await teardown(r);
}
