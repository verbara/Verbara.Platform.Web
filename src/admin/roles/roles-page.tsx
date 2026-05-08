import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/core/ui/dialog';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/core/ui/select';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import {
  useRoles,
  useCreateRole,
  useCloneRole,
  useDeleteRole,
  useRoleTemplates,
} from '@/core/api/hooks/use-rbac';

export default function RolesPage() {
  const { t } = useTranslation(['admin']);
  const navigate = useNavigate();
  const { data: roles = [] } = useRoles();
  const { data: templates = [] } = useRoleTemplates();
  const createRole = useCreateRole();
  const cloneRole = useCloneRole();
  const deleteRole = useDeleteRole();

  const [createOpen, setCreateOpen] = useState(false);
  const [cloneTarget, setCloneTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRoleTemplate, setNewRoleTemplate] = useState<string>('');
  const [cloneName, setCloneName] = useState('');

  function handleCreate() {
    createRole.mutate(
      {
        name: newRoleName,
        description: newRoleDesc || undefined,
        sourceTemplateId: newRoleTemplate || undefined,
      },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setNewRoleName('');
          setNewRoleDesc('');
          setNewRoleTemplate('');
        },
      },
    );
  }

  function handleClone() {
    if (!cloneTarget) return;
    cloneRole.mutate(
      { id: cloneTarget.id, name: cloneName },
      {
        onSuccess: () => {
          setCloneTarget(null);
          setCloneName('');
        },
      },
    );
  }

  return (
    <div className="space-y-6" data-testid="roles-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold">{t('admin:roles.title', 'Roles')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('admin:roles.description', 'Manage roles and their permissions')}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="roles-create-btn">
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:roles.create', 'Create Role')}
        </Button>
      </div>

      {/* Roles table */}
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-2 font-medium">{t('admin:roles.name', 'Name')}</th>
              <th className="px-4 py-2 font-medium">{t('admin:roles.source', 'Source')}</th>
              <th className="px-4 py-2 font-medium">
                {t('admin:roles.permissions', 'Permissions')}
              </th>
              <th className="px-4 py-2 font-medium">{t('admin:roles.users', 'Users')}</th>
              <th
                className="px-4 py-2 font-medium w-24"
                aria-label={t('common:table.col_actions')}
              />
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr
                key={role.roleId}
                className="border-b last:border-0 cursor-pointer hover:bg-muted/30"
                onClick={() => navigate(`/admin/roles/${role.roleId}`)}
              >
                <td className="px-4 py-2.5 font-medium">
                  {role.name}
                  {role.isDefault && (
                    <Badge variant="secondary" className="ml-2">
                      {t('admin:roles.default', 'Default')}
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {role.sourceTemplateId ?? t('admin:roles.custom', 'Custom')}
                </td>
                <td className="px-4 py-2.5">{role.permissions?.length ?? 0}</td>
                <td className="px-4 py-2.5">{role.userCount ?? 0}</td>
                <td className="px-4 py-2.5">
                  {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- event-stop container only; interactive children are <Button> elements */}
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t('admin:roles.clone', 'Clone Role')}
                      data-testid={`clone-role-${role.roleId}`}
                      onClick={() => {
                        setCloneTarget({ id: role.roleId, name: role.name });
                        setCloneName(`${role.name} (copy)`);
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    {!role.isDefault && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('common:actions.delete')}
                        data-testid={`delete-role-${role.roleId}`}
                        onClick={() => setDeleteTarget({ id: role.roleId, name: role.name })}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Role Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin:roles.create', 'Create Role')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('admin:roles.name', 'Name')}</Label>
              <Input
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder={t('admin:roles.name_placeholder', 'e.g. Team Lead')}
                data-testid="role-form-name"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('admin:roles.description_label', 'Description')}</Label>
              <Input
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
                placeholder={t('admin:roles.description_placeholder', 'Optional description')}
                data-testid="role-form-description"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('admin:roles.template', 'Template')}</Label>
              <Select value={newRoleTemplate} onValueChange={(v) => setNewRoleTemplate(v ?? '')}>
                <SelectTrigger className="w-full" data-testid="role-form-template">
                  <SelectValue placeholder={t('admin:roles.no_template', 'No template')} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.templateId} value={tpl.templateId}>
                      {tpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t('actions.cancel', 'Cancel')}
            </DialogClose>
            <Button
              onClick={handleCreate}
              disabled={!newRoleName.trim() || createRole.isPending}
              data-testid="role-form-submit"
            >
              {t('admin:roles.create', 'Create Role')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clone Dialog */}
      <Dialog open={!!cloneTarget} onOpenChange={() => setCloneTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin:roles.clone', 'Clone Role')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t('admin:roles.clone_name', 'New role name')}</Label>
            <Input
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              placeholder={t('admin:roles.name_placeholder', 'e.g. Team Lead')}
              data-testid="role-clone-name"
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t('actions.cancel', 'Cancel')}
            </DialogClose>
            <Button
              onClick={handleClone}
              disabled={!cloneName.trim() || cloneRole.isPending}
              data-testid="role-clone-submit"
            >
              {t('admin:roles.clone', 'Clone Role')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation — 3s countdown matches the app-wide destructive pattern
          (tenants, teams, billing, surveys). Replaces the previous instant ConfirmDialog
          which was the only destructive action in the admin UI that skipped the delay. */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (deleteTarget) {
            deleteRole.mutate(deleteTarget.id, {
              onSuccess: () => setDeleteTarget(null),
            });
          }
        }}
        entityName={deleteTarget?.name ?? ''}
        entityType={t('admin:roles.entity_type')}
        isPending={deleteRole.isPending}
      />
    </div>
  );
}
