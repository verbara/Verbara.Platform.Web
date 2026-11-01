import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isForCurrentAgent, resolveAgentId, useSSE } from './use-sse';
import { useAuthStore } from '@/core/auth/auth-store';
import { refreshAccessToken } from '@/core/api/client';
import { createWrapper } from '@/test/hook-test-utils';
import { createLocaleI18n } from '@/test/locale-i18n';
import { toast } from 'sonner';

vi.mock('@/core/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/api/client')>()),
  refreshAccessToken: vi.fn(async () => false),
}));

// Stable `navigate` and `t`: both are dependencies of the hook's `connect`, so an identity that
// changed on every render would reopen the stream on every render.
const navigateMock = vi.fn();
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigateMock,
}));

// `let`: the toast suite swaps in the real es-419 `t` before it mounts the hook.
const echoKey = (key: string) => key;
let t: (key: string, options?: Record<string, unknown>) => string = echoKey;
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), error: vi.fn(), warning: vi.fn(), success: vi.fn() },
}));

describe('resolveAgentId', () => {
  it('reads agentId — the shape /agents/me actually returns', () => {
    // Regression: GET /agents/me serializes the raw Agent as `agentId`, not `id`.
    // Reading only `.id` left currentAgentId() undefined and dropped every offer.
    expect(resolveAgentId({ agentId: 'agent-786d14bb' })).toBe('agent-786d14bb');
  });

  it('falls back to id when agentId is absent (normalized hooks)', () => {
    expect(resolveAgentId({ id: 'agent-786d14bb' })).toBe('agent-786d14bb');
  });

  it('prefers agentId over id when both present', () => {
    expect(resolveAgentId({ agentId: 'real', id: 'other' })).toBe('real');
  });

  it('returns undefined when nothing is cached (admin / not loaded yet)', () => {
    expect(resolveAgentId(undefined)).toBeUndefined();
    expect(resolveAgentId({})).toBeUndefined();
  });
});

describe('isForCurrentAgent', () => {
  it('returns true when the event agentId equals my agentId', () => {
    expect(isForCurrentAgent('agent-40ccd6', 'agent-40ccd6')).toBe(true);
  });

  it('returns false when the event targets a different agent', () => {
    expect(isForCurrentAgent('agent-40ccd6', 'agent-99999')).toBe(false);
  });

  it('returns false when my agentId is unknown (no agent profile loaded / admin)', () => {
    expect(isForCurrentAgent('agent-40ccd6', undefined)).toBe(false);
  });

  it('does NOT match the user id — AgentId and UserId are distinct entities', () => {
    // Regression: the offered/assigned events carry Agent.AgentId, which is a
    // different EntityId from the logged-in User.UserId. Matching the event
    // agentId against the user id silently suppressed every agent-targeted
    // notification (the WebChat offer card never appeared).
    const myUserId = 'user-a8f74';
    const myAgentId = 'agent-40ccd6';
    const eventAgentId = 'agent-40ccd6';
    expect(isForCurrentAgent(eventAgentId, myUserId)).toBe(false);
    expect(isForCurrentAgent(eventAgentId, myAgentId)).toBe(true);
  });
});

/**
 * The SSE reconnect (spec realtime-connection-lifecycle: "The SSE stream MUST reconnect with a
 * usable token"; design D6). Platform ends the stream at the token's `exp` and refuses a stream
 * opened past it with a 401 that EventSource cannot read, so the hook keys on the console's own
 * token expiry: an expired token is refreshed before anything reopens, and the token change re-runs
 * `connect` with the new token. Real hook and real auth store, a fake `EventSource` global, fake
 * timers (Date included), `refreshAccessToken` mocked.
 */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readonly url: string;
  onopen: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  closed = false;
  readonly listeners = new Map<string, (e: MessageEvent) => void>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (e: MessageEvent) => void): void {
    this.listeners.set(type, listener);
  }

  /** The server sends a named event, serialized as `SseEndpoints.WriteEventAsync` writes it. */
  emit(type: string, data: unknown): void {
    this.listeners.get(type)?.(new MessageEvent(type, { data: JSON.stringify(data) }));
  }

  close(): void {
    this.closed = true;
  }

  /** The browser reports a failed or ended stream (EventSource cannot tell 401 from 403). */
  fail(): void {
    this.onerror?.(new Event('error'));
  }
}

