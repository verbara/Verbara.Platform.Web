import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PreChatForm } from './pre-chat-form';
import { Composer } from './composer';
import { MessageList } from './message-list';
import { StatusBanner, type Status } from './status-banner';
import { createSession, fetchHistory, type ChatMessage } from './transport/session-api';
import { createWsClient, type WsClient, type WsMessage } from './transport/ws-client';
import { createOfflineQueue } from './transport/offline-queue';
import { parseAttachments } from './transport/parse-attachments';
import { loadCachedMessages, saveCachedMessages } from './message-cache';

export interface InitConfigPayload {
  tenantId: string;
  apiBase?: string;
  visitorId: string;
  visitor?: { name?: string; email?: string };
  pageContext: { url: string; title: string; referrer: string };
  greeting?: string;
  theme?: { primaryColor?: string; fontFamily?: string };
}

interface Props {
  readonly config: InitConfigPayload;
  readonly onUnreadChange: (n: number) => void;
}

export function ChatWidget({ config, onUnreadChange }: Props) {
  const { t } = useTranslation('webchat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<Status>('connecting');
  const [profile, setProfile] = useState<{ name?: string; email?: string } | null>(
    config.visitor?.name && config.visitor?.email ? config.visitor : null,
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [wsClient, setWsClient] = useState<WsClient | null>(null);
  const apiBase = config.apiBase ?? '/api/v1';

  // Hydrate cached messages once profile is known (returning visitor)
  useEffect(() => {
    if (profile && messages.length === 0) {
      const cached = loadCachedMessages(config.tenantId);
      if (cached.length > 0) setMessages(cached);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Persist on every messages update
  useEffect(() => {
    if (profile) {
      saveCachedMessages(config.tenantId, messages);
    }
  }, [messages, profile, config.tenantId]);

  useEffect(() => {
    if (!sessionId) return;
    fetchHistory({ apiBase, sessionId })
      .then((history) => setMessages(history))
      .catch(() => {
        /* graceful */
      });
  }, [sessionId, apiBase]);

  const handlePreChatSubmit = useCallback(
    async (values: { name: string; email: string }) => {
      setProfile(values);
      window.parent.postMessage(
        { source: 'verbara-webchat-iframe', type: 'visitor-updated', payload: values },
        window.location.origin,
      );
      try {
        const session = await createSession({
          apiBase,
          tenantId: config.tenantId,
          visitorId: config.visitorId,
          profile: values,
          pageContext: config.pageContext,
        });
        setSessionId(session.sessionId);
        setStatus('online');
        const wsUrl = session.wsUrl.startsWith('ws')
          ? session.wsUrl
          : `${location.origin.replace(/^http/, 'ws')}${session.wsUrl}`;
        const queue = createOfflineQueue(config.tenantId);
        let client: WsClient | null = null;
        client = createWsClient({
          url: wsUrl,
          onOpen: () => {
            setStatus('online');
            const queued = queue.drain();
            for (const m of queued) {
              client?.send({ type: 'message', body: m.text, id: m.id });
            }
          },
          onMessage: (msg: WsMessage) => {
            if (msg.type === 'message') {
              const attachments = parseAttachments(msg.attachments);
              const incoming: ChatMessage = {
                id: String(msg.id ?? crypto.randomUUID()),
                text: String(msg.body ?? ''),
                from: 'agent',
                timestamp: String(msg.timestamp ?? new Date().toISOString()),
                ...(attachments ? { attachments } : {}),
              };
              setMessages((prev) => [...prev, incoming]);
              onUnreadChange(1);
            } else if (msg.type === 'typing') {
              setStatus('typing');
              setTimeout(() => setStatus('online'), 2000);
            }
          },
          onClose: () => setStatus('reconnecting'),
        });
        client.connect();
        setWsClient(client);

        if (config.greeting) {
          setMessages((prev) => [
            ...prev,
            {
              id: 'greeting',
              text: config.greeting!,
              from: 'agent',
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      } catch {
        setStatus('offline');
      }
    },
    [apiBase, config, onUnreadChange],
  );

  const handleSend = useCallback(
    (text: string) => {
      const queue = createOfflineQueue(config.tenantId);
      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        text,
        from: 'visitor',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, msg]);
      const ok = wsClient?.send({ type: 'message', body: text }) ?? false;
      if (!ok) {
        queue.push({ id: msg.id, text, timestamp: msg.timestamp });
      }
      window.parent.postMessage(
        { source: 'verbara-webchat-iframe', type: 'message-sent', payload: { text } },
        window.location.origin,
      );
    },
    [wsClient, config.tenantId],
  );

  useEffect(() => () => wsClient?.disconnect(), [wsClient]);

  if (!profile) {
    return <PreChatForm defaultValues={config.visitor} onSubmit={handlePreChatSubmit} />;
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-3 py-2 text-sm font-medium">
        <span>{t('preChat.title')}</span>
      </header>
      <StatusBanner status={status} />
      <MessageList messages={messages} />
      <Composer disabled={status === 'offline'} onSend={handleSend} />
    </div>
  );
}
