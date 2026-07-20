import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuthStore } from '@/core/auth/auth-store';
import { useAgentAlertsStore } from '@/agent/stores/agent-alerts-store';
import {
  useCampaignMetricsStore,
  type CampaignStatus,
} from '@/operations/stores/campaign-metrics-store';
import { useAgentAiStore } from '@/core/stores/agent-ai-store';
import type { NotificationSeverity } from '@/core/api/hooks/use-notifications';

type SseEventHandler = (data: unknown) => void;
const handlers: Record<string, SseEventHandler[]> = {};

export function useSSE() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const sourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptRef = useRef(0);
  const connectRef = useRef<() => void>(null);

  const connect = useCallback(() => {
    if (!accessToken || sourceRef.current) return;

    // The logged-in agent's AgentId (NOT the user id) — populated in the query
    // cache by useAgentMe() on the agent surfaces; undefined for non-agent users.
    const currentAgentId = () => resolveAgentId(queryClient.getQueryData(['agent-me']));

    const url = `/api/v1/events/stream?token=${encodeURIComponent(accessToken)}`;
    const source = new EventSource(url);
    sourceRef.current = source;

    source.onopen = () => {
      reconnectAttemptRef.current = 0;
    };

    source.addEventListener('conversation.assigned', (e) => {
      try {
        const data = JSON.parse(e.data) as {
          conversationId: string;
          agentId: string;
          contactName: string;
        };
        if (!isForCurrentAgent(data.agentId, currentAgentId())) return;

        const isInAgentRoute = window.location.pathname.startsWith('/agent');

        toast.info(`New conversation from ${data.contactName}`, {
          duration: 6000,
          action: {
            label: 'Open',
            onClick: () => navigate(`/agent/conversation/${data.conversationId}`),
          },
        });

        if (!isInAgentRoute) {
          useAgentAlertsStore.getState().increment();
        }

        handlers['conversation.assigned']?.forEach((h) => h(data));
      } catch {
        // Malformed payload — skip
      }
    });

    // A queued conversation offered to this agent (QueueDistributionWorker). Unlike
    // conversation.assigned (accept/transfer), an Offered conversation keeps Owner=Queue, so the
    // agent inbox query can't surface it — the card is rendered from this event payload.
    source.addEventListener('conversation.offered', (e) => {
      try {
        const data = JSON.parse(e.data) as {
          conversationId: string;
          agentId: string;
          queueId: string;
          channel: string;
        };
        if (!isForCurrentAgent(data.agentId, currentAgentId())) return;

        const isInAgentRoute = window.location.pathname.startsWith('/agent');

        toast.info(`New ${data.channel} conversation offered`, {
          duration: 6000,
          action: {
            label: 'Open',
            onClick: () => navigate(`/agent/conversation/${data.conversationId}`),
          },
        });

        if (!isInAgentRoute) {
          useAgentAlertsStore.getState().increment();
        }

        handlers['conversation.offered']?.forEach((h) => h(data));
      } catch {
        // Malformed payload — skip
      }
    });

    // Inbound voice call answered (3B.1) → screen-pop the tracked voice Conversation for THIS agent.
    // Mirrors conversation.offered (tenant-broadcast + client AgentId filter); subscribers upsert the
    // voice Conversation + correlate the live softphone call, then we auto-navigate to the panel.
    source.addEventListener('voice.screenpop', (e) => {
      try {
        const data = JSON.parse(e.data) as {
          conversationId: string;
          agentId: string;
          channel: string;
          contactId: string;
          contactName: string;
          callerNumber: string;
          voiceLinkedId: string;
        };
        if (!isForCurrentAgent(data.agentId, currentAgentId())) return;

        // Subscribers (conversation-store upsert + voice-call-store association) react first so the
        // conversation is in the store before we navigate to it.
        handlers['voice.screenpop']?.forEach((h) => h(data));

        // Auto-navigate (D2) — but only within the agent surface, so an admin/ops view isn't yanked.
        if (window.location.pathname.startsWith('/agent')) {
          navigate(`/agent/conversation/${data.conversationId}`);
        } else {
          useAgentAlertsStore.getState().increment();
        }
      } catch {
        // Malformed payload — skip
      }
    });

    source.addEventListener('conversation.message', (e) => {
      try {
        const data = JSON.parse(e.data);
        handlers['conversation.message']?.forEach((h) => h(data));
      } catch {
        // ignore
      }
    });

    source.addEventListener('conversation.state_changed', (e) => {
      try {
        const data = JSON.parse(e.data);
        handlers['conversation.state_changed']?.forEach((h) => h(data));
      } catch {
        // ignore
      }
    });

    // W4 — when the drain worker applies a deferred pause (active work finished), the server emits
    // agent.state_changed for this agent. Refresh ['agent-me'] so the status selector flips from
    // "Break (pending)" to the applied state without a manual reload. (The pending-SET transition is
    // driven by the optimistic ['agent-me'] invalidation in the mutation hooks, not a push.)
    source.addEventListener('agent.state_changed', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (isForCurrentAgent(data.agentId ?? data.AgentId, currentAgentId())) {
          queryClient.invalidateQueries({ queryKey: ['agent-me'] });
        }
        handlers['agent.state_changed']?.forEach((h) => h(data));
      } catch {
        // ignore
      }
    });

    source.addEventListener('campaign.status_changed', (e) => {
      try {
        const data = JSON.parse(e.data) as { campaignId: string; newStatus: CampaignStatus };
        useCampaignMetricsStore.getState().updateStatus(data.campaignId, data.newStatus);
        handlers['campaign.status_changed']?.forEach((h) => h(data));
      } catch {
        // ignore
      }
    });

    source.addEventListener('campaign.metrics_updated', (e) => {
      try {
        const data: { campaignId: string } & Record<string, unknown> = JSON.parse(e.data);
        useCampaignMetricsStore.getState().updateMetrics(data.campaignId, data);
        handlers['campaign.metrics_updated']?.forEach((h) => h(data));
      } catch {
        // ignore
      }
    });

    // agentassist.* events route into the per-conversation slice of useAgentAiStore (3B.1 Phase C).
    // The server stamps every event with `conversationId`; without it we drop the store write (a
    // legacy/malformed event must not bleed into an arbitrary conversation) but still fan out to any
    // manual handlers.
    source.addEventListener('agentassist.suggestion', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (isForCurrentAgent(data.agentId, currentAgentId()) && data.conversationId) {
          useAgentAiStore.getState().addSuggestion(data.conversationId, data.suggestion ?? data);
        }
        handlers['agentassist.suggestion']?.forEach((h) => h(data));
      } catch {
        // ignore
      }
    });

    source.addEventListener('agentassist.sentiment', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (isForCurrentAgent(data.agentId, currentAgentId()) && data.conversationId) {
          useAgentAiStore.getState().updateSentiment(data.conversationId, data.sentiment ?? data);
        }
        handlers['agentassist.sentiment']?.forEach((h) => h(data));
      } catch {
        // ignore
      }
    });

    source.addEventListener('agentassist.compliance_alert', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (isForCurrentAgent(data.agentId, currentAgentId()) && data.conversationId) {
          useAgentAiStore.getState().addComplianceAlert(data.conversationId, data.alert ?? data);
        }
        handlers['agentassist.compliance_alert']?.forEach((h) => h(data));
      } catch {
        // ignore
      }
    });

    source.addEventListener('agentassist.transcript', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (isForCurrentAgent(data.agentId, currentAgentId()) && data.conversationId) {
          useAgentAiStore.getState().addTranscript(data.conversationId, data.segment ?? data);
        }
        handlers['agentassist.transcript']?.forEach((h) => h(data));
      } catch {
        // ignore
      }
    });

    source.addEventListener('notification.created', (e) => {
      try {
        const data = JSON.parse(e.data) as {
          notificationId: string;
          userId: string;
          category: string;
          severity: NotificationSeverity;
          title: string;
          body: string;
          actionUrl: string | null;
          timestamp: string;
        };

        queryClient.invalidateQueries({ queryKey: ['notifications'] });

        const validSeverities = ['Info', 'Warning', 'Critical'] as const;
        const severity = validSeverities.includes(data.severity as (typeof validSeverities)[number])
          ? data.severity
          : 'Info';

        if (severity === 'Critical') {
          toast.error(data.title, {
            description: data.body,
            duration: 10000,
            action: data.actionUrl
              ? { label: 'View', onClick: () => navigate(data.actionUrl!) }
              : undefined,
          });
        } else if (severity === 'Warning') {
          toast.warning(data.title, { description: data.body, duration: 6000 });
        }
        // Info / unknown: silent, only bell badge updates via invalidation

        handlers['notification.created']?.forEach((h) => h(data));
      } catch {
        // Malformed payload — skip
      }
    });

    source.onerror = () => {
      source.close();
      sourceRef.current = null;
      // Catch up missed notifications on reconnect
      queryClient.invalidateQueries({ queryKey: ['notifications'] });

      const attempt = reconnectAttemptRef.current;
      if (attempt >= 10) {
        toast.error(t('toasts.sse.connectionLost'));
        return;
      }
      const delay = Math.min(2000 * Math.pow(2, attempt), 30000) + Math.random() * 1000;
      reconnectAttemptRef.current = attempt + 1;
      setTimeout(() => connectRef.current?.(), delay);
    };
  }, [accessToken, queryClient, navigate, t]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      sourceRef.current?.close();
      sourceRef.current = null;
    };
  }, [connect]);
}

