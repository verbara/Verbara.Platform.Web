import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { onHubEvent } from '@/core/realtime';
import { useRealtimeStore } from '@/core/stores/realtime-store';

export interface ConversationStateChangedPayload {
  conversationId: string;
  previousState: string;
  newState: string;
  changedAt: string;
  tenantId: string;
}

/**
 * Subscribe to real-time conversation state transitions published by the Pro T27
 * conversation bridge and forwarded via `PlatformHub` to the `tenant:{tenantId}`
 * group the current connection auto-joined on login.
 *
 * On each event the hook invalidates React Query caches:
 *   - `['conversations']` (list) — always
 *   - `['conversations', conversationId]` (detail) — always
 *   - `['messages', conversationId]` — only on `newState === 'ended'` (final snapshot)
 *
 * If `conversationId` is supplied, only events matching that id trigger
 * invalidation; otherwise all events for the tenant trigger the list-level
 * invalidation plus the per-conversation detail invalidation for the emitted id.
 */
export function useConversationStateStream(conversationId?: string): void {
  const qc = useQueryClient();
  const connectionState = useRealtimeStore((s) => s.connectionState);

  useEffect(() => {
    if (connectionState !== 'connected') return;

    const unsubscribe = onHubEvent<ConversationStateChangedPayload>(
      'OnConversationStateChanged',
      (evt) => {
        if (conversationId && evt.conversationId !== conversationId) return;

        void qc.invalidateQueries({ queryKey: ['conversations'] });
        void qc.invalidateQueries({ queryKey: ['conversations', evt.conversationId] });

        if (evt.newState === 'ended') {
          void qc.invalidateQueries({ queryKey: ['messages', evt.conversationId] });
        }
      },
    );

    return () => unsubscribe();
  }, [conversationId, connectionState, qc]);
}
