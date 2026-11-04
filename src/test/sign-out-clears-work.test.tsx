import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { useConversationStore, type Conversation } from '@/agent/stores/conversation-store';
import { useAuthStore } from '@/core/auth/auth-store';
import { AuthGuard } from '@/core/auth/auth-guard';
import { ImpersonationBanner } from '@/core/auth/impersonation-banner';
import { queryClient } from '@/core/api/query-client';
import { usePaymentRequiredStore } from '@/core/licensing/payment-required-store';
import { EMPTY_SESSION, useAgentAiStore } from '@/core/stores/agent-ai-store';
import { useAgentAlertsStore } from '@/core/stores/agent-alerts-store';
import { useAnalyticsFilterStore } from '@/core/stores/analytics-filter-store';
import { useTenantStore } from '@/core/tenant/tenant-store';
import { useAgentStateStore } from '@/operations/stores/agent-state-store';
import { useCampaignMetricsStore } from '@/operations/stores/campaign-metrics-store';
import { useQueueMetricsStore } from '@/operations/stores/queue-metrics-store';

/**
 * What one person leaves in the page when the identity changes without a reload: the real stores, the
 * app's one query client and the store actions every sign-out and impersonation path goes through.
 */

const OPERATOR = { id: 'user-1', email: 'a@b.c', displayName: 'Ana', role: 'admin' } as const;

const heldConversation = { id: 'conv-1', state: 'active' } as Conversation;

function signIn() {
  useAuthStore
    .getState()
    .setAuth('operator-token', Date.now() + 3600_000, OPERATOR, 'tenant-1', [], {});
  useTenantStore.getState().setActiveTenant('tenant-1');
}

function impersonate() {
  useAuthStore.getState().startImpersonation(
    {
      accessToken: 'impersonation-token',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      targetTenantId: 'tenant-9',
      targetTenantName: 'ACME',
    },
    'operator-token',
    'tenant-1',
  );
}

function holdWork() {
  useConversationStore.setState({
    conversations: { 'conv-1': heldConversation },
    messages: { 'conv-1': [] },
    selectedId: 'conv-1',
    filter: 'waiting',
  });
  useAgentAiStore.setState({ sessions: { 'conv-1': EMPTY_SESSION } });
  useAgentAlertsStore.getState().increment();
  useAnalyticsFilterStore.getState().setFilters({ queue: 'queue-1' });
  usePaymentRequiredStore.setState({ open: true, current: { title: 'x' } as never });
  useAgentStateStore.setState({ agents: [{ agentId: 'a-1' } as never] });
  useCampaignMetricsStore.setState({ campaigns: [{ campaignId: '1' } as never] });
  useQueueMetricsStore.getState().setQueues([
    {
      queueId: 'q-1',
      waiting: 1,
      agentsAvailable: 1,
      agentsBusy: 0,
      agentsAway: 0,
      slaPercent: 90,
    } as never,
  ]);
  queryClient.setQueryData(['contacts', 'c-1', 'conversations'], { pages: [{ items: ['row'] }] });
  queryClient.setQueryData(['messages', 'conv-1', 'history'], { pages: [{ items: ['message'] }] });
}

function expectNoWorkInStores() {
  const conversations = useConversationStore.getState();
  expect(conversations.conversations).toEqual({});
  expect(conversations.messages).toEqual({});
  expect(conversations.selectedId).toBeNull();
  expect(conversations.filter).toBe('active');
  expect(useAgentAiStore.getState().sessions).toEqual({});
  expect(useAgentAlertsStore.getState().pendingCount).toBe(0);
  expect(useAnalyticsFilterStore.getState().queue).toBe('');
  expect(usePaymentRequiredStore.getState().open).toBe(false);
  expect(usePaymentRequiredStore.getState().current).toBeNull();
  expect(useAgentStateStore.getState().agents).toEqual([]);
  expect(useCampaignMetricsStore.getState().campaigns).toEqual([]);
  expect(useQueueMetricsStore.getState().queues).toEqual([]);
  expect(useQueueMetricsStore.getState().totalActive).toBe(0);
}

