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
import type { QaRow } from './qa-page';

interface QaDetailDrawerProps {
  row: QaRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QaDetailDrawer({ row, open, onOpenChange }: QaDetailDrawerProps) {
  const { t } = useTranslation('analytics');

  if (!row) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t('qa.scorecard')}</SheetTitle>
          <SheetDescription>
            {row.agent} &mdash; {row.date}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
          {/* Score gauge */}
          <div className="flex justify-center">
            <ScoreGauge score={row.score} />
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
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {row.criteria.map((c) => (
                    <tr key={c.name}>
                      <td className="px-3 py-2">{c.name}</td>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Separator />

          {/* Summary */}
          <div>
            <h3 className="mb-1 text-sm font-medium">{t('qa.summary')}</h3>
            <p className="text-sm text-muted-foreground">{row.summaryFull}</p>
          </div>

          <Separator />

          {/* Compliance */}
          <div>
            <h3 className="mb-2 text-sm font-medium">{t('qa.compliance')}</h3>
            {row.violations.length === 0 ? (
              <Badge variant="default">{t('qa.no_violations')}</Badge>
            ) : (
              <ul className="space-y-1">
                {row.violations.map((v, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Badge variant="destructive" className="mt-0.5 shrink-0">
                      {t('qa.violations')}
                    </Badge>
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Separator />

          {/* Sentiment */}
          <div>
            <h3 className="mb-1 text-sm font-medium">{t('qa.sentiment')}</h3>
            <span
              className={
                row.sentiment === 'Positive'
                  ? 'text-green-600'
                  : row.sentiment === 'Negative'
                    ? 'text-red-500'
                    : 'text-slate-500'
              }
            >
              {row.sentiment}
            </span>
          </div>

          <Separator />

          {/* Topics */}
          <div>
            <h3 className="mb-2 text-sm font-medium">{t('qa.topics')}</h3>
            <div className="flex flex-wrap gap-1.5">
              {row.topics.map((topic) => (
                <Badge key={topic} variant="secondary">
                  {topic}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
