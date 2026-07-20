import { useState, useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, Radio, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { PageHeader } from '@/core/ui/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { PageSkeleton } from '@/core/ui/page-skeleton';
import { DataTable } from '@/core/ui/data-table';
import { ConfirmDialog } from '@/core/ui/confirm-dialog';
import { ProfileForm } from './profile-form';
import {
  useEndpointProfiles,
  useDeleteEndpointProfile,
  useSeedDefaults,
  type EndpointProfile,
} from '@/core/api/hooks/use-endpoint-profiles';

const columnHelper = createColumnHelper<EndpointProfile>();

export default function RealtimePage() {
  const { t } = useTranslation('admin');
  const [createOpen, setCreateOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<EndpointProfile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EndpointProfile | null>(null);

  const { data: profiles = [], isLoading } = useEndpointProfiles();
  const deleteProfile = useDeleteEndpointProfile();
  const seedDefaults = useSeedDefaults();

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('realtime.columns.name'),
        cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor('type', {
        header: () => t('realtime.columns.type'),
        cell: (info) => (
          <Badge variant="secondary">
            {info.getValue().charAt(0).toUpperCase() + info.getValue().slice(1)}
          </Badge>
        ),
      }),
      columnHelper.accessor('isDefault', {
        header: () => t('realtime.columns.default'),
        cell: (info) =>
          info.getValue() ? <Badge variant="default">{t('realtime.default_badge')}</Badge> : null,
      }),
      columnHelper.accessor('transport', {
        header: () => t('realtime.columns.transport'),
      }),
      columnHelper.accessor('codecs', {
        header: () => t('realtime.columns.codecs'),
        cell: (info) => (
          <span className="font-mono text-xs text-muted-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('webrtc', {
        header: () => t('realtime.columns.webrtc'),
        cell: (info) => (info.getValue() ? <Badge variant="outline">WebRTC</Badge> : null),
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: (info) => (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(info.row.original);
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ),
      }),
    ],
    [t],
  );

  const isEmpty = !isLoading && profiles.length === 0;

  let content: React.ReactNode;
  if (isLoading) {
    content = <PageSkeleton />;
  } else if (isEmpty) {
    content = <EmptyState icon={Radio} message={t('realtime.empty')} />;
  } else {
    content = (
      <DataTable
        data={profiles}
        columns={columns}
        searchPlaceholder={t('realtime.search_placeholder')}
        noResultsMessage={t('realtime.no_results')}
        onRowClick={(profile) => setEditProfile(profile)}
      />
    );
  }

  return (
    <div className="space-y-6" data-testid="realtime-page">
      <PageHeader title={t('realtime.title')} description={t('realtime.description')}>
        <Button
          variant="outline"
          onClick={() => seedDefaults.mutate()}
          disabled={seedDefaults.isPending}
        >
          {t('realtime.seed_defaults')}
        </Button>
        <Button onClick={() => setCreateOpen(true)} data-testid="realtime-create-btn">
          <Plus className="mr-1.5 h-4 w-4" />
          {t('realtime.create')}
        </Button>
      </PageHeader>

      {content}

      {/* Create profile sheet */}
      <ProfileForm open={createOpen} onOpenChange={setCreateOpen} mode="create" />

      {/* Edit profile sheet */}
      <ProfileForm
        open={editProfile !== null}
        onOpenChange={(open) => {
          if (!open) setEditProfile(null);
        }}
        mode="edit"
        profile={editProfile ?? undefined}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t('realtime.delete_dialog.title')}
        description={t('realtime.delete_dialog.description', { name: deleteTarget?.name ?? '' })}
        confirmLabel={t('realtime.delete_dialog.confirm')}
        onConfirm={() => {
          if (deleteTarget) {
            deleteProfile.mutate(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
}
