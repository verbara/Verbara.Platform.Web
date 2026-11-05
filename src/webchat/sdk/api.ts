import { createBubble, type BubbleHandle } from './bubble';
import { createIframeLoader, type IframeLoaderHandle } from './iframe-loader';
import { createPostMessageBridge, type BridgeHandle } from './postmessage-bridge';
import { buildEmbedUrl, resolveEmbedOrigin } from './embed-origin';
import {
  FORGET_TIMEOUT_MS,
  requestForgetVisitor,
  type ForgetVisitorPayload,
} from './forget-visitor';
import {
  getOrCreateVisitorId,
  getVisitorProfile,
  hasVisitorId,
  readVisitorId,
  setVisitorProfile,
  resetVisitor,
  type VisitorProfile,
} from './visitor-storage';
import {
  canRecordSubject,
  decideForget,
  readExternalId,
  readSubjectRecord,
  subjectMac,
  subjectRecordKey,
  writeSubjectRecord,
  type IdentityCall,
  type TokenStatement,
} from './visitor-subject';

/**
 * Server-issued CSAT survey context. When the host supplies this (the
 * `responseToken` is an opaque, signed capture token minted server-side), the
 * embed offers the post-conversation rating panel (csat-runner 2.2). The panel
 * echoes these six fields verbatim and adds only `rating` / `comment` /
 * `capturedAt`.
 */
export interface CsatConfig {
  responseToken: string;
  surveyId: string;
  questionId: string;
  channel: string;
  queueName: string;
  conversationId: string;
}

export interface InitConfig {
  tenantId: string;
  apiBase?: string;
  locale?: 'auto' | 'en-US' | 'es-419' | 'pt-BR';
  theme?: { primaryColor?: string; fontFamily?: string };
  position?: 'bottom-right' | 'bottom-left';
  greeting?: string;
  visitor?: { name?: string; email?: string };
  /** Optional server-issued CSAT survey context; enables the rating panel. */
  csat?: CsatConfig;
  /**
   * The token the site signed for its signed-in customer. A string signs in, `null` signs out. It stays in memory and
   * is never stored. It is not read from the script tag: pass it from the site's own script.
   */
  identityToken?: string | null;
}

/** A partial update. An omitted `identityToken` leaves the token as it is. */
export interface VisitorUpdate {
  name?: string;
  email?: string;
  identityToken?: string | null;
}

/** What Platform answered about the visitor when the session was created. */
export interface IdentityOutcome {
  identityLevel: string;
  identityTokenRefusal?: string;
}

type EventName =
  'open' | 'close' | 'unread' | 'message-sent' | 'message-received' | 'ready' | 'identity';
type Handler = (payload?: unknown) => void;

const WARN_OMITTED =
  'VerbaraWebChat: the widget state was forgotten because a signed-in visitor was last seen and no identityToken was ' +
  'passed. Pass the token on every signed-in page, and null (or destroy()) on sign-out.';
const WARN_UNREADABLE =
  'VerbaraWebChat: the identityToken payload could not be read, so the widget state of the previously signed-in ' +
  'visitor was forgotten.';
const WARN_INSECURE =
  'VerbaraWebChat: this page is not served over https, so the widget cannot tell when the signed-in visitor changes. ' +
  'Visitor identity verification requires https.';
const WARN_UNSTORED =
  'VerbaraWebChat: the browser could not store which signed-in visitor this is, so the widget treats the visitor as ' +
  'unknown.';

