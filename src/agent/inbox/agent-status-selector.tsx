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
  label: string;
  color: string;
}

const AGENT_STATUSES: AgentStatus[] = [
  { value: 'available', label: 'Available', color: 'bg-green-500' },
  { value: 'busy', label: 'Busy', color: 'bg-red-500' },
  { value: 'on_break', label: 'Break', color: 'bg-yellow-400' },
  { value: 'lunch', label: 'Lunch', color: 'bg-yellow-400' },
  { value: 'training', label: 'Training', color: 'bg-yellow-400' },
  { value: 'dnd', label: 'DND', color: 'bg-red-500' },
  { value: 'acw', label: 'ACW', color: 'bg-orange-500' },
  { value: 'offline', label: 'Offline', color: 'bg-slate-400' },
];

function StatusDot({ color }: { readonly color: string }) {
  return <span className={`inline-block size-2 shrink-0 rounded-full ${color}`} />;
}

function getStatus(value: string | undefined): AgentStatus {
  return (
    AGENT_STATUSES.find((s) => s.value === value) ?? {
      value: value ?? 'offline',
      label: value ?? 'Offline',
      color: 'bg-slate-400',
    }
  );
}

export function AgentStatusSelector() {
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
          <span>{current.label}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="start">
        {AGENT_STATUSES.map((status) => (
          <SelectItem key={status.value} value={status.value}>
            <StatusDot color={status.color} />
            {status.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
