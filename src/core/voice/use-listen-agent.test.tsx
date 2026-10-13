import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ApiError } from '@/core/api/api-error';

/**
 * The listen user agent's lifecycle (design D2; spec `realtime-connection-lifecycle`, "The listen
 * user agent SHALL follow the console's principal and the operations shell").
 */

const { startMock, stopMock, fetchMock, configRef } = vi.hoisted(() => ({
  startMock: vi.fn(async () => undefined),
  stopMock: vi.fn(async () => undefined),
  fetchMock: vi.fn(),
  configRef: {
    current: { asteriskWssUrl: 'wss://pbx.example:8089/ws' } as { asteriskWssUrl?: string },
  },
}));

vi.mock('./listen-agent', () => ({ startListenAgent: startMock, stopListenAgent: stopMock }));
vi.mock('@/core/api/client', () => ({ customFetch: fetchMock }));
vi.mock('@/core/hooks/use-config', () => ({ getConfig: () => configRef.current }));

import { useListenAgent, __resetListenRefusalsForTests } from './use-listen-agent';
import { useAuthStore } from '@/core/auth/auth-store';
import { useListenStore } from './listen-store';

const readJson = (name: string) =>
  JSON.parse(
    readFileSync(resolve(process.cwd(), 'tests/fixtures/contracts', name), 'utf-8'),
  ) as Record<string, { status: number; body: Record<string, unknown> }>;

const creds = readJson('supervisor-sip-credentials.v1.json') as unknown as {
  body: Record<string, string>;
};
const refusals = readJson('supervisor-listen-refusals.json');

const MONITOR = 'contacts:conversation:monitor';
const SUP = { id: 'sup-1', email: 's@b.com', displayName: 'Sup', role: 'supervisor' } as const;
const OTHER = { id: 'sup-2', email: 'o@b.com', displayName: 'Other', role: 'supervisor' } as const;

function signIn(user: typeof SUP | typeof OTHER = SUP, permissions = [MONITOR], token = 'T1') {
  act(() => {
    useAuthStore.getState().setAuth(token, Date.now() + 60_000, user, 'acme', permissions, {});
  });
}

