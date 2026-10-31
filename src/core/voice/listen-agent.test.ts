import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The receive-only listen user agent (design D1; spec `supervisor-listen-console`, requirements 1,
 * 2 and 7), over a mocked SIP.js core (`UserAgent`, `Registerer`, `Invitation`).
 */

const h = vi.hoisted(() => {
  class Emitter<T> {
    private readonly fns = new Set<(v: T) => void>();
    addListener(fn: (v: T) => void) {
      this.fns.add(fn);
    }
    removeListener(fn: (v: T) => void) {
      this.fns.delete(fn);
    }
    emit(v: T) {
      for (const fn of [...this.fns]) fn(v);
    }
  }

  interface RegisterOptions {
    requestDelegate?: { onAccept?: (r: unknown) => void; onReject?: (r: unknown) => void };
    requestOptions?: unknown;
  }

  class FakeUserAgent {
    static instances: FakeUserAgent[] = [];
    static makeURI = (s: string) => ({ raw: s, toString: () => s });
    /** When set, the next `start()` returns this promise instead of resolving at once. */
    static nextStart: Promise<void> | null = null;
    options: Record<string, unknown>;
    delegate: { onInvite?: (i: unknown) => void; onDisconnect?: (e?: Error) => void } | undefined;
    transport = { send: vi.fn() };
    connected = false;
    isConnected = () => this.connected;
    start = vi.fn(async () => {
      const gate = FakeUserAgent.nextStart;
      FakeUserAgent.nextStart = null;
      if (gate) await gate;
      this.connected = true;
    });
    stop = vi.fn(async () => {
      this.connected = false;
    });
    reconnect = vi.fn(async () => {
      this.connected = true;
    });
    constructor(options: Record<string, unknown>) {
      this.options = options;
      this.delegate = options.delegate as FakeUserAgent['delegate'];
      FakeUserAgent.instances.push(this);
    }
  }

  /**
   * SIP.js 0.21.2's Registerer as far as the listen agent sees it: `register()` resolves once the
   * REGISTER is SENT (not answered) and rejects with a RequestPendingError while one is outstanding
   * (`waiting`); the final answer arrives later. On a reject it emits `Unregistered` BEFORE
   * `waiting` goes back to false (registerer.js, onReject before waitingToggle(false)). A success
   * arms the refresh timers (`refreshing`), which `clearTimers()` disarms.
   */
  class FakeRegisterer {
    static instances: FakeRegisterer[] = [];
    /** Answer every REGISTER on the next microtask; off for tests that answer by hand. */
    static autoRespond = true;
    /** How many of the next REGISTERs are rejected. */
    static rejectNext = 0;
    state = 'Initial';
    stateChange = new Emitter<string>();
    waiting = false;
    waitingChange = new Emitter<boolean>();
    refreshing = false;
    disposed = false;
    /** register() calls that were refused because a REGISTER was still outstanding. */
    pendingRefusals = 0;
    registerCalls: RegisterOptions[] = [];
    private pending: { o: RegisterOptions; outcome: 'accept' | 'reject' } | null = null;
    options: unknown;
    clearTimers = vi.fn(() => {
      this.refreshing = false;
    });
    unregister = vi.fn(async () => undefined);
    dispose = vi.fn(async () => {
      this.disposed = true;
      this.refreshing = false;
    });
    register = vi.fn((o: RegisterOptions = {}) => {
      if (this.disposed) return Promise.reject(new Error('Registerer disposed'));
      if (this.waiting) {
        this.pendingRefusals++;
        const err = new Error('REGISTER request already in progress, waiting for final response');
        err.name = 'RequestPendingError';
        return Promise.reject(err);
      }
      this.registerCalls.push(o);
      const outcome = FakeRegisterer.rejectNext > 0 ? 'reject' : 'accept';
      if (outcome === 'reject') FakeRegisterer.rejectNext--;
      const p = { o, outcome } as const;
      this.pending = p;
      this.setWaiting(true);
      if (FakeRegisterer.autoRespond) {
        queueMicrotask(() => {
          if (this.pending === p) this.respond();
        });
      }
      return Promise.resolve();
    });
    constructor(_ua: unknown, options: unknown) {
      this.options = options;
      FakeRegisterer.instances.push(this);
    }
    /** The registrar's final answer to the outstanding REGISTER (its planned outcome by default). */
    respond(kind?: 'accept' | 'reject') {
      const p = this.pending;
      if (!p) throw new Error('no REGISTER outstanding');
      this.pending = null;
      if ((kind ?? p.outcome) === 'accept') {
        this.refreshing = true;
        this.setState('Registered');
        p.o.requestDelegate?.onAccept?.({});
      } else {
        this.refreshing = false;
        this.setState('Unregistered');
        p.o.requestDelegate?.onReject?.({});
      }
      this.setWaiting(false);
    }
    /** A 423 Interval Too Brief: SIP.js drops `waiting` and sends its own REGISTER at once. */
    respondIntervalTooBrief() {
      if (!this.pending) throw new Error('no REGISTER outstanding');
      this.pending = null;
      this.setWaiting(false);
      void this.register().catch(() => undefined);
    }
    /** SIP.js's own refresh timer firing: a REGISTER with no request delegate. */
    refresh() {
      void this.register().catch(() => undefined);
    }
    /** The registration expiring with nothing outstanding. */
    expire() {
      this.refreshing = false;
      this.setState('Unregistered');
    }
    setState(s: string) {
      if (s === this.state) return;
      this.state = s;
      this.stateChange.emit(s);
    }
    private setWaiting(w: boolean) {
      this.waiting = w;
      this.waitingChange.emit(w);
    }
  }

  const Inviter = vi.fn(function Inviter() {
    throw new Error('the listen agent must never place a call');
  });

  return { Emitter, FakeUserAgent, FakeRegisterer, Inviter };
});

