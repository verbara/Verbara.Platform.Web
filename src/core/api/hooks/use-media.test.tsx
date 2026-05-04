import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/core/auth/auth-store', () => ({
  useAuthStore: { getState: () => ({ accessToken: 'tok', tenantId: 'tenant-1' }) },
}));
vi.mock('@/core/tenant/tenant-store', () => ({
  useTenantStore: { getState: () => ({ activeTenantId: 'tenant-1' }) },
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

import { useUploadMedia, mediaDownloadUrl } from './use-media';

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('useUploadMedia', () => {
  it('should upload a file successfully', async () => {
    const mockResult = {
      id: 'media-1',
      fileName: 'test.png',
      contentType: 'image/png',
      size: 1024,
    };
    const mockResponse = { ok: true, json: () => Promise.resolve(mockResult), statusText: 'OK' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);

    const file = new File(['content'], 'test.png', { type: 'image/png' });

    const { result } = renderHook(() => useUploadMedia(), { wrapper });

    act(() => {
      result.current.mutate(file);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockResult);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/media/upload', {
      method: 'POST',
      body: expect.any(FormData),
      headers: { Authorization: 'Bearer tok', 'X-Tenant-Id': 'tenant-1' },
    });
  });

  it('should handle upload error', async () => {
    const mockResponse = {
      ok: false,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({}),
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);

    const file = new File(['content'], 'test.png', { type: 'image/png' });

    const { result } = renderHook(() => useUploadMedia(), { wrapper });

    act(() => {
      result.current.mutate(file);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Upload failed: Internal Server Error');
  });

  it('should handle network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network failure'));

    const file = new File(['content'], 'test.png', { type: 'image/png' });

    const { result } = renderHook(() => useUploadMedia(), { wrapper });

    act(() => {
      result.current.mutate(file);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Network failure');
  });
});

describe('mediaDownloadUrl', () => {
  it('should return correct download URL', () => {
    expect(mediaDownloadUrl('media-1')).toBe('/api/v1/media/media-1/download');
  });

  it('should handle different ids', () => {
    expect(mediaDownloadUrl('abc-123')).toBe('/api/v1/media/abc-123/download');
  });
});
