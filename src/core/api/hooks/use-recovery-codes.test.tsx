import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ReactElement, ReactNode } from 'react';
import { render, renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import type { i18n as I18n } from 'i18next';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'sonner';
import { createLocaleI18n } from '@/test/locale-i18n';
import * as client from '@/core/api/client';
import type { RegenerateRecoveryCodesRequest, RecoveryCodesPayload } from './use-recovery-codes';
import { useRegenerateRecoveryCodes } from './use-recovery-codes';

// Partial mock: `customFetch` is a spy that the throttle tests point at the real client, so the
// 429 travels through the real `Retry-After` parsing from an msw response.
vi.mock('@/core/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/api/client')>()),
  customFetch: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useRegenerateRecoveryCodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call POST /api/v1/profile/security/recovery-codes/regenerate with totpCode', async () => {
    const response: RecoveryCodesPayload = { recoveryCodes: ['AAA-111', 'BBB-222', 'CCC-333'] };
    vi.mocked(client.customFetch).mockResolvedValue(response);

    const { result } = renderHook(() => useRegenerateRecoveryCodes(), { wrapper });

    const req: RegenerateRecoveryCodesRequest = { totpCode: '123456' };
    act(() => {
      result.current.mutate(req);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(response);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/profile/security/recovery-codes/regenerate',
      method: 'POST',
      data: req,
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('MFA step-up required'));

    const { result } = renderHook(() => useRegenerateRecoveryCodes(), { wrapper });

    act(() => {
      result.current.mutate({ totpCode: '000000' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('MFA step-up required');
  });
});

// --- Recovery-code mint routes: throttle feedback (design D3) and `['me']` refresh (design D4) ---

/**
 * Host contract `tests/fixtures/contracts/recovery-code-mint-throttled.v1.json`, entry `throttled`
 * (`status` 429, `headers["Retry-After"]` "7", `body.error` prose that is never rendered).
 */
const THROTTLED = (
  JSON.parse(
    readFileSync(
      resolve(process.cwd(), 'tests/fixtures/contracts/recovery-code-mint-throttled.v1.json'),
      'utf-8',
    ),
  ) as {
    throttled: { status: number; headers: Record<string, string>; body: { error: string } };
  }
).throttled;

const mintServer = setupServer();
beforeAll(() => mintServer.listen({ onUnhandledRequest: 'error' }));
afterEach(() => mintServer.resetHandlers());
afterAll(() => mintServer.close());

/** Answers `POST <url>` with the fixture's 429, with or without its `Retry-After` header. */
function answerThrottled(url: string, withRetryAfter: boolean) {
  const headers = withRetryAfter
    ? THROTTLED.headers
    : { 'Content-Type': THROTTLED.headers['Content-Type'] ?? 'application/json' };
  mintServer.use(
    http.post(`*${url}`, () =>
      HttpResponse.json(THROTTLED.body, { status: THROTTLED.status, headers }),
    ),
  );
}

async function createMintWrapper() {
  const i18n: I18n = await createLocaleI18n('en-US');
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </I18nextProvider>
  );
  return { i18n, qc, wrapper };
}

/** Renders the last error toast's content and returns the throttle element, if any. */
function renderedThrottleToast(): { container: HTMLElement; el: HTMLElement | null } {
  const content = vi.mocked(toast.error).mock.calls.at(-1)?.[0] as ReactElement | string;
  const { container } = render(<div>{content}</div>);
  return {
    container,
    el: container.querySelector<HTMLElement>('[data-error-code="recovery-codes-throttled"]'),
  };
}

interface MintCase {
  readonly name: string;
  readonly url: string;
  readonly useMint: () => { mutateAsync: (vars: never) => Promise<unknown> };
  readonly vars: unknown;
}

const MINT_CASES: readonly MintCase[] = [
  {
    name: 'useRegenerateRecoveryCodes (profile)',
    url: '/api/v1/profile/security/recovery-codes/regenerate',
    useMint: useRegenerateRecoveryCodes,
    vars: { totpCode: '123456' },
  },
];

describe.each(MINT_CASES)('$name (POST $url)', ({ url, useMint, vars }) => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const actual = await vi.importActual<typeof import('@/core/api/client')>('@/core/api/client');
    vi.mocked(client.customFetch).mockImplementation(actual.customFetch);
  });

  async function mintAndFail(wrapper: (p: { children: ReactNode }) => ReactElement) {
    const { result } = renderHook(() => useMint(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(vars as never).catch(() => undefined);
    });
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  }

  it('Mint_ShouldShowTheWaitMessageWithTheSeconds_WhenRetryAfterIs7', async () => {
    answerThrottled(url, true);
    const { i18n, wrapper } = await createMintWrapper();

    await mintAndFail(wrapper);

    const { container, el } = renderedThrottleToast();
    expect(el).not.toBeNull();
    expect(el?.textContent).toBe(i18n.t('auth.recovery_codes_throttled_seconds', { seconds: 7 }));
    expect(el?.textContent).toContain('7');
    expect(container.textContent).not.toContain(THROTTLED.body.error);
  });

  it('Mint_ShouldShowTheWaitMessageWithoutANumber_WhenRetryAfterIsAbsent', async () => {
    answerThrottled(url, false);
    const { i18n, wrapper } = await createMintWrapper();

    await mintAndFail(wrapper);

    const { container, el } = renderedThrottleToast();
    expect(el).not.toBeNull();
    expect(el?.textContent).toBe(i18n.t('auth.recovery_codes_throttled'));
    expect(container.textContent).not.toContain(THROTTLED.body.error);
  });

  it('Mint_ShouldInvalidateMe_WhenItSucceeds', async () => {
    vi.mocked(client.customFetch).mockResolvedValue({ recoveryCodes: ['AAA-111'] });
    const { qc, wrapper } = await createMintWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useMint(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(vars as never);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['me'] });
  });
});
