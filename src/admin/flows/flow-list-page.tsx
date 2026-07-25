import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, Workflow } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { PageHeader } from '@/core/ui/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/core/ui/data-table';
import { useFlows, useCreateFlow, type FlowDefinition } from '@/core/api/hooks/use-flows';
import { useFormatDate } from '@/core/i18n/use-format';

const columnHelper = createColumnHelper<FlowDefinition>();

export default function FlowListPage() {
  const { t } = useTranslation(['admin']);
  const { formatDateShort } = useFormatDate();
  const navigate = useNavigate();

  const { data: flows = [] } = useFlows();
  const createFlow = useCreateFlow();

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('admin:flows.name'),
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('version', {
        header: () => t('admin:flows.version'),
        cell: (info) => `v${info.getValue()}`,
      }),
      columnHelper.display({
        id: 'status',
        header: () => t('admin:flows.status'),
        cell: (info) => (
          <Badge variant={info.row.original.isPublished ? 'default' : 'secondary'}>
            {info.row.original.isPublished
              ? t('admin:flows.publishedLabel')
              : t('admin:flows.draft')}
          </Badge>
        ),
      }),
      columnHelper.accessor('updatedAt', {
        header: () => t('admin:flows.lastModified'),
        cell: (info) => formatDateShort(info.getValue()),
      }),
    ],
    [t, formatDateShort],
  );

  const handleCreate = () => {
    createFlow.mutate(
      { name: t('admin:flows.untitled'), entryNodeId: '', nodes: [] },
      {
        onSuccess: (newFlow) => {
          navigate(`/admin/flows/${newFlow.flowId}`);
        },
      },
    );
  };

  const isEmpty = flows.length === 0;

  return (
    <div className="space-y-6" data-testid="flows-page">
      <PageHeader title={t('admin:flows.title')}>
        <Button data-testid="flows-create-btn" onClick={handleCreate} disabled={createFlow.isPending}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:flows.create')}
        </Button>
      </PageHeader>

      {isEmpty ? (
        <EmptyState
          icon={Workflow}
          message={t('admin:flows.empty')}
        />
      ) : (
        <DataTable
          data={flows}
          columns={columns}
          searchPlaceholder={t('admin:flows.searchPlaceholder')}
          noResultsMessage={t('admin:flows.noResults')}
          onRowClick={(flow) => navigate(`/admin/flows/${flow.flowId}`)}
        />
      )}
    </div>
  );
}
