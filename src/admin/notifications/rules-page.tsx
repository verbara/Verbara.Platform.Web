import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { Plus, Pencil, Eye, Trash2, Pause, Play, BellRing } from 'lucide-react';
import { PageHeader } from '@/admin/shared/page-header';
import { DataTable } from '@/admin/shared/data-table';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { RuleEditorSheet } from './rule-editor-sheet';
import { RuleDetailDrawer } from './rule-detail-drawer';
import {
  useNotificationRules,
  useDeleteNotificationRule,
  usePauseNotificationRule,
  useActivateNotificationRule,
  type NotificationRule,
} from '@/core/api/hooks/use-notification-rules';

const col = createColumnHelper<NotificationRule>();

const severityColors: Record<string, string> = {
  Info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function NotificationRulesPage() {
  const { t } = useTranslation(['admin']);
  const { data: rules = [] } = useNotificationRules();
  const deleteRule = useDeleteNotificationRule();
  const pauseRule = usePauseNotificationRule();
  const activateRule = useActivateNotificationRule();

  const [createOpen, setCreateOpen] = useState(false);
  const [editRule, setEditRule] = useState<NotificationRule | null>(null);
  const [detailRule, setDetailRule] = useState<NotificationRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NotificationRule | null>(null);

  const columns = useMemo(
    () => [
      col.accessor('name', {
        header: () => t('admin:notifications.rules.columns.name'),
        cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      }),
      col.accessor('eventType', {
        header: () => t('admin:notifications.rules.columns.eventType'),
        cell: (info) => (
          <span className="text-muted-foreground text-xs font-mono">{info.getValue()}</span>
        ),
      }),
      col.accessor('channels', {
        header: () => t('admin:notifications.rules.columns.channels'),
        cell: (info) => (
          <div className="flex flex-wrap gap-1">
            {info.getValue().map((ch) => (
              <Badge key={ch} variant="secondary" className="text-xs">
                {t(`admin:notifications.rules.channels.${ch}`)}
              </Badge>
            ))}
          </div>
        ),
      }),
      col.accessor('severity', {
        header: () => t('admin:notifications.rules.columns.severity'),
        cell: (info) => (
          <Badge className={severityColors[info.getValue()] ?? ''}>
            {t(`admin:notifications.rules.severity.${info.getValue()}`)}
          </Badge>
        ),
      }),
      col.accessor('state', {
        header: () => t('admin:notifications.rules.columns.state'),
        cell: (info) =>
          info.getValue() === 'Active' ? (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {t('admin:notifications.rules.state.active')}
            </Badge>
          ) : (
            <Badge variant="secondary">{t('admin:notifications.rules.state.paused')}</Badge>
          ),
      }),
      col.accessor('lastFiredAt', {
        header: () => t('admin:notifications.rules.columns.lastFired'),
        cell: (info) => {
          const val = info.getValue();
          if (!val) return <span className="text-muted-foreground">—</span>;
          return (
            <span className="text-muted-foreground text-sm">
              {formatDistanceToNow(new Date(val), { addSuffix: true })}
            </span>
          );
        },
      }),
      col.display({
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => {
                e.stopPropagation();
                setEditRule(row.original);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => {
                e.stopPropagation();
                setDetailRule(row.original);
              }}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => {
                e.stopPropagation();
                if (row.original.state === 'Active') {
                  pauseRule.mutate(row.original.ruleId);
                } else {
                  activateRule.mutate(row.original.ruleId);
                }
              }}
            >
              {row.original.state === 'Active' ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(row.original);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      }),
    ],
    [t, pauseRule, activateRule],
  );

  return (
    <div className="space-y-6" data-testid="notification-rules-page">
      <PageHeader
        title={t('admin:notifications.rules.title')}
        description={t('admin:notifications.rules.description')}
      >
        <Button onClick={() => setCreateOpen(true)} data-testid="rules-create-btn">
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:notifications.rules.create')}
        </Button>
      </PageHeader>

      {rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <BellRing className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">
            {t('admin:notifications.rules.emptyState')}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => setCreateOpen(true)}>
            {t('admin:notifications.rules.emptyStateCta')}
          </Button>
        </div>
      ) : (
        <DataTable
          data={rules}
          columns={columns}
          searchPlaceholder={t('admin:notifications.rules.searchPlaceholder')}
        />
      )}

      <RuleEditorSheet open={createOpen} onOpenChange={setCreateOpen} />

      <RuleEditorSheet
        open={!!editRule}
        onOpenChange={(open) => {
          if (!open) setEditRule(null);
        }}
        rule={editRule}
      />

      <RuleDetailDrawer
        rule={detailRule}
        open={!!detailRule}
        onOpenChange={(open) => {
          if (!open) setDetailRule(null);
        }}
        onEdit={(rule) => {
          setDetailRule(null);
          setEditRule(rule);
        }}
      />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (deleteTarget) deleteRule.mutate(deleteTarget.ruleId);
          setDeleteTarget(null);
        }}
        entityName={deleteTarget?.name ?? ''}
        entityType={t('admin:notifications.rules.entity_type')}
        isPending={deleteRule.isPending}
      />
    </div>
  );
}
