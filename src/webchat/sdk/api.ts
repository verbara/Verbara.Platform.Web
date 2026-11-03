import { createBubble, type BubbleHandle } from './bubble';
import { createIframeLoader, type IframeLoaderHandle } from './iframe-loader';
import { createPostMessageBridge, type BridgeHandle } from './postmessage-bridge';
import { buildEmbedUrl, resolveEmbedOrigin } from './embed-origin';
import { FORGET_TIMEOUT_MS, requestForgetVisitor } from './forget-visitor';
import {
  getOrCreateVisitorId,
  getVisitorProfile,
  setVisitorProfile,
  resetVisitor,
} from './visitor-storage';

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
}

type EventName = 'open' | 'close' | 'unread' | 'message-sent' | 'message-received' | 'ready';
type Handler = (payload?: unknown) => void;

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
   * is created only after it settles: frames of one embed origin share storage, and the clear is tenant-wide.
   */
  forgetting: Promise<void> | null;
}

export interface WebChatApi {
  init(config: InitConfig): void;
  open(): void;
  close(): void;
  sendMessage(text: string): void;
  setVisitor(profile: { name?: string; email?: string }): void;
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
  };

  function emit(event: EventName, payload?: unknown) {
    const set = state.handlers.get(event);
    if (set) for (const h of set) h(payload);
  }

  function ensureIframeBridge() {
    if (state.bridge) return;
    if (!state.config || !state.iframe || !state.embedOrigin) return;
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
    state.bridge.on('ready', () => {
      // Send config + visitor info to iframe
      state.bridge!.send('init-config', {
        tenantId: state.config!.tenantId,
        apiBase: state.config!.apiBase,
        locale: state.config!.locale,
        theme: state.config!.theme,
        greeting: state.config!.greeting,
        visitorId: getOrCreateVisitorId(state.config!.tenantId),
        visitor: getVisitorProfile(state.config!.tenantId) ?? state.config!.visitor,
        pageContext: {
          url: globalThis.location.href,
          title: document.title,
          referrer: document.referrer,
        },
        ...(state.config!.csat ? { csat: state.config!.csat } : {}),
      });
      // Flush queued outbound messages
      while (state.outboundQueue.length > 0) {
        const msg = state.outboundQueue.shift()!;
        state.bridge!.send(msg.type, msg.payload);
      }
      emit('ready');
    });
    state.bridge.on('unread', (payload) => {
      const count = typeof payload === 'number' ? payload : 0;
      state.unreadCount = count;
      state.bubble?.setUnreadCount(count);
      emit('unread', count);
    });
    state.bridge.on('message-sent', (p) => emit('message-sent', p));
    state.bridge.on('message-received', (p) => emit('message-received', p));
    state.bridge.on('visitor-updated', (p) => {
      if (state.config && typeof p === 'object' && p !== null) {
        setVisitorProfile(state.config.tenantId, p as { name?: string; email?: string });
      }
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
      // Already initialized — destroy and re-init
      destroy();
    }
    state.config = config;
    if (config.visitor) setVisitorProfile(config.tenantId, config.visitor);

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
    state.iframe = createIframeLoader({
      src: buildEmbedUrl(state.embedOrigin, {
        tenantId: config.tenantId,
        locale: config.locale,
        hostOrigin: globalThis.location.origin,
      }),
      position: config.position ?? 'bottom-right',
    });
  }

  function open(): void {
    if (!state.config || !state.iframe) return;
    const iframe = state.iframe;
    state.isOpen = true;
    state.bubble?.setOpen(true);
    const showFrame = () => {
      // The widget may have been closed or destroyed while the previous frame was forgetting.
      if (state.iframe !== iframe || !state.isOpen) return;
      iframe.show();
      ensureIframeBridge();
      state.bridge?.send('open');
    };
    if (state.forgetting) void state.forgetting.then(showFrame);
    else showFrame();
    emit('open');
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

  function setVisitor(profile: { name?: string; email?: string }): void {
    if (!state.config) return;
    setVisitorProfile(state.config.tenantId, profile);
    state.bridge?.send('set-visitor', profile);
  }

  function on(event: EventName, handler: Handler): void {
    if (!state.handlers.has(event)) state.handlers.set(event, new Set());
    state.handlers.get(event)!.add(handler);
  }

  function off(event: EventName, handler: Handler): void {
    state.handlers.get(event)?.delete(handler);
  }

  function destroy(): Promise<void> {
    const { config, bridge, iframe, embedOrigin } = state;
    const previous = state.forgetting;
    // The SDK's state resets now, so init() can start a fresh widget at once; only the old frame lives on until it
    // has cleared what it kept, and the next widget's frame is created after it is gone (see `forgetting`).
    bridge?.destroy();
    state.bubble?.destroy();
    iframe?.hide();
    if (config) resetVisitor(config.tenantId);
    state.bridge = null;
    state.iframe = null;
    state.bubble = null;
    state.embedOrigin = null;
    state.config = null;
    state.isOpen = false;
    state.unreadCount = 0;
    state.handlers.clear();
    state.outboundQueue.length = 0;

    if (!config || !iframe || !embedOrigin) {
      iframe?.destroy();
      return previous ?? Promise.resolve();
    }

    // A widget destroyed while an earlier frame is still forgetting waits its turn: its own frame is loaded only once
    // the earlier one is gone.
    const forgetting = previous
      ? previous.then(() => forgetInFrame(config, iframe, embedOrigin))
      : forgetInFrame(config, iframe, embedOrigin);
    state.forgetting = forgetting;
    void forgetting.then(() => {
      if (state.forgetting === forgetting) state.forgetting = null;
    });
    return forgetting;
  }

  function forgetInFrame(
    config: InitConfig,
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
    return requestForgetVisitor(
      forgetBridge,
      { tenantId: config.tenantId },
      { timeoutMs: options.forgetTimeoutMs ?? FORGET_TIMEOUT_MS },
    ).then(() => {
      forgetBridge.destroy();
      iframe.destroy();
    });
  }

  return { init, open, close, sendMessage, setVisitor, on, off, destroy };
}
