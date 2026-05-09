import { useEffect, useState } from 'react';
import { ChatWidget, type InitConfigPayload } from './chat-widget';
import { flashUnread, stopFlash, playNotificationSound } from './notifications';
import { setupKeyboardShortcuts } from './a11y';
import { createPostMessageBridge } from '@/webchat/sdk/postmessage-bridge';

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
      setConfig(payload as InitConfigPayload);
    });

    bridge.on('open', () => {
      stopFlash();
      setUnread(0);
    });

    bridge.on('close', () => {
      // no-op
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
      <div className="flex h-screen items-center justify-center text-sm text-gray-500">
        Loading…
      </div>
    );
  }

  return <ChatWidget config={config} onUnreadChange={handleUnread} />;
}
