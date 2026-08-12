// R5.2 PA.1 — MFA admin page.
//
// PlatformAdmin-only surface for managing user MFA enrollment across the
// platform. The route guard requires `system:mfa:manage`, matching the
// backend `PlatformAdminRequirement` id one-for-one (Platform/ADR-0037).
// Backend lives at `/api/v1/management/mfa/*` (see `MfaAdminEndpoints.cs`).
//
// Brownfield audit:
//   - DataTable + StatusBadge primitives ship from R5.1 (Phase 0/2).
//   - ConfirmDeleteDialog supports `confirmationWord` (R5.1 Phase 0.A).
//   - Backend DTO has no `last_used` history beyond `LastLoginAt`; we surface
//     the closest signal (last login) without inventing a separate field.

import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { createColumnHelper } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ShieldCheck, ShieldOff, Lock, RefreshCw, LogOut } from 'lucide-react';

import { Badge } from '@/core/ui/badge';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { PageHeader } from '@/core/ui/page-header';
import { PageSkeleton } from '@/core/ui/page-skeleton';
import { DataTable } from '@/core/ui/data-table';
import { useFormatDate } from '@/core/i18n/use-format';
import {
  useMfaUsers,
  useResetMfa,
  useRevokeMfaSessions,
  type MfaUserSummary,
  type MfaUserStatus,
} from '@/core/api/hooks/use-mfa-users';

const col = createColumnHelper<MfaUserSummary>();

const STATUS_OPTIONS: ReadonlyArray<{ value: '' | MfaUserStatus; key: string }> = [
  { value: '', key: 'admin:security_admin.mfa.filter.status_all' },
  { value: 'enrolled', key: 'admin:security_admin.mfa.status.enrolled' },
  { value: 'not-enrolled', key: 'admin:security_admin.mfa.status.not_enrolled' },
  { value: 'locked', key: 'admin:security_admin.mfa.status.locked' },
];

interface ListSectionProps {
  readonly isLoading: boolean;
  readonly users: ReadonlyArray<MfaUserSummary>;
  readonly columns: ColumnDef<MfaUserSummary, unknown>[];
  readonly t: TFunction;
}

function ListSection({ isLoading, users, columns, t }: ListSectionProps) {
  if (isLoading) {
    return <PageSkeleton rows={3} />;
  }
  if (users.length === 0) {
    return (
      <div
        className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center"
        data-testid="mfa-admin-empty"
      >
        <ShieldOff className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t('admin:security_admin.mfa.empty')}</p>
      </div>
    );
  }
  return (
    <DataTable
      data={[...users]}
      columns={columns}
      searchPlaceholder={t('admin:security_admin.mfa.search_placeholder')}
    />
  );
}

function StatusBadge({ status, t }: { readonly status: MfaUserStatus; readonly t: TFunction }) {
  const map: Record<
    MfaUserStatus,
    { variant: 'default' | 'secondary' | 'destructive'; key: string; icon: typeof ShieldCheck }
  > = {
    enrolled: {
      variant: 'default',
      key: 'admin:security_admin.mfa.status.enrolled',
      icon: ShieldCheck,
    },
    'not-enrolled': {
      variant: 'secondary',
      key: 'admin:security_admin.mfa.status.not_enrolled',
      icon: ShieldOff,
    },
    locked: {
      variant: 'destructive',
      key: 'admin:security_admin.mfa.status.locked',
      icon: Lock,
    },
  };
  const cfg = map[status];
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} data-testid={`mfa-admin-status-${status}`}>
      <Icon className="mr-1 h-3 w-3" aria-hidden="true" />
      {t(cfg.key)}
    </Badge>
  );
}

