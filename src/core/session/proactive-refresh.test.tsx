import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { SessionManager } from './session-manager';
import { REFRESH_LEAD_MS } from './idle-config';
import { useAuthStore } from '@/core/auth/auth-store';

/**
 * The session manager's proactive refresh, end to end through the REAL `refreshAccessToken`
 * (spec realtime-connection-lifecycle: "The access token SHALL be renewed ahead of its expiry";
 * design D9). The timer fires `REFRESH_LEAD_MS` (60 s) before `exp`; inside the `verbara-refresh`
 * Web Lock the held token is then still valid for 60 s, so a check against the 30 s request buffer
 * found it "fresh" and returned without a network call: the proactive refresh was a no-op wherever
 * Web Locks exist (H6). Real hook, real auth store, a serial fake `navigator.locks`, a stubbed
 * `fetch`, fake timers (Date included).
 */

/** A minimal stand-in for `navigator.locks` that runs callbacks serially. */
function installFakeLocks(): void {
  let chain: Promise<unknown> = Promise.resolve();
  const request = vi.fn(<T,>(_name: string, cb: () => Promise<T>): Promise<T> => {
    const result = chain.then(() => cb());
    chain = result.catch(() => undefined);
    return result;
  });
  Object.defineProperty(globalThis.navigator, 'locks', { value: { request }, configurable: true });
}

function removeLocks(): void {
  Object.defineProperty(globalThis.navigator, 'locks', { value: undefined, configurable: true });
}

const A_USER = { id: 'u1', email: 'a@b.c', displayName: 'A', role: 'agent' } as const;
const FIFTEEN_MINUTES = 15 * 60_000;
/** How long before the lead the test signs in: the timer fires 30 s later. */
const BEFORE_THE_LEAD = 30_000;

function refreshResponse(): Response {
  return new Response(
    JSON.stringify({
      accessToken: 'T2',
      expiresAt: new Date(Date.now() + FIFTEEN_MINUTES).toISOString(),
      permissions: ['users:user:view'],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function renderManager() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  render(<SessionManager />, { wrapper: Wrapper });
}

describe('SessionManager proactive refresh', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let firstExpiry: number;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn(async () => refreshResponse());
    vi.stubGlobal('fetch', fetchMock);
    firstExpiry = Date.now() + REFRESH_LEAD_MS + BEFORE_THE_LEAD;
    useAuthStore.setState({
      accessToken: 'T1',
      tokenExpiry: firstExpiry,
      user: A_USER,
      tenantId: 't1',
      permissions: ['users:user:view'],
      // A long idle window: the idle warning never opens (it pauses the proactive timer).
      sessionIdleTimeoutMinutes: 60,
    });
  });

  afterEach(() => {
    cleanup();
    useAuthStore.getState().logout();
    removeLocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const refreshCalls = () =>
    fetchMock.mock.calls.filter(([url]) => String(url) === '/api/v1/auth/refresh');

  it('ProactiveRefresh_ShouldMakeOneNetworkRefreshBeforeExp_WhenWebLocksArePresent', async () => {
    installFakeLocks();
    renderManager();

    await act(() => vi.advanceTimersByTimeAsync(BEFORE_THE_LEAD));

    expect(Date.now()).toBeLessThan(firstExpiry);
    expect(refreshCalls()).toHaveLength(1);
    expect(useAuthStore.getState().accessToken).toBe('T2');
  });

  it('ProactiveRefresh_ShouldMakeOneNetworkRefreshBeforeExp_WhenWebLocksAreAbsent', async () => {
    removeLocks();
    renderManager();

    await act(() => vi.advanceTimersByTimeAsync(BEFORE_THE_LEAD));

    expect(Date.now()).toBeLessThan(firstExpiry);
    expect(refreshCalls()).toHaveLength(1);
    expect(useAuthStore.getState().accessToken).toBe('T2');
  });

  it('ProactiveRefresh_ShouldMakeNoNetworkCall_WhenTheLeadHasNotStarted', async () => {
    installFakeLocks();
    renderManager();

    await act(() => vi.advanceTimersByTimeAsync(BEFORE_THE_LEAD - 1));

    expect(refreshCalls()).toHaveLength(0);
    expect(useAuthStore.getState().accessToken).toBe('T1');
  });
});
