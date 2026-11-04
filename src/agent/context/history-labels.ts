import type { components } from '@/core/api/generated/openapi';

type ConversationState = components['schemas']['ConversationState'];
type MessageBlockType = components['schemas']['MessageBlockType'];

/** Exhaustive over the generated enum, so a state Platform adds fails `tsc -b` here (W3). */
const STATE_KEYS: Record<ConversationState, string> = {
  Queued: 'agent:history.states.queued',
  Offered: 'agent:history.states.offered',
  Active: 'agent:history.states.active',
  OnHold: 'agent:history.states.on_hold',
  Consulting: 'agent:history.states.consulting',
  WrapUp: 'agent:history.states.wrap_up',
  WaitingForCustomer: 'agent:history.states.waiting_for_customer',
  Snoozed: 'agent:history.states.snoozed',
  Resolved: 'agent:history.states.resolved',
  Escalated: 'agent:history.states.escalated',
  Closed: 'agent:history.states.closed',
  Abandoned: 'agent:history.states.abandoned',
  Merged: 'agent:history.states.merged',
  Spam: 'agent:history.states.spam',
};

const BLOCK_TYPE_KEYS: Record<MessageBlockType, string> = {
  Text: 'agent:history.block_types.text',
  Image: 'agent:history.block_types.image',
  Audio: 'agent:history.block_types.audio',
  Video: 'agent:history.block_types.video',
  File: 'agent:history.block_types.file',
  Location: 'agent:history.block_types.location',
  Interactive: 'agent:history.block_types.interactive',
};

/** The close reasons this console names. `closedReason` is an open string on the wire. */
const CLOSED_REASON_KEYS: Readonly<Record<string, string>> = {
  inactivity: 'agent:history.closed_reasons.inactivity',
  'inactivity-backlog': 'agent:history.closed_reasons.inactivity_backlog',
  'customer-returned': 'agent:history.closed_reasons.customer_returned',
};

/** Own-property lookup, so a wire value such as `constructor` never matches. */
function keyIn(keys: Readonly<Record<string, string>>, value: string): string | null {
  return Object.hasOwn(keys, value) ? (keys[value] ?? null) : null;
}

export function stateLabelKey(state: string): string | null {
  return keyIn(STATE_KEYS, state);
}

export function blockTypeLabelKey(blockType: string): string | null {
  return keyIn(BLOCK_TYPE_KEYS, blockType);
}

/** `null` for a reason this console does not know: it renders nothing, not the wire value. */
export function closedReasonLabelKey(reason: string): string | null {
  return keyIn(CLOSED_REASON_KEYS, reason);
}