interface InternalState {
  config: InitConfig | null;
  bubble: BubbleHandle | null;
  iframe: IframeLoaderHandle | null;
  bridge: BridgeHandle | null;
  /** Origin of the widget's frame, its API and its socket; every message to the frame targets it. */
  embedOrigin: string | null;
  isOpen: boolean;
  unreadCount: number;
  handlers: Map<EventName, Set<Handler>>;
  outboundQueue: Array<{ type: string; payload?: unknown }>;
  /**
   * The previous widget's frame while it is still forgetting, settled once that frame is gone. The next widget's frame
   * is created only after it settles: frames of one embed origin share storage, and the clear is tenant-wide. A decision
   * about the token still being worked out holds here too, so nothing reads the visitor id before it is taken.
   */
  forgetting: Promise<void> | null;
  /** Held here only. Sent to the frame in `init-config` and `set-visitor`, and never stored. */
  identityToken: string | null;
  /**
   * The customer this tab's widget runs under, in memory. All tabs share the stored record, and each has its own widget,
   * socket and messages, so a tab decides what to discard by this and not by the record.
   */
  ownSubject: string | null;
  /** The visitor from this page's `init`. Dropped when that customer is no longer the one this tab runs. */
  siteVisitor: InitConfig['visitor'];
  /** A widget has been started on this page, so what it runs has to be ended when the customer changes. */
  widgetStarted: boolean;
  /** The visitor id the current frame got in its config, which is what it holds storage under. */
  widgetVisitorId: string | null;
  /** The next frame's config asks for a session now: the visitor was chatting, and the site signed a customer in. */
  startSession: boolean;
  /**
   * Another tab changed the customer and the site has said nothing here since. The stored profile is that tab's, and a
   * complete one would start a session with no form: this tab waits for the site, or for the visitor to fill the form.
   */
  awaitingSite: boolean;
  insecureWarned: boolean;
}

export interface WebChatApi {
  init(config: InitConfig): void;
  open(): void;
  close(): void;
  sendMessage(text: string): void;
  setVisitor(update: VisitorUpdate): void;
  on(event: EventName, handler: Handler): void;
  off(event: EventName, handler: Handler): void;
  /**
   * Removes the widget and forgets the visitor: the id and profile on the host page at once, and the conversation
   * the widget kept in its frame's storage before the frame is removed. Resolves once the frame is gone.
   */
  destroy(): Promise<void>;
}

export interface WebChatApiOptions {
  /** URL the SDK script was loaded from; the frame is loaded from its origin, not the host page's (#426). */
  scriptSrc?: string | null;
  /** How long `destroy()` waits for the frame to confirm it cleared the conversation. Default 2 seconds. */
  forgetTimeoutMs?: number;
}

