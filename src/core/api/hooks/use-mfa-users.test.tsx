import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '@/core/api/client';
import type { MfaUserSummary } from './use-mfa-users';
import { useMfaUsers, useResetMfa, useRevokeMfaSessions } from './use-mfa-users';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const mockUser: MfaUserSummary = {
  userId: 'u1',
  username: 'john',
  tenantId: 't1',
  tenantName: 'Acme',
  status: 'enrolled',
  enrolledAt: '2026-01-01T00:00:00Z',
  lastUsedAt: '2026-01-02T00:00:00Z',
};

const pagedResponse = {
  items: [mockUser],
  totalCount: 1,
  page: 1,
  pageSize: 50,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

describe('useMfaUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch MFA users with default params', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(pagedResponse);

    const { result } = renderHook(() => useMfaUsers(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(pagedResponse);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/mfa/users',
      method: 'GET',
      params: { page: '1', pageSize: '50' },
    });
  });

  it('should include status and tenant filter params', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(pagedResponse);

    const { result } = renderHook(
      () => useMfaUsers({ status: 'locked', tenant: 't1', page: 2, pageSize: 25 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/mfa/users',
      method: 'GET',
      params: { page: '2', pageSize: '25', status: 'locked', tenant: 't1' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Forbidden'));

    const { result } = renderHook(() => useMfaUsers(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Forbidden');
  });
});

describe('useResetMfa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call POST /api/v1/management/mfa/users/{id}/reset', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);

    const { result } = renderHook(() => useResetMfa(), { wrapper });

    act(() => {
      result.current.mutate('user-123');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/mfa/users/user-123/reset',
      method: 'POST',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useResetMfa(), { wrapper });

    act(() => {
      result.current.mutate('bad-id');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Not found');
  });
});

describe('useRevokeMfaSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call POST /api/v1/management/mfa/users/{id}/sessions/revoke', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);

    const { result } = renderHook(() => useRevokeMfaSessions(), { wrapper });

    act(() => {
      result.current.mutate('user-456');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/mfa/users/user-456/sessions/revoke',
      method: 'POST',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => useRevokeMfaSessions(), { wrapper });

    act(() => {
      result.current.mutate('user-456');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Server error');
  });
});
