import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PreChatForm } from './pre-chat-form';
import { Composer } from './composer';
import { CsatPanel } from './csat-panel';
import { MessageList } from './message-list';
import { StatusBanner, type Status } from './status-banner';
import { createSession, CreateSessionError, type ChatMessage } from './transport/session-api';
import { createWsClient, type WsClient } from './transport/ws-client';
import {
  MAX_ATTACH_ATTEMPTS,
  clearStoredSession,
  loadStoredSession,
  saveStoredSession,
  touchStoredSession,
  type StoredSession,
} from './transport/session-store';
import { messageFrame, readAgentMessage, type ServerFrame } from './transport/ws-protocol';
import { createOfflineQueue } from './transport/offline-queue';
import { loadCachedMessages, saveCachedMessages } from './message-cache';
import { playNotificationSound, loadSoundPreference, setSoundEnabled } from './notifications';
import { breadcrumb } from './sentry-breadcrumbs';
import { embedApiBase, embedWsUrl, postToHost } from './origins';

/**
 * Server-issued CSAT survey context threaded through the embed session config.
 * These six fields are minted host-side (the `responseToken` is an opaque,
 * signed capture token) and passed opaquely to the rating panel — the panel
 * itself owns only `rating`, `comment`, and `capturedAt` (csat-runner 2.2).
 * When absent the panel is not offered.
 */
export interface CsatEmbedContext {
  responseToken: string;
  surveyId: string;
  questionId: string;
  channel: string;
  queueName: string;
  conversationId: string;
}

export interface InitConfigPayload {
  tenantId: string;
  apiBase?: string;
  visitorId: string;
  visitor?: { name?: string; email?: string };
  pageContext: { url: string; title: string; referrer: string };
  greeting?: string;
  theme?: { primaryColor?: string; fontFamily?: string };
  /** Optional CSAT survey context (server-issued); enables the rating panel. */
  csat?: CsatEmbedContext;
}

interface Props {
  readonly config: InitConfigPayload;
  readonly onUnreadChange: (n: number) => void;
}

/** The close reason Platform gives a socket whose session it no longer knows (WebChatEndpoints.HandleWebSocket). */
const SESSION_EXPIRED_REASON = 'Session expired';

/** Delay before the next try after a refused session create: doubling from 2 s, at most 30 s, never sooner than
 * Platform's `Retry-After` (its session limit is per tenant and address, one-minute windows). */
function createRetryDelayMs(failures: number, err: unknown): number {
  const backoff = Math.min(2_000 * 2 ** failures, 30_000);
  const hinted = err instanceof CreateSessionError ? (err.retryAfterMs ?? 0) : 0;
  return Math.min(Math.max(backoff, hinted), 60_000);
}

