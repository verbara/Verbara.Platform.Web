// R5.2 PB.1 — admin audit log viewer.
//
// PlatformAdmin / partner-admin surface backed by the new
// `audit.read` / `audit.export` permissions seeded by P0.9 (`f20892e`).
// Replaces the P0.10 placeholder with a filter panel + paged DataTable
// + drawer detail (overview / diff / metadata) + CSV/JSON export.
//
// Brownfield audit:
//   - DataTable + DrawerDetail + CodeBlock primitives all ship from R5.1.
//   - <Sheet> is the canonical drawer surface, embedded inside DrawerDetail.
//   - useFormatDate gives consistent locale-aware timestamps.
//   - Paged backend (50 rows/page default, max 500); rows are virtualized via
//     DataTable virtualized={true} so a full 500-row page renders in bounded DOM.

import { useMemo, useState } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Download, FileText, Filter, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '@/core/ui/badge';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { CodeBlock } from '@/core/ui/code-block';
import { DrawerDetail, type DrawerDetailTab } from '@/core/ui/drawer-detail';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/core/ui/dropdown-menu';
import { PageHeader } from '@/admin/shared/page-header';
import { DataTable } from '@/admin/shared/data-table';
import { useFormatDate } from '@/core/i18n/use-format';
import { useAuthStore } from '@/core/auth/auth-store';
import { useAuditEvents, type AuditEventDto, type AuditEventsFilter } from './use-audit-events';
import { useAuditExport, type AuditExportFormat } from './use-audit-export';

const PAGE_SIZE = 50;
const col = createColumnHelper<AuditEventDto>();

// ─── Filter panel state ─────────────────────────────────────────────────────

interface DraftFilters {
  actionPrefix: string;
  actor: string;
  target: string;
  from: string;
  to: string;
  tenantId: string;
}

const EMPTY_DRAFT: DraftFilters = {
  actionPrefix: '',
  actor: '',
  target: '',
  from: '',
  to: '',
  tenantId: '',
};

