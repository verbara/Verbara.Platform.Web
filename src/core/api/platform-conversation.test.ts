import type { components } from '@/core/api/generated/openapi';
import {
  contactAnonymous,
  contactLevelOne,
  contactLevelTwo,
  contactWithoutWebChat,
  conversationStateValues,
  terminalConversation,
  terminalConversationWithOfferMetadata,
} from '@/tests/utils/contract-doubles';
import {
  mapPlatformContact,
  mapPlatformConversation,
  mapPlatformPastConversation,
  mapPlatformSupervisorConversation,
} from './platform-conversation';

const conversation: components['schemas']['Conversation'] = {
  conversationId: 'conv-1',
  tenantId: 'tenant-1',
  contactId: 'contact-1',
  channel: 'WhatsApp',
  owner: { kind: 'Queue', ownerId: 'queue-1' },
  state: 'WaitingForCustomer',
  createdAt: '2026-10-04T10:00:00+00:00',
  updatedAt: null,
};

describe('mapPlatformConversation', () => {
  it('mapPlatformConversation_ShouldUseConversationIdAndSnakeCaseState_WhenStateIsLive', () => {
    expect(mapPlatformConversation(conversation)).toEqual({
      id: 'conv-1',
      contactId: 'contact-1',
      contactName: '',
      channel: 'whatsapp',
      queueName: '',
      state: 'waiting_for_customer',
      lastMessage: '',
      lastMessageAt: '2026-10-04T10:00:00+00:00',
      unread: false,
      assignedAt: '2026-10-04T10:00:00+00:00',
    });
  });

  it.each(['Resolved', 'Escalated', 'Closed', 'Abandoned', 'Merged', 'Spam'] as const)(
    'mapPlatformConversation_ShouldDropTheConversation_WhenStateIs%s',
    (state) => {
      expect(mapPlatformConversation({ ...conversation, state })).toBeNull();
    },
  );

  it('mapPlatformConversation_ShouldSortByUpdatedAt_WhenPlatformSentOne', () => {
    const mapped = mapPlatformConversation({ ...conversation, updatedAt: '2026-10-04T11:00:00Z' });
    expect(mapped?.lastMessageAt).toBe('2026-10-04T11:00:00Z');
  });
});

