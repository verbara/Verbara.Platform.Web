import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, Users, Pencil, Trash2 } from 'lucide-react';
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
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';
import { ConfirmDialog } from '@/admin/shared/confirm-dialog';

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);

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

  const isEmpty = teams.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin:teams.title')}>
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:teams.create')}
        </Button>
      </PageHeader>

      {isEmpty ? (
        <EmptyState
          icon={Users}
          message="No teams yet &mdash; Create your first team"
        />
      ) : (
        <DataTable
          data={teams}
          columns={columns}
          searchPlaceholder={t('admin:teams.searchPlaceholder')}
          noResultsMessage="No matching teams found."
        />
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
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('admin:teams.deleteTitle')}
        description={
          <>
            Are you sure you want to delete <strong>{deletingTeam?.name}</strong>? This action
            cannot be undone.
          </>
        }
        onConfirm={handleDelete}
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  );
}