vi.mock('sip.js', () => ({
  UserAgent: h.FakeUserAgent,
  Registerer: h.FakeRegisterer,
  Inviter: h.Inviter,
  RegistererState: {
    Initial: 'Initial',
    Registered: 'Registered',
    Unregistered: 'Unregistered',
    Terminated: 'Terminated',
  },
  SessionState: {
    Initial: 'Initial',
    Establishing: 'Establishing',
    Established: 'Established',
    Terminating: 'Terminating',
    Terminated: 'Terminated',
  },
}));

/**
 * A same-process BroadcastChannel: every instance with the same name hears every other one. With
 * `queued`, messages wait in `FakeChannel.queue` until a test delivers them, in any order (a real
 * BroadcastChannel delivers asynchronously, so two tabs' announcements can cross).
 */
class FakeChannel {
  static all: FakeChannel[] = [];
  static queued = false;
  static queue: { from: FakeChannel; to: FakeChannel; data: unknown }[] = [];
  onmessage: ((e: { data: unknown }) => void) | null = null;
  closed = false;
  constructor(readonly name: string) {
    FakeChannel.all.push(this);
  }
  postMessage(data: unknown) {
    for (const ch of FakeChannel.all) {
      if (ch === this || ch.closed || ch.name !== this.name) continue;
      if (FakeChannel.queued) FakeChannel.queue.push({ from: this, to: ch, data });
      else ch.onmessage?.({ data });
    }
  }
  close() {
    this.closed = true;
  }
  /** Delivers the queued messages that match, in queue order, and drops them from the queue. */
  static deliver(match: (m: { from: FakeChannel; to: FakeChannel }) => boolean = () => true) {
    const now = FakeChannel.queue.filter(match);
    FakeChannel.queue = FakeChannel.queue.filter((m) => !now.includes(m));
    for (const m of now) if (!m.to.closed) m.to.onmessage?.({ data: m.data });
  }
}

import {
  startListenAgent,
  stopListenAgent,
  listenHere,
  hangupListenLeg,
  subscribeListenLegEnded,
  isListenAgentRunning,
  forceRecvOnly,
  type ListenCredentials,
} from './listen-agent';
import { useListenStore } from './listen-store';
import { useVoiceCallStore } from '@/core/stores/voice-call-store';

const creds = (
  JSON.parse(
    readFileSync(
      resolve(process.cwd(), 'tests/fixtures/contracts/supervisor-sip-credentials.v1.json'),
      'utf-8',
    ),
  ) as { body: ListenCredentials }
).body;
const startBody = (
  JSON.parse(
    readFileSync(
      resolve(process.cwd(), 'tests/fixtures/contracts/supervisor-listen-start.v1.json'),
      'utf-8',
    ),
  ) as {
    start: { body: Parameters<ReturnType<typeof useListenStore.getState>['setActiveListen']>[0] };
  }
).start.body!;

