import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mutateAsyncMock } = vi.hoisted(() => ({ mutateAsyncMock: vi.fn() }));

vi.mock('@/admin/tenants/use-tenant-settings', () => ({
  useTenantSettings: () => ({
    data: {
      operational: {
        maxConcurrentChannels: 100,
        maxActiveCampaigns: 10,
        dialplanContextPrefix: null,
        nodeAffinity: null,
        allowedDialingModes: null,
        outboundCallerId: '+15551112222',
        // W6 — capacity defaults the operational section now requires (Voice pinned to 1).
        maxVoiceDefault: 1,
        maxChatDefault: 3,
        maxEmailDefault: 5,
        maxSmsDefault: 3,
        maxTotalDefault: 6,
      },
    },
    isLoading: false,
  }),
  useUpdateTenantSettings: () => ({ mutateAsync: mutateAsyncMock, isPending: false }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { TenantSettingsForm } from './tenant-settings-form';

describe('TenantSettingsForm — outbound caller ID (3B.2d.1)', () => {
  afterEach(() => mutateAsyncMock.mockReset());

  it('TenantSettingsForm_ShouldRenderOutboundCallerId_WithCurrentValue', () => {
    render(<TenantSettingsForm tenantId="t1" section="operational" />);
    expect(screen.getByTestId('field-outboundCallerId')).toHaveValue('+15551112222');
  });

  it('TenantSettingsForm_ShouldSubmitOutboundCallerId_WhenEdited', async () => {
    mutateAsyncMock.mockResolvedValue(undefined);
    render(<TenantSettingsForm tenantId="t1" section="operational" />);
    fireEvent.change(screen.getByTestId('field-outboundCallerId'), {
      target: { value: '+15559998888' },
    });
    fireEvent.click(screen.getByTestId('tenant-settings-submit'));
    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalled());
    expect(mutateAsyncMock.mock.calls[0][0].operational.outboundCallerId).toBe('+15559998888');
  });

  it('TenantSettingsForm_ShouldSubmitNullOutboundCallerId_WhenCleared', async () => {
    mutateAsyncMock.mockResolvedValue(undefined);
    render(<TenantSettingsForm tenantId="t1" section="operational" />);
    fireEvent.change(screen.getByTestId('field-outboundCallerId'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('tenant-settings-submit'));
    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalled());
    expect(mutateAsyncMock.mock.calls[0][0].operational.outboundCallerId).toBeNull();
  });
});

describe('TenantSettingsForm — capacity defaults (W6)', () => {
  afterEach(() => mutateAsyncMock.mockReset());

  it('TenantSettingsForm_ShouldRenderCapacityDefaults_WithCurrentValues', () => {
    render(<TenantSettingsForm tenantId="t1" section="operational" />);
    expect(screen.getByTestId('field-maxChatDefault')).toHaveValue(3);
    expect(screen.getByTestId('field-maxEmailDefault')).toHaveValue(5);
    expect(screen.getByTestId('field-maxSmsDefault')).toHaveValue(3);
    expect(screen.getByTestId('field-maxTotalDefault')).toHaveValue(6);
  });

  it('TenantSettingsForm_ShouldRenderVoiceDefaultReadOnly_PinnedToOne', () => {
    render(<TenantSettingsForm tenantId="t1" section="operational" />);
    const voice = screen.getByTestId('field-maxVoiceDefault') as HTMLInputElement;
    expect(voice.value).toBe('1');
    expect(voice).toBeDisabled();
    expect(voice).toHaveAttribute('readonly');
  });

  it('TenantSettingsForm_ShouldSubmitCapacityDefaults_WithPinnedVoice', async () => {
    mutateAsyncMock.mockResolvedValue(undefined);
    render(<TenantSettingsForm tenantId="t1" section="operational" />);
    fireEvent.change(screen.getByTestId('field-maxChatDefault'), { target: { value: '4' } });
    fireEvent.click(screen.getByTestId('tenant-settings-submit'));
    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalled());
    const op = mutateAsyncMock.mock.calls[0][0].operational;
    expect(op.maxChatDefault).toBe(4);
    expect(op.maxEmailDefault).toBe(5);
    expect(op.maxSmsDefault).toBe(3);
    expect(op.maxTotalDefault).toBe(6);
    expect(op.maxVoiceDefault).toBe(1);
  });

  it('TenantSettingsForm_ShouldShowMaxTotalWarning_WhenTotalBelowChatDefault', () => {
    render(<TenantSettingsForm tenantId="t1" section="operational" />);
    expect(screen.queryByTestId('tenant-capacity-total-warning')).toBeNull();
    // Total 2 < Chat default 3 → non-blocking advisory appears.
    fireEvent.change(screen.getByTestId('field-maxTotalDefault'), { target: { value: '2' } });
    expect(screen.getByTestId('tenant-capacity-total-warning')).toBeInTheDocument();
  });
});
