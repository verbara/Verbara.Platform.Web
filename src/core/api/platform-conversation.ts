import type { components } from '@/core/api/generated/openapi';
import type { Conversation } from '@/core/api/hooks/use-conversations';
import type { SupervisorConversation } from '@/core/api/hooks/use-supervisor';
import type { Contact } from '@/core/api/hooks/use-contacts';

type PlatformConversation = components['schemas']['Conversation'];
type PlatformConversationState = components['schemas']['ConversationState'];
type PlatformContact = components['schemas']['Contact'];

/**
 * Platform's `ConversationState` enum name → the console's snake-case state. Exhaustive over the
 * generated enum, so a state Platform adds fails the build here instead of reaching a filter that
 * matches nothing.
 */
const STATE: Record<PlatformConversationState, string> = {
  Queued: 'queued',
  Offered: 'offered',
  Active: 'active',
  OnHold: 'on_hold',
  Consulting: 'consulting',
  WrapUp: 'wrap_up',
  WaitingForCustomer: 'waiting_for_customer',
  Snoozed: 'snoozed',
  Resolved: 'resolved',
  Escalated: 'escalated',
  Closed: 'closed',
  Abandoned: 'abandoned',
  Merged: 'merged',
  Spam: 'spam',
};

/** The states the agent inbox works with; every other one has left the agent's working set. */
const INBOX_STATES = new Set<string>([
  'offered',
  'active',
  'on_hold',
  'consulting',
  'queued',
  'waiting_for_customer',
  'snoozed',
  'wrap_up',
] satisfies Conversation['state'][]);

function isInboxState(state: string): state is Conversation['state'] {
  return INBOX_STATES.has(state);
}

/** The record's most recent change: what the inbox sorts by and shows as "time since". */
function lastActivityOf(conversation: PlatformConversation): string {
  return conversation.updatedAt ?? conversation.createdAt;
}

/**
 * Maps Platform's `Conversation` record — what `GET /api/v1/conversations` returns in its
 * `PagedResult` (Verbara.Platform.Conversations/Conversation.cs: `conversationId`, `contactId`,
 * PascalCase `channel` and `state`, `owner`, `createdAt`/`updatedAt`) — onto the agent inbox's
 * view-model, which the SSE events fill directly. Returns `null` for a state that is not in the
 * agent's working set (resolved, closed, …), the same rule the `conversation.state_changed` handler
 * applies. Platform's record carries no contact name, queue name or last message; those stay empty
 * until an SSE event or a richer endpoint fills them.
 *
 * Before 3.21.0-web the record went into the store unmapped: keyed `undefined`, with a state no
 * inbox filter matched and no `lastMessageAt` for `formatDistanceToNow` (LAB-W1 N17).
 */
export function mapPlatformConversation(conversation: PlatformConversation): Conversation | null {
  const state = STATE[conversation.state] ?? String(conversation.state).toLowerCase();
  if (!isInboxState(state)) return null;
  return {
    id: String(conversation.conversationId),
    contactId: String(conversation.contactId),
    contactName: '',
    channel: String(conversation.channel).toLowerCase(),
    queueName: '',
    state,
    lastMessage: '',
    lastMessageAt: lastActivityOf(conversation),
    unread: false,
    assignedAt: conversation.createdAt,
  };
}

/**
 * Maps the same `Conversation` record, as `GET /api/v1/supervisor/conversations` returns it
 * (SupervisorEndpoints.ListDigitalConversations), onto the supervisor monitor's view-model. The
 * monitor keys its channel icons by Platform's enum name, so `channel` is kept as sent; the state
 * becomes the console's snake-case name. Before 3.21.0-web every card was keyed `undefined`, so a
 * takeover posted to `/supervisor/conversations/undefined/takeover` (LAB-W1 N16).
 */
export function mapPlatformSupervisorConversation(
  conversation: PlatformConversation,
): SupervisorConversation {
  const owner = conversation.owner;
  return {
    id: String(conversation.conversationId),
    contactId: String(conversation.contactId),
    contactName: '',
    channel: String(conversation.channel),
    queueName: '',
    state: STATE[conversation.state] ?? String(conversation.state).toLowerCase(),
    ...(owner?.kind === 'Agent' && owner.ownerId != null
      ? { assignedAgentId: String(owner.ownerId) }
      : {}),
    lastMessage: '',
    lastMessageAt: lastActivityOf(conversation),
    assignedAt: conversation.createdAt,
  };
}

/**
 * Maps Platform's `Contact` record — what `GET /api/v1/contacts` returns in its `PagedResult`
 * (`contactId`, nullable names, `addresses[{ channel: 'WhatsApp', address }]`) — onto the console's
 * contact view-model. Address channels are lower-cased, which is how every reader of a search
 * result compares them (`'voice'`, `'sms'`, `'email'`). Before 3.21.0-web the record was read as is:
 * each search option was keyed `undefined` and creating a conversation sent no `contactId`
 * (LAB-W1 N16).
 */
export function mapPlatformContact(contact: PlatformContact): Contact {
  return {
    id: String(contact.contactId),
    ...(contact.firstName != null ? { firstName: contact.firstName } : {}),
    ...(contact.lastName != null ? { lastName: contact.lastName } : {}),
    ...(contact.company != null ? { company: contact.company } : {}),
    ...(contact.segment != null ? { segment: contact.segment } : {}),
    ...(contact.preferredChannel != null ? { preferredChannel: contact.preferredChannel } : {}),
    ...(contact.preferredLanguage != null ? { preferredLanguage: contact.preferredLanguage } : {}),
    ...(contact.timezone != null ? { timezone: contact.timezone } : {}),
    ...(contact.doNotContact !== undefined ? { doNotContact: contact.doNotContact } : {}),
    ...(contact.channelConsent != null ? { channelConsent: contact.channelConsent } : {}),
    ...(contact.customFields != null ? { customFields: contact.customFields } : {}),
    addresses: (contact.addresses ?? []).map((a) => ({
      channel: String(a.channel).toLowerCase(),
      address: a.address,
    })),
    createdAt: contact.createdAt,
  };
}
