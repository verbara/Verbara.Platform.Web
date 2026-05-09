import { createBubble, type BubbleHandle } from './bubble';
import { createIframeLoader, type IframeLoaderHandle } from './iframe-loader';
import { createPostMessageBridge, type BridgeHandle } from './postmessage-bridge';
import {
  getOrCreateVisitorId,
  getVisitorProfile,
  setVisitorProfile,
  resetVisitor,
} from './visitor-storage';

export interface InitConfig {
  tenantId: string;
  apiBase?: string;
  locale?: 'auto' | 'en-US' | 'es-419' | 'pt-BR';
  theme?: { primaryColor?: string; fontFamily?: string };
  position?: 'bottom-right' | 'bottom-left';
  greeting?: string;
  visitor?: { name?: string; email?: string };
}

type EventName = 'open' | 'close' | 'unread' | 'message-sent' | 'message-received' | 'ready';
type Handler = (payload?: unknown) => void;

interface InternalState {
  config: InitConfig | null;
  bubble: BubbleHandle | null;
  iframe: IframeLoaderHandle | null;
  bridge: BridgeHandle | null;
  isOpen: boolean;
  unreadCount: number;
  handlers: Map<EventName, Set<Handler>>;
  outboundQueue: Array<{ type: string; payload?: unknown }>;
}

export interface WebChatApi {
  init(config: InitConfig): void;
  open(): void;
  close(): void;
  sendMessage(text: string): void;
  setVisitor(profile: { name?: string; email?: string }): void;
  on(event: EventName, handler: Handler): void;
  off(event: EventName, handler: Handler): void;
  destroy(): void;
}

export function createWebChatApi(): WebChatApi {
  const state: InternalState = {
    config: null,
    bubble: null,
    iframe: null,
    bridge: null,
    isOpen: false,
    unreadCount: 0,
    handlers: new Map(),
    outboundQueue: [],
  };

  function emit(event: EventName, payload?: unknown) {
    const set = state.handlers.get(event);
    if (set) for (const h of set) h(payload);
  }

  function ensureIframeBridge() {
    if (state.bridge) return;
    if (!state.config || !state.iframe) return;
    const apiBase = state.config.apiBase ?? '/';
    const targetOrigin = new URL(apiBase, globalThis.location.href).origin;
    state.bridge = createPostMessageBridge({
      target: () => state.iframe?.getIframe()?.contentWindow ?? null,
      targetOrigin,
      expectedSourceOrigin: targetOrigin,
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

    const apiBase = config.apiBase ?? '/';
    const embedUrl = new URL('webchat/embed/', new URL(apiBase, globalThis.location.href));
    embedUrl.searchParams.set('tenantId', config.tenantId);
    if (config.locale) embedUrl.searchParams.set('locale', config.locale);
    state.iframe = createIframeLoader({
      src: embedUrl.toString(),
      position: config.position ?? 'bottom-right',
    });
  }

  function open(): void {
    if (!state.config || !state.iframe) return;
    state.iframe.show();
    state.isOpen = true;
    state.bubble?.setOpen(true);
    ensureIframeBridge();
    state.bridge?.send('open');
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

  function destroy(): void {
    state.bridge?.destroy();
    state.iframe?.destroy();
    state.bubble?.destroy();
    if (state.config) resetVisitor(state.config.tenantId);
    state.bridge = null;
    state.iframe = null;
    state.bubble = null;
    state.config = null;
    state.handlers.clear();
    state.outboundQueue.length = 0;
  }

  return { init, open, close, sendMessage, setVisitor, on, off, destroy };
}
