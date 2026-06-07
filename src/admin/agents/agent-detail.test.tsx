import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import type { Agent } from '@/core/api/hooks/use-agents';

const { useAgentMock } = vi.hoisted(() => ({ useAgentMock: vi.fn() }));

vi.mock('@/core/api/hooks/use-agents', () => ({
  useAgent: () => useAgentMock(),
  useUpdateAgent: () => ({ mutate: vi.fn() }),
  useDeleteAgent: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/core/api/hooks/use-skills', () => ({ useAgentSkills: () => ({ data: [] }) }));
// The edit sheet pulls users/agents/teams/tenant hooks; stub it out — this suite
// only exercises the read-only effective-capacity card.
vi.mock('./agent-form', () => ({ AgentForm: () => null }));
vi.mock('react-router-dom', () => ({
  useParams: () => ({ agentId: 'a1' }),
  useNavigate: () => vi.fn(),
}));
// PermissionGuard wraps the routing-skills card; render its children unconditionally.
vi.mock('@/core/auth/permission-guard', () => ({
  PermissionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

import AgentDetailPage from './agent-detail';

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    agentId: 'a1',
    id: 'a1',
    userId: 'u1',
    displayName: 'Alice',
    state: 'available',
    skills: [],
    userEmail: 'alice@acme.test',
    createdAt: '2026-01-01T00:00:00Z',
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