/** A page that reads through the app's client, as every hook does. */
function Reader({ read }: { read: () => Promise<string> }) {
  const { data } = useQuery({ queryKey: ['reader'], queryFn: read, staleTime: 30_000 });
  return <div data-testid="reader">{data ?? 'nothing'}</div>;
}

function renderGuardedReader(read: () => Promise<string>) {
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/page']}>
        <Routes>
          <Route path="/login" element={<div data-testid="login" />} />
          <Route
            path="/page"
            element={
              <AuthGuard>
                <Reader read={read} />
              </AuthGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('signing out', () => {
  beforeEach(() => {
    queryClient.clear();
    signIn();
    holdWork();
  });

  afterEach(() => {
    cleanup();
    useAuthStore.getState().logout();
    vi.restoreAllMocks();
  });

  it('Logout_ShouldLeaveTheQueryCacheEmptyAndNoWorkInTheStores_WhenAPersonSignsOut', () => {
    useAuthStore.getState().logout();

    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    expect(queryClient.getMutationCache().getAll()).toEqual([]);
    expectNoWorkInStores();
  });

  it('Logout_ShouldForgetTheTenantTheConsoleWorkedOn_WhenAPersonSignsOut', () => {
    useAuthStore.getState().logout();

    expect(useTenantStore.getState().activeTenantId).toBeNull();
  });

  it('Logout_ShouldDropAReadStillInFlight_WhenItsAnswerArrivesAfterTheSignOut', async () => {
    let answer: (value: string) => void = () => undefined;
    const read = new Promise<string>((resolve) => {
      answer = resolve;
    });
    const prefetch = queryClient.prefetchQuery({ queryKey: ['late'], queryFn: () => read });

    useAuthStore.getState().logout();
    answer('the previous person');
    await prefetch;

    expect(queryClient.getQueryData(['late'])).toBeUndefined();
  });

  it('Logout_ShouldReachTheLoginPageWithNoFurtherRead_WhenAPageIsReadingOrShowingData', async () => {
    let answer: (value: string) => void = () => undefined;
    const read = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          answer = resolve;
        }),
    );
    renderGuardedReader(read);
    await screen.findByTestId('reader');
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));

    act(() => useAuthStore.getState().logout());
    await act(async () => {
      answer('the previous person');
      await new Promise((done) => setTimeout(done, 0));
    });

    expect(screen.getByTestId('login')).toBeInTheDocument();
    expect(screen.queryByTestId('reader')).toBeNull();
    expect(read).toHaveBeenCalledTimes(1);
  });
});

