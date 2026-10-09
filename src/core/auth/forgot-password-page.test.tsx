/**
 * The forgot-password page (spec `sign-in-refusal-feedback`, H16), rendered with the real page and a
 * real i18next instance loaded with the three committed `common.json` files. Platform's
 * `ForgotPasswordRequest(TenantId, Email)` takes the tenant from the body first; without it Platform
 * falls back to the host's first label, which on a single-domain deployment finds no user, sends no
 * email and still answers 200. The page therefore always shows the tenant it will send.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import enCommon from '../../../public/locales/en-US/common.json';
import esCommon from '../../../public/locales/es-419/common.json';
import ptCommon from '../../../public/locales/pt-BR/common.json';
import { ForgotPasswordPage } from './forgot-password-page';
import { LoginPage } from './login-page';
import { useAuthStore } from './auth-store';

type Locale = 'en-US' | 'es-419' | 'pt-BR';

const COMMON: Record<Locale, typeof enCommon> = {
  'en-US': enCommon,
  'es-419': esCommon,
  'pt-BR': ptCommon,
};

const FORGOT_URL = '/api/v1/auth/forgot-password';

let forgotStatus: number | 'network-error';
const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (new URL(raw, 'http://localhost').pathname === FORGOT_URL) {
    if (forgotStatus === 'network-error') throw new TypeError('Failed to fetch');
    return new Response(null, { status: forgotStatus });
  }
  return new Response(null, { status: 404 });
});

async function createI18n(lng: Locale) {
  const instance = i18next.createInstance();
  await instance.init({
    lng,
    fallbackLng: false,
    resources: {
      'en-US': { common: enCommon },
      'es-419': { common: esCommon },
      'pt-BR': { common: ptCommon },
    },
    ns: ['common'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return instance;
}

async function renderPage({
  lng = 'en-US',
  state,
  hostname = 'localhost',
  defaultTenant = '',
}: { lng?: Locale; state?: unknown; hostname?: string; defaultTenant?: string } = {}) {
  vi.stubEnv('VITE_DEFAULT_TENANT_ID', defaultTenant);
  vi.stubGlobal('location', { ...window.location, hostname });
  const i18n = await createI18n(lng);
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[{ pathname: '/forgot-password', state }]}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

async function settle() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function forgotCalls() {
  return fetchMock.mock.calls.filter(([input]) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return new URL(raw, 'http://localhost').pathname === FORGOT_URL;
  });
}

function tenantField(): HTMLInputElement {
  return screen.getByTestId('forgot-tenant');
}

function emailField(): HTMLInputElement {
  const el = document.getElementById('forgot-email');
  if (!(el instanceof HTMLInputElement)) throw new Error('#forgot-email not rendered');
  return el;
}

async function submit(email = 'ana@acme.test') {
  fireEvent.change(emailField(), { target: { value: email } });
  const form = emailField().closest('form');
  if (!form) throw new Error('forgot-password form not rendered');
  fireEvent.submit(form);
  await waitFor(() => expect(forgotCalls()).toHaveLength(1));
  await settle();
}

function sentBody(): unknown {
  const [, init] = forgotCalls()[0]!;
  return JSON.parse(String(init?.body));
}

beforeEach(() => {
  forgotStatus = 200;
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  useAuthStore.getState().logout();
});

describe('ForgotPasswordPage tenant', () => {
  it('submit_ShouldSendTheTenantWithTheEmail_WhenTheConsoleIsBuiltWithADefaultTenant', async () => {
    await renderPage({ defaultTenant: 'acme' });

    await submit();

    expect(sentBody()).toEqual({ tenantId: 'acme', email: 'ana@acme.test' });
  });

  it.each(['en-US', 'es-419', 'pt-BR'] as const)(
    'tenantField_ShouldAlwaysBeShownWithItsLocalizedPlaceholder %s',
    async (lng) => {
      await renderPage({ lng, defaultTenant: 'acme' });

      expect({
        value: tenantField().value,
        required: tenantField().required,
        placeholder: tenantField().getAttribute('placeholder'),
        label: document.querySelector('label[for="forgot-tenant"]')?.textContent,
      }).toEqual({
        value: 'acme',
        required: true,
        placeholder: COMMON[lng].auth.forgot_tenant_placeholder,
        label: expect.stringContaining(COMMON[lng].auth.forgot_tenant) as unknown,
      });
    },
  );

  it('tenantField_ShouldBePrefilledWithTheTenantTypedOnTheLoginPage_WhenItCameFromThere', async () => {
    await renderPage({ state: { tenant: 'globex' }, defaultTenant: 'acme' });
    expect(tenantField().value).toBe('globex');

    await submit();

    expect(sentBody()).toEqual({ tenantId: 'globex', email: 'ana@acme.test' });
  });

  it('submit_ShouldSendTheEditedTenant_WhenTheUserReplacesTheSubdomainGuess', async () => {
    await renderPage({ hostname: 'console.example.com' });
    expect(tenantField().value).toBe('console');

    fireEvent.change(tenantField(), { target: { value: 'acme' } });
    await submit();

    expect(sentBody()).toEqual({ tenantId: 'acme', email: 'ana@acme.test' });
  });

  it('tenantField_ShouldBeEmptyAndTheRequestCarryWhatTheUserTyped_WhenTheHostIsAnIPv4Address', async () => {
    await renderPage({ hostname: '10.0.0.5' });
    expect(tenantField().value).toBe('');

    fireEvent.change(tenantField(), { target: { value: 'acme' } });
    await submit();

    expect(sentBody()).toEqual({ tenantId: 'acme', email: 'ana@acme.test' });
  });

  it('submit_ShouldSendNothing_WhileTheTenantFieldIsEmpty', async () => {
    await renderPage({ hostname: '10.0.0.5' });
    fireEvent.change(emailField(), { target: { value: 'ana@acme.test' } });

    const button = screen.getByTestId('forgot-submit');
    expect(button).toBeDisabled();
    const form = emailField().closest('form');
    if (!form) throw new Error('forgot-password form not rendered');
    fireEvent.submit(form);
    await settle();

    expect({ calls: forgotCalls().length, sent: screen.queryByTestId('forgot-sent') }).toEqual({
      calls: 0,
      sent: null,
    });
  });

  it.each([
    ['200 (Platform answers 200 for an unknown email too)', 200],
    ['an unexpected 500', 500],
    ['a network failure', 'network-error'],
  ] as const)(
    'submit_ShouldShowTheSameConfirmation_WhenTheApiAnswers %s',
    async (_case, status) => {
      forgotStatus = status;
      await renderPage({ defaultTenant: 'acme' });

      await submit('nobody@acme.test');

      expect(screen.getByTestId('forgot-sent').textContent).toBe(enCommon.auth.reset_email_sent);
    },
  );

  it('loginLink_ShouldCarryTheTenantTypedOnTheLoginPage_WhenTheUserFollowsIt', async () => {
    vi.stubEnv('VITE_DEFAULT_TENANT_ID', '');
    const i18n = await createI18n('en-US');
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>,
    );

    fireEvent.change(screen.getByTestId('login-tenant'), { target: { value: 'acme' } });
    fireEvent.click(screen.getByTestId('login-forgot-password'));

    expect((await screen.findByTestId('forgot-tenant')) as HTMLInputElement).toHaveValue('acme');
  });
});
