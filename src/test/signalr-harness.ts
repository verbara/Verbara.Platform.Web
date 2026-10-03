/**
 * In-memory SignalR server for Vitest (design D8 of the change
 * `a-suspended-account-is-visible-and-enforced-in-the-console`).
 *
 * It lets the REAL `@microsoft/signalr` `HubConnection` state machine run in jsdom: the library is
 * given a fake `HttpClient` (answers negotiate, records the bearer of every request) and a fake
 * `ITransport` (completes the JSON handshake, stops asynchronously, and lets a test push the server
 * frames Platform actually sends). Nothing about the library is mocked, so a test pins the library's
 * behaviour instead of encoding assumptions about it.
 *
 * Wiring, against an unmodified `platform-hub.ts` (a partial mock that only wraps `withUrl`):
 *
 * ```ts
 * vi.mock('@microsoft/signalr', async (importOriginal) => {
 *   const { withInMemoryTransport } = await import('@/test/signalr-harness');
 *   return withInMemoryTransport(await importOriginal<typeof import('@microsoft/signalr')>());
 * });
 * import { hubServer } from '@/test/signalr-harness';
 * ```
 *
 * This module imports nothing from `@microsoft/signalr` at runtime (types only): it is loaded from
 * inside that module's mock factory, where a value import would be circular. The real classes come
 * in through the `actual` module passed to {@link withInMemoryTransport}.
 *
 * Every hub connection built through the wrapper talks to the one {@link hubServer}. It lives on
 * `globalThis`, so a test file that calls `vi.resetModules()` still shares it with the module graph
 * the mock factory loads.
 */
import type * as SignalR from '@microsoft/signalr';
import type {
  HttpClient,
  HttpRequest,
  HttpResponse,
  IHttpConnectionOptions,
  IRetryPolicy,
  ITransport,
  RetryContext,
  TransferFormat,
} from '@microsoft/signalr';

type SignalRModule = typeof SignalR;

/** The JSON hub protocol's record separator. */
const RS = '\u001e';

/** `@microsoft/signalr`'s default `withAutomaticReconnect()` delays (0, 2, 10 and 30 seconds). */
export const LIBRARY_DEFAULT_RETRY_DELAYS: readonly number[] = [0, 2000, 10000, 30000];

/** Hub protocol message types this harness speaks (`IHubProtocol.MessageType`). */
const MessageType = {
  Invocation: 1,
  Completion: 3,
  Ping: 6,
  Close: 7,
} as const;

/** One HTTP request the library sent through the fake client. */
export interface RecordedRequest {
  method: string | undefined;
  url: string;
  /** The bearer token sent, or `null` when the request carried no `Authorization` header. */
  bearer: string | null;
}

/** A hub method the client invoked (`invoke` or `send`). */
export interface RecordedInvocation {
  target: string;
  arguments: unknown[];
  /** Present for `invoke` (the server must complete it), absent for `send`. */
  invocationId?: string;
}

/** A server `Close` frame. Both fields absent is the bare `{"type":7}` frame. */
export interface CloseFrame {
  error?: string;
  allowReconnect?: boolean;
}

/**
 * How the server answers the next handshake. `accept` sends the handshake response alone;
 * `close` sends the handshake response and a `Close` frame in ONE receive, which is how a refusal
 * from the hub's `OnConnectedAsync` can reach the client.
 */
export type HandshakeReply = { kind: 'accept' } | { kind: 'close'; close: CloseFrame };

/** Serializes a server `Close` frame exactly as ASP.NET Core SignalR's JSON protocol does. */
export function closeFrame(frame: CloseFrame = {}): string {
  const message: Record<string, unknown> = { type: MessageType.Close };
  if (frame.error !== undefined) message.error = frame.error;
  if (frame.allowReconnect === true) message.allowReconnect = true;
  return JSON.stringify(message) + RS;
}

/** Defers to a later microtask chain — never to a timer, so it behaves the same under fake timers. */
async function yieldMicrotasks(rounds = 3): Promise<void> {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}

function parseFrames(data: string): unknown[] {
  return data
    .split(RS)
    .filter((part) => part.length > 0)
    .map((part) => JSON.parse(part) as unknown);
}

function readBearer(request: HttpRequest): string | null {
  const header = request.headers?.Authorization ?? request.headers?.authorization;
  if (!header) return null;
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length) : header;
}

