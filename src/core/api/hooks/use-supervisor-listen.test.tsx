import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { useListenStore } from '@/core/voice/listen-store';

/**
 * The silent-listen hooks (design D4; spec `supervisor-listen-console`), against MSW handlers that
 * answer the host's fixture bodies verbatim (`tests/fixtures/contracts/`).
 */

const { hangupMock } = vi.hoisted(() => ({ hangupMock: vi.fn(async () => undefined) }));
vi.mock('@/core/voice/listen-agent', () => ({
  hangupListenLeg: hangupMock,
  subscribeListenLegEnded: () => () => undefined,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('react-i18next', async () => {
  const { createLocaleI18n } = await import('@/test/locale-i18n');
  const i18n = await createLocaleI18n('en-US');
  return { useTranslation: () => ({ t: i18n.t.bind(i18n), i18n }) };
});

import {
  currentListenInterval,
  conversationIdOfSession,
  useCurrentListen,
  useListenEndpoint,
  useListenPhone,
  useSetListenPhone,
  useStartListen,
  useStopListen,
} from './use-supervisor-listen';

type Entry = { status: number; body: Record<string, unknown> };
const readJson = <T,>(name: string) =>
  JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures/contracts', name), 'utf-8')) as T;

const creds = readJson<Entry>('supervisor-sip-credentials.v1.json');
const startFx = readJson<{ start: Entry; current: Entry }>('supervisor-listen-start.v1.json');
const stopFx = readJson<Entry>('supervisor-listen-stop.v1.json');
const phoneFx = readJson<{ get: Entry; set: Entry; invalid: Entry }>(
  'supervisor-listen-phone.v1.json',
);
const refusals = readJson<Record<string, Entry & { routes?: string[] }>>(
  'supervisor-listen-refusals.json',
);

const CONV = '4f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a';
const USER = '7d2c9e4b1a5f4c3e8b6d0f1a2c3e4b5d';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  vi.mocked(toast.error).mockClear();
  hangupMock.mockClear();
  useListenStore.getState().reset();
});

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  return { qc, wrapper };
}

/** The text of the last error toast, as the user's DOM carries it. */
function lastToastText(): string | null {
  const content = vi.mocked(toast.error).mock.calls.at(-1)?.[0] as ReactNode;
  if (content === undefined) return null;
  const { container, unmount } = render(<div>{content}</div>);
  const text = container.textContent;
  unmount();
  return text;
}

/** The `data-error-code` of the last error toast, as the user's DOM carries it. */
function lastToastCode(): string | null {
  const content = vi.mocked(toast.error).mock.calls.at(-1)?.[0] as ReactNode;
  if (content === undefined) return null;
  const { container, unmount } = render(<div>{content}</div>);
  const code = container.querySelector('[data-error-code]')?.getAttribute('data-error-code');
  unmount();
  return code ?? null;
}

const startRefusals = Object.entries(refusals).filter(
  ([key, e]) => key !== '_comment' && e.routes?.includes('start'),
);

describe('useListenEndpoint', () => {
  it('UseListenEndpoint_ShouldPostWithNoBodyAndReturnTheCredentials_WhenTheRouteAnswers200', async () => {
    let body: string | null = null;
    server.use(
      http.post('*/api/v1/supervisor/listen-endpoint', async ({ request }) => {
        body = await request.text();
        return HttpResponse.json(creds.body);
      }),
    );
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useListenEndpoint(), { wrapper });
    let answer: unknown;
    await act(async () => {
      answer = await result.current.mutateAsync();
    });
    expect(answer).toEqual(creds.body);
    expect(body).toBe('');
  });
});

