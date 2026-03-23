import { useConversationStore, Conversation, Message } from './conversation-store';

const makeConversation = (overrides: Partial<Conversation> = {}): Conversation => ({
  id: 'conv-1',
  contactId: 'contact-1',
  contactName: 'John Doe',
  channel: 'whatsapp',
  queueName: 'support',
  state: 'active',
  lastMessage: 'Hello',
  lastMessageAt: '2026-03-22T10:00:00Z',
  unread: true,
  assignedAt: '2026-03-22T09:55:00Z',
  ...overrides,
});

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  id: 'msg-1',
  conversationId: 'conv-1',
  sender: 'customer',
  senderName: 'John Doe',
  text: 'Hello',
  timestamp: '2026-03-22T10:00:00Z',
  type: 'text',
  ...overrides,
});

describe('ConversationStore', () => {
  beforeEach(() => {
    useConversationStore.setState({
      conversations: {},
      messages: {},
      selectedId: null,
      filter: 'active',
    });
  });

  it('upsertConversation_ShouldAddConversation_WhenNew', () => {
    const conv = makeConversation();
    useConversationStore.getState().upsertConversation(conv);
    expect(useConversationStore.getState().conversations['conv-1']).toEqual(conv);
  });

  it('upsertConversation_ShouldUpdateExisting_WhenIdMatches', () => {
    useConversationStore.getState().upsertConversation(makeConversation());
    useConversationStore.getState().upsertConversation(
      makeConversation({ lastMessage: 'Updated' }),
    );
    expect(useConversationStore.getState().conversations['conv-1']!.lastMessage).toBe('Updated');
    expect(Object.keys(useConversationStore.getState().conversations)).toHaveLength(1);
  });

  it('select_ShouldSetSelectedId_WhenCalled', () => {
    useConversationStore.getState().select('conv-1');
    expect(useConversationStore.getState().selectedId).toBe('conv-1');
  });

  it('setFilter_ShouldChangeFilter_WhenCalled', () => {
    useConversationStore.getState().setFilter('waiting');
    expect(useConversationStore.getState().filter).toBe('waiting');
  });

  it('addMessage_ShouldAppendMessage_WhenConversationExists', () => {
    const msg1 = makeMessage();
    const msg2 = makeMessage({ id: 'msg-2', text: 'World' });
    useConversationStore.getState().addMessage('conv-1', msg1);
    useConversationStore.getState().addMessage('conv-1', msg2);
    const messages = useConversationStore.getState().messages['conv-1']!;
    expect(messages).toHaveLength(2);
    expect(messages[0]!.text).toBe('Hello');
    expect(messages[1]!.text).toBe('World');
  });

  it('markRead_ShouldSetUnreadToFalse_WhenConversationExists', () => {
    useConversationStore.getState().upsertConversation(makeConversation({ unread: true }));
    useConversationStore.getState().markRead('conv-1');
    expect(useConversationStore.getState().conversations['conv-1']!.unread).toBe(false);
  });

  it('markRead_ShouldNoOp_WhenConversationNotFound', () => {
    const before = useConversationStore.getState().conversations;
    useConversationStore.getState().markRead('nonexistent');
    expect(useConversationStore.getState().conversations).toBe(before);
  });

  it('removeConversation_ShouldRemoveConversationAndMessages_WhenCalled', () => {
    useConversationStore.getState().upsertConversation(makeConversation());
    useConversationStore.getState().addMessage('conv-1', makeMessage());
    useConversationStore.getState().removeConversation('conv-1');
    expect(useConversationStore.getState().conversations['conv-1']).toBeUndefined();
    expect(useConversationStore.getState().messages['conv-1']).toBeUndefined();
  });

  it('removeConversation_ShouldClearSelectedId_WhenSelectedMatches', () => {
    useConversationStore.getState().upsertConversation(makeConversation());
    useConversationStore.getState().select('conv-1');
    useConversationStore.getState().removeConversation('conv-1');
    expect(useConversationStore.getState().selectedId).toBeNull();
  });

  it('removeConversation_ShouldKeepSelectedId_WhenSelectedDiffers', () => {
    useConversationStore.getState().upsertConversation(makeConversation());
    useConversationStore.getState().upsertConversation(makeConversation({ id: 'conv-2' }));
    useConversationStore.getState().select('conv-2');
    useConversationStore.getState().removeConversation('conv-1');
    expect(useConversationStore.getState().selectedId).toBe('conv-2');
  });

  it('filteredConversations_ShouldReturnOnlyMatchingFilter_WhenFilterIsActive', () => {
    useConversationStore.getState().upsertConversation(makeConversation({ id: 'c1', state: 'active' }));
    useConversationStore.getState().upsertConversation(makeConversation({ id: 'c2', state: 'queued' }));
    useConversationStore.getState().upsertConversation(makeConversation({ id: 'c3', state: 'wrap_up' }));
    useConversationStore.getState().setFilter('active');
    const result = useConversationStore.getState().filteredConversations();
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('c1');
  });

  it('filteredConversations_ShouldSortByLastMessageAtDesc_WhenMultipleMatch', () => {
    useConversationStore.getState().upsertConversation(
      makeConversation({ id: 'c1', state: 'active', lastMessageAt: '2026-03-22T08:00:00Z' }),
    );
    useConversationStore.getState().upsertConversation(
      makeConversation({ id: 'c2', state: 'active', lastMessageAt: '2026-03-22T12:00:00Z' }),
    );
    useConversationStore.getState().upsertConversation(
      makeConversation({ id: 'c3', state: 'active', lastMessageAt: '2026-03-22T10:00:00Z' }),
    );
    const result = useConversationStore.getState().filteredConversations();
    expect(result.map((c) => c.id)).toEqual(['c2', 'c3', 'c1']);
  });
});
