import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, Calendar, Trash2, Play, Clock, Download } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { Switch } from '@/core/ui/switch';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { PermissionGuard } from '@/core/auth/permission-guard';
import { ReportForm } from './report-form';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/core/ui/sheet';
import {
  useReports,
  useUpdateReport,
  useDeleteReport,
  useRunReport,
  useReportHistory,
  type ScheduledReport,
  type ReportType,
  type ReportFormat,
  type ReportExecution,
} from '@/core/api/hooks/use-reports';

const columnHelper = createColumnHelper<ScheduledReport>();

const REPORT_TYPE_VARIANT: Record<ReportType, 'default' | 'secondary' | 'outline'> = {
  agent_performance: 'default',
  queue_analytics: 'secondary',
  conversation_summary: 'outline',
};

function TypeBadge({ type }: Readonly<{ type: ReportType }>) {
  const { t } = useTranslation(['admin']);
  return <Badge variant={REPORT_TYPE_VARIANT[type] ?? 'outline'}>{t(`admin:reports.type_${type}`, type)}</Badge>;
}

function FormatBadge({ format }: { format: ReportFormat }) {
  return (
    <Badge variant={format === 'PDF' ? 'secondary' : 'outline'}>
      {format}
    </Badge>
  );
}

function ActiveToggle({ report }: { report: ScheduledReport }) {
  const updateReport = useUpdateReport();
  return (
    <Switch
      checked={report.isActive}
      onCheckedChange={(checked) =>
        updateReport.mutate({ id: report.id, isActive: checked })
      }
      onClick={(e) => e.stopPropagation()}
    />
  );
}

function statusVariant(status: ReportExecution['status']): 'default' | 'destructive' | 'secondary' {
  if (status === 'Completed') return 'default';
  if (status === 'Failed') return 'destructive';
  return 'secondary';
}

export default function ReportsPage() {
  const { t } = useTranslation(['admin']);
  const [createOpen, setCreateOpen] = useState(false);
  const [editReport, setEditReport] = useState<ScheduledReport | null>(null);
  const [deletingReport, setDeletingReport] = useState<ScheduledReport | null>(null);
  const [historyReportId, setHistoryReportId] = useState<string | undefined>();
  const deleteReport = useDeleteReport();
  const runReport = useRunReport();
  const { data: history = [] } = useReportHistory(historyReportId);

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
      columnHelper.display({
        id: 'actions',
        header: () => '',
        cell: (info) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              title="Run now"
              disabled={runReport.isPending}
              data-testid={`report-run-${info.row.original.id}`}
              onClick={(e) => { e.stopPropagation(); runReport.mutate(info.row.original.id); }}
            >
              <Play className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              title="Execution history"
              data-testid={`report-history-${info.row.original.id}`}
              onClick={(e) => { e.stopPropagation(); setHistoryReportId(info.row.original.id); }}
            >
              <Clock className="h-3.5 w-3.5" />
            </Button>
            <PermissionGuard requires="reporting:dashboard:edit">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                data-testid={`delete-report-${info.row.original.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setDeletingReport(info.row.original);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </PermissionGuard>
          </div>
        ),
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
    <div className="space-y-6" data-testid="reports-page">
      <PageHeader title={t('admin:reports.title')}>
        <Button onClick={() => setCreateOpen(true)} data-testid="reports-create-btn">
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

      <ConfirmDeleteDialog
        open={deletingReport !== null}
        onOpenChange={(open) => { if (!open) setDeletingReport(null); }}
        onConfirm={() => {
          if (!deletingReport) return;
          deleteReport.mutate(deletingReport.id, {
            onSuccess: () => setDeletingReport(null),
          });
        }}
        entityName={deletingReport?.name ?? ''}
        entityType={t('admin:reports.entity_type')}
        isPending={deleteReport.isPending}
      />

      <Sheet open={!!historyReportId} onOpenChange={(open) => { if (!open) setHistoryReportId(undefined); }}>
        <SheetContent data-testid="report-history-sheet">
          <SheetHeader>
            <SheetTitle>Execution History</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {history.map((exec) => (
              <div key={exec.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Badge variant={statusVariant(exec.status)}>{exec.status}</Badge>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(exec.startedAt).toLocaleString()}
                  </p>
                </div>
                {exec.status === 'Completed' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => globalThis.open(`/api/v1/admin/reports/${historyReportId}/history/${exec.id}/download`)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {history.length === 0 && (
              <p className="text-sm text-muted-foreground">No executions yet</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
