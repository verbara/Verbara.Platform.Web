import { queryClient } from '@/core/api/query-client';

/**
 * Per conversation: present while a refresh runs; `true` when a frame arrived during it, so exactly one
 * more refresh is owed. Frames after that add nothing.
 */
const running = new Map<string, boolean>();

/**
 * Re-reads a conversation's `/history` (the `useMessageHistory` query) after a live message, so the
 * stored text replaces the pending row. A thread that is not mounted only has its query marked stale.
 *
 * - A read already running when the frame arrived may have been answered before the message was stored,
 *   and an invalidation joins it instead of restarting it while the query has no data (the thread's
 *   first read). So the refresh waits for that read to settle and then invalidates, which starts a new
 *   read of a mounted query.
 * - Refreshes are coalesced: one running and at most one queued per conversation, and none starts a
 *   request beside a running one (`cancelRefetch: false`; the history read does not forward its abort
 *   signal, so cancelling would not stop its request anyway). A burst of frames costs at most two
 *   refreshes per conversation, not one per message.
 */
export function refreshConversationHistory(conversationId: string): void {
  if (running.has(conversationId)) {
    running.set(conversationId, true);
    return;
  }
  running.set(conversationId, false);
  void refresh(conversationId);
}

async function refresh(conversationId: string): Promise<void> {
  const filters = { queryKey: ['messages', conversationId, 'history'], exact: true };
  const options = { cancelRefetch: false };
  try {
    if (queryClient.isFetching(filters) > 0) {
      await queryClient.refetchQueries(filters, options);
    }
    await queryClient.invalidateQueries(filters, options);
  } finally {
    const owed = running.get(conversationId) === true;
    running.delete(conversationId);
    if (owed) refreshConversationHistory(conversationId);
  }
}
