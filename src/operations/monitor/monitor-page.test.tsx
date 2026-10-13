/**
 * The voice monitor keys a silent listen by the row's `conversationId` (design D3; spec
 * `supervisor-listen-console`, "keyed by the call's conversation id"), keeps the Agent Assist
 * transcript subscription exactly as before, and reads the current listen when it opens. Real hooks
 * and `customFetch`, msw answering the host's fixture bodies.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18next from 'i18next';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/core/auth/auth-store';
import { useListenStore } from '@/core/voice/listen-store';
import enOperations from '../../../public/locales/en-US/operations.json';
import enCommon from '../../../public/locales/en-US/common.json';

vi.mock('@/core/ui/virtual-list', () => ({
  VirtualList: <T,>({
    items,
    renderItem,
  }: {
    items: readonly T[];
    renderItem: (item: T, i: number) => ReactNode;
  }) => (
    <div>
      {items.map((item, i) => (
        <div key={i}>{renderItem(item, i)}</div>
      ))}
    </div>
  ),
}));
vi.mock('@/core/realtime', () => ({ useSupervisorActions: () => ({ whisper: vi.fn() }) }));
vi.mock('@/core/hooks/use-config', () => ({
  getConfig: () => ({ asteriskWssUrl: 'wss://pbx.example:8089/ws' }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import MonitorPage from './monitor-page';

type Entry = { status: number; body: Record<string, unknown> };
const readJson = <T,>(name: string) =>
  JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures/contracts', name), 'utf-8')) as T;
const sessionsFx = readJson<{ body: Record<string, unknown>[] }>('active-session.v1.json');
const startFx = readJson<{ start: Entry; current: Entry }>('supervisor-listen-start.v1.json');
const refusals = readJson<Record<string, Entry>>('supervisor-listen-refusals.json');

const CONV = '4f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a';
const SESSION = '1712345678.42';
const UNTRACKED = '1712345699.07';
const MONITOR = 'contacts:conversation:monitor';

/** Every request the page sent, as `METHOD path`, plus the bodies of listen starts. */
let requests: string[];
let startBodies: unknown[];
let current: Entry;

const server = setupServer(
  http.get('*/api/v1/supervisor/sessions/active', () =>
    HttpResponse.json(
      sessionsFx.body.map((s) => ({ ...s, agentName: `Agent ${String(s.sessionId)}` })),
    ),
  ),
  http.post(
    '*/api/v1/supervisor/sessions/:sessionId/listen',
    () => new HttpResponse(null, { status: 204 }),
  ),
  http.get('*/api/v1/supervisor/listen', () =>
    HttpResponse.json(current.body, { status: current.status }),
  ),
  http.post('*/api/v1/supervisor/conversations/:id/listen', async ({ request }) => {
    startBodies.push(await request.json());
    return HttpResponse.json({ ...startFx.start.body, destination: 'phone' });
  }),
);

beforeAll(() => {
  // jsdom has no layout: the transcript's auto-scroll is a no-op here.
  Element.prototype.scrollIntoView = vi.fn();
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  requests = [];
  startBodies = [];
  current = refusals.listenNotFound;
  server.events.removeAllListeners();
  server.events.on('request:start', ({ request }) => {
    requests.push(`${request.method} ${new URL(request.url).pathname}`);
  });
  useListenStore.getState().reset();
  useAuthStore.getState().logout();
  useAuthStore
    .getState()
    .setAuth(
      'T',
      Date.now() + 60_000,
      { id: 'sup-1', email: 's@b.com', displayName: 'Sup', role: 'supervisor' },
      'acme',
      [MONITOR],
      {},
    );
});

async function renderPage() {
  const i18n = i18next.createInstance();
  await i18n.init({
    lng: 'en-US',
    fallbackLng: false,
    resources: { 'en-US': { operations: enOperations, common: enCommon } },
    ns: ['operations', 'common'],
    defaultNS: 'operations',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <MonitorPage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

async function selectSession(sessionId: string) {
  const cards = await screen.findAllByTestId('session-card');
  const card = cards.find((c) => c.getAttribute('data-session-id') === sessionId);
  if (!card) throw new Error(`no card for ${sessionId}`);
  fireEvent.click(card);
  return screen.findByTestId('listen-control');
}

describe('MonitorPage — silent listen', () => {
  it('MonitorPage_ShouldStillSubscribeToTheTranscriptAndCallNoListenRoute_WhenASessionIsSelected', async () => {
    await renderPage();
    const control = await selectSession(SESSION);
    await waitFor(() =>
      expect(requests).toContain(`POST /api/v1/supervisor/sessions/${SESSION}/listen`),
    );
    expect(control).toHaveAttribute('data-listen-state', 'idle');
    expect(requests.filter((r) => r.includes('/supervisor/conversations/'))).toEqual([]);
    expect(screen.getByText(enOperations.monitor.live_transcript)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /supervise/i })).toBeNull();
  });

  it('MonitorPage_ShouldPostTheListenToTheRowsConversationIdNeverTheSessionId_WhenListenIsChosen', async () => {
    await renderPage();
    const control = await selectSession(SESSION);
    fireEvent.click(within(control).getByTestId('listen-start'));
    fireEvent.click(await screen.findByTestId('listen-destination-phone'));
    await waitFor(() => expect(startBodies).toEqual([{ destination: 'phone' }]));
    const listenPosts = requests.filter((r) =>
      r.startsWith('POST /api/v1/supervisor/conversations/'),
    );
    expect(listenPosts).toEqual([`POST /api/v1/supervisor/conversations/${CONV}/listen`]);
    expect(listenPosts.join(' ')).not.toContain(SESSION);
    await waitFor(() => expect(control).toHaveAttribute('data-listen-state', 'dialing'));
    expect(within(control).getByTestId('listen-answer-phone')).toBeInTheDocument();
  });

  it('MonitorPage_ShouldDisableListenWithItsReason_WhenTheRowsConversationIdIsNull', async () => {
    await renderPage();
    const control = await selectSession(UNTRACKED);
    expect(within(control).getByTestId('listen-start')).toBeDisabled();
    expect(within(control).getByTestId('listen-no-conversation')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(within(control).getByTestId('listen-start'));
    });
    expect(requests.filter((r) => r.includes('/supervisor/conversations/'))).toEqual([]);
  });

  it('MonitorPage_ShouldShowAListenStartedElsewhere_WhenTheMonitorOpens', async () => {
    current = startFx.current;
    await renderPage();
    const bar = await screen.findByTestId('listen-active');
    expect(bar).toHaveAttribute('data-listen-state', 'listening');
    expect(bar).toHaveAttribute('data-listen-conversation', CONV);
    expect(requests).toContain('GET /api/v1/supervisor/listen');
  });
});