const A_USER = { id: 'user-1', email: 'a@b.com', displayName: 'Test', role: 'supervisor' } as const;
const FIFTEEN_MINUTES = 15 * 60_000;
const refreshMock = vi.mocked(refreshAccessToken);

function signIn(token: string) {
  useAuthStore.getState().setAuth(token, Date.now() + FIFTEEN_MINUTES, A_USER, 'tenant-1', [], {});
}

/** Moves the clock into the token's 30 s expiry buffer, where `isTokenExpired()` turns true. */
function letTheTokenExpire() {
  vi.setSystemTime(Date.now() + FIFTEEN_MINUTES - 20_000);
  expect(useAuthStore.getState().isTokenExpired()).toBe(true);
}

const streamUrl = (token: string) => `/api/v1/events/stream?token=${encodeURIComponent(token)}`;
const urls = () => FakeEventSource.instances.map((s) => s.url);

function latest(): FakeEventSource {
  const source = FakeEventSource.instances.at(-1);
  if (!source) throw new Error('no EventSource was opened');
  return source;
}

/** A promise the test settles by hand, to hold the refresh open and observe what waits on it. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function mountWithToken(token: string) {
  signIn(token);
  renderHook(() => useSSE(), { wrapper: createWrapper() });
  expect(urls()).toEqual([streamUrl(token)]);
}

describe('useSSE reconnect', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
    refreshMock.mockReset();
    refreshMock.mockResolvedValue(false);
    vi.mocked(toast.error).mockClear();
  });

  afterEach(() => {
    cleanup();
    useAuthStore.getState().logout();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('UseSSE_ShouldRefreshAndReopenOnlyWithTheNewToken_WhenTheStreamErrorsWhileTheTokenIsExpired', async () => {
    mountWithToken('T1');
    const refresh = deferred<boolean>();
    refreshMock.mockImplementation(() => refresh.promise);
    letTheTokenExpire();

    const timersBefore = vi.getTimerCount();
    act(() => latest().fail());

    expect({
      refreshCalls: refreshMock.mock.calls.length,
      backOffTimers: vi.getTimerCount() - timersBefore,
    }).toEqual({ refreshCalls: 1, backOffTimers: 0 });

    // Nothing reopens while the refresh is pending, however long it takes.
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(urls()).toEqual([streamUrl('T1')]);

    // The refresh lands: the token change re-runs `connect` with the new token.
    await act(async () => {
      signIn('T2');
      refresh.resolve(true);
    });
    expect(urls()).toEqual([streamUrl('T1'), streamUrl('T2')]);
  });

  it('UseSSE_ShouldKeepTheBoundedBackOffWithTheHeldToken_WhenTheStreamErrorsWhileTheTokenIsValid', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // no jitter: the delays are exactly 2 s, 4 s, …
    mountWithToken('T1');

    act(() => latest().fail());
    await act(() => vi.advanceTimersByTimeAsync(1_999));
    expect(urls()).toHaveLength(1);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(urls()).toEqual([streamUrl('T1'), streamUrl('T1')]);

    act(() => latest().fail());
    await act(() => vi.advanceTimersByTimeAsync(3_999));
    expect(urls()).toHaveLength(2);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(urls()).toEqual([streamUrl('T1'), streamUrl('T1'), streamUrl('T1')]);

    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('UseSSE_ShouldGiveUpWithTheConnectionLostToast_WhenTenRetriesWithAValidTokenAllFail', async () => {
    mountWithToken('T1');

    for (let retry = 1; retry <= 10; retry++) {
      act(() => latest().fail());
      await act(() => vi.advanceTimersByTimeAsync(31_000)); // the longest delay: 30 s + 1 s jitter
      expect(urls()).toHaveLength(1 + retry);
    }
    act(() => latest().fail());
    await act(() => vi.advanceTimersByTimeAsync(5 * 60_000));

    expect(urls()).toHaveLength(11);
    expect(toast.error).toHaveBeenCalledExactlyOnceWith('toasts.sse.connectionLost');
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('UseSSE_ShouldOpenNoStream_WhenTheRefreshOfAnExpiredTokenIsRefused', async () => {
    mountWithToken('T1');
    refreshMock.mockResolvedValue(false);
    letTheTokenExpire();

    act(() => latest().fail());
    await act(() => vi.advanceTimersByTimeAsync(10 * 60_000));

    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(urls()).toEqual([streamUrl('T1')]);
    expect(latest().closed).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('UseSSE_ShouldNotSpendARetry_WhenItRefreshesAnExpiredToken', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    mountWithToken('T1');

    // One retry spent with a valid token: the next back-off would be 4 s.
    act(() => latest().fail());
    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(urls()).toHaveLength(2);

    // The token expires and the stream ends: the refresh path, which spends nothing.
    letTheTokenExpire();
    refreshMock.mockImplementation(async () => {
      signIn('T2');
      return true;
    });
    await act(async () => latest().fail());
    expect(urls()).toEqual([streamUrl('T1'), streamUrl('T1'), streamUrl('T2')]);

    // The next error with the valid T2 waits 4 s (one retry spent), not 8 s (two).
    act(() => latest().fail());
    await act(() => vi.advanceTimersByTimeAsync(3_999));
    expect(urls()).toHaveLength(3);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(urls()).toHaveLength(4);
    expect(latest().url).toBe(streamUrl('T2'));
  });

  it('UseSSE_ShouldNeitherRefreshNorReopen_WhenAnExpiredImpersonationTokenEndsTheStream_UntilTheImpersonationEnds', async () => {
    mountWithToken('T1');
    act(() =>
      useAuthStore.getState().startImpersonation(
        {
          accessToken: 'IMP',
          expiresAt: new Date(Date.now() + FIFTEEN_MINUTES).toISOString(),
          targetTenantId: 'tenant-2',
          targetTenantName: 'Target',
        },
        'T1',
        'tenant-1',
      ),
    );
    expect(urls()).toEqual([streamUrl('T1'), streamUrl('IMP')]);
    letTheTokenExpire();

    const timersBefore = vi.getTimerCount();
    act(() => latest().fail());
    expect(vi.getTimerCount() - timersBefore).toBe(0);
    await act(() => vi.advanceTimersByTimeAsync(20_000));

    // The refresh cookie is the operator's: no refresh, and no stream with the expired token.
    expect(refreshMock).not.toHaveBeenCalled();
    expect(urls()).toEqual([streamUrl('T1'), streamUrl('IMP')]);

    // The impersonation's end swaps the token back, and that change reopens the stream.
    act(() => useAuthStore.getState().endImpersonation());
    expect(urls()).toEqual([streamUrl('T1'), streamUrl('IMP'), streamUrl('T1')]);
  });

  it('UseSSE_ShouldNeitherRefreshNorScheduleARetry_WhenTheUserSignedOutBeforeTheErrorLanded', async () => {
    mountWithToken('T1');

    // Sign-out and the error in one batch: the error lands before the effect cleanup closes the
    // stream, with the store already signed out (so `isTokenExpired()` reads true). The timer count
    // is taken after the sign-out, whose `sessionStorage` write schedules a jsdom timer of its own.
    let timersBefore = 0;
    act(() => {
      useAuthStore.getState().logout();
      timersBefore = vi.getTimerCount();
      latest().fail();
    });
    expect(vi.getTimerCount() - timersBefore).toBe(0);
    await act(() => vi.advanceTimersByTimeAsync(60_000));

    expect(refreshMock).not.toHaveBeenCalled();
    expect(urls()).toEqual([streamUrl('T1')]);
  });

  it('UseSSE_ShouldOpenNoStream_WhenTheOwnerUnmountsDuringTheBackOff', async () => {
    signIn('T1');
    const { unmount } = renderHook(() => useSSE(), { wrapper: createWrapper() });
    expect(urls()).toEqual([streamUrl('T1')]);

    // A valid token: the error schedules the back-off reconnect (2 s to 3 s).
    act(() => latest().fail());
    // A client-side navigation unmounts the owner before the delay ends.
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(60_000));

    expect(urls()).toEqual([streamUrl('T1')]);
  });

  it('UseSSE_ShouldOpenOneStreamWithTheNewToken_WhenTheTokenChangesDuringTheBackOff', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    mountWithToken('T1');

    act(() => latest().fail());
    // The token changes before the back-off ends: the new token opens its stream at once.
    act(() => signIn('T2'));
    expect(urls()).toEqual([streamUrl('T1'), streamUrl('T2')]);

    // The old back-off timer is gone: it neither reopens nor touches the T2 stream.
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(urls()).toEqual([streamUrl('T1'), streamUrl('T2')]);
    expect(latest().closed).toBe(false);
  });
});

/**
 * The live toasts in es-419 (spec `agent-console-localization`, "Live toasts" and "The offered toast
 * names the channel"). The real locale file answers through the real `t`; the agent's identity, which
 * only gates the event, is left in the query cache where the hook's observer would put it.
 *
 * A critical notification is two things: `title` and `body` are written by the server, in the
 * language the server chose, and pass through; only the action label is the console's own text.
 */
