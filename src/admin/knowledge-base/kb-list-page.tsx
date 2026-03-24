import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, BookOpen, Trash2 } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';
import { KbForm } from './kb-form';
import {
  useArticles,
  useCreateArticle,
  useUpdateArticle,
  useDeleteArticle,
} from '@/core/api/hooks/use-knowledge';
import type { Article } from '@/core/api/hooks/use-knowledge';
import type { ArticleFormValues } from './kb-form';

const columnHelper = createColumnHelper<Article>();

export default function KbListPage() {
  const { t } = useTranslation(['admin']);
  const [createOpen, setCreateOpen] = useState(false);
  const [editArticle, setEditArticle] = useState<Article | null>(null);
  const [, setDeleteId] = useState<string | null>(null);

  const { data: articles = [] } = useArticles();
  const createArticle = useCreateArticle();
  const updateArticle = useUpdateArticle();
  const deleteArticle = useDeleteArticle();

  const handleCreate = (values: ArticleFormValues) => {
    createArticle.mutate({
      title: values.title,
      content: values.content,
      tags: values.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      language: values.language,
      published: values.published,
    });
  };

  const handleUpdate = (values: ArticleFormValues) => {
    if (!editArticle) return;
    updateArticle.mutate({
      id: editArticle.id,
      title: values.title,
      content: values.content,
      tags: values.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      language: values.language,
      published: values.published,
    });
  };

  const handleDelete = (id: string) => {
    if (window.confirm(t('admin:knowledge.deleteConfirm'))) {
      deleteArticle.mutate(id);
    }
    setDeleteId(null);
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('title', {
        header: () => t('admin:knowledge.title'),
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('tags', {
        header: () => t('admin:knowledge.tags'),
        cell: (info) => (
          <div className="flex flex-wrap gap-1">
            {info.getValue().map((tag) => (
              <span
                key={tag}
                className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                {tag}
              </span>
            ))}
          </div>
        ),
      }),
      columnHelper.accessor('published', {
        header: () => t('admin:knowledge.published'),
        cell: (info) => (
          <Badge variant={info.getValue() ? 'default' : 'secondary'}>
            {info.getValue()
              ? t('admin:knowledge.publishedYes')
              : t('admin:knowledge.publishedNo')}
          </Badge>
        ),
      }),
      columnHelper.accessor('updatedAt', {
        header: () => t('admin:knowledge.updatedAt'),
        cell: (info) =>
          new Date(info.getValue()).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }),
      }),
      columnHelper.display({
        id: 'actions',
        header: () => '',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteId(row.original.id);
                handleDelete(row.original.id);
              }}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  );

  const isEmpty = articles.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin:knowledge.title')}>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:knowledge.createArticle')}
        </Button>
      </PageHeader>

      {isEmpty ? (
        <EmptyState
          icon={BookOpen}
          message={t('admin:knowledge.empty')}
        />
      ) : (
        <DataTable
          data={articles}
          columns={columns}
          searchPlaceholder={t('admin:knowledge.searchPlaceholder')}
          noResultsMessage={t('admin:knowledge.noResults')}
          onRowClick={(article) => setEditArticle(article)}
        />
      )}

      <KbForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={handleCreate}
      />

      <KbForm
        open={!!editArticle}
        onOpenChange={(open) => { if (!open) setEditArticle(null); }}
        mode="edit"
        defaultValues={editArticle ?? undefined}
        onSubmit={handleUpdate}
      />
    </div>
  );
}
