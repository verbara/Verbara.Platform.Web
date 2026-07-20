import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, Tags, Trash2 } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { PageSkeleton } from '@/core/ui/page-skeleton';
import { PageHeader } from '@/core/ui/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/core/ui/data-table';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { PermissionButton } from '@/core/ui/permission-button';
import { ReasonHintForm } from './reason-hint-form';
import { codesToText } from './reason-hint-codes';
import {
  useReasonHints,
  useDeleteReasonHint,
  type ReasonHint,
} from '@/core/api/hooks/use-reason-hints';

const columnHelper = createColumnHelper<ReasonHint>();

export default function ReasonHintsPage() {
  const { t } = useTranslation(['admin']);
  const [createOpen, setCreateOpen] = useState(false);
  const [editHint, setEditHint] = useState<ReasonHint | null>(null);
  const [deletingHint, setDeletingHint] = useState<ReasonHint | null>(null);
  const deleteReasonHint = useDeleteReasonHint();

  const { data: reasonHints = [], isLoading } = useReasonHints();

  const columns = useMemo(
    () => [
      columnHelper.accessor('scope', {
        header: () => t('admin:reasonHints.scope'),
        cell: (info) => (
          <Badge variant="secondary">
            {t(`admin:reasonHints.scopeOption.${info.getValue().toLowerCase()}`, info.getValue())}
          </Badge>
        ),
      }),
      columnHelper.accessor('scopeRef', {
        header: () => t('admin:reasonHints.scopeRef'),
        cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor('reasonPath', {
        header: () => t('admin:reasonHints.reasonPath'),
        cell: (info) => (
          <span className="font-mono text-xs text-muted-foreground">
            {codesToText(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor('priority', {
        header: () => t('admin:reasonHints.priority'),
        cell: (info) => <span>{info.getValue()}</span>,
      }),
      columnHelper.display({
        id: 'isActive',
        header: () => t('admin:reasonHints.status'),
        cell: (info) => (
          <Badge variant={info.row.original.isActive ? 'default' : 'destructive'}>
            {info.row.original.isActive
              ? t('admin:reasonHints.active')
              : t('admin:reasonHints.inactive')}
          </Badge>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: () => '',
        cell: (info) => (
          <PermissionButton
            requires="system:typification:configure"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            data-testid={`delete-reason-hint-${info.row.original.id}`}
            onClick={(e) => {
              e.stopPropagation();
              setDeletingHint(info.row.original);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </PermissionButton>
        ),
      }),
    ],
    [t],
  );

  const isEmpty = !isLoading && reasonHints.length === 0;

  let content;
  if (isLoading) {
    content = <PageSkeleton />;
  } else if (isEmpty) {
    content = <EmptyState icon={Tags} message={t('admin:reasonHints.empty')} />;
  } else {
    content = (
      <DataTable
        data={reasonHints}
        columns={columns}
        searchPlaceholder={t('admin:reasonHints.searchPlaceholder')}
        noResultsMessage={t('admin:reasonHints.noResults')}
        onRowClick={(hint) => setEditHint(hint)}
      />
    );
  }

  return (
    <div className="space-y-6" data-testid="reason-hints-page">
      <PageHeader
        title={t('admin:reasonHints.title')}
        description={t('admin:reasonHints.description')}
      >
        <Button data-testid="reason-hints-create-btn" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:reasonHints.create')}
        </Button>
      </PageHeader>

      {content}

      {/* Create reason hint sheet */}
      <ReasonHintForm open={createOpen} onOpenChange={setCreateOpen} mode="create" />

      {/* Edit reason hint sheet */}
      <ReasonHintForm
        open={editHint !== null}
        onOpenChange={(open) => {
          if (!open) setEditHint(null);
        }}
        mode="edit"
        reasonHint={editHint ?? undefined}
      />

      <ConfirmDeleteDialog
        open={deletingHint !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingHint(null);
        }}
        onConfirm={() => {
          if (!deletingHint) return;
          deleteReasonHint.mutate(deletingHint.id, {
            onSuccess: () => setDeletingHint(null),
          });
        }}
        entityName={deletingHint?.scopeRef ?? ''}
        entityType={t('admin:reasonHints.entity_type')}
        isPending={deleteReasonHint.isPending}
      />
    </div>
  );
}
