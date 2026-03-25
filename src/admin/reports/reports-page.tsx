import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, Calendar } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { Switch } from '@/core/ui/switch';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';
import { ReportForm } from './report-form';
import {
  useReports,
  useToggleReportActive,
  type ScheduledReport,
  type ReportType,
  type ReportFormat,
} from '@/core/api/hooks/use-reports';

const columnHelper = createColumnHelper<ScheduledReport>();

function TypeBadge({ type }: { type: ReportType }) {
  const { t } = useTranslation(['admin']);
  const variant =
    type === 'CDRSummary'
      ? 'default'
      : type === 'QASummary'
        ? 'secondary'
        : type === 'IntervalReport'
          ? 'outline'
          : 'destructive';
  return <Badge variant={variant}>{t(`admin:reports.type_${type}`)}</Badge>;
}

function FormatBadge({ format }: { format: ReportFormat }) {
  return (
    <Badge variant={format === 'PDF' ? 'secondary' : 'outline'}>
      {format}
    </Badge>
  );
}

function ActiveToggle({ report }: { report: ScheduledReport }) {
  const toggle = useToggleReportActive(report.id);
  return (
    <Switch
      checked={report.isActive}
      onCheckedChange={(checked) => toggle.mutate(checked)}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

export default function ReportsPage() {
  const { t } = useTranslation(['admin']);
  const [createOpen, setCreateOpen] = useState(false);
  const [editReport, setEditReport] = useState<ScheduledReport | null>(null);

  const { data: reports = [], isLoading } = useReports();

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('admin:reports.name'),
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('type', {
        header: () => t('admin:reports.type'),
        cell: (info) => <TypeBadge type={info.getValue()} />,
      }),
      columnHelper.accessor('schedule', {
        header: () => t('admin:reports.schedule'),
        cell: (info) => {
          const row = info.row.original;
          const scheduleKey = info.getValue();
          if (scheduleKey === 'custom' && row.cronExpression) {
            return <span className="text-sm font-mono">{row.cronExpression}</span>;
          }
          return (
            <span className="text-sm text-muted-foreground">
              {t(`admin:reports.schedule_${scheduleKey}`)}
            </span>
          );
        },
      }),
      columnHelper.accessor('format', {
        header: () => t('admin:reports.format'),
        cell: (info) => <FormatBadge format={info.getValue()} />,
      }),
      columnHelper.display({
        id: 'isActive',
        header: () => t('admin:reports.active'),
        cell: (info) => <ActiveToggle report={info.row.original} />,
      }),
    ],
    [t],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('admin:reports.title')}>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t('admin:reports.create')}
          </Button>
        </PageHeader>
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  const isEmpty = reports.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin:reports.title')}>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:reports.create')}
        </Button>
      </PageHeader>

      {isEmpty ? (
        <EmptyState
          icon={Calendar}
          message={t('admin:reports.empty')}
        />
      ) : (
        <DataTable
          data={reports}
          columns={columns}
          searchPlaceholder={t('admin:reports.searchPlaceholder')}
          noResultsMessage={t('admin:reports.noResults')}
          onRowClick={(report) => setEditReport(report)}
        />
      )}

      <ReportForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
      />

      <ReportForm
        open={editReport !== null}
        onOpenChange={(open) => { if (!open) setEditReport(null); }}
        mode="edit"
        report={editReport ?? undefined}
      />
    </div>
  );
}
