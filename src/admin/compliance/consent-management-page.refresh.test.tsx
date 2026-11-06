import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/core/auth/auth-store';
import { customFetch } from '@/core/api/client';
import {
  consentContactVoiceAndEmailYes,
  consentEmailYesRequest,
  consentSearchVoiceAndEmailYes,
  consentSearchVoiceYes,
} from '@/tests/utils/contract-doubles';

/**
 * The consent page on the real `useSearchContacts` and `useUpdateContact`, with only `customFetch` replaced:
 * a save must show on the same page, in the row and in a reopened sheet, without a reload (design W10). With
 * the hooks mocked, a search that is never refreshed after a save goes unseen.
 */

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-i18next', async () => {
  const { createLocaleI18n } = await import('@/test/locale-i18n');
  const i18n = await createLocaleI18n('en-US');
  return {
    useTranslation: (ns?: string | string[]) => ({
      t: i18n.getFixedT('en-US', Array.isArray(ns) ? ns[0] : (ns ?? 'common')),
      i18n,
    }),
  };
});

import ConsentManagementPage from './consent-management-page';

const CONTACT_ID = String(consentContactVoiceAndEmailYes.contactId);
const CONTACT_URL = `/api/v1/contacts/${CONTACT_ID}`;

interface FetchCall {
  url: string;
  method: string;
  data?: unknown;
}

function callsOf(method: string, url: string): FetchCall[] {
  return vi
    .mocked(customFetch)
    .mock.calls.map(([config]) => config as FetchCall)
    .filter((c) => c.method === method && c.url === url);
}

/** The first search answers the contact as loaded; every search after the save answers it as saved. */
function answerLikePlatform() {
  let saved = false;
  vi.mocked(customFetch).mockImplementation(async (config) => {
    const { url, method } = config as FetchCall;
    if (method === 'GET' && url === '/api/v1/contacts') {
      return saved ? consentSearchVoiceAndEmailYes : consentSearchVoiceYes;
    }
    if (method === 'PUT' && url === CONTACT_URL) {
      saved = true;
      return consentContactVoiceAndEmailYes;
    }
    throw new Error(`unexpected ${method} ${url}`);
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 30_000, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <ConsentManagementPage />
    </QueryClientProvider>,
  );
}

/** A press starts on the option, as a real click does: base-ui ignores any other click. */
async function chooseConsent(channel: string, state: 'yes' | 'no' | 'unrecorded') {
  fireEvent.click(screen.getByTestId(`consent-channel-${channel}`));
  const option = await screen.findByTestId(`consent-channel-${channel}-option-${state}`);
  fireEvent.pointerDown(option);
  fireEvent.click(option);
  await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(0));
}

describe('ConsentManagementPage, on the real contact hooks', () => {
  beforeEach(() => {
    vi.mocked(customFetch).mockReset();
    useAuthStore.setState({ permissions: ['contacts:contact:edit'] });
  });

  afterEach(() => {
    cleanup();
  });

  it('saveConsent_ShouldShowTheSavedChannelInTheRowAndTheReopenedSheet_WhenSavedWithoutReload', async () => {
    answerLikePlatform();
    renderPage();

    fireEvent.change(screen.getByTestId('consent-search'), { target: { value: 'Ana' } });
    fireEvent.click(await screen.findByTestId('edit-consent-btn', {}, { timeout: 2000 }));

    const emailControl = await screen.findByTestId('consent-channel-Email').catch(() => null);
    // Soft, so one run against the unfixed page records every way it differs.
    expect.soft(emailControl, 'Email has a consent control').not.toBeNull();
    if (emailControl) await chooseConsent('Email', 'yes');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(callsOf('PUT', CONTACT_URL)).toHaveLength(1));
    const { data } = callsOf('PUT', CONTACT_URL)[0]!;
    expect
      .soft(data, 'the PUT body names only the changed channel')
      .toEqual(consentEmailYesRequest);

    // The search is read again after the save, on the same page, with no reload.
    await waitFor(
      () => expect(callsOf('GET', '/api/v1/contacts'), 'the search is read again').toHaveLength(2),
      { timeout: 2000 },
    );

    const row = screen.getByTestId('edit-consent-btn').closest('tr')!;
    await waitFor(() =>
      expect(within(row).getByTestId('channel-badge-Email')).toHaveAttribute('data-consent', 'yes'),
    );
    fireEvent.click(screen.getByTestId('edit-consent-btn'));
    expect(await screen.findByTestId('consent-channel-Email')).toHaveAttribute(
      'data-consent',
      'yes',
    );
  });
});
