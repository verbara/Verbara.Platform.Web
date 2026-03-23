import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Pencil, Trash2, Mail, Shield, CircleDot } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { Separator } from '@/core/ui/separator';
import { ConfirmDialog } from '@/admin/shared/confirm-dialog';
import { UserForm } from './user-form';
import { useUser, useUpdateUser, useDeleteUser } from '@/core/api/hooks/use-users';

function InfoRow({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
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

  const { data: user } = useUser(userId);
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/users')}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
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
      </div>

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
    </div>
  );
}
