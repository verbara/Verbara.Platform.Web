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
