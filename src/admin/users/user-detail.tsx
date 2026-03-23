import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Trash2, Mail, Shield, CircleDot } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { Separator } from '@/core/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/core/ui/dialog';
import { UserForm } from './user-form';
import type { User } from './users-page';

const MOCK_USERS: User[] = [
  { id: '1', email: 'admin@example.com', displayName: 'System Admin', role: 'admin', status: 'active', createdAt: '2026-01-15T10:00:00Z' },
  { id: '2', email: 'jane.doe@example.com', displayName: 'Jane Doe', role: 'supervisor', status: 'active', createdAt: '2026-02-01T14:30:00Z' },
  { id: '3', email: 'john.smith@example.com', displayName: 'John Smith', role: 'agent', status: 'active', createdAt: '2026-02-10T09:15:00Z' },
  { id: '4', email: 'maria.garcia@example.com', displayName: 'Maria Garcia', role: 'agent', status: 'inactive', createdAt: '2026-02-20T16:45:00Z' },
  { id: '5', email: 'viewer@example.com', displayName: 'Read Only User', role: 'readonly', status: 'active', createdAt: '2026-03-01T11:00:00Z' },
];

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

  const { data: user } = useQuery({
    queryKey: ['users', userId],
    queryFn: async () => MOCK_USERS.find((u) => u.id === userId) ?? null,
  });

  if (!user) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        User not found.
      </div>
    );
  }

  const handleDelete = () => {
    // TODO: call API to delete user
    setDeleteOpen(false);
    navigate('/admin/users');
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
          role: user.role,
          status: user.status,
        }}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{user.displayName}</strong>? This action
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
