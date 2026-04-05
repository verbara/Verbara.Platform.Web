import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { type ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/core/ui/badge';
import { DataTable } from '@/admin/shared/data-table';
import { ScoreInline } from './score-gauge';
import { QaDetailDrawer } from './qa-detail-drawer';
import { useQaList, type QaRow } from '@/core/api/hooks/use-analytics';

export default function QaPage() {
  const { t } = useTranslation('analytics');
  const [searchParams] = useSearchParams();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page] = useState(1);

  const autoSessionId = searchParams.get('sessionId');

  useEffect(() => {
    if (autoSessionId) {
      setSelectedSessionId(autoSessionId);
      setDrawerOpen(true);
    }
  }, [autoSessionId]);

  const { data, isLoading } = useQaList(undefined, undefined, {}, page);

  const rows: QaRow[] = data?.items ?? [];

  const columns = useMemo<ColumnDef<QaRow, unknown>[]>(
    () => [
      {
        accessorKey: 'analyzedAt',
        header: t('cdr.date'),
        cell: ({ getValue }) => {
          const val = getValue() as string;
          return val ? new Date(val).toLocaleDateString() : '—';
        },
      },
      {
        accessorKey: 'agentName',
        header: t('cdr.agent'),
        cell: ({ getValue }) => (getValue() as string | undefined) ?? '—',
      },
      {
        accessorKey: 'queueName',
        header: t('cdr.queue'),
        cell: ({ getValue }) => (getValue() as string | undefined) ?? '—',
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
            {(getValue() as string | undefined) ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'hasComplianceViolations',
        header: t('qa.compliance'),
        cell: ({ getValue }) => {
          const fail = getValue() as boolean;
          return (
            <Badge variant={fail ? 'destructive' : 'default'}>
              {fail ? 'Fail' : 'Pass'}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'sentimentLabel',
        header: t('qa.sentiment'),
        cell: ({ getValue }) => {
          const val = (getValue() as string | undefined) ?? '';
          const color =
            val === 'Positive'
              ? 'text-green-600'
              : val === 'Negative'
                ? 'text-red-500'
                : 'text-slate-500';
          return <span className={color}>{val || '—'}</span>;
        },
      },
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
    [t],
  );

  const handleRowClick = useCallback((row: QaRow) => {
    setSelectedSessionId(row.sessionId);
    setDrawerOpen(true);
  }, []);

  return (
    <div className="space-y-4" data-testid="qa-page">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
        {t('qa.title')}
      </h1>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          {t('common.loading', 'Loading…')}
        </div>
      ) : (
        <div data-testid="qa-table">
          <DataTable<QaRow>
            data={rows}
            columns={columns}
            searchPlaceholder={t('cdr.search_placeholder')}
            pageSize={10}
            onRowClick={handleRowClick}
          />
        </div>
      )}

      <QaDetailDrawer
        sessionId={selectedSessionId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
