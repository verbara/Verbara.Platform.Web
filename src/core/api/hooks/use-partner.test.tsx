import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  usePartnerCustomers,
  usePartnerCustomer,
  useCreatePartnerCustomer,
  useUpdatePartnerCustomer,
  useSuspendCustomer,
  useActivateCustomer,
  useCustomerSettings,
  useUpdateCustomerSettings,
  usePartnerRateCards,
  useCreatePartnerRateCard,
  useUpdatePartnerRateCard,
  useDeletePartnerRateCard,
  useCustomerInvoices,
  useGeneratePartnerInvoice,
  useCustomerUsage,
  usePartnerRevenueSummary,
  usePartnerRevenueDetails,
  usePartnerSettings,
  useUpdatePartnerSettings,
} from './use-partner';
import type {
  PartnerCustomer,
  PartnerRevenueSummary,
  PartnerRevenueDetail,
  TenantSettings,
} from './use-partner';
import * as client from '@/core/api/client';

vi.mock('@/core/api/client', () => ({
  customFetch: vi.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const sampleCustomer: PartnerCustomer = {
  tenantId: 'tenant-1',
  name: 'Acme Corp',
  status: 'active',
  plan: 'Pro',
  createdAt: '2026-01-01T00:00:00Z',
};

const sampleRateCard = {
  rateCardId: 'rc-1',
  tenantId: 'tenant-1',
  name: 'Standard',
  currency: 'USD',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  isDefault: true,
  rates: [],
};

const sampleInvoice = {
  invoiceId: 'inv-1',
  tenantId: 'tenant-1',
  periodStart: '2026-01-01',
  periodEnd: '2026-01-31',
  currency: 'USD',
  lineItems: [],
  subtotal: 100,
  tax: 10,
  total: 110,
  status: 'issued',
  generatedAt: '2026-02-01T00:00:00Z',
  issuedAt: '2026-02-01T00:00:00Z',
  paidAt: null,
};

const sampleUsage = {
  usageType: 'voice_minutes',
  totalQuantity: 500,
  recordCount: 20,
  periodStart: '2026-01-01',
  periodEnd: '2026-01-31',
  lastUpdatedAt: '2026-01-31T23:59:59Z',
};

const sampleRevenueSummary: PartnerRevenueSummary = {
  totalGross: 10000,
  totalPlatformCost: 3000,
  totalMargin: 7000,
  customerCount: 5,
  invoiceCount: 10,
};

const sampleRevenueDetail: PartnerRevenueDetail = {
  revenueId: 'rev-1',
  customerTenantId: 'tenant-1',
  invoiceId: 'inv-1',
  grossAmount: 2000,
  platformCost: 600,
  partnerMargin: 1400,
  periodStart: '2026-01-01',
  periodEnd: '2026-01-31',
};

const sampleSettings: TenantSettings = {
  platformName: 'My Platform',
  defaultTimezone: 'America/New_York',
  defaultLanguage: 'en',
};

describe('usePartnerCustomers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch partner customers', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([sampleCustomer]);
    const { result } = renderHook(() => usePartnerCustomers(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleCustomer]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/partner/customers',
      method: 'GET',
      params: {},
    });
  });

  it('should pass status and plan filters', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([]);
    const { result } = renderHook(() => usePartnerCustomers('active', 'Pro'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/partner/customers',
      method: 'GET',
      params: { status: 'active', plan: 'Pro' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Fetch failed'));
    const { result } = renderHook(() => usePartnerCustomers(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('usePartnerCustomer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch a single customer', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleCustomer);
    const { result } = renderHook(() => usePartnerCustomer('tenant-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleCustomer);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/partner/customers/tenant-1',
      method: 'GET',
    });
  });

  it('should not fetch when customerId is empty', () => {
    const { result } = renderHook(() => usePartnerCustomer(''), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Not found'));
    const { result } = renderHook(() => usePartnerCustomer('tenant-1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreatePartnerCustomer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a partner customer', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleCustomer);
    const { result } = renderHook(() => useCreatePartnerCustomer(), { wrapper });
    act(() => {
      result.current.mutate({ tenantId: 'tenant-1', name: 'Acme Corp', plan: 'Pro' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/partner/customers',
      method: 'POST',
      data: { tenantId: 'tenant-1', name: 'Acme Corp', plan: 'Pro' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Create failed'));
    const { result } = renderHook(() => useCreatePartnerCustomer(), { wrapper });
    act(() => {
      result.current.mutate({ tenantId: 'tenant-1', name: 'Acme' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdatePartnerCustomer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update a partner customer', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleCustomer);
    const { result } = renderHook(() => useUpdatePartnerCustomer(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'tenant-1', name: 'Acme Updated', maxConcurrentChannels: 50 });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/partner/customers/tenant-1',
      method: 'PUT',
      data: { name: 'Acme Updated', maxConcurrentChannels: 50 },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Update failed'));
    const { result } = renderHook(() => useUpdatePartnerCustomer(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'tenant-1', name: 'X' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useSuspendCustomer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should suspend a customer', async () => {
    vi.mocked(client.customFetch).mockResolvedValue({ tenantId: 'tenant-1', status: 'suspended' });
    const { result } = renderHook(() => useSuspendCustomer(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'tenant-1', reason: 'Non-payment' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/partner/customers/tenant-1/suspend',
      method: 'POST',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Suspend failed'));
    const { result } = renderHook(() => useSuspendCustomer(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'tenant-1', reason: 'Test' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useActivateCustomer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should activate a customer', async () => {
    vi.mocked(client.customFetch).mockResolvedValue({ tenantId: 'tenant-1', status: 'active' });
    const { result } = renderHook(() => useActivateCustomer(), { wrapper });
    act(() => {
      result.current.mutate('tenant-1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/partner/customers/tenant-1/activate',
      method: 'POST',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Activate failed'));
    const { result } = renderHook(() => useActivateCustomer(), { wrapper });
    act(() => {
      result.current.mutate('tenant-1');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCustomerSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch customer settings', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleSettings);
    const { result } = renderHook(() => useCustomerSettings('tenant-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleSettings);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/partner/customers/tenant-1/settings',
      method: 'GET',
    });
  });

  it('should not fetch when customerId is empty', () => {
    const { result } = renderHook(() => useCustomerSettings(''), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Fetch failed'));
    const { result } = renderHook(() => useCustomerSettings('tenant-1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateCustomerSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update customer settings', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleSettings);
    const { result } = renderHook(() => useUpdateCustomerSettings(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'tenant-1', platformName: 'Updated Platform' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/partner/customers/tenant-1/settings',
      method: 'PUT',
      data: { platformName: 'Updated Platform' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Update failed'));
    const { result } = renderHook(() => useUpdateCustomerSettings(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'tenant-1', defaultTimezone: 'UTC' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('usePartnerRateCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch partner rate cards', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([sampleRateCard]);
    const { result } = renderHook(() => usePartnerRateCards(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleRateCard]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/partner/rate-cards',
      method: 'GET',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Fetch failed'));
    const { result } = renderHook(() => usePartnerRateCards(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreatePartnerRateCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a rate card', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleRateCard);
    const { result } = renderHook(() => useCreatePartnerRateCard(), { wrapper });
    const input = {
      name: 'Standard',
      currency: 'USD',
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      isDefault: true,
      rates: [],
    };
    act(() => {
      result.current.mutate(input);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/partner/rate-cards',
      method: 'POST',
      data: input,
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Create failed'));
    const { result } = renderHook(() => useCreatePartnerRateCard(), { wrapper });
    act(() => {
      result.current.mutate({
        name: 'X',
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

describe('useUpdatePartnerRateCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update a rate card', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleRateCard);
    const { result } = renderHook(() => useUpdatePartnerRateCard(), { wrapper });
    act(() => {
      result.current.mutate({
        id: 'rc-1',
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
      url: '/api/v1/partner/rate-cards/rc-1',
      method: 'PUT',
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

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Update failed'));
    const { result } = renderHook(() => useUpdatePartnerRateCard(), { wrapper });
    act(() => {
      result.current.mutate({
        id: 'rc-1',
        name: 'X',
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

describe('useDeletePartnerRateCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete a rate card', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeletePartnerRateCard(), { wrapper });
    act(() => {
      result.current.mutate('rc-1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/partner/rate-cards/rc-1',
      method: 'DELETE',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Delete failed'));
    const { result } = renderHook(() => useDeletePartnerRateCard(), { wrapper });
    act(() => {
      result.current.mutate('rc-1');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCustomerInvoices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch customer invoices', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([sampleInvoice]);
    const { result } = renderHook(() => useCustomerInvoices('tenant-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleInvoice]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/partner/customers/tenant-1/invoices',
      method: 'GET',
      params: { page: '1', pageSize: '20' },
    });
  });

  it('should not fetch when customerId is empty', () => {
    const { result } = renderHook(() => useCustomerInvoices(''), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Fetch failed'));
    const { result } = renderHook(() => useCustomerInvoices('tenant-1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useGeneratePartnerInvoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate a partner invoice', async () => {
    const response = {
      invoice: sampleInvoice,
      revenue: { grossAmount: 100, platformCost: 30, partnerMargin: 70 },
    };
    vi.mocked(client.customFetch).mockResolvedValue(response);
    const { result } = renderHook(() => useGeneratePartnerInvoice('tenant-1'), { wrapper });
    act(() => {
      result.current.mutate({ from: '2026-01-01', to: '2026-01-31' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/partner/customers/tenant-1/invoices/generate',
      method: 'POST',
      params: { from: '2026-01-01', to: '2026-01-31' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Generate failed'));
    const { result } = renderHook(() => useGeneratePartnerInvoice('tenant-1'), { wrapper });
    act(() => {
      result.current.mutate({});
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCustomerUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch customer usage', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([sampleUsage]);
    const { result } = renderHook(() => useCustomerUsage('tenant-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleUsage]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/partner/customers/tenant-1/usage',
      method: 'GET',
    });
  });

  it('should not fetch when customerId is empty', () => {
    const { result } = renderHook(() => useCustomerUsage(''), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Fetch failed'));
    const { result } = renderHook(() => useCustomerUsage('tenant-1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('usePartnerRevenueSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch revenue summary', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleRevenueSummary);
    const { result } = renderHook(() => usePartnerRevenueSummary('2026-01-01', '2026-01-31'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleRevenueSummary);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/partner/revenue/',
      method: 'GET',
      params: { from: '2026-01-01', until: '2026-01-31' },
    });
  });

  it('should fetch without params', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleRevenueSummary);
    const { result } = renderHook(() => usePartnerRevenueSummary(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/partner/revenue/',
      method: 'GET',
      params: {},
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Fetch failed'));
    const { result } = renderHook(() => usePartnerRevenueSummary(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('usePartnerRevenueDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch revenue details', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([sampleRevenueDetail]);
    const { result } = renderHook(() => usePartnerRevenueDetails('2026-01-01', '2026-01-31'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleRevenueDetail]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/partner/revenue/details',
      method: 'GET',
      params: { from: '2026-01-01', until: '2026-01-31' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Fetch failed'));
    const { result } = renderHook(() => usePartnerRevenueDetails(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('usePartnerSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch partner settings', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleSettings);
    const { result } = renderHook(() => usePartnerSettings(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleSettings);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/partner/settings/',
      method: 'GET',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Fetch failed'));
    const { result } = renderHook(() => usePartnerSettings(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdatePartnerSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update partner settings', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleSettings);
    const { result } = renderHook(() => useUpdatePartnerSettings(), { wrapper });
    act(() => {
      result.current.mutate({ platformName: 'New Name', defaultTimezone: 'UTC' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/partner/settings/',
      method: 'PUT',
      data: { platformName: 'New Name', defaultTimezone: 'UTC' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Update failed'));
    const { result } = renderHook(() => useUpdatePartnerSettings(), { wrapper });
    act(() => {
      result.current.mutate({ defaultLanguage: 'es' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
