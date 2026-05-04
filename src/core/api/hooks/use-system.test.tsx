import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import * as client from '@/core/api/client';
import {
  useSystemInfo,
  useSystemLicense,
  useSystemSettings,
  useUpdateSystemSettings,
  useUpdateLicense,
} from './use-system';
import type { SystemInfo, LicenseInfo, SystemSettings } from './use-system';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const mockSystemInfo: SystemInfo = {
  version: '1.14.6',
  hostTenantId: 'host-t1',
  platformName: 'Asterisk Platform',
  features: { multiTenant: true, webhooks: true },
};

const mockLicense: LicenseInfo = {
  isValid: true,
  licenseId: 'lic-1',
  licensee: 'Acme Inc',
  status: 'Active',
  expiresAt: '2027-01-01T00:00:00Z',
  licensedFeatures: ['webhooks', 'campaigns'],
  maxNodes: 5,
  lastValidatedAt: '2026-05-01T00:00:00Z',
  inGrace: false,
  gracePeriodRemaining: null,
  blocked: false,
};

const mockSettings: SystemSettings = {
  platformName: 'Asterisk Platform',
  defaultTimezone: 'America/Bogota',
  defaultLanguage: 'es',
};

describe('useSystemInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch system info', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockSystemInfo);
    const { result } = renderHook(() => useSystemInfo(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockSystemInfo);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/system/info',
      method: 'GET',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useSystemInfo(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useSystemLicense', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch license info', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockLicense);
    const { result } = renderHook(() => useSystemLicense(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockLicense);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/system/license',
      method: 'GET',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useSystemLicense(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useSystemSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch system settings', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockSettings);
    const { result } = renderHook(() => useSystemSettings(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockSettings);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/system/settings',
      method: 'GET',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useSystemSettings(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateSystemSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update system settings', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockSettings);
    const { result } = renderHook(() => useUpdateSystemSettings(), { wrapper });
    act(() => {
      result.current.mutate(mockSettings);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/system/settings',
      method: 'PUT',
      data: mockSettings,
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useUpdateSystemSettings(), { wrapper });
    act(() => {
      result.current.mutate(mockSettings);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateLicense', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should submit a license key', async () => {
    vi.mocked(client.customFetch).mockResolvedValue({ message: 'License accepted' });
    const { result } = renderHook(() => useUpdateLicense(), { wrapper });
    act(() => {
      result.current.mutate({ licenseKey: 'new-key-123' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/system/license',
      method: 'PUT',
      data: { licenseKey: 'new-key-123' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useUpdateLicense(), { wrapper });
    act(() => {
      result.current.mutate({ licenseKey: 'bad-key' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