/**
 * The fake `ITransport` one hub connection uses for all of its (re)connects. SignalR keeps the
 * instance it was given in `withUrl`, so connect/stop may cycle many times on the same object.
 */
export class FakeTransport implements ITransport {
  onreceive: ((data: string | ArrayBuffer) => void) | null = null;
  onclose: ((error?: Error) => void) | null = null;

  /** Whether a transport-level connection is open right now. */
  connected = false;
  /** Every URL `connect` was called with, in order. */
  readonly connectUrls: string[] = [];

  private handshaken = false;
  private readonly server: FakeHubServer;

  constructor(server: FakeHubServer) {
    this.server = server;
  }

  async connect(url: string, _transferFormat: TransferFormat): Promise<void> {
    await yieldMicrotasks(1);
    this.connectUrls.push(url);
    if (this.server.transportConnectError) {
      throw this.server.transportConnectError;
    }
    this.handshaken = false;
    this.connected = true;
    this.server.connectCount++;
  }

  async send(data: unknown): Promise<void> {
    if (!this.connected) {
      throw new Error('FakeTransport: send on a closed transport.');
    }
    if (typeof data !== 'string') {
      throw new Error('FakeTransport: only the JSON (text) hub protocol is supported.');
    }
    for (const frame of parseFrames(data)) {
      if (!this.handshaken) {
        this.handshaken = true;
        this.server.handshakeRequests.push(frame);
        this.replyToHandshake(this.server.takeHandshakeReply());
        continue;
      }
      this.handleClientMessage(frame as Record<string, unknown>);
    }
  }

  /**
   * Closes the transport asynchronously: the connection stays `Disconnecting` across the deferral,
   * which is the window a start racing a stop runs into. `onclose` fires with no error, as a
   * client-initiated close does.
   */
  async stop(): Promise<void> {
    if (!this.connected) return;
    this.connected = false;
    const delay = this.server.stopDelayMs;
    if (delay === undefined) {
      await yieldMicrotasks();
    } else {
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
    this.onclose?.();
  }

  /** Delivers raw text to the client as one receive. */
  deliver(text: string): void {
    if (!this.connected) {
      throw new Error('FakeTransport: cannot deliver to a closed transport.');
    }
    this.onreceive?.(text);
  }

  /** Cuts the transport without any frame, as a network loss does. */
  drop(error: Error = new Error('FakeTransport: transport dropped.')): void {
    if (!this.connected) {
      throw new Error('FakeTransport: cannot drop a closed transport.');
    }
    this.connected = false;
    this.onclose?.(error);
  }

  private replyToHandshake(reply: HandshakeReply): void {
    const text = reply.kind === 'close' ? `{}${RS}${closeFrame(reply.close)}` : `{}${RS}`;
    void Promise.resolve().then(() => {
      if (this.connected) this.onreceive?.(text);
    });
  }

  private handleClientMessage(message: Record<string, unknown>): void {
    switch (message.type) {
      case MessageType.Ping:
        this.server.clientPingCount++;
        if (this.server.echoPings)
          this.deferDeliver(JSON.stringify({ type: MessageType.Ping }) + RS);
        break;
      case MessageType.Invocation: {
        const invocation: RecordedInvocation = {
          target: String(message.target),
          arguments: Array.isArray(message.arguments) ? (message.arguments as unknown[]) : [],
          ...(typeof message.invocationId === 'string' && { invocationId: message.invocationId }),
        };
        this.server.invocations.push(invocation);
        if (invocation.invocationId !== undefined && this.server.completeInvocations) {
          this.deferDeliver(
            JSON.stringify({
              type: MessageType.Completion,
              invocationId: invocation.invocationId,
              result: null,
            }) + RS,
          );
        }
        break;
      }
      case MessageType.Close:
        this.server.clientCloseCount++;
        break;
      default:
        break;
    }
  }

  private deferDeliver(text: string): void {
    void Promise.resolve().then(() => {
      if (this.connected) this.onreceive?.(text);
    });
  }
}

/** The single in-memory server every wrapped hub connection talks to. */
export class FakeHubServer {
  /** Every HTTP request the library sent, negotiate included. */
  readonly requests: RecordedRequest[] = [];
  /** Every handshake request the client sent (one per transport connect that got that far). */
  readonly handshakeRequests: unknown[] = [];
  /** Every hub method the client invoked or sent. */
  readonly invocations: RecordedInvocation[] = [];
  /** Every transport built by the wrapper, oldest first (one per hub connection). */
  readonly transports: FakeTransport[] = [];

