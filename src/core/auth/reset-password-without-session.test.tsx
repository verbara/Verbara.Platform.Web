/**
 * A reset link is opened by someone who is NOT signed in. This renders the app's real router
 * (`src/router.tsx`) with the real `customFetch`, and msw answers the way Platform v2.25.0 does for
 * an anonymous browser:
 *
 * - `GET /api/v1/auth/password-policy` is `RequireAuthorization()` → 401;
 * - `POST /api/v1/auth/refresh` has no refresh cookie to present → 401;
 * - `POST /api/v1/auth/reset-password` is `AllowAnonymous()` → 200.
 *
 * 3.20.0 and 3.20.1 loaded the password policy through `customFetch`, whose 401 path signs out and
 * sets `window.location.href = '/login'` — so the browser left the page before the form could be
 * used. `window.location` is wrapped so that redirect is recorded instead of being a jsdom
 * navigation; everything else reads through to the real location, which the router's history
 * keeps using.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { I18nextProvider } from 'react-i18next';
import { RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18next from 'i18next';
import { server } from '@/test/msw-server';
import { useAuthStore } from '@/core/auth/auth-store';
import enCommon from '../../../public/locales/en-US/common.json';

const NEW_PASSWORD = 'Correct-Horse-Battery-1';
const RESET_ENTRY = '/reset-password?token=ab%2Bcd%2Fef%2Bgh%3D%3D';

let assignedHref: string | null = null;
let originalLocation: PropertyDescriptor | undefined;
let resetBodies: unknown[] = [];

function anonymousPlatform() {
  return [
    http.get('/api/v1/auth/password-policy', () => new HttpResponse(null, { status: 401 })),
    http.post('/api/v1/auth/refresh', () => new HttpResponse(null, { status: 401 })),
    http.post('/api/v1/auth/reset-password', async ({ request }) => {
      resetBodies.push(await request.json());
      return HttpResponse.json({ message: 'Password reset successful' });
    }),
  ];
}

async function createI18n() {
  const instance = i18next.createInstance();
  await instance.init({
    lng: 'en-US',
    fallbackLng: false,
    resources: { 'en-US': { common: enCommon } },
    ns: ['common'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return instance;
}

async function settle() {
  await act(async () => {
    for (let i = 0; i < 10; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function renderAppAt(entry: string) {
  window.history.replaceState(null, '', entry);
  // The shell's theme store reads `matchMedia` at import time; jsdom does not implement it.
  if (!window.matchMedia) {
    vi.stubGlobal(
      'matchMedia',
      (query: string) =>
        ({
          matches: false,
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
  }
  // The app's router is a browser router built at import time from `window.location`.
  const { router } = await import('@/router');
  const i18n = await createI18n();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <RouterProvider router={router} />
      </I18nextProvider>
    </QueryClientProvider>,
  );
  return router;
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

beforeEach(() => {
  useAuthStore.getState().logout();
  sessionStorage.clear();
  resetBodies = [];
  server.use(...anonymousPlatform());

  assignedHref = null;
  originalLocation = Object.getOwnPropertyDescriptor(window, 'location');
  const real = window.location;
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: new Proxy(real, {
      get(target, prop) {
        if (prop === 'href' && assignedHref !== null) return assignedHref;
        const value: unknown = Reflect.get(target, prop, target);
        return typeof value === 'function' ? (value as () => unknown).bind(target) : value;
      },
      set(target, prop, value) {
        if (prop === 'href') {
          assignedHref = String(value);
          return true;
        }
        return Reflect.set(target, prop, value, target);
      },
    }),
  });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  if (originalLocation) Object.defineProperty(window, 'location', originalLocation);
});

describe('ResetPasswordPage without a session', () => {
  it('reset_ShouldStayOnTheResetPageAndSubmit_WhenThePolicyCannotBeFetchedAnonymously', async () => {
    const router = await renderAppAt(RESET_ENTRY);
    await settle();

    // No sign-out redirect: the browser is still on the reset page with its form.
    expect(assignedHref).toBeNull();
    expect(router.state.location.pathname).toBe('/reset-password');
    const newPassword = await screen.findByLabelText(/^New password/);

    fireEvent.change(newPassword, { target: { value: NEW_PASSWORD } });
    fireEvent.change(screen.getByLabelText(/^Confirm password/), {
      target: { value: NEW_PASSWORD },
    });
    const form = newPassword.closest('form');
    if (!form) throw new Error('reset form not rendered');
    fireEvent.submit(form);

    await waitFor(() => expect(resetBodies).toHaveLength(1));
    expect(resetBodies[0]).toEqual({ token: 'ab+cd/ef+gh==', newPassword: NEW_PASSWORD });
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(assignedHref).toBeNull();
  });
});
