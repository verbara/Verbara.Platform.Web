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
