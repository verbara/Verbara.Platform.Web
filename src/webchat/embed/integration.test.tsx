import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
});
