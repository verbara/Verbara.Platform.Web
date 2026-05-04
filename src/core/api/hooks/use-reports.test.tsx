import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import * as client from '@/core/api/client';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

import {
  useReports,
  useReport,
  useCreateReport,
  useUpdateReport,
  useDeleteReport,
  useRunReport,
  useReportHistory,
} from './use-reports';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useReports', () => {
  it('should fetch all reports', async () => {
    const mockData = [
      {
        id: 'r1',
        name: 'Agent Performance',
        type: 'agent_performance',
        schedule: 'daily',
        format: 'CSV',
        isActive: true,
        createdAt: '2026-01-01',
      },
    ];
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(() => useReports(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/reports',
      method: 'GET',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useReports(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Network error');
  });
});

describe('useReport', () => {
  it('should fetch a single report by id', async () => {
    const mockData = {
      id: 'r1',
      name: 'Agent Performance',
      type: 'agent_performance',
      schedule: 'daily',
      format: 'CSV',
      isActive: true,
      createdAt: '2026-01-01',
    };
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(() => useReport('r1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/reports/r1',
      method: 'GET',
    });
  });

  it('should be disabled when id is undefined', () => {
    const { result } = renderHook(() => useReport(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useCreateReport', () => {
  it('should create a report', async () => {
    const created = {
      id: 'r2',
      name: 'Queue Analytics',
      type: 'queue_analytics',
      schedule: 'weekly',
      format: 'PDF',
      isActive: true,
      createdAt: '2026-01-15',
    };
    vi.mocked(client.customFetch).mockResolvedValue(created);

    const { result } = renderHook(() => useCreateReport(), { wrapper });

    act(() => {
      result.current.mutate({
        name: 'Queue Analytics',
        type: 'queue_analytics',
        schedule: 'weekly',
        format: 'PDF',
        isActive: true,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/reports',
      method: 'POST',
      data: {
        name: 'Queue Analytics',
        type: 'queue_analytics',
        schedule: 'weekly',
        format: 'PDF',
        isActive: true,
      },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('creation failed'));

    const { result } = renderHook(() => useCreateReport(), { wrapper });

    act(() => {
      result.current.mutate({
        name: 'Fail',
        type: 'agent_performance',
        schedule: 'daily',
        format: 'CSV',
        isActive: true,
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateReport', () => {
  it('should update a report', async () => {
    const updated = {
      id: 'r1',
      name: 'Updated Report',
      type: 'agent_performance',
      schedule: 'weekly',
      format: 'PDF',
      isActive: true,
      createdAt: '2026-01-01',
    };
    vi.mocked(client.customFetch).mockResolvedValue(updated);

    const { result } = renderHook(() => useUpdateReport(), { wrapper });

    act(() => {
      result.current.mutate({
        id: 'r1',
        name: 'Updated Report',
        schedule: 'weekly',
        format: 'PDF',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/reports/r1',
      method: 'PUT',
      data: { name: 'Updated Report', schedule: 'weekly', format: 'PDF' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('update failed'));

    const { result } = renderHook(() => useUpdateReport(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'r1', name: 'Fail' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteReport', () => {
  it('should delete a report', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteReport(), { wrapper });

    act(() => {
      result.current.mutate('r1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/reports/r1',
      method: 'DELETE',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('delete failed'));

    const { result } = renderHook(() => useDeleteReport(), { wrapper });

    act(() => {
      result.current.mutate('r1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useRunReport', () => {
  it('should run a report', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);

    const { result } = renderHook(() => useRunReport(), { wrapper });

    act(() => {
      result.current.mutate('r1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/reports/r1/run',
      method: 'POST',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('run failed'));

    const { result } = renderHook(() => useRunReport(), { wrapper });

    act(() => {
      result.current.mutate('r1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useReportHistory', () => {
  it('should fetch report history', async () => {
    const mockData = [
      {
        id: 'exec1',
        reportId: 'r1',
        status: 'Completed',
        startedAt: '2026-01-15T10:00:00Z',
        completedAt: '2026-01-15T10:05:00Z',
        error: null,
      },
    ];
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(() => useReportHistory('r1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/reports/r1/history',
      method: 'GET',
      params: { limit: '25' },
    });
  });

  it('should be disabled when reportId is undefined', () => {
    const { result } = renderHook(() => useReportHistory(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});
