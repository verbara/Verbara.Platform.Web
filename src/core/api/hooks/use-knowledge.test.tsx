import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '@/core/api/client';
import type { Article, ArticleSearchResult } from './use-knowledge';
import {
  useKnowledgeSearch,
  useArticles,
  useCreateArticle,
  useUpdateArticle,
  useDeleteArticle,
} from './use-knowledge';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const mockArticle: Article = {
  id: 'a1',
  title: 'Getting Started',
  content: 'Welcome to the platform.',
  tags: ['onboarding'],
  language: 'en',
  published: true,
  updatedAt: '2026-01-02T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
};

const mockSearchResult: ArticleSearchResult = {
  id: 'a1',
  title: 'Getting Started',
  content: 'Welcome to the platform.',
  tags: ['onboarding'],
  relevanceScore: 0.95,
};

describe('useKnowledgeSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should search articles when query length >= 2', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([mockSearchResult]);

    const { result } = renderHook(() => useKnowledgeSearch('get'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([mockSearchResult]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/knowledge/search',
      method: 'GET',
      params: { q: 'get', limit: '5' },
    });
  });

  it('should not fetch when query length < 2', () => {
    const { result } = renderHook(() => useKnowledgeSearch('g'), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(client.customFetch).not.toHaveBeenCalled();
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => useKnowledgeSearch('test'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useArticles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch all articles', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([mockArticle]);

    const { result } = renderHook(() => useArticles(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([mockArticle]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/articles',
      method: 'GET',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Forbidden'));

    const { result } = renderHook(() => useArticles(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateArticle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call POST /api/v1/admin/articles', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockArticle);

    const { result } = renderHook(() => useCreateArticle(), { wrapper });

    const data = {
      title: 'Getting Started',
      content: 'Welcome to the platform.',
      tags: ['onboarding'],
      language: 'en',
      published: true,
    };
    act(() => {
      result.current.mutate(data);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/articles',
      method: 'POST',
      data,
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Validation error'));

    const { result } = renderHook(() => useCreateArticle(), { wrapper });

    act(() => {
      result.current.mutate({ title: '', content: '', tags: [], language: null, published: false });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateArticle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call PUT /api/v1/admin/articles/{id}', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockArticle);

    const { result } = renderHook(() => useUpdateArticle(), { wrapper });

    const data = {
      id: 'a1',
      title: 'Updated',
      content: 'New content.',
      tags: ['updated'],
      language: 'en',
      published: true,
    };
    act(() => {
      result.current.mutate(data);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/articles/a1',
      method: 'PUT',
      data: {
        title: 'Updated',
        content: 'New content.',
        tags: ['updated'],
        language: 'en',
        published: true,
      },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useUpdateArticle(), { wrapper });

    act(() => {
      result.current.mutate({
        id: 'bad',
        title: 'X',
        content: '',
        tags: [],
        language: null,
        published: false,
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteArticle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call DELETE /api/v1/admin/articles/{id}', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteArticle(), { wrapper });

    act(() => {
      result.current.mutate('a1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/articles/a1',
      method: 'DELETE',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Forbidden'));

    const { result } = renderHook(() => useDeleteArticle(), { wrapper });

    act(() => {
      result.current.mutate('a1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
