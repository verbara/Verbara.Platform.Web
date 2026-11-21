import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * `OnCsatResponseRecorded` handler test (csat-completion, task 3.2 / D3).
 *
 * Asserts the realtime handler invalidates the scope-wide aggregate CSAT query
 * key so the wallboard card re-fetches the server-computed roll-up, and that a
 * `null` `comment` (voice DTMF) does NOT suppress that refresh (pure enrichment
 * over the poll).
 */

// ── Spy on the shared query client's invalidateQueries. ──
const invalidateQueries = vi.fn();
vi.mock('@/core/api/query-client', () => ({
  queryClient: { invalidateQueries: (...args: unknown[]) => invalidateQueries(...args) },
}));

// ── The store is irrelevant to this handler; stub the pieces registerHandlers touches. ──
const storeApi = {
  setConnectionState: vi.fn(),
  removePresence: vi.fn(),
  upsertPresence: vi.fn(),
  setObservedSupervision: vi.fn(),
};
vi.mock('@/core/stores/realtime-store', () => ({
  useRealtimeStore: { getState: () => storeApi },
}));

// ── Auth store is only read inside buildConnection, not registerHandlers. ──
vi.mock('@/core/auth/auth-store', () => ({
  useAuthStore: { getState: () => ({ accessToken: '' }) },
}));

import { registerHandlers } from './platform-hub';

/** Minimal fake HubConnection capturing every `conn.on(method, handler)`. */
function makeFakeConnection() {
  const handlers = new Map<string, (payload: unknown) => void>();
  const conn = {
    on: (method: string, handler: (payload: unknown) => void) => {
      handlers.set(method, handler);
    },
    onreconnecting: vi.fn(),
    onreconnected: vi.fn(),
    onclose: vi.fn(),
  };
  // registerHandlers expects a HubConnection; only `.on` + lifecycle hooks are used.
  return { conn: conn as never, handlers };
}

const AGGREGATE_KEY = { queryKey: ['analytics', 'csat', 'aggregate'] };

describe('platform-hub OnCsatResponseRecorded handler', () => {
  beforeEach(() => invalidateQueries.mockReset());

  it('Handler_ShouldInvalidateAggregateQuery_WhenResponseRecorded', () => {
    const { conn, handlers } = makeFakeConnection();
    registerHandlers(conn);

    const handler = handlers.get('OnCsatResponseRecorded');
    expect(handler).toBeDefined();

    handler!({
      tenantId: 'ten-42',
      responseId: 'resp-3b9d70aa',
      surveyId: 'srv-csat-v1',
      conversationId: 'conv-8f2a1c4e',
      channel: 'voice',
      queueName: 'support-tier1',
      rating: 4,
      comment: 'Great service',
      capturedAt: '2026-07-13T09:15:00Z',
    });

    expect(invalidateQueries).toHaveBeenCalledOnce();
    expect(invalidateQueries).toHaveBeenCalledWith(AGGREGATE_KEY);
  });

  it('Handler_ShouldStillInvalidate_WhenCommentIsNull', () => {
    const { conn, handlers } = makeFakeConnection();
    registerHandlers(conn);

    const handler = handlers.get('OnCsatResponseRecorded');
    // A null comment (voice DTMF capture) must NOT gate the refresh.
    handler!({
      tenantId: 'ten-42',
      responseId: 'resp-3b9d70aa',
      surveyId: 'srv-csat-v1',
      conversationId: 'conv-8f2a1c4e',
      channel: 'voice',
      queueName: 'support-tier1',
      rating: 4,
      comment: null,
      capturedAt: '2026-07-13T09:15:00Z',
    });

    expect(invalidateQueries).toHaveBeenCalledOnce();
    expect(invalidateQueries).toHaveBeenCalledWith(AGGREGATE_KEY);
  });
});

/**
 * The hub whisper path is gone (change `supervisor-whisper-reaches-the-agent`, design D1): the whisper
 * reaches the agent as an `agentassist.suggestion` over SSE, so a hub `OnWhisperReceived` message has
 * no handler and changes no store state.
 */
describe('platform-hub OnWhisperReceived (removed)', () => {
  beforeEach(() => {
    for (const fn of Object.values(storeApi)) fn.mockReset();
    invalidateQueries.mockReset();
  });

  it('Hub_ShouldChangeNoStoreState_WhenAnOnWhisperReceivedMessageArrives', () => {
    const { conn, handlers } = makeFakeConnection();
    registerHandlers(conn);

    // SignalR dispatches a message only to a registered handler; there must be none.
    expect(handlers.has('OnWhisperReceived')).toBe(false);
    handlers.get('OnWhisperReceived')?.({
      conversationId: 'conv-1',
      text: 'hold on',
      arrivedAt: '2026-11-21T10:00:00Z',
    });

    for (const fn of Object.values(storeApi)) expect(fn).not.toHaveBeenCalled();
    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});
