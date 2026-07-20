import {
  useAgentAiStore,
  flattenAiSessions,
  sessionHasData,
  EMPTY_SESSION,
  AgentSuggestion,
  SentimentReading,
  ComplianceAlert,
  TranscriptSegment,
  AgentAiSession,
} from './agent-ai-store';

const makeSuggestion = (overrides: Partial<AgentSuggestion> = {}): AgentSuggestion => ({
  id: 'sug-1',
  text: 'Offer the retention discount',
  priority: 'Important',
  source: 'KnowledgeBase',
  timestamp: '2026-05-31T10:00:00Z',
  ...overrides,
});

const makeSentiment = (overrides: Partial<SentimentReading> = {}): SentimentReading => ({
  speaker: 'Caller',
  score: -0.4,
  label: 'Negative',
  triggerWords: ['cancel'],
  timestamp: '2026-05-31T10:00:00Z',
  ...overrides,
});

const makeAlert = (overrides: Partial<ComplianceAlert> = {}): ComplianceAlert => ({
  ruleId: 'PCI-001',
  phrase: 'card number',
  severity: 'Critical',
  timestamp: '2026-05-31T10:00:00Z',
  ...overrides,
});

const makeSegment = (overrides: Partial<TranscriptSegment> = {}): TranscriptSegment => ({
  speaker: 'Caller',
  text: 'I want to cancel',
  isFinal: true,
  timestamp: '2026-05-31T10:00:00Z',
  ...overrides,
});

describe('AgentAiStore (per-conversation)', () => {
  beforeEach(() => {
    useAgentAiStore.setState({ sessions: {} });
  });

  it('addSuggestion_ShouldScopeToConversation_WhenDifferentIds', () => {
    const store = useAgentAiStore.getState();
    store.addSuggestion('conv-A', makeSuggestion({ id: 'a1' }));
    store.addSuggestion('conv-B', makeSuggestion({ id: 'b1' }));
    const sessions = useAgentAiStore.getState().sessions;
    expect(sessions['conv-A']!.suggestions.map((s) => s.id)).toEqual(['a1']);
    expect(sessions['conv-B']!.suggestions.map((s) => s.id)).toEqual(['b1']);
  });

  it('addSuggestion_ShouldPrependAndCapAtTen_WhenManyAdded', () => {
    const store = useAgentAiStore.getState();
    for (let i = 0; i < 12; i++) {
      store.addSuggestion('conv-A', makeSuggestion({ id: `s${i}` }));
    }
    const list = useAgentAiStore.getState().sessions['conv-A']!.suggestions;
    expect(list).toHaveLength(10);
    expect(list[0]!.id).toBe('s11'); // newest first
  });

  it('dismissSuggestion_ShouldRemoveOnlyFromTargetConversation', () => {
    const store = useAgentAiStore.getState();
    store.addSuggestion('conv-A', makeSuggestion({ id: 'a1' }));
    store.addSuggestion('conv-B', makeSuggestion({ id: 'a1' })); // same id, different conv
    store.dismissSuggestion('conv-A', 'a1');
    const sessions = useAgentAiStore.getState().sessions;
    expect(sessions['conv-A']!.suggestions).toHaveLength(0);
    expect(sessions['conv-B']!.suggestions).toHaveLength(1);
  });

  it('updateSentiment_ShouldScopeToConversation', () => {
    const store = useAgentAiStore.getState();
    store.updateSentiment('conv-A', makeSentiment({ label: 'Negative' }));
    store.updateSentiment('conv-B', makeSentiment({ label: 'Positive', score: 0.7 }));
    const sessions = useAgentAiStore.getState().sessions;
    expect(sessions['conv-A']!.sentiment!.label).toBe('Negative');
    expect(sessions['conv-B']!.sentiment!.label).toBe('Positive');
  });

  it('addComplianceAlert_ShouldScopeAndCapAtTwenty', () => {
    const store = useAgentAiStore.getState();
    for (let i = 0; i < 22; i++) {
      store.addComplianceAlert('conv-A', makeAlert({ ruleId: `r${i}` }));
    }
    store.addComplianceAlert('conv-B', makeAlert({ ruleId: 'b-rule' }));
    const sessions = useAgentAiStore.getState().sessions;
    expect(sessions['conv-A']!.complianceAlerts).toHaveLength(20);
    expect(sessions['conv-A']!.complianceAlerts[0]!.ruleId).toBe('r21'); // newest first
    expect(sessions['conv-B']!.complianceAlerts).toHaveLength(1);
  });

  it('acknowledgeAlert_ShouldRemoveOnlyFromTargetConversation', () => {
    const store = useAgentAiStore.getState();
    store.addComplianceAlert('conv-A', makeAlert({ ruleId: 'PCI-001' }));
    store.addComplianceAlert('conv-B', makeAlert({ ruleId: 'PCI-001' }));
    store.acknowledgeAlert('conv-A', 'PCI-001');
    const sessions = useAgentAiStore.getState().sessions;
    expect(sessions['conv-A']!.complianceAlerts).toHaveLength(0);
    expect(sessions['conv-B']!.complianceAlerts).toHaveLength(1);
  });

  it('addTranscript_ShouldAppendInOrder_ScopedToConversation', () => {
    const store = useAgentAiStore.getState();
    store.addTranscript('conv-A', makeSegment({ text: 'first' }));
    store.addTranscript('conv-A', makeSegment({ text: 'second' }));
    store.addTranscript('conv-B', makeSegment({ text: 'other' }));
    const sessions = useAgentAiStore.getState().sessions;
    expect(sessions['conv-A']!.transcript.map((s) => s.text)).toEqual(['first', 'second']);
    expect(sessions['conv-B']!.transcript.map((s) => s.text)).toEqual(['other']);
  });

  it('clearSession_ShouldRemoveOnlyTargetConversation', () => {
    const store = useAgentAiStore.getState();
    store.addSuggestion('conv-A', makeSuggestion());
    store.addSuggestion('conv-B', makeSuggestion());
    store.clearSession('conv-A');
    const sessions = useAgentAiStore.getState().sessions;
    expect(sessions['conv-A']).toBeUndefined();
    expect(sessions['conv-B']).toBeDefined();
  });

  it('clearSession_ShouldNoOp_WhenConversationNotFound', () => {
    const before = useAgentAiStore.getState().sessions;
    useAgentAiStore.getState().clearSession('nonexistent');
    expect(useAgentAiStore.getState().sessions).toBe(before);
  });
});