  /** Successful transport connects so far. */
  connectCount = 0;
  /** Pings the client sent. */
  clientPingCount = 0;
  /** `Close` messages the client sent (a client `stop()` on a connected hub sends one). */
  clientCloseCount = 0;

  /** HTTP status negotiate answers with; anything but 200 fails the (re)connect attempt. */
  negotiateStatus = 200;
  /** When set, `transport.connect` rejects with it (after negotiate succeeded). */
  transportConnectError: Error | null = null;
  /** Answer each client ping with a ping, so a connected hub survives fake-timer advances. */
  echoPings = true;
  /** Complete every `invoke` with a `null` result. */
  completeInvocations = true;
  /**
   * Delay of `transport.stop()`, in ms. `undefined` (the default) defers by microtasks only, which
   * still leaves the connection `Disconnecting` across an `await` and works under fake timers.
   */
  stopDelayMs: number | undefined = undefined;
  /**
   * Retry delays the reconnect loop uses when the app calls `withAutomaticReconnect()` with no
   * argument. `undefined` means the library default ({@link LIBRARY_DEFAULT_RETRY_DELAYS}); a test
   * may shorten the delays but should keep the same shape (the first attempt is never declined).
   * Read at every retry, so it can be changed after the connection was built.
   */
  retryDelays: readonly number[] | undefined = undefined;

  private readonly handshakeReplies: HandshakeReply[] = [];
  private negotiateCount = 0;

  /** Every negotiate request, in order. */
  get negotiations(): RecordedRequest[] {
    return this.requests.filter((r) => r.url.includes('/negotiate'));
  }

  /** The bearer of every negotiate request, in order (`null` = no `Authorization` header). */
  get bearers(): (string | null)[] {
    return this.negotiations.map((r) => r.bearer);
  }

  /** The transport of the most recently built hub connection. */
  get transport(): FakeTransport {
    const latest = this.transports.at(-1);
    if (!latest) throw new Error('FakeHubServer: no hub connection has been built yet.');
    return latest;
  }

  /** Queues the answer to a coming handshake; unqueued handshakes are accepted. */
  queueHandshake(reply: HandshakeReply): void {
    this.handshakeReplies.push(reply);
  }

  /** @internal Used by {@link FakeTransport}. */
  takeHandshakeReply(): HandshakeReply {
    return this.handshakeReplies.shift() ?? { kind: 'accept' };
  }

  /** Pushes a server-to-client invocation (a hub push such as `OnPresenceUpdated`). */
  pushInvocation(target: string, ...args: unknown[]): void {
    this.transport.deliver(
      JSON.stringify({ type: MessageType.Invocation, target, arguments: args }) + RS,
    );
  }

  /** Pushes a `Close` frame. With no argument it is the bare `{"type":7}`. */
  pushClose(frame: CloseFrame = {}): void {
    this.transport.deliver(closeFrame(frame));
  }

  /** The frame Platform's revocation (`Abort()`) produces: bare `{"type":7}`. */
  pushRevocation(): void {
    this.pushClose();
  }

  /** The frame a refusal from the hub's `OnConnectedAsync` produces: `{"type":7,"error":…}`. */
  pushRefusal(
    error = 'Connection closed with an error. HubException: Account is not active.',
  ): void {
    this.pushClose({ error });
  }

  /** The frame Platform's close at token expiry produces: `{"type":7,"allowReconnect":true}`. */
  pushExpiryClose(): void {
    this.pushClose({ allowReconnect: true });
  }

  /** Delivers arbitrary text as one receive. */
  pushRaw(text: string): void {
    this.transport.deliver(text);
  }

  /** Cuts the transport without any frame, which drives the library's reconnect loop. */
  dropTransport(error?: Error): void {
    this.transport.drop(error);
  }

  /** Forgets every record and restores the defaults. Existing transports keep working. */
  reset(): void {
    this.requests.length = 0;
    this.handshakeRequests.length = 0;
    this.invocations.length = 0;
    this.handshakeReplies.length = 0;
    this.connectCount = 0;
    this.clientPingCount = 0;
    this.clientCloseCount = 0;
    this.negotiateStatus = 200;
    this.transportConnectError = null;
    this.echoPings = true;
    this.completeInvocations = true;
    this.stopDelayMs = undefined;
    this.retryDelays = undefined;
  }

