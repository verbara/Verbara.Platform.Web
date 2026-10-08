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
