import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, Users } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';
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
  const [createOpen, setCreateOpen] = useState(false);

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

  const isEmpty = users.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin:users.title')}>
        <Button onClick={() => setCreateOpen(true)}>
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
      />
    </div>
  );
}
