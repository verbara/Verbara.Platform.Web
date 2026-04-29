import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/ui/select';
import { useAgentMe, useUpdateAgentState } from '@/core/api/hooks/use-agents';

interface AgentStatus {
  value: string;
  labelKey: string;
  color: string;
}

const AGENT_STATUSES: AgentStatus[] = [
  { value: 'available', labelKey: 'agent_status.available', color: 'bg-green-500' },
  { value: 'busy', labelKey: 'agent_status.busy', color: 'bg-red-500' },
  { value: 'on_break', labelKey: 'agent_status.on_break', color: 'bg-yellow-400' },
  { value: 'lunch', labelKey: 'agent_status.lunch', color: 'bg-yellow-400' },
  { value: 'training', labelKey: 'agent_status.training', color: 'bg-yellow-400' },
  { value: 'dnd', labelKey: 'agent_status.dnd', color: 'bg-red-500' },
  { value: 'acw', labelKey: 'agent_status.acw', color: 'bg-orange-500' },
  { value: 'offline', labelKey: 'agent_status.offline', color: 'bg-slate-400' },
];

function StatusDot({ color }: { readonly color: string }) {
  return <span className={`inline-block size-2 shrink-0 rounded-full ${color}`} />;
}

function getStatus(value: string | undefined): AgentStatus {
  return (
    AGENT_STATUSES.find((s) => s.value === value) ?? {
      value: value ?? 'offline',
      labelKey: 'agent_status.offline',
      color: 'bg-slate-400',
    }
  );
}

export function AgentStatusSelector() {
  const { t } = useTranslation('agent');
  const { data: agent } = useAgentMe();
  const updateState = useUpdateAgentState();

  const current = getStatus(agent?.state);

  return (
    <Select
      value={current.value}
      onValueChange={(newState) => {
        if (newState) updateState.mutate({ state: newState });
      }}
      data-testid="agent-status-selector"
    >
      <SelectTrigger
        className="h-7 gap-1.5 border-0 bg-transparent px-1.5 text-xs shadow-none hover:bg-slate-100 dark:hover:bg-slate-700"
        data-testid="agent-status-selector"
      >
        <SelectValue>
          <StatusDot color={current.color} />
          <span>{t(current.labelKey)}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="start">
        {AGENT_STATUSES.map((status) => (
          <SelectItem key={status.value} value={status.value}>
            <StatusDot color={status.color} />
            {t(status.labelKey)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
