import { useConversation } from '@/core/api/hooks/use-conversations';

/**
 * The contact of a conversation in the inbox store. A fresh offer reaches the store with no contact id and
 * the accept does not add one, so it comes from the record, as in the History tab (W14). The record is
 * read only then, on the key the tab shares.
 */
export function useConversationContactId(
  conversation: { id: string; contactId: string } | null | undefined,
): string | undefined {
  const storedContactId = conversation?.contactId || undefined;
  const record = useConversation(conversation && !storedContactId ? conversation.id : undefined);
  return storedContactId ?? record.data?.contactId;
}
