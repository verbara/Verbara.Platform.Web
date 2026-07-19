import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/core/auth/auth-store';
import { useTenantStore } from '@/core/tenant/tenant-store';
import type { Agent } from '@/core/api/hooks/use-agents';
import { sendOfflineBeacon, useAgentDeparture } from './agent-departure';

// The hook reads the QueryClient from React context via useQueryClient. Mock
// the provider hook so the test can inject its own client without rendering a
// real <QueryClientProvider>.
const queryClientRef: { current: QueryClient } = { current: new QueryClient() };
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQueryClient: () => queryClientRef.current };
});

function makeAgent(state: Agent['state']): Agent {
  return {
    agentId: 'a1',
    id: 'a1',
    tenantId: 't1',
    userId: 'u1',
    displayName: 'Agent One',
    state,
    pendingState: null,
    pendingReason: null,
    pendingSince: null,
    hasPendingPause: false,
    teamId: null,
    skills: [],
    extension: null,
    autoAnswer: null,
    canAcceptWork: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: null,
    capacityOverride: null,
    effectiveCapacity: { maxVoice: 1, maxChat: 5, maxEmail: 5, maxSms: 5, maxTotal: 10 },
  };
}

function newQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
}

const fetchMock = vi.fn();

describe('agent-departure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    useAuthStore.setState({ accessToken: 'tok', tenantId: 'tenant-from-auth' });
    useTenantStore.setState({ activeTenantId: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useAuthStore.setState({ accessToken: null, tenantId: null });
    useTenantStore.setState({ activeTenantId: null });
  });

  describe('sendOfflineBeacon', () => {
    it('sendOfflineBeacon_ShouldFetchOfflineWithAuthAndTenantHeaders_WhenRoutableAgent', () => {
      useTenantStore.setState({ activeTenantId: 'tenant-active' });
      const qc = newQueryClient();
      qc.setQueryData<Agent>(['agent-me'], makeAgent('Busy'));

      sendOfflineBeacon(qc);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('/api/v1/agents/me/offline');
      expect(init.method).toBe('POST');
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer tok');
      // Active tenant wins over the auth-store tenant (same precedence as customFetch).
      expect(headers['X-Tenant-Id']).toBe('tenant-active');
    });

    it('sendOfflineBeacon_ShouldFallBackToAuthTenant_WhenNoActiveTenant', () => {
      const qc = newQueryClient();
      qc.setQueryData<Agent>(['agent-me'], makeAgent('Available'));

      sendOfflineBeacon(qc);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['X-Tenant-Id']).toBe('tenant-from-auth');
    });

    it('sendOfflineBeacon_ShouldUseKeepalive_WhenSending', () => {
      const qc = newQueryClient();
      qc.setQueryData<Agent>(['agent-me'], makeAgent('Busy'));

      sendOfflineBeacon(qc);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(init.keepalive).toBe(true);
    });

    it('sendOfflineBeacon_ShouldSkip_WhenAgentNonRoutable', () => {
      const qc = newQueryClient();
      qc.setQueryData<Agent>(['agent-me'], makeAgent('Offline'));
      sendOfflineBeacon(qc);
      expect(fetchMock).not.toHaveBeenCalled();

      qc.setQueryData<Agent>(['agent-me'], makeAgent('Break'));
      sendOfflineBeacon(qc);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sendOfflineBeacon_ShouldSkip_WhenNoAgentInCache', () => {
      const qc = newQueryClient();

      sendOfflineBeacon(qc);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sendOfflineBeacon_ShouldSkip_WhenNoAccessToken', () => {
      useAuthStore.setState({ accessToken: null });
      const qc = newQueryClient();
      qc.setQueryData<Agent>(['agent-me'], makeAgent('Busy'));

      sendOfflineBeacon(qc);

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('useAgentDeparture', () => {
    it('useAgentDeparture_ShouldSendBeacon_WhenPagehideFires', () => {
      queryClientRef.current = newQueryClient();
      queryClientRef.current.setQueryData<Agent>(['agent-me'], makeAgent('Busy'));

      renderHook(() => useAgentDeparture());

      window.dispatchEvent(new Event('pagehide'));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/agents/me/offline');
    });

    it('useAgentDeparture_ShouldRemoveListener_WhenUnmounted', () => {
      queryClientRef.current = newQueryClient();
      queryClientRef.current.setQueryData<Agent>(['agent-me'], makeAgent('Busy'));

      const { unmount } = renderHook(() => useAgentDeparture());
      unmount();

      window.dispatchEvent(new Event('pagehide'));

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
