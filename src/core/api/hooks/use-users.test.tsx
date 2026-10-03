import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import * as client from '@/core/api/client';
import { useUsers, useUser, useCreateUser, useUpdateUser, useDeleteUser } from './use-users';
import type { User } from './use-users';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const mockUser: User = {
  id: 'u1',
  email: 'test@example.com',
  displayName: 'Test User',
  role: 'admin',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
};

describe('useUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch users and unwrap items', async () => {
    vi.mocked(client.customFetch).mockResolvedValue({
      items: [mockUser],
      totalCount: 1,
      page: 1,
      pageSize: 100,
    });
    const { result } = renderHook(() => useUsers(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([mockUser]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/users',
      method: 'GET',
      params: { page: '1', pageSize: '100' },
    });
  });

  it('should handle error when fetch fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useUsers(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch a single user by id', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockUser);
    const { result } = renderHook(() => useUser('u1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockUser);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/users/u1',
      method: 'GET',
    });
  });

  it('should not fetch when id is undefined', () => {
    const { result } = renderHook(() => useUser(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(client.customFetch).not.toHaveBeenCalled();
  });

  it('should handle error when fetch fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useUser('u1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a user', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockUser);
    const { result } = renderHook(() => useCreateUser(), { wrapper });
    act(() => {
      result.current.mutate({ email: 'test@example.com', displayName: 'Test User', role: 'admin' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/users',
      method: 'POST',
      data: { email: 'test@example.com', displayName: 'Test User', role: 'admin' },
    });
  });

  it('UseCreateUser_ShouldPostOnlyEmailDisplayNameAndRole_WhenTheCallerPassesAStatus', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockUser);
    const { result } = renderHook(() => useCreateUser(), { wrapper });
    // `CreateUserRequest` has no status: a form value passed through must not reach the body.
    const formValues = {
      email: 'new@example.com',
      displayName: 'New User',
      role: 'agent',
      status: 'Suspended' as const,
    };
    act(() => {
      result.current.mutate(formValues);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [config] = vi.mocked(client.customFetch).mock.calls[0]!;
    expect(config).toStrictEqual({
      url: '/api/v1/admin/users',
      method: 'POST',
      data: { email: 'new@example.com', displayName: 'New User', role: 'agent' },
    });
  });

  it('should handle error when creation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useCreateUser(), { wrapper });
    act(() => {
      result.current.mutate({ email: 'test@example.com', displayName: 'Test User', role: 'admin' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update a user', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockUser);
    const { result } = renderHook(() => useUpdateUser(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'u1', displayName: 'Updated' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/users/u1',
      method: 'PUT',
      data: { displayName: 'Updated' },
    });
  });

  it('UseUpdateUser_ShouldSendNoStatusKey_WhenOnlyTheNameIsUpdated', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockUser);
    const { result } = renderHook(() => useUpdateUser(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'u1', displayName: 'Updated' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [config] = vi.mocked(client.customFetch).mock.calls[0]!;
    expect(config.data).toStrictEqual({ displayName: 'Updated' });
    expect(Object.keys(config.data as object)).not.toContain('status');
  });

  it('UseUpdateUser_ShouldSendTheEnumName_WhenAStatusIsGiven', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockUser);
    const { result } = renderHook(() => useUpdateUser(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'u1', status: 'Suspended' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/users/u1',
      method: 'PUT',
      data: { status: 'Suspended' },
    });
  });

  it('UseUpdateUser_ShouldInvalidateTheListAndTheDetail_WhenTheUpdateSucceeds', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockUser);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateUser(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      ),
    });
    act(() => {
      result.current.mutate({ id: 'u1', status: 'Suspended' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // `['users']` is a prefix of both the list's key and the detail's `['users', id]`.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['users'] });
  });

  it('should handle error when update fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useUpdateUser(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'u1', displayName: 'Updated' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete a user', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteUser(), { wrapper });
    act(() => {
      result.current.mutate('u1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/users/u1',
      method: 'DELETE',
    });
  });

  it('should handle error when delete fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useDeleteUser(), { wrapper });
    act(() => {
      result.current.mutate('u1');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
