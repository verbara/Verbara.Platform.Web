import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMe, isLockedOut, type Me } from './use-me';
import * as client from '@/core/api/client';

vi.mock('@/core/api/client', () => ({
  customFetch: vi.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const sampleMe: Me = {
  id: 'user1',
  email: 'test@example.com',
  displayName: 'Test User',
  role: 'Agent',
  status: 'Active',
  mfaEnabled: true,
  mfaConfirmedAt: '2026-04-01T10:00:00Z',
  emailVerified: true,
  failedLoginAttempts: 0,
  lockedUntil: null,
  passwordChangedAt: '2026-03-15T08:00:00Z',
  lastLoginAt: '2026-04-10T09:30:00Z',
  authProvider: 'local',
  externalId: null,
  oidcSubject: null,
};

describe('useMe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch and return user when called', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleMe);
    const { result } = renderHook(() => useMe(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleMe);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/users/me',
      method: 'GET',
    });
  });

  it('should cache between renders when called', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleMe);
    const { result, rerender } = renderHook(() => useMe(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const firstData = result.current.data;
    rerender();
    expect(result.current.data).toBe(firstData);
  });

  it('should return isLockedOut=false when lockedUntil is null', () => {
    expect(isLockedOut({ ...sampleMe, lockedUntil: null })).toBe(false);
  });

  it('should return isLockedOut=true when lockedUntil is in the future', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isLockedOut({ ...sampleMe, lockedUntil: future })).toBe(true);
  });

  it('should return isLockedOut=false when lockedUntil is in the past', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(isLockedOut({ ...sampleMe, lockedUntil: past })).toBe(false);
  });
});
