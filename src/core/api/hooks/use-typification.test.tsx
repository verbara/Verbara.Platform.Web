import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '@/core/api/client';
import {
  useTypificationSchemas,
  useCreateTypificationSchema,
  usePublishTypificationSchema,
  useTypificationForm,
  useTypify,
  type TypificationSchema,
  type CreateSchemaInput,
  type PublishResult,
  type TypificationFormResponse,
} from './use-typification';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  return { wrapper, invalidateSpy };
}

const sampleSchema: TypificationSchema = {
  schemaId: 'schema-1',
  name: 'Sales Outcomes',
  version: 1,
  isPublished: false,
  maxDepth: 3,
  nodes: [],
  fields: [],
  createdAt: '2026-06-07T00:00:00Z',
};

describe('use-typification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useTypificationSchemas', () => {
    it('should fetch schemas when called', async () => {
      vi.mocked(client.customFetch).mockResolvedValue([sampleSchema]);
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useTypificationSchemas(), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([sampleSchema]);
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/typification/schemas',
        method: 'GET',
      });
    });

    it('should handle error when fetch fails', async () => {
      vi.mocked(client.customFetch).mockRejectedValue(new Error('Network error'));
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useTypificationSchemas(), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe('Network error');
    });
  });

  describe('useCreateTypificationSchema', () => {
    it('should POST and invalidate schemas on success', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(sampleSchema);
      const { wrapper, invalidateSpy } = makeWrapper();
      const { result } = renderHook(() => useCreateTypificationSchema(), { wrapper });
      const payload: CreateSchemaInput = {
        name: 'Sales Outcomes',
        maxDepth: 3,
        nodes: [],
        fields: [],
      };
      act(() => {
        result.current.mutate(payload);
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/typification/schemas',
        method: 'POST',
        data: payload,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['typification', 'schemas'],
      });
    });
  });

  describe('usePublishTypificationSchema', () => {
    it('should POST to publish endpoint and return PublishResult', async () => {
      const publishResult: PublishResult = { ok: true, errors: [] };
      vi.mocked(client.customFetch).mockResolvedValue(publishResult);
      const { wrapper, invalidateSpy } = makeWrapper();
      const { result } = renderHook(() => usePublishTypificationSchema(), { wrapper });
      act(() => {
        result.current.mutate('schema-1');
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/typification/schemas/schema-1/publish',
        method: 'POST',
      });
      expect(result.current.data).toEqual(publishResult);
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['typification', 'schemas'],
      });
    });
  });

  describe('useTypificationForm', () => {
    it('should not fire when disabled', () => {
      const { wrapper } = makeWrapper();
      renderHook(() => useTypificationForm('conv-1', false), { wrapper });
      expect(client.customFetch).not.toHaveBeenCalled();
    });

    it('should fetch the runtime form when enabled', async () => {
      const formResponse: TypificationFormResponse = { schema: sampleSchema };
      vi.mocked(client.customFetch).mockResolvedValue(formResponse);
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useTypificationForm('conv-1', true), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/conversations/conv-1/typification-form',
        method: 'GET',
      });
    });
  });

  describe('useTypify', () => {
    it('should POST to typify endpoint and invalidate the form', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(undefined);
      const { wrapper, invalidateSpy } = makeWrapper();
      const { result } = renderHook(() => useTypify(), { wrapper });
      act(() => {
        result.current.mutate({
          conversationId: 'conv-1',
          selectedNodePath: ['node-a', 'node-b'],
          fieldValues: { reason: 'resolved' },
        });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/conversations/conv-1/typify',
        method: 'POST',
        data: {
          selectedNodePath: ['node-a', 'node-b'],
          fieldValues: { reason: 'resolved' },
        },
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['typification', 'form', 'conv-1'],
      });
    });
  });
});
