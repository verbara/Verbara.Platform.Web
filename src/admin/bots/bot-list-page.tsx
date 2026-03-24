import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, Bot } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';
import { BotForm } from './bot-form';
import { useBots, type Bot as BotType } from '@/core/api/hooks/use-bots';
import { useFlows } from '@/core/api/hooks/use-flows';
import { useQueues } from '@/core/api/hooks/use-queues';

const columnHelper = createColumnHelper<BotType>();

export default function BotListPage() {
  const { t } = useTranslation(['admin']);
  const [createOpen, setCreateOpen] = useState(false);
  const [editBot, setEditBot] = useState<BotType | null>(null);

  const { data: bots = [], isLoading } = useBots();
  const { data: flows = [] } = useFlows();
  const { data: queues = [] } = useQueues();

  const flowMap = useMemo(
    () => Object.fromEntries(flows.map((f) => [f.flowId, f.name])),
    [flows],
  );

  const queueMap = useMemo(
    () => Object.fromEntries(queues.map((q) => [q.id, q.name])),
    [queues],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('admin:bots.name'),
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.display({
        id: 'defaultFlow',
        header: () => t('admin:bots.defaultFlow'),
        cell: (info) => {
          const flowId = info.row.original.defaultFlowId;
          return flowId ? (flowMap[flowId] ?? flowId) : <span className="text-muted-foreground">—</span>;
        },
      }),
      columnHelper.display({
        id: 'fallbackQueue',
        header: () => t('admin:bots.fallbackQueue'),
        cell: (info) => {
          const queueId = info.row.original.fallbackQueueId;
          return queueId ? (queueMap[queueId] ?? queueId) : <span className="text-muted-foreground">—</span>;
        },
      }),
      columnHelper.display({
        id: 'isActive',
        header: () => t('admin:bots.status'),
        cell: (info) => (
          <Badge variant={info.row.original.isActive ? 'default' : 'secondary'}>
            {info.row.original.isActive ? t('admin:bots.activeLabel') : t('admin:bots.inactiveLabel')}
          </Badge>
        ),
      }),
      columnHelper.accessor('maxTurns', {
        header: () => t('admin:bots.maxTurns'),
      }),
    ],
    [t, flowMap, queueMap],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('admin:bots.title')}>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t('admin:bots.create')}
          </Button>
        </PageHeader>
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  const isEmpty = bots.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin:bots.title')}>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:bots.create')}
        </Button>
      </PageHeader>

      {isEmpty ? (
        <EmptyState
          icon={Bot}
          message={t('admin:bots.empty')}
        />
      ) : (
        <DataTable
          data={bots}
          columns={columns}
          searchPlaceholder={t('admin:bots.searchPlaceholder')}
          noResultsMessage={t('admin:bots.noResults')}
          onRowClick={(bot) => setEditBot(bot)}
        />
      )}

      <BotForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
      />

      <BotForm
        open={editBot !== null}
        onOpenChange={(open) => { if (!open) setEditBot(null); }}
        mode="edit"
        bot={editBot ?? undefined}
      />
    </div>
  );
}
