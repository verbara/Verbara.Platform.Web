import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { ChatWidget, type InitConfigPayload } from './chat-widget';
import { flashUnread, stopFlash, playNotificationSound } from './notifications';
import { setupKeyboardShortcuts } from './a11y';
import { createPostMessageBridge } from '@/webchat/sdk/postmessage-bridge';
import { applyTheme } from './theme-apply';
import { breadcrumb } from './sentry-breadcrumbs';
import { postToHost, resolveHostOrigin } from './origins';
import { WidgetFrame } from './widget-frame';
import {
  FORGET_VISITOR,
  VISITOR_FORGOTTEN,
  forgetVisitorData,
  readForgetVisitor,
} from './forget-visitor';

export function App() {
  const [config, setConfig] = useState<InitConfigPayload | null>(null);
  const [identityToken, setIdentityToken] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    // Pinned once: the host page's origin is the only one this frame posts to or listens to (#426).
    const hostOrigin = resolveHostOrigin(window.location);
    const bridge = createPostMessageBridge({
      target: () => window.parent,
      targetOrigin: hostOrigin,
      expectedSourceOrigin: hostOrigin,
      side: 'iframe',
    });
    bridge.send('ready');

    bridge.on('init-config', (payload) => {
      const cfg = payload as InitConfigPayload;
      applyTheme(cfg.theme);
      setIdentityToken(cfg.identityToken ?? null);
      setConfig(cfg);
    });

    bridge.on('open', () => {
      stopFlash();
      setUnread(0);
      breadcrumb('opened');
    });

    bridge.on('close', () => {
      breadcrumb('closed');
    });

    bridge.on('send-message', (_payload) => {
      // handled by ChatWidget internals via postMessage
    });

    // The profile flows through the pre-chat form; only the token is applied here. Omitted leaves it as it is.
    bridge.on('set-visitor', (payload) => {
      const token = (payload as { identityToken?: unknown } | null | undefined)?.identityToken;
      if (typeof token === 'string' || token === null) setIdentityToken(token);
    });

    // The host page's destroy(): close the chat first, so its socket is gone and no late reply writes the cache
    // again, then clear what this frame kept for the tenant and confirm.
    bridge.on(FORGET_VISITOR, (payload) => {
      const request = readForgetVisitor(payload);
      if (!request) return;
      flushSync(() => {
        setConfig(null);
        setIdentityToken(null);
      });
      forgetVisitorData(request.tenantId);
      bridge.send(VISITOR_FORGOTTEN, { tenantId: request.tenantId });
    });

    const teardownKey = setupKeyboardShortcuts(() => {
      bridge.send('close');
    });

    return () => {
      bridge.destroy();
      teardownKey();
    };
  }, []);

  function handleUnread(delta: number) {
    if (document.hidden) {
      const next = unread + delta;
      setUnread(next);
      flashUnread(next);
      playNotificationSound();
      postToHost('unread', next);
    }
  }

  if (!config) {
    return (
      // The testid marks that the app mounted and the postMessage bridge is listening. A host
      // that posts `init-config` before this exists loses it — postMessage has no buffering.
      <WidgetFrame>
        <div
          className="flex h-full items-center justify-center text-sm text-gray-500"
          data-testid="webchat-embed-loading"
        >
          Loading…
        </div>
      </WidgetFrame>
    );
  }

  return (
    <WidgetFrame>
      <ChatWidget config={config} identityToken={identityToken} onUnreadChange={handleUnread} />
    </WidgetFrame>
  );
}