const WSS = 'wss://pbx.example:8089/ws';
const CONV = '4f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a';

interface FakeInvitation {
  remoteIdentity: { uri: { user: string }; displayName: string };
  accept: ReturnType<typeof vi.fn>;
  reject: ReturnType<typeof vi.fn>;
  bye: ReturnType<typeof vi.fn>;
  state: string;
  stateChange: InstanceType<typeof h.Emitter<string>>;
  sessionDescriptionHandler: { remoteMediaStream: MediaStream };
}

function invitation(user: string, displayName = 'Verbara Listen'): FakeInvitation {
  const inv: FakeInvitation = {
    remoteIdentity: { uri: { user }, displayName },
    accept: vi.fn(async () => {
      inv.state = 'Established';
      inv.stateChange.emit('Established');
    }),
    reject: vi.fn(async () => undefined),
    bye: vi.fn(async () => {
      inv.state = 'Terminated';
      inv.stateChange.emit('Terminated');
    }),
    state: 'Initial',
    stateChange: new h.Emitter<string>(),
    sessionDescriptionHandler: { remoteMediaStream: {} as MediaStream },
  };
  return inv;
}

const ua = () => h.FakeUserAgent.instances.at(-1)!;
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const registerer = () => h.FakeRegisterer.instances.at(-1)!;
const invite = async (inv: FakeInvitation) => {
  ua().delegate?.onInvite?.(inv);
  await Promise.resolve();
  await Promise.resolve();
};

let getUserMedia: ReturnType<typeof vi.fn>;
let play: ReturnType<typeof vi.spyOn>;