describe('useStartListen', () => {
  it('UseStartListen_ShouldSendExactlyTheDestinationAndHoldTheListen_WhenTheRouteAnswers200', async () => {
    let sent: unknown;
    let pendingDuringRequest: string | null = null;
    server.use(
      http.post(`*/api/v1/supervisor/conversations/${CONV}/listen`, async ({ request }) => {
        sent = await request.json();
        pendingDuringRequest = useListenStore.getState().pendingConversationId;
        return HttpResponse.json(startFx.start.body);
      }),
    );
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useStartListen(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ conversationId: CONV, destination: 'endpoint' });
    });
    expect(sent).toEqual({ destination: 'endpoint' });
    expect(pendingDuringRequest).toBe(CONV);
    expect(useListenStore.getState().pendingConversationId).toBeNull();
    expect(useListenStore.getState().activeListen).toEqual(startFx.start.body);
  });

  it('UseStartListen_ShouldSendThePhoneDestinationAndNoNumber_WhenThePhoneIsChosen', async () => {
    let sent: unknown;
    server.use(
      http.post(`*/api/v1/supervisor/conversations/${CONV}/listen`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ ...startFx.start.body, destination: 'phone' });
      }),
    );
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useStartListen(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ conversationId: CONV, destination: 'phone' });
    });
    expect(sent).toEqual({ destination: 'phone' });
  });

  it.each(startRefusals)(
    'UseStartListen_ShouldStayIdleAndToastItsCode_WhenTheRouteRefuses %s',
    async (_name, entry) => {
      server.use(
        http.post(`*/api/v1/supervisor/conversations/${CONV}/listen`, () =>
          HttpResponse.json(entry.body, { status: entry.status }),
        ),
      );
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useStartListen(), { wrapper });
      act(() => result.current.mutate({ conversationId: CONV, destination: 'endpoint' }));
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(useListenStore.getState().pendingConversationId).toBeNull();
      expect(useListenStore.getState().activeListen).toBeNull();
      expect(lastToastCode()).toBe(entry.body.error);
    },
  );

  it('UseStartListen_ShouldNameTheTrunk_WhenTheRouteRefusesTrunkNotDialable', async () => {
    const entry = refusals.trunkNotDialable;
    server.use(
      http.post(`*/api/v1/supervisor/conversations/${CONV}/listen`, () =>
        HttpResponse.json(entry.body, { status: entry.status }),
      ),
    );
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useStartListen(), { wrapper });
    act(() => result.current.mutate({ conversationId: CONV, destination: 'phone' }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(lastToastCode()).toBe('trunk-not-dialable');
    const text = lastToastText();
    expect(text).toContain('Trunk 4');
    expect(text).not.toContain(CONV);
    expect(text).not.toContain('trunk-not-dialable');
  });

  it('UseStartListen_ShouldClearThePendingListenAndToastTheGenericFailure_WhenTheNetworkFails', async () => {
    server.use(
      http.post(`*/api/v1/supervisor/conversations/${CONV}/listen`, () => HttpResponse.error()),
    );
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useStartListen(), { wrapper });
    act(() => result.current.mutate({ conversationId: CONV, destination: 'endpoint' }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(useListenStore.getState().pendingConversationId).toBeNull();
    expect(lastToastCode()).toBe('listen-failed');
  });
});

