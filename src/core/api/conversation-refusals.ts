import { isApiError, type ApiErrorEntry, type ApiErrorMap } from './api-error';

/**
 * The conversation actions whose refusals the console reports (spec `conversation-action-feedback`,
 * design D2). The action only matters where Platform answers without a machine code and the same
 * status means different things on different routes.
 */
export type ConversationAction =
  | 'send'
  | 'accept'
  | 'reject'
  | 'transfer'
  | 'close'
  | 'hold'
  | 'unhold'
  | 'create'
  | 'takeover'
  | 'supervisor-close'
  | 'reassign'
  | 'typify';

/**
 * `POST /close` on an agent-held chat whose tenant binds a published typification schema: nothing
 * changed; the client opens the wrap-up sheet so the agent typifies (`POST /typify`) instead.
 */
export const TYPIFICATION_REQUIRED = 'typification-required';

/**
 * `POST /close` or `/typify` refused for the conversation's state (queued, offered, live voice,
 * terminal, or a lost race): nothing changed; the client refetches the conversation.
 */
export const CONVERSATION_NOT_CLOSABLE = 'conversation-not-closable';

/** The machine code of a refusal when it is an {@link ApiError} carrying one, else `null`. */
export function refusalCodeOf(err: unknown): string | null {
  return isApiError(err) ? err.code : null;
}

const conflict: ApiErrorEntry = {
  code: 'conversation-conflict',
  key: 'errors.conversation.conflict',
};

/** Typify's 400 with an `errors` list naming at least one field (Platform `TypifyErrorResponse`). */
export const typifyInvalid: ApiErrorEntry = {
  code: 'typify-invalid',
  key: 'errors.conversation.typify_invalid',
};

/** The field names a refusal's `errors` list carries, in order and without repeats. */
export function refusedFieldsOf(err: unknown): string[] {
  if (!isApiError(err) || err.errors === null) return [];
  const fields: string[] = [];
  for (const item of err.errors) {
    if (typeof item === 'string' || typeof item.field !== 'string' || item.field === '') continue;
    if (!fields.includes(item.field)) fields.push(item.field);
  }
  return fields;
}

/**
 * A refused start as Platform describes it (`ConversationStartRefusal`): the machine code, and for
 * `conversation-open-elsewhere` / `conversation-not-sendable` the open conversation's id and owner
 * kind (`Agent`, `Queue`, `Bot`, ...). `null` when the error carries no machine code.
 */
export interface StartRefusal {
  readonly code: string;
  readonly conversationId: string | null;
  readonly ownerKind: string | null;
}

export function startRefusalOf(err: unknown): StartRefusal | null {
  if (!isApiError(err) || err.code === null) return null;
  const body = (typeof err.body === 'object' && err.body !== null ? err.body : {}) as {
    conversationId?: unknown;
    ownerKind?: unknown;
  };
  const text = (v: unknown) => (typeof v === 'string' && v !== '' ? v : null);
  return {
    code: err.code,
    conversationId: text(body.conversationId),
    ownerKind: text(body.ownerKind),
  };
}

/**
 * The closed conversation-refusal map. Lookup order (see `describeApiError`): Platform's machine
 * code first; then, without a code, the status per action; then the status; then the generic
 * failure. Platform's prose (a 409 reason, a hold's 400 reason, typify's field messages) is never
 * shown.
 */
export const conversationRefusals: ApiErrorMap<ConversationAction> = {
  codes: {
    'not-an-agent': { code: 'not-an-agent', key: 'errors.conversation.not_an_agent' },
    'not-owner': { code: 'not-owner', key: 'errors.conversation.not_owner' },
    'not-offered-to-you': {
      code: 'not-offered-to-you',
      key: 'errors.conversation.not_offered_to_you',
    },
    'target-agent-not-found': {
      code: 'target-agent-not-found',
      key: 'errors.conversation.target_agent_not_found',
    },
    'target-queue-not-found': {
      code: 'target-queue-not-found',
      key: 'errors.conversation.target_queue_not_found',
    },
    // Start refusals (Platform 2.28.0 `ConversationStartRefusal`, spec agent-started-conversations).
    'unknown-channel': { code: 'unknown-channel', key: 'errors.conversation.unknown_channel' },
    'contact-has-no-address': {
      code: 'contact-has-no-address',
      key: 'errors.conversation.contact_has_no_address',
    },
    'channel-not-available': {
      code: 'channel-not-available',
      key: 'errors.conversation.channel_not_available',
    },
    'conversation-open-elsewhere': {
      code: 'conversation-open-elsewhere',
      key: 'errors.conversation.open_elsewhere',
    },
    'conversation-not-sendable': {
      code: 'conversation-not-sendable',
      key: 'errors.conversation.not_sendable',
    },
    'agent-at-capacity': {
      code: 'agent-at-capacity',
      key: 'errors.conversation.agent_at_capacity',
    },
    'whatsapp-template-required': {
      code: 'whatsapp-template-required',
      key: 'errors.conversation.whatsapp_template_required',
    },
    'channel-send-failed': {
      code: 'channel-send-failed',
      key: 'errors.conversation.channel_send_failed',
    },
    'start-persist-failed': {
      code: 'start-persist-failed',
      key: 'errors.conversation.start_persist_failed',
    },
    // Close and typify refusals (Platform `close-chat-without-typification-licence`, design D9).
    [TYPIFICATION_REQUIRED]: {
      code: TYPIFICATION_REQUIRED,
      key: 'errors.conversation.typification_required',
    },
    [CONVERSATION_NOT_CLOSABLE]: {
      code: CONVERSATION_NOT_CLOSABLE,
      key: 'errors.conversation.not_closable',
    },
  },
  actions: {
    // The only 404 the start-conversation route sends is "Contact not found".
    create: { 404: { code: 'contact-not-found', key: 'errors.conversation.contact_not_found' } },
    // The switchboard refuses a state change on these routes with a 400 and prose, not a 409.
    hold: { 400: conflict },
    unhold: { 400: conflict },
    reassign: { 400: conflict },
    typify: {
      400: (err) => (refusedFieldsOf(err).length > 0 ? typifyInvalid : null),
    },
  },
  statuses: {
    404: { code: 'conversation-not-found', key: 'errors.conversation.conversation_not_found' },
    409: conflict,
  },
  fallback: { code: 'conversation-failed', key: 'errors.conversation.failed' },
};

/**
 * The refused fields named by the form's own labels, joined for the `typify_invalid` message.
 * `labelOf` returns the label the form shows for a field name, or `undefined` when the form has
 * none; such a field is named by its schema key (an identifier the tenant defined, not Platform's
 * prose).
 */
export function refusedFieldLabels(
  err: unknown,
  labelOf: (field: string) => string | undefined,
): string {
  return refusedFieldsOf(err)
    .map((field) => labelOf(field) ?? field)
    .join(', ');
}
