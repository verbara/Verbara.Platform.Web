import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Mail,
  Shield,
  CircleDot,
  Clock,
  KeyRound,
  LogOut,
  X,
  Plus,
} from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { Separator } from '@/core/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/ui/select';
import { ConfirmDialog } from '@/admin/shared/confirm-dialog';
import { PermissionGuard } from '@/core/auth/permission-guard';
import { AuditTimeline } from '@/core/ui/audit-timeline';
import { UserForm } from './user-form';
import { useUser, useUpdateUser, useDeleteUser } from '@/core/api/hooks/use-users';
import { useUserRoles, useAssignRole, useRemoveRole, useRoles } from '@/core/api/hooks/use-rbac';
import { useForceLogoutUser } from '@/core/api/hooks/use-auth-admin';

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Mail;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="mt-0.5 text-sm">{children}</div>
      </div>
    </div>
  );
}

export default function UserDetailPage() {
  const { t } = useTranslation(['admin']);
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState('');

  const { data: user } = useUser(userId);
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const { data: userRoles = [] } = useUserRoles(userId);
  const { data: allRoles = [] } = useRoles();
  const assignRole = useAssignRole();
  const removeRole = useRemoveRole();
  const forceLogoutUser = useForceLogoutUser();

  if (!user) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        User not found.
      </div>
    );
  }

  const handleDelete = () => {
    deleteUser.mutate(user.id, {
      onSuccess: () => {
        setDeleteOpen(false);
        navigate('/admin/users');
      },
    });
  };

  const handleForceLogout = () => {
    forceLogoutUser.mutate(user.id, {
      onSuccess: () => setLogoutOpen(false),
    });
  };

  const handleAssignRole = () => {
    if (!selectedRoleId) return;
    assignRole.mutate(
      { userId: user.id, roleId: selectedRoleId },
      { onSuccess: () => setSelectedRoleId('') },
    );
  };

  const availableRoles = allRoles.filter(
    (r) => !userRoles.some((ur) => ur.roleId === r.roleId),
  );

  const mfaEnabled = (user as unknown as Record<string, unknown>).mfaEnabled === true;
  const lastLogin = (user as unknown as Record<string, unknown>).lastLoginAt as string | undefined;
  const authProvider = ((user as unknown as Record<string, unknown>).authProvider as string) || 'local';

  return (
    <div data-testid="user-detail-page" className="mx-auto max-w-2xl space-y-6">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/users')}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back
        </Button>
        <div className="flex gap-2">
          <Button data-testid="user-edit-btn" variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Edit
          </Button>
          <PermissionGuard requires="system:auth:configure">
            <Button variant="outline" size="sm" onClick={() => setLogoutOpen(true)}>
              <LogOut className="mr-1.5 h-4 w-4" />
              {t('admin:users.force_logout', 'Force Logout')}
            </Button>
          </PermissionGuard>
          <Button data-testid="user-delete-btn" variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-1.5 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* User info card */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-heading text-xl font-semibold">{user.displayName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>

        <Separator className="my-4" />

        <InfoRow icon={Mail} label={t('admin:users.email')}>
          {user.email}
        </InfoRow>
        <InfoRow icon={Shield} label={t('admin:users.role')}>
          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
            {user.role}
          </Badge>
        </InfoRow>
        <InfoRow icon={CircleDot} label={t('admin:users.status')}>
          <Badge variant={user.status === 'active' ? 'default' : 'destructive'}>
            {user.status}
          </Badge>
        </InfoRow>
        <InfoRow icon={KeyRound} label={t('admin:users.mfa_status', 'MFA')}>
          <Badge variant={mfaEnabled ? 'default' : 'secondary'}>
            {mfaEnabled
              ? t('admin:users.mfa_enabled', 'Enabled')
              : t('admin:users.mfa_disabled', 'Disabled')}
          </Badge>
        </InfoRow>
        <InfoRow icon={Shield} label={t('admin:users.auth_provider', 'Auth Provider')}>
          <Badge variant="secondary">{authProvider}</Badge>
        </InfoRow>
        {lastLogin && (
          <InfoRow icon={Clock} label={t('admin:users.last_login', 'Last Login')}>
            {new Date(lastLogin).toLocaleString()}
          </InfoRow>
        )}
      </div>

      {/* Roles section */}
      <PermissionGuard requires="users:role:assign">
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h3 className="font-heading text-base font-semibold">
            {t('admin:users.roles', 'Roles')}
          </h3>

          <div className="flex flex-wrap gap-2">
            {userRoles.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t('admin:users.no_roles', 'No roles assigned')}
              </p>
            )}
            {userRoles.map((ur) => (
              <Badge key={ur.roleId} variant="default" className="gap-1.5">
                {ur.roleName}
                <button
                  type="button"
                  onClick={() =>
                    removeRole.mutate({ userId: user.id, roleId: ur.roleId })
                  }
                  className="ml-1 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive"
                  aria-label={`Remove ${ur.roleName}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>

          {availableRoles.length > 0 && (
            <div className="flex gap-2">
              <Select value={selectedRoleId} onValueChange={(v) => setSelectedRoleId(v ?? '')}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={t('admin:users.select_role', 'Select role...')} />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role.roleId} value={role.roleId}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={!selectedRoleId || assignRole.isPending}
                onClick={handleAssignRole}
              >
                <Plus className="mr-1 h-4 w-4" />
                {t('admin:users.assign_role', 'Assign')}
              </Button>
            </div>
          )}
        </div>
      </PermissionGuard>

      {/* History */}
      <PermissionGuard requires="system:audit:view">
        <div className="rounded-lg border bg-card p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            History
          </p>
          <AuditTimeline entityType="user" entityId={userId!} />
        </div>
      </PermissionGuard>

      {/* Edit sheet */}
      <UserForm
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        defaultValues={{
          email: user.email,
          displayName: user.displayName,
          role: user.role as 'admin' | 'supervisor' | 'agent' | 'readonly',
          status: user.status as 'active' | 'inactive',
        }}
        onSubmit={(v) => updateUser.mutate({ id: user.id, ...v })}
      />

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete user"
        description={
          <>
            Are you sure you want to delete <strong>{user.displayName}</strong>? This action
            cannot be undone.
          </>
        }
        onConfirm={handleDelete}
        confirmLabel="Delete"
        variant="destructive"
      />

      {/* Force Logout confirmation dialog */}
      <ConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        title={t('admin:users.force_logout', 'Force Logout')}
        description={
          <>
            {t('admin:users.force_logout_confirm', {
              defaultValue:
                'Are you sure you want to force logout {{name}}? All active sessions will be immediately terminated.',
              name: user.displayName,
            })}
          </>
        }
        onConfirm={handleForceLogout}
        confirmLabel={t('admin:users.force_logout', 'Force Logout')}
        variant="destructive"
      />
    </div>
  );
}
