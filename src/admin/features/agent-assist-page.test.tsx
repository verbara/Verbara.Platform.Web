/**
 * The deployment-wide Agent Assist feature page against `agent-assist-feature.v2.json` (spec
 * `agent-assist-provider-settings`, requirements 1-4; design D3): the selector offers the live
 * providers only, a save sends the fixture's PUT members for deepgram, a stored refused provider is
 * shown with a not-live note and is never preselected, and a refusal keeps the form dirty. Real
 * hooks and `customFetch`, msw answering the host's fixture bodies.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse, type JsonBodyType } from 'msw';
import { setupServer } from 'msw/node';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18next from 'i18next';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { toast } from 'sonner';
import { useAuthStore } from '@/core/auth/auth-store';
import enAdmin from '../../../public/locales/en-US/admin.json';
import enCommon from '../../../public/locales/en-US/common.json';
import AgentAssistFeaturePage from './agent-assist-page';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

interface FeatureFixture {
  liveProviders: string[];
  refusedProviders: string[];
  get: { status: number; body: Record<string, unknown> & { _omittedWhileNull: string[] } };
  putRefusedBatchProvider: { status: number; body: Record<string, unknown> };
}

const fx = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'tests/fixtures/contracts/agent-assist-feature.v2.json'),
    'utf-8',
  ),
) as FeatureFixture;

const { _omittedWhileNull: omittedWhileNull, ...getBody } = fx.get.body;
const labels = enAdmin.features['agent-assist'].provider;

let current: Record<string, unknown>;
let putBodies: unknown[];
let putAnswer: { status: number; body: JsonBodyType } | null;

const server = setupServer(
  http.get('*/api/v1/admin/features/agent-assist', () => HttpResponse.json(current)),
  http.put('*/api/v1/admin/features/agent-assist', async ({ request }) => {
    putBodies.push(await request.json());
    if (putAnswer) return HttpResponse.json(putAnswer.body, { status: putAnswer.status });
    return HttpResponse.json(current);
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
  current = { ...getBody };
  putBodies = [];
  putAnswer = null;
  useAuthStore.getState().logout();
  useAuthStore
    .getState()
    .setAuth(
      'T',
      Date.now() + 60_000,
      { id: 'pa-1', email: 'p@b.com', displayName: 'Platform', role: 'admin' },
      'platform',
      ['features:agent-assist:manage'],
      {},
    );
});

async function renderPage() {
  const i18n = i18next.createInstance();
  await i18n.init({
    lng: 'en-US',
    fallbackLng: false,
    resources: { 'en-US': { admin: enAdmin, common: enCommon } },
    ns: ['admin', 'common'],
    defaultNS: 'admin',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>
        <AgentAssistFeaturePage />
      </QueryClientProvider>
    </I18nextProvider>,
  );
  await screen.findByTestId('agent-assist-enable-toggle');
  return view;
}

async function offeredProviders() {
  fireEvent.click(screen.getByTestId('agent-assist-provider-select'));
  const options = await screen.findAllByRole('option');
  return options.map((o) => o.getAttribute('data-provider'));
}

/** A press starts on the option, as a real click does: base-ui ignores any other click. */
async function pickDeepgram() {
  fireEvent.click(screen.getByTestId('agent-assist-provider-select'));
  const option = await screen.findByTestId('agent-assist-provider-option-deepgram');
  fireEvent.pointerDown(option);
  fireEvent.click(option);
  await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(0));
}

const saveButton = () => screen.getByTestId('agent-assist-save-button');

