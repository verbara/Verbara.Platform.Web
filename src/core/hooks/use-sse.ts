import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuthStore } from '@/core/auth/auth-store';
import { useAgentAlertsStore } from '@/agent/stores/agent-alerts-store';
import { useCampaignMetricsStore, type CampaignStatus } from '@/operations/stores/campaign-metrics-store';
import { useAgentAiStore } from '@/agent/stores/agent-ai-store';
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

  const connect = useCallback(() => {
    if (!accessToken || sourceRef.current) return;

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
        const currentUserId = useAuthStore.getState().user?.id;
        if (!currentUserId || data.agentId !== currentUserId) return;

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

    source.addEventListener('agent.state_changed', (e) => {
      try {
        const data = JSON.parse(e.data);
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

    source.addEventListener('agentassist.suggestion', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const currentUserId = useAuthStore.getState().user?.id;
        if (data.agentId === currentUserId) {
          useAgentAiStore.getState().addSuggestion(data.suggestion ?? data);
        }
        handlers['agentassist.suggestion']?.forEach((h) => h(data));
      } catch {
        // ignore
      }
    });

    source.addEventListener('agentassist.sentiment', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const currentUserId = useAuthStore.getState().user?.id;
        if (data.agentId === currentUserId) {
          useAgentAiStore.getState().updateSentiment(data.sentiment ?? data);
        }
        handlers['agentassist.sentiment']?.forEach((h) => h(data));
      } catch {
        // ignore
      }
    });

    source.addEventListener('agentassist.compliance_alert', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const currentUserId = useAuthStore.getState().user?.id;
        if (data.agentId === currentUserId) {
          useAgentAiStore.getState().addComplianceAlert(data.alert ?? data);
        }
        handlers['agentassist.compliance_alert']?.forEach((h) => h(data));
      } catch {
        // ignore
      }
    });

    source.addEventListener('agentassist.transcript', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const currentUserId = useAuthStore.getState().user?.id;
        if (data.agentId === currentUserId) {
          useAgentAiStore.getState().addTranscript(data.segment ?? data);
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
      setTimeout(connect, delay);
    };
  }, [accessToken, queryClient, navigate]);

  useEffect(() => {
    connect();
    return () => {
      sourceRef.current?.close();
      sourceRef.current = null;
    };
  }, [connect]);
}

export function onSseEvent(type: string, handler: SseEventHandler) {
  if (!handlers[type]) handlers[type] = [];
  handlers[type]!.push(handler);
  return () => {
    handlers[type] = handlers[type]?.filter((h) => h !== handler) ?? [];
  };
}
