import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, MessageSquareText, Trash2 } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Textarea } from '@/core/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/core/ui/sheet';
import { PageSkeleton } from '@/core/ui/page-skeleton';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { PermissionButton } from '@/core/ui/permission-button';
import {
  useCannedResponses,
  useCreateCannedResponse,
  useUpdateCannedResponse,
  useDeleteCannedResponse,
  type CannedResponse,
} from '@/core/api/hooks/use-canned-responses';

const columnHelper = createColumnHelper<CannedResponse>();

export default function CannedResponsesPage() {
  const { t } = useTranslation(['admin']);
  const { data: responses = [], isLoading } = useCannedResponses();
  const createMutation = useCreateCannedResponse();
  const updateMutation = useUpdateCannedResponse();
  const deleteMutation = useDeleteCannedResponse();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CannedResponse | null>(null);
  const [deleting, setDeleting] = useState<CannedResponse | null>(null);

  const [shortcut, setShortcut] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  const openCreate = () => {
    setEditing(null);
    setShortcut('');
    setTitle('');
    setBody('');
    setCategory('');
    setTagsInput('');
    setFormOpen(true);
  };

  const openEdit = (r: CannedResponse) => {
    setEditing(r);
    setShortcut(r.shortcut);
    setTitle(r.title);
    setBody(r.body);
    setCategory(r.category ?? '');
    setTagsInput(r.tags.join(', '));
    setFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    if (editing) {
      updateMutation.mutate(
        {
          id: editing.responseId,
          shortcut,
          title,
          body,
          category: category || undefined,
          tags,
        },
        { onSuccess: () => setFormOpen(false) },
      );
    } else {
      createMutation.mutate(
        {
          shortcut,
          title,
          body,
          category: category || undefined,
          tags,
        },
        { onSuccess: () => setFormOpen(false) },
      );
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('shortcut', {
        header: () => t('admin:cannedResponses.shortcut'),
        cell: (info) => (
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-700">
            {info.getValue()}
          </code>
        ),
      }),
      columnHelper.accessor('title', {
        header: () => t('admin:cannedResponses.titleColumn'),
        cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor('body', {
        header: () => t('admin:cannedResponses.body'),
        cell: (info) => (
          <span className="line-clamp-1 max-w-xs text-sm text-muted-foreground">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('category', {
        header: () => t('admin:cannedResponses.category'),
        cell: (info) => {
          const value = info.getValue();
          return value ? (
            <Badge variant="secondary">{value}</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      }),
      columnHelper.accessor('tags', {
        header: () => t('admin:cannedResponses.tags'),
        cell: (info) => (
          <div className="flex flex-wrap gap-1">
            {info.getValue().map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: () => '',
        cell: (info) => (
          <PermissionButton
            requires="system:integration:manage"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            data-testid={`delete-canned-${info.row.original.responseId}`}
            onClick={(e) => {
              e.stopPropagation();
              setDeleting(info.row.original);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </PermissionButton>
        ),
      }),
    ],
    [t],
  );

  const isEmpty = !isLoading && responses.length === 0;

  let content;
  if (isLoading) {
    content = <PageSkeleton />;
  } else if (isEmpty) {
    content = (
      <EmptyState
        icon={MessageSquareText}
        message={t('admin:cannedResponses.empty')}
        actionLabel={t('admin:cannedResponses.create')}
        onAction={openCreate}
      />
    );
  } else {
    content = (
      <DataTable
        data={responses}
        columns={columns}
        searchPlaceholder={t('admin:cannedResponses.searchPlaceholder')}
        noResultsMessage={t('admin:cannedResponses.noResults')}
        onRowClick={openEdit}
      />
    );
  }

  return (
    <div className="space-y-6" data-testid="canned-responses-page">
      <PageHeader title={t('admin:cannedResponses.title')}>
        <Button data-testid="canned-responses-create-btn" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:cannedResponses.create')}
        </Button>
      </PageHeader>

      {content}

      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editing ? 'Edit Canned Response' : 'Create Canned Response'}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4 px-4 pb-4">
            <div>
              <Label htmlFor="shortcut">{t('admin:cannedResponses.shortcut')}</Label>
              <Input
                id="shortcut"
                data-testid="canned-shortcut-input"
                placeholder="/greeting"
                value={shortcut}
                onChange={(e) => setShortcut(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="title">{t('admin:cannedResponses.titleColumn')}</Label>
              <Input
                id="title"
                data-testid="canned-title-input"
                placeholder={t('admin:cannedResponses.titlePlaceholder')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="body">{t('admin:cannedResponses.body')}</Label>
              <Textarea
                id="body"
                data-testid="canned-body-input"
                placeholder={t('admin:cannedResponses.bodyPlaceholder')}
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="category">{t('admin:cannedResponses.category')}</Label>
              <Input
                id="category"
                data-testid="canned-category-input"
                placeholder="general"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="tags">{t('admin:cannedResponses.tags')}</Label>
              <Input
                id="tags"
                data-testid="canned-tags-input"
                placeholder="greeting, welcome"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              data-testid="canned-submit-btn"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editing ? 'Update' : 'Create'}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        onConfirm={() => {
          if (!deleting) return;
          deleteMutation.mutate(deleting.responseId, {
            onSuccess: () => setDeleting(null),
          });
        }}
        entityName={deleting?.title ?? ''}
        entityType={t('admin:cannedResponses.entity_type')}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
