import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { channelFields } from './channel-fields';

const updateMutate = vi.fn();

vi.mock('@/core/api/hooks/use-channels', () => ({
  useUpdateChannel: () => ({ mutate: updateMutate, isPending: false }),
}));

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ChannelConfigForm } from './channel-config-form';

/**
 * The keys Platform's WhatsApp channel reads from a tenant's channel config
 * (Verbara.Platform `WhatsAppCredentialKeys`). A config saved under any other
 * key is never read and inbound fails closed.
 */
const WHATSAPP_CANONICAL_KEYS = ['AccessToken', 'PhoneNumberId', 'AppSecret', 'WebhookVerifyToken'];

describe('channelFields', () => {
  it('channelFields_ShouldUsePlatformCanonicalKeys_WhenChannelIsWhatsApp', () => {
    expect(channelFields.whatsapp.map((f) => f.key)).toEqual(WHATSAPP_CANONICAL_KEYS);
  });

  it('channelFields_ShouldMaskSecrets_WhenChannelIsWhatsApp', () => {
    const typeOf = (key: string) => channelFields.whatsapp.find((f) => f.key === key)?.type;
    expect(typeOf('AccessToken')).toBe('password');
    expect(typeOf('AppSecret')).toBe('password');
  });

  it('channelFields_ShouldLocalizeLabelAndHelp_WhenChannelIsWhatsApp', () => {
    for (const field of channelFields.whatsapp) {
      expect(field.labelKey).toMatch(/^admin:channels\.whatsapp\./);
      expect(field.helpKey).toMatch(/^admin:channels\.whatsapp\./);
    }
  });
});

describe('ChannelConfigForm', () => {
  beforeEach(() => {
    updateMutate.mockReset();
  });

  it('submit_ShouldSendExactlyTheCanonicalKeys_WhenChannelIsWhatsApp', async () => {
    render(<ChannelConfigForm open onOpenChange={vi.fn()} channelId="whatsapp" />);

    const inputs = document.querySelectorAll<HTMLInputElement>('[data-channel-field]');
    expect([...inputs].map((i) => i.dataset.channelField)).toEqual(WHATSAPP_CANONICAL_KEYS);

    for (const input of inputs) {
      fireEvent.change(input, { target: { value: `value-of-${input.dataset.channelField}` } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'admin:channels.save' }));

    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    expect(updateMutate.mock.calls[0][0]).toEqual({
      channelId: 'whatsapp',
      isActive: false,
      credentials: {
        AccessToken: 'value-of-AccessToken',
        PhoneNumberId: 'value-of-PhoneNumberId',
        AppSecret: 'value-of-AppSecret',
        WebhookVerifyToken: 'value-of-WebhookVerifyToken',
      },
    });
  });

  it('render_ShouldMaskAppSecretAndShowHelp_WhenChannelIsWhatsApp', () => {
    render(<ChannelConfigForm open onOpenChange={vi.fn()} channelId="whatsapp" />);

    const appSecret = document.querySelector<HTMLInputElement>('[data-channel-field="AppSecret"]');
    expect(appSecret?.type).toBe('password');
    expect(screen.getByText('admin:channels.whatsapp.appSecret.label')).toBeTruthy();
    expect(screen.getByText('admin:channels.whatsapp.appSecret.help')).toBeTruthy();
    expect(appSecret?.getAttribute('aria-describedby')).toContain('channel-AppSecret-help');
  });

  it('submit_ShouldFlagRequiredFieldAndKeepHelp_WhenWhatsAppFieldEmpty', async () => {
    render(<ChannelConfigForm open onOpenChange={vi.fn()} channelId="whatsapp" />);

    fireEvent.click(screen.getByRole('button', { name: 'admin:channels.save' }));

    const appSecret = document.querySelector<HTMLInputElement>('[data-channel-field="AppSecret"]');
    await waitFor(() =>
      expect(appSecret?.getAttribute('aria-describedby')).toBe(
        'channel-AppSecret-help channel-AppSecret-error',
      ),
    );
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it('render_ShouldKeepPlainLabels_WhenChannelIsNotWhatsApp', () => {
    render(<ChannelConfigForm open onOpenChange={vi.fn()} channelId="sms" />);

    const keys = [...document.querySelectorAll<HTMLInputElement>('[data-channel-field]')].map(
      (i) => i.dataset.channelField,
    );
    expect(keys).toEqual(['ApiKey', 'ApiSecret', 'SenderNumber']);
    expect(screen.getByText('API Key')).toBeTruthy();
  });
});
