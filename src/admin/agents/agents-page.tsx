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
import { Plus, Search, Headset } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Badge } from '@/core/ui/badge';
import { AgentForm } from './agent-form';

export interface AgentSkill {
  name: string;
  proficiency: number;
}

export interface Agent {
  id: string;
  userId: string;
  userEmail: string;
  displayName: string;
  teamId: string | null;
  teamName: string | null;
  state: 'available' | 'busy' | 'away' | 'offline';
  skills: AgentSkill[];
  queueCount: number;
  createdAt: string;
}

export const MOCK_AGENTS: Agent[] = [
  { id: 'a1', userId: '3', userEmail: 'john.smith@example.com', displayName: 'John Smith', teamId: 't1', teamName: 'Support', state: 'available', skills: [{ name: 'billing', proficiency: 8 }, { name: 'technical', proficiency: 6 }], queueCount: 2, createdAt: '2026-02-10T09:15:00Z' },
  { id: 'a2', userId: '4', userEmail: 'maria.garcia@example.com', displayName: 'Maria Garcia', teamId: 't1', teamName: 'Support', state: 'busy', skills: [{ name: 'billing', proficiency: 9 }], queueCount: 1, createdAt: '2026-02-20T16:45:00Z' },
  { id: 'a3', userId: '2', userEmail: 'jane.doe@example.com', displayName: 'Jane Doe', teamId: 't2', teamName: 'Sales', state: 'away', skills: [{ name: 'sales', proficiency: 10 }, { name: 'retention', proficiency: 7 }], queueCount: 3, createdAt: '2026-02-01T14:30:00Z' },
  { id: 'a4', userId: '6', userEmail: 'carlos.ruiz@example.com', displayName: 'Carlos Ruiz', teamId: null, teamName: null, state: 'offline', skills: [], queueCount: 0, createdAt: '2026-03-05T08:00:00Z' },
];

const columnHelper = createColumnHelper<Agent>();

const stateBadgeVariant: Record<Agent['state'], 'default' | 'secondary' | 'outline' | 'destructive'> = {
  available: 'default',
  busy: 'destructive',
  away: 'secondary',
  offline: 'outline',
};

export default function AgentsPage() {
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

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => MOCK_AGENTS,
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor('displayName', {
        header: () => t('admin:agents.displayName'),
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('userEmail', {
        header: () => t('admin:agents.user'),
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('teamName', {
        header: () => t('admin:agents.team'),
        cell: (info) => info.getValue() ?? <span className="text-muted-foreground">&mdash;</span>,
      }),
      columnHelper.accessor('state', {
        header: () => t('admin:agents.state'),
        cell: (info) => (
          <Badge variant={stateBadgeVariant[info.getValue()]}>
            {info.getValue()}
          </Badge>
        ),
      }),
      columnHelper.accessor('queueCount', {
        header: () => t('admin:agents.queueCount'),
        cell: (info) => info.getValue(),
      }),
    ],
    [t],
  );

  const table = useReactTable({
    data: agents,
    columns,
    state: { globalFilter: debouncedSearch },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const isEmpty = agents.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold">{t('admin:agents.title')}</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:agents.create')}
        </Button>
      </div>

      {isEmpty ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 py-16 dark:border-slate-600">
          <Headset className="mb-3 h-10 w-10 text-slate-400" />
          <p className="text-sm text-slate-500">No agents yet &mdash; Create your first agent</p>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('admin:agents.searchPlaceholder')}
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
                    onClick={() => navigate(`/admin/agents/${row.original.id}`)}
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
                      No matching agents found.
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

      {/* Create agent sheet */}
      <AgentForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
      />
    </div>
  );
}
