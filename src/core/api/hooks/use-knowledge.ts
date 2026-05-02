import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export interface Article {
  id: string;
  title: string;
  content: string;
  tags: string[];
  language: string | null;
  published: boolean;
  updatedAt: string;
  createdAt: string;
}

export interface ArticleSearchResult {
  id: string;
  title: string;
  content: string;
  tags: string[];
  relevanceScore: number;
}

export function useKnowledgeSearch(query: string) {
  return useQuery({
    queryKey: ['knowledge-search', query],
    queryFn: () =>
      customFetch<ArticleSearchResult[]>({
        url: `/api/v1/knowledge/search`,
        method: 'GET',
        params: { q: query, limit: '5' },
      }),
    enabled: query.length >= 2,
    staleTime: 30_000,
  });
}

export function useArticles() {
  return useQuery({
    queryKey: ['articles'],
    queryFn: () =>
      customFetch<Article[]>({ url: '/api/v1/admin/articles', method: 'GET' }),
  });
}

export function useCreateArticle() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: Omit<Article, 'id' | 'createdAt' | 'updatedAt'>) =>
      customFetch<Article>({ url: '/api/v1/admin/articles', method: 'POST', data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['articles'] });
      toast.success(t('toasts.knowledge.created'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateArticle() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Omit<Article, 'id' | 'createdAt' | 'updatedAt'>) =>
      customFetch<Article>({ url: `/api/v1/admin/articles/${id}`, method: 'PUT', data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['articles'] });
      toast.success(t('toasts.knowledge.updated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteArticle() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({ url: `/api/v1/admin/articles/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['articles'] });
      toast.success(t('toasts.knowledge.deleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
