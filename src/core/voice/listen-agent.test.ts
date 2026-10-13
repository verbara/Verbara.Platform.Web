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
    options: Record<string, unknown>;
    delegate: { onInvite?: (i: unknown) => void; onDisconnect?: (e?: Error) => void } | undefined;
    transport = { send: vi.fn() };
    start = vi.fn(async () => undefined);
    stop = vi.fn(async () => undefined);
    reconnect = vi.fn(async () => undefined);
    constructor(options: Record<string, unknown>) {
      this.options = options;
      this.delegate = options.delegate as FakeUserAgent['delegate'];
      FakeUserAgent.instances.push(this);
    }
  }

  class FakeRegisterer {
    static instances: FakeRegisterer[] = [];
    static failNext = false;
    state = 'Initial';
    stateChange = new Emitter<string>();
    registerCalls: RegisterOptions[] = [];
    options: unknown;
    clearTimers = vi.fn();
    unregister = vi.fn(async () => undefined);
    dispose = vi.fn(async () => undefined);
    register = vi.fn(async (o: RegisterOptions = {}) => {
      this.registerCalls.push(o);
      if (FakeRegisterer.failNext) {
        FakeRegisterer.failNext = false;
        throw new Error('register failed');
      }
      o.requestDelegate?.onAccept?.({});
      this.setState('Registered');
    });
    constructor(_ua: unknown, options: unknown) {
      this.options = options;
      FakeRegisterer.instances.push(this);
    }
    setState(s: string) {
      if (s === this.state) return;
      this.state = s;
      this.stateChange.emit(s);
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

/** A same-process BroadcastChannel: every instance with the same name hears every other one. */
class FakeChannel {
  static all: FakeChannel[] = [];
  onmessage: ((e: { data: unknown }) => void) | null = null;
  closed = false;
  constructor(readonly name: string) {
    FakeChannel.all.push(this);
  }
  postMessage(data: unknown) {
    for (const ch of FakeChannel.all) {
      if (ch !== this && !ch.closed && ch.name === this.name) ch.onmessage?.({ data });
    }
  }
  close() {
    this.closed = true;
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
import { useVoiceCallStore } from '@/agent/stores/voice-call-store';

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
    h.FakeRegisterer.instances = [];
    h.FakeRegisterer.failNext = false;
    h.Inviter.mockClear();
    FakeChannel.all = [];
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
    await stopListenAgent();
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

  it('StartListenAgent_ShouldSetFailed_WhenTheRegisterIsRefused', async () => {
    h.FakeRegisterer.failNext = true;
    await startListenAgent(WSS, creds);
    expect(useListenStore.getState().registration).toBe('failed');
    expect(isListenAgentRunning()).toBe(false);
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

      reg.setState('Unregistered');
      ua().delegate?.onDisconnect?.(new Error('transport lost'));
      await Promise.resolve();

      expect(reg.register).toHaveBeenCalledTimes(1);
      expect(ua().reconnect).not.toHaveBeenCalled();
      expect(useListenStore.getState().registration).toBe('moved');
    });

    it('ListenAgent_ShouldReRegister_WhenTheRegistrationExpiresAndNotMoved', async () => {
      await startListenAgent(WSS, creds);
      const reg = registerer();

      reg.setState('Unregistered');
      await Promise.resolve();

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
      expect(heard).toEqual([{ endpointId: creds.endpointId, tabId: expect.any(String) }]);
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
