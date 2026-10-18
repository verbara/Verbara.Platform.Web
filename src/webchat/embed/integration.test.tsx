vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * 80,
        size: 80,
      })),
    getTotalSize: () => count * 80,
    scrollToIndex: () => {},
    measureElement: () => {},
  }),
}));

import { StrictMode } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import { ChatWidget, type InitConfigPayload } from './chat-widget';
import frames from './transport/__fixtures__/ws-frames.json';
import { MAX_ATTACH_ATTEMPTS, SESSION_TIMEOUT_MS } from './transport/session-store';

class FakeWebSocket {
  static last: FakeWebSocket | null = null;
  static all: FakeWebSocket[] = [];
  readyState = 0;
  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  sent: string[] = [];
  constructor(readonly url: string) {
    FakeWebSocket.last = this;
    FakeWebSocket.all.push(this);
  }
  send(msg: string) {
    this.sent.push(msg);
  }
  close() {
    this.readyState = 3;
    this.onclose?.(new CloseEvent('close'));
  }
}

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: 'en-US',
      defaultNS: 'webchat',
      ns: ['webchat'],
      resources: {
        'en-US': {
          webchat: {
            preChat: {
              title: 'Start',
              subtitle: 'Tell us…',
              name: 'Your name',
              namePlaceholder: 'Jane',
              email: 'Email',
              emailPlaceholder: 'you@x',
              submit: 'Start chat',
              validation: {
                nameRequired: 'Name required',
                emailRequired: 'Email required',
                emailInvalid: 'Invalid',
              },
            },
            composer: { placeholder: 'Type…', send: 'Send', sendAriaLabel: 'Send message' },
            status: {
              connecting: 'Connecting',
              online: 'Online',
              offline: 'Offline',
              reconnecting: 'Reconnecting',
              typing: 'Typing',
              timeout: 'Timeout',
            },
            messages: { newMessage: 'New' },
            errors: {
              sessionFailed: 'Could not start chat',
              unavailable: 'Chat is not available',
            },
          },
        },
      },
    });
  }
});

