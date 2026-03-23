import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, Workflow } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';

export interface FlowSummary {
  id: string;
  name: string;
  version: number;
  isPublished: boolean;
  updatedAt: string;
}

export const MOCK_FLOWS: FlowSummary[] = [
  { id: 'f1', name: 'Support IVR', version: 3, isPublished: true, updatedAt: '2026-03-15T10:30:00Z' },
  { id: 'f2', name: 'Sales Greeting', version: 1, isPublished: false, updatedAt: '2026-03-20T14:00:00Z' },
  { id: 'f3', name: 'After Hours', version: 2, isPublished: true, updatedAt: '2026-03-18T09:00:00Z' },
];

const columnHelper = createColumnHelper<FlowSummary>();

export default function FlowListPage() {
  const { t } = useTranslation(['admin']);
  const navigate = useNavigate();

  const { data: flows = [] } = useQuery({
    queryKey: ['flows'],
    queryFn: async () => MOCK_FLOWS,
  });

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
        cell: (info) => new Date(info.getValue()).toLocaleDateString(),
      }),
    ],
    [t],
  );

  const handleCreate = () => {
    // Mock: create a new flow and navigate to designer
    const newId = `f${Date.now()}`;
    navigate(`/admin/flows/${newId}`);
  };

  const isEmpty = flows.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin:flows.title')}>
        <Button onClick={handleCreate}>
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
          onRowClick={(flow) => navigate(`/admin/flows/${flow.id}`)}
        />
      )}
    </div>
  );
}
