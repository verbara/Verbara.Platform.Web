import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '@/core/api/client';
import {
  useCallerIdPools,
  useCallerIdPool,
  useCallerIdPoolEntries,
  useCreatePool,
  useUpdatePool,
  useDeletePool,
  useAddPoolEntry,
  useRemovePoolEntry,
  type CallerIdPoolSummary,
  type CallerIdEntry,
} from './use-caller-id-pools';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const samplePool: CallerIdPoolSummary = {
  id: 1,
  name: 'Local Numbers',
};

const sampleEntry: CallerIdEntry = {
  id: 10,
  phoneNumber: '+15551234567',
  areaCode: '555',
  isActive: true,
};

describe('use-caller-id-pools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useCallerIdPools', () => {
    it('should fetch caller ID pools when called', async () => {
      vi.mocked(client.customFetch).mockResolvedValue([samplePool]);
      const { result } = renderHook(() => useCallerIdPools(), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([samplePool]);
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/caller-id-pools',
        method: 'GET',
      });
    });
  });

  describe('useCallerIdPool', () => {
    it('should fetch single pool when called', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(samplePool);
      const { result } = renderHook(() => useCallerIdPool(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(samplePool);
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/caller-id-pools/1',
        method: 'GET',
      });
    });

    it('should not fetch when id is 0', () => {
      const { result } = renderHook(() => useCallerIdPool(0), { wrapper });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useCallerIdPoolEntries', () => {
    it('should fetch pool entries when called', async () => {
      vi.mocked(client.customFetch).mockResolvedValue([sampleEntry]);
      const { result } = renderHook(() => useCallerIdPoolEntries(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([sampleEntry]);
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/caller-id-pools/1/entries',
        method: 'GET',
      });
    });

    it('should not fetch when poolId is 0', () => {
      const { result } = renderHook(() => useCallerIdPoolEntries(0), { wrapper });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useCreatePool', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(samplePool);
      const { result } = renderHook(() => useCreatePool(), { wrapper });
      act(() => {
        result.current.mutate({ name: 'New Pool' });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/caller-id-pools',
        method: 'POST',
        data: { name: 'New Pool' },
      });
    });
  });

  describe('useUpdatePool', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(samplePool);
      const { result } = renderHook(() => useUpdatePool(), { wrapper });
      act(() => {
        result.current.mutate({ id: 1, name: 'Updated Pool' });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/caller-id-pools/1',
        method: 'PUT',
        data: { name: 'Updated Pool' },
      });
    });
  });

  describe('useDeletePool', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(undefined);
      const { result } = renderHook(() => useDeletePool(), { wrapper });
      act(() => {
        result.current.mutate(1);
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/caller-id-pools/1',
        method: 'DELETE',
      });
    });
  });

  describe('useAddPoolEntry', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(sampleEntry);
      const { result } = renderHook(() => useAddPoolEntry(), { wrapper });
      act(() => {
        result.current.mutate({
          poolId: 1,
          phoneNumber: '+15551234567',
          areaCode: '555',
          isActive: true,
        });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/caller-id-pools/1/entries',
        method: 'POST',
        data: { phoneNumber: '+15551234567', areaCode: '555', isActive: true },
      });
    });
  });

  describe('useRemovePoolEntry', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(undefined);
      const { result } = renderHook(() => useRemovePoolEntry(), { wrapper });
      act(() => {
        result.current.mutate({ poolId: 1, entryId: 10 });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/caller-id-pools/1/entries/10',
        method: 'DELETE',
      });
    });
  });
});
