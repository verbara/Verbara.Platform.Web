import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/core/api/hooks/use-users', () => ({
  useUsers: () => ({ data: [{ id: 'u1', email: 'alice@acme.test', displayName: 'Alice' }] }),
}));
vi.mock('@/core/api/hooks/use-agents', () => ({ useAgents: () => ({ data: [] }) }));
vi.mock('@/core/api/hooks/use-teams', () => ({ useTeams: () => ({ data: [] }) }));
// W6 — the capacity section reads tenant defaults (placeholder source) + the active
// tenant id; stub both so the form renders without a QueryClient/auth provider.
vi.mock('@/admin/tenants/use-tenant-settings', () => ({
  useTenantSettings: () => ({
    data: {
      operational: {
        maxVoiceDefault: 1,
        maxChatDefault: 3,
        maxEmailDefault: 5,
        maxSmsDefault: 3,
        maxTotalDefault: 6,
      },
    },
  }),
}));
vi.mock('@/core/auth/auth-store', () => ({
  useAuthStore: (selector: (s: { tenantId: string }) => unknown) => selector({ tenantId: 't1' }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

import { AgentForm } from './agent-form';
import { generateSipPassword } from './sip-password';

describe('generateSipPassword', () => {
  it('generateSipPassword_ShouldReturn16AlphanumericChars', () => {
    const pw = generateSipPassword();
    expect(pw).toMatch(/^[A-Za-z0-9]{16}$/);
  });

  it('generateSipPassword_ShouldBeRandom_AcrossCalls', () => {
    expect(generateSipPassword()).not.toBe(generateSipPassword());
  });
});

describe('AgentForm SIP credentials', () => {
  it('GenerateButton_ShouldFillSipPasswordField', () => {
    render(<AgentForm open mode="create" onOpenChange={() => {}} onSubmit={() => {}} />);
    const input = screen.getByTestId('agent-sipPassword') as HTMLInputElement;
    expect(input.value).toBe('');
    fireEvent.click(screen.getByTestId('agent-generate-sip'));
    expect((screen.getByTestId('agent-sipPassword') as HTMLInputElement).value).toMatch(
      /^[A-Za-z0-9]{16}$/,
    );
  });

  it('AgentForm_ShouldSubmitExtensionAndSipPassword', async () => {
    const onSubmit = vi.fn();
    render(
      <AgentForm
        open
        mode="edit"
        onOpenChange={() => {}}
        onSubmit={onSubmit}
        defaultValues={{ userId: 'u1', displayName: 'Alice', teamId: '', skills: [] }}
      />,
    );
    fireEvent.change(screen.getByTestId('agent-extension'), { target: { value: '1001' } });
    fireEvent.click(screen.getByTestId('agent-generate-sip'));
    fireEvent.submit(screen.getByTestId('agent-form'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const arg = onSubmit.mock.calls[0][0] as { extension?: string; sipPassword?: string };
    expect(arg.extension).toBe('1001');
    expect(arg.sipPassword).toMatch(/^[A-Za-z0-9]{16}$/);
  });
});

// W6 — per-agent channel-capacity override. The mocked useTenantSettings above
// supplies the inherited defaults (maxChat 3, maxEmail 5, maxSms 3, maxTotal 6).
type CapacityGroup = {
  maxVoice: number | null;
  maxChat: number | null;
  maxEmail: number | null;
  maxSms: number | null;
  maxTotal: number | null;
};

describe('AgentForm channel capacity (W6)', () => {
  it('AgentForm_ShouldRenderVoiceCapacityReadOnly_PinnedToOne', () => {
    render(<AgentForm open mode="create" onOpenChange={() => {}} onSubmit={() => {}} />);
    const voice = screen.getByTestId('agent-capacity-voice') as HTMLInputElement;
    expect(voice.value).toBe('1');
    expect(voice).toBeDisabled();
    expect(voice).toHaveAttribute('readonly');
  });

  it('AgentForm_ShouldShowTenantDefaultAsPlaceholder_WhenNoOverride', () => {
    render(<AgentForm open mode="create" onOpenChange={() => {}} onSubmit={() => {}} />);
    const chat = screen.getByTestId('agent-capacity-maxChat') as HTMLInputElement;
    expect(chat.value).toBe('');
    expect(chat).toHaveAttribute('placeholder', '3');
    // No override entered → the field reports the inherited state.
    expect(screen.getByTestId('agent-capacity-maxChat-state')).toHaveTextContent(
      'admin:agents.capacity.inherited',
    );
  });

  it('AgentForm_ShouldSubmitCapacityOverride_WhenChatEntered', async () => {
    const onSubmit = vi.fn();
    render(
      <AgentForm
        open
        mode="edit"
        onOpenChange={() => {}}
        onSubmit={onSubmit}
        defaultValues={{ userId: 'u1', displayName: 'Alice', teamId: '', skills: [] }}
      />,
    );
    fireEvent.change(screen.getByTestId('agent-capacity-maxChat'), { target: { value: '4' } });
    fireEvent.submit(screen.getByTestId('agent-form'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const arg = onSubmit.mock.calls[0][0] as { capacity?: CapacityGroup };
    expect(arg.capacity?.maxChat).toBe(4);
    // Untouched fields stay null = inherit the tenant default.
    expect(arg.capacity?.maxEmail).toBeNull();
    expect(arg.capacity?.maxSms).toBeNull();
    expect(arg.capacity?.maxTotal).toBeNull();
  });

  it('AgentForm_ShouldFlagOverriddenState_WhenFieldEntered', () => {
    render(<AgentForm open mode="create" onOpenChange={() => {}} onSubmit={() => {}} />);
    fireEvent.change(screen.getByTestId('agent-capacity-maxChat'), { target: { value: '4' } });
    expect(screen.getByTestId('agent-capacity-maxChat-state')).toHaveTextContent(
      'admin:agents.capacity.overridden',
    );
  });

  it('AgentForm_ShouldShowMaxTotalWarning_WhenTotalBelowChatCap', () => {
    render(<AgentForm open mode="create" onOpenChange={() => {}} onSubmit={() => {}} />);
    expect(screen.queryByTestId('agent-capacity-total-warning')).toBeNull();
    // Total 2 < Chat default 3 → advisory appears (non-blocking).
    fireEvent.change(screen.getByTestId('agent-capacity-maxTotal'), { target: { value: '2' } });
    expect(screen.getByTestId('agent-capacity-total-warning')).toBeInTheDocument();
  });
});
