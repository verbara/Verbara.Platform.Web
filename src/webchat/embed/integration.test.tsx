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

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import { ChatWidget, type InitConfigPayload } from './chat-widget';

class FakeWebSocket {
  static last: FakeWebSocket | null = null;
  readyState = 0;
  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  sent: string[] = [];
  constructor() {
    FakeWebSocket.last = this;
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
          },
        },
      },
    });
  }
});

beforeEach(() => {
  FakeWebSocket.last = null;
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

      // WS opens → online.
      const ws = FakeWebSocket.last;
      if (!ws) throw new Error('WebSocket was not created');
      act(() => {
        ws.readyState = 1;
        ws.onopen?.(new Event('open'));
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
            data: JSON.stringify({ type: 'message', body: 'hi', id: 'm1' }),
          }),
        );
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByText('Online')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
