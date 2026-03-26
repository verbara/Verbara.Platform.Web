import { useState, useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, Radio, Trash2 } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';
import { ConfirmDialog } from '@/admin/shared/confirm-dialog';
import { ProfileForm } from './profile-form';
import {
  useEndpointProfiles,
  useDeleteEndpointProfile,
  useSeedDefaults,
  type EndpointProfile,
} from '@/core/api/hooks/use-endpoint-profiles';

const columnHelper = createColumnHelper<EndpointProfile>();

export default function RealtimePage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<EndpointProfile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EndpointProfile | null>(null);

  const { data: profiles = [], isLoading } = useEndpointProfiles();
  const deleteProfile = useDeleteEndpointProfile();
  const seedDefaults = useSeedDefaults();

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Name',
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('type', {
        header: 'Type',
        cell: (info) => (
          <Badge variant="secondary">
            {info.getValue().charAt(0).toUpperCase() + info.getValue().slice(1)}
          </Badge>
        ),
      }),
      columnHelper.accessor('isDefault', {
        header: 'Default',
        cell: (info) =>
          info.getValue() ? (
            <Badge variant="default">Default</Badge>
          ) : null,
      }),
      columnHelper.accessor('transport', {
        header: 'Transport',
      }),
      columnHelper.accessor('codecs', {
        header: 'Codecs',
        cell: (info) => (
          <span className="font-mono text-xs text-muted-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('webrtc', {
        header: 'WebRTC',
        cell: (info) =>
          info.getValue() ? (
            <Badge variant="outline">WebRTC</Badge>
          ) : null,
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
    [],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Endpoint Profiles">
          <Button variant="outline" onClick={() => seedDefaults.mutate()}>
            Seed Defaults
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Create Profile
          </Button>
        </PageHeader>
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Endpoint Profiles"
        description="Reusable PJSIP endpoint profile templates for agent and trunk provisioning."
      >
        <Button
          variant="outline"
          onClick={() => seedDefaults.mutate()}
          disabled={seedDefaults.isPending}
        >
          Seed Defaults
        </Button>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Create Profile
        </Button>
      </PageHeader>

      {profiles.length === 0 ? (
        <EmptyState
          icon={Radio}
          message="No endpoint profiles yet — click 'Seed Defaults' to create standard profiles or add one manually."
        />
      ) : (
        <DataTable
          data={profiles}
          columns={columns}
          searchPlaceholder="Search profiles..."
          noResultsMessage="No matching profiles found."
          onRowClick={(profile) => setEditProfile(profile)}
        />
      )}

      {/* Create profile sheet */}
      <ProfileForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
      />

      {/* Edit profile sheet */}
      <ProfileForm
        open={editProfile !== null}
        onOpenChange={(open) => { if (!open) setEditProfile(null); }}
        mode="edit"
        profile={editProfile ?? undefined}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Profile"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
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