describe('sessionHasData', () => {
  it('sessionHasData_ShouldReturnFalse_WhenUndefined', () => {
    expect(sessionHasData(undefined)).toBe(false);
  });

  it('sessionHasData_ShouldReturnFalse_WhenEmpty', () => {
    expect(sessionHasData(EMPTY_SESSION)).toBe(false);
  });

  it('sessionHasData_ShouldReturnTrue_WhenAnyFieldPopulated', () => {
    expect(sessionHasData({ ...EMPTY_SESSION, suggestions: [makeSuggestion()] })).toBe(true);
    expect(sessionHasData({ ...EMPTY_SESSION, sentiment: makeSentiment() })).toBe(true);
    expect(sessionHasData({ ...EMPTY_SESSION, complianceAlerts: [makeAlert()] })).toBe(true);
    expect(sessionHasData({ ...EMPTY_SESSION, transcript: [makeSegment()] })).toBe(true);
  });
});

describe('flattenAiSessions', () => {
  it('flattenAiSessions_ShouldReturnEmpty_WhenNoSessions', () => {
    expect(flattenAiSessions({})).toEqual(EMPTY_SESSION);
  });

  it('flattenAiSessions_ShouldReturnSingleSession_WhenOnlyOne', () => {
    const session: AgentAiSession = {
      ...EMPTY_SESSION,
      suggestions: [makeSuggestion()],
      sentiment: makeSentiment(),
    };
    expect(flattenAiSessions({ 'conv-A': session })).toBe(session);
  });

  it('flattenAiSessions_ShouldMergeArraysAndPickLatestSentiment_WhenMultiple', () => {
    const a: AgentAiSession = {
      suggestions: [makeSuggestion({ id: 'a-sug' })],
      sentiment: makeSentiment({ label: 'Negative', timestamp: '2026-05-31T10:00:00Z' }),
      complianceAlerts: [makeAlert({ ruleId: 'a-rule' })],
      transcript: [makeSegment({ text: 'a-seg' })],
    };
    const b: AgentAiSession = {
      suggestions: [makeSuggestion({ id: 'b-sug' })],
      sentiment: makeSentiment({ label: 'Positive', timestamp: '2026-05-31T10:05:00Z' }),
      complianceAlerts: [makeAlert({ ruleId: 'b-rule' })],
      transcript: [makeSegment({ text: 'b-seg' })],
    };
    const merged = flattenAiSessions({ 'conv-A': a, 'conv-B': b });
    expect(merged.suggestions.map((s) => s.id).sort()).toEqual(['a-sug', 'b-sug']);
    expect(merged.complianceAlerts.map((s) => s.ruleId).sort()).toEqual(['a-rule', 'b-rule']);
    expect(merged.transcript).toHaveLength(2);
    // Latest sentiment by timestamp wins.
    expect(merged.sentiment!.label).toBe('Positive');
  });

  it('flattenAiSessions_ShouldReturnNullSentiment_WhenNoneSet', () => {
    const a: AgentAiSession = { ...EMPTY_SESSION, suggestions: [makeSuggestion({ id: '1' })] };
    const b: AgentAiSession = { ...EMPTY_SESSION, suggestions: [makeSuggestion({ id: '2' })] };
    expect(flattenAiSessions({ a, b }).sentiment).toBeNull();
  });
});
