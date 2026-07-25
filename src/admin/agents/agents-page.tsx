import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, Headset } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { PageHeader } from '@/core/ui/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/core/ui/data-table';
import { AgentForm } from './agent-form';
import { toCapacityOverride } from './capacity-override';
import { useAgents, useCreateAgent } from '@/core/api/hooks/use-agents';
import type { Agent } from '@/core/api/hooks/use-agents';

const columnHelper = createColumnHelper<Agent>();

const stateBadgeVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  available: 'default',
  busy: 'destructive',
  away: 'secondary',
  offline: 'outline',
};

export default function AgentsPage() {
  const { t } = useTranslation(['admin']);
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: agents = [] } = useAgents();
  const createAgent = useCreateAgent();

  const columns = useMemo(
    () => [
      columnHelper.accessor('displayName', {
        header: () => t('admin:agents.displayName'),
        cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor('userId', {
        header: () => t('admin:agents.user'),
        cell: (info) => (
          <span className="font-mono text-xs text-muted-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('extension', {
        header: () => t('admin:agents.extension', 'Extension'),
        cell: (info) =>
          info.getValue() ? (
            <span className="font-mono">{info.getValue()}</span>
          ) : (
            <span className="text-muted-foreground">&mdash;</span>
          ),
      }),
      columnHelper.accessor('state', {
        header: () => t('admin:agents.state'),
        cell: (info) => (
          <Badge variant={stateBadgeVariant[info.getValue().toLowerCase()] ?? 'outline'}>
            {info.getValue()}
          </Badge>
        ),
      }),
      columnHelper.accessor('skills', {
        header: () => t('admin:agents.skills', 'Skills'),
        cell: (info) => info.getValue()?.length ?? 0,
      }),
    ],
    [t],
  );

  const isEmpty = agents.length === 0;

  return (
    <div data-testid="agents-page" className="space-y-6">
      <PageHeader title={t('admin:agents.title')}>
        <Button data-testid="agents-create-btn" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:agents.create')}
        </Button>
      </PageHeader>

      {isEmpty ? (
        <EmptyState icon={Headset} message="No agents yet &mdash; Create your first agent" />
      ) : (
        <DataTable
          data={agents}
          columns={columns}
          searchPlaceholder={t('admin:agents.searchPlaceholder')}
          noResultsMessage="No matching agents found."
          onRowClick={(agent) => navigate(`/admin/agents/${agent.agentId}`)}
        />
      )}

      {/* Create agent sheet */}
      <AgentForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={(v) => {
          // W6 — fold the form capacity group into a full ChannelCapacityOverride
          // (maxVoice null = server-pinned 1; all-null = inherit tenant defaults).
          const { capacity, ...rest } = v;
          createAgent.mutate({ ...rest, capacity: toCapacityOverride(capacity) });
        }}
      />
    </div>
  );
}
