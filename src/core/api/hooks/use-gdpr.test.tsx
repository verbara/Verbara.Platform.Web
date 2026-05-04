import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '@/core/api/client';
import type {
  GdprExportResult,
  PurgeResult,
  PurgePreview,
  RetentionPolicy,
  UpdateRetentionPolicyRequest,
} from './use-gdpr';
import {
  useGdprExport,
  useGdprPurge,
  usePurgeLog,
  usePurgePreview,
  useGdprPurgeUser,
  useRetentionPolicy,
  useUpdateRetentionPolicy,
} from './use-gdpr';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useGdprExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call POST /api/v1/admin/gdpr/export with contactId', async () => {
    const response: GdprExportResult = {
      contact: {},
      conversations: [],
      messages: [],
      authEvents: [],
      auditEntries: [],
    };
    vi.mocked(client.customFetch).mockResolvedValue(response);

    const { result } = renderHook(() => useGdprExport(), { wrapper });

    act(() => {
      result.current.mutate({ contactId: 'c1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(response);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/gdpr/export',
      method: 'POST',
      data: { contactId: 'c1' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useGdprExport(), { wrapper });

    act(() => {
      result.current.mutate({ contactId: 'bad' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Not found');
  });
});

describe('useGdprPurge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call POST /api/v1/admin/gdpr/purge', async () => {
    const response: PurgeResult = {
      purgeId: 'p1',
      tenantId: 't1',
      subjectType: 'contact',
      subjectId: 'c1',
      performedBy: 'admin',
      reason: 'GDPR request',
      entitiesDeleted: { messages: 10 },
      purgedAt: '2026-01-01T00:00:00Z',
    };
    vi.mocked(client.customFetch).mockResolvedValue(response);

    const { result } = renderHook(() => useGdprPurge(), { wrapper });

    act(() => {
      result.current.mutate({ contactId: 'c1', reason: 'GDPR request' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/gdpr/purge',
      method: 'POST',
      data: { contactId: 'c1', reason: 'GDPR request' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Forbidden'));

    const { result } = renderHook(() => useGdprPurge(), { wrapper });

    act(() => {
      result.current.mutate({ contactId: 'c1', reason: 'test' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('usePurgeLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch purge log with params', async () => {
    const response = { items: [], totalCount: 0, page: 1, pageSize: 50 };
    vi.mocked(client.customFetch).mockResolvedValue(response);

    const { result } = renderHook(
      () => usePurgeLog({ tenantId: 't1', from: '2026-01-01', to: '2026-01-31' }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/gdpr/purge-log',
      method: 'GET',
      params: { tenantId: 't1', from: '2026-01-01', to: '2026-01-31' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => usePurgeLog(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('usePurgePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch purge preview when userId is provided', async () => {
    const response: PurgePreview = {
      conversations: 5,
      messages: 100,
      authEvents: 3,
      auditEntries: 2,
    };
    vi.mocked(client.customFetch).mockResolvedValue(response);

    const { result } = renderHook(() => usePurgePreview('user-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(response);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/gdpr/purge-preview',
      method: 'GET',
      params: { userId: 'user-1' },
    });
  });

  it('should not fetch when userId is undefined', () => {
    const { result } = renderHook(() => usePurgePreview(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(client.customFetch).not.toHaveBeenCalled();
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => usePurgePreview('bad-id'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useGdprPurgeUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call POST /api/v1/admin/gdpr/purge-user', async () => {
    const response: PurgeResult = {
      purgeId: 'p2',
      tenantId: 't1',
      subjectType: 'user',
      subjectId: 'u1',
      performedBy: 'admin',
      reason: 'Account deletion',
      entitiesDeleted: { users: 1 },
      purgedAt: '2026-01-01T00:00:00Z',
    };
    vi.mocked(client.customFetch).mockResolvedValue(response);

    const { result } = renderHook(() => useGdprPurgeUser(), { wrapper });

    act(() => {
      result.current.mutate({ userId: 'u1', reason: 'Account deletion' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/gdpr/purge-user',
      method: 'POST',
      data: { userId: 'u1', reason: 'Account deletion' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Forbidden'));

    const { result } = renderHook(() => useGdprPurgeUser(), { wrapper });

    act(() => {
      result.current.mutate({ userId: 'u1', reason: 'test' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useRetentionPolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch retention policy for a tenant', async () => {
    const response: RetentionPolicy = {
      tenantId: 't1',
      conversationRetentionDays: 90,
      authEventRetentionDays: 365,
      auditRetentionDays: 730,
      usageRecordRetentionDays: 180,
    };
    vi.mocked(client.customFetch).mockResolvedValue(response);

    const { result } = renderHook(() => useRetentionPolicy('t1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(response);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/tenants/t1/retention',
      method: 'GET',
    });
  });

  it('should not fetch when tenantId is empty string', () => {
    const { result } = renderHook(() => useRetentionPolicy(''), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(client.customFetch).not.toHaveBeenCalled();
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useRetentionPolicy('bad-tenant'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateRetentionPolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call PUT /api/v1/management/tenants/{tenantId}/retention', async () => {
    const response: RetentionPolicy = {
      tenantId: 't1',
      conversationRetentionDays: 60,
      authEventRetentionDays: 365,
      auditRetentionDays: 730,
      usageRecordRetentionDays: 90,
    };
    vi.mocked(client.customFetch).mockResolvedValue(response);

    const { result } = renderHook(() => useUpdateRetentionPolicy('t1'), { wrapper });

    const data: UpdateRetentionPolicyRequest = {
      conversationRetentionDays: 60,
      usageRecordRetentionDays: 90,
    };
    act(() => {
      result.current.mutate(data);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/tenants/t1/retention',
      method: 'PUT',
      data,
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Validation failed'));

    const { result } = renderHook(() => useUpdateRetentionPolicy('t1'), { wrapper });

    act(() => {
      result.current.mutate({ conversationRetentionDays: -1 });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Validation failed');
  });
});
