import type { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FormProvider, useForm } from 'react-hook-form';
import type { SetupFormValues } from '../setup-wizard';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { changeLanguage: vi.fn() },
  }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ChannelStep from './channel-step';

let latestConfig: Record<string, string> = {};

function Harness({ children }: { readonly children: ReactNode }) {
  const methods = useForm<SetupFormValues>({
    defaultValues: {
      queueName: '',
      agentUserId: '',
      agentDisplayName: '',
      agentEmail: '',
      channelId: 'whatsapp',
      channelConfig: {},
    },
  });
  latestConfig = methods.watch('channelConfig');
  return <FormProvider {...methods}>{children}</FormProvider>;
}

describe('ChannelStep', () => {
  it('channelConfig_ShouldUseCanonicalKeysWithHelp_WhenWhatsAppSelected', async () => {
    render(
      <Harness>
        <ChannelStep />
      </Harness>,
    );

    const inputs = [...document.querySelectorAll<HTMLInputElement>('[data-channel-field]')];
    expect(inputs.map((i) => i.dataset.channelField)).toEqual([
      'AccessToken',
      'PhoneNumberId',
      'AppSecret',
      'WebhookVerifyToken',
    ]);
    expect(screen.getByText('admin:channels.whatsapp.appSecret.help')).toBeTruthy();
    const appSecret = inputs.find((i) => i.dataset.channelField === 'AppSecret');
    expect(appSecret?.type).toBe('password');
    expect(appSecret?.getAttribute('aria-describedby')).toBe('channel-AppSecret-help');

    fireEvent.change(appSecret as HTMLInputElement, { target: { value: 's3cret' } });
    await waitFor(() => expect(latestConfig.AppSecret).toBe('s3cret'));
  });
});
