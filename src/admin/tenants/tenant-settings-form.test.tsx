import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
      auth: { mfaPolicy: 'Optional', passwordMinLength: 12, oidcEnabled: false },
      quotas: { maxMonthlyVoiceMinutes: null, maxMonthlyMessages: null, quotaAction: 'Warn' },
      retention: { conversationRetentionDays: null, authEventRetentionDays: null },
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

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { toast } from 'sonner';
import { ApiError } from '@/core/api/api-error';
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

describe('TenantSettingsForm — the 409 plan ceiling (partner-channel-pilot-fixes P3)', () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockReset();
    vi.mocked(toast.success).mockReset();
  });
  afterEach(() => {
    mutateAsyncMock.mockReset();
    vi.mocked(toast.error).mockReset();
    vi.mocked(toast.success).mockReset();
  });

  const refusal = JSON.parse(
    readFileSync(
      resolve(process.cwd(), 'tests/fixtures/contracts/plan-above-parent-409.json'),
      'utf-8',
    ),
  ) as { status: number; body: Record<string, unknown> };

  it.each(['operational', 'auth', 'quotas', 'retention'] as const)(
    'TenantSettingsForm_ShouldLeaveTheCodedToastToTheHook_WhenTheHostAnswers409 (%s)',
    async (section) => {
      mutateAsyncMock.mockRejectedValue(new ApiError(refusal.status, refusal.body));
      render(<TenantSettingsForm tenantId="pc1" section={section} />);

      fireEvent.click(screen.getByTestId('tenant-settings-submit'));

      await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalled());
      await Promise.resolve();
      expect(toast.error).not.toHaveBeenCalledWith('plan-exceeds-parent');
      expect(toast.error).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
      expect(screen.getByTestId('tenant-settings-submit')).toBeInTheDocument();
    },
  );

  it('TenantSettingsForm_ShouldKeepTheEditedValue_WhenTheHostAnswers409', async () => {
    mutateAsyncMock.mockRejectedValue(new ApiError(refusal.status, refusal.body));
    render(<TenantSettingsForm tenantId="pc1" section="operational" />);
    fireEvent.change(screen.getByTestId('field-outboundCallerId'), {
      target: { value: '+15559998888' },
    });

    fireEvent.click(screen.getByTestId('tenant-settings-submit'));

    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalled());
    expect(screen.getByTestId('field-outboundCallerId')).toHaveValue('+15559998888');
  });

  it('TenantSettingsForm_ShouldStillToastTheMessage_WhenAnotherRefusalAnswers', async () => {
    mutateAsyncMock.mockRejectedValue(new ApiError(400, { error: 'Invalid timezone' }));
    render(<TenantSettingsForm tenantId="pc1" section="operational" />);

    fireEvent.click(screen.getByTestId('tenant-settings-submit'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Invalid timezone'));
  });
});
