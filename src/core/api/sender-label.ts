import type { Message } from '@/core/api/hooks/use-conversations';

/** What the console already holds about who is reading and whose conversation it is. */
export interface SenderLabelContext {
  /** The signed-in agent's id (`/agents/me`); absent in the supervisor monitor. */
  readonly ownAgentId?: string | undefined;
  /** The conversation's contact name; empty or absent when unknown. */
  readonly contactName?: string | undefined;
}

/**
 * The label above a message, from its side and what the console holds: never the raw stream `sender`
 * nor the stored `senderId` (an agent id, or the customer's channel address). `t` is bound to the `agent`
 * namespace. A system row has no label.
 */
export function senderLabel(
  message: Pick<Message, 'sender'> & Partial<Pick<Message, 'senderId' | 'status'>>,
  context: SenderLabelContext,
  t: (key: string) => string,
): string | null {
  switch (message.sender) {
    case 'system':
      return null;
    case 'agent': {
      // The composer's own row, while its send is pending, carries no stored id yet.
      const own =
        message.senderId !== undefined
          ? !!context.ownAgentId && message.senderId === context.ownAgentId
          : message.status === 'sending';
      return own ? t('composer.you') : t('history.direction.outbound');
    }
    default:
      return context.contactName || t('history.direction.inbound');
  }
}
