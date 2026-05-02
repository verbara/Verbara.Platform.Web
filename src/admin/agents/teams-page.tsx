import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, Users, Pencil, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
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
import { useTeams, useCreateTeam, useUpdateTeam, useDeleteTeam } from '@/core/api/hooks/use-teams';
import type { Team } from '@/core/api/hooks/use-teams';

const teamSchema = z.object({
  name: z.string().min(2, 'admin:teams.validation.nameRequired'),
});

type TeamFormValues = z.infer<typeof teamSchema>;

const columnHelper = createColumnHelper<Team>();

export default function TeamsPage() {
  const { t } = useTranslation(['admin']);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);

  const { data: teams = [] } = useTeams();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();

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

  const handleFormSubmit = handleSubmit((values) => {
    if (editingTeam) {
      updateTeam.mutate(
        { id: editingTeam.id, name: values.name },
        { onSuccess: () => setDialogOpen(false) },
      );
    } else {
      createTeam.mutate(
        { name: values.name },
        { onSuccess: () => setDialogOpen(false) },
      );
    }
  });

  const handleDelete = () => {
    if (!deletingTeam) return;
    deleteTeam.mutate(deletingTeam.id, {
      onSuccess: () => {
        setDeleteOpen(false);
        setDeletingTeam(null);
      },
    });
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('admin:teams.name'),
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('memberCount', {
        header: () => t('admin:teams.members'),
        cell: (info) => {
          const count = info.getValue();
          if (count === 0) {
            return <span className="text-muted-foreground">&mdash;</span>;
          }
          return <span>{count} member{count !== 1 ? 's' : ''}</span>;
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
              data-testid={`edit-team-${info.row.original.id}`}
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
              data-testid={`delete-team-${info.row.original.id}`}
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
    <div className="space-y-6" data-testid="teams-page">
      <PageHeader title={t('admin:teams.title')}>
        <Button onClick={openCreate} data-testid="teams-create-btn">
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
                data-testid="team-form-name"
                placeholder="e.g. Support"
                aria-invalid={!!errors.name}
                {...register('name')}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{t(errors.name.message ?? '')}</p>
              )}
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button type="submit" disabled={isSubmitting} data-testid="team-form-submit">
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
