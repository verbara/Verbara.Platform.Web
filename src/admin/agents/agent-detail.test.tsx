import { render, screen, within, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { Agent } from '@/core/api/hooks/use-agents';

const { useAgentMock, forceOfflineMutateMock } = vi.hoisted(() => ({
  useAgentMock: vi.fn(),
  forceOfflineMutateMock: vi.fn(),
}));

// Toggle for the permission-gated force-offline button. Default: granted (guard
// renders children). Flip to false to assert the button is withheld.
let permissionGranted = true;

vi.mock('@/core/api/hooks/use-agents', () => ({
  useAgent: () => useAgentMock(),
  useUpdateAgent: () => ({ mutate: vi.fn() }),
  useDeleteAgent: () => ({ mutate: vi.fn() }),
  useForceOffline: () => ({ mutate: forceOfflineMutateMock, isPending: false }),
}));
vi.mock('@/core/api/hooks/use-skills', () => ({ useAgentSkills: () => ({ data: [] }) }));
// The edit sheet pulls users/agents/teams/tenant hooks; stub it out — this suite
// only exercises the read-only effective-capacity card.
vi.mock('./agent-form', () => ({ AgentForm: () => null }));
vi.mock('react-router', () => ({
  useParams: () => ({ agentId: 'a1' }),
  useNavigate: () => vi.fn(),
}));
// PermissionGuard wraps the routing-skills card and the force-offline button.
// Renders children only when `permissionGranted` is set (default true), so a
// suite can assert the permission-gated render path both ways.
vi.mock('@/core/auth/permission-guard', () => ({
  PermissionGuard: ({ children }: { children: React.ReactNode }) =>
    permissionGranted ? <>{children}</> : null,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // `t(key, defaultValue?)` returns the string default; `t(key, optsObject)`
    // (e.g. ConfirmDeleteDialog's title interpolation) must still return a string
    // so React can render it — never the raw options object.
    t: (key: string, second?: unknown) => (typeof second === 'string' ? second : key),
    i18n: { changeLanguage: vi.fn() },
  }),
}));

import AgentDetailPage from './agent-detail';

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    agentId: 'a1',
    id: 'a1',
    tenantId: 't1',
    userId: 'u1',
    displayName: 'Alice',
    state: 'Available',
    pendingState: null,
    pendingReason: null,
    pendingSince: null,
    hasPendingPause: false,
    teamId: null,
    skills: [],
    extension: null,
    autoAnswer: null,
    canAcceptWork: true,
    userEmail: 'alice@acme.test',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: null,
    effectiveCapacity: { maxVoice: 1, maxChat: 4, maxEmail: 5, maxSms: 3, maxTotal: 7 },
    // maxChat overridden (non-null); the rest inherit (null).
    capacityOverride: { maxVoice: null, maxChat: 4, maxEmail: null, maxSms: null, maxTotal: null },
    ...overrides,
  };
}

describe('AgentDetailPage channel capacity (W6)', () => {
  it('AgentDetailPage_ShouldRenderEffectiveCapacityValues', () => {
    useAgentMock.mockReturnValue({ data: makeAgent() });
    render(<AgentDetailPage />);
    const card = screen.getByTestId('agent-detail-capacity');
    expect(within(card).getByText('4')).toBeInTheDocument();
    expect(within(card).getByText('5')).toBeInTheDocument();
    expect(within(card).getByText('7')).toBeInTheDocument();
  });

  it('AgentDetailPage_ShouldTagOverriddenAndInherited_PerChannel', () => {
    useAgentMock.mockReturnValue({ data: makeAgent() });
    render(<AgentDetailPage />);
    const card = screen.getByTestId('agent-detail-capacity');
    // maxChat is overridden → exactly one "Overridden" badge; the other 3 inherit.
    expect(within(card).getAllByText('admin:agents.capacity.overridden')).toHaveLength(1);
    expect(within(card).getAllByText('admin:agents.capacity.inherited')).toHaveLength(3);
  });

  it('AgentDetailPage_ShouldRenderVoiceAsFixed_WithoutBadge', () => {
    useAgentMock.mockReturnValue({ data: makeAgent() });
    render(<AgentDetailPage />);
    const card = screen.getByTestId('agent-detail-capacity');
    expect(within(card).getByText('admin:agents.capacity.voiceFixed')).toBeInTheDocument();
  });

  it('AgentDetailPage_ShouldHideCapacityCard_WhenEffectiveCapacityAbsent', () => {
    useAgentMock.mockReturnValue({ data: makeAgent({ effectiveCapacity: undefined }) });
    render(<AgentDetailPage />);
    expect(screen.queryByTestId('agent-detail-capacity')).toBeNull();
  });
});

