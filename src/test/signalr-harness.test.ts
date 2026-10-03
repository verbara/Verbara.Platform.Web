import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as signalr from '@microsoft/signalr';
import type { HubConnection } from '@microsoft/signalr';
import { hubServer, withInMemoryTransport } from './signalr-harness';

/**
 * Self-test of the in-memory SignalR harness (design D8). It drives the REAL `@microsoft/signalr`
 * `HubConnection` through the fake transport, and pins the library behaviour design D5 classifies
 * closes by:
 * - the revocation's bare `{"type":7}` fires `onclose()` with NO error;
 * - a refusal's `{"type":7,"error":…}` fires `onclose(error)`;
 * - the expiry close's `{"type":7,"allowReconnect":true}` and a dropped transport both fire
 *   `onreconnecting`;
 * - exhausted retries fire `onclose()` with no error.
 */

const { HubConnectionBuilder, HubConnectionState } = withInMemoryTransport(signalr);

const HUB_URL = '/hubs/platform';

interface Observed {
  conn: HubConnection;
  onclose: ReturnType<typeof vi.fn>;
  onreconnecting: ReturnType<typeof vi.fn>;
  onreconnected: ReturnType<typeof vi.fn>;
}

const built: HubConnection[] = [];
let currentToken = 'T1';

/** Builds a connection the way `platform-hub.ts` does, with every lifecycle callback observed. */
function buildObserved(): Observed {
  const conn = new HubConnectionBuilder()
    .withUrl(HUB_URL, { accessTokenFactory: () => currentToken })
    .withAutomaticReconnect()
    .configureLogging(signalr.LogLevel.Warning)
    .build();
  const onclose = vi.fn();
  const onreconnecting = vi.fn();
  const onreconnected = vi.fn();
  conn.onclose(onclose);
  conn.onreconnecting(onreconnecting);
  conn.onreconnected(onreconnected);
  built.push(conn);
  return { conn, onclose, onreconnecting, onreconnected };
}

async function connected(): Promise<Observed> {
  const observed = buildObserved();
  await observed.conn.start();
  expect(observed.conn.state).toBe(HubConnectionState.Connected);
  return observed;
}

