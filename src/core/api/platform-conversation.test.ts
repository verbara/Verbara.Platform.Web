import type { components } from '@/core/api/generated/openapi';
import {
  mapPlatformContact,
  mapPlatformConversation,
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
});
