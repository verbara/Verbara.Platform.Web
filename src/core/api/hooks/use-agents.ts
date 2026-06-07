import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

/**
 * W6 — resolved per-channel concurrency limits for an agent. Every field is
 * always present (the server merges any per-agent override over the tenant
 * defaults). `maxVoice` is always 1. Returned as `effectiveCapacity` by the
 * admin agent endpoints.
 */
export interface ChannelCapacity {
  maxVoice: number;
  maxChat: number;
  maxEmail: number;
  maxSms: number;
  maxTotal: number;
}

/**
 * W6 — per-agent capacity override. Each field is tri-state: a number sets an
 * explicit per-agent limit; `null` means "inherit this field from the tenant
 * default". Sent on create/update as the `capacity` body field, and returned as
 * `capacityOverride` (the whole object is `null` when the agent fully inherits).
 * `maxVoice` must be `null` or `1`; the others accept `0`–`50`.
 */
export interface ChannelCapacityOverride {
  maxVoice: number | null;
  maxChat: number | null;
  maxEmail: number | null;
  maxSms: number | null;
  maxTotal: number | null;
}

export interface Agent {
  /** Primary identifier returned by the backend. */
  agentId: string;
  /**
   * Alias of {@link agentId} synthesized in `useAgents`/`useAgent` so existing
   * callers (`agent.id`) keep working during the DTO alignment.
   */
  id: string;
  userId: string;
  /** Owning tenant id — needed to build the softphone SIP identity. */
  tenantId?: string;
  displayName: string;
  state: string;
  skills: string[];
  extension?: string | null;
  /**
   * The agent's own plaintext SIP password — populated ONLY by `GET /agents/me`
   * (self-scoped) so the in-browser softphone can REGISTER. The admin list/detail
   * endpoints (`useAgents`/`useAgent`) never return it; it stays in the TanStack
   * `['agent-me']` cache in memory and is never persisted to storage.
   */
  sipPassword?: string | null;
  /**
   * Per-agent auto-answer override (3B.2b). Tri-state: `null`/`undefined` = inherit the call's queue
   * default; `true`/`false` = explicit override. The softphone reads this from `GET /agents/me` and
   * combines it with the screen-pop's queue default to decide whether to auto-accept an inbound call.
   */
  autoAnswer?: boolean | null;
  /**
   * W4 deferred pause — populated by `GET /agents/me`. When the agent requests a
   * deferrable aux state (Break/Lunch/Training/DND) while handling active work, the
   * backend keeps {@link state} unchanged and records the target here (PascalCase,
   * e.g. "Break"), blocking new work until the active items finish or the agent
   * forces/cancels. Null/undefined when no pause is pending.
   */
  pendingState?: string | null;
  pendingReason?: string | null;
  pendingSince?: string | null;
  /** Count of conversations/calls the agent must finish before a pending pause applies. */
  activeWorkCount?: number;
  teamId?: string | null;
  teamName?: string | null;
  userEmail?: string | null;
  capacity?: {
    maxVoice: number;
    maxChat: number;
    maxEmail: number;
    maxSms: number;
    maxTotal: number;
  };
  /**
   * W6 — resolved capacity (override merged over tenant defaults) returned by
   * the admin list/detail endpoints (`useAgents`/`useAgent`). Always present on
   * those responses; absent on `GET /agents/me`.
   */
  effectiveCapacity?: ChannelCapacity;
  /**
   * W6 — the agent's own capacity override returned by the admin list/detail
   * endpoints. `null` when the agent fully inherits the tenant defaults; each
   * field is `null` to inherit just that channel. Absent on `GET /agents/me`.
   */
  capacityOverride?: ChannelCapacityOverride | null;
  createdAt: string;
}

function hydrate(a: Agent): Agent {
  return { ...a, id: a.agentId, skills: a.skills ?? [] };
}

interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const result = await customFetch<PagedResult<Agent>>({
        url: '/api/v1/admin/agents',
        method: 'GET',
        params: { page: '1', pageSize: '100' },
      });
      return result.items.map(hydrate);
    },
  });
}

export function useAgent(id: string | undefined) {
  return useQuery({
    queryKey: ['agents', id],
    queryFn: async () => {
      const agent = await customFetch<Agent>({ url: `/api/v1/admin/agents/${id}`, method: 'GET' });
      return hydrate(agent);
    },
    enabled: !!id,
  });
}

export function useAgentMe() {
  return useQuery({
    queryKey: ['agent-me'],
    queryFn: () => customFetch<Agent>({ url: '/api/v1/agents/me', method: 'GET' }),
  });
}

// ADR-0026 Phase A.1 — channel-aware queue membership at agent creation.
// AllowedChannels=undefined (omitted) means the agent is a member for all
// channels the queue accepts (preserves implicit pre-v2.6.0 behavior).
// A populated list restricts membership to the listed channels only.
// Empty arrays are rejected server-side (use IsExcluded=true for that).
export type QueueMembershipInput = {
  queueId: string;
  allowedChannels?: string[];
  penalty?: number;
};

export type CreateAgentInput = {
  userId: string;
  displayName: string;
  extension?: string;
  sipPassword?: string;
  autoAnswer?: boolean | null;
  queueMemberships?: QueueMembershipInput[];
  /** W6 — optional per-agent capacity override at creation (omit to inherit tenant defaults). */
  capacity?: ChannelCapacityOverride;
};

export function useCreateAgent() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: CreateAgentInput) =>
      customFetch<Agent>({ url: '/api/v1/admin/agents', method: 'POST', data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      toast.success(t('toasts.agents.created'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateAgent() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      displayName?: string;
      teamId?: string;
      skills?: { name: string; proficiency: number }[];
      extension?: string;
      sipPassword?: string;
      autoAnswer?: boolean | null;
      /** W6 — per-agent capacity override; included in the PUT body when provided. */
      capacity?: ChannelCapacityOverride;
    }) =>
      customFetch<Agent>({
        url: `/api/v1/admin/agents/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      toast.success(t('toasts.agents.updated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({ url: `/api/v1/admin/agents/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      toast.success(t('toasts.agents.deleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateAgentState() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: { state: string }) =>
      customFetch<Agent>({
        url: '/api/v1/agents/me/state',
        method: 'PUT',
        data,
      }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['agent-me'] });
      // W4 — a deferrable state requested while the agent has active work becomes a
      // PENDING pause (state unchanged) rather than applying now; toast accordingly.
      toast.success(
        result?.pendingState ? t('toasts.agents.pausePending') : t('toasts.agents.stateUpdated'),
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// W4 deferred pause — POST endpoints take NO body; `customFetch` omits the request
// body when `data` is absent. Both invalidate ['agent-me'] so the status selector
// reflects the cleared/applied pending pause.
export function useCancelPendingPause() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: () => customFetch<void>({ url: '/api/v1/agents/me/pause/cancel', method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-me'] });
      toast.success(t('toasts.agents.pauseCancelled'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useForcePendingPause() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: () => customFetch<void>({ url: '/api/v1/agents/me/pause/force', method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-me'] });
      toast.success(t('toasts.agents.pauseApplied'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateAgentStateAdmin() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ agentId, state }: { agentId: string; state: string }) =>
      customFetch<void>({
        url: `/api/v1/admin/agents/${agentId}`,
        method: 'PUT',
        data: { status: state },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      toast.success(t('toasts.agents.agentStateUpdated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