/**
 * An agent-targeted SSE event (conversation.offered / .assigned / agentassist.*)
 * is for the current connection iff its `agentId` equals the logged-in agent's
 * AgentId. NOTE: this is Agent.AgentId — a distinct EntityId from User.UserId in
 * the auth store. Matching the event agentId against the user id silently dropped
 * every agent-targeted notification: the offered WebChat card (which has no inbox
 * fallback because Owner stays Queue) never rendered for the agent.
 */
export function isForCurrentAgent(
  eventAgentId: string | undefined,
  myAgentId: string | undefined,
): boolean {
  return !!myAgentId && eventAgentId === myAgentId;
}

/**
 * Resolve the current agent's AgentId from the cached /agents/me payload.
 * GET /agents/me serializes the raw Agent domain object as `agentId` (it does
 * NOT follow the `id` DTO convention the other agent hooks normalize to), so
 * accept either key — otherwise currentAgentId() is undefined and every
 * agent-targeted SSE event (incl. the WebChat offer card) is dropped.
 */
export function resolveAgentId(
  cached: { id?: string; agentId?: string } | undefined,
): string | undefined {
  return cached?.agentId ?? cached?.id;
}

export function onSseEvent(type: string, handler: SseEventHandler) {
  if (!handlers[type]) handlers[type] = [];
  handlers[type]!.push(handler);
  return () => {
    handlers[type] = handlers[type]?.filter((h) => h !== handler) ?? [];
  };
}
