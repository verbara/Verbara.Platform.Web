import { useEffect, useState } from 'react';
import { ChatWidget, type InitConfigPayload } from './chat-widget';
import { flashUnread, stopFlash, playNotificationSound } from './notifications';
import { setupKeyboardShortcuts } from './a11y';
import { createPostMessageBridge } from '@/webchat/sdk/postmessage-bridge';
import { applyTheme } from './theme-apply';
import { breadcrumb } from './sentry-breadcrumbs';

export function App() {
  const [config, setConfig] = useState<InitConfigPayload | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const bridge = createPostMessageBridge({
      target: () => window.parent,
      targetOrigin: window.location.origin,
      expectedSourceOrigin: window.location.origin,
      side: 'iframe',
    });
    bridge.send('ready');

    bridge.on('init-config', (payload) => {
      const cfg = payload as InitConfigPayload;
      applyTheme(cfg.theme);
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

    bridge.on('set-visitor', (_payload) => {
      // visitor updates flow through pre-chat form
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
      window.parent.postMessage(
        { source: 'verbara-webchat-iframe', type: 'unread', payload: next },
        window.location.origin,
      );
    }
  }

  if (!config) {
    return (
      // The testid marks that the app mounted and the postMessage bridge is listening. A host
      // that posts `init-config` before this exists loses it — postMessage has no buffering.
      <div
        className="flex h-screen items-center justify-center text-sm text-gray-500"
        data-testid="webchat-embed-loading"
      >
        Loading…
      </div>
    );
  }

  return <ChatWidget config={config} onUnreadChange={handleUnread} />;
}
