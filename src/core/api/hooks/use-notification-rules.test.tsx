import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  useNotificationRules,
  useNotificationRule,
  useCreateNotificationRule,
  useUpdateNotificationRule,
  useDeleteNotificationRule,
  usePauseNotificationRule,
  useActivateNotificationRule,
  useDryRunNotificationRule,
  useRuleFiringHistory,
  useNotificationEventTypes,
} from './use-notification-rules';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

import { customFetch } from '@/core/api/client';
const mockFetch = vi.mocked(customFetch);

describe('use-notification-rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useNotificationRules fetches list', async () => {
    const rules = [{ ruleId: '1', name: 'Test Rule' }];
    mockFetch.mockResolvedValueOnce(rules);

    const { result } = renderHook(() => useNotificationRules(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(rules);
    expect(mockFetch).toHaveBeenCalledWith({
      url: '/api/v1/notification-rules',
      method: 'GET',
    });
  });

  it('useNotificationRule fetches single rule by id', async () => {
    const rule = { ruleId: 'abc', name: 'Single Rule' };
    mockFetch.mockResolvedValueOnce(rule);

    const { result } = renderHook(() => useNotificationRule('abc'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(rule);
    expect(mockFetch).toHaveBeenCalledWith({
      url: '/api/v1/notification-rules/abc',
      method: 'GET',
    });
  });

  it('useNotificationRule is disabled when id is undefined', () => {
    const { result } = renderHook(() => useNotificationRule(undefined), { wrapper });
    expect(result.current.isFetching).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('useCreateNotificationRule calls POST', async () => {
    mockFetch.mockResolvedValueOnce({ ruleId: '2', name: 'New' });

    const { result } = renderHook(() => useCreateNotificationRule(), { wrapper });
    result.current.mutate({ name: 'New' } as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/api/v1/notification-rules', method: 'POST' }),
    );
  });

  it('useUpdateNotificationRule calls PUT', async () => {
    mockFetch.mockResolvedValueOnce({ ruleId: '1', name: 'Updated' });

    const { result } = renderHook(() => useUpdateNotificationRule(), { wrapper });
    result.current.mutate({ id: '1', data: { name: 'Updated' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/api/v1/notification-rules/1', method: 'PUT' }),
    );
  });

  it('useDeleteNotificationRule calls DELETE', async () => {
    mockFetch.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDeleteNotificationRule(), { wrapper });
    result.current.mutate('1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/api/v1/notification-rules/1', method: 'DELETE' }),
    );
  });

  it('usePauseNotificationRule calls PUT /pause', async () => {
    mockFetch.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => usePauseNotificationRule(), { wrapper });
    result.current.mutate('rule-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/api/v1/notification-rules/rule-1/pause', method: 'PUT' }),
    );
  });

  it('useActivateNotificationRule calls PUT /activate', async () => {
    mockFetch.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useActivateNotificationRule(), { wrapper });
    result.current.mutate('rule-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/v1/notification-rules/rule-1/activate',
        method: 'PUT',
      }),
    );
  });

  it('useDryRunNotificationRule calls POST /dry-run', async () => {
    const dryRunResult = { estimatedFireCount: 5, matchingEvents: [], estimatedRecipients: [] };
    mockFetch.mockResolvedValueOnce(dryRunResult);

    const { result } = renderHook(() => useDryRunNotificationRule(), { wrapper });
    result.current.mutate('rule-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(dryRunResult);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/v1/notification-rules/rule-1/dry-run',
        method: 'POST',
      }),
    );
  });

  it('useRuleFiringHistory fetches paginated history', async () => {
    const history = { items: [{ firingId: 'f1' }], totalCount: 1, page: 1, pageSize: 20 };
    mockFetch.mockResolvedValueOnce(history);

    const { result } = renderHook(() => useRuleFiringHistory('rule-1', 1, 20), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(history);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/v1/notification-rules/rule-1/history',
        method: 'GET',
        params: { page: '1', pageSize: '20' },
      }),
    );
  });

  it('useNotificationEventTypes fetches event catalog', async () => {
    const types = [{ eventType: 'queue.threshold', description: 'Queue threshold exceeded' }];
    mockFetch.mockResolvedValueOnce(types);

    const { result } = renderHook(() => useNotificationEventTypes(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(types);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/api/v1/notification-rules/event-types', method: 'GET' }),
    );
  });
});
