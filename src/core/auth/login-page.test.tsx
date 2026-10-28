/**
 * The login page's refusal and notice handling (spec `sign-in-refusal-feedback`), rendered with the
 * real page, the real auth store and a real i18next instance loaded with the three committed
 * `common.json` files, so every assertion reads the text a user would see. `fetch` is stubbed per
 * test with real `Response` objects shaped like Platform's answers; the v2.29.0 sign-in 403s use the
 * host fixture `sign-in-refusal-codes.v1.json` values verbatim.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import enCommon from '../../../public/locales/en-US/common.json';
import esCommon from '../../../public/locales/es-419/common.json';
import ptCommon from '../../../public/locales/pt-BR/common.json';
import { setBrandingFetch, useBrandingStore } from '@/core/branding';
import { useAuthStore } from './auth-store';
import { LoginPage } from './login-page';

type Locale = 'en-US' | 'es-419' | 'pt-BR';

const COMMON: Record<Locale, typeof enCommon> = {
  'en-US': enCommon,
  'es-419': esCommon,
  'pt-BR': ptCommon,
};

/**
 * The account 403 body before Platform v2.29.0, English prose whatever the console locale
 * (sign-in-refusal-codes.v1.json `accountInactive.previousBody`).
 */
const ACCOUNT_NOT_ACTIVE_BODY = { error: 'Account is not active.' };

/** sign-in-refusal-codes.v1.json `accountInactive`: status, headers and body. */
const ACCOUNT_INACTIVE_403 = {
  status: 403,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: { error: 'account-inactive' },
};
/** sign-in-refusal-codes.v1.json `tenantSuspended`: status, headers and body. */
const TENANT_SUSPENDED_403 = {
  status: 403,
  headers: { 'Content-Type': 'application/json' },
  body: { error: 'tenant-suspended' },
};
/** sign-in-refusal-codes.v1.json `tenantPendingDeletion`: status, headers and body. */
const TENANT_PENDING_DELETION_403 = {
  status: 403,
  headers: { 'Content-Type': 'application/json' },
  body: { error: 'tenant-pending-deletion' },
};
/** sign-in-refusal-codes.v1.json `tenantSuspended.previousBody` (a Platform before v2.29.0). */
const TENANT_SUSPENDED_PREVIOUS_BODY = {
  error: 'This tenant account has been suspended. Contact your administrator.',
};

interface FakeAnswer {
  status: number;
  /** Serialized as JSON. */
  body?: unknown;
  /** Sent as-is instead of `body`, for a body that is not JSON. */
  rawBody?: string;
  headers?: Record<string, string>;
}

let answers: Record<string, FakeAnswer | 'network-error'>;
const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const answer = answers[url];
  if (answer === undefined) throw new Error(`unexpected fetch ${url}`);
  if (answer === 'network-error') throw new TypeError('Failed to fetch');
  if (answer.rawBody !== undefined) {
    return new Response(answer.rawBody, { status: answer.status, headers: answer.headers ?? {} });
  }
  return new Response(answer.body === undefined ? null : JSON.stringify(answer.body), {
    status: answer.status,
    headers:
      answer.headers ?? (answer.body === undefined ? {} : { 'Content-Type': 'application/json' }),
  });
});

/** Branding requests' own seam (design D8): 404 unless a case answers otherwise. */
const brandingFetchMock = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(
  async () => new Response(null, { status: 404 }),
);

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

async function submitApiKey() {
  fireEvent.click(screen.getByTestId('login-apikey-toggle'));
  fireEvent.change(screen.getByTestId('login-apikey-input'), { target: { value: 'vk_key' } });
  fireEvent.click(screen.getByTestId('login-apikey-submit'));
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
  brandingFetchMock.mockClear();
  setBrandingFetch(brandingFetchMock);
  vi.stubEnv('VITE_DEFAULT_TENANT_ID', '');
  useAuthStore.getState().logout();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  useAuthStore.getState().logout();
});

