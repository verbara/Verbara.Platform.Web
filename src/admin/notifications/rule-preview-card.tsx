import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Eye } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { useDryRunNotificationRule } from '@/core/api/hooks/use-notification-rules';

interface RulePreviewCardProps {
  ruleId: string;
}

export function RulePreviewCard({ ruleId }: RulePreviewCardProps) {
  const { t } = useTranslation('admin');
  const dryRun = useDryRunNotificationRule();

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium">{t('notifications.rules.preview.title')}</h4>
          <p className="text-xs text-muted-foreground">
            {t('notifications.rules.preview.description')}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={dryRun.isPending}
          onClick={() => dryRun.mutate(ruleId)}
        >
          <Eye className="mr-1.5 h-3.5 w-3.5" />
          {dryRun.isPending
            ? t('notifications.rules.preview.running')
            : t('notifications.rules.preview.runPreview')}
        </Button>
      </div>

      {dryRun.data && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-md border bg-background p-3 text-center">
              <p className="text-2xl font-bold">{dryRun.data.estimatedFireCount}</p>
              <p className="text-xs text-muted-foreground">
                {t('notifications.rules.preview.estimatedFires')}
              </p>
            </div>
            <div className="rounded-md border bg-background p-3 text-center">
              <p className="text-2xl font-bold">{dryRun.data.matchingEvents.length}</p>
              <p className="text-xs text-muted-foreground">
                {t('notifications.rules.preview.matchingEvents')}
              </p>
            </div>
            <div className="rounded-md border bg-background p-3 text-center">
              <p className="text-2xl font-bold">{dryRun.data.estimatedRecipients.length}</p>
              <p className="text-xs text-muted-foreground">
                {t('notifications.rules.preview.estimatedRecipients')}
              </p>
            </div>
          </div>

          {dryRun.data.matchingEvents.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded border">
              <table className="w-full text-xs">
                <tbody>
                  {dryRun.data.matchingEvents.slice(0, 10).map((ev) => (
                    <tr key={ev.eventId} className="border-b last:border-b-0">
                      <td className="px-2 py-1 text-muted-foreground">
                        {format(new Date(ev.occurredAt), 'MMM d, HH:mm')}
                      </td>
                      <td className="px-2 py-1">
                        <Badge variant="secondary" className="text-xs">
                          {ev.eventType}
                        </Badge>
                      </td>
                      <td className="px-2 py-1">{ev.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {dryRun.data.matchingEvents.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              {t('notifications.rules.preview.noMatches')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