describe('signalr-harness', () => {
  beforeEach(() => {
    hubServer.reset();
    currentToken = 'T1';
  });

  afterEach(async () => {
    hubServer.retryDelays = [0, 0, 0, 0];
    await Promise.all(built.splice(0).map((conn) => conn.stop().catch(() => undefined)));
    hubServer.reset();
  });

  it('Harness_ShouldConnectARealHubConnectionAndDeliverAnInvocation', async () => {
    const { conn } = buildObserved();
    const handler = vi.fn();
    conn.on('OnPresenceUpdated', handler);

    await conn.start();

    expect(conn.state).toBe(HubConnectionState.Connected);
    expect(hubServer.connectCount).toBe(1);
    expect(hubServer.handshakeRequests).toEqual([{ protocol: 'json', version: 1 }]);

    hubServer.pushInvocation('OnPresenceUpdated', { agentId: 'agent-1', state: 'available' });

    await vi.waitFor(() =>
      expect(handler).toHaveBeenCalledWith({ agentId: 'agent-1', state: 'available' }),
    );
  });

  it('Harness_ShouldRecordTheBearerOfEveryNegotiate', async () => {
    await connected();

    expect(hubServer.negotiations).toHaveLength(1);
    expect(hubServer.bearers).toEqual(['T1']);
    expect(hubServer.negotiations[0]?.url).toContain('/hubs/platform/negotiate');
  });

  it('Harness_ShouldCompleteAnInvokeAndRecordIt', async () => {
    const { conn } = await connected();

    await expect(conn.invoke('SubscribeToAgentPresenceAsync', 'agent-1')).resolves.toBeNull();

    expect(hubServer.invocations).toEqual([
      expect.objectContaining({
        target: 'SubscribeToAgentPresenceAsync',
        arguments: ['agent-1'],
      }),
    ]);
  });

  it('BareCloseFrame_ShouldFireOnCloseWithNoError_AndNoReconnect', async () => {
    const { conn, onclose, onreconnecting } = await connected();

    hubServer.pushRevocation();

    await vi.waitFor(() => expect(onclose).toHaveBeenCalledTimes(1));
    expect(onclose).toHaveBeenCalledWith(undefined);
    expect(onreconnecting).not.toHaveBeenCalled();
    expect(conn.state).toBe(HubConnectionState.Disconnected);
    expect(hubServer.negotiations).toHaveLength(1);
  });

  it('ErrorCloseFrame_ShouldFireOnCloseWithAnError_AndNoReconnect', async () => {
    const { conn, onclose, onreconnecting } = await connected();

    hubServer.pushRefusal('Connection closed with an error.');

    await vi.waitFor(() => expect(onclose).toHaveBeenCalledTimes(1));
    const error = onclose.mock.calls[0]?.[0];
    expect(error).toBeInstanceOf(Error);
    expect(onreconnecting).not.toHaveBeenCalled();
    expect(conn.state).toBe(HubConnectionState.Disconnected);
  });

  it('AllowReconnectCloseFrame_ShouldFireOnReconnecting_AndReconnectWithTheCurrentToken', async () => {
    const { conn, onclose, onreconnecting, onreconnected } = await connected();
    currentToken = 'T2';

    hubServer.pushExpiryClose();

    await vi.waitFor(() => expect(onreconnecting).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(onreconnected).toHaveBeenCalledTimes(1));
    expect(onclose).not.toHaveBeenCalled();
    expect(conn.state).toBe(HubConnectionState.Connected);
    expect(hubServer.bearers).toEqual(['T1', 'T2']);
  });

  it('DroppedTransport_ShouldFireOnReconnecting_AndReconnect', async () => {
    const { conn, onclose, onreconnecting, onreconnected } = await connected();

    hubServer.dropTransport();

    await vi.waitFor(() => expect(onreconnecting).toHaveBeenCalledTimes(1));
    expect(onreconnecting.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    await vi.waitFor(() => expect(onreconnected).toHaveBeenCalledTimes(1));
    expect(onclose).not.toHaveBeenCalled();
    expect(conn.state).toBe(HubConnectionState.Connected);
  });

  it('ExhaustedRetries_ShouldFireOnCloseWithNoError', async () => {
    hubServer.retryDelays = [0, 0, 0, 0];
    const { conn, onclose, onreconnecting, onreconnected } = await connected();
    hubServer.negotiateStatus = 503;

    hubServer.dropTransport();

    await vi.waitFor(() => expect(onclose).toHaveBeenCalledTimes(1));
    expect(onclose).toHaveBeenCalledWith(undefined);
    expect(onreconnecting).toHaveBeenCalledTimes(1);
    expect(onreconnected).not.toHaveBeenCalled();
    expect(conn.state).toBe(HubConnectionState.Disconnected);
    // The first connect plus four refused attempts — the default policy's attempt count.
    expect(hubServer.negotiations).toHaveLength(5);
  });

  it('DefaultRetryPolicy_ShouldUseTheLibraryDelays_WhenNoOverrideIsSet', () => {
    const policy = hubServer.createRetryPolicy();
    const delays = [0, 1, 2, 3, 4].map((previousRetryCount) =>
      policy.nextRetryDelayInMilliseconds({
        previousRetryCount,
        elapsedMilliseconds: 0,
        retryReason: new Error('test'),
      }),
    );

    expect(delays).toEqual([0, 2000, 10000, 30000, null]);
  });

  it('HandshakeAndCloseInOneReceive_ShouldRejectAFirstStart_WithoutOnClose', async () => {
    const { conn, onclose } = buildObserved();
    hubServer.queueHandshake({ kind: 'close', close: { error: 'Account is not active.' } });

    await expect(conn.start()).rejects.toThrow(/Account is not active\./);

    expect(onclose).not.toHaveBeenCalled();
    expect(conn.state).toBe(HubConnectionState.Disconnected);
  });

  it('HandshakeAndCloseInOneReceive_ShouldEndAReconnectAttempt_WithOnCloseError', async () => {
    const { conn, onclose, onreconnecting, onreconnected } = await connected();
    hubServer.queueHandshake({ kind: 'close', close: { error: 'Account is not active.' } });

    hubServer.dropTransport();

    await vi.waitFor(() => expect(onclose).toHaveBeenCalledTimes(1));
    expect(onreconnecting).toHaveBeenCalledTimes(1);
    expect(onreconnected).not.toHaveBeenCalled();
    expect(onclose.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect(conn.state).toBe(HubConnectionState.Disconnected);
  });

  it('Stop_ShouldLeaveTheConnectionDisconnectingAcrossAnAwait', async () => {
    const { conn } = await connected();

    const stopping = conn.stop();
    expect(conn.state).toBe(HubConnectionState.Disconnecting);

    await expect(conn.start()).rejects.toThrow(
      "Cannot start a HubConnection that is not in the 'Disconnected' state.",
    );
    await stopping;
    expect(conn.state).toBe(HubConnectionState.Disconnected);
    expect(hubServer.clientCloseCount).toBe(1);
  });

  it('ClientStop_ShouldFireOnCloseWithNoError', async () => {
    const { conn, onclose } = await connected();

    await conn.stop();

    expect(onclose).toHaveBeenCalledTimes(1);
    expect(onclose).toHaveBeenCalledWith(undefined);
    expect(conn.state).toBe(HubConnectionState.Disconnected);
  });

  it('StopOnADisconnectedConnection_ShouldResolveWithoutOnClose', async () => {
    const { conn, onclose } = buildObserved();
    hubServer.negotiateStatus = 503;
    await expect(conn.start()).rejects.toThrow();

    await conn.stop();

    expect(onclose).not.toHaveBeenCalled();
    expect(conn.state).toBe(HubConnectionState.Disconnected);
  });

  it('TransportStop_ShouldReportTheCloseAsynchronously', async () => {
    await connected();
    const transport = hubServer.transport;
    const libraryOnClose = transport.onclose;
    const onclose = vi.fn((error?: Error) => libraryOnClose?.(error));
    transport.onclose = onclose;

    const stopping = transport.stop();
    expect(transport.connected).toBe(false);
    expect(onclose).not.toHaveBeenCalled();

    await stopping;
    expect(onclose).toHaveBeenCalledTimes(1);
    expect(onclose).toHaveBeenCalledWith();
  });

  it('StopDelayMs_ShouldHoldTheDisconnectingWindowForThatLong', async () => {
    vi.useFakeTimers();
    try {
      hubServer.stopDelayMs = 500;
      const { conn } = await connected();

      const stopping = conn.stop();
      await vi.advanceTimersByTimeAsync(499);
      expect(conn.state).toBe(HubConnectionState.Disconnecting);

      await vi.advanceTimersByTimeAsync(1);
      await stopping;
      expect(conn.state).toBe(HubConnectionState.Disconnected);
    } finally {
      vi.useRealTimers();
    }
  });
});
