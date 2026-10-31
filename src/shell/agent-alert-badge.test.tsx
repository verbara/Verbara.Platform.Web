/**
 * The rail badge counts agent alerts on every route (spec `console-domain-boundary`, "The agent alert
 * badge keeps counting outside the agent console"; design D5). The event goes through the real
 * `useSSE` handler, a fake `EventSource` delivering it by name, and the count is read from the real
 * rail. `['agent-me']` is never seeded: the identity reaches the cache through `GET /api/v1/agents/me`
 * on a `fetch` stub, on a client built with the app's own query defaults, whose `gcTime` is the
 * library's 5 minutes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { queryClient as appQueryClient } from '@/core/api/query-client';
import { useAgentMe } from '@/core/api/hooks/use-agents';
import { useAuthStore } from '@/core/auth/auth-store';
import { useSSE } from '@/core/hooks/use-sse';
import { useAgentAlertsStore } from '@/core/stores/agent-alerts-store';
import { Rail } from './rail';

// Stable `t`: it is a dependency of the hook's `connect`, so an identity that changed on every
// render would reopen the stream on every render.
const t = (key: string) => key;
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), error: vi.fn(), warning: vi.fn(), success: vi.fn() },
}));

// The rail's corners run their own queries and have nothing to do with the badge.
vi.mock('./notification-bell', () => ({ NotificationBell: () => null }));
vi.mock('./user-menu', () => ({ UserMenu: () => null }));

const AGENT_PERMISSION = 'contacts:conversation:handle';
const AGENT_ME_PATH = '/api/v1/agents/me';
const AGENT_ID = 'agent-40ccd6';
const FIFTEEN_MINUTES = 15 * 60_000;
const PAST_THE_CACHE_COLLECTION_TIME = 5 * 60_000 + 1_000;

/** A fake `EventSource` that keeps its listeners so a test can deliver an event by name. */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onopen: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  private readonly listeners = new Map<string, ((e: MessageEvent) => void)[]>();

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (e: MessageEvent) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close(): void {}

  emit(type: string, payload: unknown): void {
    const event = new MessageEvent(type, { data: JSON.stringify(payload) });
    this.listeners.get(type)?.forEach((l) => l(event));
  }
}

const fetchMock = vi.fn<typeof fetch>();

function answerAgentMeWith(status: number, body: unknown) {
  fetchMock.mockImplementation(async (input) =>
    new URL(String(input)).pathname === AGENT_ME_PATH
      ? new Response(JSON.stringify(body), { status })
      : new Response(null, { status: 404 }),
  );
}

const agentMeRequests = () =>
  fetchMock.mock.calls.filter(([input]) => new URL(String(input)).pathname === AGENT_ME_PATH);

function signIn(permissions: string[]) {
  useAuthStore
    .getState()
    .setAuth(
      'token-1',
      Date.now() + FIFTEEN_MINUTES,
      { id: 'user-1', email: 'a@b.com', displayName: 'Test', role: 'agent' },
      'tenant-1',
      permissions,
      {},
    );
}

/** The runtime as `AppShell` mounts it: `useSSE` on every route, beside the real rail. */
function Runtime() {
  useSSE();
  return <Rail />;
}

/** What `/agent` contributes to the cache: an observer that lives only while the route does. */
function AgentRouteObserver() {
  useAgentMe();
  return null;
}

function Console({ onAgentRoute = false }: { onAgentRoute?: boolean }) {
  return (
    <>
      <Runtime />
      {onAgentRoute && <AgentRouteObserver />}
    </>
  );
}

function mountConsole(client: QueryClient, onAgentRoute = false) {
  const ui = (agentRoute: boolean) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Console onAgentRoute={agentRoute} />
      </MemoryRouter>
    </QueryClientProvider>
  );
  const view = render(ui(onAgentRoute));
  return { leaveAgentRoute: () => view.rerender(ui(false)) };
}

/** Lets the pending request, its retry and its render finish under the fake clock. */
async function settle(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function deliverAgentAlert() {
  const source = FakeEventSource.instances.at(-1);
  if (!source) throw new Error('no EventSource was opened');
  act(() =>
    source.emit('conversation.assigned', {
      conversationId: 'conv-1',
      agentId: AGENT_ID,
      contactName: 'Ana',
    }),
  );
}

describe('the rail badge outside the agent console', () => {
  let client: QueryClient;

  beforeEach(() => {
    vi.useFakeTimers();
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    useAgentAlertsStore.getState().reset();
    window.history.pushState({}, '', '/operations');
    client = new QueryClient({ defaultOptions: appQueryClient.getDefaultOptions() });
  });

  afterEach(() => {
    cleanup();
    client.clear();
    useAuthStore.getState().logout();
    window.history.pushState({}, '', '/');
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('Rail_ShouldCountTheAlert_WhenTheSessionStartsOnOperationsWithAnEmptyCache', async () => {
    answerAgentMeWith(200, { agentId: AGENT_ID, state: 'Available' });
    signIn([AGENT_PERMISSION]);

    mountConsole(client);
    await settle();
    deliverAgentAlert();

    expect(screen.getByTestId('agent-rail-badge')).toHaveTextContent('1');
    expect(agentMeRequests()).toHaveLength(1);
  });

  it('Rail_ShouldCountTheAlert_WhenTheAgentLeftAgentPastTheCacheCollectionTime', async () => {
    answerAgentMeWith(200, { agentId: AGENT_ID, state: 'Available' });
    signIn([AGENT_PERMISSION]);

    const { leaveAgentRoute } = mountConsole(client, true);
    await settle();
    expect(screen.queryByTestId('agent-rail-badge')).not.toBeInTheDocument();

    leaveAgentRoute();
    await settle(PAST_THE_CACHE_COLLECTION_TIME);
    deliverAgentAlert();

    expect(screen.getByTestId('agent-rail-badge')).toHaveTextContent('1');
  });

  it('Runtime_ShouldSendNoAgentRequest_WhenTheUserLacksThePermission', async () => {
    answerAgentMeWith(200, { agentId: AGENT_ID, state: 'Available' });
    signIn(['reporting:realtime:view']);

    mountConsole(client);
    await settle(PAST_THE_CACHE_COLLECTION_TIME);

    // The stream being open is what makes the zero mean the runtime ran.
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(agentMeRequests()).toHaveLength(0);
  });

  it('Rail_ShouldNotCount_WhenThePermissionHolderHasNoAgentRow', async () => {
    answerAgentMeWith(404, { title: 'Not Found', status: 404 });
    signIn([AGENT_PERMISSION]);

    mountConsole(client);
    await settle(5_000);
    deliverAgentAlert();

    expect(agentMeRequests().length).toBeGreaterThan(0);
    expect(screen.queryByTestId('agent-rail-badge')).not.toBeInTheDocument();
  });
});