  /** @internal The fake `HttpClient` handed to every wrapped connection. */
  createHttpClient(): HttpClient {
    const client = {
      send: async (request: HttpRequest): Promise<HttpResponse> => {
        await yieldMicrotasks(1);
        const url = request.url ?? '';
        this.requests.push({ method: request.method, url, bearer: readBearer(request) });
        if (!url.includes('/negotiate')) {
          return { statusCode: 404, statusText: 'Not Found', content: '' } as HttpResponse;
        }
        if (this.negotiateStatus !== 200) {
          return {
            statusCode: this.negotiateStatus,
            statusText: 'Negotiate refused',
            content: '',
          } as HttpResponse;
        }
        this.negotiateCount++;
        return {
          statusCode: 200,
          statusText: 'OK',
          content: JSON.stringify({
            negotiateVersion: 1,
            connectionId: `connection-${this.negotiateCount}`,
            connectionToken: `token-${this.negotiateCount}`,
            availableTransports: [{ transport: 'WebSockets', transferFormats: ['Text', 'Binary'] }],
          }),
        } as HttpResponse;
      },
      getCookieString: () => '',
    };
    // The library only ever calls `send` and `getCookieString` on the inner client
    // (`AccessTokenHttpClient` wraps it and owns get/post/delete).
    return client as unknown as HttpClient;
  }

  /** @internal Builds the transport for one hub connection. */
  createTransport(): FakeTransport {
    const transport = new FakeTransport(this);
    this.transports.push(transport);
    return transport;
  }

  /** @internal The retry policy substituted for a no-argument `withAutomaticReconnect()`. */
  createRetryPolicy(): IRetryPolicy {
    return {
      nextRetryDelayInMilliseconds: (context: RetryContext) => {
        const delays = this.retryDelays ?? LIBRARY_DEFAULT_RETRY_DELAYS;
        return delays[context.previousRetryCount] ?? null;
      },
    };
  }
}

const GLOBAL_KEY = '__verbaraFakeHubServer';
const globalSlot = globalThis as unknown as Record<string, FakeHubServer | undefined>;

/** The shared in-memory server (one per Vitest worker). */
export const hubServer: FakeHubServer = (globalSlot[GLOBAL_KEY] ??= new FakeHubServer());

/**
 * Returns `actual` with `HubConnectionBuilder` replaced by a subclass whose `withUrl` injects the
 * fake `HttpClient` and `ITransport`. Everything else is the real library:
 * - `withUrl` keeps every option the app passes (its `accessTokenFactory` included).
 * - A no-argument `withAutomaticReconnect()` gets a policy with the library's default delays,
 *   read from {@link FakeHubServer.retryDelays} at every retry so a test can shorten them.
 * - `configureLogging` is silenced; logging is not behaviour, and the library would print every
 *   expected failure.
 */
export function withInMemoryTransport<T extends SignalRModule>(actual: T): T {
  const server = hubServer;
  class InMemoryHubConnectionBuilder extends actual.HubConnectionBuilder {
    override withUrl(
      url: string,
      transportTypeOrOptions?: IHttpConnectionOptions | SignalR.HttpTransportType,
    ): SignalR.HubConnectionBuilder {
      const options: IHttpConnectionOptions =
        typeof transportTypeOrOptions === 'object' ? transportTypeOrOptions : {};
      // Under Vitest the library detects Node (not a browser) and refuses a relative URL such as
      // `/hubs/platform`; resolve it against jsdom's origin, as a browser would.
      return super.withUrl(new URL(url, globalThis.location?.href ?? 'http://localhost/').href, {
        ...options,
        httpClient: server.createHttpClient(),
        transport: server.createTransport(),
      });
    }

    override withAutomaticReconnect(
      retryDelaysOrReconnectPolicy?: number[] | IRetryPolicy,
    ): SignalR.HubConnectionBuilder {
      if (retryDelaysOrReconnectPolicy === undefined) {
        return super.withAutomaticReconnect(server.createRetryPolicy());
      }
      if (Array.isArray(retryDelaysOrReconnectPolicy)) {
        return super.withAutomaticReconnect(retryDelaysOrReconnectPolicy);
      }
      return super.withAutomaticReconnect(retryDelaysOrReconnectPolicy);
    }

    override configureLogging(
      _logging: SignalR.LogLevel | string | SignalR.ILogger,
    ): SignalR.HubConnectionBuilder {
      return super.configureLogging(actual.LogLevel.None);
    }
  }
  return { ...actual, HubConnectionBuilder: InMemoryHubConnectionBuilder } as T;
}