beforeEach(() => {
  FakeWebSocket.last = null;
  FakeWebSocket.all = [];
  globalThis.WebSocket = FakeWebSocket as never;
  globalThis.fetch = vi.fn(
    async () =>
      new Response(JSON.stringify({ sessionId: 's1', wsUrl: 'wss://x/ws/y' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  ) as never;
  localStorage.clear();
});

const config: InitConfigPayload = {
  tenantId: 't1',
  apiBase: '/api/v1',
  visitorId: 'v1',
  pageContext: { url: '/x', title: 'X', referrer: '' },
};

describe('Integration — full visitor flow', () => {
  it('PreChat_Submit_OpensChat_AndSendsMessage', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ChatWidget config={config} onUnreadChange={vi.fn()} />
      </I18nextProvider>,
    );

    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@x.com' } });
    fireEvent.click(screen.getByRole('button', { name: /start chat/i }));

    await waitFor(() => expect(screen.getByPlaceholderText(/type/i)).toBeInTheDocument(), {
      timeout: 3000,
    });

    const ta = screen.getByPlaceholderText(/type/i) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'hello' } });
    fireEvent.keyDown(ta, { key: 'Enter' });

    await waitFor(() => expect(screen.getByText('hello')).toBeInTheDocument());
  });

  // Regression (Platform #434): a returning visitor's history comes from the browser cache. The widget used to
  // ask the server for the history of the session it had just created, which is always empty; Platform maps no
  // such GET, so it got a 405 and swallowed it. Had the route existed, the empty answer would have replaced the
  // cached history. The widget now reads only the cache and makes no GET for messages.
  it('KeepsCachedHistory_AndMakesNoHistoryRequest_WhenSessionStarts', async () => {
    localStorage.setItem(
      'verbara-webchat-messages:t1',
      JSON.stringify([
        { id: 'c1', text: 'cached reply', from: 'agent', timestamp: '2026-10-16T10:00:00Z' },
      ]),
    );
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') {
        return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ sessionId: 's1', wsUrl: 'wss://x/ws/y' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    globalThis.fetch = fetchMock as never;

    render(
      <I18nextProvider i18n={i18n}>
        <ChatWidget config={config} onUnreadChange={vi.fn()} />
      </I18nextProvider>,
    );

    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@x.com' } });
    fireEvent.click(screen.getByRole('button', { name: /start chat/i }));

    await waitFor(() => expect(FakeWebSocket.last).not.toBeNull(), { timeout: 3000 });
    // Let any request the session start would trigger settle before asserting.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByText('cached reply')).toBeInTheDocument();
    const methods = fetchMock.mock.calls.map(([, init]) => init?.method ?? 'GET');
    expect(methods).toEqual(['POST']);
  });

  // Regression: the WS onMessage callback is created once (memoized
  // handlePreChatSubmit) and used to read `status`. Reading the captured value
  // left the widget stuck on 'timeout' forever because the closure never saw
  // the current status. statusRef fixes it — an incoming agent message must
  // bring the banner back to 'online'.
  it('RecoversToOnline_WhenAgentMessageArrives_AfterTimeout', async () => {
    vi.useFakeTimers();
    try {
      render(
        <I18nextProvider i18n={i18n}>
          <ChatWidget config={config} onUnreadChange={vi.fn()} />
        </I18nextProvider>,
      );

      fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Jane' } });
      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@x.com' } });

      // Submit pre-chat and flush the async createSession() promise.
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /start chat/i }));
        await vi.advanceTimersByTimeAsync(0);
      });

      // WS opens and Platform confirms it → online.
      const ws = FakeWebSocket.last;
      if (!ws) throw new Error('WebSocket was not created');
      act(() => {
        ws.readyState = 1;
        ws.onopen?.(new Event('open'));
        ws.onmessage?.(new MessageEvent('message', { data: frames.server.connected }));
      });
      expect(screen.getByText('Online')).toBeInTheDocument();

      // 5+ minutes with no agent activity → the inactivity interval flips to timeout.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6 * 60 * 1000);
      });
      expect(screen.getByText('Timeout')).toBeInTheDocument();

      // Incoming agent message must reset the banner to online (the regression).
      await act(async () => {
        ws.onmessage?.(
          new MessageEvent('message', {
            data: frames.server.agentTextReply,
          }),
        );
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByText('Online')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
  // The wire contract with Platform. The frames come verbatim from measurements and from Platform's own test
  // (transport/__fixtures__/ws-frames.json); never edit them to make a test pass.
  describe('Platform WebSocket contract', () => {
    async function startChat(onUnreadChange = vi.fn()) {
      render(
        <I18nextProvider i18n={i18n}>
          <ChatWidget config={config} onUnreadChange={onUnreadChange} />
        </I18nextProvider>,
      );
      fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Jane' } });
      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@x.com' } });
      fireEvent.click(screen.getByRole('button', { name: /start chat/i }));
      await waitFor(() => expect(FakeWebSocket.last).not.toBeNull(), { timeout: 3000 });
      const ws = FakeWebSocket.last;
      if (!ws) throw new Error('WebSocket was not created');
      return ws;
    }

    // Platform accepts the socket, attaches the session and then confirms with `connected`.
    function open(ws: FakeWebSocket) {
      act(() => {
        ws.readyState = 1;
        ws.onopen?.(new Event('open'));
        ws.onmessage?.(new MessageEvent('message', { data: frames.server.connected }));
      });
    }

    function receive(ws: FakeWebSocket, data: string) {
      act(() => {
        ws.onmessage?.(new MessageEvent('message', { data }));
      });
    }

    function sendFromComposer(text: string) {
      const ta = screen.getByPlaceholderText(/type/i) as HTMLTextAreaElement;
      fireEvent.change(ta, { target: { value: text } });
      fireEvent.keyDown(ta, { key: 'Enter' });
    }

    const visitorFrameKeys = Object.keys(JSON.parse(frames.client.visitorMessage) as object).sort();

    // Regression: Platform sends {"type":"message","data":{"blocks":[...]}}; the widget read `body`, so every
    // agent reply rendered as an empty bubble.
    it('RendersAgentReplyText_WhenPlatformSendsMessageFrame', async () => {
      const onUnreadChange = vi.fn();
      const ws = await startChat(onUnreadChange);
      open(ws);

      receive(ws, frames.server.agentTextReply);

      expect(await screen.findByText('agent reply wcl71c00d.c2.1.1.')).toBeInTheDocument();
      expect(onUnreadChange).toHaveBeenCalledWith(1);
    });

    it('RendersImageAndFileBlocks_AsAttachments_WhenAgentSendsMedia', async () => {
      const ws = await startChat();
      open(ws);

      // Shape derived from Platform MessageBlock.cs (ImageBlock / FileBlock), not measured.
      receive(
        ws,
        JSON.stringify({
          type: 'message',
          data: {
            blocks: [
              { $type: 'text', text: 'here you go', type: 0 },
              {
                $type: 'image',
                url: 'https://cdn.example/p.png',
                caption: 'the plan',
                mimeType: 'image/png',
                type: 1,
              },
              {
                $type: 'file',
                url: 'https://cdn.example/r.pdf',
                fileName: 'report.pdf',
                mimeType: 'application/pdf',
                sizeBytes: 10,
                type: 4,
              },
            ],
          },
        }),
      );

      expect(await screen.findByText('here you go')).toBeInTheDocument();
      expect(screen.getByAltText('the plan')).toHaveAttribute('src', 'https://cdn.example/p.png');
      expect(screen.getByText(/report\.pdf/)).toBeInTheDocument();
    });

    it('AddsNoMessage_WhenPlatformConfirmsConnection', async () => {
      const onUnreadChange = vi.fn();
      const ws = await startChat(onUnreadChange);
      open(ws);
      const before = document.querySelectorAll('.rounded-2xl').length;

      receive(ws, frames.server.connected);

      expect(document.querySelectorAll('.rounded-2xl')).toHaveLength(before);
      expect(onUnreadChange).not.toHaveBeenCalled();
    });

    // Regression (#430): the widget sent {type:'message', body}; Platform reads WebChatClientMessage(Type, Text),
    // so the text arrived null and Platform dropped the message.
    it('SendsTextFrame_WhenVisitorSendsMessage', async () => {
      const ws = await startChat();
      open(ws);

      sendFromComposer('hola por socket');

      expect(ws.sent).toHaveLength(1);
      const sent = JSON.parse(ws.sent[0] ?? '{}') as Record<string, unknown>;
      expect(Object.keys(sent).sort()).toEqual(visitorFrameKeys);
      expect(ws.sent[0]).toBe(frames.client.visitorMessage);
    });

    it('SendsTextFrame_WhenOfflineQueueDrainsOnOpen', async () => {
      const ws = await startChat();
      sendFromComposer('hola por socket');
      expect(ws.sent).toHaveLength(0);

      open(ws);

      expect(ws.sent).toEqual([frames.client.visitorMessage]);
    });
  });
});

