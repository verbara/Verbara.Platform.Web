/**
 * The voice Monitor's whisper input posts the REST route keyed by the Agent Assist `sessionId`
 * (change `supervisor-whisper-reaches-the-agent`, design D1/D3; spec `supervisor-whisper-console`).
 * Real `useSendWhisper` and `customFetch`, msw answering the host's statuses (fixture
 * `supervisor-whisper.v1.json`), and the real hub over the in-memory SignalR transport, so the test
 * can prove a whisper never touches the hub.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { i18n as I18n } from 'i18next';
import type { ReactElement, ReactNode } from 'react';
import { toast } from 'sonner';
import { createLocaleI18n } from '@/test/locale-i18n';
import { useAuthStore } from '@/core/auth/auth-store';

vi.mock('@microsoft/signalr', async (importOriginal) => {
  const { withInMemoryTransport } = await import('@/test/signalr-harness');
  return withInMemoryTransport(await importOriginal<typeof import('@microsoft/signalr')>());
});
vi.mock('@/core/hooks/use-config', () => ({
  getConfig: () => ({ asteriskWssUrl: 'wss://pbx.example:8089/ws' }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { hubServer } from '@/test/signalr-harness';
import { startPlatformHub, stopPlatformHub } from '@/core/realtime/platform-hub';
import { SessionDetail } from './session-detail';

const SESSION = 'as-5c4b3a29';
const WHISPER_PATH = `/api/v1/supervisor/sessions/${SESSION}/whisper`;
const SUPERVISOR = {
  id: 'sup-1',
  email: 's@b.com',
  displayName: 'Sup',
  role: 'supervisor',
} as const;

/** Every request the page sent, as `METHOD path`, and the whisper bodies. */
let requests: string[];
let bodies: unknown[];
let whisperStatus: number;

const server = setupServer(
  http.post(`*${WHISPER_PATH}`, async ({ request }) => {
    bodies.push(await request.json());
    return whisperStatus === 409
      ? HttpResponse.json({ error: 'whisper-session-not-bound' }, { status: 409 })
      : new HttpResponse(null, { status: whisperStatus });
  }),
  http.post('*/api/v1/auth/refresh', () => new HttpResponse(null, { status: 401 })),
);

beforeAll(() => {
  // jsdom has no layout: the transcript's auto-scroll is a no-op here.
  Element.prototype.scrollIntoView = vi.fn();
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  hubServer.reset();
  requests = [];
  bodies = [];
  whisperStatus = 204;
  server.events.removeAllListeners();
  server.events.on('request:start', ({ request }) => {
    requests.push(`${request.method} ${new URL(request.url).pathname}`);
  });
  useAuthStore.getState().logout();
  // A valid token: `customFetch` has no reason to refresh it, so a refresh would be the whisper's.
  useAuthStore.getState().setAuth('T1', Date.now() + 15 * 60_000, SUPERVISOR, 'acme', [], {
    realtimePushSignalR: true,
  });
});

afterEach(async () => {
  await stopPlatformHub().catch(() => undefined);
  hubServer.reset();
  useAuthStore.getState().logout();
});

async function renderDetail(): Promise<I18n> {
  const i18n = await createLocaleI18n('en-US');
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>
        <SessionDetail sessionId={SESSION} conversationId={null} />
      </QueryClientProvider>
    </I18nextProvider>,
  );
  return i18n;
}

const input = () => screen.getByTestId<HTMLTextAreaElement>('monitor-whisper-input');
const sendButton = () => screen.getByTestId('monitor-whisper-send');

function renderedToast(kind: 'success' | 'error'): HTMLElement {
  const content = vi.mocked(toast[kind]).mock.calls.at(-1)?.[0] as ReactElement | ReactNode;
  const { container } = render(<div>{content}</div>);
  return container;
}

