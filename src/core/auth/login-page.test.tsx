/**
 * The login page's refusal and notice handling (spec `sign-in-refusal-feedback`), rendered with the
 * real page, the real auth store and a real i18next instance loaded with the three committed
 * `common.json` files, so every assertion reads the text a user would see. `fetch` is stubbed per
 * test with real `Response` objects shaped like Platform v2.24.0's answers.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import enCommon from '../../../public/locales/en-US/common.json';
import esCommon from '../../../public/locales/es-419/common.json';
import ptCommon from '../../../public/locales/pt-BR/common.json';
import { useAuthStore } from './auth-store';
import { LoginPage } from './login-page';

type Locale = 'en-US' | 'es-419' | 'pt-BR';

const COMMON: Record<Locale, typeof enCommon> = {
  'en-US': enCommon,
  'es-419': esCommon,
  'pt-BR': ptCommon,
};

/** Platform's `AccountStatusGate.Forbidden()` body, in English, whatever the console locale. */
const ACCOUNT_NOT_ACTIVE_BODY = { error: 'Account is not active.' };

interface FakeAnswer {
  status: number;
  body?: unknown;
}

let answers: Record<string, FakeAnswer | 'network-error'>;
const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const answer = answers[url];
  if (answer === undefined) throw new Error(`unexpected fetch ${url}`);
  if (answer === 'network-error') throw new TypeError('Failed to fetch');
  return new Response(answer.body === undefined ? null : JSON.stringify(answer.body), {
    status: answer.status,
    headers: answer.body === undefined ? {} : { 'Content-Type': 'application/json' },
  });
});

async function createI18n(lng: Locale) {
  const instance = i18next.createInstance();
  await instance.init({
    lng,
    // No fallback: a key missing from the active locale renders as the raw key and fails the test.
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

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location" data-path={location.pathname + location.search} />;
}

async function renderLogin({
  lng = 'en-US',
  entry = '/login',
}: { lng?: Locale; entry?: string } = {}) {
  const i18n = await createI18n(lng);
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route
            path="/login"
            element={
              <div data-testid="page">
                <LoginPage />
              </div>
            }
          />
          <Route path="*" element={null} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

/** Lets the handler's awaited `fetch` and body read run to the end, inside `act`. */
async function settle() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function submitPassword() {
  fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'ana@demo.test' } });
  fireEvent.change(screen.getByTestId('login-password'), { target: { value: 'Correct-Horse-1' } });
  fireEvent.click(screen.getByTestId('login-submit'));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  await settle();
}

async function submitMfaCode(code = '123456') {
  code.split('').forEach((digit, i) => {
    fireEvent.change(screen.getByTestId(`login-mfa-digit-${i}`), { target: { value: digit } });
  });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  await settle();
}

function loginError() {
  const el = screen.queryByTestId('login-error');
  return el === null ? null : { code: el.getAttribute('data-error-code'), text: el.textContent };
}

/** The rendered page alone, without the test's own location probe (which echoes the URL). */
function pageHtml() {
  return screen.getByTestId('page').innerHTML;
}

function currentPath() {
  return screen.getByTestId('location').getAttribute('data-path');
}

beforeEach(() => {
  answers = {};
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  useAuthStore.getState().logout();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  useAuthStore.getState().logout();
});

