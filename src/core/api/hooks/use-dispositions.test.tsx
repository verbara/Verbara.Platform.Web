import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '@/core/api/client';
import {
  useDispositions,
  useCreateDisposition,
  useDeleteDisposition,
  type Disposition,
} from './use-dispositions';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const sampleDisposition: Disposition = {
  id: 'disp-1',
  name: 'Sale',
  category: 'Success',
};

describe('use-dispositions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useDispositions', () => {
    it('should fetch dispositions when called', async () => {
      vi.mocked(client.customFetch).mockResolvedValue([sampleDisposition]);
      const { result } = renderHook(() => useDispositions(), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([sampleDisposition]);
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/dispositions',
        method: 'GET',
      });
    });

    it('should handle error when fetch fails', async () => {
      vi.mocked(client.customFetch).mockRejectedValue(new Error('Network error'));
      const { result } = renderHook(() => useDispositions(), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe('Network error');
    });
  });

  describe('useCreateDisposition', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(sampleDisposition);
      const { result } = renderHook(() => useCreateDisposition(), { wrapper });
      const payload = { name: 'Sale', category: 'Success' };
      act(() => {
        result.current.mutate(payload);
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/dispositions',
        method: 'POST',
        data: payload,
      });
    });
  });

  describe('useDeleteDisposition', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(undefined);
      const { result } = renderHook(() => useDeleteDisposition(), { wrapper });
      act(() => {
        result.current.mutate('disp-1');
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/dispositions/disp-1',
        method: 'DELETE',
      });
    });
  });
});
