import type { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FormProvider, useForm } from 'react-hook-form';
import type { SetupFormValues } from '../setup-wizard';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));
vi.mock('@/core/api/hooks/use-queues', () => ({
  useQueues: () => ({ data: [{ id: 'q-1', name: 'Support' }] }),
}));
vi.mock('@/admin/channels/channel-test-button', () => ({
  ChannelTestButton: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { changeLanguage: vi.fn() },
  }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ChannelStep from './channel-step';

let latestConfig: Record<string, string> = {};

function Harness({
  channelId,
  children,
}: {
  readonly channelId: string;
  readonly children: ReactNode;
}) {
  const methods = useForm<SetupFormValues>({
    defaultValues: {
      queueName: '',
      agentUserId: '',
      agentDisplayName: '',
      agentEmail: '',
      channelId,
      channelConfig: {},
    },
  });
  latestConfig = methods.watch('channelConfig');
  return <FormProvider {...methods}>{children}</FormProvider>;
}

describe('ChannelStep', () => {
  it('channelConfig_ShouldUseCanonicalKeysWithHelp_WhenWhatsAppSelected', async () => {
    render(
      <Harness channelId="whatsapp">
        <ChannelStep />
      </Harness>,
    );

    const inputs = [...document.querySelectorAll<HTMLInputElement>('[data-channel-field]')];
    expect(inputs.map((i) => i.dataset.channelField)).toEqual([
      'AccessToken',
      'PhoneNumberId',
      'AppSecret',
      'WebhookVerifyToken',
      'WabaId',
      'ApiVersion',
      'defaultQueueId',
    ]);
    expect(screen.getByText('admin:channels.whatsapp.appSecret.help')).toBeTruthy();
    const appSecret = inputs.find((i) => i.dataset.channelField === 'AppSecret');
    expect(appSecret?.type).toBe('password');
    expect(appSecret?.getAttribute('aria-describedby')).toBe('channel-AppSecret-help');

    fireEvent.change(appSecret as HTMLInputElement, { target: { value: 's3cret' } });
    await waitFor(() => expect(latestConfig.AppSecret).toBe('s3cret'));
    // Blank fields are left out: Platform keeps what is stored for a key it is not sent.
    expect(latestConfig).toEqual({ AppSecret: 's3cret' });
  });

  it('defaultQueue_ShouldOfferTheTenantQueues_WhenWhatsAppSelected', async () => {
    render(
      <Harness channelId="whatsapp">
        <ChannelStep />
      </Harness>,
    );

    const queue = document.querySelector<HTMLSelectElement>(
      '[data-channel-field="defaultQueueId"]',
    )!;
    expect([...queue.options].map((o) => o.value)).toEqual(['', 'q-1']);
    fireEvent.change(queue, { target: { value: 'q-1' } });
    await waitFor(() => expect(latestConfig).toEqual({ defaultQueueId: 'q-1' }));
  });

  it('render_ShouldKeepPlainLabels_WhenChannelIsNotWhatsApp', () => {
    render(
      <Harness channelId="sms">
        <ChannelStep />
      </Harness>,
    );

    expect(screen.getByText('API Key')).toBeTruthy();
    expect(document.querySelector('[data-channel-field-help]')).toBeNull();
  });
});
