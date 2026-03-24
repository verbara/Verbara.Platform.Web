import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, Route } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';
import { RouteForm } from './route-form';
import { useRoutes, type OutboundRouteSummary } from '@/core/api/hooks/use-routes';
import { useTrunks } from '@/core/api/hooks/use-trunks';

const columnHelper = createColumnHelper<OutboundRouteSummary>();

const PATTERN_TYPE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  prefix: 'default',
  exact: 'secondary',
  regex: 'outline',
};

export default function RoutesPage() {
  const { t } = useTranslation(['admin']);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRoute, setEditRoute] = useState<OutboundRouteSummary | null>(null);

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
    <div className="space-y-6">
      <PageHeader title={t('admin:routes.title')}>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:routes.create')}
        </Button>
      </PageHeader>

      {isEmpty ? (
        <EmptyState
          icon={Route}
          message="No outbound routes yet — Add your first route"
        />
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
    </div>
  );
}
