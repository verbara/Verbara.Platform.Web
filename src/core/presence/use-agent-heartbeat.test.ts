import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as client from '@/core/api/client';
import { useAuthStore } from '@/core/auth/auth-store';
import { HEARTBEAT_INTERVAL_MS, useAgentHeartbeat } from './use-agent-heartbeat';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

const HEARTBEAT_CALL = { url: '/api/v1/agents/me/heartbeat', method: 'POST' };

describe('useAgentHeartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    useAuthStore.setState({ accessToken: 'tok' });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    useAuthStore.setState({ accessToken: null });
  });

  it('useAgentHeartbeat_ShouldPostHeartbeatImmediately_WhenMounted', () => {
    renderHook(() => useAgentHeartbeat());

    expect(client.customFetch).toHaveBeenCalledTimes(1);
    expect(client.customFetch).toHaveBeenCalledWith(HEARTBEAT_CALL);
  });

  it('useAgentHeartbeat_ShouldPostEvery20s_WhenMountedAndAuthenticated', () => {
    renderHook(() => useAgentHeartbeat());
    expect(client.customFetch).toHaveBeenCalledTimes(1); // immediate beat

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
    expect(client.customFetch).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
    expect(client.customFetch).toHaveBeenCalledTimes(3);
  });

  it('useAgentHeartbeat_ShouldStopPosting_WhenUnmounted', () => {
    const { unmount } = renderHook(() => useAgentHeartbeat());
    expect(client.customFetch).toHaveBeenCalledTimes(1);

    unmount();

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 3);
    expect(client.customFetch).toHaveBeenCalledTimes(1); // no further beats
  });

  it('useAgentHeartbeat_ShouldKeepPosting_WhenDocumentHidden', () => {
    const visibilitySpy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    renderHook(() => useAgentHeartbeat());
    expect(client.customFetch).toHaveBeenCalledTimes(1);

    // A hidden tab is still connected — the interval keeps firing.
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 2);
    expect(client.customFetch).toHaveBeenCalledTimes(3);

    visibilitySpy.mockRestore();
  });

  it('useAgentHeartbeat_ShouldNotPost_WhenNoAccessToken', () => {
    useAuthStore.setState({ accessToken: null });
    renderHook(() => useAgentHeartbeat());

    expect(client.customFetch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 2);
    expect(client.customFetch).not.toHaveBeenCalled();
  });

  it('useAgentHeartbeat_ShouldSwallowError_WhenHeartbeatFails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('network down'));

    expect(() => renderHook(() => useAgentHeartbeat())).not.toThrow();
    expect(client.customFetch).toHaveBeenCalledTimes(1);

    // The rejected promise must not surface as an unhandled rejection.
    await Promise.resolve();
  });
});