describe('useSSE toasts in es-419', () => {
  const ME = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
  const CONVERSATION = '4f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a';

  /** `data` of host fixture `conversation-offered.v1.json`. */
  const offered = (channel: string, agentId = ME) => ({
    tenantId: 'demo',
    conversationId: CONVERSATION,
    agentId,
    queueId: '7c2e4a6b8d0f4e1a9b3c5d7e9f1a2b3c',
    channel,
    type: 'conversation.offered',
    timestamp: '2026-10-30T15:04:05.130+00:00',
  });

  const critical = (actionUrl: string | null) => ({
    notificationId: 'n-1',
    userId: 'user-1',
    category: 'Security',
    severity: 'Critical',
    title: 'Trunk 4 is down',
    body: 'Calls on Trunk 4 are failing.',
    actionUrl,
    timestamp: '2026-10-30T15:04:05.130+00:00',
  });

  function lastToast(kind: 'info' | 'error') {
    const call = vi.mocked(toast[kind]).mock.calls.at(-1);
    if (!call) throw new Error(`no toast.${kind} was raised`);
    const [message, options] = call;
    const action = options?.action as { label: string; onClick: () => void } | undefined;
    return { message, description: options?.description, action };
  }

  beforeEach(async () => {
    const i18n = await createLocaleI18n('es-419');
    t = i18n.getFixedT('es-419', 'common') as typeof t;
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
    vi.mocked(toast.info).mockClear();
    vi.mocked(toast.error).mockClear();
    navigateMock.mockClear();

    signIn('token');
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['agent-me'], { agentId: ME });
    renderHook(() => useSSE(), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client }, children),
    });
  });

  afterEach(() => {
    cleanup();
    useAuthStore.getState().logout();
    vi.unstubAllGlobals();
    t = echoKey;
  });

  it('AssignedToast_ShouldComeFromTheLocaleFile_InEs419', () => {
    latest().emit('conversation.assigned', {
      conversationId: CONVERSATION,
      agentId: ME,
      contactName: 'Ana Díaz',
    });

    const { message, action } = lastToast('info');
    expect(message).toBe('Nueva conversación de Ana Díaz');
    expect(action?.label).toBe('Abrir');
    action?.onClick();
    expect(navigateMock).toHaveBeenCalledWith(`/agent/conversation/${CONVERSATION}`);
  });

  it.each([
    ['WebChat', 'Chat web'],
    ['Email', 'Correo electrónico'],
    ['WhatsApp', 'WhatsApp'],
    ['CarrierPigeon', 'CarrierPigeon'],
  ])('OfferedToast_ShouldNameTheChannelThroughTheKeyedSet_For %s', (channel, label) => {
    latest().emit('conversation.offered', offered(channel));

    const { message, action } = lastToast('info');
    expect(message).toBe(`Nueva conversación ofrecida por ${label}`);
    expect(action?.label).toBe('Abrir');
    action?.onClick();
    expect(navigateMock).toHaveBeenCalledWith(`/agent/conversation/${CONVERSATION}`);
  });

  it('OfferedToast_ShouldNotShow_WhenTheEventNamesAnotherAgent', () => {
    latest().emit('conversation.offered', offered('WhatsApp', 'another-agent'));

    expect(toast.info).not.toHaveBeenCalled();
  });

  it('CriticalToast_ShouldLocalizeItsActionLabelAndPassTheServerTextThrough', () => {
    latest().emit('notification.created', critical('/operations/trunks/4'));

    const { message, description, action } = lastToast('error');
    expect(message).toBe('Trunk 4 is down');
    expect(description).toBe('Calls on Trunk 4 are failing.');
    expect(action?.label).toBe('Ver');
    action?.onClick();
    expect(navigateMock).toHaveBeenCalledWith('/operations/trunks/4');
  });

  it('CriticalToast_ShouldOfferNoAction_WhenThereIsNoActionUrl', () => {
    latest().emit('notification.created', critical(null));

    expect(lastToast('error').action).toBeUndefined();
  });
});
