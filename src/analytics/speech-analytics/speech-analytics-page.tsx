import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { onHubEvent } from '@/core/realtime';
import { useRealtimeStore } from '@/core/stores/realtime-store';
import { useAnalyticsFilterStore } from '@/core/stores/analytics-filter-store';
import { FilterBar } from '@/analytics/shared/filter-bar';
import { Badge } from '@/core/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/core/ui/tabs';
import {
  useTopicTrends,
  useSentimentTrends,
  useComplianceSummary,
  type ComplianceRuleSummaryDto,
} from '@/core/api/hooks/use-analytics';
import type { ConversationStateChangedPayload } from '@/core/api/hooks/use-conversation-state-stream';
import { useFormatDate } from '@/core/i18n/use-format';
import { PageSkeleton } from '@/core/ui/page-skeleton';

const TOP_N_OPTIONS = [10, 25, 50] as const;
type TopN = (typeof TOP_N_OPTIONS)[number];

const SEVERITY_COLORS: Record<string, string> = {
  Critical: '#ef4444',
  Warning: '#f59e0b',
  Info: '#94a3b8',
};

type SortKey = keyof Pick<
  ComplianceRuleSummaryDto,
  'occurrences' | 'sessionsAffected' | 'firstSeen' | 'lastSeen' | 'ruleName' | 'severity'
>;

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="flex items-center justify-center py-16 text-sm text-muted-foreground"
      data-testid="empty-state"
    >
      {message}
    </div>
  );
}

// ─── Topic Trends Tab ────────────────────────────────────────────────────────

