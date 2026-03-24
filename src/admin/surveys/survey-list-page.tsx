import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, ClipboardList } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { Switch } from '@/core/ui/switch';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';
import { SurveyForm } from './survey-form';
import { useSurveys, useToggleSurveyActive, type Survey, type SurveyType } from '@/core/api/hooks/use-surveys';

const columnHelper = createColumnHelper<Survey>();

function TypeBadge({ type }: { type: SurveyType }) {
  const variant =
    type === 'CSAT'
      ? 'default'
      : type === 'NPS'
        ? 'secondary'
        : 'outline';
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

  const { data: surveys = [], isLoading } = useSurveys();

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('admin:surveys.name'),
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
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
        cell: (info) => (
          <span className="tabular-nums">{info.getValue().length}</span>
        ),
      }),
    ],
    [t],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('admin:surveys.title')}>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t('admin:surveys.create')}
          </Button>
        </PageHeader>
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  const isEmpty = surveys.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin:surveys.title')}>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:surveys.create')}
        </Button>
      </PageHeader>

      {isEmpty ? (
        <EmptyState
          icon={ClipboardList}
          message={t('admin:surveys.empty')}
        />
      ) : (
        <DataTable
          data={surveys}
          columns={columns}
          searchPlaceholder={t('admin:surveys.searchPlaceholder')}
          noResultsMessage={t('admin:surveys.noResults')}
          onRowClick={(survey) => setEditSurvey(survey)}
        />
      )}

      <SurveyForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
      />

      <SurveyForm
        open={editSurvey !== null}
        onOpenChange={(open) => { if (!open) setEditSurvey(null); }}
        mode="edit"
        survey={editSurvey ?? undefined}
      />
    </div>
  );
}
