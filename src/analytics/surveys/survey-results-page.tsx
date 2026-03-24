import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { type ColumnDef } from '@tanstack/react-table';
import { ChevronDown, ChevronRight, ClipboardList } from 'lucide-react';
import { Badge } from '@/core/ui/badge';
import { DataTable } from '@/admin/shared/data-table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/ui/select';
import {
  useSurveys,
  useSurveySummary,
  useSurveyResponses,
  type SurveyResponse,
} from '@/core/api/hooks/use-surveys';

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
}

function KpiCard({ label, value, sub }: KpiCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ResponseDetail({ response }: { response: SurveyResponse }) {
  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-4">
      {response.answers.map((ans) => (
        <div key={ans.questionId} className="space-y-0.5">
          <p className="text-xs font-medium text-muted-foreground">{ans.questionText}</p>
          <p className="text-sm text-foreground">{String(ans.answer)}</p>
        </div>
      ))}
    </div>
  );
}

function ExpandableResponseTable({ responses }: { responses: SurveyResponse[] }) {
  const { t } = useTranslation('analytics');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const columns = useMemo<ColumnDef<SurveyResponse, unknown>[]>(
    () => [
      {
        id: 'expander',
        header: '',
        size: 40,
        cell: ({ row }) => {
          const isOpen = expandedId === row.original.id;
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpandedId(isOpen ? null : row.original.id);
              }}
              className="flex items-center text-muted-foreground hover:text-foreground"
            >
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          );
        },
      },
      {
        accessorKey: 'respondedAt',
        header: t('cdr.date'),
        cell: ({ getValue }) => {
          const val = getValue() as string;
          return val ? new Date(val).toLocaleDateString() : '—';
        },
      },
      {
        accessorKey: 'contactName',
        header: t('cdr.contact'),
        cell: ({ getValue }) => (getValue() as string | undefined) ?? '—',
      },
      {
        accessorKey: 'agentName',
        header: t('cdr.agent'),
        cell: ({ getValue }) => (getValue() as string | undefined) ?? '—',
      },
      {
        accessorKey: 'score',
        header: t('surveys.score'),
        cell: ({ getValue }) => {
          const score = getValue() as number | undefined;
          if (score === undefined) return <span className="text-muted-foreground">—</span>;
          return <span className="tabular-nums font-medium">{score}</span>;
        },
      },
      {
        id: 'preview',
        header: t('surveys.answerPreview'),
        cell: ({ row }) => {
          const first = row.original.answers[0];
          if (!first) return <span className="text-muted-foreground">—</span>;
          return (
            <span className="line-clamp-1 max-w-[200px] text-sm text-muted-foreground">
              {String(first.answer)}
            </span>
          );
        },
      },
    ],
    [t, expandedId],
  );

  if (responses.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t('surveys.noResponses')}
      </p>
    );
  }

  return (
    <div className="space-y-0">
      <DataTable<SurveyResponse>
        data={responses}
        columns={columns}
        searchPlaceholder={t('surveys.searchResponses')}
        pageSize={15}
        onRowClick={(row) =>
          setExpandedId(expandedId === row.id ? null : row.id)
        }
      />
      {expandedId !== null && (() => {
        const r = responses.find((x) => x.id === expandedId);
        return r ? (
          <div className="mt-2">
            <ResponseDetail response={r} />
          </div>
        ) : null;
      })()}
    </div>
  );
}

const NO_SELECTION = '__none__';

export default function SurveyResultsPage() {
  const { t } = useTranslation('analytics');
  const [selectedSurveyId, setSelectedSurveyId] = useState<number | undefined>(undefined);

  const { data: surveys = [] } = useSurveys();
  const { data: summary, isLoading: summaryLoading } = useSurveySummary(selectedSurveyId);
  const { data: responses = [], isLoading: responsesLoading } = useSurveyResponses(selectedSurveyId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('surveys.title')}
        </h1>
      </div>

      {/* Survey Selector */}
      <div className="flex items-center gap-3">
        <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
        <Select
          value={selectedSurveyId !== undefined ? String(selectedSurveyId) : NO_SELECTION}
          onValueChange={(v) =>
            setSelectedSurveyId(v === NO_SELECTION ? undefined : Number(v))
          }
        >
          <SelectTrigger className="w-72">
            <SelectValue placeholder={t('surveys.selectSurvey')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_SELECTION}>{t('surveys.selectSurvey')}</SelectItem>
            {surveys.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedSurveyId !== undefined && (
          <Badge variant="outline">{surveys.find((s) => s.id === selectedSurveyId)?.type}</Badge>
        )}
      </div>

      {selectedSurveyId === undefined && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <ClipboardList className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('surveys.selectSurveyHint')}</p>
        </div>
      )}

      {selectedSurveyId !== undefined && (summaryLoading || responsesLoading) && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          {t('common.loading', 'Loading…')}
        </div>
      )}

      {selectedSurveyId !== undefined && !summaryLoading && !responsesLoading && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              label={t('surveys.totalResponses')}
              value={summary?.totalResponses ?? responses.length}
            />
            <KpiCard
              label={t('surveys.avgScore')}
              value={
                summary?.avgScore !== null && summary?.avgScore !== undefined
                  ? summary.avgScore.toFixed(1)
                  : '—'
              }
            />
            <KpiCard
              label={t('surveys.surveysLabel')}
              value={surveys.find((s) => s.id === selectedSurveyId)?.name ?? ''}
            />
          </div>

          {/* Responses Table */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {t('surveys.responsesTitle')}
            </h2>
            <ExpandableResponseTable responses={responses} />
          </div>
        </>
      )}
    </div>
  );
}
