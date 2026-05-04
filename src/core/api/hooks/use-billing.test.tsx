import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import * as client from '@/core/api/client';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));
vi.mock('@/core/tenant/tenant-store', () => ({
  useTenantStore: Object.assign(
    (selector: (s: { activeTenantId: string }) => string) =>
      selector({ activeTenantId: 'tenant-1' }),
    {
      getState: () => ({ activeTenantId: 'tenant-1' }),
    },
  ),
}));
vi.mock('@/core/auth/auth-store', () => ({
  useAuthStore: Object.assign(
    (selector: (s: { tenantId: string; accessToken: string }) => string) =>
      selector({ tenantId: 'tenant-1', accessToken: 'tok' }),
    {
      getState: () => ({ accessToken: 'tok', tenantId: 'tenant-1' }),
    },
  ),
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

import {
  useRateCards,
  useCreateRateCard,
  useInvoices,
  useInvoice,
  useGenerateInvoice,
  useUsageSummary,
  useQuotaStatus,
  useUpdateQuota,
  useDeleteRateCard,
  useUpdateRateCard,
  useUsageDetails,
  useIssueInvoice,
  usePayInvoice,
  useDunningStatus,
  useUpdateDunningStatus,
} from './use-billing';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useRateCards', () => {
  it('should fetch rate cards', async () => {
    const mockData = [
      {
        rateCardId: 'rc1',
        tenantId: 'tenant-1',
        name: 'Standard',
        currency: 'USD',
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
        isDefault: true,
        rates: [],
      },
    ];
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(() => useRateCards(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/rate-cards',
      method: 'GET',
      params: { tenantId: 'tenant-1' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useRateCards(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateRateCard', () => {
  it('should create a rate card', async () => {
    const created = {
      rateCardId: 'rc2',
      tenantId: 'tenant-1',
      name: 'Premium',
      currency: 'USD',
      effectiveFrom: '2026-02-01',
      effectiveTo: null,
      isDefault: false,
      rates: [],
    };
    vi.mocked(client.customFetch).mockResolvedValue(created);

    const { result } = renderHook(() => useCreateRateCard(), { wrapper });

    act(() => {
      result.current.mutate({
        name: 'Premium',
        currency: 'USD',
        effectiveFrom: '2026-02-01',
        effectiveTo: null,
        isDefault: false,
        rates: [],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/rate-cards',
      method: 'POST',
      params: { tenantId: 'tenant-1' },
      data: {
        name: 'Premium',
        currency: 'USD',
        effectiveFrom: '2026-02-01',
        effectiveTo: null,
        isDefault: false,
        rates: [],
      },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('creation failed'));

    const { result } = renderHook(() => useCreateRateCard(), { wrapper });

    act(() => {
      result.current.mutate({
        name: 'Fail',
        currency: 'USD',
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
        isDefault: false,
        rates: [],
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateRateCard', () => {
  it('should update a rate card', async () => {
    const updated = {
      rateCardId: 'rc1',
      tenantId: 'tenant-1',
      name: 'Updated',
      currency: 'USD',
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      isDefault: true,
      rates: [],
    };
    vi.mocked(client.customFetch).mockResolvedValue(updated);

    const { result } = renderHook(() => useUpdateRateCard(), { wrapper });

    act(() => {
      result.current.mutate({
        id: 'rc1',
        name: 'Updated',
        currency: 'USD',
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
        isDefault: true,
        rates: [],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/rate-cards/rc1',
      method: 'PUT',
      params: { tenantId: 'tenant-1' },
      data: {
        name: 'Updated',
        currency: 'USD',
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
        isDefault: true,
        rates: [],
      },
    });
  });
});

describe('useDeleteRateCard', () => {
  it('should delete a rate card', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteRateCard(), { wrapper });

    act(() => {
      result.current.mutate('rc1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/rate-cards/rc1',
      method: 'DELETE',
      params: { tenantId: 'tenant-1' },
    });
  });
});

describe('useInvoices', () => {
  it('should fetch invoices', async () => {
    const mockData = [
      {
        invoiceId: 'inv1',
        tenantId: 'tenant-1',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        currency: 'USD',
        lineItems: [],
        subtotal: 100,
        tax: 10,
        total: 110,
        status: 'Draft',
        generatedAt: '2026-02-01',
        issuedAt: null,
        paidAt: null,
      },
    ];
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(() => useInvoices(1, 20), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/invoices',
      method: 'GET',
      params: { tenantId: 'tenant-1', page: '1', pageSize: '20' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useInvoices(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useInvoice', () => {
  it('should fetch a single invoice', async () => {
    const mockData = {
      invoiceId: 'inv1',
      tenantId: 'tenant-1',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      currency: 'USD',
      lineItems: [],
      subtotal: 100,
      tax: 10,
      total: 110,
      status: 'Draft',
      generatedAt: '2026-02-01',
      issuedAt: null,
      paidAt: null,
    };
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(() => useInvoice('inv1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/invoices/inv1',
      method: 'GET',
      params: { tenantId: 'tenant-1' },
    });
  });

  it('should be disabled when id is empty', () => {
    const { result } = renderHook(() => useInvoice(''), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useGenerateInvoice', () => {
  it('should generate an invoice', async () => {
    const generated = {
      invoiceId: 'inv2',
      tenantId: 'tenant-1',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      currency: 'USD',
      lineItems: [],
      subtotal: 200,
      tax: 20,
      total: 220,
      status: 'Draft',
      generatedAt: '2026-02-01',
      issuedAt: null,
      paidAt: null,
    };
    vi.mocked(client.customFetch).mockResolvedValue(generated);

    const { result } = renderHook(() => useGenerateInvoice(), { wrapper });

    act(() => {
      result.current.mutate({ periodStart: '2026-01-01', periodEnd: '2026-01-31' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/invoices/generate',
      method: 'POST',
      params: { tenantId: 'tenant-1' },
      data: { periodStart: '2026-01-01', periodEnd: '2026-01-31' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('generation failed'));

    const { result } = renderHook(() => useGenerateInvoice(), { wrapper });

    act(() => {
      result.current.mutate({ periodStart: '2026-01-01', periodEnd: '2026-01-31' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useIssueInvoice', () => {
  it('should issue an invoice', async () => {
    vi.mocked(client.customFetch).mockResolvedValue({ invoiceId: 'inv1', status: 'Issued' });

    const { result } = renderHook(() => useIssueInvoice(), { wrapper });

    act(() => {
      result.current.mutate('inv1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/invoices/inv1/issue',
      method: 'POST',
      params: { tenantId: 'tenant-1' },
    });
  });
});

describe('usePayInvoice', () => {
  it('should pay an invoice', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);

    const { result } = renderHook(() => usePayInvoice(), { wrapper });

    act(() => {
      result.current.mutate('inv1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/invoices/inv1/pay',
      method: 'POST',
    });
  });
});

describe('useUsageSummary', () => {
  it('should fetch usage summary', async () => {
    const mockData = [
      {
        usageType: 'VoiceInbound',
        totalQuantity: 1000,
        recordCount: 500,
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        lastUpdatedAt: '2026-01-31',
      },
    ];
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(() => useUsageSummary('2026-01-01', '2026-01-31'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/tenants/tenant-1/usage',
      method: 'GET',
      params: { from: '2026-01-01', until: '2026-01-31' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useUsageSummary(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUsageDetails', () => {
  it('should fetch usage details', async () => {
    const mockData = [
      {
        recordId: 'r1',
        usageType: 'VoiceInbound',
        quantity: 5,
        unit: 'minutes',
        channel: null,
        referenceId: null,
        recordedAt: '2026-01-15',
      },
    ];
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(
      () =>
        useUsageDetails({
          from: '2026-01-01',
          until: '2026-01-31',
          type: 'VoiceInbound',
          page: 1,
          pageSize: 50,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/tenants/tenant-1/usage/details',
      method: 'GET',
      params: {
        from: '2026-01-01',
        until: '2026-01-31',
        type: 'VoiceInbound',
        page: '1',
        pageSize: '50',
      },
    });
  });
});

describe('useQuotaStatus', () => {
  it('should fetch quota status', async () => {
    const mockData = {
      tenantId: 'tenant-1',
      quota: {
        maxConcurrentChannels: 50,
        maxActiveCampaigns: 5,
        maxMonthlyVoiceMinutes: 10000,
        maxMonthlyMessages: null,
        maxStorageBytes: null,
        maxActiveAgents: null,
        quotaAction: 'Warn',
      },
      currentUsage: [],
    };
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(() => useQuotaStatus(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/tenants/tenant-1/quota',
      method: 'GET',
    });
  });
});

describe('useUpdateQuota', () => {
  it('should update quota', async () => {
    const updated = {
      maxConcurrentChannels: 100,
      maxActiveCampaigns: 10,
      maxMonthlyVoiceMinutes: 20000,
      maxMonthlyMessages: null,
      maxStorageBytes: null,
      maxActiveAgents: null,
      quotaAction: 'SoftBlock',
    };
    vi.mocked(client.customFetch).mockResolvedValue(updated);

    const { result } = renderHook(() => useUpdateQuota(), { wrapper });

    act(() => {
      result.current.mutate({
        maxConcurrentChannels: 100,
        maxActiveCampaigns: 10,
        quotaAction: 'SoftBlock',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/tenants/tenant-1/quota',
      method: 'PUT',
      data: { maxConcurrentChannels: 100, maxActiveCampaigns: 10, quotaAction: 'SoftBlock' },
    });
  });
});

describe('useDunningStatus', () => {
  it('should fetch dunning status', async () => {
    const mockData = {
      isActive: true,
      phase: 'reminder',
      daysOverdue: 15,
      overdueAmount: 500,
      invoiceId: 'inv1',
    };
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(() => useDunningStatus('tenant-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/tenants/tenant-1/dunning',
      method: 'GET',
    });
  });

  it('should be disabled when tenantId is undefined', () => {
    const { result } = renderHook(() => useDunningStatus(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useUpdateDunningStatus', () => {
  it('should pause dunning', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);

    const { result } = renderHook(() => useUpdateDunningStatus('tenant-1'), { wrapper });

    act(() => {
      result.current.mutate({ paused: true, reason: 'Customer requested extension' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/tenants/tenant-1/dunning/pause',
      method: 'POST',
      data: { reason: 'Customer requested extension' },
    });
  });

  it('should resume dunning', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);

    const { result } = renderHook(() => useUpdateDunningStatus('tenant-1'), { wrapper });

    act(() => {
      result.current.mutate({ paused: false });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/tenants/tenant-1/dunning/resume',
      method: 'POST',
      data: undefined,
    });
  });
});
