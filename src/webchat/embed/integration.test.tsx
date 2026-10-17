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
import frames from './transport/__fixtures__/ws-frames.json';

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

    function open(ws: FakeWebSocket) {
      act(() => {
        ws.readyState = 1;
        ws.onopen?.(new Event('open'));
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
