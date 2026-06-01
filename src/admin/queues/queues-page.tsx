import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, ListOrdered } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';
import { QueueForm } from './queue-form';
import { useQueues, useCreateQueue, type Queue } from '@/core/api/hooks/use-queues';

export type { Queue } from '@/core/api/hooks/use-queues';

const columnHelper = createColumnHelper<Queue>();

export default function QueuesPage() {
  const { t } = useTranslation(['admin']);
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: queues = [] } = useQueues();
  const createQueue = useCreateQueue();

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('admin:queues.name'),
        cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
      }),
      columnHelper.display({
        id: 'active',
        header: () => t('admin:queues.active'),
        cell: (info) => (
          <Badge variant={info.row.original.isActive ? 'default' : 'destructive'}>
            {info.row.original.isActive ? 'active' : 'inactive'}
          </Badge>
        ),
      }),
      columnHelper.display({
        id: 'slaAnswer',
        header: () => t('admin:queues.sla_answer'),
        cell: (info) => {
          const sla = info.row.original.slaTargets?.answerWithinSeconds;
          return sla ? `${sla}s` : <span className="text-muted-foreground">&mdash;</span>;
        },
      }),
      columnHelper.display({
        id: 'overflow',
        header: () => t('admin:queues.overflow'),
        cell: (info) => {
          const rule = info.row.original.overflowRule;
          if (!rule) return <span className="text-muted-foreground">&mdash;</span>;
          const target = queues.find((q) => q.id === rule.overflowQueueId);
          return target?.name ?? rule.overflowQueueId;
        },
      }),
    ],
    [t, queues],
  );

  const handleCreate = (values: Parameters<typeof createQueue.mutate>[0]) => {
    createQueue.mutate(values);
  };

  const isEmpty = queues.length === 0;

  return (
    <div className="space-y-6" data-testid="queues-page">
      <PageHeader title={t('admin:queues.title')}>
        <Button data-testid="queues-create-btn" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:queues.create')}
        </Button>
      </PageHeader>

      {isEmpty ? (
        <EmptyState icon={ListOrdered} message="No queues yet &mdash; Create your first queue" />
      ) : (
        <DataTable
          data={queues}
          columns={columns}
          searchPlaceholder={t('admin:queues.searchPlaceholder')}
          noResultsMessage="No matching queues found."
          onRowClick={(queue) => navigate(`/admin/queues/${queue.id}`)}
        />
      )}

      {/* Create queue sheet */}
      <QueueForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={(values) =>
          handleCreate({
            name: values.name,
            isActive: values.isActive,
            maxWaiting: values.maxWaiting ? Number(values.maxWaiting) : undefined,
            slaTargets: {
              answerWithinSeconds: values.answerWithinSeconds
                ? Number(values.answerWithinSeconds)
                : undefined,
              firstResponseWithinSeconds: values.firstResponseWithinSeconds
                ? Number(values.firstResponseWithinSeconds)
                : undefined,
              resolutionWithinSeconds: values.resolutionWithinSeconds
                ? Number(values.resolutionWithinSeconds)
                : undefined,
            },
            overflowRule: values.overflowQueueId
              ? {
                  overflowQueueId: values.overflowQueueId,
                  overflowAfterSeconds: Number(values.overflowAfterSeconds) || 120,
                }
              : undefined,
            wrapUp: {
              defaultWrapUpSeconds: Number(values.defaultWrapUpSeconds) || 30,
              forceWrapUp: values.forceWrapUp,
            },
            requiredSkills: values.requiredSkills.map((s) => s.name),
            autoAnswerDefault: values.autoAnswerDefault,
          })
        }
      />
    </div>
  );
}