function draftToFilter(draft: DraftFilters, page: number): AuditEventsFilter {
  return {
    actionPrefix: draft.actionPrefix || undefined,
    actor: draft.actor || undefined,
    target: draft.target || undefined,
    // Date inputs serialize as `YYYY-MM-DD`; widen to ISO instants so the
    // backend's DateTimeOffset binder accepts them. End-of-day is inclusive.
    from: draft.from ? new Date(`${draft.from}T00:00:00Z`).toISOString() : undefined,
    to: draft.to ? new Date(`${draft.to}T23:59:59Z`).toISOString() : undefined,
    tenantId: draft.tenantId || undefined,
    page,
    pageSize: PAGE_SIZE,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function severityVariant(severity: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (severity) {
    case 'critical':
      return 'destructive';
    case 'warning':
      return 'secondary';
    case 'info':
      return 'default';
    default:
      return 'outline';
  }
}

function safeStringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    // Avoid the default `[object Object]` fallback by name-checking the value's
    // own `toString` before reaching for it.
    if (typeof value === 'object' && value !== null) {
      return Object.prototype.toString.call(value);
    }
    return typeof value === 'string' ? value : `${value as number | boolean | bigint}`;
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function AuditViewerPage() {
  const { t } = useTranslation(['admin']);
  const { formatDate, formatRelative } = useFormatDate();
  const isPlatformAdmin = useAuthStore((s) => s.permissions.includes('platform:tenant:manage'));
  const canExport = useAuthStore((s) => s.permissions.includes('audit.export'));

  const [draft, setDraft] = useState<DraftFilters>(EMPTY_DRAFT);
  const [applied, setApplied] = useState<DraftFilters>(EMPTY_DRAFT);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditEventDto | null>(null);

  const filter = useMemo(() => draftToFilter(applied, page), [applied, page]);
  const { data, isFetching } = useAuditEvents(filter);
  const exportMutation = useAuditExport();

  const events = data?.data?.items ?? [];
  const totalCount = data?.data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const retentionDays = data?.retentionDays ?? null;

  function handleApply() {
    setPage(1);
    setApplied(draft);
  }

  function handleReset() {
    setDraft(EMPTY_DRAFT);
    setApplied(EMPTY_DRAFT);
    setPage(1);
  }

  function handleExport(format: AuditExportFormat) {
    exportMutation.mutate({ format, filter: draftToFilter(applied, 1) });
  }

  const columns = useMemo(
    () => [
      col.accessor('occurredAt', {
        header: () => t('admin:security_admin.audit.columns.timestamp'),
        cell: (info) => {
          const value = info.getValue();
          return (
            <span title={formatDate(value)} className="text-xs text-muted-foreground">
              {formatRelative(value)}
            </span>
          );
        },
      }),
      col.accessor('action', {
        header: () => t('admin:security_admin.audit.columns.action'),
        cell: (info) => (
          <span
            className="font-mono text-xs"
            data-testid={`audit-row-action-${info.row.original.entryId}`}
          >
            {info.getValue()}
          </span>
        ),
      }),
      col.accessor('actorId', {
        header: () => t('admin:security_admin.audit.columns.actor'),
        cell: (info) => <span className="text-sm">{info.getValue()}</span>,
      }),
      col.display({
        id: 'target',
        header: () => t('admin:security_admin.audit.columns.target'),
        cell: ({ row }) => {
          const { targetType, targetId } = row.original;
          if (!targetId) return <span className="text-muted-foreground">—</span>;
          return (
            <span className="text-xs font-mono">
              {targetType ? `${targetType}/` : ''}
              {targetId}
            </span>
          );
        },
      }),
      col.accessor('severity', {
        header: () => t('admin:security_admin.audit.columns.severity'),
        cell: (info) => <Badge variant={severityVariant(info.getValue())}>{info.getValue()}</Badge>,
      }),
      col.accessor('status', {
        header: () => t('admin:security_admin.audit.columns.status'),
        cell: (info) => <span className="text-sm capitalize">{info.getValue()}</span>,
      }),
    ],
    [t, formatDate, formatRelative],
  );

  const drawerTabs = useMemo<ReadonlyArray<DrawerDetailTab>>(() => {
    if (!selected) return [];
    const before = safeStringify(selected.before);
    const after = safeStringify(selected.after);
    const hasDiff = before.length > 0 || after.length > 0;
    const metadataJson = selected.metadata ? safeStringify(selected.metadata) : '';

    return [
      {
        key: 'overview',
        label: t('admin:security_admin.audit.drawer.tabs.overview'),
        content: (
          <div className="space-y-2 text-sm" data-testid="audit-drawer-overview">
            <p>
              <strong>{t('admin:security_admin.audit.columns.action')}:</strong>{' '}
              <span className="font-mono">{selected.action}</span>
            </p>
            <p>
              <strong>{t('admin:security_admin.audit.columns.timestamp')}:</strong>{' '}
              {formatDate(selected.occurredAt)}
            </p>
            <p>
              <strong>{t('admin:security_admin.audit.columns.actor')}:</strong> {selected.actorId} (
              {selected.actorType})
            </p>
            {selected.targetId && (
              <p>
                <strong>{t('admin:security_admin.audit.columns.target')}:</strong>{' '}
                {selected.targetType ? `${selected.targetType}/` : ''}
                {selected.targetId}
              </p>
            )}
            {selected.impersonatorId && (
              <p>
                <strong>Impersonator:</strong> {selected.impersonatorId}
              </p>
            )}
            <Link
              to="/admin/retention"
              className="inline-block text-xs text-brand underline"
              data-testid="audit-drawer-retention-link"
            >
              {t('admin:security_admin.audit.drawer.retention_disclosure')}
            </Link>
          </div>
        ),
      },
      {
        key: 'diff',
        label: t('admin:security_admin.audit.drawer.tabs.diff'),
        content: hasDiff ? (
          <div className="space-y-3" data-testid="audit-drawer-diff">
            {before.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">
                  {t('admin:security_admin.audit.drawer.before')}
                </p>
                <CodeBlock code={before} language="json" />
              </div>
            )}
            {after.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">
                  {t('admin:security_admin.audit.drawer.after')}
                </p>
                <CodeBlock code={after} language="json" />
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground" data-testid="audit-drawer-diff-empty">
            {t('admin:security_admin.audit.drawer.no_diff')}
          </p>
        ),
      },
      {
        key: 'metadata',
        label: t('admin:security_admin.audit.drawer.tabs.metadata'),
        content:
          metadataJson.length > 0 ? (
            <div data-testid="audit-drawer-metadata">
              <CodeBlock code={metadataJson} language="json" />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground" data-testid="audit-drawer-metadata-empty">
              {t('admin:security_admin.audit.drawer.no_metadata')}
            </p>
          ),
      },
    ];
  }, [selected, t, formatDate]);

  return (
    <div className="space-y-6" data-testid="audit-viewer-page">
      <PageHeader
        title={t('admin:security_admin.audit.title')}
        description={t('admin:security_admin.audit.description')}
      >
        {canExport && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  data-testid="audit-export-button"
                  disabled={exportMutation.isPending}
                />
              }
            >
              <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {t('admin:security_admin.audit.export.label')}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem data-testid="audit-export-csv" onClick={() => handleExport('csv')}>
                <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
                {t('admin:security_admin.audit.export.csv')}
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid="audit-export-json"
                onClick={() => handleExport('json')}
              >
                <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
                {t('admin:security_admin.audit.export.json')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </PageHeader>

      {retentionDays !== null && (
        <p className="text-xs text-muted-foreground" data-testid="audit-retention-summary">
          {t('admin:security_admin.audit.retention_summary', { days: retentionDays })}
        </p>
      )}

      {/* Filter panel */}
      <div className="rounded-lg border bg-card p-4 shadow-sm" data-testid="audit-viewer-filters">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="space-y-1.5">
            <Label htmlFor="audit-filter-action-prefix">
              {t('admin:security_admin.audit.filters.action_prefix')}
            </Label>
            <Input
              id="audit-filter-action-prefix"
              data-testid="audit-filter-action-prefix"
              placeholder={t('admin:security_admin.audit.filters.action_prefix_placeholder')}
              value={draft.actionPrefix}
              onChange={(e) => setDraft((d) => ({ ...d, actionPrefix: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-filter-actor">
              {t('admin:security_admin.audit.filters.actor')}
            </Label>
            <Input
              id="audit-filter-actor"
              data-testid="audit-filter-actor"
              placeholder={t('admin:security_admin.audit.filters.actor_placeholder')}
              value={draft.actor}
              onChange={(e) => setDraft((d) => ({ ...d, actor: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-filter-target">
              {t('admin:security_admin.audit.filters.target')}
            </Label>
            <Input
              id="audit-filter-target"
              data-testid="audit-filter-target"
              placeholder={t('admin:security_admin.audit.filters.target_placeholder')}
              value={draft.target}
              onChange={(e) => setDraft((d) => ({ ...d, target: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-filter-from">
              {t('admin:security_admin.audit.filters.from')}
            </Label>
            <Input
              id="audit-filter-from"
              data-testid="audit-filter-from"
              type="date"
              value={draft.from}
              onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-filter-to">{t('admin:security_admin.audit.filters.to')}</Label>
            <Input
              id="audit-filter-to"
              data-testid="audit-filter-to"
              type="date"
              value={draft.to}
              onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
            />
          </div>
          {isPlatformAdmin && (
            <div className="space-y-1.5">
              <Label htmlFor="audit-filter-tenant">
                {t('admin:security_admin.audit.filters.tenant')}
              </Label>
              <Input
                id="audit-filter-tenant"
                data-testid="audit-filter-tenant"
                placeholder={t('admin:security_admin.audit.filters.tenant_placeholder')}
                value={draft.tenantId}
                onChange={(e) => setDraft((d) => ({ ...d, tenantId: e.target.value }))}
              />
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button data-testid="audit-filter-apply" onClick={handleApply} disabled={isFetching}>
            <Filter className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {t('admin:security_admin.audit.filters.apply')}
          </Button>
          <Button
            variant="ghost"
            data-testid="audit-filter-reset"
            onClick={handleReset}
            disabled={isFetching}
          >
            <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {t('admin:security_admin.audit.filters.reset')}
          </Button>
          {isFetching && (
            <span className="text-xs text-muted-foreground">
              {t('admin:security_admin.audit.loading')}
            </span>
          )}
        </div>
      </div>

      {/* Results */}
      {events.length === 0 && !isFetching ? (
        <div
          className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground"
          data-testid="audit-viewer-empty"
        >
          {t('admin:security_admin.audit.empty')}
        </div>
      ) : (
        <div className="space-y-3" data-testid="audit-viewer-results">
          <DataTable
            data={[...events]}
            columns={columns}
            pageSize={PAGE_SIZE}
            onRowClick={(row) => setSelected(row)}
            virtualized
          />

          {/* Server-side pagination — DataTable does its own client paging on
              the page slice we already fetched, so we expose Prev/Next on top. */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages} · {totalCount} events
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                data-testid="audit-page-prev"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isFetching}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                data-testid="audit-page-next"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isFetching}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <DrawerDetail
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={t('admin:security_admin.audit.drawer.title')}
        subtitle={selected?.action}
        tabs={drawerTabs}
        width="lg"
      />
    </div>
  );
}