export default function MfaAdminPage() {
  const { t } = useTranslation(['admin']);
  const { formatDate, formatRelative } = useFormatDate();

  const [statusFilter, setStatusFilter] = useState<'' | MfaUserStatus>('');
  const [tenantFilter, setTenantFilter] = useState<string>('');

  const { data, isLoading } = useMfaUsers({
    status: statusFilter || undefined,
    tenant: tenantFilter || undefined,
    page: 1,
    pageSize: 50,
  });

  const resetMfa = useResetMfa();
  const revokeSessions = useRevokeMfaSessions();

  const [resetTarget, setResetTarget] = useState<MfaUserSummary | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<MfaUserSummary | null>(null);

  const users = data?.items ?? [];

  const columns = useMemo(
    () => [
      col.accessor('username', {
        header: () => t('admin:security_admin.mfa.columns.user'),
        cell: (info) => (
          <span className="font-medium" data-testid={`mfa-admin-user-${info.row.original.userId}`}>
            {info.getValue()}
          </span>
        ),
      }),
      col.accessor('tenantName', {
        header: () => t('admin:security_admin.mfa.columns.tenant'),
        cell: (info) => <span className="text-sm text-muted-foreground">{info.getValue()}</span>,
      }),
      col.accessor('status', {
        header: () => t('admin:security_admin.mfa.columns.status'),
        cell: (info) => <StatusBadge status={info.getValue()} t={t} />,
      }),
      col.accessor('enrolledAt', {
        header: () => t('admin:security_admin.mfa.columns.enrolled_at'),
        cell: (info) => {
          const value = info.getValue();
          if (!value) return <span className="text-muted-foreground">—</span>;
          return <span title={formatDate(value)}>{formatRelative(value)}</span>;
        },
      }),
      col.accessor('lastUsedAt', {
        header: () => t('admin:security_admin.mfa.columns.last_used'),
        cell: (info) => {
          const value = info.getValue();
          if (!value) return <span className="text-muted-foreground">—</span>;
          return <span title={formatDate(value)}>{formatRelative(value)}</span>;
        },
      }),
      col.display({
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => setResetTarget(row.original)}
              data-testid={`mfa-admin-reset-${row.original.userId}`}
              aria-label={t('admin:security_admin.mfa.actions.reset')}
            >
              <RefreshCw className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              {t('admin:security_admin.mfa.actions.reset')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-destructive hover:text-destructive"
              onClick={() => setRevokeTarget(row.original)}
              data-testid={`mfa-admin-revoke-${row.original.userId}`}
              aria-label={t('admin:security_admin.mfa.actions.revoke_sessions')}
            >
              <LogOut className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              {t('admin:security_admin.mfa.actions.revoke_sessions')}
            </Button>
          </div>
        ),
      }),
    ],
    [t, formatDate, formatRelative],
  );

  return (
    <div className="space-y-6" data-testid="mfa-admin-page">
      <PageHeader
        title={t('admin:security_admin.mfa.title')}
        description={t('admin:security_admin.mfa.description')}
      />

      {/* Filter panel */}
      <div className="rounded-lg border bg-card p-4 shadow-sm" data-testid="mfa-admin-filters">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="mfa-admin-filter-status">
              {t('admin:security_admin.mfa.filter.status')}
            </Label>
            <select
              id="mfa-admin-filter-status"
              data-testid="mfa-admin-filter-status"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as '' | MfaUserStatus)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {t(opt.key)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mfa-admin-filter-tenant">
              {t('admin:security_admin.mfa.filter.tenant')}
            </Label>
            <Input
              id="mfa-admin-filter-tenant"
              data-testid="mfa-admin-filter-tenant"
              placeholder={t('admin:security_admin.mfa.filter.tenant_placeholder')}
              value={tenantFilter}
              onChange={(e) => setTenantFilter(e.target.value)}
            />
          </div>
        </div>
      </div>

      <ListSection
        isLoading={isLoading}
        users={users}
        columns={columns as ColumnDef<MfaUserSummary, unknown>[]}
        t={t}
      />

      {/* Reset MFA confirmation. Type-to-confirm uses "RESET" so accidental
          clicks can't blow away a user's enrollment. */}
      <ConfirmDeleteDialog
        open={resetTarget !== null}
        onOpenChange={(open) => {
          if (!open) setResetTarget(null);
        }}
        onConfirm={() => {
          if (resetTarget) {
            resetMfa.mutate(resetTarget.userId, {
              onSettled: () => setResetTarget(null),
            });
          }
        }}
        entityName={resetTarget?.username ?? ''}
        entityType={t('admin:security_admin.mfa.confirm.reset_entity')}
        isPending={resetMfa.isPending}
        confirmationWord="RESET"
      />

      <ConfirmDeleteDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
        onConfirm={() => {
          if (revokeTarget) {
            revokeSessions.mutate(revokeTarget.userId, {
              onSettled: () => setRevokeTarget(null),
            });
          }
        }}
        entityName={revokeTarget?.username ?? ''}
        entityType={t('admin:security_admin.mfa.confirm.revoke_entity')}
        isPending={revokeSessions.isPending}
        confirmationWord="REVOKE"
      />
    </div>
  );
}
