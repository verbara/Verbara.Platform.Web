import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { render, renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import type { i18n as I18n } from 'i18next';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'sonner';
import { createLocaleI18n } from '@/test/locale-i18n';
import { useSendWhisper } from './use-supervisor';

/**
 * The whisper through the REAL `customFetch` (design D3, tasks 1.3/2.1): `@/core/api/client` is not
 * mocked, msw answers the host's statuses (fixture `supervisor-whisper.v1.json`). The host answers
 * 204 No Content for a delivered whisper (owner answer 2026-11-21); the control, an empty 200, is
 * what `customFetch` rejects, so this file would catch a host that answered one.
 */

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const SESSION = 'as-5c4b3a29';
const WHISPER_URL = `*/api/v1/supervisor/sessions/${SESSION}/whisper`;

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

async function createWrapper() {
  const i18n: I18n = await createLocaleI18n('en-US');
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </I18nextProvider>
  );
  return { i18n, wrapper };
}

function renderedToast(kind: 'success' | 'error'): HTMLElement {
  const content = vi.mocked(toast[kind]).mock.calls.at(-1)?.[0] as ReactElement | string;
  const { container } = render(<div>{content}</div>);
  return container;
}

/** Sends one whisper and returns the bodies the server received and the onError spy. */
async function send(wrapper: (p: { children: ReactNode }) => ReactElement, text = '  hi ') {
  const onError = vi.fn();
  const onSuccess = vi.fn();
  const { result } = renderHook(() => useSendWhisper(), { wrapper });
  await act(async () => {
    await result.current
      .mutateAsync({ sessionId: SESSION, text }, { onError, onSuccess })
      .catch(() => undefined);
  });
  return { onError, onSuccess };
}

describe('useSendWhisper through the real client', () => {
  let bodies: unknown[];

  beforeEach(() => {
    vi.clearAllMocks();
    bodies = [];
  });

  function answer(status: number, body: unknown = null) {
    server.use(
      http.post(WHISPER_URL, async ({ request }) => {
        bodies.push(await request.json());
        return body === null
          ? new HttpResponse(null, { status })
          : HttpResponse.json(body, { status });
      }),
    );
  }

  it('UseSendWhisper_ShouldSucceedAndShowTheSentToast_WhenTheHostAnswers204', async () => {
    answer(204);
    const { i18n, wrapper } = await createWrapper();

    const { onError, onSuccess } = await send(wrapper);

    expect(bodies).toEqual([{ text: 'hi' }]);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    const shown = renderedToast('success').querySelector('[data-toast="whisper-sent"]');
    expect(shown?.textContent).toBe(i18n.t('toasts.supervisor.whisperSent'));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('UseSendWhisper_ShouldLandInOnErrorWithWhisperFailed_WhenTheHostAnswersAnEmpty200', async () => {
    // Control: an empty 200 is parsed and rejected by `customFetch`, the reason the host answers 204.
    answer(200);
    const { i18n, wrapper } = await createWrapper();

    const { onError, onSuccess } = await send(wrapper);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    const el = renderedToast('error').querySelector('[data-error-code="whisper-failed"]');
    expect(el?.textContent).toBe(i18n.t('common:errors.supervisor_whisper.whisper_failed'));
  });

  it.each([
    [400, { error: 'whisper-text-invalid' }, 'whisper-text-invalid', 'whisper_text_invalid'],
    [404, null, 'whisper-session-not-found', 'whisper_session_not_found'],
    [
      409,
      { error: 'whisper-session-not-bound' },
      'whisper-session-not-bound',
      'whisper_session_not_bound',
    ],
    [500, null, 'whisper-failed', 'whisper_failed'],
  ])(
    'UseSendWhisper_ShouldToastTheTranslatedRefusal_WhenTheHostAnswers %i',
    async (status, body, code, key) => {
      answer(status, body);
      const { i18n, wrapper } = await createWrapper();

      const { onError } = await send(wrapper);

      expect(onError).toHaveBeenCalledTimes(1);
      expect(toast.success).not.toHaveBeenCalled();
      const container = renderedToast('error');
      const el = container.querySelector<HTMLElement>(`[data-error-code="${code}"]`);
      expect(el).not.toBeNull();
      expect(el?.textContent).toBe(i18n.t(`common:errors.supervisor_whisper.${key}`));
      if (body !== null) expect(container.textContent).not.toContain(body.error);
    },
  );
});
