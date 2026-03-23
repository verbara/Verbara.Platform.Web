import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/core/auth/auth-store';
import { useNotificationStore } from '@/core/stores/notification-store';

type SseEventHandler = (data: unknown) => void;
const handlers: Record<string, SseEventHandler[]> = {};

export function useSSE() {
  const apiKey = useAuthStore((s) => s.apiKey);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const sourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!apiKey || sourceRef.current) return;

    const url = `/api/events/stream?token=${encodeURIComponent(apiKey)}`;
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

    source.onerror = () => {
      source.close();
      sourceRef.current = null;
      setTimeout(connect, 2000);
    };
  }, [apiKey, addNotification]);

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
