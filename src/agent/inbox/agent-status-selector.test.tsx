import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Agent } from '@/core/api/hooks/use-agents';

// The status selector reads /agents/me and reflects the backend's PascalCase `state` /
// `pendingState`. We drive it entirely through the (mocked) use-agents hooks — no network, no
// QueryClient — and assert the rendered label + pending affordances. base-ui's Select renders its
// options in a portal, but the trigger label, pending hint, and force/cancel buttons all render
// inline, so these assertions never need to open the listbox.

const { useAgentMeMock, updateStateMutateMock, forcePauseMutateMock, cancelPauseMutateMock } =
  vi.hoisted(() => ({
    useAgentMeMock: vi.fn(),
    updateStateMutateMock: vi.fn(),
    forcePauseMutateMock: vi.fn(),
    cancelPauseMutateMock: vi.fn(),
  }));

vi.mock('@/core/api/hooks/use-agents', () => ({
  useAgentMe: () => useAgentMeMock(),
  useUpdateAgentState: () => ({ mutate: updateStateMutateMock, isPending: false }),
  useForcePendingPause: () => ({ mutate: forcePauseMutateMock, isPending: false }),
  useCancelPendingPause: () => ({ mutate: cancelPauseMutateMock, isPending: false }),
}));

// i18n stub: resolve the keys this component uses (incl. interpolation) so assertions can match the
// real rendered copy rather than raw keys.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const dict: Record<string, string> = {
        'agent_status.available': 'Available',
        'agent_status.busy': 'Busy',
        'agent_status.on_break': 'Break',
        'agent_status.lunch': 'Lunch',
        'agent_status.training': 'Training',
        'agent_status.dnd': 'DND',
        'agent_status.acw': 'ACW',
        'agent_status.offline': 'Offline',
        'agent_status.apply_now': 'Apply now',
        'agent_status.cancel_pending': 'Cancel',
      };
      if (key === 'agent_status.pending_label') return `${String(opts?.state)} (pending)`;
      if (key === 'agent_status.finish_active_items')
        return `Finish your ${String(opts?.count)} active item(s) to apply`;
      return dict[key] ?? key;
    },
    i18n: { changeLanguage: vi.fn() },
  }),
}));

import { AgentStatusSelector } from './agent-status-selector';
import { toWireState } from './agent-status-tokens';

function makeAgent(overrides: Partial<Agent>): Agent {
  return {
    agentId: 'a1',
    id: 'a1',
    userId: 'u1',
    displayName: 'Agent One',
    state: 'Available',
    skills: [],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('AgentStatusSelector', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('AgentStatusSelector_ShouldRenderLabel_WhenStateIsPascalCase', () => {
    // Regression for the casing bug: PascalCase "Available" must resolve to the Available token,
    // not fall through to the Offline fallback.
    useAgentMeMock.mockReturnValue({ data: makeAgent({ state: 'Available' }) });
    const { rerender } = render(<AgentStatusSelector />);
    const trigger = screen.getByTestId('agent-status-selector-root');
    expect(trigger).toHaveTextContent('Available');
    expect(trigger).not.toHaveTextContent('Offline');

    // "Break" must normalize to the on_break token ("Break" label), again not the fallback.
    useAgentMeMock.mockReturnValue({ data: makeAgent({ state: 'Break' }) });
    rerender(<AgentStatusSelector />);
    expect(screen.getByTestId('agent-status-selector-root')).toHaveTextContent('Break');
  });

  it('AgentStatusSelector_ShouldShowPendingLabel_WhenPendingStateSet', () => {
    useAgentMeMock.mockReturnValue({
      data: makeAgent({ state: 'Busy', pendingState: 'Break', activeWorkCount: 1 }),
    });
    render(<AgentStatusSelector />);
    expect(screen.getByTestId('agent-status-pending-label')).toHaveTextContent('Break (pending)');
  });

  it('AgentStatusSelector_ShouldShowFinishHint_WhenActiveWorkCountPositive', () => {
    useAgentMeMock.mockReturnValue({
      data: makeAgent({ state: 'Busy', pendingState: 'Break', activeWorkCount: 2 }),
    });
    render(<AgentStatusSelector />);
    expect(screen.getByTestId('agent-status-finish-hint')).toHaveTextContent(
      'Finish your 2 active item(s) to apply',
    );
  });

  it('AgentStatusSelector_ShouldCallForce_WhenApplyNowClicked', () => {
    useAgentMeMock.mockReturnValue({
      data: makeAgent({ state: 'Busy', pendingState: 'Break', activeWorkCount: 1 }),
    });
    render(<AgentStatusSelector />);
    fireEvent.click(screen.getByTestId('pause-apply-now'));
    expect(forcePauseMutateMock).toHaveBeenCalledTimes(1);
  });

  it('AgentStatusSelector_ShouldCallCancel_WhenCancelClicked', () => {
    useAgentMeMock.mockReturnValue({
      data: makeAgent({ state: 'Busy', pendingState: 'Break', activeWorkCount: 1 }),
    });
    render(<AgentStatusSelector />);
    fireEvent.click(screen.getByTestId('pause-cancel'));
    expect(cancelPauseMutateMock).toHaveBeenCalledTimes(1);
  });

  it('AgentStatusSelector_ShouldNotShowPendingControls_WhenNoPending', () => {
    useAgentMeMock.mockReturnValue({ data: makeAgent({ state: 'Available' }) });
    render(<AgentStatusSelector />);
    expect(screen.queryByTestId('agent-status-pending-controls')).toBeNull();
    expect(screen.queryByTestId('agent-status-pending-label')).toBeNull();
    expect(screen.queryByTestId('pause-apply-now')).toBeNull();
    expect(screen.queryByTestId('pause-cancel')).toBeNull();
  });

  // C2 contract: the UI's Break token is `on_break`, but the backend AgentState enum
  // member is `Break` (NOT a case variant), so the request path MUST map it or the
  // "On Break" deferred pause 400s. Other tokens round-trip via case-insensitive enum binding.
  it('toWireState_ShouldMapOnBreakToBreak_WhenSending', () => {
    expect(toWireState('on_break')).toBe('Break');
  });

  it('toWireState_ShouldPassThroughOtherTokens_WhenSending', () => {
    for (const token of ['available', 'busy', 'lunch', 'training', 'dnd', 'acw', 'offline']) {
      expect(toWireState(token)).toBe(token);
    }
  });
});