// #426: the widget created a session and a socket only when the pre-chat form was submitted. A visitor the site
// identifies (config.visitor), or one returning on a later page, skips the form, so they never got a session and
// every message waited in the offline queue forever. The widget now starts or resumes the session on mount.
describe('Session start and resume (#426)', () => {
  const identified: InitConfigPayload = {
    ...config,
    visitor: { name: 'Jane', email: 'jane@x.com' },
  };
  const SESSION_KEY = 'verbara-webchat-session:t1';

  function sessionPosts(): number {
    const calls = (globalThis.fetch as unknown as { mock: { calls: [unknown, RequestInit?][] } })
      .mock.calls;
    return calls.filter(([, init]) => init?.method === 'POST').length;
  }

  function mount(cfg: InitConfigPayload = identified) {
    return render(
      <I18nextProvider i18n={i18n}>
        <ChatWidget config={cfg} onUnreadChange={vi.fn()} />
      </I18nextProvider>,
    );
  }

  function storeSession(overrides: Record<string, unknown> = {}) {
    const now = Date.now();
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        sessionId: 'old',
        wsUrl: 'wss://x/ws/webchat/old',
        visitorId: 'v1',
        createdAt: now - 60_000,
        lastActiveAt: now - 60_000,
        ...overrides,
      }),
    );
  }

  // Platform accepts the socket, attaches the session and then confirms with `connected`.
  function open(ws: FakeWebSocket) {
    act(() => {
      ws.readyState = 1;
      ws.onopen?.(new Event('open'));
      ws.onmessage?.(new MessageEvent('message', { data: frames.server.connected }));
    });
  }

  function failToOpen(ws: FakeWebSocket) {
    act(() => {
      ws.readyState = 3;
      ws.onclose?.(new CloseEvent('close', { code: 1006 }));
    });
  }

  function sendFromComposer(text: string) {
    const ta = screen.getByPlaceholderText(/type/i) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: text } });
    fireEvent.keyDown(ta, { key: 'Enter' });
  }

  async function settle() {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('StartsOneSessionAndSendsQueuedText_WhenSiteIdentifiesVisitor', async () => {
    mount();

    await waitFor(() => expect(FakeWebSocket.all).toHaveLength(1));
    await settle();
    expect(sessionPosts()).toBe(1);
    expect(screen.queryByLabelText(/your name/i)).not.toBeInTheDocument();

    sendFromComposer('hola por socket');
    const ws = FakeWebSocket.all[0]!;
    expect(ws.sent).toHaveLength(0);
    open(ws);

    expect(ws.sent).toEqual([frames.client.visitorMessage]);
    expect(FakeWebSocket.all).toHaveLength(1);
  });

  it('ResumesStoredSession_WithoutCreatingOne_WhenReloadedWithinTimeout', async () => {
    const first = mount();
    await waitFor(() => expect(FakeWebSocket.all).toHaveLength(1));
    open(FakeWebSocket.all[0]!);
    first.unmount();

    mount();
    await waitFor(() => expect(FakeWebSocket.all).toHaveLength(2));
    await settle();

    expect(sessionPosts()).toBe(1);
    expect(FakeWebSocket.all[1]!.url).toBe('wss://x/ws/y');
  });

  it('ResumesStoredSession_AndDrainsQueueInOrder_WhenSocketReattaches', async () => {
    storeSession();
    localStorage.setItem(
      'verbara-webchat-queue:t1',
      JSON.stringify([
        { id: 'q1', text: 'first', timestamp: '2026-10-17T10:00:00Z' },
        { id: 'q2', text: 'second', timestamp: '2026-10-17T10:00:01Z' },
      ]),
    );
    mount();

    await waitFor(() => expect(FakeWebSocket.all).toHaveLength(1));
    const ws = FakeWebSocket.all[0]!;
    expect(ws.url).toBe('wss://x/ws/webchat/old');
    open(ws);
    await settle();

    expect(sessionPosts()).toBe(0);
    expect(ws.sent).toEqual([
      JSON.stringify({ type: 'message', text: 'first' }),
      JSON.stringify({ type: 'message', text: 'second' }),
    ]);
  });

  // Platform's timeout counts from the last activity (socket attach, visitor message), so the widget's does too.
  it('RecordsActivity_WhenSocketOpensAndWhenVisitorSends', async () => {
    const before = Date.now() - 60_000;
    storeSession({ lastActiveAt: before });
    mount();
    await waitFor(() => expect(FakeWebSocket.all).toHaveLength(1));
    const lastActive = () =>
      (JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') as { lastActiveAt: number })
        .lastActiveAt;

    open(FakeWebSocket.all[0]!);
    expect(lastActive()).toBeGreaterThan(before);

    storeSession({ lastActiveAt: before });
    sendFromComposer('still here');
    expect(lastActive()).toBeGreaterThan(before);
  });

  // Another tab may have replaced the stored session; this tab's messages are not activity on that one.
  it('LeavesOtherSessionIdle_WhenVisitorSendsOnOwnSocket', async () => {
    const before = Date.now() - 60_000;
    storeSession();
    mount();
    await waitFor(() => expect(FakeWebSocket.all).toHaveLength(1));
    open(FakeWebSocket.all[0]!);

    storeSession({ sessionId: 'other', lastActiveAt: before });
    sendFromComposer('from this tab');

    expect(JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}')).toMatchObject({
      sessionId: 'other',
      lastActiveAt: before,
    });
  });

  it('KeepsSession_WhenSocketReopensBetweenDrops', async () => {
    vi.useFakeTimers();
    storeSession();
    mount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    async function dropAndRetry(times: number) {
      for (let i = 0; i < times; i++) {
        failToOpen(FakeWebSocket.last!);
        await act(async () => {
          await vi.advanceTimersByTimeAsync(60_000);
        });
      }
    }

    open(FakeWebSocket.last!);
    await dropAndRetry(MAX_ATTACH_ATTEMPTS - 1);
    open(FakeWebSocket.last!);
    await dropAndRetry(MAX_ATTACH_ATTEMPTS - 1);

    expect(sessionPosts()).toBe(0);
    expect(FakeWebSocket.all.every((ws) => ws.url === 'wss://x/ws/webchat/old')).toBe(true);
  });

  it('ForgetsDeadSession_WhenNewSessionCannotStartYet', async () => {
    storeSession();
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 429 })) as never;
    mount();
    await waitFor(() => expect(FakeWebSocket.all).toHaveLength(1));

    act(() => {
      const ws = FakeWebSocket.all[0]!;
      ws.readyState = 3;
      ws.onclose?.(new CloseEvent('close', { code: 1008, reason: 'Session expired' }));
    });
    await waitFor(() => expect(sessionPosts()).toBe(1));

    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('ShowsGreeting_OnlyWhenSessionIsNew', async () => {
    storeSession();
    const greeted = { ...identified, greeting: 'Hi there' };
    const first = mount(greeted);
    await waitFor(() => expect(FakeWebSocket.all).toHaveLength(1));
    await settle();
    expect(screen.queryByText('Hi there')).not.toBeInTheDocument();
    first.unmount();

    localStorage.clear();
    mount(greeted);
    expect(await screen.findByText('Hi there')).toBeInTheDocument();
  });

  it('CreatesSession_WhenStoredSessionIsOlderThanTimeout', async () => {
    const now = Date.now();
    storeSession({
      createdAt: now - SESSION_TIMEOUT_MS - 120_000,
      lastActiveAt: now - SESSION_TIMEOUT_MS - 1,
    });
    mount();

    await waitFor(() => expect(FakeWebSocket.all).toHaveLength(1));
    await settle();

    expect(sessionPosts()).toBe(1);
    expect(FakeWebSocket.all[0]!.url).toBe('wss://x/ws/y');
  });

  // destroy() in the SDK resets the visitor id, so a session stored for the previous id is not resumed.
  it('CreatesSession_WhenStoredSessionBelongsToAnotherVisitor', async () => {
    storeSession({ visitorId: 'someone-else' });
    mount();

    await waitFor(() => expect(FakeWebSocket.all).toHaveLength(1));
    await settle();

    expect(sessionPosts()).toBe(1);
    expect(FakeWebSocket.all[0]!.url).toBe('wss://x/ws/y');
  });

  it('CreatesSession_WhenPlatformClosesStoredSessionAsExpired', async () => {
    storeSession();
    mount();
    await waitFor(() => expect(FakeWebSocket.all).toHaveLength(1));
    const stale = FakeWebSocket.all[0]!;

    act(() => {
      stale.readyState = 3;
      stale.onclose?.(new CloseEvent('close', { code: 1008, reason: 'Session expired' }));
    });

    await waitFor(() => expect(FakeWebSocket.all).toHaveLength(2));
    await settle();
    expect(sessionPosts()).toBe(1);
    expect(FakeWebSocket.all[1]!.url).toBe('wss://x/ws/y');
    expect(JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}')).toMatchObject({
      sessionId: 's1',
    });
  });

  // Platform accepts the upgrade before it attaches the session, so the browser sees the socket open and then
  // the "Session expired" close, never `connected`. What was queued must reach the new session, not the dead one.
  it('SendsQueuedTextToNewSession_WhenExpiredSocketOpensBeforeClosing', async () => {
    storeSession();
    localStorage.setItem(
      'verbara-webchat-queue:t1',
      JSON.stringify([{ id: 'q1', text: 'pending', timestamp: '2026-10-17T10:00:00Z' }]),
    );
    mount();
    await waitFor(() => expect(FakeWebSocket.all).toHaveLength(1));
    const stale = FakeWebSocket.all[0]!;

    act(() => {
      stale.readyState = 1;
      stale.onopen?.(new Event('open'));
    });
    expect(screen.queryByText('Online')).not.toBeInTheDocument();
    act(() => {
      stale.readyState = 3;
      stale.onclose?.(new CloseEvent('close', { code: 1008, reason: 'Session expired' }));
    });

    await waitFor(() => expect(FakeWebSocket.all).toHaveLength(2));
    const fresh = FakeWebSocket.all[1]!;
    open(fresh);

    expect(stale.sent).toEqual([]);
    expect(fresh.sent).toEqual([JSON.stringify({ type: 'message', text: 'pending' })]);
  });

  it('CreatesSessionAfterBoundedAttempts_WhenStoredSessionSocketNeverOpens', async () => {
    vi.useFakeTimers();
    storeSession();
    mount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Platform refuses an unknown session before the upgrade; the page only sees the socket close unopened.
    for (let i = 0; i < 20; i++) {
      const ws = FakeWebSocket.last;
      if (!ws || ws.url !== 'wss://x/ws/webchat/old') break;
      failToOpen(ws);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
    }

    const toStale = FakeWebSocket.all.filter((ws) => ws.url === 'wss://x/ws/webchat/old');
    expect(toStale).toHaveLength(MAX_ATTACH_ATTEMPTS);
    expect(sessionPosts()).toBe(1);
    expect(FakeWebSocket.last?.url).toBe('wss://x/ws/y');
  });

  it('ShowsErrorAndRetries_WhenSessionCreateIsRateLimited', async () => {
    vi.useFakeTimers();
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls++;
      if (calls === 1) return new Response('{}', { status: 429, headers: { 'Retry-After': '1' } });
      return new Response(JSON.stringify({ sessionId: 's1', wsUrl: 'wss://x/ws/y' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as never;

    mount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText('Could not start chat')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/type/i)).not.toBeDisabled();
    expect(FakeWebSocket.all).toHaveLength(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(sessionPosts()).toBe(2);
    expect(FakeWebSocket.all).toHaveLength(1);
    expect(screen.getByText('Connecting')).toBeInTheDocument();
  });

  // Platform answers 404 when the tenant has no active WebChat channel: no later try can succeed in this page load.
  it('ShowsUnavailableAndStopsTrying_WhenTenantHasNoActiveWebChat', async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn(async () => new Response('', { status: 404 })) as never;

    mount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText('Chat is not available')).toBeInTheDocument();
    expect(screen.queryByText('Could not start chat')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/type/i)).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6 * 60_000);
    });

    expect(sessionPosts()).toBe(1);
    expect(FakeWebSocket.all).toHaveLength(0);
    // The idle timer does not replace the terminal state (nor re-enable the composer).
    expect(screen.getByText('Chat is not available')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/type/i)).toBeDisabled();
  });

  // The host page can post init-config again (a new config object restarts the session effect).
  it('StaysUnavailable_WhenHostPostsConfigAgain', async () => {
    globalThis.fetch = vi.fn(async () => new Response('', { status: 404 })) as never;

    const { rerender } = mount();
    await settle();
    expect(screen.getByText('Chat is not available')).toBeInTheDocument();

    rerender(
      <I18nextProvider i18n={i18n}>
        <ChatWidget config={{ ...identified }} onUnreadChange={vi.fn()} />
      </I18nextProvider>,
    );
    await settle();

    expect(sessionPosts()).toBe(1);
    expect(screen.getByText('Chat is not available')).toBeInTheDocument();
  });

  it('DropsQueuedText_WhenChatTurnsOutUnavailable', async () => {
    let answer: (r: Response) => void = () => {};
    globalThis.fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    ) as never;

    mount();
    await settle();
    sendFromComposer('hola');
    expect(localStorage.getItem('verbara-webchat-queue:t1')).not.toBeNull();

    await act(async () => {
      answer(new Response('', { status: 404 }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByText('Chat is not available')).toBeInTheDocument();
    expect(localStorage.getItem('verbara-webchat-queue:t1')).toBeNull();
    expect(sessionPosts()).toBe(1);
  });

  it('StartsOneSession_WhenStrictModeRunsEffectsTwice', async () => {
    render(
      <StrictMode>
        <I18nextProvider i18n={i18n}>
          <ChatWidget config={identified} onUnreadChange={vi.fn()} />
        </I18nextProvider>
      </StrictMode>,
    );

    await waitFor(() => expect(FakeWebSocket.all.length).toBeGreaterThan(0));
    await settle();

    expect(sessionPosts()).toBe(1);
    expect(FakeWebSocket.all).toHaveLength(1);
  });

  it('ResumesWithOneLiveSocket_WhenStrictModeRunsEffectsTwice', async () => {
    storeSession();
    render(
      <StrictMode>
        <I18nextProvider i18n={i18n}>
          <ChatWidget config={identified} onUnreadChange={vi.fn()} />
        </I18nextProvider>
      </StrictMode>,
    );

    await waitFor(() => expect(FakeWebSocket.all.length).toBeGreaterThan(0));
    await settle();

    expect(sessionPosts()).toBe(0);
    expect(FakeWebSocket.all).toHaveLength(1);
    expect(FakeWebSocket.all[0]!.readyState).not.toBe(3);
  });

  it('OpensNoSocket_WhenClosedBeforeSessionIsCreated', async () => {
    let answer: (r: Response) => void = () => {};
    globalThis.fetch = vi.fn(() => new Promise<Response>((resolve) => (answer = resolve))) as never;
    const view = mount();
    await waitFor(() => expect(sessionPosts()).toBe(1));

    view.unmount();
    answer(
      new Response(JSON.stringify({ sessionId: 's1', wsUrl: 'wss://x/ws/y' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await settle();

    expect(FakeWebSocket.all).toHaveLength(0);
  });

  it('ShowsOnline_OnlyAfterSocketOpens', async () => {
    mount();
    await waitFor(() => expect(FakeWebSocket.all).toHaveLength(1));
    await settle();

    expect(screen.getByText('Connecting')).toBeInTheDocument();
    expect(screen.queryByText('Online')).not.toBeInTheDocument();

    open(FakeWebSocket.all[0]!);

    expect(screen.getByText('Online')).toBeInTheDocument();
  });
});

// #426: the widget runs on a site of another domain. Its requests and its socket stay on the origin that served the
// frame, whatever apiBase the host page passes, and the socket Platform names by path opens on that origin too.
describe('Integration — embedded on a site of another domain', () => {
  it('CreatesTheSessionAndOpensTheSocket_OnTheEmbedOrigin', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ sessionId: 's1', wsUrl: '/ws/webchat/s1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    globalThis.fetch = fetchMock as never;

    render(
      <I18nextProvider i18n={i18n}>
        <ChatWidget
          config={{
            ...config,
            apiBase: 'https://shop.example.com/api/v1',
            visitor: { name: 'Jane', email: 'jane@x.com' },
          }}
          onUnreadChange={vi.fn()}
        />
      </I18nextProvider>,
    );

    await waitFor(() => expect(FakeWebSocket.last).not.toBeNull(), { timeout: 3000 });
    const own = window.location.origin;
    expect(String(fetchMock.mock.calls[0]![0])).toBe(`${own}/api/v1/webchat/sessions`);
    expect(FakeWebSocket.last!.url).toBe(`${own.replace(/^http/, 'ws')}/ws/webchat/s1`);
  });
});
