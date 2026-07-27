import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useAuthConfig,
  useUpdateAuthConfig,
  useConfirmMfa,
  useDisableMfa,
  useChangePassword,
  useRevokeSession,
  usePasswordPolicy,
} from './use-auth-admin';
import * as client from '@/core/api/client';

vi.mock('@/core/api/client', () => ({
  customFetch: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

describe('use-auth-admin mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useConfirmMfa should invalidate me on success', async () => {
    const { qc, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    vi.mocked(client.customFetch).mockResolvedValue(undefined);

    const { result } = renderHook(() => useConfirmMfa(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('123456');
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['me'] });
  });

  it('useDisableMfa should invalidate me on success', async () => {
    const { qc, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    vi.mocked(client.customFetch).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDisableMfa(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('password');
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['me'] });
  });

  it('useChangePassword should NOT invalidate me on success', async () => {
    const { qc, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    vi.mocked(client.customFetch).mockResolvedValue(undefined);

    const { result } = renderHook(() => useChangePassword(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ oldPassword: 'a', newPassword: 'b' });
    });

    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['me'] });
  });

  it('useRevokeSession should invalidate sessions list on success', async () => {
    const { qc, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    vi.mocked(client.customFetch).mockResolvedValue(undefined);

    const { result } = renderHook(() => useRevokeSession(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('token-123');
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['auth', 'sessions', 'me'] });
  });

  it('useAuthConfig should seed pendingPauseTimeoutMinutes from the GET response (fixture: 30)', async () => {
    const { wrapper } = createWrapper();
    vi.mocked(client.customFetch).mockResolvedValue({
      sessionIdleTimeoutMinutes: 30,
      sessionAbsoluteTimeoutHours: 24,
      pendingPauseTimeoutMinutes: 30,
    });

    const { result } = renderHook(() => useAuthConfig(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pendingPauseTimeoutMinutes).toBe(30);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/auth/config',
      method: 'GET',
    });
  });

  it('useUpdateAuthConfig should PUT the partial { pendingPauseTimeoutMinutes: 20 } body (fixture)', async () => {
    const { qc, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    vi.mocked(client.customFetch).mockResolvedValue(undefined);

    const { result } = renderHook(() => useUpdateAuthConfig(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ pendingPauseTimeoutMinutes: 20 });
    });

    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/auth/config',
      method: 'PUT',
      data: { pendingPauseTimeoutMinutes: 20 },
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['auth-config'] });
  });

  it('useUpdateAuthConfig should send pendingPauseTimeoutMinutes: 0 verbatim (0 disables)', async () => {
    const { wrapper } = createWrapper();
    vi.mocked(client.customFetch).mockResolvedValue(undefined);

    const { result } = renderHook(() => useUpdateAuthConfig(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ pendingPauseTimeoutMinutes: 0 });
    });

    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/auth/config',
      method: 'PUT',
      data: { pendingPauseTimeoutMinutes: 0 },
    });
  });

  it('usePasswordPolicy should cache with infinite stale time on success', async () => {
    const { wrapper } = createWrapper();
    vi.mocked(client.customFetch).mockResolvedValue({
      minLength: 12,
      requireUppercase: true,
      requireNumber: true,
      requireSpecial: false,
    });

    const { result } = renderHook(() => usePasswordPolicy(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.minLength).toBe(12);
    expect(result.current.isStale).toBe(false);
  });
});
