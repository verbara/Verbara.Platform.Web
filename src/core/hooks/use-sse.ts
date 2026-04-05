import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/core/auth/auth-store';
import { useNotificationStore } from '@/core/stores/notification-store';
import { useCampaignMetricsStore, type CampaignStatus } from '@/operations/stores/campaign-metrics-store';
import { useAgentAiStore } from '@/agent/stores/agent-ai-store';

type SseEventHandler = (data: unknown) => void;
const handlers: Record<string, SseEventHandler[]> = {};

export function useSSE() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const sourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!accessToken || sourceRef.current) return;

    const url = `/api/v1/events/stream?token=${encodeURIComponent(accessToken)}`;
    const source = new EventSource(url);
    sourceRef.current = source;

    source.addEventListener('conversation.assigned', (e) => {
      const data = JSON.parse(e.data);
      addNotification({
        type: 'conversation.assigned',
        title: `New conversation from ${data.contactName}`,
        conversationId: data.conversationId,
        timestamp: data.timestamp,
      });
      handlers['conversation.assigned']?.forEach((h) => h(data));
    });

    source.addEventListener('conversation.message', (e) => {
      const data = JSON.parse(e.data);
      handlers['conversation.message']?.forEach((h) => h(data));
    });

    source.addEventListener('conversation.state_changed', (e) => {
      const data = JSON.parse(e.data);
      handlers['conversation.state_changed']?.forEach((h) => h(data));
    });

    source.addEventListener('agent.state_changed', (e) => {
      const data = JSON.parse(e.data);
      handlers['agent.state_changed']?.forEach((h) => h(data));
    });

    source.addEventListener('campaign.status_changed', (e) => {
      const data = JSON.parse(e.data) as { campaignId: string; newStatus: CampaignStatus };
      useCampaignMetricsStore.getState().updateStatus(data.campaignId, data.newStatus);
      handlers['campaign.status_changed']?.forEach((h) => h(data));
    });

    source.addEventListener('campaign.metrics_updated', (e) => {
      const data: { campaignId: string } & Record<string, unknown> = JSON.parse(e.data);
      useCampaignMetricsStore.getState().updateMetrics(data.campaignId, data);
      handlers['campaign.metrics_updated']?.forEach((h) => h(data));
    });

    source.addEventListener('agentassist.suggestion', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      const currentUserId = useAuthStore.getState().user?.id;
      if (data.agentId === currentUserId) {
        useAgentAiStore.getState().addSuggestion(data.suggestion ?? data);
      }
      handlers['agentassist.suggestion']?.forEach((h) => h(data));
    });

    source.addEventListener('agentassist.sentiment', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      const currentUserId = useAuthStore.getState().user?.id;
      if (data.agentId === currentUserId) {
        useAgentAiStore.getState().updateSentiment(data.sentiment ?? data);
      }
      handlers['agentassist.sentiment']?.forEach((h) => h(data));
    });

    source.addEventListener('agentassist.compliance_alert', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      const currentUserId = useAuthStore.getState().user?.id;
      if (data.agentId === currentUserId) {
        useAgentAiStore.getState().addComplianceAlert(data.alert ?? data);
      }
      handlers['agentassist.compliance_alert']?.forEach((h) => h(data));
    });

    source.addEventListener('agentassist.transcript', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      const currentUserId = useAuthStore.getState().user?.id;
      if (data.agentId === currentUserId) {
        useAgentAiStore.getState().addTranscript(data.segment ?? data);
      }
      handlers['agentassist.transcript']?.forEach((h) => h(data));
    });

    source.onerror = () => {
      source.close();
      sourceRef.current = null;
      setTimeout(connect, 2000);
    };
  }, [accessToken, addNotification]);

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