describe('AgentDetailPage force-offline (W3, ADR-0009)', () => {
  beforeEach(() => {
    permissionGranted = true;
    forceOfflineMutateMock.mockReset();
    useAgentMock.mockReturnValue({ data: makeAgent() });
  });

  it('AgentDetailPage_ShouldRenderForceOfflineButton_WhenPermissionGranted', () => {
    render(<AgentDetailPage />);
    expect(screen.getByTestId('agent-detail-force-offline')).toBeInTheDocument();
  });

  it('AgentDetailPage_ShouldHideForceOfflineButton_WhenPermissionDenied', () => {
    permissionGranted = false;
    render(<AgentDetailPage />);
    expect(screen.queryByTestId('agent-detail-force-offline')).toBeNull();
  });

  it('AgentDetailPage_ShouldNotRenderRevokeRow_UntilDialogOpened', () => {
    render(<AgentDetailPage />);
    expect(screen.queryByTestId('agent-detail-force-offline-revoke-row')).toBeNull();
  });

  it('AgentDetailPage_ShouldOpenConfirmDialogAndRevokeRow_WhenForceOfflineClicked', () => {
    render(<AgentDetailPage />);
    fireEvent.click(screen.getByTestId('agent-detail-force-offline'));
    expect(screen.getByTestId('agent-detail-force-offline-revoke-row')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-delete-word-input')).toBeInTheDocument();
  });

  it('AgentDetailPage_ShouldForceOfflineWithRevokeFalse_WhenConfirmedWithoutToggle', () => {
    render(<AgentDetailPage />);
    fireEvent.click(screen.getByTestId('agent-detail-force-offline'));

    // Type the confirmation word to arm the word-gated destructive action.
    fireEvent.change(screen.getByTestId('confirm-delete-word-input'), {
      target: { value: 'FORCE' },
    });
    fireEvent.click(screen.getByTestId('confirm-delete-btn'));

    expect(forceOfflineMutateMock).toHaveBeenCalledTimes(1);
    expect(forceOfflineMutateMock).toHaveBeenCalledWith(
      { id: 'a1', revokeSessions: false },
      expect.any(Object),
    );
  });

  it('AgentDetailPage_ShouldForceOfflineWithRevokeTrue_WhenToggleEnabledBeforeConfirm', () => {
    render(<AgentDetailPage />);
    fireEvent.click(screen.getByTestId('agent-detail-force-offline'));

    // Toggle the revoke-sessions Switch on before confirming.
    fireEvent.click(screen.getByTestId('agent-detail-force-offline-revoke'));

    fireEvent.change(screen.getByTestId('confirm-delete-word-input'), {
      target: { value: 'FORCE' },
    });
    fireEvent.click(screen.getByTestId('confirm-delete-btn'));

    expect(forceOfflineMutateMock).toHaveBeenCalledWith(
      { id: 'a1', revokeSessions: true },
      expect.any(Object),
    );
  });

  it('AgentDetailPage_ShouldClosesDialogAndResetRevoke_OnMutationSuccess', () => {
    // Drive the onSuccess callback the component passes as the mutate 2nd arg,
    // covering the setForceOfflineOpen(false)/setRevokeSessions(false) handler.
    forceOfflineMutateMock.mockImplementation((_vars, opts?: { onSuccess?: () => void }) =>
      opts?.onSuccess?.(),
    );
    render(<AgentDetailPage />);
    fireEvent.click(screen.getByTestId('agent-detail-force-offline'));
    fireEvent.click(screen.getByTestId('agent-detail-force-offline-revoke'));
    fireEvent.change(screen.getByTestId('confirm-delete-word-input'), {
      target: { value: 'FORCE' },
    });
    fireEvent.click(screen.getByTestId('confirm-delete-btn'));

    expect(forceOfflineMutateMock).toHaveBeenCalled();
    // onSuccess closed the dialog → revoke row unmounts.
    expect(screen.queryByTestId('agent-detail-force-offline-revoke-row')).toBeNull();
  });

  it('AgentDetailPage_ShouldCloseDialogAndResetRevoke_WhenCancelled', () => {
    // Cancel routes through ConfirmDeleteDialog's onOpenChange(false), which the
    // page uses to close the dialog and reset the revoke toggle without mutating.
    render(<AgentDetailPage />);
    fireEvent.click(screen.getByTestId('agent-detail-force-offline'));
    fireEvent.click(screen.getByTestId('agent-detail-force-offline-revoke'));
    expect(screen.getByTestId('agent-detail-force-offline-revoke-row')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'confirm_delete_dialog.cancel' }));

    expect(forceOfflineMutateMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('agent-detail-force-offline-revoke-row')).toBeNull();
  });
});
