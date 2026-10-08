import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import * as client from '@/core/api/client';
import { ApiError, entriesOf } from '@/core/api/api-error';
import { ADMIN_LOCALES, TEST_LOCALES, createLocaleI18n } from '@/test/locale-i18n';
import {
  useUsers,
  useUser,
  useUserEtag,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  strongEtagOf,
  USER_UPDATE_ERRORS,
} from './use-users';
import type { User } from './use-users';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn(), customFetchWithHeaders: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

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
    vi.mocked(client.customFetchWithHeaders).mockResolvedValue({
      data: mockUser,
      headers: new Headers({ ETag: '"v1"' }),
    });
    const { result } = renderHook(() => useUser('u1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockUser);
    expect(client.customFetchWithHeaders).toHaveBeenCalledWith({
      url: '/api/v1/admin/users/u1',
      method: 'GET',
    });
  });

  it('should not fetch when id is undefined', () => {
    const { result } = renderHook(() => useUser(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(client.customFetchWithHeaders).not.toHaveBeenCalled();
  });

  it('should handle error when fetch fails', async () => {
    vi.mocked(client.customFetchWithHeaders).mockRejectedValue(new Error('fail'));
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

describe('strongEtagOf', () => {
  it.each([
    ['"v1"', '"v1"'],
    [' "abc" ', '"abc"'],
    ['W/"v1"', null],
    ['w/"v1"', null],
    ['', null],
  ])('StrongEtagOf_ShouldKeepOnlyAStrongTag_WhenTheHeaderIs_%j', (header, expected) => {
    expect(strongEtagOf(new Headers(header ? { ETag: header } : {}))).toBe(expected);
  });

  it('StrongEtagOf_ShouldReturnNull_WhenThereIsNoETag', () => {
    expect(strongEtagOf(new Headers())).toBeNull();
  });
});

describe('useUserEtag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['"v7"', '"v7"'],
    ['W/"v7"', null],
    [null, null],
  ])('UseUserEtag_ShouldExposeOnlyAStrongTag_WhenTheReadCarried_%j', async (header, expected) => {
    vi.mocked(client.customFetchWithHeaders).mockResolvedValue({
      data: mockUser,
      headers: new Headers(header ? { ETag: header } : {}),
    });
    const { result } = renderHook(() => useUserEtag('u1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(expected);
  });
});

describe('useUpdateUser If-Match (design D6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function update(etag: string | null | undefined) {
    vi.mocked(client.customFetch).mockResolvedValue(mockUser);
    const { result } = renderHook(() => useUpdateUser(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'u1', status: 'Suspended', etag });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    return vi.mocked(client.customFetch).mock.calls[0]![0];
  }

  it('UseUpdateUser_ShouldSendTheTagInIfMatch_WhenTheReadTagIsStrong', async () => {
    const config = await update('"v1"');
    expect(config).toStrictEqual({
      url: '/api/v1/admin/users/u1',
      method: 'PUT',
      data: { status: 'Suspended' },
      headers: { 'If-Match': '"v1"' },
    });
  });

  it.each([['W/"v1"'], [null], [undefined]])(
    'UseUpdateUser_ShouldSendNoIfMatch_WhenTheTagIs_%j',
    async (etag) => {
      const config = await update(etag);
      expect(config).toStrictEqual({
        url: '/api/v1/admin/users/u1',
        method: 'PUT',
        data: { status: 'Suspended' },
      });
    },
  );

  it('UseUpdateUser_ShouldSendNoEmail_WhenTheCallerPassesOne', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockUser);
    const { result } = renderHook(() => useUpdateUser(), { wrapper });
    const input = { id: 'u1', displayName: 'Ana', email: 'x@example.com' };
    act(() => {
      result.current.mutate(input);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(vi.mocked(client.customFetch).mock.calls[0]![0].data).toStrictEqual({
      displayName: 'Ana',
    });
  });

  it('UseUpdateUser_ShouldShowUserChangedInvalidateAndNotReportSaved_WhenPlatformAnswers412', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(
      new ApiError(412, { title: 'Precondition Failed', status: 412 }),
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateUser(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      ),
    });
    act(() => {
      result.current.mutate({ id: 'u1', status: 'Suspended', etag: '"v1"' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['users'] });
    expect(toast.success).not.toHaveBeenCalled();
    render(<div data-testid="t">{vi.mocked(toast.error).mock.calls[0]![0] as ReactNode}</div>);
    expect(screen.getByTestId('t').firstElementChild).toHaveAttribute(
      'data-error-code',
      'user-changed',
    );
  });

  it('UseUpdateUser_ShouldKeepTheClientMessage_WhenTheRefusalIsNot412', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new ApiError(400, { error: 'Bad role' }));
    const { result } = renderHook(() => useUpdateUser(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'u1', role: 'Agent' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Bad role');
  });
});

describe.each(TEST_LOCALES)('USER_UPDATE_ERRORS in %s', (lng) => {
  it('UserUpdateErrors_ShouldResolveEveryEntryToATranslation', async () => {
    const i18n = await createLocaleI18n(lng);
    for (const entry of entriesOf(USER_UPDATE_ERRORS)) {
      expect(i18n.exists(entry.key), entry.key).toBe(true);
    }
    expect(i18n.t('admin:users.errors.user_changed')).toBe(
      ADMIN_LOCALES[lng].users.errors.user_changed,
    );
  });
});
