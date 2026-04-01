import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, Users } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';
import { UserForm } from './user-form';
import { useUsers, useCreateUser } from '@/core/api/hooks/use-users';
import type { User } from '@/core/api/hooks/use-users';

const columnHelper = createColumnHelper<User>();

const roleBadgeVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  supervisor: 'secondary',
  agent: 'outline',
  readonly: 'outline',
};

export default function UsersPage() {
  const { t } = useTranslation(['admin']);
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: users = [] } = useUsers();
  const createUser = useCreateUser();

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
          <Badge variant={roleBadgeVariant[info.getValue()] ?? 'outline'}>
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

  const isEmpty = users.length === 0;

  return (
    <div data-testid="users-page" className="space-y-6">
      <PageHeader title={t('admin:users.title')}>
        <Button data-testid="users-create-btn" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:users.create')}
        </Button>
      </PageHeader>

      {isEmpty ? (
        <EmptyState
          icon={Users}
          message="No users yet &mdash; Create your first user"
        />
      ) : (
        <DataTable
          data={users}
          columns={columns}
          searchPlaceholder="Search users..."
          noResultsMessage="No matching users found."
          onRowClick={(user) => navigate(`/admin/users/${user.id}`)}
        />
      )}

      {/* Create user sheet */}
      <UserForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={(v) => createUser.mutate(v)}
      />
    </div>
  );
}
