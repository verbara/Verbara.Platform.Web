import type { components } from '@/core/api/generated/openapi';

/**
 * Test doubles for the shapes of the transfer targets, the available channels and the transfer
 * body, spelled against the generated schemas. The vitest files are outside `tsc -b`, so a typed
 * literal inside a test checks nothing; here a renamed member fails `npm run build`, even one no
 * production code reads. Every member is written out: a spread inside a test is not compiled, so a
 * variant a test needs is a named export here. Only tests import this module, so it ships in no
 * chunk.
 */
type Schemas = components['schemas'];

export const billingQueue: Schemas['TransferTargetQueueDto'] = {
  id: '7c2e4a6b8d0f4e1a9b3c5d7e9f1a2b3c',
  name: 'Billing',
};

export const escalationsQueue: Schemas['TransferTargetQueueDto'] = {
  id: '8d3f5b7c9e1a4f2b0c4d6e8f0a2b3c4d',
  name: 'Billing - Escalations',
};

export const transferTargetQueuesPage: Schemas['PagedResultOfTransferTargetQueueDto'] = {
  items: [billingQueue, escalationsQueue],
  totalCount: 2,
  page: 1,
  pageSize: 100,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

export const emptyTransferTargetQueuesPage: Schemas['PagedResultOfTransferTargetQueueDto'] = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 100,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

export const availableAgent: Schemas['TransferTargetAgentDto'] = {
  id: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
  displayName: 'Ana Pereira',
  state: 'Available',
  canAcceptWork: true,
};

export const busyAgent: Schemas['TransferTargetAgentDto'] = {
  id: 'b2c3d4e5f6a718293a4b5c6d7e8f90a1',
  displayName: 'Andrés Rojas',
  state: 'Busy',
  canAcceptWork: true,
};

export const wrapUpAgent: Schemas['TransferTargetAgentDto'] = {
  id: 'c3d4e5f6a7b8293a4b5c6d7e8f90a1b2',
  displayName: 'Hannah Osei',
  state: 'ACW',
  canAcceptWork: false,
};

export const offlineAgent: Schemas['TransferTargetAgentDto'] = {
  id: 'd4e5f6a7b8c9293a4b5c6d7e8f90a1b2',
  displayName: 'Juan Castellanos',
  state: 'Offline',
  canAcceptWork: false,
};

export const transferTargetAgentsPage: Schemas['PagedResultOfTransferTargetAgentDto'] = {
  items: [availableAgent, busyAgent, wrapUpAgent, offlineAgent],
  totalCount: 4,
  page: 1,
  pageSize: 100,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

export const emptyTransferTargetAgentsPage: Schemas['PagedResultOfTransferTargetAgentDto'] = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 100,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

export const availableChannels: Schemas['AvailableChannelDto'][] = [
  { channel: 'WhatsApp' },
  { channel: 'WebChat' },
];

export const noAvailableChannels: Schemas['AvailableChannelDto'][] = [];

export const webChatOnlyChannels: Schemas['AvailableChannelDto'][] = [{ channel: 'WebChat' }];

export const whatsAppOnlyChannels: Schemas['AvailableChannelDto'][] = [{ channel: 'WhatsApp' }];

export const smsThenWebChatChannels: Schemas['AvailableChannelDto'][] = [
  { channel: 'Sms' },
  { channel: 'WebChat' },
];

/** A connector the host does not register today: the console must offer it unchanged. */
export const messengerChannels: Schemas['AvailableChannelDto'][] = [{ channel: 'Messenger' }];

const everyChannelType = {
  Voice: true,
  WhatsApp: true,
  Sms: true,
  WebChat: true,
  Email: true,
  Messenger: true,
  Instagram: true,
  Telegram: true,
  Twitter: true,
  Video: true,
  Rcs: true,
} satisfies Record<Schemas['ChannelType'], true>;

/** Every `ChannelType`; the `Record` above makes a value the schema adds or drops a compile error. */
export const channelTypeValues = Object.keys(everyChannelType) as Schemas['ChannelType'][];

/** One row per `ChannelType`: the server never lists `Voice`, the labels still cover it. */
export const everyChannelListed: Schemas['AvailableChannelDto'][] = channelTypeValues.map(
  (channel) => ({ channel }),
);

export const transferToQueueWithNote: Schemas['TransferRequest'] = {
  targetQueueId: billingQueue.id,
  targetAgentId: null,
  note: 'Customer disputes the October invoice; the amount was already corrected once, please do not re-issue it.',
};

export const transferToAgentWithNote: Schemas['TransferRequest'] = {
  targetQueueId: null,
  targetAgentId: availableAgent.id,
  note: 'Prefers Portuguese. Case 4471 is open on the same order.',
};

export const transferToQueueWithoutNote: Schemas['TransferRequest'] = {
  targetQueueId: billingQueue.id,
  targetAgentId: null,
  note: null,
};

/** The form the console sends without a note: a target, and no `note` member. */
export const transferWithOmittedNote: Partial<Schemas['TransferRequest']> = {
  targetAgentId: availableAgent.id,
};

export const onBreakAgent: Schemas['TransferTargetAgentDto'] = {
  id: 'e5f6a7b8c9d0293a4b5c6d7e8f90a1b2',
  displayName: 'Beatriz Lima',
  state: 'Break',
  canAcceptWork: false,
};

const everyAgentState = {
  Offline: true,
  Available: true,
  Busy: true,
  Break: true,
  Lunch: true,
  Training: true,
  ACW: true,
  DND: true,
} satisfies Record<Schemas['AgentState'], true>;

/** Every `AgentState`; the `Record` above makes a value the schema adds or drops a compile error. */
export const agentStateValues = Object.keys(everyAgentState) as Schemas['AgentState'][];

/**
 * A stored transfer note as the history answers it. The five members a stored note never sets are
 * left out, because the API omits a null member.
 */
export const transferNoteMessage: Schemas['Message'] = {
  messageId: 'e9f8d7c6b5a44f3e2d1c0b9a8f7e6d5c',
  conversationId: '4f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a',
  tenantId: 'demo',
  direction: 'System',
  channel: 'WhatsApp',
  senderId: '0f1e2d3c4b5a69788796a5b4c3d2e1f0',
  content: {
    blocks: [
      {
        $type: 'text',
        text: 'Customer disputes the October invoice; the amount was already corrected once, please do not re-issue it.',
        type: 'Text',
      },
    ],
  },
  deliveryStatus: 'Delivered',
  createdAt: '2026-10-30T15:04:05.123+00:00',
  createdBy: 'transfer:0f1e2d3c4b5a69788796a5b4c3d2e1f0',
};

/**
 * `GET /api/v1/contacts/{id}/conversations` as the host fixture `contact-conversation-history.v1.json`
 * answers it (contact-history-opens-by-assignment-web, W11). The first item is the conversation the
 * calling agent holds now, so it has no close members.
 */
export const heldContactSummary: Schemas['ContactConversationSummaryDto'] = {
  id: 'c3b2a1f0e9d84c7b6a5f4e3d2c1b0a99',
  channel: 'WhatsApp',
  state: 'Active',
  createdAt: '2026-11-03T14:02:11.000+00:00',
  queueId: 'q-support-0001',
  queueName: 'Support',
  agentId: 'a-0f1e2d3c4b5a6978',
  agentDisplayName: 'Agent B',
  lastMessageAt: '2026-11-03T14:05:40.000+00:00',
  lastMessage: {
    direction: 'Inbound',
    blockType: 'Text',
    preview: 'Hi again, the replacement card has not arrived yet',
    createdAt: '2026-11-03T14:05:40.000+00:00',
  },
  heldByCaller: true,
};

/** The fixture's second item: closed by the inactivity close, handled and typified by another agent. */
export const closedContactSummary: Schemas['ContactConversationSummaryDto'] = {
  id: '4f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a',
  channel: 'WhatsApp',
  state: 'Closed',
  createdAt: '2026-10-28T09:15:00.000+00:00',
  closedAt: '2026-10-31T10:20:05.000+00:00',
  durationSeconds: 3905,
  closedReason: 'inactivity',
  queueId: 'q-support-0001',
  queueName: 'Support',
  agentId: 'a-9e8d7c6b5a493827',
  agentDisplayName: 'Agent A',
  disposition: {
    nodeId: 'n-card-replacement',
    label: 'Card replacement requested',
  },
  lastMessageAt: '2026-10-28T10:20:05.000+00:00',
  lastMessage: {
    direction: 'Outbound',
    blockType: 'Text',
    preview: 'Your replacement card has been ordered and should arrive within five business days.',
    createdAt: '2026-10-28T10:20:05.000+00:00',
  },
  heldByCaller: false,
};

/** The fixture's third item: no queue, agent, disposition or close reason; its last message is an image. */
export const abandonedContactSummary: Schemas['ContactConversationSummaryDto'] = {
  id: '0a9b8c7d6e5f40312233445566778899',
  channel: 'WhatsApp',
  state: 'Abandoned',
  createdAt: '2026-09-02T18:00:00.000+00:00',
  closedAt: '2026-09-02T18:30:00.000+00:00',
  durationSeconds: 1800,
  lastMessageAt: '2026-09-02T18:01:12.000+00:00',
  lastMessage: {
    direction: 'Inbound',
    blockType: 'Image',
    preview: '',
    createdAt: '2026-09-02T18:01:12.000+00:00',
  },
  heldByCaller: false,
};

export const contactSummaryPage: Schemas['PagedResultOfContactConversationSummaryDto'] = {
  items: [heldContactSummary, closedContactSummary, abandonedContactSummary],
  totalCount: 3,
  page: 1,
  pageSize: 25,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

/** The same contact over two pages of two (W2). Not in the fixture: its values are the fixture's items. */
export const contactSummaryFirstOfTwoPages: Schemas['PagedResultOfContactConversationSummaryDto'] =
  {
    items: [heldContactSummary, closedContactSummary],
    totalCount: 3,
    page: 1,
    pageSize: 25,
    totalPages: 2,
    hasNextPage: true,
    hasPreviousPage: false,
  };

/**
 * Page 2 after a new conversation of the contact started between the two reads: offset paging shifted
 * page 1's last row down, so it is served again first (W2).
 */
export const contactSummaryShiftedSecondPage: Schemas['PagedResultOfContactConversationSummaryDto'] =
  {
    items: [closedContactSummary, abandonedContactSummary],
    totalCount: 4,
    page: 2,
    pageSize: 25,
    totalPages: 2,
    hasNextPage: false,
    hasPreviousPage: true,
  };

/** `conversation-message-history.v1.json` `firstPage.body.items[0]`, the newest message. */
export const historyNewestMessage: Schemas['Message'] = {
  messageId: 'm-0003-b1c2d3e4f5a6b7c8',
  conversationId: '4f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a',
  tenantId: 'demo',
  direction: 'Outbound',
  channel: 'WhatsApp',
  senderId: 'a-9e8d7c6b5a493827',
  content: {
    blocks: [
      {
        $type: 'text',
        text: 'Your replacement card has been ordered and should arrive within five business days.',
        type: 'Text',
      },
    ],
  },
  deliveryStatus: 'Delivered',
  createdAt: '2026-10-28T10:20:05.000+00:00',
  deliveredAt: '2026-10-28T10:20:06.000+00:00',
};

/** `firstPage.body.items[1]`. */
export const historySecondMessage: Schemas['Message'] = {
  messageId: 'm-0002-a1b2c3d4e5f6a7b8',
  conversationId: '4f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a',
  tenantId: 'demo',
  direction: 'Inbound',
  channel: 'WhatsApp',
  content: {
    blocks: [
      {
        $type: 'text',
        text: 'My card was blocked after I reported it lost',
        type: 'Text',
      },
    ],
  },
  deliveryStatus: 'Delivered',
  externalMessageId: 'wamid.EXAMPLE0002',
  createdAt: '2026-10-28T09:16:30.000+00:00',
};

/** `olderPage.body.items[0]`, the oldest message. */
export const historyOldestMessage: Schemas['Message'] = {
  messageId: 'm-0001-f0e1d2c3b4a59687',
  conversationId: '4f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a',
  tenantId: 'demo',
  direction: 'Inbound',
  channel: 'WhatsApp',
  content: {
    blocks: [
      {
        $type: 'text',
        text: 'Hello',
        type: 'Text',
      },
    ],
  },
  deliveryStatus: 'Delivered',
  externalMessageId: 'wamid.EXAMPLE0001',
  createdAt: '2026-10-28T09:15:00.000+00:00',
};

export const historyFirstPage: Schemas['MessageHistoryPageDto'] = {
  items: [historyNewestMessage, historySecondMessage],
  hasMore: true,
  nextBefore: 'opaque-cursor-value-1',
};

export const historyOlderPage: Schemas['MessageHistoryPageDto'] = {
  items: [historyOldestMessage],
  hasMore: false,
};

export const historyEmptyPage: Schemas['MessageHistoryPageDto'] = {
  items: [],
  hasMore: false,
};

/** A one-page transcript holding `transferNoteMessage`, for the thread's stored-note case. */
export const historyTransferNotePage: Schemas['MessageHistoryPageDto'] = {
  items: [transferNoteMessage],
  hasMore: false,
};

/** The body of `conversation-by-id-terminal.v1.json`: a closed conversation read by id. */
export const terminalConversation: Schemas['Conversation'] = {
  conversationId: '4f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a',
  tenantId: 'demo',
  contactId: '7a1c0e2b5d3f4a6b8c9d0e1f2a3b4c5d',
  channel: 'WhatsApp',
  owner: {
    kind: 'Agent',
    ownerId: 'a-9e8d7c6b5a493827',
  },
  state: 'Closed',
  createdAt: '2026-10-28T09:15:00.000+00:00',
  closedAt: '2026-10-31T10:20:05.000+00:00',
  updatedAt: '2026-10-31T10:20:05.000+00:00',
  queuePriority: 0,
  metadata: {
    _closedReason: 'inactivity',
  },
  sessions: [],
};

/**
 * The same record with the internal metadata keys the fixture warns of. The fixture names `_offeredTo`
 * and `_offeredAt` without values, so these two values are this file's own.
 */
export const terminalConversationWithOfferMetadata: Schemas['Conversation'] = {
  conversationId: '4f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a',
  tenantId: 'demo',
  contactId: '7a1c0e2b5d3f4a6b8c9d0e1f2a3b4c5d',
  channel: 'WhatsApp',
  state: 'Closed',
  createdAt: '2026-10-28T09:15:00.000+00:00',
  closedAt: '2026-10-31T10:20:05.000+00:00',
  metadata: {
    _closedReason: 'inactivity',
    _offeredTo: 'a-9e8d7c6b5a493827',
    _offeredAt: '2026-10-28T09:15:30.000+00:00',
  },
};

const everyConversationState = {
  Queued: true,
  Offered: true,
  Active: true,
  OnHold: true,
  Consulting: true,
  WrapUp: true,
  WaitingForCustomer: true,
  Snoozed: true,
  Resolved: true,
  Escalated: true,
  Closed: true,
  Abandoned: true,
  Merged: true,
  Spam: true,
} satisfies Record<Schemas['ConversationState'], true>;

/** Every `ConversationState`; the `Record` above makes a value the schema adds or drops a compile error. */
export const conversationStateValues = Object.keys(
  everyConversationState,
) as Schemas['ConversationState'][];

/** The 403 body of `conversation-read-refusals.v1.json`. */
export const notReadableRefusal: Schemas['ErrorResponse'] = { error: 'not-readable' };

/** The 400 body of `conversation-message-history.v1.json` `invalidCursor`. */
export const invalidCursorRefusal: Schemas['ErrorResponse'] = { error: 'invalid-cursor' };

/** The `metadata` every SSE frame of the two fixtures below carries, with its `occurredAt`. */
interface SseFrameMetadata {
  tenantId: string;
  occurredAt: string;
}

/**
 * `data` of a `conversation.message` frame, as `conversation-message-event.v1.json` pins it. No generated
 * schema covers SSE data, so this names the frame's members (W11).
 */
export interface ConversationMessageFrameData {
  conversationId: string;
  messageId: string;
  sender: string;
  text: string;
  tenantId: string;
  type: string;
  timestamp: string;
  eventType: string;
  metadata: SseFrameMetadata;
}

/**
 * `frame.data` of the fixture: the live copy of `historyNewestMessage` (`identityWithHistory`). Its
 * `text` is the channel name, not the message (`_observedOnMain` (1)).
 */
export const conversationMessageFrame: ConversationMessageFrameData = {
  conversationId: '4f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a',
  messageId: 'm-0003-b1c2d3e4f5a6b7c8',
  sender: 'Outbound',
  text: 'WhatsApp',
  tenantId: 'demo',
  type: 'conversation.message',
  timestamp: '2026-11-03T10:42:07.512+00:00',
  eventType: 'conversation.message',
  metadata: { tenantId: 'demo', occurredAt: '2026-11-03T10:42:07.512+00:00' },
};

/**
 * A `TypingIndicator` frame: `messageId` `""` (`identityWithHistory.exception`) and the channel name in
 * `text` (`fields.text`). The fixture has no such frame, so its other values are the frame's above.
 */
export const typingIndicatorFrame: ConversationMessageFrameData = {
  conversationId: '4f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a',
  messageId: '',
  sender: 'TypingIndicator',
  text: 'WhatsApp',
  tenantId: 'demo',
  type: 'conversation.message',
  timestamp: '2026-11-03T10:42:07.512+00:00',
  eventType: 'conversation.message',
  metadata: { tenantId: 'demo', occurredAt: '2026-11-03T10:42:07.512+00:00' },
};

/** What the four `agentassist.*` frames of `agentassist-events.v1.json` share. */
interface AgentAssistFrameData {
  sessionId: string;
  agentId: string;
  conversationId: string;
  tenantId: string;
  type: string;
  timestamp: string;
  eventType: string;
  metadata: SseFrameMetadata;
}

/** `events["agentassist.suggestion"].data`. */
export const agentAssistSuggestionFrame: AgentAssistFrameData & {
  suggestionId: string;
  text: string;
  priority: string;
  source: string;
} = {
  sessionId: 'as-5c4b3a29',
  agentId: 'a-9e8d7c6b5a493827',
  conversationId: '4f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a',
  suggestionId: 'sg-01',
  text: 'Offer to resend the replacement card tracking number.',
  priority: 'Important',
  source: 'Keyword',
  tenantId: 'demo',
  type: 'agentassist.suggestion',
  timestamp: '2026-11-03T10:43:01.004+00:00',
  eventType: 'agentassist.suggestion',
  metadata: { tenantId: 'demo', occurredAt: '2026-11-03T10:43:01.004+00:00' },
};

/** `events["agentassist.sentiment"].data`. */
export const agentAssistSentimentFrame: AgentAssistFrameData & {
  speaker: string;
  score: number;
  label: string;
  triggerWords: string[];
} = {
  sessionId: 'as-5c4b3a29',
  agentId: 'a-9e8d7c6b5a493827',
  conversationId: '4f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a',
  speaker: 'Caller',
  score: -0.62,
  label: 'Frustrated',
  triggerWords: ['again', 'third time'],
  tenantId: 'demo',
  type: 'agentassist.sentiment',
  timestamp: '2026-11-03T10:43:02.31+00:00',
  eventType: 'agentassist.sentiment',
  metadata: { tenantId: 'demo', occurredAt: '2026-11-03T10:43:02.31+00:00' },
};

/** `events["agentassist.compliance_alert"].data`. */
export const agentAssistComplianceAlertFrame: AgentAssistFrameData & {
  ruleId: string;
  phrase: string;
  severity: string;
} = {
  sessionId: 'as-5c4b3a29',
  agentId: 'a-9e8d7c6b5a493827',
  conversationId: '4f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a',
  ruleId: 'cr-identity-check',
  phrase: 'full card number',
  severity: 'Warning',
  tenantId: 'demo',
  type: 'agentassist.compliance_alert',
  timestamp: '2026-11-03T10:43:03.777+00:00',
  eventType: 'agentassist.compliance_alert',
  metadata: { tenantId: 'demo', occurredAt: '2026-11-03T10:43:03.777+00:00' },
};

/** `events["agentassist.transcript"].data`. */
export const agentAssistTranscriptFrame: AgentAssistFrameData & {
  speaker: string;
  text: string;
  isFinal: boolean;
} = {
  sessionId: 'as-5c4b3a29',
  agentId: 'a-9e8d7c6b5a493827',
  conversationId: '4f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a',
  speaker: 'Caller',
  text: 'This is the third time I am calling about the card.',
  isFinal: true,
  tenantId: 'demo',
  type: 'agentassist.transcript',
  timestamp: '2026-11-03T10:43:00.12+00:00',
  eventType: 'agentassist.transcript',
  metadata: { tenantId: 'demo', occurredAt: '2026-11-03T10:43:00.12+00:00' },
};
