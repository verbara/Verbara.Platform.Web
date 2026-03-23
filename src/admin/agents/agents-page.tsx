import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, Headset } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';
import { AgentForm } from './agent-form';

export interface AgentSkill {
  name: string;
  proficiency: number;
}

export interface Agent {
  id: string;
  userId: string;
  userEmail: string;
  displayName: string;
  teamId: string | null;
  teamName: string | null;
  state: 'available' | 'busy' | 'away' | 'offline';
  skills: AgentSkill[];
  queueCount: number;
  createdAt: string;
}

export const MOCK_AGENTS: Agent[] = [
  { id: 'a1', userId: '3', userEmail: 'john.smith@example.com', displayName: 'John Smith', teamId: 't1', teamName: 'Support', state: 'available', skills: [{ name: 'billing', proficiency: 8 }, { name: 'technical', proficiency: 6 }], queueCount: 2, createdAt: '2026-02-10T09:15:00Z' },
  { id: 'a2', userId: '4', userEmail: 'maria.garcia@example.com', displayName: 'Maria Garcia', teamId: 't1', teamName: 'Support', state: 'busy', skills: [{ name: 'billing', proficiency: 9 }], queueCount: 1, createdAt: '2026-02-20T16:45:00Z' },
  { id: 'a3', userId: '2', userEmail: 'jane.doe@example.com', displayName: 'Jane Doe', teamId: 't2', teamName: 'Sales', state: 'away', skills: [{ name: 'sales', proficiency: 10 }, { name: 'retention', proficiency: 7 }], queueCount: 3, createdAt: '2026-02-01T14:30:00Z' },
  { id: 'a4', userId: '6', userEmail: 'carlos.ruiz@example.com', displayName: 'Carlos Ruiz', teamId: null, teamName: null, state: 'offline', skills: [], queueCount: 0, createdAt: '2026-03-05T08:00:00Z' },
];

const columnHelper = createColumnHelper<Agent>();

const stateBadgeVariant: Record<Agent['state'], 'default' | 'secondary' | 'outline' | 'destructive'> = {
  available: 'default',
  busy: 'destructive',
  away: 'secondary',
  offline: 'outline',
};

export default function AgentsPage() {
  const { t } = useTranslation(['admin']);
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => MOCK_AGENTS,
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor('displayName', {
        header: () => t('admin:agents.displayName'),
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('userEmail', {
        header: () => t('admin:agents.user'),
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('teamName', {
        header: () => t('admin:agents.team'),
        cell: (info) => info.getValue() ?? <span className="text-muted-foreground">&mdash;</span>,
      }),
      columnHelper.accessor('state', {
        header: () => t('admin:agents.state'),
        cell: (info) => (
          <Badge variant={stateBadgeVariant[info.getValue()]}>
            {info.getValue()}
          </Badge>
        ),
      }),
      columnHelper.accessor('queueCount', {
        header: () => t('admin:agents.queueCount'),
        cell: (info) => info.getValue(),
      }),
    ],
    [t],
  );

  const isEmpty = agents.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin:agents.title')}>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:agents.create')}
        </Button>
      </PageHeader>

      {isEmpty ? (
        <EmptyState
          icon={Headset}
          message="No agents yet &mdash; Create your first agent"
        />
      ) : (
        <DataTable
          data={agents}
          columns={columns}
          searchPlaceholder={t('admin:agents.searchPlaceholder')}
          noResultsMessage="No matching agents found."
          onRowClick={(agent) => navigate(`/admin/agents/${agent.id}`)}
        />
      )}

      {/* Create agent sheet */}
      <AgentForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
      />
    </div>
  );
}
