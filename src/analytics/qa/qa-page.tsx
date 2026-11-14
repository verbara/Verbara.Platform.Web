import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { type ColumnDef } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/core/ui/badge';
import { Button } from '@/core/ui/button';
import { DataTable } from '@/core/ui/data-table';
import { ScoreInline } from './score-gauge';
import { QaDetailDrawer } from './qa-detail-drawer';
import { AnalysisUnavailable } from '@/analytics/shared/analysis-unavailable';
import { useQaList, useQaSurfaces, type QaRow } from '@/core/api/hooks/use-analytics';
import { useAnalyticsFilterStore } from '@/core/stores/analytics-filter-store';
import { useFormatDate } from '@/core/i18n/use-format';

export default function QaPage() {
  const { t } = useTranslation('analytics');
  const { formatDateShort } = useFormatDate();
  const [searchParams] = useSearchParams();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page, setPage] = useState(1);
  // The QA list takes no queue, so the queue filter is neither sent nor shown here.
  const { from, to } = useAnalyticsFilterStore();
  // The availability is refetched on every visit: a bookmarked page must not trust a
  // stale answer, while the sidebar keeps the long stale time.
  const surfaces = useQaSurfaces({ refetchOnMount: true });

  const autoSessionId = searchParams.get('sessionId');

  // Auto-open detail drawer when a sessionId is provided in the URL query.
  // Legitimate because the source of truth is the URL (router-controlled), and
  // the drawer state needs to reflect that on navigation.
  useEffect(() => {
    if (autoSessionId) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setSelectedSessionId(autoSessionId);
      setDrawerOpen(true);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [autoSessionId]);

  // Reset to first page when filters (Zustand store) change. External store
  // ownership prevents co-locating with the setter.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [from, to]);

  const { data, isLoading } = useQaList(from, to, undefined, page, surfaces.qa);

  const rows: QaRow[] = data?.data ?? [];
  const showSentiment = surfaces.sentiment;

  const columns = useMemo<ColumnDef<QaRow, unknown>[]>(
    () => [
      {
        accessorKey: 'analyzedAt',
        header: t('cdr.date'),
        cell: ({ getValue }) => {
          const val = getValue() as string;
          return val ? formatDateShort(val) : '—';
        },
      },
      {
        accessorKey: 'agentName',
        header: t('cdr.agent'),
        cell: ({ getValue }) => (getValue() as string | null | undefined) ?? '—',
      },
      {
        accessorKey: 'queueName',
        header: t('cdr.queue'),
        cell: ({ getValue }) => (getValue() as string | null | undefined) ?? '—',
      },
      {
        accessorKey: 'qaScore',
        header: t('qa.score'),
        cell: ({ getValue }) => <ScoreInline score={getValue() as number} />,
      },
      {
        accessorKey: 'summaryNarrative',
        header: t('qa.summary'),
        cell: ({ getValue }) => (
          <span className="line-clamp-1 max-w-[300px]">
            {(getValue() as string | null | undefined) ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'hasComplianceViolations',
        header: t('qa.compliance'),
        cell: ({ getValue }) => {
          const fail = getValue() as boolean;
          return <Badge variant={fail ? 'destructive' : 'default'}>{fail ? 'Fail' : 'Pass'}</Badge>;
        },
      },
      // Sentiment is shown only where the tenant's call language is supported.
      ...(showSentiment
        ? [
            {
              accessorKey: 'sentimentLabel',
              header: t('qa.sentiment'),
              cell: ({ getValue }) => {
                const val = (getValue() as string | null | undefined) ?? '';
                const color =
                  val === 'Positive'
                    ? 'text-green-600'
                    : val === 'Negative'
                      ? 'text-red-500'
                      : 'text-slate-500';
                return <span className={color}>{val || '—'}</span>;
              },
            } satisfies ColumnDef<QaRow, unknown>,
          ]
        : []),
      {
        accessorKey: 'topics',
        header: t('qa.topics'),
        cell: ({ getValue }) => {
          const topics = (getValue() as string[]) ?? [];
          return (
            <div className="flex flex-wrap gap-1">
              {topics.slice(0, 2).map((topic) => (
                <Badge key={topic} variant="secondary" className="text-xs">
                  {topic}
                </Badge>
              ))}
              {topics.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{topics.length - 2}
                </Badge>
              )}
            </div>
          );
        },
      },
    ],
    [t, formatDateShort, showSentiment],
  );

  const handleRowClick = useCallback((row: QaRow) => {
    setSelectedSessionId(row.sessionId);
    setDrawerOpen(true);
  }, []);

  if (!surfaces.qa) {
    return (
      <div className="space-y-4" data-testid="qa-page">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('qa.title')}</h1>
        {surfaces.qaReason ? (
          <AnalysisUnavailable reason={surfaces.qaReason} testId="qa-unavailable" />
        ) : (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            {t('status.loading', { ns: 'common' })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="qa-page">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('qa.title')}</h1>

      {surfaces.sentimentUnsupported && (
        <p className="text-sm text-muted-foreground" data-testid="qa-sentiment-unsupported">
          {t('availability.sentiment_unsupported')}
        </p>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          {t('status.loading', { ns: 'common' })}
        </div>
      ) : (
        <div data-testid="qa-table">
          <DataTable<QaRow>
            data={rows}
            columns={columns}
            searchPlaceholder={t('cdr.search_placeholder')}
            pageSize={50}
            onRowClick={handleRowClick}
          />
        </div>
      )}

      {/* Server paging: the list answers one page of 50 and says whether another follows. */}
      <div className="flex items-center justify-end gap-2" data-testid="qa-pagination">
        <Button
          variant="outline"
          size="sm"
          data-testid="qa-page-previous"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          {t('qa.paging.previous')}
        </Button>
        <span className="text-sm text-muted-foreground" data-testid="qa-page-number">
          {t('qa.paging.page', { page })}
        </span>
        <Button
          variant="outline"
          size="sm"
          data-testid="qa-page-next"
          disabled={!data?.hasMore}
          onClick={() => setPage((p) => p + 1)}
        >
          {t('qa.paging.next')}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <QaDetailDrawer
        sessionId={selectedSessionId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