describe('AgentAssistFeaturePage — live providers only', () => {
  it('AgentAssistFeaturePage_ShouldOfferOnlyTheLiveProviders_WhenTheSelectorOpens', async () => {
    current = { enabled: true, credentialsConfigured: false };
    await renderPage();
    expect(await offeredProviders()).toEqual(fx.liveProviders);
  });

  it('AgentAssistFeaturePage_ShouldRenderNoBatchProviderField_WhenDeepgramIsChosen', async () => {
    const { container } = await renderPage();
    expect(screen.getByTestId('agent-assist-apikey-input')).toBeInTheDocument();
    expect(container.querySelector('textarea')).toBeNull();
    expect(container.querySelector('#google-json, #azure-endpoint, #base-url')).toBeNull();
    const fieldLabels = Array.from(container.querySelectorAll('label')).map((l) => l.textContent);
    expect(fieldLabels).toEqual([labels.label, enAdmin.features['agent-assist']['api-key']]);
  });

  it('AgentAssistFeaturePage_ShouldSendTheFixturesPutMembers_WhenDeepgramIsSaved', async () => {
    current = { enabled: false, credentialsConfigured: false };
    await renderPage();
    fireEvent.click(screen.getByTestId('agent-assist-enable-toggle'));
    await pickDeepgram();
    fireEvent.change(screen.getByTestId('agent-assist-apikey-input'), {
      target: { value: 'dg_test_key' },
    });
    fireEvent.click(saveButton());
    await waitFor(() => expect(putBodies).toHaveLength(1));
    expect(putBodies[0]).toEqual({
      enabled: true,
      provider: 'deepgram',
      credentials: { apiKey: 'dg_test_key' },
    });
  });

  it('AgentAssistFeaturePage_ShouldSendNullProviderAndCredentials_WhenDisabledIsSaved', async () => {
    await renderPage();
    fireEvent.click(screen.getByTestId('agent-assist-enable-toggle'));
    fireEvent.click(saveButton());
    await waitFor(() => expect(putBodies).toHaveLength(1));
    expect(putBodies[0]).toEqual({ enabled: false, provider: null, credentials: null });
  });
});

describe('AgentAssistFeaturePage — stored rows', () => {
  it.each(fx.refusedProviders)(
    'AgentAssistFeaturePage_ShouldShowTheNotLiveNoteAndPreselectNothing_WhenTheStoredProviderIs %s',
    async (provider) => {
      current = { ...getBody, provider };
      await renderPage();
      const note = screen.getByTestId('agent-assist-provider-not-live');
      expect(note).toHaveAttribute('data-stored-provider', provider);
      expect(note).toHaveTextContent(labels[provider as keyof typeof labels]);
      expect(screen.getByTestId('agent-assist-provider-select')).toHaveAttribute(
        'data-selected-provider',
        'none',
      );
      expect(saveButton()).toBeDisabled();
      // No key can be typed until deepgram is chosen.
      expect(screen.queryByTestId('agent-assist-apikey-input')).toBeNull();
      await pickDeepgram();
      expect(saveButton()).toBeDisabled();
      fireEvent.change(screen.getByTestId('agent-assist-apikey-input'), {
        target: { value: 'dg_test_key' },
      });
      expect(saveButton()).toBeEnabled();
    },
  );

  it('AgentAssistFeaturePage_ShouldShowNoNoteAndTheUpdatedByLine_WhenTheFixturesGetBodyLoads', async () => {
    const { container } = await renderPage();
    expect(screen.queryByTestId('agent-assist-provider-not-live')).toBeNull();
    expect(screen.getByTestId('agent-assist-provider-select')).toHaveAttribute(
      'data-selected-provider',
      'deepgram',
    );
    const updated = screen.getByTestId('agent-assist-updated-by');
    expect(updated).toHaveTextContent(String(getBody.updatedBy));
    expect(updated).toHaveAttribute('data-updated-at', String(getBody.updatedAt));
    expect(container.textContent).not.toContain('undefined');
  });

  it('AgentAssistFeaturePage_ShouldRenderNoUndefined_WhenEveryOmittedWhileNullMemberIsAbsent', async () => {
    current = { enabled: false, credentialsConfigured: false };
    for (const member of omittedWhileNull) expect(current).not.toHaveProperty(member);
    const { container } = await renderPage();
    const select = screen.getByTestId('agent-assist-provider-select');
    expect(
      select.getAttribute('data-disabled') !== null ||
        select.getAttribute('aria-disabled') === 'true' ||
        select.hasAttribute('disabled'),
    ).toBe(true);
    expect(screen.queryByTestId('agent-assist-updated-by')).toBeNull();
    expect(container.textContent).not.toContain('undefined');
  });
});

describe('AgentAssistFeaturePage — refusals', () => {
  it('AgentAssistFeaturePage_ShouldKeepTheFormDirtyAndShowAToast_WhenPlatformRefusesTheSave', async () => {
    current = { enabled: false, credentialsConfigured: false };
    putAnswer = fx.putRefusedBatchProvider;
    await renderPage();
    fireEvent.click(screen.getByTestId('agent-assist-enable-toggle'));
    await pickDeepgram();
    fireEvent.change(screen.getByTestId('agent-assist-apikey-input'), {
      target: { value: 'dg_test_key' },
    });
    await act(async () => {
      fireEvent.click(saveButton());
    });
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(toast.success).not.toHaveBeenCalled();
    expect(saveButton()).toBeEnabled();
  });
});