describe('LoginPage sign-in refusals', () => {
  it('EmailLogin_ShouldShowAccountNotActiveWithItsCodeAndStoreNoToken_WhenTheLoginApiAnswers403', async () => {
    answers['/api/v1/auth/login'] = { status: 403, body: ACCOUNT_NOT_ACTIVE_BODY };
    await renderLogin();

    await submitPassword();

    expect({
      error: loginError(),
      accessToken: useAuthStore.getState().accessToken,
      path: currentPath(),
    }).toEqual({
      error: { code: 'account-inactive', text: enCommon.auth.account_not_active },
      accessToken: null,
      path: '/login',
    });
  });

  it('MfaVerify_ShouldCloseTheStepClearTheChallengeAndShowAccountNotActive_WhenTheVerifyApiAnswers403', async () => {
    answers['/api/v1/auth/mfa/verify'] = { status: 403, body: ACCOUNT_NOT_ACTIVE_BODY };
    useAuthStore.getState().setMfaPending('mfa-challenge-1', 'ana@demo.test');
    await renderLogin();
    expect(screen.getByTestId('login-mfa-section')).toBeInTheDocument();

    await submitMfaCode();

    expect({
      mfaStepOpen: screen.queryByTestId('login-mfa-section') !== null,
      mfaPending: useAuthStore.getState().mfaPending,
      error: loginError(),
      accessToken: useAuthStore.getState().accessToken,
    }).toEqual({
      mfaStepOpen: false,
      mfaPending: null,
      error: { code: 'account-inactive', text: enCommon.auth.account_not_active },
      accessToken: null,
    });
  });

  it.each([
    [
      '401 with an empty body (unknown email or wrong password)',
      { status: 401 },
      'invalid-credentials',
      enCommon.auth.invalid_credentials,
    ],
    [
      '423 for a locked account',
      { status: 423, body: { error: 'Account is locked' } },
      'account-locked',
      enCommon.auth.account_locked,
    ],
    [
      '400 when no tenant resolves (any other failure)',
      { status: 400, body: { error: 'Tenant is required' } },
      'invalid-credentials',
      enCommon.auth.invalid_credentials,
    ],
    ['500', { status: 500 }, 'invalid-credentials', enCommon.auth.invalid_credentials],
  ] as const)(
    'EmailLogin_ShouldMapTheStatusToItsCode_WhenTheLoginApiAnswers %s',
    async (_case, answer, code, text) => {
      answers['/api/v1/auth/login'] = answer;
      await renderLogin();

      await submitPassword();

      expect({
        error: loginError(),
        accessToken: useAuthStore.getState().accessToken,
        path: currentPath(),
      }).toEqual({ error: { code, text }, accessToken: null, path: '/login' });
    },
  );

  it('EmailLogin_ShouldKeepTheInvalidCredentialsMessage_WhenTheRequestFailsOnTheNetwork', async () => {
    answers['/api/v1/auth/login'] = 'network-error';
    await renderLogin();

    await submitPassword();

    expect(loginError()).toEqual({
      code: 'invalid-credentials',
      text: enCommon.auth.invalid_credentials,
    });
  });

  it('EmailLogin_ShouldNeverRenderServerText_EvenInTheDetailFieldThePageUsedToRead', async () => {
    answers['/api/v1/auth/login'] = {
      status: 401,
      body: { error: 'Server error text', detail: 'Server detail text' },
    };
    await renderLogin();

    await submitPassword();

    expect(loginError()?.code).toBe('invalid-credentials');
    expect(document.body.textContent).not.toContain('Server error text');
    expect(document.body.textContent).not.toContain('Server detail text');
  });

  it('EmailLogin_ShouldStoreTheTokenAndLeaveTheLoginPage_WhenTheLoginApiAnswers200', async () => {
    answers['/api/v1/auth/login'] = {
      status: 200,
      body: {
        accessToken: 'T1',
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        user: { id: 'u-1', email: 'ana@demo.test', displayName: 'Ana', role: 'admin' },
        tenantId: 'demo',
        permissions: [],
        features: {},
      },
    };
    await renderLogin();

    await submitPassword();

    expect({
      error: loginError(),
      accessToken: useAuthStore.getState().accessToken,
      path: currentPath(),
    }).toEqual({ error: null, accessToken: 'T1', path: '/admin' });
  });

  it.each([
    [
      '403 (the key owner may not sign in)',
      { status: 403, body: ACCOUNT_NOT_ACTIVE_BODY },
      'account-inactive',
      enCommon.auth.account_not_active,
    ],
    [
      '401 (an unknown, revoked or expired key)',
      { status: 401 },
      'invalid-key',
      enCommon.auth.invalid_key,
    ],
    ['a network failure', 'network-error', 'invalid-key', enCommon.auth.invalid_key],
  ] as const)(
    'ApiKeyLogin_ShouldMapTheRefusalToItsCode_WhenTheApiKeyLoginFailsWith %s',
    async (_case, answer, code, text) => {
      answers['/api/v1/auth/login/apikey'] = answer;
      await renderLogin();

      fireEvent.click(screen.getByTestId('login-apikey-toggle'));
      fireEvent.change(screen.getByTestId('login-apikey-input'), { target: { value: 'vk_key' } });
      fireEvent.click(screen.getByTestId('login-apikey-submit'));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      await settle();

      expect({ error: loginError(), accessToken: useAuthStore.getState().accessToken }).toEqual({
        error: { code, text },
        accessToken: null,
      });
    },
  );

  it.each(['es-419', 'pt-BR'] as const)(
    'SignInRefusals_ShouldShowTheLocaleTextAndNeverTheEnglishServerText_InLocale %s',
    async (lng) => {
      answers['/api/v1/auth/login'] = { status: 403, body: ACCOUNT_NOT_ACTIVE_BODY };
      await renderLogin({ lng });

      await submitPassword();

      expect(loginError()).toEqual({
        code: 'account-inactive',
        text: COMMON[lng].auth.account_not_active,
      });
      expect(document.body.textContent).not.toContain(ACCOUNT_NOT_ACTIVE_BODY.error);
    },
  );

  it.each(['es-419', 'pt-BR'] as const)(
    'MfaVerify_ShouldShowTheLocaleTextAndNeverTheEnglishServerText_WhenRefusedInLocale %s',
    async (lng) => {
      answers['/api/v1/auth/mfa/verify'] = { status: 403, body: ACCOUNT_NOT_ACTIVE_BODY };
      useAuthStore.getState().setMfaPending('mfa-challenge-1', 'ana@demo.test');
      await renderLogin({ lng });

      await submitMfaCode();

      expect(loginError()).toEqual({
        code: 'account-inactive',
        text: COMMON[lng].auth.account_not_active,
      });
      expect(document.body.textContent).not.toContain(ACCOUNT_NOT_ACTIVE_BODY.error);
    },
  );

  it('SsoLogin_ShouldShowTheTranslatedNoTenantMessageWithItsCode_WhenNoTenantCanBeDetermined', async () => {
    vi.stubEnv('VITE_DEFAULT_TENANT_ID', '');
    await renderLogin({ lng: 'pt-BR' });

    fireEvent.click(screen.getByTestId('login-sso-button'));

    expect(loginError()).toEqual({ code: 'sso-no-tenant', text: ptCommon.auth.sso_no_tenant });
    expect(document.body.textContent).not.toContain('Cannot determine tenant for SSO login');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('MfaVerify paths that are not a refusal', () => {
  beforeEach(() => {
    useAuthStore.getState().setMfaPending('mfa-challenge-1', 'ana@demo.test');
  });

  it.each([
    ['a wrong code (401)', { status: 401 }, enCommon.auth.mfa_invalid_code],
    ['rate limiting (429)', { status: 429 }, enCommon.auth.mfa_rate_limited],
    [
      'an expired challenge (400)',
      { status: 400, body: { error: 'Invalid or expired challenge token' } },
      enCommon.auth.mfa_challenge_expired,
    ],
  ] as const)(
    'MfaVerify_ShouldStayOnTheStepWithItsExistingMessage_WhenTheVerifyApiAnswers %s',
    async (_case, answer, message) => {
      answers['/api/v1/auth/mfa/verify'] = answer;
      await renderLogin();

      await submitMfaCode('654321');

      expect({
        mfaStepOpen: screen.queryByTestId('login-mfa-section') !== null,
        message: screen.queryByText(message) !== null,
        mfaPending: useAuthStore.getState().mfaPending,
        error: loginError(),
      }).toEqual({
        mfaStepOpen: true,
        message: true,
        mfaPending: { mfaToken: 'mfa-challenge-1', email: 'ana@demo.test' },
        error: null,
      });
    },
  );
});

describe('LoginPage /login?reason= notice', () => {
  it.each(['en-US', 'es-419', 'pt-BR'] as const)(
    'Notice_ShouldShowTheSessionEndedNoticeWithItsCode_WhenTheReasonIsSessionEndedInLocale %s',
    async (lng) => {
      await renderLogin({ lng, entry: '/login?reason=session-ended' });

      const notice = screen.getByTestId('login-notice');
      expect({
        code: notice.getAttribute('data-notice-code'),
        text: notice.textContent,
      }).toEqual({ code: 'session-ended', text: COMMON[lng].auth.session_ended });
    },
  );

  it.each([
    ['an unknown value', 'ended-by-attacker-7f3a'],
    ['markup', '<b>ended-by-attacker-7f3a</b>'],
    ['an inherited object key', 'constructor'],
    ['the prototype key', '__proto__'],
    ['a key of the same map spelled differently', 'Session-Ended'],
  ])('Notice_ShouldRenderNothingAndNotEchoTheReason_WhenTheReasonIs %s', async (_case, reason) => {
    await renderLogin({ entry: `/login?reason=${encodeURIComponent(reason)}` });

    expect(screen.queryByTestId('login-notice')).toBeNull();
    expect(pageHtml()).not.toContain('ended-by-attacker-7f3a');
    expect(screen.getByTestId('page').textContent).not.toContain(reason);
  });

  it('Notice_ShouldRenderNothing_WhenThereIsNoReason', async () => {
    await renderLogin();

    expect(screen.queryByTestId('login-notice')).toBeNull();
  });

  it('Notice_ShouldStayAboveARefusal_WhenTheUserSignsInAgainAfterTheSessionEnded', async () => {
    answers['/api/v1/auth/login'] = { status: 403, body: ACCOUNT_NOT_ACTIVE_BODY };
    await renderLogin({ entry: '/login?reason=session-ended' });

    await submitPassword();

    expect({
      notice: screen.queryByTestId('login-notice')?.getAttribute('data-notice-code'),
      error: loginError()?.code,
    }).toEqual({ notice: 'session-ended', error: 'account-inactive' });
  });
});
