import { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
import { Activity, Trash2, Wifi, WifiOff } from 'lucide-react';
import { PageHeader } from '@/admin/shared/page-header';
import { Badge } from '@/core/ui/badge';
import { Button } from '@/core/ui/button';
import { onSseEvent } from '@/core/hooks/use-sse';

const SSE_EVENT_TYPES = [
  'conversation.assigned',
  'conversation.message',
  'conversation.state_changed',
  'agent.state_changed',
  'campaign.status_changed',
  'campaign.metrics_updated',
  'agentassist.suggestion',
  'agentassist.sentiment',
  'agentassist.compliance_alert',
  'agentassist.transcript',
  'notification.created',
] as const;

type ConnectionState = 'connected' | 'disconnected' | 'reconnecting';

interface EventLogEntry {
  id: string;
  timestamp: Date;
  type: string;
  preview: string;
}

interface SseDiagnosticState {
  connectionState: ConnectionState;
  events: EventLogEntry[];
  counters: Record<string, number>;
  totalEvents: number;
  connectedSince: Date | null;
  lastEventAt: Date | null;
  setConnectionState: (state: ConnectionState) => void;
  addEvent: (type: string, data: unknown) => void;
  clearLog: () => void;
}

const useSseDiagnosticStore = create<SseDiagnosticState>((set) => ({
  connectionState: 'disconnected',
  events: [],
  counters: {},
  totalEvents: 0,
  connectedSince: null,
  lastEventAt: null,
  setConnectionState: (connectionState) =>
    set((state) => ({
      connectionState,
      connectedSince:
        connectionState === 'connected' && state.connectionState !== 'connected'
          ? new Date()
          : connectionState !== 'connected'
            ? null
            : state.connectedSince,
    })),
  addEvent: (type, data) =>
    set((state) => {
      const preview = JSON.stringify(data).slice(0, 80);
      const entry: EventLogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date(),
        type,
        preview,
      };
      return {
        events: [entry, ...state.events].slice(0, 50),
        counters: { ...state.counters, [type]: (state.counters[type] ?? 0) + 1 },
        totalEvents: state.totalEvents + 1,
        lastEventAt: new Date(),
      };
    }),
  clearLog: () => set({ events: [], counters: {}, totalEvents: 0 }),
}));

const HEARTBEAT_TIMEOUT_MS = 20_000;

function useConnectionStateDetection() {
  const { lastEventAt, setConnectionState, connectionState } = useSseDiagnosticStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const lastEvent = useSseDiagnosticStore.getState().lastEventAt;
      if (!lastEvent) {
        if (useSseDiagnosticStore.getState().connectionState !== 'disconnected') {
          setConnectionState('disconnected');
        }
        return;
      }
      const elapsed = Date.now() - lastEvent.getTime();
      if (elapsed > HEARTBEAT_TIMEOUT_MS) {
        setConnectionState('reconnecting');
      } else {
        setConnectionState('connected');
      }
    }, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [setConnectionState]);

  return { connectionState, lastEventAt };
}

function formatUptime(since: Date | null): string {
  if (!since) return '--';
  const diff = Math.floor((Date.now() - since.getTime()) / 1000);
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function SseDiagnosticPage() {
  const { t } = useTranslation('admin');
  const { events, counters, totalEvents, connectedSince, clearLog } = useSseDiagnosticStore();
  const { connectionState } = useConnectionStateDetection();

  const uptimeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (uptimeRef.current) {
        uptimeRef.current.textContent = formatUptime(
          useSseDiagnosticStore.getState().connectedSince,
        );
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribers = SSE_EVENT_TYPES.map((type) =>
      onSseEvent(type, (data) => {
        useSseDiagnosticStore.getState().addEvent(type, data);
      }),
    );
    return () => unsubscribers.forEach((unsub) => unsub());
  }, []);

  const handleClear = useCallback(() => {
    clearLog();
  }, [clearLog]);

  const statusColor =
    connectionState === 'connected'
      ? 'bg-emerald-500'
      : connectionState === 'reconnecting'
        ? 'bg-amber-500'
        : 'bg-red-500';

  const statusLabel = t(`sseDiagnostic.status.${connectionState}`);

  return (
    <div className="space-y-6" data-testid="sse-diagnostic-page">
      <PageHeader title={t('sseDiagnostic.title')} description={t('sseDiagnostic.description')}>
        <Button variant="outline" onClick={handleClear} data-testid="clear-log-button">
          <Trash2 />
          {t('sseDiagnostic.clearLog')}
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4" data-testid="connection-status-card">
          <div className="flex items-center gap-2">
            {connectionState === 'connected' ? (
              <Wifi className="size-4 text-emerald-500" />
            ) : (
              <WifiOff className="size-4 text-red-500" />
            )}
            <span className="text-sm font-medium text-muted-foreground">
              {t('sseDiagnostic.connectionState')}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-block size-2.5 rounded-full ${statusColor}`}
              data-testid="status-indicator"
            />
            <span className="text-sm font-semibold capitalize" data-testid="status-label">
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              {t('sseDiagnostic.totalEvents')}
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold" data-testid="total-events">
            {totalEvents}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <span className="text-sm font-medium text-muted-foreground">
            {t('sseDiagnostic.uptime')}
          </span>
          <p className="mt-2 text-2xl font-bold tabular-nums" data-testid="uptime-value">
            <span ref={uptimeRef}>{formatUptime(connectedSince)}</span>
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <span className="text-sm font-medium text-muted-foreground">
            {t('sseDiagnostic.lastEvent')}
          </span>
          <p className="mt-2 text-sm font-semibold" data-testid="last-event-time">
            {useSseDiagnosticStore.getState().lastEventAt?.toLocaleTimeString() ?? '--'}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t('sseDiagnostic.eventCounters')}
        </h2>
        <div className="flex flex-wrap gap-2" data-testid="event-counters">
          {SSE_EVENT_TYPES.map((type) => (
            <Badge key={type} variant="secondary">
              {type}: {counters[type] ?? 0}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t('sseDiagnostic.eventLog')}
        </h2>
        <div className="max-h-96 overflow-auto rounded-lg border" data-testid="event-log">
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">
                  {t('sseDiagnostic.columns.timestamp')}
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  {t('sseDiagnostic.columns.eventType')}
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  {t('sseDiagnostic.columns.payload')}
                </th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                    {t('sseDiagnostic.noEvents')}
                  </td>
                </tr>
              ) : (
                events.map((entry) => (
                  <tr key={entry.id} className="border-b last:border-b-0">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                      {entry.timestamp.toLocaleTimeString()}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline">{entry.type}</Badge>
                    </td>
                    <td className="max-w-xs truncate px-3 py-2 font-mono text-xs">
                      {entry.preview}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