describe('useCurrentListen', () => {
  it('CurrentListenInterval_ShouldPollEverySecondWhileDialingAndEveryFiveWhileListening_WhenAListenIsHeld', () => {
    expect(currentListenInterval({ ...startFx.start.body, state: 'dialing' } as never)).toBe(1_000);
    expect(currentListenInterval(startFx.current.body as never)).toBe(5_000);
    expect(currentListenInterval(null)).toBe(false);
    expect(currentListenInterval(undefined)).toBe(false);
  });

  it('UseCurrentListen_ShouldHoldTheServersListen_WhenTheRouteAnswers200', async () => {
    server.use(
      http.get('*/api/v1/supervisor/listen', () => HttpResponse.json(startFx.current.body)),
    );
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCurrentListen(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(startFx.current.body));
    expect(useListenStore.getState().activeListen).toEqual(startFx.current.body);
  });

  it('UseCurrentListen_ShouldGoIdleWithoutAnError_WhenTheRouteAnswers404ListenNotFound', async () => {
    useListenStore.getState().setActiveListen(startFx.current.body as never);
    const notFound = refusals.listenNotFound;
    server.use(
      http.get('*/api/v1/supervisor/listen', () =>
        HttpResponse.json(notFound.body, { status: notFound.status }),
      ),
    );
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCurrentListen(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
    expect(useListenStore.getState().activeListen).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('UseCurrentListen_ShouldReadAgainWithinASecond_WhileTheListenIsDialing', async () => {
    let calls = 0;
    server.use(
      http.get('*/api/v1/supervisor/listen', () => {
        calls += 1;
        return HttpResponse.json(
          calls === 1
            ? { ...startFx.current.body, state: 'dialing', listeningSince: null }
            : startFx.current.body,
        );
      }),
    );
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCurrentListen(), { wrapper });
    await waitFor(() => expect(result.current.data?.state).toBe('listening'), { timeout: 2_500 });
    expect(calls).toBe(2);
  });

  it('UseCurrentListen_ShouldNotCallTheRoute_WhenDisabled', async () => {
    let calls = 0;
    server.use(
      http.get('*/api/v1/supervisor/listen', () => {
        calls += 1;
        return HttpResponse.json(startFx.current.body);
      }),
    );
    const { wrapper } = makeWrapper();
    renderHook(() => useCurrentListen(false), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toBe(0);
  });
});

describe('useStopListen', () => {
  it('UseStopListen_ShouldPostNoBodyEndTheListenAndHangUp_WhenTheRouteAnswers200', async () => {
    useListenStore.getState().setActiveListen(startFx.start.body as never);
    let body: string | null = null;
    server.use(
      http.post(`*/api/v1/supervisor/conversations/${CONV}/listen/stop`, async ({ request }) => {
        body = await request.text();
        return HttpResponse.json(stopFx.body);
      }),
    );
    const { wrapper, qc } = makeWrapper();
    qc.setQueryData(['supervisor', 'listen', 'current'], startFx.start.body);
    const { result } = renderHook(() => useStopListen(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(CONV);
    });
    expect(body).toBe('');
    expect(useListenStore.getState().activeListen).toBeNull();
    expect(qc.getQueryData(['supervisor', 'listen', 'current'])).toBeNull();
    expect(hangupMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.data).toEqual(stopFx.body));
  });

  it('UseStopListen_ShouldEndTheListenWithoutAnError_WhenTheRouteAnswers404ListenNotFound', async () => {
    useListenStore.getState().setActiveListen(startFx.start.body as never);
    server.use(
      http.post(`*/api/v1/supervisor/conversations/${CONV}/listen/stop`, () =>
        HttpResponse.json(
          { ...refusals.listenNotFound.body, conversationId: CONV },
          { status: 404 },
        ),
      ),
    );
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useStopListen(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(CONV);
    });
    expect(useListenStore.getState().activeListen).toBeNull();
    expect(hangupMock).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('UseStopListen_ShouldKeepTheListenAndToastItsCode_WhenTheRouteRefusesOtherwise', async () => {
    useListenStore.getState().setActiveListen(startFx.start.body as never);
    server.use(
      http.post(`*/api/v1/supervisor/conversations/${CONV}/listen/stop`, () =>
        HttpResponse.json(refusals.notLeader.body, { status: refusals.notLeader.status }),
      ),
    );
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useStopListen(), { wrapper });
    act(() => result.current.mutate(CONV));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(useListenStore.getState().activeListen).toEqual(startFx.start.body);
    expect(lastToastCode()).toBe('not-leader');
  });
});

describe('useListenPhone / useSetListenPhone', () => {
  it('UseListenPhone_ShouldReadTheStoredNumber_WhenTheRouteAnswers200', async () => {
    server.use(
      http.get(`*/api/v1/admin/users/${USER}/listen-phone`, () =>
        HttpResponse.json(phoneFx.get.body),
      ),
    );
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useListenPhone(USER), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(phoneFx.get.body));
  });

  it('UseListenPhone_ShouldFailWithA404_WhenTheUserIsNotInTheTenant', async () => {
    server.use(
      http.get(
        `*/api/v1/admin/users/${USER}/listen-phone`,
        () => new HttpResponse(null, { status: 404 }),
      ),
    );
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useListenPhone(USER), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as { status?: number }).status).toBe(404);
  });

  it.each([
    ['  +57 300-123 (4567)  ', '+57 300-123 (4567)'],
    ['+573001234567', '+573001234567'],
    [null, null],
    ['   ', null],
  ])('UseSetListenPhone_ShouldSendTheTrimmedTextAsTyped_WhenSaving %j', async (typed, expected) => {
    let sent: unknown;
    server.use(
      http.put(`*/api/v1/admin/users/${USER}/listen-phone`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ userId: USER, phoneNumber: expected });
      }),
    );
    const { wrapper, qc } = makeWrapper();
    const { result } = renderHook(() => useSetListenPhone(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ userId: USER, phoneNumber: typed });
    });
    expect(sent).toEqual({ phoneNumber: expected });
    expect(qc.getQueryData(['admin', 'users', USER, 'listen-phone'])).toEqual({
      userId: USER,
      phoneNumber: expected,
    });
  });

  it('UseSetListenPhone_ShouldRejectWithTheInvalidCode_WhenTheRouteAnswers400', async () => {
    server.use(
      http.put(`*/api/v1/admin/users/${USER}/listen-phone`, () =>
        HttpResponse.json(phoneFx.invalid.body, { status: phoneFx.invalid.status }),
      ),
    );
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetListenPhone(), { wrapper });
    act(() => result.current.mutate({ userId: USER, phoneNumber: '300 123 4567' }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as { code?: string }).code).toBe('listen-phone-invalid');
  });
});

describe('conversationIdOfSession', () => {
  const sessions = readJson<{ body: Record<string, unknown>[] }>('active-session.v1.json').body;

  it('ConversationIdOfSession_ShouldReadTheRowsConversationId_WhenTheHostWritesIt', () => {
    expect(conversationIdOfSession(sessions[0] as never)).toBe(CONV);
    expect(conversationIdOfSession(sessions[1] as never)).toBeNull();
  });

  it('ConversationIdOfSession_ShouldBeNull_WhenAnOlderPlatformOmitsTheField', () => {
    const { conversationId: _omitted, ...older } = sessions[0];
    expect(conversationIdOfSession(older as never)).toBeNull();
  });
});
