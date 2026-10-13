import { useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';
import { mapPlatformConversation } from '@/core/api/platform-conversation';
import { useCloseConversation } from '@/core/api/hooks/use-conversations';
import {
  CONVERSATION_NOT_CLOSABLE,
  TYPIFICATION_REQUIRED,
  refusalCodeOf,
} from '@/core/api/conversation-refusals';
import { useConversationStore } from '@/agent/stores/conversation-store';

interface CloseConversationActionOptions {
  /** Called after Platform closed the conversation (200); the conversation has left the store. */
  readonly onClosed?: () => void;
  /**
   * Called on a 409 `typification-required`: the tenant binds a published schema, so the agent must
   * typify. The conversation panel opens the wrap-up sheet; the sheet's own form is refetched here
   * so a schema bound after it loaded replaces the no-schema panel.
   */
  readonly onTypificationRequired?: () => void;
}

/**
 * The agent's "close conversation" action (Platform `close-chat-without-typification-licence`,
 * design "Web"). `POST /close` closes an agent-held chat without a bound schema (200), or refuses with
 * 409 `typification-required` / `conversation-not-closable`. `useCloseConversation` toasts every
 * refusal; this hook adds what the agent workspace does about each:
 *
 * - 200 — drops the conversation from the inbox store (as a completed typify does);
 * - `typification-required` — `onTypificationRequired` (open the wrap-up sheet);
 * - `conversation-not-closable` — re-reads the conversation and merges it into the store, or drops
 *   it when it has left the agent's working set, so the panel shows the state Platform holds.
 */
export function useCloseConversationAction(
  conversationId: string,
  options: CloseConversationActionOptions = {},
) {
  const qc = useQueryClient();
  const closeMutation = useCloseConversation();
  const removeConversation = useConversationStore((s) => s.removeConversation);
  const mergeFromRest = useConversationStore((s) => s.mergeFromRest);

  async function refreshConversation() {
    try {
      const fresh = await customFetch<components['schemas']['Conversation']>({
        url: `/api/v1/conversations/${conversationId}`,
        method: 'GET',
      });
      const mapped = mapPlatformConversation(fresh);
      if (mapped) mergeFromRest(mapped);
      else removeConversation(conversationId);
    } catch {
      // The refusal is already toasted and the conversation queries are invalidated; a failed
      // re-read leaves the store as it was (the next SSE event or inbox refetch corrects it).
    }
  }

  function close() {
    closeMutation.mutate(conversationId, {
      onSuccess: () => {
        removeConversation(conversationId);
        options.onClosed?.();
      },
      onError: (err) => {
        const code = refusalCodeOf(err);
        if (code === TYPIFICATION_REQUIRED) {
          void qc.invalidateQueries({ queryKey: ['typification', 'form', conversationId] });
          options.onTypificationRequired?.();
        } else if (code === CONVERSATION_NOT_CLOSABLE) {
          void refreshConversation();
        }
      },
    });
  }

  return { close, isPending: closeMutation.isPending };
}