describe('listen-agent', () => {
  beforeEach(() => {
    h.FakeUserAgent.instances = [];
    h.FakeUserAgent.nextStart = null;
    h.FakeRegisterer.instances = [];
    h.FakeRegisterer.autoRespond = true;
    h.FakeRegisterer.rejectNext = 0;
    h.Inviter.mockClear();
    FakeChannel.all = [];
    FakeChannel.queued = false;
    FakeChannel.queue = [];
    vi.stubGlobal('BroadcastChannel', FakeChannel);
    getUserMedia = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    useListenStore.getState().reset();
    useVoiceCallStore.getState().reset();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await stopListenAgent();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    play.mockRestore();
  });

  it('StartListenAgent_ShouldRegisterTheListenAor_WhenGivenTheFixtureCredentials', async () => {
    await startListenAgent(WSS, creds);

    const opts = ua().options as {
      uri: { raw: string };
      authorizationUsername: string;
      authorizationPassword: string;
      displayName: string;
      transportOptions: { server: string };
    };
    expect(opts.uri.raw).toBe(`sip:${creds.endpointId}@pbx.example`);
    expect(opts.authorizationUsername).toBe(creds.authorizationUsername);
    expect(opts.authorizationPassword).toBe(creds.sipPassword);
    expect(opts.displayName).toBe(creds.displayName);
    expect(opts.transportOptions.server).toBe(WSS);
    expect(ua().start).toHaveBeenCalled();
    expect(registerer().register).toHaveBeenCalledTimes(1);
    expect(useListenStore.getState().registration).toBe('registered');
    expect(isListenAgentRunning()).toBe(true);
  });

  it('StartListenAgent_ShouldGatherIceWithoutStun_WhenBuildingTheUserAgent', async () => {
    await startListenAgent(WSS, creds);
    const sdh = ua().options.sessionDescriptionHandlerFactoryOptions as {
      peerConnectionConfiguration: { iceServers: unknown[] };
      iceGatheringTimeout: number;
    };
    expect(sdh.peerConnectionConfiguration.iceServers).toEqual([]);
    expect(sdh.iceGatheringTimeout).toBeLessThanOrEqual(500);
  });

  it('StartListenAgent_ShouldSetFailedAfterBoundedRetries_WhenEveryRegisterIsRefused', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    h.FakeRegisterer.rejectNext = 1_000;
    await startListenAgent(WSS, creds);
    const reg = registerer();
    expect(useListenStore.getState().registration).toBe('connecting');

    await vi.advanceTimersByTimeAsync(120_000);

    expect(useListenStore.getState().registration).toBe('failed');
    expect(isListenAgentRunning()).toBe(false);
    expect(reg.pendingRefusals).toBe(0);
    const sent = reg.register.mock.calls.length;
    expect(sent).toBeGreaterThan(1);
    expect(sent).toBeLessThanOrEqual(8);

    await vi.advanceTimersByTimeAsync(600_000);
    expect(reg.register.mock.calls.length).toBe(sent);
  });

  it('OnInvite_ShouldAnswerReceiveOnly_WhenTheCallerIsThePendingConversation', async () => {
    await startListenAgent(WSS, creds);
    useListenStore.getState().setPending(CONV);
    const inv = invitation(CONV);

    await invite(inv);

    expect(inv.accept).toHaveBeenCalledTimes(1);
    const options = inv.accept.mock.calls[0]![0] as {
      sessionDescriptionHandlerOptions: { constraints: { audio: boolean; video: boolean } };
      sessionDescriptionHandlerModifiers: unknown[];
    };
    expect(options.sessionDescriptionHandlerOptions.constraints).toEqual({
      audio: false,
      video: false,
    });
    expect(options.sessionDescriptionHandlerModifiers).toContain(forceRecvOnly);
    expect(inv.reject).not.toHaveBeenCalled();
    expect(getUserMedia).not.toHaveBeenCalled();
    const audio = document.querySelector<HTMLAudioElement>('[data-testid="listen-remote-audio"]');
    expect(audio).not.toBeNull();
    expect(audio!.srcObject).toBe(inv.sessionDescriptionHandler.remoteMediaStream);
    expect(play).toHaveBeenCalled();
  });

  it('OnInvite_ShouldAnswer_WhenTheCallerIsTheActiveListen', async () => {
    await startListenAgent(WSS, creds);
    useListenStore.getState().setActiveListen({ ...startBody, state: 'dialing' });
    const inv = invitation(CONV);

    await invite(inv);

    expect(inv.accept).toHaveBeenCalledTimes(1);
  });

  it('OnInvite_ShouldRejectWithoutRinging_WhenNoListenWasStarted', async () => {
    await startListenAgent(WSS, creds);
    const inv = invitation(CONV, creds.listenCallerName);

    await invite(inv);

    expect(inv.reject).toHaveBeenCalledTimes(1);
    expect(inv.accept).not.toHaveBeenCalled();
    expect(useVoiceCallStore.getState().phase).toBe('idle');
    expect(play).not.toHaveBeenCalled();
  });

  it('OnInvite_ShouldReject_WhenTheCallerIsAnotherConversation', async () => {
    await startListenAgent(WSS, creds);
    useListenStore.getState().setActiveListen(startBody);
    const inv = invitation('another-conversation');

    await invite(inv);

    expect(inv.reject).toHaveBeenCalledTimes(1);
    expect(useListenStore.getState().activeListen).toEqual(startBody);
  });

  it('OnInvite_ShouldReject_WhenTheStartWasRefused', async () => {
    await startListenAgent(WSS, creds);
    useListenStore.getState().setPending(CONV);
    useListenStore.getState().clearPending();
    const inv = invitation(CONV);

    await invite(inv);

    expect(inv.reject).toHaveBeenCalledTimes(1);
    expect(inv.accept).not.toHaveBeenCalled();
  });

  it('ListenAgent_ShouldNeverCreateAnInviterOrSendRawRequests_WhenUsed', async () => {
    await startListenAgent(WSS, creds);
    useListenStore.getState().setPending(CONV);
    await invite(invitation(CONV));
    await hangupListenLeg();
    await listenHere();

    expect(h.Inviter).not.toHaveBeenCalled();
    // Every REGISTER goes through Registerer.register, which always carries the Contact; the module
    // never writes to the transport itself, so it can never send a REGISTER without a Contact.
    expect(ua().transport.send).not.toHaveBeenCalled();
    for (const call of registerer().registerCalls) expect(call.requestOptions).toBeUndefined();
  });

  it('ListenAgent_ShouldNeverStoreOrLogTheSipPassword_WhenRunning', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    await startListenAgent(WSS, creds);
    useListenStore.getState().setPending(CONV);
    await invite(invitation(CONV));
    await stopListenAgent();

    for (const spy of spies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(creds.sipPassword);
      spy.mockRestore();
    }
    expect(JSON.stringify(useListenStore.getState())).not.toContain(creds.sipPassword);
    expect(JSON.stringify(localStorage)).not.toContain(creds.sipPassword);
    expect(JSON.stringify(sessionStorage)).not.toContain(creds.sipPassword);
  });

  it('HangupListenLeg_ShouldByeTheAnsweredLeg_WhenStopIsChosen', async () => {
    await startListenAgent(WSS, creds);
    useListenStore.getState().setPending(CONV);
    const inv = invitation(CONV);
    await invite(inv);

    await hangupListenLeg();

    expect(inv.bye).toHaveBeenCalledTimes(1);
  });

  it('SubscribeListenLegEnded_ShouldFire_WhenTheAnsweredLegEndsOnItsOwn', async () => {
    const ended = vi.fn();
    const unsubscribe = subscribeListenLegEnded(ended);
    await startListenAgent(WSS, creds);
    useListenStore.getState().setPending(CONV);
    const inv = invitation(CONV);
    await invite(inv);

    inv.stateChange.emit('Terminated');

    expect(ended).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-testid="listen-remote-audio"]')).toBeNull();
    unsubscribe();
  });

  it('ListenAgent_ShouldShowClickToHear_WhenAutoplayIsBlocked', async () => {
    play.mockRejectedValueOnce(new Error('NotAllowedError'));
    await startListenAgent(WSS, creds);
    useListenStore.getState().setPending(CONV);
    await invite(invitation(CONV));
    await Promise.resolve();

    expect(useListenStore.getState().audioBlocked).toBe(true);
  });

  it('ForceRecvOnly_ShouldTurnASendrecvAnswerIntoRecvonly_WhenAppliedToTheSdp', async () => {
    const out = await forceRecvOnly({
      type: 'answer',
      sdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 0\r\na=sendrecv\r\n',
    });
    expect(out.sdp).toContain('a=recvonly');
    expect(out.sdp).not.toContain('a=sendrecv');
  });

  describe('take-over by another window of the same browser', () => {
    it('ListenAgent_ShouldMoveAndStopRefreshing_WhenAnotherTabRegistersTheSameEndpoint', async () => {
      await startListenAgent(WSS, creds);
      const reg = registerer();

      new FakeChannel('verbara-listen').postMessage({
        endpointId: creds.endpointId,
        tabId: 'other-tab',
      });

      expect(useListenStore.getState().registration).toBe('moved');
      expect(reg.clearTimers).toHaveBeenCalled();
      expect(reg.unregister).not.toHaveBeenCalled();
    });

    it('ListenAgent_ShouldIgnoreTheAnnouncement_WhenItIsForAnotherEndpoint', async () => {
      await startListenAgent(WSS, creds);
      new FakeChannel('verbara-listen').postMessage({ endpointId: 'other', tabId: 'other-tab' });
      expect(useListenStore.getState().registration).toBe('registered');
    });

    it('ListenAgent_ShouldNotReRegister_WhenMovedAndTheRegistrationLapses', async () => {
      await startListenAgent(WSS, creds);
      const reg = registerer();
      new FakeChannel('verbara-listen').postMessage({
        endpointId: creds.endpointId,
        tabId: 'other-tab',
      });

      reg.expire();
      ua().delegate?.onDisconnect?.(new Error('transport lost'));
      await Promise.resolve();

      expect(reg.register).toHaveBeenCalledTimes(1);
      expect(ua().reconnect).not.toHaveBeenCalled();
      expect(useListenStore.getState().registration).toBe('moved');
    });

    it('ListenAgent_ShouldReRegister_WhenTheRegistrationExpiresAndNotMoved', async () => {
      await startListenAgent(WSS, creds);
      const reg = registerer();

      reg.expire();
      await vi.waitFor(() => expect(useListenStore.getState().registration).toBe('registered'));

      expect(reg.register).toHaveBeenCalledTimes(2);
    });

    it('ListenAgent_ShouldReconnectAndReRegister_WhenTheTransportIsLostAndNotMoved', async () => {
      await startListenAgent(WSS, creds);
      ua().delegate?.onDisconnect?.(new Error('transport lost'));
      await vi.waitFor(() => expect(registerer().register).toHaveBeenCalledTimes(2));
      expect(ua().reconnect).toHaveBeenCalledTimes(1);
    });

    it('ListenHere_ShouldRegisterAgainAndMoveTheOtherTab_WhenChosen', async () => {
      const other = new FakeChannel('verbara-listen');
      const heard: unknown[] = [];
      other.onmessage = (e) => heard.push(e.data);
      await startListenAgent(WSS, creds);
      other.postMessage({ endpointId: creds.endpointId, tabId: 'other-tab' });
      expect(useListenStore.getState().registration).toBe('moved');
      heard.length = 0;

      await listenHere();

      expect(registerer().register).toHaveBeenCalledTimes(2);
      expect(useListenStore.getState().registration).toBe('registered');
      expect(heard).toEqual([
        { endpointId: creds.endpointId, tabId: expect.any(String), at: expect.any(Number) },
      ]);
    });

    it('ListenAgent_ShouldKeepAnAnsweredLeg_WhenMoved', async () => {
      await startListenAgent(WSS, creds);
      useListenStore.getState().setPending(CONV);
      const inv = invitation(CONV);
      await invite(inv);

      new FakeChannel('verbara-listen').postMessage({
        endpointId: creds.endpointId,
        tabId: 'other-tab',
      });

      expect(inv.bye).not.toHaveBeenCalled();
      expect(document.querySelector('[data-testid="listen-remote-audio"]')).not.toBeNull();
    });
  });

  describe('two tabs of the same browser registering at once', () => {
    type AgentModule = typeof import('./listen-agent');
    type StoreModule = typeof import('./listen-store');
    interface Tab {
      agent: AgentModule;
      store: StoreModule['useListenStore'];
      reg: InstanceType<typeof h.FakeRegisterer>;
      channel: FakeChannel;
      done: Promise<void>;
    }

    let clock = 0;

    /** A second module graph is a second tab: its own tab id, agent singleton and store. */
    async function openTab(): Promise<Tab> {
      vi.resetModules();
      const agent = await import('./listen-agent');
      const store = (await import('./listen-store')).useListenStore;
      const done = agent.startListenAgent(WSS, creds);
      await flush();
      return { agent, store, reg: registerer(), channel: FakeChannel.all.at(-1)!, done };
    }

    /** Exactly one tab shows `registered` and refreshes; every other one shows `moved` and doesn't. */
    function expectOneHolder(tabs: Tab[], holder: Tab) {
      for (const t of tabs) {
        const shown = t.store.getState().registration;
        if (t === holder) {
          expect(shown).toBe('registered');
          expect(t.reg.refreshing).toBe(true);
        } else {
          expect(shown).toBe('moved');
          expect(t.reg.refreshing).toBe(false);
        }
      }
    }

    beforeEach(() => {
      h.FakeRegisterer.autoRespond = false;
      FakeChannel.queued = true;
      clock = 1_000;
      vi.spyOn(Date, 'now').mockImplementation(() => clock);
    });

    afterEach(async () => {
      FakeChannel.queued = false;
    });

    it('TwoTabs_ShouldEndWithOneHolder_WhenBothAnnouncementsCross', async () => {
      const a = await openTab();
      const b = await openTab();

      clock = 1_100;
      a.reg.respond('accept');
      await flush();
      clock = 1_101;
      b.reg.respond('accept');
      await flush();
      FakeChannel.deliver();
      await flush();

      expectOneHolder([a, b], b);
      await Promise.all([a.done, b.done]);
      await a.agent.stopListenAgent();
      await b.agent.stopListenAgent();
    });

    it('TwoTabs_ShouldEndWithOneHolder_WhenTheNewerAnnouncementArrivesFirst', async () => {
      const a = await openTab();
      const b = await openTab();

      clock = 1_100;
      a.reg.respond('accept');
      await flush();
      clock = 1_101;
      b.reg.respond('accept');
      await flush();
      FakeChannel.deliver((m) => m.to === a.channel);
      FakeChannel.deliver((m) => m.to === b.channel);
      await flush();

      expectOneHolder([a, b], b);
      await a.agent.stopListenAgent();
      await b.agent.stopListenAgent();
    });

    it('TwoTabs_ShouldEndWithOneHolder_WhenBothRegisterInTheSameMillisecond', async () => {
      const a = await openTab();
      const b = await openTab();

      clock = 1_100;
      a.reg.respond('accept');
      b.reg.respond('accept');
      await flush();
      FakeChannel.deliver();
      await flush();

      const states = [a, b].map((t) => t.store.getState().registration).sort();
      expect(states).toEqual(['moved', 'registered']);
      expectOneHolder([a, b], a.store.getState().registration === 'registered' ? a : b);
      await a.agent.stopListenAgent();
      await b.agent.stopListenAgent();
    });

    it('Tab_ShouldAnnounceAndHold_WhenItsOwnRegisterSucceedsAfterItWasMarkedMoved', async () => {
      const a = await openTab();
      const b = await openTab();

      clock = 1_100;
      a.reg.respond('accept');
      await flush();
      FakeChannel.deliver();
      await flush();
      expect(b.store.getState().registration).toBe('moved');

      clock = 1_200;
      b.reg.respond('accept');
      await flush();
      expect(b.store.getState().registration).toBe('registered');
      FakeChannel.deliver();
      await flush();

      expectOneHolder([a, b], b);
      await a.agent.stopListenAgent();
      await b.agent.stopListenAgent();
    });

    it('Tab_ShouldIgnoreAnAnnouncement_WhenItIsOlderThanItsOwnRegistration', async () => {
      const a = await openTab();
      clock = 2_000;
      a.reg.respond('accept');
      await flush();

      new FakeChannel('verbara-listen').postMessage({
        endpointId: creds.endpointId,
        tabId: 'other-tab',
        at: 1_500,
      });
      FakeChannel.deliver();

      expect(a.store.getState().registration).toBe('registered');
      expect(a.reg.refreshing).toBe(true);
      await a.agent.stopListenAgent();
    });
  });

  describe('automatic re-registration (SIP.js request ordering)', () => {
    it('ListenAgent_ShouldRetryAfterThePendingRequestSettles_WhenARefreshIsRejected', async () => {
      await startListenAgent(WSS, creds);
      const reg = registerer();

      h.FakeRegisterer.rejectNext = 1;
      reg.refresh();
      await vi.waitFor(() => expect(reg.register).toHaveBeenCalledTimes(3));

      await vi.waitFor(() => expect(useListenStore.getState().registration).toBe('registered'));
      expect(reg.pendingRefusals).toBe(0);
    });

    it('ListenAgent_ShouldReRegister_WhenTheTransportReconnectsWhileARegisterIsPending', async () => {
      await startListenAgent(WSS, creds);
      const reg = registerer();
      h.FakeRegisterer.autoRespond = false;
      reg.refresh();
      expect(reg.waiting).toBe(true);

      ua().connected = false;
      ua().delegate?.onDisconnect?.(new Error('transport lost'));
      await flush();
      expect(ua().reconnect).toHaveBeenCalledTimes(1);
      expect(useListenStore.getState().registration).not.toBe('failed');
      expect(reg.pendingRefusals).toBe(0);

      reg.respond('reject');
      await flush();
      expect(reg.register).toHaveBeenCalledTimes(3);
      reg.respond('accept');
      await flush();

      expect(useListenStore.getState().registration).toBe('registered');
      expect(reg.pendingRefusals).toBe(0);
    });

    it('ListenAgent_ShouldWaitForSipJsOwnResend_WhenARefreshIsAnswered423', async () => {
      await startListenAgent(WSS, creds);
      const reg = registerer();
      const other = new FakeChannel('verbara-listen');
      const heard: unknown[] = [];
      other.onmessage = (e) => heard.push(e.data);
      h.FakeRegisterer.autoRespond = false;
      reg.refresh();

      reg.respondIntervalTooBrief();
      await flush();
      expect(reg.waiting).toBe(true);
      expect(heard).toEqual([]);
      expect(reg.pendingRefusals).toBe(0);

      reg.respond('accept');
      await flush();
      expect(heard).toHaveLength(1);
      expect(useListenStore.getState().registration).toBe('registered');
    });

    it('ListenAgent_ShouldBackOffBetweenRetries_WhenTheRegistrarKeepsRefusing', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      await startListenAgent(WSS, creds);
      const reg = registerer();

      h.FakeRegisterer.rejectNext = 3;
      reg.expire();
      await vi.advanceTimersByTimeAsync(0);
      const afterImmediate = reg.register.mock.calls.length;
      await vi.advanceTimersByTimeAsync(500);
      expect(reg.register.mock.calls.length).toBe(afterImmediate);
      expect(useListenStore.getState().registration).toBe('connecting');

      await vi.advanceTimersByTimeAsync(30_000);

      expect(useListenStore.getState().registration).toBe('registered');
      expect(reg.pendingRefusals).toBe(0);
    });

    it('ListenAgent_ShouldStopRetrying_WhenMovedDuringTheBackoff', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      await startListenAgent(WSS, creds);
      const reg = registerer();
      h.FakeRegisterer.rejectNext = 2;
      reg.expire();
      await vi.advanceTimersByTimeAsync(0);
      const sent = reg.register.mock.calls.length;

      new FakeChannel('verbara-listen').postMessage({
        endpointId: creds.endpointId,
        tabId: 'other-tab',
        at: Date.now() + 1,
      });
      await vi.advanceTimersByTimeAsync(60_000);

      expect(reg.register.mock.calls.length).toBe(sent);
      expect(useListenStore.getState().registration).toBe('moved');
    });
  });

  describe('a start overtaken by a principal change', () => {
    const creds2: ListenCredentials = { ...creds, endpointId: 'listen-other-principal' };

    function deferred() {
      let resolve!: () => void;
      let reject!: (e: Error) => void;
      const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    }

    it('StartListenAgent_ShouldLeaveTheNewAgentRunning_WhenTheOldStartFailsLate', async () => {
      const first = deferred();
      h.FakeUserAgent.nextStart = first.promise;
      const old = startListenAgent(WSS, creds);
      await flush();
      const oldUa = ua();

      void stopListenAgent();
      await startListenAgent(WSS, creds2);
      const newUa = ua();
      const newReg = registerer();
      expect(newUa).not.toBe(oldUa);
      expect(useListenStore.getState().registration).toBe('registered');

      first.reject(new Error('transport refused'));
      await old;
      await flush();

      expect(useListenStore.getState().registration).toBe('registered');
      expect(isListenAgentRunning()).toBe(true);
      expect(newUa.stop).not.toHaveBeenCalled();
      expect(newReg.dispose).not.toHaveBeenCalled();
    });

    it('StartListenAgent_ShouldNotRegisterTheOldAgent_WhenItsStartResolvesAfterAStop', async () => {
      const first = deferred();
      h.FakeUserAgent.nextStart = first.promise;
      const old = startListenAgent(WSS, creds);
      await flush();
      const oldReg = registerer();

      void stopListenAgent();
      await startListenAgent(WSS, creds2);

      first.resolve();
      await old;
      await flush();

      expect(oldReg.register).not.toHaveBeenCalled();
      expect(useListenStore.getState().registration).toBe('registered');
      expect(isListenAgentRunning()).toBe(true);
    });

    it('StopListenAgent_ShouldNotOverwriteTheNextAgentsState_WhenItsTeardownEndsLate', async () => {
      await startListenAgent(WSS, creds);
      const oldReg = registerer();
      const teardown = deferred();
      oldReg.dispose.mockImplementationOnce(() => teardown.promise);

      const stopping = stopListenAgent();
      await startListenAgent(WSS, creds2);
      expect(useListenStore.getState().registration).toBe('registered');

      teardown.resolve();
      await stopping;

      expect(useListenStore.getState().registration).toBe('registered');
      expect(isListenAgentRunning()).toBe(true);
    });
  });

  it('StopListenAgent_ShouldUnregisterStopAndForgetEverything_WhenCalled', async () => {
    await startListenAgent(WSS, creds);
    const reg = registerer();
    const agent = ua();

    await stopListenAgent();

    expect(reg.dispose).toHaveBeenCalled();
    expect(agent.stop).toHaveBeenCalled();
    expect(isListenAgentRunning()).toBe(false);
    expect(useListenStore.getState().registration).toBe('offline');
    expect(FakeChannel.all.every((c) => c.closed)).toBe(true);
  });
});
