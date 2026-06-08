import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, ListTree, Trash2, Send, Pencil } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { PageSkeleton } from '@/core/ui/page-skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/core/ui/tabs';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { PermissionButton } from '@/core/ui/permission-button';
import {
  useTypificationSchemas,
  useDeleteTypificationSchema,
  usePublishTypificationSchema,
  useTypificationBindings,
  useDeleteTypificationBinding,
  type TypificationSchema,
  type SchemaBinding,
} from '@/core/api/hooks/use-typification';
import { PublishErrorsDialog } from './publish-errors-dialog';
import { BindingFormSheet } from './binding-form-sheet';

const PERMISSION = 'system:typification:configure';
const schemaColumns = createColumnHelper<TypificationSchema>();
const bindingColumns = createColumnHelper<SchemaBinding>();

export default function TypificationListPage() {
  const { t } = useTranslation(['admin']);
  const navigate = useNavigate();

  const { data: schemas = [], isLoading } = useTypificationSchemas();
  const deleteSchema = useDeleteTypificationSchema();
  const publishSchema = usePublishTypificationSchema();

  const [deleting, setDeleting] = useState<TypificationSchema | null>(null);
  const [publishErrors, setPublishErrors] = useState<{ name: string } | null>(null);

  const handlePublish = (schema: TypificationSchema) => {
    publishSchema.mutate(schema.schemaId, {
      onSuccess: (result) => {
        if (!result.ok) setPublishErrors({ name: schema.name });
      },
    });
  };

  const columns = useMemo(
    () => [
      schemaColumns.accessor('name', {
        header: () => t('admin:typification.list.name'),
        cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
      }),
      schemaColumns.accessor('version', {
        header: () => t('admin:typification.list.version'),
        cell: (info) => <span className="tabular-nums">v{info.getValue()}</span>,
      }),
      schemaColumns.accessor('isPublished', {
        header: () => t('admin:typification.list.status'),
        cell: (info) => (
          <Badge variant={info.getValue() ? 'default' : 'outline'}>
            {info.getValue() ? t('admin:typification.published') : t('admin:typification.draft')}
          </Badge>
        ),
      }),
      schemaColumns.display({
        id: 'nodeCount',
        header: () => t('admin:typification.list.nodes'),
        cell: (info) => <span className="tabular-nums">{info.row.original.nodes.length}</span>,
      }),
      schemaColumns.display({
        id: 'actions',
        header: () => '',
        cell: (info) => {
          const schema = info.row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <PermissionButton
                requires={PERMISSION}
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                data-testid={`edit-schema-${schema.schemaId}`}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/admin/typification/${schema.schemaId}`);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </PermissionButton>
              <PermissionButton
                requires={PERMISSION}
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                data-testid={`publish-schema-${schema.schemaId}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePublish(schema);
                }}
              >
                <Send className="h-3.5 w-3.5" />
              </PermissionButton>
              <PermissionButton
                requires={PERMISSION}
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                data-testid={`delete-schema-${schema.schemaId}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleting(schema);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </PermissionButton>
            </div>
          );
        },
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, navigate],
  );

  const isEmpty = !isLoading && schemas.length === 0;

  let schemasContent;
  if (isLoading) {
    schemasContent = <PageSkeleton />;
  } else if (isEmpty) {
    schemasContent = (
      <EmptyState
        icon={ListTree}
        message={t('admin:typification.list.empty')}
        actionLabel={t('admin:typification.list.create')}
        onAction={() => navigate('/admin/typification/new')}
      />
    );
  } else {
    schemasContent = (
      <DataTable
        data={schemas}
        columns={columns}
        searchPlaceholder={t('admin:typification.list.searchPlaceholder')}
        noResultsMessage={t('admin:typification.list.noResults')}
        onRowClick={(schema) => navigate(`/admin/typification/${schema.schemaId}`)}
      />
    );
  }

  return (
    <div className="space-y-6" data-testid="typification-page">
      <PageHeader title={t('admin:typification.list.title')}>
        <Button
          data-testid="typification-create-btn"
          onClick={() => navigate('/admin/typification/new')}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:typification.list.create')}
        </Button>
      </PageHeader>

      <Tabs defaultValue="schemas">
        <TabsList>
          <TabsTrigger value="schemas" data-testid="tab-schemas">
            {t('admin:typification.list.schemasTab')}
          </TabsTrigger>
          <TabsTrigger value="bindings" data-testid="tab-bindings">
            {t('admin:typification.list.bindingsTab')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schemas" className="mt-4">
          {schemasContent}
        </TabsContent>

        <TabsContent value="bindings" className="mt-4">
          <BindingsSection schemas={schemas} />
        </TabsContent>
      </Tabs>

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        onConfirm={() => {
          if (!deleting) return;
          deleteSchema.mutate(deleting.schemaId, { onSuccess: () => setDeleting(null) });
        }}
        entityName={deleting?.name ?? ''}
        entityType={t('admin:typification.list.entityType')}
        isPending={deleteSchema.isPending}
      />

      <PublishErrorsDialog
        open={publishErrors !== null}
        onOpenChange={(open) => {
          if (!open) setPublishErrors(null);
        }}
        schemaName={publishErrors?.name ?? ''}
        errors={publishSchema.data?.errors ?? []}
      />
    </div>
  );
}

function BindingsSection({ schemas }: { schemas: TypificationSchema[] }) {
  const { t } = useTranslation(['admin']);
  const { data: bindings = [], isLoading } = useTypificationBindings();
  const deleteBinding = useDeleteTypificationBinding();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<SchemaBinding | null>(null);
  const [deleting, setDeleting] = useState<SchemaBinding | null>(null);

  const schemaName = (schemaId: string) =>
    schemas.find((s) => s.schemaId === schemaId)?.name ?? schemaId;

  const columns = useMemo(
    () => [
      bindingColumns.accessor('scope', {
        header: () => t('admin:typification.bindings.scope'),
        cell: (info) => (
          <Badge variant="secondary">
            {t(`admin:typification.bindings.scopes.${info.getValue()}`)}
          </Badge>
        ),
      }),
      bindingColumns.accessor('scopeRef', {
        header: () => t('admin:typification.bindings.scopeRef'),
        cell: (info) =>
          info.getValue() ? (
            <span className="font-mono text-xs">{info.getValue()}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      }),
      bindingColumns.accessor('schemaId', {
        header: () => t('admin:typification.bindings.schema'),
        cell: (info) => <span>{schemaName(info.getValue())}</span>,
      }),
      bindingColumns.accessor('priority', {
        header: () => t('admin:typification.bindings.priority'),
        cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
      }),
      bindingColumns.display({
        id: 'actions',
        header: () => '',
        cell: (info) => {
          const binding = info.row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <PermissionButton
                requires={PERMISSION}
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                data-testid={`edit-binding-${binding.bindingId}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(binding);
                  setEditorOpen(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </PermissionButton>
              <PermissionButton
                requires={PERMISSION}
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                data-testid={`delete-binding-${binding.bindingId}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleting(binding);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </PermissionButton>
            </div>
          );
        },
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, schemas],
  );

  return (
    <div className="space-y-4" data-testid="bindings-section">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          data-testid="binding-create-btn"
          onClick={() => {
            setEditing(null);
            setEditorOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:typification.bindings.create')}
        </Button>
      </div>

      {isLoading ? (
        <PageSkeleton />
      ) : bindings.length === 0 ? (
        <EmptyState icon={ListTree} message={t('admin:typification.bindings.empty')} />
      ) : (
        <DataTable
          data={bindings}
          columns={columns}
          searchPlaceholder={t('admin:typification.bindings.searchPlaceholder')}
          noResultsMessage={t('admin:typification.bindings.noResults')}
        />
      )}

      <BindingFormSheet
        open={editorOpen}
        onOpenChange={setEditorOpen}
        binding={editing}
        schemas={schemas}
      />

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        onConfirm={() => {
          if (!deleting) return;
          deleteBinding.mutate(deleting.bindingId, { onSuccess: () => setDeleting(null) });
        }}
        entityName={deleting ? schemaName(deleting.schemaId) : ''}
        entityType={t('admin:typification.bindings.entityType')}
        isPending={deleteBinding.isPending}
      />
    </div>
  );
}
