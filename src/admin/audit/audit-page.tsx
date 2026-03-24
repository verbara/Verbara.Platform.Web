import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileSearch, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Badge } from '@/core/ui/badge';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { useAuditSearch, type AuditEntry } from '@/core/api/hooks/use-audit';

/* ---------- Action badge ---------- */

const ACTION_BADGE: Record<string, { variant: 'default' | 'destructive' | 'secondary' | 'outline'; className: string }> = {
  create: { variant: 'default', className: 'bg-green-600 text-white hover:bg-green-700' },
  update: { variant: 'secondary', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  delete: { variant: 'destructive', className: '' },
};

function ActionBadge({ action }: { action: string }) {
  const lower = action.toLowerCase();
  const style = ACTION_BADGE[lower];
  if (!style) {
    return <Badge variant="outline">{action}</Badge>;
  }
  return (
    <Badge variant={style.variant} className={style.className}>
      {action}
    </Badge>
  );
}

/* ---------- Detail cell with expand ---------- */

function DetailsCell({ details }: { details?: string }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation(['admin']);

  if (!details) return <span className="text-muted-foreground">—</span>;

  const truncated = details.length > 80;
  const display = truncated && !expanded ? `${details.slice(0, 80)}…` : details;

  return (
    <span className="text-sm">
      {display}
      {truncated && (
        <button
          type="button"
          className="ml-1 text-xs text-brand underline"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          {expanded ? t('admin:audit.collapse') : t('admin:audit.expand')}
        </button>
      )}
    </span>
  );
}

/* ---------- Filter form state ---------- */

interface FilterState {
  action: string;
  entityType: string;
  performedBy: string;
  from: string;
  to: string;
}

const DEFAULT_FILTERS: FilterState = {
  action: '',
  entityType: '',
  performedBy: '',
  from: '',
  to: '',
};

/* ---------- Main page ---------- */

const PAGE_SIZE = 25;

export default function AuditPage() {
  const { t } = useTranslation(['admin']);

  const [draft, setDraft] = useState<FilterState>(DEFAULT_FILTERS);
  const [applied, setApplied] = useState<FilterState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);

  const { data, isFetching } = useAuditSearch({
    action: applied.action || undefined,
    entityType: applied.entityType || undefined,
    performedBy: applied.performedBy || undefined,
    from: applied.from || undefined,
    to: applied.to || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const items: AuditEntry[] = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function handleSearch() {
    setPage(1);
    setApplied(draft);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSearch();
  }

  function formatTimestamp(ts: string) {
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'medium',
      }).format(new Date(ts));
    } catch {
      return ts;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin:audit.title')}
        description={t('admin:audit.description')}
      />

      {/* Filter bar */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {/* Action */}
          <div className="space-y-1.5">
            <Label htmlFor="audit-action">{t('admin:audit.filter.action')}</Label>
            <Input
              id="audit-action"
              placeholder={t('admin:audit.filter.actionPlaceholder')}
              value={draft.action}
              onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))}
              onKeyDown={handleKeyDown}
            />
          </div>

          {/* Entity type */}
          <div className="space-y-1.5">
            <Label htmlFor="audit-entity-type">{t('admin:audit.filter.entityType')}</Label>
            <Input
              id="audit-entity-type"
              placeholder={t('admin:audit.filter.entityTypePlaceholder')}
              value={draft.entityType}
              onChange={(e) => setDraft((d) => ({ ...d, entityType: e.target.value }))}
              onKeyDown={handleKeyDown}
            />
          </div>

          {/* Performed by */}
          <div className="space-y-1.5">
            <Label htmlFor="audit-performed-by">{t('admin:audit.filter.performedBy')}</Label>
            <Input
              id="audit-performed-by"
              placeholder={t('admin:audit.filter.performedByPlaceholder')}
              value={draft.performedBy}
              onChange={(e) => setDraft((d) => ({ ...d, performedBy: e.target.value }))}
              onKeyDown={handleKeyDown}
            />
          </div>

          {/* From date */}
          <div className="space-y-1.5">
            <Label htmlFor="audit-from">{t('admin:audit.filter.from')}</Label>
            <Input
              id="audit-from"
              type="date"
              value={draft.from}
              onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
            />
          </div>

          {/* To date */}
          <div className="space-y-1.5">
            <Label htmlFor="audit-to">{t('admin:audit.filter.to')}</Label>
            <Input
              id="audit-to"
              type="date"
              value={draft.to}
              onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
            />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button onClick={handleSearch} disabled={isFetching}>
            <Search className="mr-1.5 h-4 w-4" />
            {t('admin:audit.search')}
          </Button>
          {isFetching && (
            <span className="text-sm text-muted-foreground">{t('admin:audit.loading')}</span>
          )}
        </div>
      </div>

      {/* Results */}
      {items.length === 0 && !isFetching ? (
        <EmptyState
          icon={FileSearch}
          message={t('admin:audit.empty')}
        />
      ) : (
        <div className="space-y-3">
          {/* Table */}
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t('admin:audit.col.timestamp')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t('admin:audit.col.action')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t('admin:audit.col.entityType')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t('admin:audit.col.entityId')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t('admin:audit.col.performedBy')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t('admin:audit.col.details')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((entry) => (
                  <tr key={entry.id} className="transition-colors hover:bg-muted/50">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatTimestamp(entry.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={entry.action} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{entry.entityType}</Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {entry.entityId}
                    </td>
                    <td className="px-4 py-3">{entry.performedBy}</td>
                    <td className="max-w-xs px-4 py-3">
                      <DetailsCell details={entry.details} />
                    </td>
                  </tr>
                ))}
                {items.length === 0 && isFetching && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      {t('admin:audit.loading')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t('admin:audit.pagination.summary', {
                page,
                total: totalPages,
                count: totalCount,
              })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isFetching}
              >
                <ChevronLeft className="h-4 w-4" />
                {t('admin:audit.pagination.prev')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isFetching}
              >
                {t('admin:audit.pagination.next')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