// Spec `console-verbara-attribution`, "The sign-in page carries the suffix" (design D5).
describe('LoginPage tab title', () => {
  it('Title_ShouldReadSignInWithTheVerbaraSuffix_WhenNoTenantBrandIsResolved', async () => {
    const previous = document.title;
    await renderLogin();
    expect(document.title).toBe('Sign in · Verbara');
    cleanup();
    expect(document.title).toBe(previous);
  });
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

  it('MfaVerify_ShouldCloseTheStepClearTheChallengeAndShowAccountNotActive_WhenTheVerifyApiAnswersAnUncoded403', async () => {
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

/** The two sign-in forms, each with its route and its submit helper. */
const SIGN_IN_FORMS = [
  ['password', '/api/v1/auth/login', submitPassword],
  ['api-key', '/api/v1/auth/login/apikey', submitApiKey],
] as const;

describe('LoginPage coded sign-in 403s (Platform v2.29.0)', () => {
  const CODED = [
    ['accountInactive', ACCOUNT_INACTIVE_403, 'account-inactive', 'account_not_active'],
    ['tenantSuspended', TENANT_SUSPENDED_403, 'tenant-suspended', 'tenant_suspended'],
    [
      'tenantPendingDeletion',
      TENANT_PENDING_DELETION_403,
      'tenant-pending-deletion',
      'tenant_pending_deletion',
    ],
  ] as const;

  describe.each(SIGN_IN_FORMS)('the %s form', (_form, route, submit) => {
    it.each(CODED)(
      'ShouldShowTheCodesMessageWithItsCodeAndStoreNoToken_WhenTheApiAnswersThe %s fixture',
      async (_entry, answer, code, key) => {
        answers[route] = answer;
        await renderLogin();

        await submit();

        expect({
          error: loginError(),
          accessToken: useAuthStore.getState().accessToken,
          path: currentPath(),
        }).toEqual({
          error: { code, text: enCommon.auth[key] },
          accessToken: null,
          path: '/login',
        });
      },
    );

    it.each([
      [
        'prose from a Platform before v2.29.0',
        { status: 403, body: TENANT_SUSPENDED_PREVIOUS_BODY },
      ],
      ['an unknown machine code', { status: 403, body: { error: 'tenant-archived' } }],
      ['no body', { status: 403 }],
      [
        'a body that is not JSON',
        {
          status: 403,
          rawBody: '<html>Forbidden</html>',
          headers: { 'Content-Type': 'text/html' },
        },
      ],
    ] as const)(
      'ShouldShowAccountNotActiveAndStoreNoToken_WhenTheApiAnswersA403With %s',
      async (_case, answer) => {
        answers[route] = answer;
        await renderLogin();

        await submit();

        expect({
          error: loginError(),
          accessToken: useAuthStore.getState().accessToken,
          path: currentPath(),
        }).toEqual({
          error: { code: 'account-inactive', text: enCommon.auth.account_not_active },
          accessToken: null,
          path: '/login',
        });
        expect(pageHtml()).not.toContain(TENANT_SUSPENDED_PREVIOUS_BODY.error);
      },
    );
  });

  it.each(['en-US', 'es-419', 'pt-BR'] as const)(
    'TenantRefusals_ShouldShowTheLocaleTextAndNeverMentionPayment_InLocale %s',
    async (lng) => {
      const shown: Record<string, string | null | undefined> = {};
      for (const [answer, key] of [
        [TENANT_SUSPENDED_403, 'tenant_suspended'],
        [TENANT_PENDING_DELETION_403, 'tenant_pending_deletion'],
      ] as const) {
        answers = { '/api/v1/auth/login': answer };
        fetchMock.mockClear();
        await renderLogin({ lng });
        await submitPassword();
        shown[key] = loginError()?.text;
        cleanup();
      }

      expect(shown).toEqual({
        tenant_suspended: COMMON[lng].auth.tenant_suspended,
        tenant_pending_deletion: COMMON[lng].auth.tenant_pending_deletion,
      });
      for (const text of Object.values(shown)) {
        expect(text).not.toMatch(/pay|billing|bill|pago|factura|pagamento|cobran/i);
      }
    },
  );
});

/** The MFA step's message element, or `null` when none is shown. */
function mfaError() {
  const el = screen.queryByTestId('login-mfa-error');
  return el === null ? null : { code: el.getAttribute('data-error-code'), text: el.textContent };
}

const PENDING_CHALLENGE = { mfaToken: 'mfa-challenge-1', email: 'ana@demo.test' };

describe('MfaVerify final refusals (403 and 423)', () => {
  beforeEach(() => {
    useAuthStore.getState().setMfaPending('mfa-challenge-1', 'ana@demo.test');
  });

  it.each([
    // mfa-verify-refusals.v1.json `accountInactive` / `tenantSuspended` / `tenantPendingDeletion`
    // are $refs to sign-in-refusal-codes.v1.json; status, headers and body from there.
    ['accountInactive', ACCOUNT_INACTIVE_403, 'account-inactive', 'account_not_active'],
    ['tenantSuspended', TENANT_SUSPENDED_403, 'tenant-suspended', 'tenant_suspended'],
    [
      'tenantPendingDeletion',
      TENANT_PENDING_DELETION_403,
      'tenant-pending-deletion',
      'tenant_pending_deletion',
    ],
    // mfa-verify-refusals.v1.json `locked`: status, headers and body (prose, not read).
    [
      'locked',
      {
        status: 423,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: { error: 'Account is locked' },
      },
      'account-locked',
      'account_locked',
    ],
  ] as const)(
    'MfaVerify_ShouldCloseTheStepClearTheChallengeAndShowTheSignInCode_WhenTheVerifyApiAnswersThe %s fixture',
    async (_entry, answer, code, key) => {
      answers['/api/v1/auth/mfa/verify'] = answer;
      await renderLogin();

      await submitMfaCode();

      expect({
        mfaStepOpen: screen.queryByTestId('login-mfa-section') !== null,
        mfaPending: useAuthStore.getState().mfaPending,
        error: loginError(),
        accessToken: useAuthStore.getState().accessToken,
        path: currentPath(),
      }).toEqual({
        mfaStepOpen: false,
        mfaPending: null,
        error: { code, text: enCommon.auth[key] },
        accessToken: null,
        path: '/login',
      });
    },
  );
});

describe('MfaVerify step errors that keep the user on the code screen', () => {
  beforeEach(() => {
    useAuthStore.getState().setMfaPending('mfa-challenge-1', 'ana@demo.test');
  });

  it.each([
    // mfa-verify-refusals.v1.json `wrongFactor`: status 401, no headers, body null.
    [
      'a wrong code (401, no body)',
      { status: 401, headers: {} },
      'invalid-code',
      'mfa_invalid_code',
    ],
    [
      'a 401 with a ProblemDetails body',
      {
        status: 401,
        headers: { 'Content-Type': 'application/problem+json' },
        body: { title: 'Unauthorized', status: 401, detail: 'Unauthorized access' },
      },
      'invalid-code',
      'mfa_invalid_code',
    ],
    // mfa-verify-refusals.v1.json `rateLimited`: status, headers and body.
    [
      'rate limiting (429)',
      {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '37' },
        body: {
          type: 'rate_limit_exceeded',
          title: 'Too Many Requests',
          status: 429,
          detail: 'MFA verify rate limit exceeded',
          retryAfter: 37,
        },
      },
      'rate-limited',
      'mfa_rate_limited',
    ],
    // mfa-verify-refusals.v1.json `serverError`: status, headers and body.
    [
      'a server error (500)',
      {
        status: 500,
        headers: { 'Content-Type': 'application/problem+json' },
        body: {
          title: 'Internal Server Error',
          status: 500,
          detail: 'An unexpected error occurred. Quote the traceId when reporting it.',
          instance: '/api/v1/auth/mfa/verify',
          traceId: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        },
      },
      'server-error',
      'mfa_server_error',
    ],
    [
      'a gateway error (503, not JSON)',
      {
        status: 503,
        rawBody: '<html>Service Unavailable</html>',
        headers: { 'Content-Type': 'text/html' },
      },
      'server-error',
      'mfa_server_error',
    ],
    [
      'a 400 whose prose mentions expiry but carries no expired code',
      { status: 400, body: { error: 'Invalid or expired challenge token' } },
      'mfa-error',
      'mfa_error',
    ],
    ['a network failure', 'network-error', 'mfa-error', 'mfa_error'],
  ] as const)(
    'MfaVerify_ShouldStayOnTheStepWithItsCodedMessage_WhenTheVerifyApiAnswers %s',
    async (_case, answer, code, key) => {
      answers['/api/v1/auth/mfa/verify'] = answer;
      await renderLogin();

      await submitMfaCode('654321');

      expect({
        mfaStepOpen: screen.queryByTestId('login-mfa-section') !== null,
        mfaError: mfaError(),
        mfaPending: useAuthStore.getState().mfaPending,
        error: loginError(),
      }).toEqual({
        mfaStepOpen: true,
        mfaError: { code, text: enCommon.auth[key] },
        mfaPending: PENDING_CHALLENGE,
        error: null,
      });
      expect(pageHtml()).not.toContain('Invalid or expired challenge token');
      expect(pageHtml()).not.toContain('An unexpected error occurred');
    },
  );
});

describe('MfaVerify spent challenges (exhausted and expired)', () => {
  beforeEach(() => {
    // Only the timer APIs: the delayed clearMfaPending runs when the test advances the clock.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    useAuthStore.getState().setMfaPending('mfa-challenge-1', 'ana@demo.test');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Runs the verify handler to the end under fake timers, without advancing the clock. */
  async function settleFake() {
    await act(async () => {
      for (let i = 0; i < 5; i++) await vi.advanceTimersByTimeAsync(0);
    });
  }

  it.each([
    // mfa-verify-refusals.v1.json `exhausted`: status, headers and body.
    [
      'exhausted',
      {
        status: 401,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: { error: 'mfa-challenge-exhausted' },
      },
      'challenge-exhausted',
      'mfa_challenge_exhausted',
    ],
    // mfa-verify-refusals.v1.json `expired`: status, headers and body.
    [
      'expired',
      {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: { error: 'mfa-challenge-expired' },
      },
      'challenge-expired',
      'mfa_challenge_expired',
    ],
  ] as const)(
    'MfaVerify_ShouldShowTheMessageThenClearTheChallengeAndReturnToSignIn_WhenTheVerifyApiAnswersThe %s fixture',
    async (_entry, answer, code, key) => {
      answers['/api/v1/auth/mfa/verify'] = answer;
      await renderLogin();

      '123456'.split('').forEach((digit, i) => {
        fireEvent.change(screen.getByTestId(`login-mfa-digit-${i}`), { target: { value: digit } });
      });
      await settleFake();

      const shown = {
        mfaError: mfaError(),
        mfaPending: useAuthStore.getState().mfaPending,
      };

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect({
        shown,
        after: {
          mfaStepOpen: screen.queryByTestId('login-mfa-section') !== null,
          signInForm: screen.queryByTestId('login-submit') !== null,
          mfaPending: useAuthStore.getState().mfaPending,
          accessToken: useAuthStore.getState().accessToken,
        },
      }).toEqual({
        shown: { mfaError: { code, text: enCommon.auth[key] }, mfaPending: PENDING_CHALLENGE },
        after: { mfaStepOpen: false, signInForm: true, mfaPending: null, accessToken: null },
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  // The same two fixture entries, for the delayed return to sign-in.
  const SPENT_ANSWERS = [
    [
      'exhausted',
      {
        status: 401,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: { error: 'mfa-challenge-exhausted' },
      },
    ],
    [
      'expired',
      {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: { error: 'mfa-challenge-expired' },
      },
    ],
  ] as const;

  async function answerSpentChallenge(answer: FakeAnswer) {
    answers['/api/v1/auth/mfa/verify'] = answer;
    await renderLogin();
    '123456'.split('').forEach((digit, i) => {
      fireEvent.change(screen.getByTestId(`login-mfa-digit-${i}`), { target: { value: digit } });
    });
    await settleFake();
  }

  it.each(SPENT_ANSWERS)(
    'MfaVerify_ShouldKeepTheNewChallenge_WhenTheUserCancelsAndSignsInAgainWithin3sOfThe %s answer',
    async (_entry, answer) => {
      await answerSpentChallenge(answer);

      fireEvent.click(screen.getByTestId('login-mfa-cancel'));
      answers['/api/v1/auth/login'] = {
        status: 200,
        body: { requiresMfa: true, mfaToken: 'mfa-challenge-2' },
      };
      fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'ana@demo.test' } });
      fireEvent.change(screen.getByTestId('login-password'), {
        target: { value: 'Correct-Horse-1' },
      });
      fireEvent.click(screen.getByTestId('login-submit'));
      await settleFake();
      const signedInAgain = useAuthStore.getState().mfaPending?.mfaToken;

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect({
        signedInAgain,
        after: {
          mfaStepOpen: screen.queryByTestId('login-mfa-section') !== null,
          mfaToken: useAuthStore.getState().mfaPending?.mfaToken,
        },
      }).toEqual({
        signedInAgain: 'mfa-challenge-2',
        after: { mfaStepOpen: true, mfaToken: 'mfa-challenge-2' },
      });
    },
  );

  it.each(SPENT_ANSWERS)(
    'MfaVerify_ShouldKeepANewerChallenge_WhenTheStoreHoldsADifferentTokenBefore3sAfterThe %s answer',
    async (_entry, answer) => {
      await answerSpentChallenge(answer);

      act(() => {
        useAuthStore.getState().setMfaPending('mfa-challenge-2', 'ana@demo.test');
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(useAuthStore.getState().mfaPending?.mfaToken).toBe('mfa-challenge-2');
    },
  );

  it.each(SPENT_ANSWERS)(
    'MfaVerify_ShouldLeaveNoPendingClear_WhenTheStepUnmountsWithin3sOfThe %s answer',
    async (_entry, answer) => {
      await answerSpentChallenge(answer);

      cleanup();
      const timersAfterUnmount = vi.getTimerCount();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect({
        timersAfterUnmount,
        mfaPending: useAuthStore.getState().mfaPending,
      }).toEqual({ timersAfterUnmount: 0, mfaPending: PENDING_CHALLENGE });
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

describe('LoginPage tenant field', () => {
  it('TenantField_ShouldRenderThePtBrLabelAndPlaceholder_WhenTheConsoleRunsInPtBr', async () => {
    vi.stubEnv('VITE_DEFAULT_TENANT_ID', '');
    await renderLogin({ lng: 'pt-BR' });

    expect({
      label: screen.getByTestId('login-tenant-toggle').textContent,
      placeholder: screen.getByTestId('login-tenant').getAttribute('placeholder'),
    }).toEqual({ label: ptCommon.auth.tenant, placeholder: ptCommon.auth.tenant_placeholder });
  });

  // The parity gate cannot see a key missing from all three locales, and an inline default hides it
  // in English. With the keys removed from the bundle, the page must show the raw key (what the
  // other labels would show), never an English default.
  it('TenantField_ShouldNotFallBackToAnInlineEnglishDefault_WhenItsKeysAreMissing', async () => {
    vi.stubEnv('VITE_DEFAULT_TENANT_ID', '');
    const { tenant: _tenant, tenant_placeholder: _placeholder, ...auth } = ptCommon.auth;
    const i18n = i18next.createInstance();
    await i18n.init({
      lng: 'pt-BR',
      fallbackLng: false,
      resources: { 'pt-BR': { common: { ...ptCommon, auth } } },
      ns: ['common'],
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/login']}>
          <LoginPage />
        </MemoryRouter>
      </I18nextProvider>,
    );

    expect({
      label: screen.getByTestId('login-tenant-toggle').textContent,
      placeholder: screen.getByTestId('login-tenant').getAttribute('placeholder'),
    }).toEqual({ label: 'auth.tenant', placeholder: 'auth.tenant_placeholder' });
  });

  it('TenantField_ShouldBeOpenAndEmpty_WhenTheHostIsAnIPv4AddressAndNoDefaultIsBuiltIn', async () => {
    vi.stubEnv('VITE_DEFAULT_TENANT_ID', '');
    vi.stubGlobal('location', { ...window.location, hostname: '10.0.0.5' });
    await renderLogin();

    expect((screen.queryByTestId('login-tenant') as HTMLInputElement | null)?.value).toBe('');
  });
});

describe('LoginPage host tenant guess (spec console-host-tenant-guess)', () => {
  function onHost(hostname: string) {
    vi.stubEnv('VITE_DEFAULT_TENANT_ID', '');
    vi.stubGlobal('location', { ...window.location, hostname });
  }

  /** The tenant field as the user sees it: the toggle's text and the input, when it is rendered. */
  function tenantField() {
    const input = screen.queryByTestId('login-tenant') as HTMLInputElement | null;
    return {
      toggle: screen.getByTestId('login-tenant-toggle').textContent,
      rendered: input !== null,
      value: input?.value ?? null,
    };
  }

  /** The tenant the login request named, in its body and in its `X-Tenant-Id` header. */
  function loginRequestTenant() {
    const call = fetchMock.mock.calls.find(([input]) => input === '/api/v1/auth/login');
    expect(call).toBeDefined();
    const init = (call as unknown as [RequestInfo | URL, RequestInit | undefined])[1];
    return {
      body: (JSON.parse(String(init?.body)) as { tenantId: string | null }).tenantId,
      header: new Headers(init?.headers).get('X-Tenant-Id'),
    };
  }

  /**
   * Regression case (task 1.2), "A trailing-dot two-label host is the same host": the browser keeps
   * the trailing dot of `acme-corp.lan.`, and the empty last label must not make it a three-label
   * host. Fails before the fix: the field is collapsed and pre-filled with `acme-corp`.
   */
  it('TenantField_ShouldBeOpenAndEmpty_WhenATwoLabelHostEndsInATrailingDotAndNoDefaultIsBuiltIn', async () => {
    onHost('acme-corp.lan.');
    await renderLogin();

    expect(tenantField()).toEqual({ toggle: enCommon.auth.tenant, rendered: true, value: '' });
  });

  /**
   * Contract pin, passes before the fix: "A LAN IPv4 address pre-fills nothing" on the spec's own
   * address (the `10.0.0.5` case above is the same rule).
   */
  it('TenantField_ShouldBeOpenAndEmpty_WhenTheHostIsALanIPv4AddressAndNoDefaultIsBuiltIn', async () => {
    onHost('192.168.1.50');
    await renderLogin();

    expect(tenantField()).toEqual({ toggle: enCommon.auth.tenant, rendered: true, value: '' });
  });

  /**
   * Contract pin, passes before the fix: "A real tenant subdomain still pre-fills its tenant", with
   * and without the trailing dot. The field stays collapsed and its toggle names the guess.
   */
  it.each(['acme.platform.example', 'acme.platform.example.'])(
    'TenantField_ShouldBePrefilledWithTheSubdomain_WhenTheHostIsATenantSubdomain %s',
    async (hostname) => {
      onHost(hostname);
      await renderLogin();

      expect(tenantField()).toEqual({
        toggle: `${enCommon.auth.tenant}: acme`,
        rendered: false,
        value: null,
      });
    },
  );

  /**
   * Contract pin, passes before the fix: "No guess leaves the choice to the user". On an IP host the
   * typed tenant is what the login request names, in the body and in `X-Tenant-Id`.
   */
  it('EmailLogin_ShouldSendTheTypedTenantInBodyAndHeader_WhenTheHostYieldsNoGuess', async () => {
    answers['/api/v1/auth/login'] = { status: 401 };
    onHost('10.0.0.5');
    await renderLogin();

    fireEvent.change(screen.getByTestId('login-tenant'), { target: { value: 'acme' } });
    await submitPassword();

    expect(loginRequestTenant()).toEqual({ body: 'acme', header: 'acme' });
  });

  /**
   * Contract pin, passes before the fix: "A phantom guess on an internal hostname can be corrected"
   * (the dotted non-IP residual of Platform/ADR-0038). The guess is shown on the toggle, and the
   * user's correction is what the login request names.
   */
  it('EmailLogin_ShouldSendTheCorrectedTenant_WhenTheUserReplacesAPhantomHostGuess', async () => {
    answers['/api/v1/auth/login'] = { status: 401 };
    onHost('verbara.acme-corp.lan');
    await renderLogin();

    const toggleText = screen.getByTestId('login-tenant-toggle').textContent;
    fireEvent.click(screen.getByTestId('login-tenant-toggle'));
    const guessed = (screen.getByTestId('login-tenant') as HTMLInputElement).value;
    fireEvent.change(screen.getByTestId('login-tenant'), { target: { value: 'acme' } });
    await submitPassword();

    expect({ toggleText, guessed, request: loginRequestTenant() }).toEqual({
      toggleText: expect.stringContaining('verbara') as unknown,
      guessed: 'verbara',
      request: { body: 'acme', header: 'acme' },
    });
  });
});

describe('LoginPage single sign-on MFA challenge', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  function challengeToken() {
    return `chal-${crypto.randomUUID()}`;
  }

  it('SsoMfaChallenge_ShouldOpenTheMfaStepWithTheFragmentsToken_WhenTheLoginPageLoadsWithTheChallengeFragment', async () => {
    const token = challengeToken();
    window.history.replaceState(
      null,
      '',
      `/login#oidc_mfa_challenge&challenge_token=${encodeURIComponent(token)}&tenant_id=t1`,
    );
    await renderLogin();

    expect(await screen.findByTestId('login-mfa-section')).toBeInTheDocument();
    expect(useAuthStore.getState().mfaPending?.mfaToken).toBe(token);
  });

  it('SsoMfaChallenge_ShouldRemoveTheFragmentFromTheAddressBar_WhenItOpensTheMfaStep', async () => {
    window.history.replaceState(
      null,
      '',
      `/login?x=1#oidc_mfa_challenge&challenge_token=${challengeToken()}&tenant_id=t1`,
    );
    await renderLogin();

    await screen.findByTestId('login-mfa-section');
    expect({
      hash: window.location.hash,
      path: window.location.pathname + window.location.search,
    }).toEqual({ hash: '', path: '/login?x=1' });
  });

  it.each([
    ['without a token', '#oidc_mfa_challenge&tenant_id=t1'],
    ['with an empty token', '#oidc_mfa_challenge&challenge_token=&tenant_id=t1'],
    [
      'the enrollment-required redirect',
      '#oidc_mfa_enrollment_required&tenant_id=t1&email=a%40b.c',
    ],
  ])('SsoMfaChallenge_ShouldLeaveTheSignInForm_WhenTheFragmentIs %s', async (_case, hash) => {
    window.history.replaceState(null, '', `/login${hash}`);
    await renderLogin();
    await settle();

    expect({
      mfaStep: screen.queryByTestId('login-mfa-section') !== null,
      signInForm: screen.queryByTestId('login-submit') !== null,
      mfaPending: useAuthStore.getState().mfaPending,
    }).toEqual({ mfaStep: false, signInForm: true, mfaPending: null });
  });

  it('SsoMfaChallenge_ShouldSignTheUserInWithTheChallengeToken_WhenTheMfaCodeIsAccepted', async () => {
    const token = challengeToken();
    answers['/api/v1/auth/mfa/verify'] = {
      status: 200,
      body: {
        accessToken: 'access-after-sso-mfa',
        expiresAt: new Date(Date.now() + 900_000).toISOString(),
        tenantId: 't1',
        user: { id: 'u1', email: 'ana@t1.test', displayName: 'Ana', role: 'agent' },
        permissions: [],
        features: {},
      },
    };
    window.history.replaceState(
      null,
      '',
      `/login#oidc_mfa_challenge&challenge_token=${encodeURIComponent(token)}&tenant_id=t1`,
    );
    await renderLogin();
    await screen.findByTestId('login-mfa-section');

    await submitMfaCode('246810');

    const [, init] = fetchMock.mock.calls[0]!;
    expect({
      body: JSON.parse(String(init?.body)) as unknown,
      accessToken: useAuthStore.getState().accessToken,
      tenantId: useAuthStore.getState().tenantId,
      path: currentPath(),
    }).toEqual({
      body: { mfaToken: token, code: '246810' },
      accessToken: 'access-after-sso-mfa',
      tenantId: 't1',
      path: '/agent',
    });
  });
});

describe('MfaVerify sends the tenant the sign-in used', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  /** The `X-Tenant-Id` header of the verify request, or `null` when it was sent without one. */
  function verifyTenantHeader(): string | null {
    const call = fetchMock.mock.calls.find(([input]) => input === '/api/v1/auth/mfa/verify');
    expect(call).toBeDefined();
    const init = (call as unknown as [RequestInfo | URL, RequestInit | undefined])[1];
    return new Headers(init?.headers).get('X-Tenant-Id');
  }

  async function passwordSignInThenMfa(tenant: string) {
    vi.stubEnv('VITE_DEFAULT_TENANT_ID', '');
    answers['/api/v1/auth/login'] = {
      status: 200,
      body: { requiresMfa: true, mfaToken: 'mfa-challenge-1' },
    };
    // sign-in-refusal-codes.v1.json `tenantSuspended` (its routes include `mfaVerify`).
    answers['/api/v1/auth/mfa/verify'] = TENANT_SUSPENDED_403;
    await renderLogin();
    fireEvent.change(screen.getByTestId('login-tenant'), { target: { value: tenant } });
    await submitPassword();
    expect(screen.getByTestId('login-mfa-section')).toBeInTheDocument();
    '123456'.split('').forEach((digit, i) => {
      fireEvent.change(screen.getByTestId(`login-mfa-digit-${i}`), { target: { value: digit } });
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await settle();
  }

  it('MfaVerify_ShouldSendTheTypedTenantAsXTenantId_WhenThePasswordSignInUsedOne', async () => {
    await passwordSignInThenMfa('acme');

    expect({ header: verifyTenantHeader(), error: loginError()?.code }).toEqual({
      header: 'acme',
      error: 'tenant-suspended',
    });
  });

  it('MfaVerify_ShouldSendNoXTenantId_WhenThePasswordSignInSentNone', async () => {
    await passwordSignInThenMfa('   ');

    const [, loginInit] = fetchMock.mock.calls[0]!;
    expect({
      loginHeader: new Headers(loginInit?.headers).get('X-Tenant-Id'),
      verifyHeader: verifyTenantHeader(),
    }).toEqual({ loginHeader: null, verifyHeader: null });
  });

  it.each([
    ['carries tenant_id', '&tenant_id=t1', 't1'],
    ['carries no tenant_id', '', null],
  ] as const)(
    'SsoMfaChallenge_ShouldSendTheFragmentsTenantOnVerify_WhenTheFragment %s',
    async (_case, tenantPart, expected) => {
      answers['/api/v1/auth/mfa/verify'] = TENANT_SUSPENDED_403;
      window.history.replaceState(
        null,
        '',
        `/login#oidc_mfa_challenge&challenge_token=chal-1${tenantPart}`,
      );
      await renderLogin();
      await screen.findByTestId('login-mfa-section');

      await submitMfaCode();

      expect(verifyTenantHeader()).toBe(expected);
    },
  );
});

/**
 * The sign-in brand (spec `console-tenant-branding`, design D3 and D5). Every case stubs and reads
 * the branding seam (`brandingFetchMock`), never the page's `fetch` stub: per URL, an answer, a
 * network error, or a deferred answer the case releases when it chooses.
 */
describe('LoginPage sign-in brand (spec console-tenant-branding)', () => {
  type BrandingAnswer = { status: number; body?: unknown } | 'network-error' | Deferred;

  interface Deferred {
    readonly kind: 'deferred';
    readonly promise: Promise<Response>;
    resolve: (answer: { status: number; body?: unknown }) => void;
    fail: () => void;
  }

  let brandingAnswers: Record<string, BrandingAnswer>;

  function toResponse({ status, body }: { status: number; body?: unknown }): Response {
    return body === undefined
      ? new Response(null, { status })
      : new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        });
  }

  function deferred(): Deferred {
    let resolve!: Deferred['resolve'];
    let fail!: Deferred['fail'];
    const promise = new Promise<Response>((res, rej) => {
      resolve = (answer) => res(toResponse(answer));
      fail = () => rej(new TypeError('Failed to fetch'));
    });
    return { kind: 'deferred', promise, resolve, fail };
  }

  beforeEach(() => {
    brandingAnswers = {};
    brandingFetchMock.mockImplementation(async (input) => {
      const answer = brandingAnswers[input] ?? { status: 404 };
      if (answer === 'network-error') throw new TypeError('Failed to fetch');
      if ('kind' in answer) return answer.promise;
      return toResponse(answer);
    });
  });

  afterEach(() => {
    brandingFetchMock.mockImplementation(async () => new Response(null, { status: 404 }));
    window.history.replaceState(null, '', '/');
  });

  function onHost(hostname: string) {
    vi.stubGlobal('location', { ...window.location, hostname });
  }

  const BY_HOST = '/api/v1/branding/by-subdomain/acme';
  const byTenant = (tenant: string) => `/api/v1/branding/${tenant}`;

  /** The branding requests made by tenant id, in order (the host lookup excluded). */
  function byTenantRequests(): string[] {
    return brandingFetchMock.mock.calls
      .map(([input]) => input)
      .filter((url) => url.startsWith('/api/v1/branding/') && !url.startsWith(BY_HOST));
  }

  /** The heading and logo as a user sees them. */
  function signInBrand() {
    const heading = screen.getByTestId('login-brand-name');
    const logo = screen.queryByTestId('login-brand-logo');
    return {
      name: heading.textContent,
      source: heading.getAttribute('data-brand-source'),
      logo: logo === null ? null : { src: logo.getAttribute('src'), alt: logo.getAttribute('alt') },
    };
  }

  /** Open the tenant field when it is collapsed, enter a value and leave the field. */
  function commitTenant(value: string) {
    if (screen.queryByTestId('login-tenant') === null) {
      fireEvent.click(screen.getByTestId('login-tenant-toggle'));
    }
    const input = screen.getByTestId('login-tenant');
    fireEvent.change(input, { target: { value } });
    fireEvent.blur(input);
  }

  async function release(
    hold: Deferred,
    answer: { status: number; body?: unknown } | 'network-error',
  ) {
    await act(async () => {
      if (answer === 'network-error') hold.fail();
      else hold.resolve(answer);
    });
    await settle();
  }

  it('SignInBrand_ShouldShowTheHostBrandAndRequestNoTenant_WhenTheSubdomainHasABrand', async () => {
    // "A white-label subdomain is found by host"
    onHost('acme.platform.example');
    brandingAnswers[BY_HOST] = { status: 200, body: { displayName: 'Acme' } };
    await renderLogin();
    await settle();

    expect({ brand: signInBrand(), byTenant: byTenantRequests() }).toEqual({
      brand: { name: 'Acme', source: 'host', logo: null },
      byTenant: [],
    });
  });

  it('SignInBrand_ShouldKeepTheHostBrandAndRequestNothing_WhenAFieldCommitFollowsAHostBrand', async () => {
    // Design D3 step 1: "The host's brand is final: later field commits make no request."
    onHost('acme.platform.example');
    brandingAnswers[BY_HOST] = { status: 200, body: { displayName: 'Acme' } };
    brandingAnswers[byTenant('globex')] = { status: 200, body: { displayName: 'Globex' } };
    await renderLogin();
    await settle();
    const afterHost = signInBrand();

    commitTenant('globex');
    await settle();

    expect({ afterHost, afterCommit: signInBrand(), byTenant: byTenantRequests() }).toEqual({
      afterHost: { name: 'Acme', source: 'host', logo: null },
      afterCommit: { name: 'Acme', source: 'host', logo: null },
      byTenant: [],
    });
  });

  it('SignInBrand_ShouldFallBackToTheTenantBrand_WhenNoRowCarriesTheHostLabel', async () => {
    // "A host label no row carries falls back to the tenant"
    onHost('acme.platform.example');
    brandingAnswers[byTenant('acme')] = { status: 200, body: { displayName: 'Acme Corp' } };
    await renderLogin();
    await settle();

    expect({ brand: signInBrand(), byTenant: byTenantRequests() }).toEqual({
      brand: { name: 'Acme Corp', source: 'tenant', logo: null },
      byTenant: [byTenant('acme')],
    });
  });

  it('SignInBrand_ShouldDropAFieldCommit_WhenTheHostAnswersLaterWithABrand', async () => {
    // "A field commit before the host answers is dropped when the host finds a brand"
    onHost('acme.platform.example');
    const hold = deferred();
    brandingAnswers[BY_HOST] = hold;
    await renderLogin();

    commitTenant('globex');
    await settle();
    const beforeHost = byTenantRequests();
    await release(hold, { status: 200, body: { displayName: 'Acme' } });

    expect({ beforeHost, brand: signInBrand(), afterHost: byTenantRequests() }).toEqual({
      beforeHost: [],
      brand: { name: 'Acme', source: 'host', logo: null },
      afterHost: [],
    });
  });

  it.each([
    ['a 404', { status: 404 }],
    ['a network error', 'network-error'],
  ] as const)(
    'SignInBrand_ShouldSendOnlyTheLatestFieldCommit_WhenTheHostAnswersLaterWith %s',
    async (_case, hostAnswer) => {
      // "A field commit before the host answers is sent when the host finds none"
      onHost('acme.platform.example');
      const hold = deferred();
      brandingAnswers[BY_HOST] = hold;
      brandingAnswers[byTenant('globex')] = { status: 200, body: { displayName: 'Globex' } };
      await renderLogin();

      commitTenant('initech');
      commitTenant('globex');
      await settle();
      const beforeHost = byTenantRequests();
      await release(hold, hostAnswer);

      expect({ beforeHost, brand: signInBrand(), afterHost: byTenantRequests() }).toEqual({
        beforeHost: [],
        brand: { name: 'Globex', source: 'tenant', logo: null },
        afterHost: [byTenant('globex')],
      });
    },
  );

  it('SignInBrand_ShouldRequestNothingUntilATenantIsEntered_WhenTheConsoleIsReachedByIp', async () => {
    // "A console reached by IP is branded once a tenant is entered"
    onHost('192.168.1.50');
    brandingAnswers[byTenant('acme')] = { status: 200, body: { displayName: 'Acme' } };
    await renderLogin();
    await settle();
    const beforeBlur = { requests: brandingFetchMock.mock.calls.length, brand: signInBrand() };

    commitTenant('acme');
    await settle();

    expect({ beforeBlur, afterBlur: signInBrand() }).toEqual({
      beforeBlur: { requests: 0, brand: { name: 'Verbara', source: 'default', logo: null } },
      afterBlur: { name: 'Acme', source: 'tenant', logo: null },
    });
  });

  it('SignInBrand_ShouldShowTheLatestValuesBrand_WhenAnEarlierValuesAnswerArrivesLast', async () => {
    // "A late answer for an earlier value is dropped"
    onHost('192.168.1.50');
    const acme = deferred();
    brandingAnswers[byTenant('acme')] = acme;
    brandingAnswers[byTenant('globex')] = { status: 200, body: { displayName: 'Globex' } };
    await renderLogin();

    commitTenant('acme');
    commitTenant('globex');
    await settle();
    await release(acme, { status: 200, body: { displayName: 'Acme' } });

    expect(signInBrand()).toEqual({ name: 'Globex', source: 'tenant', logo: null });
  });

  it('SignInBrand_ShouldLeaveThePageUnbrandedAndTheLoginUnchanged_WhenEveryLookupFails', async () => {
    // "A failed lookup leaves the sign-in page unbranded and usable"
    onHost('acme.platform.example');
    brandingAnswers[BY_HOST] = 'network-error';
    brandingAnswers[byTenant('acme')] = 'network-error';
    answers['/api/v1/auth/login'] = {
      status: 200,
      body: {
        accessToken: 'access-1',
        tenantId: 'acme',
        user: { id: 'u1', email: 'ana@demo.test', displayName: 'Ana', role: 'agent' },
      },
    };
    await renderLogin();
    await settle();
    const beforeSignIn = {
      brand: signInBrand(),
      error: loginError(),
      lookups: brandingFetchMock.mock.calls.map(([input]) => input),
    };

    await submitPassword();

    const [input, init] = fetchMock.mock.calls[0]!;
    expect({
      beforeSignIn,
      request: {
        input,
        method: init?.method,
        headers: Object.fromEntries(new Headers(init?.headers)),
        body: JSON.parse(String(init?.body)) as unknown,
      },
      path: currentPath(),
    }).toEqual({
      beforeSignIn: {
        brand: { name: 'Verbara', source: 'default', logo: null },
        error: null,
        lookups: [BY_HOST, byTenant('acme')],
      },
      request: {
        input: '/api/v1/auth/login',
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-tenant-id': 'acme' },
        body: { tenantId: 'acme', email: 'ana@demo.test', password: 'Correct-Horse-1' },
      },
      path: '/agent',
    });
  });

  it('SignInBrand_ShouldShowTheNameAndLogo_WhenTheBrandSetsBoth', async () => {
    // "Name and logo replace the Verbara heading"
    onHost('192.168.1.50');
    brandingAnswers[byTenant('acme')] = {
      status: 200,
      body: { displayName: 'Acme', logoUrl: 'https://cdn.example/acme.png' },
    };
    await renderLogin();

    commitTenant('acme');
    await settle();

    expect(signInBrand()).toEqual({
      name: 'Acme',
      source: 'tenant',
      logo: { src: 'https://cdn.example/acme.png', alt: 'Acme' },
    });
  });

  it('SignInBrand_ShouldKeepTheVerbaraHeading_WhenTheBrandSetsOnlyColours', async () => {
    // "A brand with only colours keeps the Verbara heading"
    onHost('192.168.1.50');
    brandingAnswers[byTenant('acme')] = { status: 200, body: { primaryColor: '#336699' } };
    await renderLogin();

    commitTenant('acme');
    await settle();

    expect(signInBrand()).toEqual({ name: 'Verbara', source: 'tenant', logo: null });
  });

  it('SignInBrand_ShouldMakeNoBrandingRequest_WhenTheFormIsSubmitted', async () => {
    onHost('192.168.1.50');
    answers['/api/v1/auth/login'] = { status: 401 };
    await renderLogin();
    commitTenant('acme');
    await settle();
    const beforeSubmit = brandingFetchMock.mock.calls.length;

    await submitPassword();

    expect({ beforeSubmit, afterSubmit: brandingFetchMock.mock.calls.length }).toEqual({
      beforeSubmit: 1,
      afterSubmit: 1,
    });
  });

  // Render-level safety cases (spec "Blank brand values keep the defaults" and "A script address
  // and a style injection are dropped"; spec audit round 3, F1).
  it('SignInBrand_ShouldRenderTheDisplayNameAsLiteralText_WhenItHoldsMarkup', async () => {
    onHost('192.168.1.50');
    brandingAnswers[byTenant('acme')] = { status: 200, body: { displayName: '<b>Acme</b>' } };
    await renderLogin();

    commitTenant('acme');
    await settle();

    const heading = screen.getByTestId('login-brand-name');
    expect({ text: heading.textContent, injected: heading.querySelector('b') }).toEqual({
      text: '<b>Acme</b>',
      injected: null,
    });
  });

  it('SignInBrand_ShouldShowNoLogo_WhenTheLogoIsAScriptAddress', async () => {
    onHost('192.168.1.50');
    brandingAnswers[byTenant('acme')] = {
      status: 200,
      body: { displayName: 'Acme', logoUrl: 'javascript:alert(1)' },
    };
    await renderLogin();

    commitTenant('acme');
    await settle();

    expect(signInBrand()).toEqual({ name: 'Acme', source: 'tenant', logo: null });
  });

  it.each([
    ['empty', ''],
    ['whitespace only', '   '],
  ])(
    'SignInBrand_ShouldKeepTheVerbaraHeadingAndNoLogo_WhenTheNameAndLogoAre %s',
    async (_case, blank) => {
      onHost('192.168.1.50');
      brandingAnswers[byTenant('acme')] = {
        status: 200,
        body: { displayName: blank, logoUrl: blank },
      };
      await renderLogin();

      commitTenant('acme');
      await settle();

      expect(signInBrand()).toEqual({ name: 'Verbara', source: 'tenant', logo: null });
    },
  );

  // "A sign-in lookup that answers after sign-in is dropped" (design D2 chain generation, D3
  // "Sign-in ends the chain"; spec audit round 2, F1). The signed-in brand is committed through the
  // store's by-tenant lookup, the call D4's `BrandingSync` makes.
  describe('a host answer held past sign-in', () => {
    const SIGNED_IN = { displayName: 'Tenant T' };

    /**
     * Render with a `from` of `/login`, so the successful sign-in navigates to the same route and
     * the page stays mounted: only `completeLogin` ending the chain can drop the host answer.
     */
    async function renderLoginThatStaysMounted() {
      const i18n = await createI18n('en-US');
      render(
        <I18nextProvider i18n={i18n}>
          <MemoryRouter
            initialEntries={[{ pathname: '/login', state: { from: { pathname: '/login' } } }]}
          >
            <Routes>
              <Route path="/login" element={<LoginPage />} />
            </Routes>
            <LocationProbe />
          </MemoryRouter>
        </I18nextProvider>,
      );
    }

    async function signIn() {
      answers['/api/v1/auth/login'] = {
        status: 200,
        body: {
          accessToken: 'access-1',
          tenantId: 't',
          user: { id: 'u1', email: 'ana@demo.test', displayName: 'Ana', role: 'agent' },
        },
      };
      await submitPassword();
      expect(useAuthStore.getState().accessToken).toBe('access-1');
    }

    async function commitSignedInBrand() {
      brandingAnswers[byTenant('t')] = { status: 200, body: SIGNED_IN };
      await act(() => useBrandingStore.getState().lookupTenant('t'));
    }

    function storedBrand() {
      const { brand, source, key } = useBrandingStore.getState();
      return { name: brand?.displayName ?? null, source, key };
    }

    const RELEASES = [
      ['a brand', { status: 200, body: { displayName: 'Acme' } }],
      ['a 404', { status: 404 }],
      ['a network error', 'network-error'],
    ] as const;

    it.each(RELEASES)(
      'SignInBrand_ShouldKeepTheSignedInBrand_WhenTheHostAnswersAfterSignInWith %s',
      async (_case, hostAnswer) => {
        onHost('acme.platform.example');
        const hold = deferred();
        brandingAnswers[BY_HOST] = hold;
        await renderLoginThatStaysMounted();

        await signIn();
        await commitSignedInBrand();
        const beforeRelease = byTenantRequests();
        await release(hold, hostAnswer);

        expect({
          mounted: screen.queryByTestId('login-brand-name') !== null,
          stored: storedBrand(),
          requestsAfterRelease: byTenantRequests().slice(beforeRelease.length),
        }).toEqual({
          mounted: true,
          stored: { name: 'Tenant T', source: 'tenant', key: 't' },
          requestsAfterRelease: [],
        });
      },
    );

    it.each(RELEASES)(
      'SignInBrand_ShouldKeepTheSignedInBrand_WhenTheHostAnswersAfterThePageUnmountsWith %s',
      async (_case, hostAnswer) => {
        onHost('acme.platform.example');
        const hold = deferred();
        brandingAnswers[BY_HOST] = hold;
        await renderLogin();

        cleanup();
        await commitSignedInBrand();
        const beforeRelease = byTenantRequests();
        await release(hold, hostAnswer);

        expect({
          stored: storedBrand(),
          requestsAfterRelease: byTenantRequests().slice(beforeRelease.length),
        }).toEqual({
          stored: { name: 'Tenant T', source: 'tenant', key: 't' },
          requestsAfterRelease: [],
        });
      },
    );
  });
});
