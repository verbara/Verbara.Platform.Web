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