describe('mapPlatformPastConversation', () => {
  it('mapPlatformPastConversation_ShouldMapTheFixtureRecord_WhenTheConversationIsClosed', () => {
    expect(mapPlatformPastConversation(terminalConversation)).toEqual({
      wireState: 'Closed',
      id: '4f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a',
      contactId: '7a1c0e2b5d3f4a6b8c9d0e1f2a3b4c5d',
      channel: 'WhatsApp',
      state: 'closed',
      createdAt: '2026-10-28T09:15:00.000+00:00',
      closedAt: '2026-10-31T10:20:05.000+00:00',
      closedReason: 'inactivity',
    });
  });

  const consoleStateNames: Record<(typeof conversationStateValues)[number], string> = {
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

  it('mapPlatformPastConversation_ShouldCoverFourteenStates_WhenTheSchemaIsRead', () => {
    expect(conversationStateValues).toHaveLength(14);
  });

  it.each(conversationStateValues)(
    'mapPlatformPastConversation_ShouldKeepTheRecord_WhenStateIs%s',
    (state) => {
      const mapped = mapPlatformPastConversation({ ...terminalConversation, state });
      expect(mapped.id).toBe('4f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a');
      expect(mapped.state).toBe(consoleStateNames[state]);
    },
  );

  it('mapPlatformPastConversation_ShouldReadOnlyClosedReason_WhenMetadataCarriesInternalKeys', () => {
    const mapped = mapPlatformPastConversation(terminalConversationWithOfferMetadata);
    expect(mapped.closedReason).toBe('inactivity');
    expect(JSON.stringify(mapped)).not.toContain('a-9e8d7c6b5a493827');
    expect(JSON.stringify(mapped)).not.toContain('offered');
  });

  it('mapPlatformPastConversation_ShouldOmitClosedReason_WhenMetadataHasNoClosedReason', () => {
    const { metadata: _metadata, ...withoutMetadata } = terminalConversation;
    expect(mapPlatformPastConversation(withoutMetadata)).not.toHaveProperty('closedReason');
    expect(
      mapPlatformPastConversation({
        ...terminalConversationWithOfferMetadata,
        metadata: { _offeredTo: 'a-9e8d7c6b5a493827' },
      }),
    ).not.toHaveProperty('closedReason');
  });

  it('mapPlatformPastConversation_ShouldOmitClosedAt_WhenTheConversationIsOpen', () => {
    const open = { ...terminalConversation, state: 'Active' as const, closedAt: null };
    expect(mapPlatformPastConversation(open)).not.toHaveProperty('closedAt');
  });

  it('mapPlatformConversation_ShouldStillDropTheRecord_WhenTheFixtureRecordIsClosed', () => {
    expect(mapPlatformConversation(terminalConversation)).toBeNull();
  });
});

describe('mapPlatformSupervisorConversation', () => {
  it('mapPlatformSupervisorConversation_ShouldOmitAssignedAgent_WhenOwnerIsNotAnAgent', () => {
    const mapped = mapPlatformSupervisorConversation(conversation);
    expect(mapped.id).toBe('conv-1');
    expect(mapped.channel).toBe('WhatsApp');
    expect(mapped.state).toBe('waiting_for_customer');
    expect(mapped).not.toHaveProperty('assignedAgentId');
  });

  it('mapPlatformSupervisorConversation_ShouldCarryAssignedAgent_WhenOwnerIsAnAgent', () => {
    const mapped = mapPlatformSupervisorConversation({
      ...conversation,
      owner: { kind: 'Agent', ownerId: 'agent-7' },
      state: 'Closed',
    });
    expect(mapped.assignedAgentId).toBe('agent-7');
    expect(mapped.state).toBe('closed');
  });
});

describe('mapPlatformContact', () => {
  it('mapPlatformContact_ShouldUseContactIdAndDropNulls_WhenFieldsAreNull', () => {
    expect(
      mapPlatformContact({
        contactId: 'contact-1',
        tenantId: 'tenant-1',
        firstName: 'Ana',
        lastName: null,
        company: null,
        addresses: null,
        createdAt: '2026-10-04T10:00:00+00:00',
      }),
    ).toEqual({
      id: 'contact-1',
      firstName: 'Ana',
      addresses: [],
      createdAt: '2026-10-04T10:00:00+00:00',
    });
  });

  it('mapPlatformContact_ShouldLowerCaseAddressChannels_WhenPlatformSendsEnumNames', () => {
    const mapped = mapPlatformContact({
      contactId: 'contact-1',
      tenantId: 'tenant-1',
      addresses: [
        { channel: 'Sms', address: '+573001234567' },
        { channel: 'Email', address: 'ana@example.com' },
      ],
      createdAt: '2026-10-04T10:00:00+00:00',
    });
    expect(mapped.addresses).toEqual([
      { channel: 'sms', address: '+573001234567' },
      { channel: 'email', address: 'ana@example.com' },
    ]);
  });

  it.each([
    ['Unverified', contactLevelOne],
    ['Verified', contactLevelTwo],
    ['Anonymous', contactAnonymous],
  ] as const)('mapPlatformContact_ShouldCopyIdentityLevel_WhenItIs%s', (level, contact) => {
    expect(mapPlatformContact(contact).identityLevel).toBe(level);
  });

  it('mapPlatformContact_ShouldLeaveIdentityLevelAbsent_WhenTheMemberIsAbsent', () => {
    expect(mapPlatformContact(contactWithoutWebChat)).not.toHaveProperty('identityLevel');
  });

  it('mapPlatformContact_ShouldLeaveIdentityLevelAbsent_WhenTheMemberIsNull', () => {
    expect(
      mapPlatformContact({ ...contactWithoutWebChat, identityLevel: null }),
    ).not.toHaveProperty('identityLevel');
  });
});
