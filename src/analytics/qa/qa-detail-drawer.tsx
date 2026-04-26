import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/core/ui/sheet';
import { Badge } from '@/core/ui/badge';
import { Separator } from '@/core/ui/separator';
import { ScoreGauge } from './score-gauge';
import { useQaDetail } from '@/core/api/hooks/use-analytics';
import type { TurnSentimentInfo, ComplianceViolationInfo } from '@/core/api/hooks/use-analytics';

interface QaDetailDrawerProps {
  readonly sessionId: string | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

// ─── Severity → Tailwind classes (red critical, amber warning, gray info) ────
function severityClasses(severity: string): string {
  const s = severity.toLowerCase();
  if (s === 'critical' || s === 'high') {
    return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300';
  }
  if (s === 'warning' || s === 'medium') {
    return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300';
  }
  return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300';
}

// ─── Sentiment label color (green positive, red negative, gray neutral) ─────
function sentimentColor(score: number): string {
  if (score > 0.15) return '#16a34a'; // green-600
  if (score < -0.15) return '#dc2626'; // red-600
  return '#64748b'; // slate-500
}

// ─── Minimal markdown renderer (safe, AOT-friendly, no extra dep) ──────────
// Supports: paragraphs, **bold**, *italic*, `code`, # heading. DOMPurify-sanitized.
const HEADING_RE = /^(#{1,3})\s+(.*)$/;
const CODE_RE = /`([^`]+)`/g;
const BOLD_RE = /\*\*([^*]+)\*\*/g;
const ITALIC_RE = /\*([^*]+)\*/g;

function escapeHtml(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function inline(s: string): string {
  return s
    .replaceAll(CODE_RE, '<code>$1</code>')
    .replaceAll(BOLD_RE, '<strong>$1</strong>')
    .replaceAll(ITALIC_RE, '<em>$1</em>');
}

function renderMarkdown(src: string): string {
  const lines = src.split(/\r?\n/);
  const out: string[] = [];
  let inPara = false;
  const flushPara = () => {
    if (inPara) {
      out.push('</p>');
      inPara = false;
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') {
      flushPara();
      continue;
    }
    const heading = HEADING_RE.exec(line);
    const hashes = heading?.[1];
    const headingText = heading?.[2];
    if (heading && hashes && headingText !== undefined) {
      flushPara();
      const level = hashes.length;
      out.push(`<h${level}>${inline(escapeHtml(headingText))}</h${level}>`);
      continue;
    }
    if (inPara) {
      out.push(' ');
    } else {
      out.push('<p>');
      inPara = true;
    }
    out.push(inline(escapeHtml(line)));
  }
  flushPara();
  return DOMPurify.sanitize(out.join(''), {
    ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'strong', 'em', 'code', 'br'],
    ALLOWED_ATTR: [],
  });
}

// ─── Sentiment timeline data point shape ─────────────────────────────────────
interface SentimentPoint {
  turn: number;
  score: number;
  label: string;
  speaker: string;
}

function sentimentAverage(points: readonly SentimentPoint[]): number {
  if (points.length === 0) return 0;
  let sum = 0;
  for (const p of points) sum += p.score;
  return sum / points.length;
}

export function QaDetailDrawer({ sessionId, open, onOpenChange }: QaDetailDrawerProps) {
  const { t } = useTranslation('analytics');

  const { data: detail, isLoading } = useQaDetail(sessionId ?? '');

  const sentimentData: SentimentPoint[] = useMemo(() => {
    if (!detail?.sentimentTimeline) return [];
    return detail.sentimentTimeline.map((ts: TurnSentimentInfo) => ({
      turn: ts.turnIndex,
      score: ts.score,
      label: ts.label,
      speaker: ts.speaker,
    }));
  }, [detail]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t('qa.scorecard')}</SheetTitle>
          {detail && (
            <SheetDescription>
              {detail.agentName ?? '—'} &mdash;{' '}
              {detail.analyzedAt ? new Date(detail.analyzedAt).toLocaleDateString() : '—'}
            </SheetDescription>
          )}
        </SheetHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            {t('loading', { ns: 'common' })}
          </div>
        )}

        {!isLoading && detail && (
          <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
            {/* Score gauge */}
            <div className="flex justify-center">
              <ScoreGauge score={detail.qaScore} />
            </div>

            <Separator />

            {/* Scorecard breakdown */}
            <div>
              <h3 className="mb-2 text-sm font-medium">{t('qa.scorecard')}</h3>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        {t('qa.criterion', 'Criterion')}
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                        {t('qa.score')}
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                        {t('qa.status', 'Status')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {detail.criteria.map((c) => (
                      <tr key={c.category}>
                        <td className="px-3 py-2">
                          <div>{c.category}</div>
                          {c.feedback && (
                            <div className="text-xs text-muted-foreground">{c.feedback}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          <span
                            className={
                              c.score >= 80
                                ? 'text-green-600'
                                : c.score >= 60
                                  ? 'text-amber-500'
                                  : 'text-red-500'
                            }
                          >
                            {c.score}%
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Badge variant={c.passed ? 'default' : 'destructive'} className="text-xs">
                            {c.passed ? t('qa.pass', 'Pass') : t('qa.fail', 'Fail')}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Separator />

            {/* Summary (markdown) */}
            {detail.narrative && (
              <>
                <section data-testid="qa-summary">
                  <h3
                    className="mb-1 text-sm font-medium"
                    title={t('qa.summary_tooltip', 'AI-generated narrative summary')}
                  >
                    {t('qa.summary')}
                  </h3>
                  <div
                    className="prose prose-sm max-w-none text-sm text-muted-foreground dark:prose-invert
                               [&_p]:mb-2 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold
                               [&_strong]:text-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1
                               [&_code]:py-0.5 [&_code]:text-xs"
                    data-testid="qa-summary-markdown"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(detail.narrative) }}
                  />
                </section>
                <Separator />
              </>
            )}

            {/* Compliance violations */}
            <section data-testid="qa-violations">
              <h3
                className="mb-2 text-sm font-medium"
                title={t('qa.violations_tooltip', 'Detected compliance rule violations')}
              >
                {t('qa.compliance')}
              </h3>
              {detail.violations.length === 0 ? (
                <Badge variant="default">{t('qa.no_violations')}</Badge>
              ) : (
                <ul className="space-y-2">
                  {detail.violations.map((v: ComplianceViolationInfo, i: number) => (
                    <li
                      key={`${v.ruleName}-${i}`}
                      className="flex items-start gap-2 text-sm"
                      data-testid="qa-violation-item"
                    >
                      <span
                        className={`mt-0.5 inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-medium ${severityClasses(v.severity)}`}
                        data-testid="qa-violation-severity"
                        data-severity={v.severity.toLowerCase()}
                      >
                        {v.severity}
                      </span>
                      <div>
                        <div className="font-medium">{v.ruleName}</div>
                        <div className="text-muted-foreground">{v.description}</div>
                        {v.evidence && (
                          <div className="text-xs text-muted-foreground italic">{v.evidence}</div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Separator />

            {/* Sentiment per-turn timeline */}
            <section data-testid="qa-sentiment-chart">
              <h3
                className="mb-1 text-sm font-medium"
                title={t('qa.sentiment_timeline_tooltip', 'Sentiment evolution per conversation turn')}
              >
                {t('qa.sentiment')}
              </h3>
              {detail.sentimentLabel && (
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <span
                    className={
                      detail.sentimentLabel === 'Positive'
                        ? 'text-green-600'
                        : detail.sentimentLabel === 'Negative'
                          ? 'text-red-500'
                          : 'text-slate-500'
                    }
                  >
                    {detail.sentimentLabel}
                  </span>
                  {detail.sentimentTrend && (
                    <span className="text-xs text-muted-foreground">({detail.sentimentTrend})</span>
                  )}
                </div>
              )}
              {sentimentData.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t('qa.no_sentiment_timeline', 'No per-turn sentiment data available')}
                </p>
              ) : (
                <div
                  className="h-40 w-full"
                  data-testid="qa-sentiment-chart-container"
                  data-points={sentimentData.length}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sentimentData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <defs>
                        <linearGradient id="qaSentimentGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#16a34a" stopOpacity={0.6} />
                          <stop offset="50%" stopColor="#64748b" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#dc2626" stopOpacity={0.6} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                      <XAxis dataKey="turn" tick={{ fontSize: 10 }} />
                      <YAxis domain={[-1, 1]} tick={{ fontSize: 10 }} width={28} />
                      <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="2 2" />
                      <Tooltip
                        formatter={(value, _name, item) => {
                          const v = typeof value === 'number' ? value : Number(value ?? 0);
                          const payload = (item as { payload?: SentimentPoint } | undefined)?.payload;
                          return [
                            `${v.toFixed(2)} (${payload?.label ?? ''})`,
                            payload?.speaker ?? '',
                          ];
                        }}
                        labelFormatter={(turn) => `Turn ${turn}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke={sentimentColor(sentimentAverage(sentimentData))}
                        strokeWidth={2}
                        fill="url(#qaSentimentGradient)"
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <Separator />

            {/* Topics chips */}
            <section data-testid="qa-topics">
              <h3
                className="mb-2 text-sm font-medium"
                title={t('qa.topics_tooltip', 'Topics classified from the conversation')}
              >
                {t('qa.topics')}
              </h3>
              {detail.allTopics.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('qa.no_topics', 'No topics detected')}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {detail.allTopics.map((topic) => (
                    <Badge
                      key={topic.name}
                      variant={topic.name === detail.primaryTopic ? 'default' : 'secondary'}
                      data-testid="qa-topic-chip"
                      data-primary={topic.name === detail.primaryTopic ? 'true' : 'false'}
                    >
                      {topic.name}
                      {topic.confidence < 1 && (
                        <span className="ml-1 opacity-60 text-xs">
                          {Math.round(topic.confidence * 100)}%
                        </span>
                      )}
                    </Badge>
                  ))}
                </div>
              )}
            </section>

            <Separator />

            {/* Conversation metrics */}
            {(detail.agentTalkRatio != null ||
              detail.silenceCount != null ||
              detail.interruptionCount != null) && (
              <div>
                <h3 className="mb-2 text-sm font-medium">
                  {t('qa.conversation_metrics', 'Conversation Metrics')}
                </h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {detail.agentTalkRatio != null && (
                    <>
                      <dt className="text-muted-foreground">
                        {t('qa.agent_talk_ratio', 'Agent talk ratio')}
                      </dt>
                      <dd className="tabular-nums font-medium text-right">
                        {Math.round(detail.agentTalkRatio * 100)}%
                      </dd>
                    </>
                  )}
                  {detail.silenceCount != null && (
                    <>
                      <dt className="text-muted-foreground">
                        {t('qa.silence_events', 'Silence events')}
                      </dt>
                      <dd className="tabular-nums font-medium text-right">{detail.silenceCount}</dd>
                    </>
                  )}
                  {detail.interruptionCount != null && (
                    <>
                      <dt className="text-muted-foreground">
                        {t('qa.interruptions', 'Interruptions')}
                      </dt>
                      <dd className="tabular-nums font-medium text-right">
                        {detail.interruptionCount}
                      </dd>
                    </>
                  )}
                </dl>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
