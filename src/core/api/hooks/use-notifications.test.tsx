import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@/core/api/client', () => ({
  customFetch: vi.fn(),
}));

import { customFetch } from '@/core/api/client';
import {
  useNotifications,
  useUnreadCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type Notification,
} from './use-notifications';

const mockFetch = customFetch as ReturnType<typeof vi.fn>;

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const sample: Notification = {
  notificationId: 'n-1',
  type: 'billing.quota_warning',
  category: 'Billing',
  severity: 'Warning',
  title: 'Quota warning',
  body: 'You are at 85% of monthly limit',
  actionUrl: '/admin/billing/usage',
  isRead: false,
  createdAt: '2026-04-10T12:00:00Z',
  readAt: null,
};

describe('useNotifications', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should_FetchNotifications_WhenCalled', async () => {
    mockFetch.mockResolvedValueOnce([sample]);

    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sample]);
    expect(mockFetch).toHaveBeenCalledWith({
      url: '/api/v1/notifications',
      method: 'GET',
      params: {},
    });
  });

  it('should_PassUnreadOnlyParam_WhenRequested', async () => {
    mockFetch.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useNotifications({ unreadOnly: true, limit: 20 }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith({
      url: '/api/v1/notifications',
      method: 'GET',
      params: { unreadOnly: 'true', limit: '20' },
    });
  });
});

describe('useUnreadCount', () => {
  beforeEach(() => mockFetch.mockReset());

  it('should_ReturnCount_WhenCalled', async () => {
    mockFetch.mockResolvedValueOnce({ count: 3 });

    const { result } = renderHook(() => useUnreadCount(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ count: 3 });
    expect(mockFetch).toHaveBeenCalledWith({
      url: '/api/v1/notifications/unread-count',
      method: 'GET',
    });
  });

  // (The former `should_CoerceStringCount_ToNumber_WhenWireSendsAotUnion` test is
  // retired: `UnreadCountDto.count` is now single-typed `number` on the regenerated
  // document — the AOT `number | string` union is extinct at the source
  // (openapi-numeric-schema-truth, Platform/ADR-0036), so there is no boundary
  // coercion left to assert.)
});

describe('useMarkNotificationRead', () => {
  beforeEach(() => mockFetch.mockReset());

  it('should_CallPutEndpoint_WhenMutated', async () => {
    mockFetch.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useMarkNotificationRead(), { wrapper });
    result.current.mutate('n-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith({
      url: '/api/v1/notifications/n-1/read',
      method: 'PUT',
    });
  });

  it('should_OptimisticallyMarkReadAndDecrementCount_WhenCacheSeeded', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(
      ['notifications', 'list', {}],
      [{ ...sample, notificationId: 'n-1', isRead: false }],
    );
    qc.setQueryData(['notifications', 'unread-count'], { count: 3 });
    mockFetch.mockResolvedValueOnce(undefined);
    const seededWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useMarkNotificationRead(), { wrapper: seededWrapper });
    result.current.mutate('n-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(qc.getQueryData<Notification[]>(['notifications', 'list', {}])?.[0]?.isRead).toBe(true);
    expect(qc.getQueryData(['notifications', 'unread-count'])).toEqual({ count: 2 });
  });
});

describe('useMarkAllNotificationsRead', () => {
  beforeEach(() => mockFetch.mockReset());

  it('should_CallReadAllEndpoint_WhenMutated', async () => {
    mockFetch.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useMarkAllNotificationsRead(), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith({
      url: '/api/v1/notifications/read-all',
      method: 'PUT',
    });
  });

  it('should_OptimisticallyMarkAllReadAndZeroCount_WhenCacheSeeded', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(['notifications', 'list', {}], [{ ...sample, isRead: false }]);
    qc.setQueryData(['notifications', 'unread-count'], { count: 5 });
    mockFetch.mockResolvedValueOnce(undefined);
    const seededWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useMarkAllNotificationsRead(), { wrapper: seededWrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(
      qc.getQueryData<Notification[]>(['notifications', 'list', {}])?.every((n) => n.isRead),
    ).toBe(true);
    expect(qc.getQueryData(['notifications', 'unread-count'])).toEqual({ count: 0 });
  });
});
