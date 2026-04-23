import { useTranslation } from 'react-i18next';
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

interface QaDetailDrawerProps {
  sessionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QaDetailDrawer({ sessionId, open, onOpenChange }: QaDetailDrawerProps) {
  const { t } = useTranslation('analytics');

  const { data: detail, isLoading } = useQaDetail(sessionId ?? '');

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
                        Criterion
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                        {t('qa.score')}
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                        Status
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
                            {c.passed ? 'Pass' : 'Fail'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Separator />

            {/* Summary */}
            {detail.narrative && (
              <>
                <div>
                  <h3 className="mb-1 text-sm font-medium">{t('qa.summary')}</h3>
                  <p className="text-sm text-muted-foreground">{detail.narrative}</p>
                </div>
                <Separator />
              </>
            )}

            {/* Compliance */}
            <div>
              <h3 className="mb-2 text-sm font-medium">{t('qa.compliance')}</h3>
              {detail.violations.length === 0 ? (
                <Badge variant="default">{t('qa.no_violations')}</Badge>
              ) : (
                <ul className="space-y-1">
                  {detail.violations.map((v, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Badge variant="destructive" className="mt-0.5 shrink-0">
                        {v.severity}
                      </Badge>
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
            </div>

            <Separator />

            {/* Sentiment */}
            {detail.sentimentLabel && (
              <>
                <div>
                  <h3 className="mb-1 text-sm font-medium">{t('qa.sentiment')}</h3>
                  <div className="flex items-center gap-2">
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
                </div>
                <Separator />
              </>
            )}

            {/* Topics */}
            {detail.allTopics.length > 0 && (
              <>
                <div>
                  <h3 className="mb-2 text-sm font-medium">{t('qa.topics')}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.allTopics.map((topic) => (
                      <Badge
                        key={topic.name}
                        variant={topic.name === detail.primaryTopic ? 'default' : 'secondary'}
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
                </div>
                <Separator />
              </>
            )}

            {/* Conversation metrics */}
            {(detail.agentTalkRatio != null ||
              detail.silenceCount != null ||
              detail.interruptionCount != null) && (
              <div>
                <h3 className="mb-2 text-sm font-medium">Conversation Metrics</h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {detail.agentTalkRatio != null && (
                    <>
                      <dt className="text-muted-foreground">Agent talk ratio</dt>
                      <dd className="tabular-nums font-medium text-right">
                        {Math.round(detail.agentTalkRatio * 100)}%
                      </dd>
                    </>
                  )}
                  {detail.silenceCount != null && (
                    <>
                      <dt className="text-muted-foreground">Silence events</dt>
                      <dd className="tabular-nums font-medium text-right">{detail.silenceCount}</dd>
                    </>
                  )}
                  {detail.interruptionCount != null && (
                    <>
                      <dt className="text-muted-foreground">Interruptions</dt>
                      <dd className="tabular-nums font-medium text-right">{detail.interruptionCount}</dd>
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
