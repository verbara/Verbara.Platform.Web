/**
 * The reset-password page's request and error handling, rendered with the real page and a real
 * i18next instance loaded with the en-US `common.json`. `fetch` is stubbed with real `Response`
 * objects shaped like Platform's `POST /api/v1/auth/reset-password` answers: the request record is
 * `ResetPasswordRequest(Token, NewPassword)` (camelCase on the wire), a rejected token answers
 * `400 { error }` (`ErrorResponse`), and other failures may carry a ProblemDetails `detail`.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18next from 'i18next';
import enCommon from '../../../public/locales/en-US/common.json';
import { ResetPasswordPage } from './reset-password-page';

const RESET_URL = '/api/v1/auth/reset-password';
const NEW_PASSWORD = 'Correct-Horse-Battery-1';

interface FakeAnswer {
  status: number;
  body?: unknown;
}

let resetAnswer: FakeAnswer;
const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const pathname = new URL(raw, 'http://localhost').pathname;
  if (pathname === RESET_URL) {
    return new Response(resetAnswer.body === undefined ? null : JSON.stringify(resetAnswer.body), {
      status: resetAnswer.status,
      headers: resetAnswer.body === undefined ? {} : { 'Content-Type': 'application/json' },
    });
  }
  // The page loads nothing else; anything unexpected is "not found".
  return new Response(null, { status: 404 });
});

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

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location" data-path={location.pathname} />;
}

async function renderPage(entry = '/reset-password?token=abc123') {
  const i18n = await createI18n();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="*" element={null} />
          </Routes>
          <LocationProbe />
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

async function settle() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function resetCalls() {
  return fetchMock.mock.calls.filter(([input]) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return new URL(raw, 'http://localhost').pathname === RESET_URL;
  });
}

async function submitNewPassword() {
  fireEvent.change(screen.getByLabelText(/^New password/), { target: { value: NEW_PASSWORD } });
  fireEvent.change(screen.getByLabelText(/^Confirm password/), { target: { value: NEW_PASSWORD } });
  const form = screen.getByLabelText(/^New password/).closest('form');
  if (!form) throw new Error('reset form not rendered');
  fireEvent.submit(form);
  await waitFor(() => expect(resetCalls()).toHaveLength(1));
  await settle();
}

beforeEach(() => {
  resetAnswer = { status: 200, body: { message: 'Password reset successful' } };
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ResetPasswordPage', () => {
  it('submit_ShouldSendTokenAndNewPassword_WhenTheFormIsSubmitted', async () => {
    await renderPage();
    await submitNewPassword();

    const [, init] = resetCalls()[0]!;
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ token: 'abc123', newPassword: NEW_PASSWORD });
    await waitFor(() =>
      expect(screen.getByTestId('location').getAttribute('data-path')).toBe('/login'),
    );
  });

  // Platform 2.24.x mailed the Base64 reset token unencoded, and about half of those tokens
  // contain '+'. A query-string parser reads an unencoded '+' as a space, so the API received a
  // different token and rejected it. Platform 2.25.0 percent-encodes the token. Both links must
  // reach the API with the token Platform issued.
  it('submit_ShouldSendThePlusSignsIntact_WhenTheTokenIsUnencodedInTheLink', async () => {
    await renderPage('/reset-password?token=ab+cd/ef+gh==');
    await submitNewPassword();

    const [, init] = resetCalls()[0]!;
    expect(JSON.parse(String(init?.body))).toEqual({
      token: 'ab+cd/ef+gh==',
      newPassword: NEW_PASSWORD,
    });
  });

  it('submit_ShouldSendTheDecodedToken_WhenTheTokenIsPercentEncodedInTheLink', async () => {
    await renderPage('/reset-password?token=ab%2Bcd%2Fef%2Bgh%3D%3D');
    await submitNewPassword();

    const [, init] = resetCalls()[0]!;
    expect(JSON.parse(String(init?.body))).toEqual({
      token: 'ab+cd/ef+gh==',
      newPassword: NEW_PASSWORD,
    });
  });

  it('submit_ShouldShowTheApiErrorField_WhenTheApiAnswersWithAnErrorResponse', async () => {
    resetAnswer = { status: 400, body: { error: 'Invalid or expired reset token' } };
    await renderPage();
    await submitNewPassword();

    expect(await screen.findByText('Invalid or expired reset token')).toBeTruthy();
  });

  it('submit_ShouldShowTheProblemDetail_WhenTheApiAnswersWithProblemDetails', async () => {
    resetAnswer = { status: 400, body: { title: 'Bad Request', detail: 'Something went wrong' } };
    await renderPage();
    await submitNewPassword();

    expect(await screen.findByText('Something went wrong')).toBeTruthy();
  });

  it('submit_ShouldShowTheGenericError_WhenTheErrorBodyIsEmpty', async () => {
    resetAnswer = { status: 500 };
    await renderPage();
    await submitNewPassword();

    expect(await screen.findByText(enCommon.auth.reset_error)).toBeTruthy();
  });
});