export function ChatWidget({ config, onUnreadChange }: Props) {
  const { t } = useTranslation('webchat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<Status>('connecting');
  // Mirror `status` into a ref so long-lived WS callbacks (created once per socket
  // by ensureSession) read the *current* status instead of the value
  // captured at callback-creation time — fixes a stale closure that prevented
  // recovery from the 'timeout' state on an incoming message.
  const statusRef = useRef<Status>(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  const [profile, setProfile] = useState<{ name?: string; email?: string } | null>(
    config.visitor?.name && config.visitor?.email ? config.visitor : null,
  );
  // The session machinery lives in refs: one socket per widget, whatever React re-renders.
  const clientRef = useRef<WsClient | null>(null);
  // The session the socket in clientRef belongs to (another tab may have stored a different one since).
  const sessionIdRef = useRef<string | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const createFailuresRef = useRef(0);
  const mountedRef = useRef(false);
  const profileRef = useRef(profile);
  const onUnreadChangeRef = useRef(onUnreadChange);
  useEffect(() => {
    onUnreadChangeRef.current = onUnreadChange;
  }, [onUnreadChange]);
  const [soundOn, setSoundOn] = useState(() => loadSoundPreference());
  const [csatDismissed, setCsatDismissed] = useState(false);
  // The API and the socket stay on this frame's own origin, whatever the host page passes (#426).
  const apiBase = embedApiBase(config.apiBase, location.origin);

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

  /**
   * Gives the visitor a live session (#426): resumes the stored one when Platform can still know it, else creates
   * one. Runs at most once at a time; a second call while one is running (React StrictMode runs effects twice)
   * joins it. A stored session whose socket Platform refuses is dropped and replaced by a new one.
   */
  const ensureSession = useCallback((): Promise<void> => {
    const { tenantId, visitorId } = config;

    function connect(session: StoredSession, isNew: boolean): void {
      const queue = createOfflineQueue(tenantId);
      let openCount = 0;
      // Closes in a row without Platform confirming the socket in between. Platform refuses an unknown session
      // before the upgrade, which the page sees only as a socket that closes unopened.
      let failures = 0;
      const client: WsClient = createWsClient({
        url: session.wsUrl,
        // An open socket is not yet a live session: Platform accepts the upgrade first and then attaches the
        // session, closing with "Session expired" when it cannot. Its `connected` frame is the confirmation.
        onOpen: () => {},
        onMessage: (frame: ServerFrame) => {
          if (clientRef.current !== client) return;
          if (frame.type === 'connected') {
            openCount++;
            failures = 0;
            setStatus('online');
            touchStoredSession(tenantId, session.sessionId);
            for (const m of queue.drain()) {
              client.send(messageFrame(m.text));
            }
            if (openCount > 1) {
              breadcrumb('reconnected');
            }
            return;
          }
          // Platform sends `connected` on accept and `message` per agent reply; only a reply renders.
          const reply = readAgentMessage(frame);
          if (!reply) return;
          // Platform's frame carries no id or timestamp, so the widget stamps its own.
          const incoming: ChatMessage = {
            id: crypto.randomUUID(),
            text: reply.text,
            from: 'agent',
            timestamp: new Date().toISOString(),
            ...(reply.attachments ? { attachments: reply.attachments } : {}),
          };
          setMessages((prev) => [...prev, incoming]);
          onUnreadChangeRef.current(1);
          playNotificationSound();
          lastAgentActivityRef.current = Date.now();
          breadcrumb('message-received');
          if (statusRef.current === 'timeout') setStatus('online');
        },
        onClose: (reason) => {
          if (clientRef.current !== client) return;
          failures++;
          if (reason === SESSION_EXPIRED_REASON || failures >= MAX_ATTACH_ATTEMPTS) {
            // A dead session: stop reconnecting to it and start a new one.
            clientRef.current = null;
            client.disconnect();
            clearStoredSession(tenantId, session.sessionId);
            breadcrumb('session-abandoned', { sessionId: session.sessionId, reason });
            setStatus('connecting');
            void start();
            return;
          }
          setStatus('reconnecting');
        },
      });
      clientRef.current = client;
      sessionIdRef.current = session.sessionId;
      client.connect();

      if (isNew && config.greeting) {
        const greeting: ChatMessage = {
          id: 'greeting',
          text: config.greeting,
          from: 'agent',
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => (prev.some((m) => m.id === 'greeting') ? prev : [...prev, greeting]));
      }
    }

    async function run(): Promise<void> {
      // Let a StrictMode remount run its cleanup and setup before deciding anything.
      await Promise.resolve();
      if (!mountedRef.current || clientRef.current) return;

      const stored = loadStoredSession(tenantId, visitorId);
      if (stored) {
        breadcrumb('session-resumed', { sessionId: stored.sessionId });
        connect(stored, false);
        return;
      }

      try {
        const created = await createSession({
          apiBase,
          tenantId,
          visitorId,
          profile: profileRef.current ?? {},
          pageContext: config.pageContext,
        });
        if (!mountedRef.current) return;
        createFailuresRef.current = 0;
        const now = Date.now();
        const session: StoredSession = {
          sessionId: created.sessionId,
          wsUrl: embedWsUrl(created.wsUrl, location.origin),
          visitorId,
          createdAt: now,
          lastActiveAt: now,
        };
        saveStoredSession(tenantId, session);
        breadcrumb('session-created', { sessionId: session.sessionId });
        setStatus('connecting');
        connect(session, true);
      } catch (err) {
        if (!mountedRef.current) return;
        // Visible, but the composer stays usable: what the visitor types waits in the queue for the session.
        setStatus('error');
        const delay = createRetryDelayMs(createFailuresRef.current, err);
        createFailuresRef.current++;
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null;
          void start();
        }, delay);
      }
    }

    function start(): Promise<void> {
      if (inFlightRef.current) return inFlightRef.current;
      const running = run().finally(() => {
        if (inFlightRef.current === running) inFlightRef.current = null;
      });
      inFlightRef.current = running;
      return running;
    }

    return start();
  }, [apiBase, config]);

  // The widget mounts when the visitor first opens the bubble. A visitor the site identifies, or one who filled
  // the form on an earlier page, has a profile already and gets their session now.
  useEffect(() => {
    mountedRef.current = true;
    if (profileRef.current) void ensureSession();
    return () => {
      mountedRef.current = false;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      const client = clientRef.current;
      clientRef.current = null;
      client?.disconnect();
    };
  }, [ensureSession]);

  const handlePreChatSubmit = useCallback(
    async (values: { name: string; email: string }) => {
      profileRef.current = values;
      setProfile(values);
      postToHost('visitor-updated', values);
      await ensureSession();
    },
    [ensureSession],
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
      const ok = clientRef.current?.send(messageFrame(text)) ?? false;
      if (ok) {
        if (sessionIdRef.current) touchStoredSession(config.tenantId, sessionIdRef.current);
      } else {
        queue.push({ id: msg.id, text, timestamp: msg.timestamp });
      }
      breadcrumb('message-sent');
      postToHost('message-sent', { text });
    },
    [config.tenantId],
  );

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
      {config.csat && !csatDismissed ? (
        <div className="border-t">
          <CsatPanel
            context={config.csat}
            apiBase={apiBase}
            onDismiss={() => setCsatDismissed(true)}
          />
        </div>
      ) : (
        <Composer disabled={status === 'offline'} onSend={handleSend} shouldFocus />
      )}
    </div>
  );
}
