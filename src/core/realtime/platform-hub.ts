import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { useAuthStore } from '@/core/auth/auth-store';
import {
  useRealtimeStore,
  type AgentPresenceSnapshot,
  type PresenceStateValue,
  type SignalRConnectionState,
  type SupervisionStartedNotification,
  type WhisperNotification,
} from '@/core/stores/realtime-store';

const HUB_URL = '/hubs/platform';

interface PresenceUpdatedPayload {
  agentId: string;
  state: string;
  lastHeartbeat: string;
  sourceNodeId?: string;
  isRemove?: boolean;
}

interface SupervisionStartedPayload {
  conversationId: string;
  supervisorId: string;
  mode: string;
  startedAt: string;
}

interface WhisperReceivedPayload {
  conversationId: string;
  text: string;
  arrivedAt: string;
}

let connection: HubConnection | null = null;
let startPromise: Promise<void> | null = null;

function mapHubState(state: HubConnectionState): SignalRConnectionState {
  switch (state) {
    case HubConnectionState.Connected:
      return 'connected';
    case HubConnectionState.Connecting:
      return 'connecting';
    case HubConnectionState.Reconnecting:
      return 'reconnecting';
    case HubConnectionState.Disconnecting:
    case HubConnectionState.Disconnected:
    default:
      return 'disconnected';
  }
}

function normalizePresenceState(raw: string): PresenceStateValue {
  const normalized = raw.toLowerCase();
  switch (normalized) {
    case 'available':
    case 'busy':
    case 'away':
    case 'offline':
    case 'wrap_up':
    case 'on_break':
    case 'in_meeting':
    case 'training':
      return normalized;
    default:
      return 'unknown';
  }
}

function buildConnection(): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(HUB_URL, {
      accessTokenFactory: () => useAuthStore.getState().accessToken ?? '',
    })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build();
}

function registerHandlers(conn: HubConnection) {
  const store = useRealtimeStore.getState();

  conn.on('OnPresenceUpdated', (payload: PresenceUpdatedPayload) => {
    if (payload.isRemove) {
      useRealtimeStore.getState().removePresence(payload.agentId);
      return;
    }
    const snapshot: AgentPresenceSnapshot = {
      agentId: payload.agentId,
      state: normalizePresenceState(payload.state),
      lastHeartbeat: payload.lastHeartbeat,
      sourceNodeId: payload.sourceNodeId,
    };
    useRealtimeStore.getState().upsertPresence(snapshot);
  });

  conn.on('OnSupervisionStarted', (payload: SupervisionStartedPayload) => {
    const notif: SupervisionStartedNotification = {
      conversationId: payload.conversationId,
      supervisorId: payload.supervisorId,
      mode: payload.mode,
      startedAt: payload.startedAt,
    };
    useRealtimeStore.getState().setObservedSupervision(notif);
  });

  conn.on('OnWhisperReceived', (payload: WhisperReceivedPayload) => {
    const notif: WhisperNotification = {
      conversationId: payload.conversationId,
      text: payload.text,
      arrivedAt: payload.arrivedAt,
    };
    useRealtimeStore.getState().pushWhisper(notif);
  });

  conn.onreconnecting(() => store.setConnectionState('reconnecting'));
  conn.onreconnected(() => store.setConnectionState('connected'));
  conn.onclose(() => useRealtimeStore.getState().setConnectionState('disconnected'));
}

export async function startPlatformHub(): Promise<void> {
  if (connection && connection.state === HubConnectionState.Connected) return;
  if (startPromise) return startPromise;

  if (!connection) {
    connection = buildConnection();
    registerHandlers(connection);
  }

  useRealtimeStore.getState().setConnectionState('connecting');

  startPromise = connection
    .start()
    .then(() => {
      useRealtimeStore.getState().setConnectionState(mapHubState(connection!.state));
    })
    .catch((err) => {
      useRealtimeStore.getState().setConnectionState('failed');
      throw err;
    })
    .finally(() => {
      startPromise = null;
    });

  return startPromise;
}

export async function stopPlatformHub(): Promise<void> {
  if (!connection) return;
  try {
    await connection.stop();
  } finally {
    useRealtimeStore.getState().reset();
  }
}

export function getPlatformHub(): HubConnection {
  if (!connection) {
    throw new Error('Platform hub is not initialized. Call startPlatformHub() first.');
  }
  return connection;
}

export async function invokeHub<T = void>(method: string, ...args: unknown[]): Promise<T> {
  const conn = getPlatformHub();
  if (conn.state !== HubConnectionState.Connected) {
    await startPlatformHub();
  }
  return conn.invoke<T>(method, ...args);
}

export function onHubEvent<T>(method: string, handler: (payload: T) => void): () => void {
  if (!connection) return () => { /* no-op; hub not initialized yet */ };
  connection.on(method, handler);
  return () => connection?.off(method, handler);
}
