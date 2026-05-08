import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, ClipboardList, Trash2 } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { Switch } from '@/core/ui/switch';
import { PageSkeleton } from '@/core/ui/page-skeleton';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { PermissionGuard } from '@/core/auth/permission-guard';
import { SurveyForm } from './survey-form';
import {
  useSurveys,
  useToggleSurveyActive,
  useDeleteSurvey,
  type Survey,
  type SurveyType,
} from '@/core/api/hooks/use-surveys';

const columnHelper = createColumnHelper<Survey>();

function TypeBadge({ type }: { type: SurveyType }) {
  const variant = type === 'CSAT' ? 'default' : type === 'NPS' ? 'secondary' : 'outline';
  return <Badge variant={variant}>{type}</Badge>;
}

function ActiveToggle({ survey }: { survey: Survey }) {
  const toggle = useToggleSurveyActive(survey.id);
  return (
    <Switch
      checked={survey.isActive}
      onCheckedChange={(checked) => toggle.mutate(checked)}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

export default function SurveyListPage() {
  const { t } = useTranslation(['admin']);
  const [createOpen, setCreateOpen] = useState(false);
  const [editSurvey, setEditSurvey] = useState<Survey | null>(null);
  const [deletingSurvey, setDeletingSurvey] = useState<Survey | null>(null);
  const deleteSurvey = useDeleteSurvey();

  const { data: surveys = [], isLoading } = useSurveys();

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('admin:surveys.name'),
        cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor('type', {
        header: () => t('admin:surveys.type'),
        cell: (info) => <TypeBadge type={info.getValue()} />,
      }),
      columnHelper.display({
        id: 'isActive',
        header: () => t('admin:surveys.active'),
        cell: (info) => <ActiveToggle survey={info.row.original} />,
      }),
      columnHelper.accessor('responseCount', {
        header: () => t('admin:surveys.responses'),
        cell: (info) => {
          const count = info.getValue();
          return count !== undefined ? (
            <span className="tabular-nums">{count}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      }),
      columnHelper.accessor('questions', {
        header: () => t('admin:surveys.questions'),
        cell: (info) => <span className="tabular-nums">{info.getValue().length}</span>,
      }),
      columnHelper.display({
        id: 'actions',
        header: () => '',
        cell: (info) => (
          <PermissionGuard requires="system:integration:manage">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              data-testid={`delete-survey-${info.row.original.id}`}
              onClick={(e) => {
                e.stopPropagation();
                setDeletingSurvey(info.row.original);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </PermissionGuard>
        ),
      }),
    ],
    [t],
  );

  const isEmpty = !isLoading && surveys.length === 0;

  let content;
  if (isLoading) {
    content = <PageSkeleton />;
  } else if (isEmpty) {
    content = <EmptyState icon={ClipboardList} message={t('admin:surveys.empty')} />;
  } else {
    content = (
      <DataTable
        data={surveys}
        columns={columns}
        searchPlaceholder={t('admin:surveys.searchPlaceholder')}
        noResultsMessage={t('admin:surveys.noResults')}
        onRowClick={(survey) => setEditSurvey(survey)}
      />
    );
  }

  return (
    <div className="space-y-6" data-testid="surveys-page">
      <PageHeader title={t('admin:surveys.title')}>
        <Button data-testid="surveys-create-btn" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:surveys.create')}
        </Button>
      </PageHeader>

      {content}

      <SurveyForm open={createOpen} onOpenChange={setCreateOpen} mode="create" />

      <SurveyForm
        open={editSurvey !== null}
        onOpenChange={(open) => {
          if (!open) setEditSurvey(null);
        }}
        mode="edit"
        survey={editSurvey ?? undefined}
      />

      <ConfirmDeleteDialog
        open={deletingSurvey !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingSurvey(null);
        }}
        onConfirm={() => {
          if (!deletingSurvey) return;
          deleteSurvey.mutate(deletingSurvey.id, {
            onSuccess: () => setDeletingSurvey(null),
          });
        }}
        entityName={deletingSurvey?.name ?? ''}
        entityType={t('admin:surveys.entity_type')}
        isPending={deleteSurvey.isPending}
      />
    </div>
  );
}
