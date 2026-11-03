import { describe, it, expect, vi, afterEach } from 'vitest';
import type { BridgeHandle } from './postmessage-bridge';
import { FORGET_VISITOR, VISITOR_FORGOTTEN, requestForgetVisitor } from './forget-visitor';

type Handler = (payload?: unknown) => void;

function fakeBridge() {
  const handlers = new Map<string, Set<Handler>>();
  const sent: Array<{ type: string; payload?: unknown }> = [];
  const bridge: BridgeHandle = {
    send: (type, payload) => sent.push({ type, payload }),
    on: (type, h) => {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)!.add(h);
    },
    off: (type, h) => handlers.get(type)?.delete(h),
    destroy: () => handlers.clear(),
  };
  const deliver = (type: string, payload?: unknown) => {
    for (const h of handlers.get(type) ?? []) h(payload);
  };
  return { bridge, sent, deliver, handlers };
}

afterEach(() => vi.useRealTimers());

describe('requestForgetVisitor', () => {
  it('RequestForgetVisitor_ShouldSendTheTenant_AndResolveTrue_WhenTheFrameAnswers', async () => {
    vi.useFakeTimers();
    const { bridge, sent, deliver, handlers } = fakeBridge();

    const result = requestForgetVisitor(bridge, { tenantId: 't1' });
    expect(sent).toEqual([{ type: FORGET_VISITOR, payload: { tenantId: 't1' } }]);
    deliver(VISITOR_FORGOTTEN, { tenantId: 't1' });

    await expect(result).resolves.toBe(true);
    expect(handlers.get(VISITOR_FORGOTTEN)?.size ?? 0).toBe(0);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(sent).toHaveLength(1);
  });

  it('RequestForgetVisitor_ShouldIgnoreAnAnswerForAnotherTenantOrWithoutOne', async () => {
    vi.useFakeTimers();
    const { bridge, deliver } = fakeBridge();
    const settled = vi.fn();

    void requestForgetVisitor(bridge, { tenantId: 't1' }, { timeoutMs: 500 }).then(settled);
    deliver(VISITOR_FORGOTTEN, { tenantId: 't2' });
    deliver(VISITOR_FORGOTTEN, 't1');
    deliver(VISITOR_FORGOTTEN);
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(settled).toHaveBeenCalledWith(false);
  });

  it('RequestForgetVisitor_ShouldRepeatTheRequest_UntilItTimesOut', async () => {
    vi.useFakeTimers();
    const { bridge, sent } = fakeBridge();

    const result = requestForgetVisitor(
      bridge,
      { tenantId: 't1' },
      { timeoutMs: 250, retryMs: 100 },
    );
    await vi.advanceTimersByTimeAsync(250);

    await expect(result).resolves.toBe(false);
    expect(sent.map((m) => m.type)).toEqual([FORGET_VISITOR, FORGET_VISITOR, FORGET_VISITOR]);
  });
});
