import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '@/core/api/client';
import {
  useCases,
  useCase,
  useCreateCase,
  useUpdateCase,
  useLinkConversationToCase,
  type Case,
} from './use-cases';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const sampleCase: Case = {
  caseId: 'case-1',
  caseNumber: 'CS-001',
  subject: 'Billing inquiry',
  priority: 'Normal',
  status: 'Open',
  contactId: 'contact-1',
  assignedAgentId: 'agent-1',
  conversationIds: ['conv-1'],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: null,
};

describe('use-cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useCases', () => {
    it('should fetch cases when called', async () => {
      const pagedResult = { items: [sampleCase], totalCount: 1, page: 1, pageSize: 25 };
      vi.mocked(client.customFetch).mockResolvedValue(pagedResult);
      const { result } = renderHook(() => useCases(), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(pagedResult);
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/cases',
        method: 'GET',
        params: { page: '1', pageSize: '25' },
      });
    });

    it('should pass filters when provided', async () => {
      const pagedResult = { items: [sampleCase], totalCount: 1, page: 1, pageSize: 10 };
      vi.mocked(client.customFetch).mockResolvedValue(pagedResult);
      const { result } = renderHook(
        () => useCases({ status: 'Open', priority: 'High', page: 2, pageSize: 10 }),
        { wrapper },
      );
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/cases',
        method: 'GET',
        params: { page: '2', pageSize: '10', status: 'Open', priority: 'High' },
      });
    });
  });

  describe('useCase', () => {
    it('should fetch case detail when called', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(sampleCase);
      const { result } = renderHook(() => useCase('case-1'), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(sampleCase);
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/cases/case-1',
        method: 'GET',
      });
    });

    it('should not fetch when id is undefined', () => {
      const { result } = renderHook(() => useCase(undefined), { wrapper });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useCreateCase', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(sampleCase);
      const { result } = renderHook(() => useCreateCase(), { wrapper });
      const payload = { subject: 'New case', priority: 'High' as const, contactId: 'contact-1' };
      act(() => {
        result.current.mutate(payload);
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/cases',
        method: 'POST',
        data: payload,
      });
    });
  });

  describe('useUpdateCase', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(sampleCase);
      const { result } = renderHook(() => useUpdateCase(), { wrapper });
      act(() => {
        result.current.mutate({ id: 'case-1', status: 'Resolved' });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/cases/case-1',
        method: 'PUT',
        data: { status: 'Resolved' },
      });
    });
  });

  describe('useLinkConversationToCase', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(sampleCase);
      const { result } = renderHook(() => useLinkConversationToCase(), { wrapper });
      act(() => {
        result.current.mutate({ caseId: 'case-1', conversationId: 'conv-2' });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/cases/case-1/conversations/conv-2',
        method: 'POST',
      });
    });
  });
});