function TopicTrendsTab() {
  const { t } = useTranslation('analytics');
  const { from, to } = useAnalyticsFilterStore();
  const [topN, setTopN] = useState<TopN>(10);

  const { data, isLoading } = useTopicTrends(from, to, topN);

  if (isLoading) return <PageSkeleton variant="cards" rows={3} />;

  const topics = data?.trends ?? [];

  return (
    <div className="space-y-4" data-testid="topics-tab">
      <div className="flex items-center justify-between">
        {data && (
          <p className="text-sm text-muted-foreground">
            {t('speechAnalytics.totalAnalyzed', {
              count: data.totalAnalyzed,
              defaultValue: '{{count}} results analyzed',
            })}
          </p>
        )}
        <select
          value={topN}
          onChange={(e) => setTopN(Number(e.target.value) as TopN)}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          aria-label={t('speechAnalytics.topN')}
        >
          {TOP_N_OPTIONS.map((n) => (
            <option key={n} value={n}>
              Top {n}
            </option>
          ))}
        </select>
      </div>

      {topics.length === 0 ? (
        <EmptyState message={t('speechAnalytics.empty.topics')} />
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topics} layout="vertical" margin={{ left: 16, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    type="category"
                    dataKey="topic"
                    width={120}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip />
                  <Bar dataKey="occurrences" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div
            className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 overflow-auto"
            data-testid="topics-table"
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-slate-300">
                    {t('speechAnalytics.columns.topic')}
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-600 dark:text-slate-300">
                    {t('speechAnalytics.columns.occurrences', { defaultValue: 'Occurrences' })}
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-600 dark:text-slate-300">
                    {t('speechAnalytics.columns.avgConfidence')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {topics.map((row) => (
                  <tr
                    key={row.topic}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-700/50 dark:hover:bg-slate-700/30"
                  >
                    <td className="px-4 py-2 font-medium">{row.topic}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{row.occurrences}</td>
                    <td className="px-4 py-2 text-right">
                      <Badge
                        variant={row.avgConfidence >= 0.8 ? 'default' : 'secondary'}
                        className="tabular-nums"
                      >
                        {Math.round(row.avgConfidence * 100)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sentiment Trends Tab ────────────────────────────────────────────────────

function SentimentTrendsTab() {
  const { t, i18n } = useTranslation('analytics');
  const { from, to, queue } = useAnalyticsFilterStore();
  const [bucket, setBucket] = useState<'day' | 'week'>('day');

  const { data, isLoading } = useSentimentTrends(from, to, bucket, queue || undefined);

  if (isLoading) return <PageSkeleton variant="cards" rows={3} />;

  const points = data?.points ?? [];
  const monthDayFmt = new Intl.DateTimeFormat(i18n.language, {
    month: 'short',
    day: 'numeric',
  });

  const chartData = points.map((p) => ({
    label: monthDayFmt.format(new Date(p.bucketStart)),
    positive: p.positiveCount,
    neutral: p.neutralCount,
    negative: p.negativeCount,
    score: p.avgSentimentScore != null ? Math.round(p.avgSentimentScore * 100) / 100 : null,
  }));

  return (
    <div className="space-y-4" data-testid="sentiment-tab">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{t('speechAnalytics.bucket.day')}:</span>
        <div className="flex overflow-hidden rounded-md border border-slate-200 dark:border-slate-600">
          {(['day', 'week'] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBucket(b)}
              className={`px-3 py-1 text-xs transition-colors ${
                bucket === b
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
              aria-pressed={bucket === b}
            >
              {b === 'day' ? t('speechAnalytics.bucket.day') : t('speechAnalytics.bucket.week')}
            </button>
          ))}
        </div>
      </div>

      {points.length === 0 ? (
        <EmptyState message={t('speechAnalytics.empty.sentiment')} />
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
            <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
              Sentiment Distribution
            </p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="positive" stackId="a" fill="#22c55e" name="Positive" />
                  <Bar dataKey="neutral" stackId="a" fill="#94a3b8" name="Neutral" />
                  <Bar dataKey="negative" stackId="a" fill="#ef4444" name="Negative" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
            <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
              Avg Sentiment Score
            </p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    domain={[-1, 1]}
                  />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Compliance Overview Tab ─────────────────────────────────────────────────

function ComplianceOverviewTab() {
  const { t } = useTranslation('analytics');
  const { formatDateShort } = useFormatDate();
  const { from, to, queue } = useAnalyticsFilterStore();
  const [severity, setSeverity] = useState<'Info' | 'Warning' | 'Critical' | ''>('');
  const [sortKey, setSortKey] = useState<SortKey>('occurrences');
  const [sortAsc, setSortAsc] = useState(false);

  const { data, isLoading } = useComplianceSummary(
    from,
    to,
    queue || undefined,
    severity || undefined,
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  if (isLoading) return <PageSkeleton variant="cards" rows={3} />;

  const rules = [...(data?.rules ?? [])].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    const cmp =
      typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
    return sortAsc ? cmp : -cmp;
  });

  const breakdown = data?.severityBreakdown ?? { critical: 0, warning: 0, info: 0 };
  const pieData = [
    { name: t('speechAnalytics.severity.critical'), value: breakdown.critical, color: '#ef4444' },
    { name: t('speechAnalytics.severity.warning'), value: breakdown.warning, color: '#f59e0b' },
    { name: t('speechAnalytics.severity.info'), value: breakdown.info, color: '#94a3b8' },
  ].filter((d) => d.value > 0);

  const totalViolations = data?.totalViolations ?? 0;
  const totalSessions = data?.totalSessionsWithViolations ?? 0;

  return (
    <div className="space-y-4" data-testid="compliance-tab">
      {/* KPI header */}
      <p className="text-sm text-muted-foreground">
        {t('speechAnalytics.totalViolations', {
          violations: totalViolations,
          sessions: totalSessions,
          defaultValue: 'Total violations: {{violations}} · Sessions affected: {{sessions}}',
        })}
      </p>

      {/* Pie + severity filter row */}
      <div className="flex flex-wrap items-start gap-6">
        {pieData.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="h-44 w-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip />
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={68}
                    dataKey="value"
                    nameKey="name"
                    paddingAngle={2}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="flex-1 space-y-2">
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as 'Info' | 'Warning' | 'Critical' | '')}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            data-testid="severity-filter"
          >
            <option value="">{t('speechAnalytics.severity.all')}</option>
            <option value="Critical">{t('speechAnalytics.severity.critical')}</option>
            <option value="Warning">{t('speechAnalytics.severity.warning')}</option>
            <option value="Info">{t('speechAnalytics.severity.info')}</option>
          </select>
        </div>
      </div>

      {rules.length === 0 ? (
        <EmptyState message={t('speechAnalytics.empty.compliance')} />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 overflow-auto">
          <table className="w-full text-sm" data-testid="compliance-table">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                {(
                  [
                    ['ruleName', t('speechAnalytics.columns.rule')],
                    ['severity', t('speechAnalytics.columns.severity')],
                    [
                      'occurrences',
                      t('speechAnalytics.columns.occurrences', { defaultValue: 'Occurrences' }),
                    ],
                    ['sessionsAffected', t('speechAnalytics.columns.sessionsAffected')],
                    ['firstSeen', t('speechAnalytics.columns.firstSeen')],
                    ['lastSeen', t('speechAnalytics.columns.lastSeen')],
                  ] as [SortKey, string][]
                ).map(([key, label]) => (
                  <th
                    key={key}
                    className="cursor-pointer px-4 py-2.5 text-left font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white select-none"
                    onClick={() => handleSort(key)}
                  >
                    {label}
                    {sortKey === key && <span className="ml-1">{sortAsc ? '↑' : '↓'}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr
                  key={rule.ruleId}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-700/50 dark:hover:bg-slate-700/30"
                >
                  <td className="px-4 py-2 font-medium">{rule.ruleName}</td>
                  <td className="px-4 py-2">
                    <Badge
                      variant={
                        rule.severity === 'Critical'
                          ? 'destructive'
                          : rule.severity === 'Warning'
                            ? 'outline'
                            : 'secondary'
                      }
                      style={
                        rule.severity === 'Warning'
                          ? { borderColor: SEVERITY_COLORS.Warning, color: SEVERITY_COLORS.Warning }
                          : undefined
                      }
                    >
                      {t(`speechAnalytics.severity.${rule.severity.toLowerCase()}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 tabular-nums text-right">{rule.occurrences}</td>
                  <td className="px-4 py-2 tabular-nums text-right">{rule.sessionsAffected}</td>
                  <td className="px-4 py-2 tabular-nums">{formatDateShort(rule.firstSeen)}</td>
                  <td className="px-4 py-2 tabular-nums">{formatDateShort(rule.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SpeechAnalyticsPage() {
  const { t } = useTranslation('analytics');
  const qc = useQueryClient();
  const connectionState = useRealtimeStore((s) => s.connectionState);

  // Option B: page-level invalidation on conversation ended
  useEffect(() => {
    if (connectionState !== 'connected') return;

    const unsubscribe = onHubEvent<ConversationStateChangedPayload>(
      'OnConversationStateChanged',
      (evt) => {
        if (evt.newState === 'ended') {
          void qc.invalidateQueries({ queryKey: ['call-analytics'] });
        }
      },
    );

    return () => unsubscribe();
  }, [connectionState, qc]);

  return (
    <div className="flex flex-col h-full" data-testid="speech-analytics-page">
      <FilterBar />

      <div className="flex-1 overflow-auto p-6 space-y-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('speechAnalytics.title')}
        </h1>

        <Tabs defaultValue="topics">
          <TabsList>
            <TabsTrigger value="topics">{t('speechAnalytics.tabs.topics')}</TabsTrigger>
            <TabsTrigger value="sentiment">{t('speechAnalytics.tabs.sentiment')}</TabsTrigger>
            <TabsTrigger value="compliance">{t('speechAnalytics.tabs.compliance')}</TabsTrigger>
          </TabsList>

          <TabsContent value="topics" className="mt-4">
            <TopicTrendsTab />
          </TabsContent>

          <TabsContent value="sentiment" className="mt-4">
            <SentimentTrendsTab />
          </TabsContent>

          <TabsContent value="compliance" className="mt-4">
            <ComplianceOverviewTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
