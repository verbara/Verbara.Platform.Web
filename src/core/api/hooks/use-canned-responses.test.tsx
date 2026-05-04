import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '@/core/api/client';
import {
  useCannedResponses,
  useSearchCannedResponses,
  useCreateCannedResponse,
  useUpdateCannedResponse,
  useDeleteCannedResponse,
  type CannedResponse,
} from './use-canned-responses';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const sampleResponse: CannedResponse = {
  responseId: 'resp-1',
  shortcut: '/greet',
  title: 'Greeting',
  body: 'Hello! How can I help you today?',
  category: 'General',
  tags: ['greeting', 'intro'],
  createdBy: 'admin',
  createdAt: '2026-01-01T00:00:00Z',
};

describe('use-canned-responses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useCannedResponses', () => {
    it('should fetch canned responses when called', async () => {
      vi.mocked(client.customFetch).mockResolvedValue([sampleResponse]);
      const { result } = renderHook(() => useCannedResponses(), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([sampleResponse]);
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/canned-responses',
        method: 'GET',
      });
    });
  });

  describe('useSearchCannedResponses', () => {
    it('should fetch canned responses when query is non-empty', async () => {
      vi.mocked(client.customFetch).mockResolvedValue([sampleResponse]);
      const { result } = renderHook(() => useSearchCannedResponses('greet'), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([sampleResponse]);
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/canned-responses',
        method: 'GET',
        params: { q: 'greet' },
      });
    });

    it('should not fetch when query is empty', () => {
      const { result } = renderHook(() => useSearchCannedResponses(''), { wrapper });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useCreateCannedResponse', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(sampleResponse);
      const { result } = renderHook(() => useCreateCannedResponse(), { wrapper });
      const payload = { shortcut: '/greet', title: 'Greeting', body: 'Hello!' };
      act(() => {
        result.current.mutate(payload);
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/canned-responses',
        method: 'POST',
        data: payload,
      });
    });
  });

  describe('useUpdateCannedResponse', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(sampleResponse);
      const { result } = renderHook(() => useUpdateCannedResponse(), { wrapper });
      act(() => {
        result.current.mutate({ id: 'resp-1', title: 'Updated Greeting' });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/canned-responses/resp-1',
        method: 'PUT',
        data: { title: 'Updated Greeting' },
      });
    });
  });

  describe('useDeleteCannedResponse', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(undefined);
      const { result } = renderHook(() => useDeleteCannedResponse(), { wrapper });
      act(() => {
        result.current.mutate('resp-1');
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/canned-responses/resp-1',
        method: 'DELETE',
      });
    });
  });
});
