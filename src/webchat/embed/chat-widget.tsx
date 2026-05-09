import { useState, useEffect, useCallback, useRef } from 'react';
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
import { playNotificationSound, loadSoundPreference, setSoundEnabled } from './notifications';
import { breadcrumb } from './sentry-breadcrumbs';

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
  const [soundOn, setSoundOn] = useState(() => loadSoundPreference());
  const apiBase = config.apiBase ?? '/api/v1';

  const TIMEOUT_MS = 5 * 60 * 1000;
  const lastAgentActivityRef = useRef<number | null>(null);

  // Initialize agent-activity timestamp on first mount.
  useEffect(() => {
    lastAgentActivityRef.current = Date.now();
  }, []);

  // Hydrate cached messages once profile is known (returning visitor).
  // Defer setMessages to a microtask so it's not synchronous within the effect body.
  useEffect(() => {
    if (profile && messages.length === 0) {
      const cached = loadCachedMessages(config.tenantId);
      if (cached.length > 0) {
        queueMicrotask(() => setMessages(cached));
      }
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

  useEffect(() => {
    if (!profile) return;
    const interval = setInterval(() => {
      if (
        Date.now() - (lastAgentActivityRef.current ?? Date.now()) > TIMEOUT_MS &&
        status !== 'timeout'
      ) {
        setStatus('timeout');
        breadcrumb('timeout');
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [profile, status, TIMEOUT_MS]);

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
        breadcrumb('session-created', { sessionId: session.sessionId });
        setStatus('online');
        const wsUrl = session.wsUrl.startsWith('ws')
          ? session.wsUrl
          : `${location.origin.replace(/^http/, 'ws')}${session.wsUrl}`;
        const queue = createOfflineQueue(config.tenantId);
        let openCount = 0;
        let client: WsClient | null = null;
        client = createWsClient({
          url: wsUrl,
          onOpen: () => {
            openCount++;
            setStatus('online');
            const queued = queue.drain();
            for (const m of queued) {
              client?.send({ type: 'message', body: m.text, id: m.id });
            }
            if (openCount > 1) {
              breadcrumb('reconnected');
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
              playNotificationSound();
              lastAgentActivityRef.current = Date.now();
              breadcrumb('message-received');
              if (status === 'timeout') setStatus('online');
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
      breadcrumb('message-sent');
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
        <button
          type="button"
          aria-label={soundOn ? t('settings.soundOff') : t('settings.soundOn')}
          onClick={() => {
            const next = !soundOn;
            setSoundOn(next);
            setSoundEnabled(next);
          }}
          className="text-xs"
          data-testid="webchat-sound-toggle"
        >
          {soundOn ? '🔔' : '🔕'}
        </button>
      </header>
      <StatusBanner status={status} />
      <MessageList messages={messages} />
      <Composer disabled={status === 'offline'} onSend={handleSend} shouldFocus />
    </div>
  );
}
