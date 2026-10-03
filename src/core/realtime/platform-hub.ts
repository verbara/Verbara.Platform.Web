import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { useAuthStore } from '@/core/auth/auth-store';
import { refreshAccessToken } from '@/core/api/client';
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
 * golden fixture `tests/fixtures/contracts/csat-response-recorded-payload.v1.json`
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

/**
 * The tail of the serialized start/stop chain (design D3). Every {@link startPlatformHub} and
 * {@link stopPlatformHub} runs after the previous one has settled, so a start can never meet a
 * connection that is still stopping. It never rejects: each caller gets its own operation's
 * outcome, and the chain only carries the ordering.
 */
let operations: Promise<void> = Promise.resolve();

/**
 * Set while a stop this module was asked for is in progress, so the close it causes is not mistaken
 * for one the server initiated (design D3, read by `onclose`):
 * - set only when the connection is not already `Disconnected` (a stop there fires no `onclose`, so
 *   a record set then would outlive the stop and mislabel the next session's first close);
 * - cleared when the stop settles (`HubConnection.stop()` resolves after `onclose` has run);
 * - reset by every start.
 */
let stopRequested = false;

/**
 * Set while the library's automatic reconnect loop is running, so `onclose` can tell a connection
 * that ran out of retries from one the server ended (design D5):
 * - set by `onreconnecting`;
 * - cleared by `onreconnected`, and by every start before it connects (so it is clear the moment a
 *   start succeeds, and a flag left over from an earlier exhausted loop never reaches a new
 *   connection's first close).
 */
let reconnecting = false;

/**
 * Thrown by {@link invokeHub} when the hub is not connected. A hub method call never starts the hub
 * (design D3): only the connection lifecycle does. The message is for logs, never for the UI.
 */
export class HubNotConnectedError extends Error {
  constructor(method: string) {
    super(`The realtime hub is not connected; '${method}' was not sent.`);
    this.name = 'HubNotConnectedError';
  }
}

function enqueue(operation: () => Promise<void>): Promise<void> {
  const result = operations.then(operation);
  operations = result.catch(() => undefined);
  return result;
}

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

/**
 * The token every (re)connect presents (design D4). The library calls this at each connect and
 * each automatic reconnect, so a reconnect always carries the token the console holds THEN, never
 * the one the connection was opened with.
 *
 * When that token has expired it refreshes first. That is the normal path at Platform's expiry
 * close, not an edge case: the proactive refresh is a no-op under Web Locks, so on a page that made
 * no API call in the token's last 30 s the token has expired when the close arrives. A failed
 * refresh throws, which fails this attempt and leaves the library's retry policy in charge; the
 * hub never connects with a token it knows is stale.
 *
 * During an impersonation it never refreshes: the refresh cookie is the operator's, and the shared
 * refresh path would install the operator's own token next to the impersonated tenant (the gap
 * design D5 keeps the session probe out of). It presents the impersonation token as held; when
 * that has expired the attempt is refused, and the impersonation's end restarts the hub under the
 * operator's own token.
 */
async function currentAccessToken(): Promise<string> {
  const auth = useAuthStore.getState();
  if (!auth.accessToken) {
    throw new Error('The realtime hub cannot connect without an access token.');
  }
  if (!auth.isTokenExpired() || auth.impersonation?.active) return auth.accessToken;

  const refreshed = await refreshAccessToken();
  const token = useAuthStore.getState().accessToken;
  if (!refreshed || !token) {
    throw new Error('The access token could not be refreshed; the hub connection attempt failed.');
  }
  return token;
}

function buildConnection(): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(HUB_URL, { accessTokenFactory: currentAccessToken })
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

  conn.onreconnecting(() => {
    reconnecting = true;
    store.setConnectionState('reconnecting');
  });
  conn.onreconnected(() => {
    reconnecting = false;
    store.setConnectionState('connected');
  });
  conn.onclose((error?: Error) => {
    switch (classifyClose(error)) {
      case 'requested':
        // The stop operation settles the store itself: its `reset()` writes `disconnected`.
        return;
      case 'exhausted':
        useRealtimeStore.getState().setConnectionState('disconnected');
        return;
      case 'server-ended':
        useRealtimeStore.getState().setConnectionState('ended');
        return;
    }
  });
}

