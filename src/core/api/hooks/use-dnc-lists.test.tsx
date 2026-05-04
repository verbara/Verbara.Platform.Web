import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '@/core/api/client';
import {
  useDncLists,
  useDncList,
  useDncEntries,
  useCreateDncList,
  useUpdateDncList,
  useDeleteDncList,
  useAddDncEntry,
  useRemoveDncEntry,
  useImportDncEntries,
  useCheckDncNumber,
  type DncListSummary,
  type DncEntry,
} from './use-dnc-lists';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const sampleList: DncListSummary = {
  id: 1,
  name: 'Federal DNC',
  scope: 'global',
  entryCount: 500,
  createdAt: '2026-01-01T00:00:00Z',
};

const sampleEntry: DncEntry = {
  id: 10,
  phoneNumber: '+15551234567',
  reason: 'Customer request',
  createdAt: '2026-01-02T00:00:00Z',
};

describe('use-dnc-lists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useDncLists', () => {
    it('should fetch DNC lists when called', async () => {
      vi.mocked(client.customFetch).mockResolvedValue([sampleList]);
      const { result } = renderHook(() => useDncLists(), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([sampleList]);
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/dnc-lists',
        method: 'GET',
      });
    });
  });

  describe('useDncList', () => {
    it('should fetch single DNC list when called', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(sampleList);
      const { result } = renderHook(() => useDncList(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(sampleList);
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/dnc-lists/1',
        method: 'GET',
      });
    });

    it('should not fetch when id is 0', () => {
      const { result } = renderHook(() => useDncList(0), { wrapper });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useDncEntries', () => {
    it('should fetch entries when called', async () => {
      vi.mocked(client.customFetch).mockResolvedValue([sampleEntry]);
      const { result } = renderHook(() => useDncEntries(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([sampleEntry]);
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/dnc-lists/1/entries',
        method: 'GET',
        params: { offset: '0', limit: '100' },
      });
    });

    it('should not fetch when listId is 0', () => {
      const { result } = renderHook(() => useDncEntries(0), { wrapper });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useCreateDncList', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(sampleList);
      const { result } = renderHook(() => useCreateDncList(), { wrapper });
      act(() => {
        result.current.mutate({ name: 'New List', scope: 'campaign' });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/dnc-lists',
        method: 'POST',
        data: { name: 'New List', scope: 'campaign' },
      });
    });
  });

  describe('useUpdateDncList', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(sampleList);
      const { result } = renderHook(() => useUpdateDncList(), { wrapper });
      act(() => {
        result.current.mutate({ id: 1, name: 'Updated List' });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/dnc-lists/1',
        method: 'PUT',
        data: { name: 'Updated List' },
      });
    });
  });

  describe('useDeleteDncList', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(undefined);
      const { result } = renderHook(() => useDeleteDncList(), { wrapper });
      act(() => {
        result.current.mutate(1);
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/dnc-lists/1',
        method: 'DELETE',
      });
    });
  });

  describe('useAddDncEntry', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(sampleEntry);
      const { result } = renderHook(() => useAddDncEntry(), { wrapper });
      act(() => {
        result.current.mutate({
          listId: 1,
          phoneNumber: '+15551234567',
          reason: 'Customer request',
        });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/dnc-lists/1/entries',
        method: 'POST',
        data: { phoneNumber: '+15551234567', reason: 'Customer request' },
      });
    });
  });

  describe('useRemoveDncEntry', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(undefined);
      const { result } = renderHook(() => useRemoveDncEntry(), { wrapper });
      act(() => {
        result.current.mutate({ listId: 1, entryId: 10 });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/dnc-lists/1/entries/10',
        method: 'DELETE',
      });
    });
  });

  describe('useImportDncEntries', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(undefined);
      const entries = [{ phoneNumber: '+15551234567', reason: 'Bulk import' }];
      const { result } = renderHook(() => useImportDncEntries(), { wrapper });
      act(() => {
        result.current.mutate({ listId: 1, entries });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/dnc-lists/1/import',
        method: 'POST',
        data: entries,
      });
    });
  });

  describe('useCheckDncNumber', () => {
    it('should call correct endpoint when mutating', async () => {
      const checkResult = {
        phoneNumber: '+15551234567',
        isBlocked: true,
        matchedListId: 1,
        matchedListName: 'Federal DNC',
      };
      vi.mocked(client.customFetch).mockResolvedValue(checkResult);
      const { result } = renderHook(() => useCheckDncNumber(), { wrapper });
      act(() => {
        result.current.mutate({ listId: 1, phoneNumber: '+15551234567' });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(checkResult);
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/dnc-lists/1/check/%2B15551234567',
        method: 'GET',
      });
    });
  });
});
