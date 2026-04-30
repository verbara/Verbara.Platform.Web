import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, Route, Trash2, GripVertical, Save } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { PermissionGuard } from '@/core/auth/permission-guard';
import { useHasPermission } from '@/core/auth/use-has-permission';
import { RouteForm } from './route-form';
import { useRoutes, useDeleteRoute, useReorderRoutes, type OutboundRouteSummary } from '@/core/api/hooks/use-routes';
import { useTrunks } from '@/core/api/hooks/use-trunks';

const columnHelper = createColumnHelper<OutboundRouteSummary>();

const PATTERN_TYPE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  prefix: 'default',
  exact: 'secondary',
  regex: 'outline',
};

function SortableRow({
  route,
  trunkMap,
  onDelete,
}: Readonly<{
  route: OutboundRouteSummary;
  trunkMap: Map<number, string>;
  onDelete: (route: OutboundRouteSummary) => void;
}>) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: route.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const trunkName = trunkMap.get(route.trunkId);

  return (
    <tr ref={setNodeRef} style={style} className="border-t hover:bg-muted/30">
      <td className="px-3 py-2">
        <button
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </td>
      <td className="px-3 py-2 font-mono text-xs font-medium text-foreground">{route.pattern}</td>
      <td className="px-3 py-2">
        <Badge variant={PATTERN_TYPE_VARIANT[route.patternType] ?? 'outline'}>
          {route.patternType}
        </Badge>
      </td>
      <td className="px-3 py-2 font-mono text-muted-foreground">#{route.priority}</td>
      <td className="px-3 py-2">{trunkName ?? route.trunkId}</td>
      <td className="px-3 py-2 font-mono">{route.dialPrefix ?? <span className="text-muted-foreground">&mdash;</span>}</td>
      <td className="px-3 py-2 text-right">
        <Button
          variant="ghost"
          size="icon"
          data-testid={`delete-route-${route.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(route);
          }}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </td>
    </tr>
  );
}

export default function RoutesPage() {
  const { t } = useTranslation(['admin']);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRoute, setEditRoute] = useState<OutboundRouteSummary | null>(null);
  const [deletingRoute, setDeletingRoute] = useState<OutboundRouteSummary | null>(null);
  const deleteRoute = useDeleteRoute();
  const reorderRoutes = useReorderRoutes();
  const canManage = useHasPermission('campaigns:route:manage');

  const { data: routes = [], isLoading } = useRoutes();
  const { data: trunks = [] } = useTrunks();

  const trunkMap = useMemo(
    () => new Map(trunks.map((trunk) => [trunk.id, trunk.displayName])),
    [trunks],
  );

  const sortedRoutes = useMemo(
    () => [...routes].sort((a, b) => a.priority - b.priority),
    [routes],
  );

  const [orderedRoutes, setOrderedRoutes] = useState<OutboundRouteSummary[]>([]);
  const [hasReordered, setHasReordered] = useState(false);

  useEffect(() => {
    setOrderedRoutes(sortedRoutes);
    setHasReordered(false);
  }, [sortedRoutes]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrderedRoutes((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
    setHasReordered(true);
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('priority', {
        header: () => t('admin:routes.priority'),
        cell: (info) => (
          <span className="font-mono text-muted-foreground">#{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('pattern', {
        header: () => t('admin:routes.pattern'),
        cell: (info) => (
          <span className="font-medium text-foreground font-mono">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('patternType', {
        header: () => t('admin:routes.patternType'),
        cell: (info) => (
          <Badge variant={PATTERN_TYPE_VARIANT[info.getValue()] ?? 'outline'}>
            {info.getValue()}
          </Badge>
        ),
      }),
      columnHelper.accessor('trunkId', {
        header: () => t('admin:routes.trunk'),
        cell: (info) => {
          const name = trunkMap.get(info.getValue());
          return name ?? <span className="text-muted-foreground">{info.getValue()}</span>;
        },
      }),
      columnHelper.accessor('dialPrefix', {
        header: () => t('admin:routes.dialPrefix'),
        cell: (info) => {
          const val = info.getValue();
          return val ? (
            <span className="font-mono">{val}</span>
          ) : (
            <span className="text-muted-foreground">&mdash;</span>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: () => '',
        cell: (info) => (
          <PermissionGuard requires="campaigns:route:manage">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              data-testid={`delete-route-${info.row.original.id}`}
              onClick={(e) => {
                e.stopPropagation();
                setDeletingRoute(info.row.original);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </PermissionGuard>
        ),
      }),
    ],
    [t, trunkMap],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('admin:routes.title')}>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t('admin:routes.create')}
          </Button>
        </PageHeader>
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  const isEmpty = sortedRoutes.length === 0;

  return (
    <div className="space-y-6" data-testid="routes-page">
      <PageHeader title={t('admin:routes.title')}>
        <Button data-testid="routes-create-btn" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:routes.create')}
        </Button>
      </PageHeader>

      {isEmpty ? (
        <EmptyState
          icon={Route}
          message="No outbound routes yet — Add your first route"
        />
      ) : canManage ? (
        <div className="space-y-3">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedRoutes.map((r) => r.id)} strategy={verticalListSortingStrategy}>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="w-10 px-3 py-2" />
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Pattern</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Type</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Priority</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Trunk</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Prefix</th>
                      <th className="w-12 px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {orderedRoutes.map((route) => (
                      <SortableRow
                        key={route.id}
                        route={route}
                        trunkMap={trunkMap}
                        onDelete={setDeletingRoute}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </SortableContext>
          </DndContext>

          {hasReordered && (
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  reorderRoutes.mutate(orderedRoutes.map((r) => r.id), {
                    onSuccess: () => setHasReordered(false),
                  });
                }}
                disabled={reorderRoutes.isPending}
              >
                <Save className="mr-1.5 h-4 w-4" />
                {reorderRoutes.isPending ? 'Saving...' : 'Save Order'}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <DataTable
          data={sortedRoutes}
          columns={columns}
          searchPlaceholder={t('admin:routes.searchPlaceholder')}
          noResultsMessage="No matching routes found."
          onRowClick={(route) => setEditRoute(route)}
        />
      )}

      {/* Create route sheet */}
      <RouteForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
      />

      {/* Edit route sheet */}
      <RouteForm
        open={editRoute !== null}
        onOpenChange={(open) => { if (!open) setEditRoute(null); }}
        mode="edit"
        route={editRoute ?? undefined}
      />

      <ConfirmDeleteDialog
        open={deletingRoute !== null}
        onOpenChange={(open) => { if (!open) setDeletingRoute(null); }}
        onConfirm={() => {
          if (!deletingRoute) return;
          deleteRoute.mutate(deletingRoute.id, {
            onSuccess: () => setDeletingRoute(null),
          });
        }}
        entityName={deletingRoute?.pattern ?? ''}
        entityType={t('admin:routes.entity_type')}
        isPending={deleteRoute.isPending}
      />
    </div>
  );
}
