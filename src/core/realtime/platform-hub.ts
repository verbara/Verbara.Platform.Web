import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { useAuthStore } from '@/core/auth/auth-store';
import { queryClient } from '@/core/api/query-client';
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

/**
 * Typed payload of the `OnCsatResponseRecorded` push to the
 * `supervisor:{tenantId}` group (csat-completion). Declared 1:1 with the frozen
 * golden fixture
 * `Verbara.Platform/openspec/changes/csat-completion/fixtures/csat-response-recorded-payload.v1.json`
 * (camelCase over the SignalR JSON protocol) — field names cited VERBATIM
 * (verbatim-fixture-citation rule). `comment` is nullable (voice DTMF captures
 * carry no free text); `channel` extends the enum with `voice`.
 */
interface CsatResponseRecordedPayload {
  tenantId: string;
  responseId: string;
  surveyId: string;
  conversationId: string;
  channel: string;
  queueName: string;
  rating: number;
  comment: string | null;
  capturedAt: string;
}

let connection: HubConnection | null = null;
let startPromise: Promise<void> | null = null;

/**
 * Registered server->client handlers, mirrored here so an opt-in E2E seam can
 * dispatch a push locally through the exact same handler the live hub uses.
 * Populated by `registerHandlers`; never used in the normal runtime path
 * (SignalR delivers directly to the connection's own registration).
 */
const localHandlers = new Map<string, (payload: unknown) => void>();

/**
 * OPT-IN E2E seam (never enabled by the app itself). When a test sets
 * `window.__verbaraE2E = true` BEFORE the hub starts, `startPlatformHub`
 * installs `window.__verbaraHub.emit(method, payload)`, letting a Playwright
 * spec fire a server push (e.g. `OnCsatResponseRecorded`) through the real
 * registered handler without a live backend. Absent the flag this is inert —
 * no global is defined, so it cannot affect production.
 */
interface E2eHubBridge {
  emit(method: string, payload: unknown): void;
}
function installE2eBridgeIfRequested(): void {
  const w = globalThis as unknown as {
    __verbaraE2E?: boolean;
    __verbaraHub?: E2eHubBridge;
  };
  if (w.__verbaraE2E !== true) return;
  w.__verbaraHub = {
    emit(method, payload) {
      localHandlers.get(method)?.(payload);
    },
  };
}

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

/**
 * Wires every server->client push method onto the connection. Exported for the
 * realtime handler tests (asserting, e.g., that `OnCsatResponseRecorded`
 * invalidates the aggregate CSAT query) — not part of the module's runtime API,
 * which drives registration through `startPlatformHub`.
 */
export function registerHandlers(conn: HubConnection) {
  const store = useRealtimeStore.getState();

  // Register on the live connection AND mirror into `localHandlers` so the
  // opt-in E2E bridge can dispatch the identical handler without a backend.
  const on = <T>(method: string, handler: (payload: T) => void): void => {
    conn.on(method, handler as (payload: unknown) => void);
    localHandlers.set(method, handler as (payload: unknown) => void);
  };

  on('OnPresenceUpdated', (payload: PresenceUpdatedPayload) => {
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

  on('OnSupervisionStarted', (payload: SupervisionStartedPayload) => {
    const notif: SupervisionStartedNotification = {
      conversationId: payload.conversationId,
      supervisorId: payload.supervisorId,
      mode: payload.mode,
      startedAt: payload.startedAt,
    };
    useRealtimeStore.getState().setObservedSupervision(notif);
  });

  on('OnWhisperReceived', (payload: WhisperReceivedPayload) => {
    const notif: WhisperNotification = {
      conversationId: payload.conversationId,
      text: payload.text,
      arrivedAt: payload.arrivedAt,
    };
    useRealtimeStore.getState().pushWhisper(notif);
  });

  // csat-completion (D3): a new CSAT response within the supervisor's scope
  // invalidates the scope-wide aggregate KPI query so the wallboard score
  // re-fetches the server-computed roll-up instead of waiting for the poll.
  // Pure enrichment — the card's TanStack-Query poll keeps the score correct
  // if this channel is down. We re-read the authoritative aggregate rather than
  // patch `averageRating` client-side (a single row cannot re-derive a
  // scope-wide windowed average). A `null` `comment` (voice DTMF) MUST NOT gate
  // the refresh, so the payload is intentionally unused beyond typing the wire.
  on('OnCsatResponseRecorded', (_payload: CsatResponseRecordedPayload) => {
    void queryClient.invalidateQueries({ queryKey: ['analytics', 'csat', 'aggregate'] });
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
    installE2eBridgeIfRequested();
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
  if (!connection)
    return () => {
      /* no-op; hub not initialized yet */
    };
  connection.on(method, handler);
  return () => connection?.off(method, handler);
}
