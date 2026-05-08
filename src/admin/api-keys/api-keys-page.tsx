// R5.1 Phase 2 Task Q — API Keys admin page.
//
// Brownfield audit:
//   - Backend `ManagementApiKeyEndpoints` ships full CRUD + rotate + revoke
//     at `/api/v1/management/api-keys`. All Management keys are scope
//     `platform:*` server-side; no UI scope picker required.
//   - StatusBadge variant="api-key" already maps Active/Expired/Revoked
//     (Phase 0 Task B) so no new StatusBadge entry is needed.
//   - The backend DTO has NO `lastUsedAt` or `prefix` fields — last-used
//     tracking is deferred (R5.2 follow-up). We show `—` for both and avoid
//     surfacing a fake prefix.
//   - Route is gated on `platform:tenant:manage` (the existing PlatformAdmin
//     permission already applied to /admin/tenants). No new `system:api-key`
//     permission set is introduced — matches the "preserve shipped RBAC"
//     pattern established in Tasks N/O/P.

import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { KeyRound, Plus, RefreshCw, Trash2 } from 'lucide-react';

import { Button } from '@/core/ui/button';
import { StatusBadge } from '@/core/ui/status-badge';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { PageHeader } from '@/admin/shared/page-header';
import { PageSkeleton } from '@/core/ui/page-skeleton';
import { DataTable } from '@/admin/shared/data-table';
import { useFormatDate } from '@/core/i18n/use-format';
import { useApiKeys, useRevokeApiKey, type ManagementApiKey } from '@/core/api/hooks/use-api-keys';
import { CreateApiKeyDialog } from './create-api-key-dialog';
import { RotateApiKeyDialog } from './rotate-api-key-dialog';
import { resolveApiKeyStatus } from './resolve-status';

const col = createColumnHelper<ManagementApiKey>();

// ─── List body renderer ──────────────────────────────────────────────────────
// Extracted so the main page return is a flat JSX tree — no nested ternaries
// that trip the linter (typescript:S3358). Handles the three mutually
// exclusive states: loading, empty, populated.
interface ListSectionProps {
  readonly isLoading: boolean;
  readonly keys: readonly ManagementApiKey[];
  readonly columns: ColumnDef<ManagementApiKey, unknown>[];
  readonly t: TFunction;
  readonly onCreate: () => void;
}

function ListSection({ isLoading, keys, columns, t, onCreate }: ListSectionProps) {
  if (isLoading) {
    return <PageSkeleton />;
  }
  if (keys.length === 0) {
    return (
      <div
        className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center"
        data-testid="api-keys-empty"
      >
        <KeyRound className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t('admin:api-keys.empty')}</p>
        <Button variant="outline" onClick={onCreate}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {t('admin:api-keys.create')}
        </Button>
      </div>
    );
  }
  return (
    <DataTable
      data={[...keys]}
      columns={columns}
      searchPlaceholder={t('admin:api-keys.search_placeholder')}
    />
  );
}

export default function ApiKeysPage() {
  const { t } = useTranslation(['admin']);
  const { formatDate, formatRelative } = useFormatDate();
  const { data: keys = [], isLoading } = useApiKeys();
  const revoke = useRevokeApiKey();

  const [createOpen, setCreateOpen] = useState(false);
  const [rotateTarget, setRotateTarget] = useState<ManagementApiKey | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ManagementApiKey | null>(null);

  const columns = useMemo(
    () => [
      col.accessor('name', {
        header: () => t('admin:api-keys.columns.name'),
        cell: (info) => (
          <span className="font-medium" data-testid={`api-key-name-${info.row.original.keyId}`}>
            {info.getValue()}
          </span>
        ),
      }),
      col.display({
        id: 'status',
        header: () => t('admin:api-keys.columns.status'),
        cell: ({ row }) => (
          <StatusBadge status={resolveApiKeyStatus(row.original)} variant="api-key" />
        ),
      }),
      col.accessor('lastUsedAt', {
        // R5.2 PC.5 / B.12 — backend now stamps `last_used_at` (debounced)
        // when a key authenticates successfully. Null means the key has
        // never been used since migration 020 added the column.
        header: () => t('admin:api-keys.columns.last_used'),
        cell: (info) => {
          const value = info.getValue();
          if (!value) {
            return (
              <span
                className="text-muted-foreground"
                data-testid={`api-key-last-used-${info.row.original.keyId}`}
              >
                {t('admin:api-keys.last_used_never')}
              </span>
            );
          }
          return (
            <span
              title={formatDate(value)}
              data-testid={`api-key-last-used-${info.row.original.keyId}`}
            >
              {formatRelative(value)}
            </span>
          );
        },
      }),
      col.accessor('expiresAt', {
        header: () => t('admin:api-keys.columns.expires'),
        cell: (info) => {
          const value = info.getValue();
          if (!value) {
            return (
              <span className="text-muted-foreground">{t('admin:api-keys.expiration.never')}</span>
            );
          }
          return <span title={formatDate(value)}>{formatRelative(value)}</span>;
        },
      }),
      col.accessor('createdAt', {
        header: () => t('admin:api-keys.columns.created'),
        cell: (info) => (
          <span title={formatDate(info.getValue())}>{formatRelative(info.getValue())}</span>
        ),
      }),
      col.display({
        id: 'actions',
        cell: ({ row }) => {
          const status = resolveApiKeyStatus(row.original);
          const locked = status === 'revoked';
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={locked}
                onClick={() => setRotateTarget(row.original)}
                data-testid={`rotate-api-key-${row.original.keyId}`}
                aria-label={t('admin:api-keys.actions.rotate')}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                disabled={locked}
                onClick={() => setRevokeTarget(row.original)}
                data-testid={`revoke-api-key-${row.original.keyId}`}
                aria-label={t('admin:api-keys.actions.revoke')}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          );
        },
      }),
    ],
    [t, formatDate, formatRelative],
  );

  return (
    <div className="space-y-6" data-testid="api-keys-page">
      <PageHeader title={t('admin:api-keys.title')} description={t('admin:api-keys.description')}>
        <Button onClick={() => setCreateOpen(true)} data-testid="api-keys-create-btn">
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {t('admin:api-keys.create')}
        </Button>
      </PageHeader>

      <ListSection
        isLoading={isLoading}
        keys={keys}
        columns={columns as ColumnDef<ManagementApiKey, unknown>[]}
        t={t}
        onCreate={() => setCreateOpen(true)}
      />

      <CreateApiKeyDialog open={createOpen} onOpenChange={setCreateOpen} />

      <RotateApiKeyDialog
        target={rotateTarget}
        onOpenChange={(open) => {
          if (!open) setRotateTarget(null);
        }}
      />

      <ConfirmDeleteDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
        onConfirm={() => {
          if (revokeTarget) {
            revoke.mutate(revokeTarget.keyId, {
              onSettled: () => setRevokeTarget(null),
            });
          }
        }}
        entityName={revokeTarget?.name ?? ''}
        entityType={t('admin:api-keys.revoke_entity_type')}
        isPending={revoke.isPending}
      />
    </div>
  );
}
