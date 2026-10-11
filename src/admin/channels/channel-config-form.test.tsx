import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChannelConfig } from '@/core/api/hooks/use-channels';
import { useTenantStore } from '@/core/tenant/tenant-store';
import {
  buildCredentialUpdate,
  channelFields,
  legacyKeysOf,
  webhookUrlFor,
} from './channel-fields';

const updateMutate = vi.fn();
let channelData: ChannelConfig | undefined;

vi.mock('@/core/api/hooks/use-channels', () => ({
  useChannel: () => ({ data: channelData, isLoading: false }),
  useUpdateChannel: () => ({ mutate: updateMutate, isPending: false }),
  useTestChannel: () => ({ mutate: vi.fn(), isPending: false, data: undefined }),
}));

vi.mock('@/core/api/hooks/use-queues', () => ({
  useQueues: () => ({ data: [{ id: 'q-1', name: 'Support' }] }),
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
 * Platform's declared WhatsApp credential schema (channel-credential-config, 2.28.0), in the order
 * the API lists it. A value under any other key is refused with `unknown-credential-key`.
 */
const WHATSAPP_CANONICAL_KEYS = [
  'AccessToken',
  'PhoneNumberId',
  'AppSecret',
  'WebhookVerifyToken',
  'WabaId',
  'ApiVersion',
  'defaultQueueId',
];

function whatsapp(set: Record<string, boolean>, extra: { key: string; isSet: boolean }[] = []) {
  return {
    channel: 'WhatsApp',
    isActive: true,
    isConfigured: true,
    credentials: [
      ...WHATSAPP_CANONICAL_KEYS.map((key) => ({ key, isSet: set[key] ?? false })),
      ...extra,
    ],
  } satisfies ChannelConfig;
}

const CONFIGURED = {
  AccessToken: true,
  PhoneNumberId: true,
  AppSecret: true,
  WebhookVerifyToken: true,
};

const field = (key: string) =>
  document.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-channel-field="${key}"]`);

const save = () => fireEvent.click(screen.getByRole('button', { name: 'admin:channels.save' }));

describe('channelFields', () => {
  it('channelFields_ShouldUsePlatformCanonicalKeys_WhenChannelIsWhatsApp', () => {
    expect(channelFields.whatsapp.map((f) => f.key)).toEqual(WHATSAPP_CANONICAL_KEYS);
  });

  it('channelFields_ShouldMaskEverySecretPlatformDeclares_WhenChannelIsWhatsApp', () => {
    const typeOf = (key: string) => channelFields.whatsapp.find((f) => f.key === key)?.type;
    expect(typeOf('AccessToken')).toBe('password');
    expect(typeOf('AppSecret')).toBe('password');
    expect(typeOf('WebhookVerifyToken')).toBe('password');
    expect(typeOf('defaultQueueId')).toBe('queue');
  });

  it('channelFields_ShouldLocalizeLabelAndHelp_WhenChannelIsWhatsApp', () => {
    for (const f of channelFields.whatsapp) {
      expect(f.labelKey).toMatch(/^admin:channels\.whatsapp\./);
      expect(f.helpKey).toMatch(/^admin:channels\.whatsapp\./);
    }
  });
});

describe('buildCredentialUpdate', () => {
  it('buildCredentialUpdate_ShouldOmitBlanksAndSendNullForRemovals', () => {
    expect(
      buildCredentialUpdate(
        channelFields.whatsapp,
        { AccessToken: '  ', PhoneNumberId: ' 123 ', WabaId: '' },
        ['WabaId', 'ApiToken'],
      ),
    ).toEqual({ PhoneNumberId: '123', WabaId: null, ApiToken: null });
  });

  it('legacyKeysOf_ShouldListStoredKeysOutsideTheForm', () => {
    const config = whatsapp(CONFIGURED, [
      { key: 'ApiToken', isSet: true },
      { key: 'PhoneNumber', isSet: true },
    ]);
    expect(legacyKeysOf(channelFields.whatsapp, config.credentials)).toEqual([
      'ApiToken',
      'PhoneNumber',
    ]);
  });

  it('webhookUrlFor_ShouldNameTheTenantAndChannel_OnlyForWebhookChannels', () => {
    expect(webhookUrlFor('https://cc.example', 'acme', 'whatsapp')).toBe(
      'https://cc.example/api/v1/webhooks/acme/whatsapp',
    );
    expect(webhookUrlFor('https://cc.example', 'acme', 'sms')).toBeNull();
    expect(webhookUrlFor('https://cc.example', null, 'whatsapp')).toBeNull();
  });
});

describe('ChannelConfigForm', () => {
  beforeEach(() => {
    updateMutate.mockReset();
    channelData = undefined;
    useTenantStore.setState({ activeTenantId: 'tenant-a' });
  });

  it('render_ShouldShowAnIsSetBadgePerKey_FromTheResponse', () => {
    channelData = whatsapp({ AccessToken: true, AppSecret: true });
    render(<ChannelConfigForm open onOpenChange={vi.fn()} channelId="whatsapp" />);

    const inputs = document.querySelectorAll<HTMLElement>('[data-channel-field]');
    expect([...inputs].map((i) => i.dataset.channelField)).toEqual(WHATSAPP_CANONICAL_KEYS);
    const status = (key: string) =>
      document.querySelector<HTMLElement>(`[data-credential-status="${key}"]`)?.dataset
        .credentialSet;
    expect(status('AccessToken')).toBe('true');
    expect(status('AppSecret')).toBe('true');
    expect(status('PhoneNumberId')).toBe('false');
    expect(status('WabaId')).toBe('false');
    // Nothing comes back to prefill: every input starts empty.
    for (const input of inputs) expect((input as HTMLInputElement).value).toBe('');
  });

  it('submit_ShouldSendOnlyTheChangedKey_WhenTheOtherSecretsAreLeftBlank', async () => {
    channelData = whatsapp(CONFIGURED);
    render(<ChannelConfigForm open onOpenChange={vi.fn()} channelId="whatsapp" />);

    fireEvent.change(field('PhoneNumberId')!, { target: { value: '1098765' } });
    save();

    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    expect(updateMutate.mock.calls[0][0]).toEqual({
      channelId: 'whatsapp',
      isActive: true,
      credentials: { PhoneNumberId: '1098765' },
    });
  });

  it('submit_ShouldSendExactlyTheCanonicalKeys_WhenEveryFieldIsFilled', async () => {
    render(<ChannelConfigForm open onOpenChange={vi.fn()} channelId="whatsapp" />);

    for (const key of WHATSAPP_CANONICAL_KEYS) {
      const value = key === 'defaultQueueId' ? 'q-1' : `value-of-${key}`;
      fireEvent.change(field(key)!, { target: { value } });
    }
    save();

    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    expect(updateMutate.mock.calls[0][0].credentials).toEqual({
      AccessToken: 'value-of-AccessToken',
      PhoneNumberId: 'value-of-PhoneNumberId',
      AppSecret: 'value-of-AppSecret',
      WebhookVerifyToken: 'value-of-WebhookVerifyToken',
      WabaId: 'value-of-WabaId',
      ApiVersion: 'value-of-ApiVersion',
      defaultQueueId: 'q-1',
    });
  });

  it('submit_ShouldFlagARequiredKey_WhenItIsNotSetAndLeftBlank', async () => {
    render(<ChannelConfigForm open onOpenChange={vi.fn()} channelId="whatsapp" />);

    save();

    await waitFor(() =>
      expect(field('AppSecret')?.getAttribute('aria-describedby')).toBe(
        'channel-AppSecret-help channel-AppSecret-error',
      ),
    );
    // Optional keys are never required.
    expect(document.getElementById('channel-WabaId-error')).toBeNull();
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it('remove_ShouldSendNull_WhenAnOptionalSetKeyIsRemoved', async () => {
    channelData = whatsapp({ ...CONFIGURED, WabaId: true });
    render(<ChannelConfigForm open onOpenChange={vi.fn()} channelId="whatsapp" />);

    // A required key can be replaced, never removed.
    expect(document.querySelector('[data-credential-remove="AccessToken"]')).toBeNull();
    fireEvent.click(document.querySelector('[data-credential-remove="WabaId"]')!);
    save();

    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    expect(updateMutate.mock.calls[0][0].credentials).toEqual({ WabaId: null });
  });

  it('legacy_ShouldListOldKeysAsSetAndRemoveThem_WhenTheAdminCleansUp', async () => {
    channelData = whatsapp(CONFIGURED, [
      { key: 'ApiToken', isSet: true },
      { key: 'PhoneNumber', isSet: true },
    ]);
    render(<ChannelConfigForm open onOpenChange={vi.fn()} channelId="whatsapp" />);

    const legacy = document.querySelector<HTMLElement>('[data-legacy-credentials]')!;
    const rows = [...legacy.querySelectorAll<HTMLElement>('[data-legacy-credential]')];
    expect(rows.map((r) => r.dataset.legacyCredential)).toEqual(['ApiToken', 'PhoneNumber']);
    expect(within(rows[0]!).getByText('admin:channels.credential.set')).toBeTruthy();

    fireEvent.click(legacy.querySelector('[data-credential-remove="ApiToken"]')!);
    expect(rows[0]!.dataset.removed).toBe('true');
    save();

    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    expect(updateMutate.mock.calls[0][0].credentials).toEqual({ ApiToken: null });
  });

  it('remove_ShouldBeUndoable_BeforeSaving', async () => {
    channelData = whatsapp(CONFIGURED, [{ key: 'ApiToken', isSet: true }]);
    render(<ChannelConfigForm open onOpenChange={vi.fn()} channelId="whatsapp" />);

    const remove = () =>
      document.querySelector<HTMLElement>('[data-credential-remove="ApiToken"]')!;
    fireEvent.click(remove());
    fireEvent.click(remove());
    save();

    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    expect(updateMutate.mock.calls[0][0].credentials).toEqual({});
  });

  it('render_ShouldShowTheTenantWebhookUrl_WhenChannelIsWhatsApp', () => {
    render(<ChannelConfigForm open onOpenChange={vi.fn()} channelId="whatsapp" />);

    expect(document.querySelector('[data-channel-webhook-url]')?.textContent).toBe(
      `${window.location.origin}/api/v1/webhooks/tenant-a/whatsapp`,
    );
  });

  it('render_ShouldKeepPlainLabelsAndNoWebhook_WhenChannelIsNotWhatsApp', () => {
    render(<ChannelConfigForm open onOpenChange={vi.fn()} channelId="sms" />);

    const keys = [...document.querySelectorAll<HTMLElement>('[data-channel-field]')].map(
      (i) => i.dataset.channelField,
    );
    expect(keys).toEqual(['ApiKey', 'ApiSecret', 'SenderNumber']);
    expect(screen.getByText('API Key')).toBeTruthy();
    expect(document.querySelector('[data-channel-webhook-url]')).toBeNull();
  });
});