/** Lets every pending microtask and zero-delay timer run (the hub harness never waits on a clock). */
async function settle(turns = 10): Promise<void> {
  for (let i = 0; i < turns; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

describe('SessionDetail — whisper', () => {
  it('Whisper_ShouldPostTheTrimmedTextToTheSessionRoute_WhenSent', async () => {
    await renderDetail();

    fireEvent.change(input(), { target: { value: '  Offer the retention discount now. ' } });
    fireEvent.click(sendButton());

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ text: 'Offer the retention discount now.' });
    expect(requests).toEqual([`POST ${WHISPER_PATH}`]);
  });

  it('Whisper_ShouldSendNothing_WhenTheTextIsBlank', async () => {
    await renderDetail();

    fireEvent.change(input(), { target: { value: '   ' } });
    expect(sendButton()).toBeDisabled();
    fireEvent.keyDown(input(), { key: 'Enter' });
    await settle();

    expect(requests).toEqual([]);
  });

  it('Whisper_ShouldKeep500Characters_When501ArePasted', async () => {
    await renderDetail();

    expect(input()).toHaveAttribute('maxLength', '500');
    fireEvent.change(input(), { target: { value: 'x'.repeat(501) } });

    expect(input().value).toHaveLength(500);
  });

  it('Whisper_ShouldClearTheInputAndToastSent_WhenTheHostAnswers204WithNoBody', async () => {
    const i18n = await renderDetail();

    fireEvent.change(input(), { target: { value: 'hold on' } });
    fireEvent.click(sendButton());

    await waitFor(() => expect(input().value).toBe(''));
    const shown = renderedToast('success').querySelector('[data-toast="whisper-sent"]');
    expect(shown?.textContent).toBe(i18n.t('toasts.supervisor.whisperSent'));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('Whisper_ShouldKeepTheTextAndShowNotBound_WhenTheHostAnswers409', async () => {
    whisperStatus = 409;
    const i18n = await renderDetail();

    fireEvent.change(input(), { target: { value: 'hold on' } });
    fireEvent.click(sendButton());

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(input().value).toBe('hold on');
    const el = renderedToast('error').querySelector(
      '[data-error-code="whisper-session-not-bound"]',
    );
    expect(el?.textContent).toBe(
      i18n.t('common:errors.supervisor_whisper.whisper_session_not_bound'),
    );
    expect(toast.success).not.toHaveBeenCalled();
    await waitFor(() => expect(sendButton()).toBeEnabled());
  });

  it('Whisper_ShouldPostWithoutStartingTheHubOrRefreshing_WhenTheHubIsDisconnected', async () => {
    await startPlatformHub();
    await stopPlatformHub();
    await settle();
    await renderDetail();

    fireEvent.change(input(), { target: { value: 'hold on' } });
    await act(async () => {
      fireEvent.click(sendButton());
      await settle();
    });

    await waitFor(() => expect(input().value).toBe(''));
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
    // No hub start after the stop (still the one negotiate from the start), no hub method invoked
    // (WhisperToAgentAsync included), and no token refresh.
    expect(hubServer.bearers).toEqual(['T1']);
    expect(hubServer.invocations).toHaveLength(0);
    expect(hubServer.invocations.map((i) => i.target)).not.toContain('WhisperToAgentAsync');
    expect(requests).toEqual([`POST ${WHISPER_PATH}`]);
    expect(requests).not.toContain('POST /api/v1/auth/refresh');
  });

  it('Whisper_ShouldInvokeNoHubMethod_WhenTheHubIsConnected', async () => {
    await startPlatformHub();
    await settle();
    await renderDetail();

    fireEvent.change(input(), { target: { value: 'hold on' } });
    fireEvent.click(sendButton());

    await waitFor(() => expect(input().value).toBe(''));
    expect(hubServer.invocations.map((i) => i.target)).not.toContain('WhisperToAgentAsync');
    expect(hubServer.invocations).toHaveLength(0);
  });
});
