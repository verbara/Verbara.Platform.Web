import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, Bot, Trash2 } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { PageSkeleton } from '@/core/ui/page-skeleton';
import { PageHeader } from '@/core/ui/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/core/ui/data-table';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { PermissionButton } from '@/core/ui/permission-button';
import { BotForm } from './bot-form';
import { useBots, useDeleteBot, type Bot as BotType } from '@/core/api/hooks/use-bots';
import { useFlows } from '@/core/api/hooks/use-flows';
import { useQueues } from '@/core/api/hooks/use-queues';

const columnHelper = createColumnHelper<BotType>();

export default function BotListPage() {
  const { t } = useTranslation(['admin']);
  const [createOpen, setCreateOpen] = useState(false);
  const [editBot, setEditBot] = useState<BotType | null>(null);
  const [deletingBot, setDeletingBot] = useState<BotType | null>(null);
  const deleteBot = useDeleteBot();

  const { data: bots = [], isLoading } = useBots();
  const { data: flows = [] } = useFlows();
  const { data: queues = [] } = useQueues();

  const flowMap = useMemo(() => Object.fromEntries(flows.map((f) => [f.flowId, f.name])), [flows]);

  const queueMap = useMemo(() => Object.fromEntries(queues.map((q) => [q.id, q.name])), [queues]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('admin:bots.name'),
        cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
      }),
      columnHelper.display({
        id: 'defaultFlow',
        header: () => t('admin:bots.defaultFlow'),
        cell: (info) => {
          const flowId = info.row.original.defaultFlowId;
          return flowId ? (
            (flowMap[flowId] ?? flowId)
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      }),
      columnHelper.display({
        id: 'fallbackQueue',
        header: () => t('admin:bots.fallbackQueue'),
        cell: (info) => {
          const queueId = info.row.original.fallbackQueueId;
          return queueId ? (
            (queueMap[queueId] ?? queueId)
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      }),
      columnHelper.display({
        id: 'isActive',
        header: () => t('admin:bots.status'),
        cell: (info) => (
          <Badge variant={info.row.original.isActive ? 'default' : 'secondary'}>
            {info.row.original.isActive
              ? t('admin:bots.activeLabel')
              : t('admin:bots.inactiveLabel')}
          </Badge>
        ),
      }),
      columnHelper.accessor('maxTurns', {
        header: () => t('admin:bots.maxTurns'),
      }),
      columnHelper.display({
        id: 'actions',
        header: () => '',
        cell: (info) => (
          <PermissionButton
            requires="system:integration:manage"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            data-testid={`delete-bot-${info.row.original.id}`}
            onClick={(e) => {
              e.stopPropagation();
              setDeletingBot(info.row.original);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </PermissionButton>
        ),
      }),
    ],
    [t, flowMap, queueMap],
  );

  const isEmpty = !isLoading && bots.length === 0;

  let content;
  if (isLoading) {
    content = <PageSkeleton />;
  } else if (isEmpty) {
    content = <EmptyState icon={Bot} message={t('admin:bots.empty')} />;
  } else {
    content = (
      <DataTable
        data={bots}
        columns={columns}
        searchPlaceholder={t('admin:bots.searchPlaceholder')}
        noResultsMessage={t('admin:bots.noResults')}
        onRowClick={(bot) => setEditBot(bot)}
      />
    );
  }

  return (
    <div className="space-y-6" data-testid="bots-page">
      <PageHeader title={t('admin:bots.title')}>
        <Button data-testid="bots-create-btn" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:bots.create')}
        </Button>
      </PageHeader>

      {content}

      <BotForm open={createOpen} onOpenChange={setCreateOpen} mode="create" />

      <BotForm
        open={editBot !== null}
        onOpenChange={(open) => {
          if (!open) setEditBot(null);
        }}
        mode="edit"
        bot={editBot ?? undefined}
      />

      <ConfirmDeleteDialog
        open={deletingBot !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingBot(null);
        }}
        onConfirm={() => {
          if (!deletingBot) return;
          deleteBot.mutate(deletingBot.id, {
            onSuccess: () => setDeletingBot(null),
          });
        }}
        entityName={deletingBot?.name ?? ''}
        entityType={t('admin:bots.entity_type')}
        isPending={deleteBot.isPending}
      />
    </div>
  );
}
