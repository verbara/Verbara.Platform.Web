import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { SessionManager } from './session-manager';
import { SessionChannel } from './session-channel';
import { warningAtMs, COUNTDOWN_SECONDS } from './idle-config';
import * as client from '@/core/api/client';
import { useAuthStore } from '@/core/auth/auth-store';
import { useVoiceCallStore } from '@/agent/stores/voice-call-store';
import { useConversationStore } from '@/agent/stores/conversation-store';
import type { Agent } from '@/core/api/hooks/use-agents';

// customFetch is the teardown PUT; refreshAccessToken is the proactive refresh.
vi.mock('@/core/api/client', () => ({
  customFetch: vi.fn().mockResolvedValue(undefined),
  refreshAccessToken: vi.fn().mockResolvedValue(true),
}));

/** Idle minutes the component resolves from the auth store. */
const IDLE_MINUTES = 2;
const WARNING_AT = warningAtMs(IDLE_MINUTES);

function makeAgent(state: string): Agent {
  return {
    agentId: 'a1',
    id: 'a1',
    userId: 'u1',
    displayName: 'Agent One',
    state,
    skills: [],
    createdAt: '2026-01-01T00:00:00Z',
  };
}

function renderManager(agent?: Agent) {
  // gcTime: Infinity — there is no active `useAgentMe` observer in this test, so
  // a finite gcTime would evict the manually-seeded `['agent-me']` entry before
  // the teardown reads it. In production `useAgentMe()` keeps the entry alive.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  if (agent) qc.setQueryData<Agent>(['agent-me'], agent);
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  const view = render(<SessionManager />, { wrapper: Wrapper });
  return { ...view, qc };
}

describe('SessionManager', () => {
  let logoutSpy: ReturnType<typeof vi.spyOn>;
  let originalHref: PropertyDescriptor | undefined;
  let assignedHref: string | null;

  beforeEach(() => {
    vi.clearAllMocks();
    useVoiceCallStore.getState().reset();
    useConversationStore.setState({ conversations: {} });
    // Authenticated session with a 2-minute idle window; far-future token expiry
    // so the proactive-refresh timer never fires during the idle advance.
    useAuthStore.setState({
      accessToken: 'tok',
      tokenExpiry: Date.now() + 60 * 60_000,
      user: { id: 'u1', email: 'a@b.c', displayName: 'A', role: 'agent' },
      tenantId: 't1',
      sessionIdleTimeoutMinutes: IDLE_MINUTES,
    });
    logoutSpy = vi.spyOn(useAuthStore.getState(), 'logout');

    // Stub window.location.href so the redirect is observable, not a navigation.
    assignedHref = null;
    originalHref = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        set href(v: string) {
          assignedHref = v;
        },
        get href() {
          return assignedHref ?? '';
        },
      },
    });
  });

  afterEach(() => {
    logoutSpy.mockRestore();
    if (originalHref) Object.defineProperty(window, 'location', originalHref);
    if (vi.isFakeTimers()) {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    }
  });

  it('IdleLogout_ShouldTeardownThenLogout_WhenRoutableAgent', async () => {
    vi.useFakeTimers();
    const order: string[] = [];
    vi.mocked(client.customFetch).mockImplementation(async () => {
      order.push('teardown-put');
    });
    logoutSpy.mockImplementation(() => {
      order.push('auth-logout');
    });

    renderManager(makeAgent('busy'));

    // Cross the warning deadline, then run the full countdown to expiry.
    act(() => {
      vi.advanceTimersByTime(WARNING_AT);
    });
    act(() => {
      vi.advanceTimersByTime(COUNTDOWN_SECONDS * 1_000);
    });

    // The teardown PUT must have been issued with the offline payload.
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/agents/me/state',
      method: 'PUT',
      data: { state: 'offline' },
    });

    // Let the teardown promise + .finally() settle, then assert ordering.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_600);
    });

    expect(order).toEqual(['teardown-put', 'auth-logout']);
    expect(assignedHref).toBe('/login');
  });

  it('IdleWarning_ShouldStaySuppressed_WhenDeliberateAuxState', () => {
    vi.useFakeTimers();
    const { container } = renderManager(makeAgent('dnd'));

    // Advance well past the warning deadline AND the full countdown window.
    act(() => {
      vi.advanceTimersByTime(WARNING_AT + COUNTDOWN_SECONDS * 1_000 + 5_000);
    });

    // The dialog never opened (no alertdialog rendered) and no logout happened.
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(client.customFetch).not.toHaveBeenCalled();
    expect(logoutSpy).not.toHaveBeenCalled();
    expect(assignedHref).toBeNull();
  });

  it('RemoteLogout_ShouldLogoutWithoutTeardownPut_WhenLogoutMessageReceived', async () => {
    // Real timers here: BroadcastChannel delivery is event-loop driven.
    const { qc } = renderManager(makeAgent('busy'));
    expect(qc.getQueryData(['agent-me'])).toBeDefined();

    // A sibling tab broadcasts a logout. The component's internal SessionChannel
    // receives it and runs onRemoteLogout — local clear + redirect, NO teardown.
    const sibling = new SessionChannel();
    sibling.post('logout');

    await waitFor(() => expect(logoutSpy).toHaveBeenCalledTimes(1));
    expect(client.customFetch).not.toHaveBeenCalled();
    expect(assignedHref).toBe('/login');

    sibling.close();
  });

  it('NoSession_ShouldRenderNothing_WhenUnauthenticated', () => {
    useAuthStore.setState({ accessToken: null });
    const { container } = renderManager();
    expect(container.firstChild).toBeNull();
  });
});
