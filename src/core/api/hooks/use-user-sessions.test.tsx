import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '@/core/api/client';
import type { UserSessionDto } from './use-user-sessions';
import { useUserSessions, useRevokeUserSession } from './use-user-sessions';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const mockSessions: UserSessionDto[] = [
  {
    sessionId: 's1',
    device: 'Chrome on Linux',
    ipAddress: '192.168.1.1',
    location: 'US',
    createdAt: '2026-01-01T00:00:00Z',
    lastActivity: '2026-01-02T00:00:00Z',
    isCurrentSession: true,
  },
  {
    sessionId: 's2',
    device: 'Firefox on Windows',
    ipAddress: '10.0.0.1',
    location: null,
    createdAt: '2026-01-01T00:00:00Z',
    lastActivity: '2026-01-01T12:00:00Z',
    isCurrentSession: false,
  },
];

describe('useUserSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch sessions from GET /api/v1/profile/security/sessions/', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockSessions);

    const { result } = renderHook(() => useUserSessions(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockSessions);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/profile/security/sessions/',
      method: 'GET',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Unauthorized'));

    const { result } = renderHook(() => useUserSessions(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Unauthorized');
  });
});

describe('useRevokeUserSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call POST /api/v1/profile/security/sessions/{id}/revoke', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);

    const { result } = renderHook(() => useRevokeUserSession(), { wrapper });

    act(() => {
      result.current.mutate('s2');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/profile/security/sessions/s2/revoke',
      method: 'POST',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Session not found'));

    const { result } = renderHook(() => useRevokeUserSession(), { wrapper });

    act(() => {
      result.current.mutate('bad-id');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Session not found');
  });
});
