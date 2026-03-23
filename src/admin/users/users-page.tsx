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
import { Plus, Search, Users } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Badge } from '@/core/ui/badge';
import { UserForm } from './user-form';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'supervisor' | 'agent' | 'readonly';
  status: 'active' | 'inactive';
  createdAt: string;
}

const MOCK_USERS: User[] = [
  { id: '1', email: 'admin@example.com', displayName: 'System Admin', role: 'admin', status: 'active', createdAt: '2026-01-15T10:00:00Z' },
  { id: '2', email: 'jane.doe@example.com', displayName: 'Jane Doe', role: 'supervisor', status: 'active', createdAt: '2026-02-01T14:30:00Z' },
  { id: '3', email: 'john.smith@example.com', displayName: 'John Smith', role: 'agent', status: 'active', createdAt: '2026-02-10T09:15:00Z' },
  { id: '4', email: 'maria.garcia@example.com', displayName: 'Maria Garcia', role: 'agent', status: 'inactive', createdAt: '2026-02-20T16:45:00Z' },
  { id: '5', email: 'viewer@example.com', displayName: 'Read Only User', role: 'readonly', status: 'active', createdAt: '2026-03-01T11:00:00Z' },
];

const columnHelper = createColumnHelper<User>();

const roleBadgeVariant: Record<User['role'], 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  supervisor: 'secondary',
  agent: 'outline',
  readonly: 'outline',
};

export default function UsersPage() {
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

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => MOCK_USERS,
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor('email', {
        header: () => t('admin:users.email'),
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('displayName', {
        header: () => t('admin:users.name'),
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('role', {
        header: () => t('admin:users.role'),
        cell: (info) => (
          <Badge variant={roleBadgeVariant[info.getValue()]}>
            {info.getValue()}
          </Badge>
        ),
      }),
      columnHelper.accessor('status', {
        header: () => t('admin:users.status'),
        cell: (info) => (
          <Badge variant={info.getValue() === 'active' ? 'default' : 'destructive'}>
            {info.getValue()}
          </Badge>
        ),
      }),
    ],
    [t],
  );

  const table = useReactTable({
    data: users,
    columns,
    state: { globalFilter: debouncedSearch },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const isEmpty = users.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold">{t('admin:users.title')}</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:users.create')}
        </Button>
      </div>

      {isEmpty ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 py-16 dark:border-slate-600">
          <Users className="mb-3 h-10 w-10 text-slate-400" />
          <p className="text-sm text-slate-500">No users yet &mdash; Create your first user</p>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search users..."
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
                    onClick={() => navigate(`/admin/users/${row.original.id}`)}
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
                      No matching users found.
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

      {/* Create user sheet */}
      <UserForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
      />
    </div>
  );
}
