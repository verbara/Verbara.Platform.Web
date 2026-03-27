import { useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { MoreHorizontal, UserX, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/admin/shared/page-header';
import { DataTable } from '@/admin/shared/data-table';
import { Button } from '@/core/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/ui/select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/core/ui/dropdown-menu';
import { PermissionGuard } from '@/core/auth/permission-guard';
import { useFormatDate } from '@/core/i18n/use-format';
import { useAgentStateStore, type AgentState, type AgentPresence } from '@/operations/stores/agent-state-store';
import { useAgents, useUpdateAgentStateAdmin, type Agent } from '@/core/api/hooks/use-agents';

function toAgentState(a: Agent): AgentState {
  return {
    agentId: a.id,
    name: a.displayName,
    team: a.teamName ?? '',
    state: (a.state as AgentPresence) ?? 'offline',
    stateChangedAt: a.createdAt,
    conversationCount: 0,
  };
}

const stateColors: Record<AgentPresence, string> = {
  available: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  busy: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  away: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  offline: 'bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300',
  wrap_up: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  on_break: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  in_meeting: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  training: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
};

const columnHelper = createColumnHelper<AgentState>();

function StateChangeCell({ agent }: { readonly agent: AgentState }) {
  const updateState = useUpdateAgentStateAdmin();

  return (
    <PermissionGuard requires="contacts:conversation:monitor">
      <Select
        value={agent.state}
        onValueChange={(newState) => {
          if (newState) updateState.mutate({ agentId: agent.agentId, state: newState });
        }}
      >
        <SelectTrigger className="h-7 w-28 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="available">Available</SelectItem>
          <SelectItem value="away">Away</SelectItem>
          <SelectItem value="on_break">Break</SelectItem>
          <SelectItem value="offline">Offline</SelectItem>
        </SelectContent>
      </Select>
    </PermissionGuard>
  );
}

export default function AgentStatesPage() {
  const { t } = useTranslation('operations');
  const { formatRelative } = useFormatDate();
  const { agents, setAgents } = useAgentStateStore();
  const { data: apiAgents } = useAgents();

  useEffect(() => {
    if (apiAgents) {
      setAgents(apiAgents.map(toAgentState));
    }
  }, [apiAgents, setAgents]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('agent_states.name'),
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('team', {
        header: () => t('agent_states.team'),
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('state', {
        header: () => t('agent_states.state'),
        cell: (info) => {
          const state = info.getValue();
          return (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${stateColors[state]}`}
            >
              {state.replace('_', ' ')}
            </span>
          );
        },
      }),
      columnHelper.accessor('stateChangedAt', {
        header: () => t('agent_states.duration'),
        cell: (info) => (
          <span className="text-muted-foreground">{formatRelative(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor('conversationCount', {
        header: () => t('agent_states.conversations'),
        cell: (info) => info.getValue(),
      }),
      columnHelper.display({
        id: 'changeState',
        header: () => '',
        cell: ({ row }) => <StateChangeCell agent={row.original} />,
      }),
      columnHelper.display({
        id: 'actions',
        header: () => '',
        cell: ({ row }) => <AgentActions agent={row.original} />,
      }),
    ],
    [t, formatRelative],
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t('agent_states.title')} />
      <DataTable
        data={agents}
        columns={columns}
        searchPlaceholder={t('agent_states.name')}
        noResultsMessage="No agents found."
      />
    </div>
  );
}

function AgentActions({ agent }: { readonly agent: AgentState }) {
  const { t } = useTranslation('operations');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-xs" />}
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() => {
            toast.success(`${agent.name} forced offline`);
          }}
        >
          <UserX className="mr-1.5 h-4 w-4" />
          {t('agent_states.force_offline')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            toast.info(`Viewing conversations for ${agent.name}`);
          }}
        >
          <MessageSquare className="mr-1.5 h-4 w-4" />
          {t('agent_states.view_conversations')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
