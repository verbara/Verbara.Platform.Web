import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, ListOrdered } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';
import { QueueForm } from './queue-form';

export interface QueueSlaTargets {
  answerWithinSeconds?: number;
  firstResponseWithinSeconds?: number;
  resolutionWithinSeconds?: number;
}

export interface QueueOverflowRule {
  overflowQueueId: string;
  overflowAfterSeconds: number;
}

export interface QueueWrapUp {
  defaultWrapUpSeconds: number;
  forceWrapUp: boolean;
}

export interface QueueScheduleDay {
  day: string;
  open: string;
  close: string;
  enabled: boolean;
}

export interface Queue {
  id: string;
  name: string;
  isActive: boolean;
  maxWaiting?: number;
  timezone?: string;
  slaTargets?: QueueSlaTargets;
  overflowRule?: QueueOverflowRule;
  wrapUp?: QueueWrapUp;
  requiredSkills: string[];
  schedule: QueueScheduleDay[];
  dispositionCodes: string[];
  agentIds: string[];
  createdAt: string;
}

export const MOCK_QUEUES: Queue[] = [
  {
    id: 'q1',
    name: 'Support',
    isActive: true,
    maxWaiting: 20,
    timezone: 'America/Bogota',
    slaTargets: { answerWithinSeconds: 30, firstResponseWithinSeconds: 60, resolutionWithinSeconds: 3600 },
    overflowRule: { overflowQueueId: 'q2', overflowAfterSeconds: 120 },
    wrapUp: { defaultWrapUpSeconds: 30, forceWrapUp: false },
    requiredSkills: ['billing', 'technical'],
    schedule: [
      { day: 'Monday', open: '08:00', close: '18:00', enabled: true },
      { day: 'Tuesday', open: '08:00', close: '18:00', enabled: true },
      { day: 'Wednesday', open: '08:00', close: '18:00', enabled: true },
      { day: 'Thursday', open: '08:00', close: '18:00', enabled: true },
      { day: 'Friday', open: '08:00', close: '17:00', enabled: true },
      { day: 'Saturday', open: '09:00', close: '13:00', enabled: false },
      { day: 'Sunday', open: '00:00', close: '00:00', enabled: false },
    ],
    dispositionCodes: ['resolved', 'escalated', 'follow-up'],
    agentIds: ['a1', 'a2'],
    createdAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'q2',
    name: 'Sales',
    isActive: true,
    maxWaiting: 10,
    timezone: 'America/Mexico_City',
    slaTargets: { answerWithinSeconds: 20 },
    wrapUp: { defaultWrapUpSeconds: 15, forceWrapUp: true },
    requiredSkills: ['sales'],
    schedule: [
      { day: 'Monday', open: '09:00', close: '19:00', enabled: true },
      { day: 'Tuesday', open: '09:00', close: '19:00', enabled: true },
      { day: 'Wednesday', open: '09:00', close: '19:00', enabled: true },
      { day: 'Thursday', open: '09:00', close: '19:00', enabled: true },
      { day: 'Friday', open: '09:00', close: '18:00', enabled: true },
      { day: 'Saturday', open: '00:00', close: '00:00', enabled: false },
      { day: 'Sunday', open: '00:00', close: '00:00', enabled: false },
    ],
    dispositionCodes: ['won', 'lost', 'no-answer'],
    agentIds: ['a3'],
    createdAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'q3',
    name: 'Retention',
    isActive: false,
    maxWaiting: 5,
    timezone: 'America/Sao_Paulo',
    requiredSkills: ['retention'],
    schedule: [],
    dispositionCodes: [],
    agentIds: ['a3'],
    createdAt: '2026-02-20T14:00:00Z',
  },
];

const columnHelper = createColumnHelper<Queue>();

export default function QueuesPage() {
  const { t } = useTranslation(['admin']);
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: queues = [] } = useQuery({
    queryKey: ['queues'],
    queryFn: async () => MOCK_QUEUES,
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('admin:queues.name'),
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
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
        id: 'agents',
        header: () => t('admin:queues.agents'),
        cell: (info) => info.row.original.agentIds.length,
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
          const target = MOCK_QUEUES.find((q) => q.id === rule.overflowQueueId);
          return target?.name ?? rule.overflowQueueId;
        },
      }),
    ],
    [t],
  );

  const isEmpty = queues.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin:queues.title')}>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:queues.create')}
        </Button>
      </PageHeader>

      {isEmpty ? (
        <EmptyState
          icon={ListOrdered}
          message="No queues yet &mdash; Create your first queue"
        />
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
      />
    </div>
  );
}