export function createWebChatApi(options: WebChatApiOptions = {}): WebChatApi {
  const state: InternalState = {
    config: null,
    bubble: null,
    iframe: null,
    bridge: null,
    embedOrigin: null,
    isOpen: false,
    unreadCount: 0,
    handlers: new Map(),
    outboundQueue: [],
    forgetting: null,
    identityToken: null,
    ownSubject: null,
    siteVisitor: undefined,
    widgetStarted: false,
    widgetVisitorId: null,
    startSession: false,
    awaitingSite: false,
    insecureWarned: false,
  };

  function emit(event: EventName, payload?: unknown) {
    const set = state.handlers.get(event);
    if (set) for (const h of set) h(payload);
  }

  function ensureIframeBridge() {
    if (state.bridge) return;
    if (!state.config || !state.iframe || !state.embedOrigin) return;
    state.widgetStarted = true;
    const iframe = state.iframe;
    const frameWindow = () => iframe.getIframe()?.contentWindow ?? null;
    state.bridge = createPostMessageBridge({
      target: frameWindow,
      targetOrigin: state.embedOrigin,
      expectedSourceOrigin: state.embedOrigin,
      // Only this widget's own frame: a previous frame of the same origin still forgetting must not reach it.
      expectedSource: frameWindow,
      side: 'host',
    });
    const bridge = state.bridge;
    const sendConfig = () => {
      // A decision that was pending may have replaced this frame.
      if (state.bridge !== bridge) return;
      const guest = isGuest(state.config!.tenantId);
      const visitorId = guest ? crypto.randomUUID() : getOrCreateVisitorId(state.config!.tenantId);
      const startSession = state.startSession;
      state.widgetVisitorId = visitorId;
      state.startSession = false;
      // Send config + visitor info to iframe
      state.bridge.send('init-config', {
        tenantId: state.config!.tenantId,
        apiBase: state.config!.apiBase,
        locale: state.config!.locale,
        theme: state.config!.theme,
        greeting: state.config!.greeting,
        visitorId,
        visitor: state.awaitingSite
          ? undefined
          : (getVisitorProfile(state.config!.tenantId) ?? state.siteVisitor),
        pageContext: {
          url: globalThis.location.href,
          title: document.title,
          referrer: document.referrer,
        },
        ...(state.config!.csat ? { csat: state.config!.csat } : {}),
        ...(state.identityToken ? { identityToken: state.identityToken } : {}),
        ...(startSession ? { startSession } : {}),
        ...(guest ? { guest } : {}),
      });
      // Flush queued outbound messages
      while (state.outboundQueue.length > 0) {
        const msg = state.outboundQueue.shift()!;
        state.bridge!.send(msg.type, msg.payload);
      }
      emit('ready');
    };
    state.bridge.on('ready', () => whenSettled(sendConfig));
    state.bridge.on('unread', (payload) => {
      const count = typeof payload === 'number' ? payload : 0;
      state.unreadCount = count;
      state.bubble?.setUnreadCount(count);
      emit('unread', count);
    });
    state.bridge.on('message-sent', (p) => emit('message-sent', p));
    state.bridge.on('message-received', (p) => emit('message-received', p));
    state.bridge.on('visitor-updated', (p) => {
      // A guest's form speaks for that tab alone: the stored profile is the customer's.
      if (state.config && typeof p === 'object' && p !== null && !isGuest(state.config.tenantId)) {
        storeProfile(state.config.tenantId, p as { name?: string; email?: string });
      }
    });
    state.bridge.on('session-identity', reportIdentity);
  }

  /**
   * A tab with no customer of its own while the browser has one, which only a discard leaves: everything the frame keeps
   * under the shared visitor id is that customer's, so this tab's widget runs under an id of its own and keeps nothing.
   */
  function isGuest(tenantId: string): boolean {
    if (state.ownSubject !== null) return false;
    try {
      return readSubjectRecord(tenantId) !== null;
    } catch {
      return false;
    }
  }

  /** Full storage must not stop what the site asked for: the profile then lives in this page's memory only. */
  function storeProfile(tenantId: string, profile: VisitorProfile): void {
    try {
      setVisitorProfile(tenantId, profile);
    } catch {
      // Sent from `siteVisitor`, which holds it too.
    }
  }

  /** The SDK only passes on what Platform answered; the code alone goes to the console, never the token. */
  function reportIdentity(payload: unknown) {
    if (typeof payload !== 'object' || payload === null) return;
    const { identityLevel, identityTokenRefusal } = payload as Record<string, unknown>;
    if (typeof identityLevel !== 'string') return;
    const refusal = typeof identityTokenRefusal === 'string' ? identityTokenRefusal : undefined;
    if (refusal) console.warn(`VerbaraWebChat: the identity token was refused: ${refusal}`);
    const outcome: IdentityOutcome = {
      identityLevel,
      ...(refusal ? { identityTokenRefusal: refusal } : {}),
    };
    emit('identity', outcome);
  }

  function createFrameLoader(config: InitConfig, embedOrigin: string): IframeLoaderHandle {
    return createIframeLoader({
      src: buildEmbedUrl(embedOrigin, {
        tenantId: config.tenantId,
        locale: config.locale,
        hostOrigin: globalThis.location.origin,
      }),
      position: config.position ?? 'bottom-right',
    });
  }

  function hold(settling: Promise<void>): void {
    state.forgetting = settling;
    void settling.then(() => {
      if (state.forgetting === settling) state.forgetting = null;
    });
  }

  /** Runs `then` once nothing is settling: what settles may start something else that has to settle. */
  function whenSettled(then: () => void): void {
    if (state.forgetting) void state.forgetting.then(() => whenSettled(then));
    else then();
  }

  /** Runs `step` once what is settling has settled, or now when nothing is. */
  function afterSettling(step: () => void): void {
    // What is held must settle, or the widget never opens and destroy() never forgets.
    if (state.forgetting) hold(state.forgetting.then(step).catch(() => {}));
    else step();
  }

  /** Ends what this page's widget runs and readies a new frame, shown under the same ordering as a forget. */
  function replaceWidget(clear: ForgetVisitorPayload | null): void {
    const { config, iframe, embedOrigin } = state;
    if (!config || !iframe || !embedOrigin) return;
    state.startSession = state.widgetStarted && Boolean(state.identityToken?.trim());
    state.bridge?.destroy();
    state.bridge = null;
    state.widgetVisitorId = null;
    state.outboundQueue.length = 0;
    iframe.hide();
    state.iframe = createFrameLoader(config, embedOrigin);
    if (clear) forgetThenRemove(clear, iframe, embedOrigin);
    else iframe.destroy();
    if (state.isOpen) reveal(config);
  }

  /** The widget runs under an id that is no longer the one all tabs share. */
  function runsUnderOtherId(tenantId: string): boolean {
    return state.widgetVisitorId !== null && state.widgetVisitorId !== readVisitorId(tenantId);
  }

  /** What ending this tab's widget has to clear: only what its own id holds, and nothing under the shared id. */
  function ownClear(tenantId: string): ForgetVisitorPayload | null {
    return runsUnderOtherId(tenantId) ? { tenantId, visitorId: state.widgetVisitorId! } : null;
  }

  /**
   * This tab's widget is no longer the customer's. What another tab started on the same storage stays, and so does what
   * the visitor this tab moves to holds: a widget already under the shared visitor id has nothing to clear.
   */
  function discardWidget(config: InitConfig): void {
    replaceWidget(ownClear(config.tenantId));
  }

  /** A browser that will not store the record leaves no customer known, and no stale one on the record. */
  function treatSubjectAsUnknown(): void {
    state.ownSubject = null;
    console.warn(WARN_UNSTORED);
  }

  function recordSubject(tenantId: string, subject: string | null): void {
    try {
      writeSubjectRecord(tenantId, subject);
    } catch {
      treatSubjectAsUnknown();
      try {
        writeSubjectRecord(tenantId, null);
      } catch {
        // The storage is out of reach altogether: there is no record to correct.
      }
    }
  }

  /** Applies what the site said about the token, in the order it said it. */
  function applyIdentity(
    config: InitConfig,
    call: IdentityCall,
    token: string | null | undefined,
    profile: InitConfig['visitor'],
  ): void {
    const insecure = () => {
      if (token && !state.insecureWarned) {
        state.insecureWarned = true;
        console.warn(WARN_INSECURE);
      }
      if (call === 'setVisitor') state.bridge?.send('set-visitor', { identityToken: token });
    };
    if (!canRecordSubject()) {
      insecure();
      return;
    }
    const decide = (statement: TokenStatement) => {
      if (state.config !== config) return;
      try {
        settleIdentity(config, call, token, statement, profile);
      } catch {
        // What is held on this decision must settle, or the widget never opens and destroy() never forgets. The subject
        // stands: only a record that cannot be read or written makes it unknown, and those are handled where they fail.
      }
    };
    const externalId = token ? readExternalId(token) : null;
    if (externalId !== null) {
      hold(
        (state.forgetting ?? Promise.resolve())
          .then(() => subjectMac(config.tenantId, externalId))
          .then(
            (subject) => decide({ kind: 'subject', subject }),
            () => {
              if (state.config === config) insecure();
            },
          ),
      );
      return;
    }
    const kind = token === undefined ? 'omitted' : token === null ? 'signed-out' : 'unreadable';
    afterSettling(() => decide({ kind }));
  }

  function settleIdentity(
    config: InitConfig,
    call: IdentityCall,
    token: string | null | undefined,
    statement: TokenStatement,
    profile: InitConfig['visitor'],
  ): void {
    const tenantId = config.tenantId;
    let recorded: string | null;
    try {
      recorded = readSubjectRecord(tenantId);
    } catch {
      treatSubjectAsUnknown();
      return;
    }
    const decision = decideForget(recorded, statement, hasVisitorId(tenantId), call);
    const subject = statement.kind === 'subject' ? statement.subject : null;
    const own = state.ownSubject;
    const differs = statement.kind !== 'omitted' && subject !== own;
    if (decision.forget || statement.kind !== 'omitted') state.ownSubject = subject;
    if (call === 'setVisitor')
      state.siteVisitor = decision.forget || differs ? profile : state.siteVisitor;

    if (decision.forget) {
      resetVisitor(tenantId);
      recordSubject(tenantId, decision.record);
      replaceWidget({ tenantId });
      if (profile) storeProfile(tenantId, profile);
    } else {
      recordSubject(tenantId, decision.record);
      if (differs && state.widgetStarted) discardWidget(config);
      else if (call === 'setVisitor') state.bridge?.send('set-visitor', { identityToken: token });
    }

    const signedInBefore = own !== null && differs;
    if (decision.warning === 'omitted') console.warn(WARN_OMITTED);
    else if (
      decision.warning === 'unreadable' ||
      (statement.kind === 'unreadable' && signedInBefore)
    )
      console.warn(WARN_UNREADABLE);
  }

  /**
   * Another tab wrote the record. Unless it is this tab's customer, this tab's customer is gone. A tab with no customer
   * compares equal to an empty record, so it also goes when the id it runs under was reset.
   */
  function onStorage(event: StorageEvent): void {
    const config = state.config;
    if (!config) return;
    if (event.key !== null && event.key !== subjectRecordKey(config.tenantId)) return;
    afterSettling(() => {
      if (state.config !== config) return;
      const own = state.ownSubject;
      const unchanged = readSubjectRecord(config.tenantId) === own;
      if (unchanged && (own !== null || !runsUnderOtherId(config.tenantId))) return;
      state.identityToken = null;
      state.ownSubject = null;
      state.siteVisitor = undefined;
      state.awaitingSite = true;
      if (state.widgetStarted) discardWidget(config);
    });
  }

  function toggleOpen() {
    if (state.isOpen) close();
    else open();
  }

  function init(config: InitConfig): void {
    if (!config.tenantId) {
      throw new Error('VerbaraWebChat: tenantId is required');
    }
    if (state.config) {
      const externalId = config.identityToken ? readExternalId(config.identityToken) : null;
      // A token naming a customer is settled by the table against the record all tabs share, below: this tab may hold no
      // token of the customer it is told about, and a newer token of the customer who is signed in forgets nothing. A
      // page with no record to read has only the token it holds.
      const decidedBelow =
        externalId !== null &&
        state.config.tenantId === config.tenantId &&
        (canRecordSubject() ||
          (state.identityToken !== null && readExternalId(state.identityToken) === externalId));
      if (decidedBelow) {
        const { iframe, embedOrigin } = state;
        const clear = ownClear(config.tenantId);
        tearDown();
        iframe?.hide();
        if (clear && iframe && embedOrigin) void forgetThenRemove(clear, iframe, embedOrigin);
        else iframe?.destroy();
      } else {
        // Already initialized — destroy and re-init
        void destroy();
      }
    }
    state.config = config;
    state.identityToken = config.identityToken ?? null;
    state.siteVisitor = config.visitor;
    if (config.visitor) storeProfile(config.tenantId, config.visitor);

    state.bubble = createBubble({
      position: config.position ?? 'bottom-right',
      primaryColor: config.theme?.primaryColor ?? '#0d9488',
      onToggle: toggleOpen,
    });

    state.embedOrigin = resolveEmbedOrigin({
      scriptSrc: options.scriptSrc,
      apiBase: config.apiBase,
      pageHref: globalThis.location.href,
    });
    state.iframe = createFrameLoader(config, state.embedOrigin);
    globalThis.addEventListener('storage', onStorage);
    applyIdentity(config, 'init', config.identityToken, config.visitor);
  }

  function open(): void {
    if (!state.config || !state.iframe) return;
    state.isOpen = true;
    state.bubble?.setOpen(true);
    reveal(state.config);
    emit('open');
  }

  function reveal(config: InitConfig): void {
    const showFrame = () => {
      // The widget may have been closed or destroyed while the previous frame was forgetting.
      if (state.config !== config || !state.iframe || !state.isOpen) return;
      state.iframe.show();
      ensureIframeBridge();
      state.bridge?.send('open');
    };
    whenSettled(showFrame);
  }

  function close(): void {
    if (!state.iframe) return;
    state.iframe.hide();
    state.isOpen = false;
    state.bubble?.setOpen(false);
    state.bridge?.send('close');
    emit('close');
  }

  function sendMessage(text: string): void {
    if (!state.bridge) {
      state.outboundQueue.push({ type: 'send-message', payload: { text } });
      return;
    }
    state.bridge.send('send-message', { text });
  }

  /** Takes its turn behind what is settling, so a step queued before this call cannot undo what it says. */
  function setVisitor(update: VisitorUpdate): void {
    const config = state.config;
    if (!config) return;
    afterSettling(() => {
      if (state.config === config) applyVisitorUpdate(config, update);
    });
  }

  function applyVisitorUpdate(config: InitConfig, update: VisitorUpdate): void {
    state.awaitingSite = false;
    const { identityToken, ...profile } = update;
    if (identityToken === undefined || Object.keys(profile).length > 0) {
      storeProfile(config.tenantId, profile);
      state.bridge?.send('set-visitor', profile);
    }
    if (identityToken === undefined) return;
    state.identityToken = identityToken;
    applyIdentity(
      config,
      'setVisitor',
      identityToken,
      Object.keys(profile).length > 0 ? profile : undefined,
    );
  }

  function on(event: EventName, handler: Handler): void {
    if (!state.handlers.has(event)) state.handlers.set(event, new Set());
    state.handlers.get(event)!.add(handler);
  }

  function off(event: EventName, handler: Handler): void {
    state.handlers.get(event)?.delete(handler);
  }

  function destroy(): Promise<void> {
    const { config, iframe, embedOrigin } = state;
    const previous = state.forgetting;
    // The SDK's state resets now, so init() can start a fresh widget at once; only the old frame lives on until it
    // has cleared what it kept, and the next widget's frame is created after it is gone (see `forgetting`).
    tearDown();
    iframe?.hide();
    if (config) {
      resetVisitor(config.tenantId);
      // A site's own sign-out call: the other tabs hear it, and the next anonymous `init` does not read as a sign-out
      // the site forgot to signal.
      writeSubjectRecord(config.tenantId, null);
    }

    if (!config || !iframe || !embedOrigin) {
      iframe?.destroy();
      return previous ?? Promise.resolve();
    }

    return forgetThenRemove({ tenantId: config.tenantId }, iframe, embedOrigin);
  }

  function tearDown(): void {
    state.bridge?.destroy();
    state.bubble?.destroy();
    globalThis.removeEventListener('storage', onStorage);
    state.bridge = null;
    state.iframe = null;
    state.bubble = null;
    state.embedOrigin = null;
    state.config = null;
    state.isOpen = false;
    state.unreadCount = 0;
    state.handlers.clear();
    state.outboundQueue.length = 0;
    state.identityToken = null;
    state.ownSubject = null;
    state.siteVisitor = undefined;
    state.widgetStarted = false;
    state.widgetVisitorId = null;
    state.startSession = false;
    state.awaitingSite = false;
  }

  /**
   * A frame forgetting while an earlier one still is waits its turn: it is loaded only once the earlier one is gone.
   */
  function forgetThenRemove(
    clear: ForgetVisitorPayload,
    iframe: IframeLoaderHandle,
    embedOrigin: string,
  ): Promise<void> {
    const previous = state.forgetting;
    const forgetting = previous
      ? // What is held must settle: a frame that cannot be asked is removed all the same.
        previous.then(() => forgetInFrame(clear, iframe, embedOrigin)).catch(() => iframe.destroy())
      : forgetInFrame(clear, iframe, embedOrigin);
    hold(forgetting);
    return forgetting;
  }

  function forgetInFrame(
    clear: ForgetVisitorPayload,
    iframe: IframeLoaderHandle,
    embedOrigin: string,
  ): Promise<void> {
    // The frame keeps the conversation in its own origin's storage, which this page cannot reach: ask it to clear
    // the tenant's entries, over a bridge of its own so nothing from the torn-down session answers. A frame never
    // opened on this page is loaded hidden to receive the request.
    const frame = iframe.load();
    const forgetBridge = createPostMessageBridge({
      // A frame the page removed meanwhile has nothing left to clear or to answer.
      target: () => (frame.isConnected ? frame.contentWindow : null),
      expectedSource: () => frame.contentWindow,
      targetOrigin: embedOrigin,
      expectedSourceOrigin: embedOrigin,
      side: 'host',
    });
    return requestForgetVisitor(forgetBridge, clear, {
      timeoutMs: options.forgetTimeoutMs ?? FORGET_TIMEOUT_MS,
    }).then(() => {
      forgetBridge.destroy();
      iframe.destroy();
    });
  }

  return { init, open, close, sendMessage, setVisitor, on, off, destroy };
}