describe('useListenAgent', () => {
  beforeEach(() => {
    startMock.mockClear();
    stopMock.mockClear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(creds.body);
    configRef.current = { asteriskWssUrl: 'wss://pbx.example:8089/ws' };
    __resetListenRefusalsForTests();
    useListenStore.getState().reset();
    useAuthStore.getState().logout();
  });

  afterEach(() => {
    useAuthStore.getState().logout();
  });

  it('UseListenAgent_ShouldFetchCredentialsAndRegister_WhenTheUserMayMonitorAndWssIsSet', async () => {
    signIn();
    renderHook(() => useListenAgent());

    await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/api/v1/supervisor/listen-endpoint', method: 'POST' }),
    );
    expect(fetchMock.mock.calls[0]![0]).not.toHaveProperty('data');
    expect(startMock).toHaveBeenCalledWith('wss://pbx.example:8089/ws', creds.body);
  });

  it('UseListenAgent_ShouldNotCallTheRoute_WhenThePermissionIsMissing', async () => {
    signIn(SUP, ['reporting:realtime:view']);
    renderHook(() => useListenAgent());
    await act(async () => undefined);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(startMock).not.toHaveBeenCalled();
  });

  it.each([undefined, ''])(
    'UseListenAgent_ShouldNotCallTheRoute_WhenTheWssUrlIs %j',
    async (wss) => {
      configRef.current = { asteriskWssUrl: wss };
      signIn();
      renderHook(() => useListenAgent());
      await act(async () => undefined);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(startMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['notPermitted', 'not-permitted'],
    ['noSupervisorEndpoint', 'no-supervisor-endpoint'],
  ] as const)(
    'UseListenAgent_ShouldSetUnavailableAndNotRetry_WhenTheRouteAnswers %s',
    async (name, code) => {
      const entry = refusals[name]!;
      fetchMock.mockRejectedValue(
        new ApiError(entry.status, { ...entry.body, conversationId: null }),
      );
      signIn();
      const first = renderHook(() => useListenAgent());

      await waitFor(() => expect(useListenStore.getState().registration).toBe('unavailable'));
      expect(useListenStore.getState().unavailableReason).toBe(code);
      expect(startMock).not.toHaveBeenCalled();

      first.unmount();
      renderHook(() => useListenAgent());
      await act(async () => undefined);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(useListenStore.getState().registration).toBe('unavailable');
    },
  );

  it('UseListenAgent_ShouldSetFailed_WhenTheRouteFailsOtherwise', async () => {
    fetchMock.mockRejectedValue(new ApiError(500, null));
    signIn();
    renderHook(() => useListenAgent());

    await waitFor(() => expect(useListenStore.getState().registration).toBe('failed'));
    expect(startMock).not.toHaveBeenCalled();
  });

  it('UseListenAgent_ShouldStop_WhenUnmounted', async () => {
    signIn();
    const { unmount } = renderHook(() => useListenAgent());
    await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1));
    stopMock.mockClear();

    unmount();

    expect(stopMock).toHaveBeenCalledTimes(1);
  });

  it('UseListenAgent_ShouldStop_WhenTheUserSignsOut', async () => {
    signIn();
    renderHook(() => useListenAgent());
    await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1));
    stopMock.mockClear();

    act(() => useAuthStore.getState().logout());

    await waitFor(() => expect(stopMock).toHaveBeenCalled());
    expect(startMock).toHaveBeenCalledTimes(1);
  });

  it('UseListenAgent_ShouldRefetchForTheNewPrincipal_WhenTheUserChanges', async () => {
    signIn();
    renderHook(() => useListenAgent());
    await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1));
    stopMock.mockClear();

    signIn(OTHER, [MONITOR], 'T2');

    await waitFor(() => expect(startMock).toHaveBeenCalledTimes(2));
    expect(stopMock).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('UseListenAgent_ShouldNotRestart_WhenTheTokenIsRefreshedForTheSamePrincipal', async () => {
    signIn();
    renderHook(() => useListenAgent());
    await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1));
    stopMock.mockClear();

    act(() => {
      useAuthStore
        .getState()
        .setAuth('T1-refreshed', Date.now() + 120_000, SUP, 'acme', [MONITOR], {});
    });
    await act(async () => undefined);

    expect(stopMock).not.toHaveBeenCalled();
    expect(startMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('UseListenAgent_ShouldTearDownAndRefetch_WhenImpersonationStartsAndEnds', async () => {
    signIn();
    renderHook(() => useListenAgent());
    await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1));
    stopMock.mockClear();

    act(() => {
      useAuthStore.getState().startImpersonation(
        {
          accessToken: 'IMP',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          targetTenantId: 'globex',
          targetTenantName: 'Globex',
        } as Parameters<ReturnType<typeof useAuthStore.getState>['startImpersonation']>[0],
        'T1',
        'acme',
      );
    });
    await waitFor(() => expect(startMock).toHaveBeenCalledTimes(2));
    expect(stopMock).toHaveBeenCalled();
    stopMock.mockClear();

    act(() => useAuthStore.getState().endImpersonation());

    await waitFor(() => expect(startMock).toHaveBeenCalledTimes(3));
    expect(stopMock).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('UseListenAgent_ShouldDropALateCredentialAnswer_WhenThePrincipalChangedMeanwhile', async () => {
    let resolveFirst: (v: unknown) => void = () => undefined;
    fetchMock.mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)));
    signIn();
    renderHook(() => useListenAgent());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    act(() => useAuthStore.getState().logout());
    await act(async () => {
      resolveFirst(creds.body);
    });

    expect(startMock).not.toHaveBeenCalled();
  });
});
