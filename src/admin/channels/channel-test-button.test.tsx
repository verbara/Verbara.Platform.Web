import type { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '@/core/api/client';
import type { ChannelTestResult } from '@/core/api/hooks/use-channels';
import { TEST_LOCALES, createLocaleI18n } from '@/test/locale-i18n';
import { channelFields } from './channel-fields';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { ChannelTestButton } from './channel-test-button';

function renderButton(channelId = 'whatsapp') {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return render(<ChannelTestButton channelId={channelId} />, { wrapper });
}

async function runTest(outcome: ChannelTestResult) {
  vi.mocked(client.customFetch).mockResolvedValue(outcome);
  renderButton();
  fireEvent.click(screen.getByRole('button', { name: 'admin:channels.test_connection' }));
  await waitFor(() => expect(document.querySelector('[data-channel-test-result]')).not.toBeNull());
  return document.querySelector<HTMLElement>('[data-channel-test-result]')!;
}

describe('ChannelTestButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('click_ShouldCallTheChannelTestRoute', async () => {
    await runTest({ success: true, message: 'ok', verifiedName: 'Acme Support' });
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/channels/whatsapp/test',
      method: 'POST',
    });
  });

  it('result_ShouldShowTheVerifiedName_WhenMetaConfirmsTheNumber', async () => {
    const result = await runTest({ success: true, message: 'ok', verifiedName: 'Acme Support' });

    expect(result.dataset.testOutcome).toBe('success');
    expect(screen.getByText('admin:channels.test.successNamed')).toBeTruthy();
    expect(document.querySelector('[data-channel-test-verified-name]')?.textContent).toBe(
      'Acme Support',
    );
  });

  it('result_ShouldShowTheProviderMessageAndCode_WhenMetaRejectsTheToken', async () => {
    const result = await runTest({
      success: false,
      message: 'Invalid OAuth access token - [redacted]',
      code: 'provider-rejected',
    });

    expect(result.dataset.testOutcome).toBe('failure');
    expect(result.dataset.testCode).toBe('provider-rejected');
    expect(screen.getByText('admin:channels.test.codes.provider-rejected')).toBeTruthy();
    expect(document.querySelector('[data-channel-test-message]')?.textContent).toBe(
      'Invalid OAuth access token - [redacted]',
    );
  });

  it.each(['provider-unreachable', 'channel-not-configured', 'not-testable'])(
    'result_ShouldLocalizeTheCode_WhenTheTestReports_%s',
    async (code) => {
      const result = await runTest({ success: false, message: 'server text', code });

      expect(result.dataset.testCode).toBe(code);
      expect(screen.getByText(`admin:channels.test.codes.${code}`)).toBeTruthy();
    },
  );

  it('result_ShouldFallBackToTheGenericFailure_WhenTheCodeIsUnknown', async () => {
    const result = await runTest({ success: false, message: 'something new', code: 'brand-new' });

    expect(result.dataset.testCode).toBe('brand-new');
    expect(screen.getByText('admin:channels.test.failed')).toBeTruthy();
    expect(document.querySelector('[data-channel-test-message]')?.textContent).toBe(
      'something new',
    );
  });
});

/** Every key the channel form and the test outcome render, in every shipped locale. */
const FORM_KEYS = [
  'admin:channels.test_connection',
  'admin:channels.test.success',
  'admin:channels.test.successNamed',
  'admin:channels.test.failed',
  'admin:channels.test.codes.provider-rejected',
  'admin:channels.test.codes.provider-unreachable',
  'admin:channels.test.codes.channel-not-configured',
  'admin:channels.test.codes.not-testable',
  'admin:channels.credential.set',
  'admin:channels.credential.notSet',
  'admin:channels.credential.keepPlaceholder',
  'admin:channels.credential.remove',
  'admin:channels.credential.undoRemove',
  'admin:channels.credential.willBeRemoved',
  'admin:channels.credential.queueKeep',
  'admin:channels.credential.queueNone',
  'admin:channels.legacy.title',
  'admin:channels.legacy.help',
  'admin:channels.webhook.label',
  'admin:channels.webhook.help',
  ...channelFields.whatsapp.flatMap((f) => [f.labelKey!, f.helpKey!]),
];

describe.each(TEST_LOCALES)('channel form strings in %s', (lng) => {
  it('ChannelFormStrings_ShouldExistInEveryLocale', async () => {
    const i18n = await createLocaleI18n(lng);
    for (const key of FORM_KEYS) expect(i18n.exists(key), key).toBe(true);
    expect(i18n.t('admin:channels.test.successNamed', { name: 'Acme' })).toContain('Acme');
  });
});
