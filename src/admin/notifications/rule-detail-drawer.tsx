import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow, format } from 'date-fns';
import { Pencil, Pause, Play } from 'lucide-react';
import { Badge } from '@/core/ui/badge';
import {
  DrawerDetail,
  type DrawerDetailTab,
  type DrawerDetailAction,
} from '@/core/ui/drawer-detail';
import {
  usePauseNotificationRule,
  useActivateNotificationRule,
  useRuleFiringHistory,
  type NotificationRule,
  type RuleFiringEntry,
} from '@/core/api/hooks/use-notification-rules';

interface RuleDetailDrawerProps {
  rule: NotificationRule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (rule: NotificationRule) => void;
}

function OverviewTab({ rule }: { rule: NotificationRule }) {
  const { t } = useTranslation('admin');

  return (
    <div className="space-y-4 py-2">
      <dl className="grid grid-cols-[140px_1fr] gap-y-3 text-sm">
        <dt className="font-medium text-muted-foreground">
          {t('notifications.rules.columns.name')}
        </dt>
        <dd>{rule.name}</dd>

        <dt className="font-medium text-muted-foreground">
          {t('notifications.rules.columns.eventType')}
        </dt>
        <dd className="font-mono text-xs">{rule.eventType}</dd>

        <dt className="font-medium text-muted-foreground">
          {t('notifications.rules.columns.channels')}
        </dt>
        <dd className="flex flex-wrap gap-1">
          {rule.channels.map((ch) => (
            <Badge key={ch} variant="secondary" className="text-xs">
              {t(`notifications.rules.channels.${ch}`)}
            </Badge>
          ))}
        </dd>

        <dt className="font-medium text-muted-foreground">
          {t('notifications.rules.columns.severity')}
        </dt>
        <dd>{t(`notifications.rules.severity.${rule.severity}`)}</dd>

        <dt className="font-medium text-muted-foreground">
          {t('notifications.rules.columns.state')}
        </dt>
        <dd>
          {rule.state === 'Active'
            ? t('notifications.rules.state.active')
            : t('notifications.rules.state.paused')}
        </dd>

        <dt className="font-medium text-muted-foreground">
          {t('notifications.rules.columns.lastFired')}
        </dt>
        <dd>
          {rule.lastFiredAt
            ? formatDistanceToNow(new Date(rule.lastFiredAt), { addSuffix: true })
            : '—'}
        </dd>

        <dt className="font-medium text-muted-foreground">
          {t('notifications.rules.form.sections.conditions')}
        </dt>
        <dd>
          {rule.conditions.length === 0
            ? t('notifications.rules.form.conditions.empty')
            : rule.conditions.map((c, i) => (
                <span key={i} className="mr-2 inline-block rounded bg-muted px-1.5 py-0.5 text-xs">
                  {c.field} {c.operator} {c.value}
                </span>
              ))}
        </dd>

        <dt className="font-medium text-muted-foreground">
          {t('notifications.rules.form.sections.schedule')}
        </dt>
        <dd>
          {t(
            `notifications.rules.form.schedule.${rule.schedule.mode === 'business_hours' ? 'businessHours' : rule.schedule.mode}`,
          )}
        </dd>

        <dt className="font-medium text-muted-foreground">
          {t('notifications.rules.form.sections.throttling')}
        </dt>
        <dd>
          {rule.throttling.maxPerPeriod}/
          {t(`notifications.rules.form.throttling.${rule.throttling.periodUnit}`)},{' '}
          {rule.throttling.cooldownMinutes}m cooldown
        </dd>
      </dl>
    </div>
  );
}

function HistoryTab({ ruleId }: { ruleId: string }) {
  const { t } = useTranslation('admin');
  const [page] = useState(1);
  const { data } = useRuleFiringHistory(ruleId, page, 20);
  const items: RuleFiringEntry[] = data?.items ?? [];

  if (items.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        {t('notifications.rules.history.noFirings')}
      </p>
    );
  }

  return (
    <div className="space-y-2 py-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 pr-2">{t('notifications.rules.history.columns.firedAt')}</th>
            <th className="pb-2 pr-2">{t('notifications.rules.history.columns.event')}</th>
            <th className="pb-2 pr-2">{t('notifications.rules.history.columns.channels')}</th>
            <th className="pb-2">{t('notifications.rules.history.columns.status')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((entry) => {
            const allSuccess = entry.channelsNotified.every((c) => c.success);
            const allFailed = entry.channelsNotified.every((c) => !c.success);
            const status = allSuccess ? 'success' : allFailed ? 'failed' : 'partial';
            return (
              <tr key={entry.firingId} className="border-b">
                <td className="py-2 pr-2">{format(new Date(entry.firedAt), 'MMM d, HH:mm')}</td>
                <td className="py-2 pr-2 font-mono text-xs">
                  {(entry.eventSnapshot as { eventType?: string })?.eventType ?? '—'}
                </td>
                <td className="py-2 pr-2">
                  <div className="flex gap-1">
                    {entry.channelsNotified.map((ch, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className={
                          ch.success
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }
                      >
                        {ch.channel}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="py-2">
                  <Badge
                    variant="secondary"
                    className={
                      status === 'success'
                        ? 'bg-green-100 text-green-700'
                        : status === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                    }
                  >
                    {t(`notifications.rules.history.status.${status}`)}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function RuleDetailDrawer({ rule, open, onOpenChange, onEdit }: RuleDetailDrawerProps) {
  const { t } = useTranslation('admin');
  const pauseRule = usePauseNotificationRule();
  const activateRule = useActivateNotificationRule();

  if (!rule) return null;

  const tabs: DrawerDetailTab[] = [
    {
      key: 'overview',
      label: t('notifications.rules.detail.tabs.overview'),
      content: <OverviewTab rule={rule} />,
    },
    {
      key: 'history',
      label: t('notifications.rules.detail.tabs.history'),
      content: <HistoryTab ruleId={rule.ruleId} />,
    },
  ];

  const actions: DrawerDetailAction[] = [
    {
      key: 'edit',
      label: t('notifications.rules.detail.actions.edit'),
      icon: <Pencil className="h-4 w-4" />,
      variant: 'default',
      onAction: () => onEdit(rule),
    },
    {
      key: 'toggle-state',
      label:
        rule.state === 'Active'
          ? t('notifications.rules.detail.actions.pause')
          : t('notifications.rules.detail.actions.activate'),
      icon: rule.state === 'Active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />,
      variant: 'outline',
      loading: pauseRule.isPending || activateRule.isPending,
      onAction: () => {
        if (rule.state === 'Active') {
          pauseRule.mutate(rule.ruleId);
        } else {
          activateRule.mutate(rule.ruleId);
        }
      },
    },
  ];

  return (
    <DrawerDetail
      open={open}
      onOpenChange={onOpenChange}
      title={rule.name}
      subtitle={rule.eventType}
      tabs={tabs}
      actions={actions}
      width="lg"
    />
  );
}
