import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  createColumnHelper,
  flexRender,
} from '@tanstack/react-table';
import { Plus, Search, ListOrdered } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Badge } from '@/core/ui/badge';
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
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

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

  const table = useReactTable({
    data: queues,
    columns,
    state: { globalFilter: debouncedSearch },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const isEmpty = queues.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold">{t('admin:queues.title')}</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:queues.create')}
        </Button>
      </div>

      {isEmpty ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 py-16 dark:border-slate-600">
          <ListOrdered className="mb-3 h-10 w-10 text-slate-400" />
          <p className="text-sm text-slate-500">No queues yet &mdash; Create your first queue</p>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('admin:queues.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-4 py-3 text-left font-medium text-muted-foreground"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y">
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer transition-colors hover:bg-muted/50"
                    onClick={() => navigate(`/admin/queues/${row.original.id}`)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
                {table.getRowModel().rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No matching queues found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {table.getState().pagination.pageIndex + 1} of{' '}
              {table.getPageCount()}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
            </div>
          </div>
        </>
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