describe('another person signing in with no sign-out before it', () => {
  const NEXT_PERSON = { id: 'user-2', email: 'b@b.c', displayName: 'Bea', role: 'agent' } as const;

  function arrive(user: typeof OPERATOR | typeof NEXT_PERSON) {
    useAuthStore.getState().setAuth('next-token', Date.now() + 3600_000, user, 'tenant-1', [], {});
  }

  beforeEach(() => {
    queryClient.clear();
    signIn();
    holdWork();
  });

  afterEach(() => {
    cleanup();
    useAuthStore.getState().logout();
    vi.restoreAllMocks();
  });

  it('SetAuth_ShouldLeaveTheCacheAndTheStoresEmpty_WhenAnotherUserArrives', () => {
    arrive(NEXT_PERSON);

    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    expectNoWorkInStores();
    expect(useAuthStore.getState().user?.id).toBe(NEXT_PERSON.id);
    expect(useAuthStore.getState().accessToken).toBe('next-token');
  });

  it('SetAuth_ShouldDropAReadStillInFlight_WhenAnotherUserArrives', async () => {
    let answer: (value: string) => void = () => undefined;
    const read = new Promise<string>((resolve) => {
      answer = resolve;
    });
    const prefetch = queryClient.prefetchQuery({ queryKey: ['late'], queryFn: () => read });

    arrive(NEXT_PERSON);
    answer('an answer for the other user');
    await prefetch;

    expect(queryClient.getQueryData(['late'])).toBeUndefined();
  });

  it('SetAuth_ShouldClearNothing_WhenTheSameUserRefreshes', () => {
    arrive({ ...OPERATOR });

    expect(queryClient.getQueryData(['messages', 'conv-1', 'history'])).toBeDefined();
    expect(queryClient.getQueryData(['contacts', 'c-1', 'conversations'])).toBeDefined();
    expect(useConversationStore.getState().conversations).toEqual({ 'conv-1': heldConversation });
    expect(useConversationStore.getState().selectedId).toBe('conv-1');
    expect(useAgentAlertsStore.getState().pendingCount).toBe(1);
    expect(useQueueMetricsStore.getState().queues).toHaveLength(1);
    expect(useAuthStore.getState().accessToken).toBe('next-token');
  });

  it('SetAuth_ShouldClearNothing_WhenNoUserWasHeld', () => {
    useAuthStore.getState().logout();
    holdWork();

    arrive(NEXT_PERSON);

    expect(queryClient.getQueryData(['messages', 'conv-1', 'history'])).toBeDefined();
    expect(useConversationStore.getState().selectedId).toBe('conv-1');
  });
});

describe('an impersonation starting or ending', () => {
  beforeEach(() => {
    queryClient.clear();
    signIn();
    holdWork();
  });

  afterEach(() => {
    cleanup();
    useAuthStore.getState().logout();
    vi.restoreAllMocks();
  });

  it('StartImpersonation_ShouldDropTheOperatorsDataAndWork_WhenItStarts', () => {
    impersonate();

    expect(queryClient.getQueryData(['contacts', 'c-1', 'conversations'])).toBeUndefined();
    expect(queryClient.getQueryData(['messages', 'conv-1', 'history'])).toBeUndefined();
    expectNoWorkInStores();
  });

  it('EndImpersonation_ShouldDropTheImpersonatedTenantsDataAndWork_WhenItEnds', () => {
    impersonate();
    holdWork();

    useAuthStore.getState().endImpersonation();

    expect(queryClient.getQueryData(['contacts', 'c-1', 'conversations'])).toBeUndefined();
    expectNoWorkInStores();
  });

  it('StartImpersonation_ShouldLeaveTheTenantStoreAlone_WhenItStarts', () => {
    impersonate();

    expect(useTenantStore.getState().activeTenantId).toBe('tenant-1');
  });

  it('StartImpersonation_ShouldReadAgainWithTheNewTokenAndShowNoOldData_WhenAPageIsOpen', async () => {
    let answer: (value: string) => void = () => undefined;
    const tokens: (string | null)[] = [];
    const read = vi.fn(() => {
      tokens.push(useAuthStore.getState().accessToken);
      return tokens.length === 1
        ? Promise.resolve('the operator')
        : new Promise<string>((resolve) => {
            answer = resolve;
          });
    });
    renderGuardedReader(read);
    await waitFor(() => expect(screen.getByTestId('reader')).toHaveTextContent('the operator'));

    act(() => impersonate());

    await waitFor(() => expect(tokens).toEqual(['operator-token', 'impersonation-token']));
    expect(screen.getByTestId('reader')).toHaveTextContent('nothing');

    await act(async () => answer('the tenant'));
    await waitFor(() => expect(screen.getByTestId('reader')).toHaveTextContent('the tenant'));
  });

  it('StartImpersonation_ShouldKeepTheBanner_WhenTheDataIsDropped', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ImpersonationBanner />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    act(() => impersonate());

    expect(screen.getByText(/ACME/)).toBeInTheDocument();
  });
});
