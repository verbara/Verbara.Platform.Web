import { useState, useMemo, useEffect, useRef } from 'react';
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
import { Plus, Search, Users, Pencil, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Avatar, AvatarFallback } from '@/core/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/core/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/core/ui/dialog';

export interface TeamMember {
  id: string;
  displayName: string;
  initials: string;
}

export interface Team {
  id: string;
  name: string;
  members: TeamMember[];
  createdAt: string;
}

export const MOCK_TEAMS: Team[] = [
  {
    id: 't1',
    name: 'Support',
    members: [
      { id: 'a1', displayName: 'John Smith', initials: 'JS' },
      { id: 'a2', displayName: 'Maria Garcia', initials: 'MG' },
    ],
    createdAt: '2026-01-20T10:00:00Z',
  },
  {
    id: 't2',
    name: 'Sales',
    members: [
      { id: 'a3', displayName: 'Jane Doe', initials: 'JD' },
    ],
    createdAt: '2026-02-05T14:00:00Z',
  },
  {
    id: 't3',
    name: 'VIP',
    members: [],
    createdAt: '2026-03-01T09:00:00Z',
  },
];

const teamSchema = z.object({
  name: z.string().min(2, 'Team name is required'),
});

type TeamFormValues = z.infer<typeof teamSchema>;

const columnHelper = createColumnHelper<Team>();

export default function TeamsPage() {
  const { t } = useTranslation(['admin']);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => MOCK_TEAMS,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TeamFormValues>({
    resolver: zodResolver(teamSchema),
    defaultValues: { name: '' },
  });

  const openCreate = () => {
    setEditingTeam(null);
    reset({ name: '' });
    setDialogOpen(true);
  };

  const openEdit = (team: Team) => {
    setEditingTeam(team);
    reset({ name: team.name });
    setDialogOpen(true);
  };

  const openDelete = (team: Team) => {
    setDeletingTeam(team);
    setDeleteOpen(true);
  };

  const handleFormSubmit = handleSubmit((_values) => {
    // TODO: call API to create/update team
    setDialogOpen(false);
  });

  const handleDelete = () => {
    // TODO: call API to delete team
    setDeleteOpen(false);
    setDeletingTeam(null);
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('admin:teams.name'),
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('members', {
        header: () => t('admin:teams.members'),
        cell: (info) => {
          const members = info.getValue();
          if (members.length === 0) {
            return <span className="text-muted-foreground">&mdash;</span>;
          }
          return (
            <div className="flex -space-x-2">
              {members.map((member) => (
                <Tooltip key={member.id}>
                  <TooltipTrigger>
                    <Avatar className="h-7 w-7 border-2 border-background">
                      <AvatarFallback className="text-xs">{member.initials}</AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>{member.displayName}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: () => '',
        cell: (info) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => {
                e.stopPropagation();
                openEdit(info.row.original);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                openDelete(info.row.original);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      }),
    ],
    [t],
  );

  const table = useReactTable({
    data: teams,
    columns,
    state: { globalFilter: debouncedSearch },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const isEmpty = teams.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold">{t('admin:teams.title')}</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:teams.create')}
        </Button>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 py-16 dark:border-slate-600">
          <Users className="mb-3 h-10 w-10 text-slate-400" />
          <p className="text-sm text-slate-500">No teams yet &mdash; Create your first team</p>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('admin:teams.searchPlaceholder')}
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
                  <tr key={row.id} className="transition-colors hover:bg-muted/50">
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
                      No matching teams found.
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

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTeam ? t('admin:teams.edit') : t('admin:teams.create')}
            </DialogTitle>
            <DialogDescription>
              {editingTeam
                ? t('admin:teams.editDescription')
                : t('admin:teams.createDescription')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="teamName">{t('admin:teams.name')}</Label>
              <Input
                id="teamName"
                placeholder="e.g. Support"
                aria-invalid={!!errors.name}
                {...register('name')}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {editingTeam ? t('admin:teams.save') : t('admin:teams.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin:teams.deleteTitle')}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingTeam?.name}</strong>? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