type CloseKind = 'requested' | 'exhausted' | 'server-ended';

/**
 * Sorts a close by what the connection was doing when it closed, plus whether the close carries an
 * error (design D5). The close text is never read: Platform's revocation (`Abort()`) sends a bare
 * `Close` frame, which reaches `onclose` with no error, exactly like a client stop or exhausted
 * retries, so the error alone cannot carry the decision.
 *
 * - **Requested** (a stop this module was asked for is in progress): `disconnected`, written by the
 *   stop operation's own `reset()`.
 * - **Exhausted** (no error, and the reconnect loop was running): the library's own retries ran
 *   out. `disconnected`, which the bootstrap's revival heals at the next token refresh.
 * - **Server-ended** (every other close): `ended`, which the bootstrap resolves with a session
 *   probe. That is an established connection closed with or without an error (the revocation's
 *   bare frame, a refusal of an admitted connection), and any close that carries an error whatever
 *   the loop was doing: with automatic reconnect configured, only a server `Close` frame puts an
 *   error on `onclose` (a refusal processed in the same receive as a reconnect's handshake).
 *
 * This relies on the retry policy never declining the first attempt (the default
 * `withAutomaticReconnect()` policy); otherwise a transport loss would close from `Connected`
 * without `onreconnecting`.
 */
function classifyClose(error: Error | undefined): CloseKind {
  if (stopRequested) return 'requested';
  if (!error && reconnecting) return 'exhausted';
  return 'server-ended';
}

/**
 * Starts the hub, or does nothing when it is already connected, connecting or reconnecting. Runs on
 * the serialized chain (design D3), so it waits for any stop issued before it. The one
 * `HubConnection` is built on the first start and reused afterwards: SignalR allows `start()` again
 * once a connection is `Disconnected`, and the handlers registered on it (including every
 * {@link onHubEvent} subscription) survive.
 *
 * Only the connection lifecycle calls this (the bootstrap hook, and the single reconnect after a
 * session check); a hub method call never does.
 */
export function startPlatformHub(): Promise<void> {
  return enqueue(async () => {
    if (!connection) {
      connection = buildConnection();
      registerHandlers(connection);
      installE2eBridgeIfRequested();
    }
    const conn = connection;

    if (
      conn.state === HubConnectionState.Connected ||
      conn.state === HubConnectionState.Connecting ||
      conn.state === HubConnectionState.Reconnecting
    ) {
      return;
    }
    if (conn.state === HubConnectionState.Disconnecting) {
      // A close the server initiated is still in progress; the library's own stop() joins it
      // ("subsequent calls to stop() will await this"). Not a requested stop, so no record.
      await conn.stop().catch(() => undefined);
    }

    stopRequested = false;
    reconnecting = false;
    useRealtimeStore.getState().setConnectionState('connecting');
    try {
      await conn.start();
    } catch (err) {
      useRealtimeStore.getState().setConnectionState('failed');
      throw err;
    }
    useRealtimeStore.getState().setConnectionState(mapHubState(conn.state));
  });
}

/**
 * Stops the hub and resets the realtime store. Runs on the serialized chain (design D3), after any
 * start issued before it.
 */
export function stopPlatformHub(): Promise<void> {
  return enqueue(async () => {
    const conn = connection;
    if (!conn) return;
    if (conn.state !== HubConnectionState.Disconnected) stopRequested = true;
    try {
      await conn.stop();
    } finally {
      stopRequested = false;
      useRealtimeStore.getState().reset();
    }
  });
}

export function getPlatformHub(): HubConnection {
  if (!connection) {
    throw new Error('Platform hub is not initialized. Call startPlatformHub() first.');
  }
  return connection;
}

/**
 * Invokes a hub method on a CONNECTED hub. On any other state it rejects with a
 * {@link HubNotConnectedError} and starts nothing (design D3): a group join or leave on a dead
 * connection is moot, because the server drops group membership with the connection, and a
 * supervisor action reports its own translated failure.
 */
export async function invokeHub<T = void>(method: string, ...args: unknown[]): Promise<T> {
  const conn = connection;
  if (!conn || conn.state !== HubConnectionState.Connected) {
    throw new HubNotConnectedError(method);
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
