import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import { Button } from '@/core/ui/button';
import {
  useAgentMe,
  useUpdateAgentState,
  useCancelPendingPause,
  useForcePendingPause,
} from '@/core/api/hooks/use-agents';
import { normalizeStateToken, toWireState } from './agent-status-tokens';

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
  const cancelPause = useCancelPendingPause();
  const forcePause = useForcePendingPause();

  const current = getStatus(normalizeStateToken(agent?.state));

  const pendingToken = agent?.pendingState ? normalizeStateToken(agent.pendingState) : null;
  const pendingStatus = pendingToken ? getStatus(pendingToken) : null;
  const isPending = !!pendingStatus;

  return (
    <div className="flex flex-col gap-1" data-testid="agent-status-selector-root">
      <Select
        value={current.value}
        onValueChange={(newState) => {
          // The backend decides pending vs immediate (it defers deferrable aux states while
          // the agent has active work). The client just sends the request and reflects the
          // invalidated ['agent-me']; no client-side special-casing.
          if (newState) updateState.mutate({ state: toWireState(newState) });
        }}
        data-testid="agent-status-selector"
      >
        <SelectTrigger
          className="h-7 gap-1.5 border-0 bg-transparent px-1.5 text-xs shadow-none hover:bg-slate-100 dark:hover:bg-slate-700"
          data-testid="agent-status-selector"
        >
          <SelectValue>
            {isPending ? (
              <>
                <StatusDot color="bg-amber-500 animate-pulse" />
                <span data-testid="agent-status-pending-label">
                  {t('agent_status.pending_label', { state: t(pendingStatus.labelKey) })}
                </span>
              </>
            ) : (
              <>
                <StatusDot color={current.color} />
                <span>{t(current.labelKey)}</span>
              </>
            )}
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

      {isPending && (
        <div className="flex flex-col gap-1 px-1.5" data-testid="agent-status-pending-controls">
          <span
            className="text-[0.7rem] text-muted-foreground"
            data-testid="agent-status-finish-hint"
          >
            {t('agent_status.finish_active_items', { count: agent?.activeWorkCount ?? 0 })}
          </span>
          <div className="flex gap-1.5">
            <Button
              variant="secondary"
              size="xs"
              data-testid="pause-apply-now"
              disabled={forcePause.isPending}
              onClick={() => forcePause.mutate()}
            >
              {t('agent_status.apply_now')}
            </Button>
            <Button
              variant="ghost"
              size="xs"
              data-testid="pause-cancel"
              disabled={cancelPause.isPending}
              onClick={() => cancelPause.mutate()}
            >
              {t('agent_status.cancel_pending')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
