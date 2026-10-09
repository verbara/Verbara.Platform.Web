import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { toast } from 'sonner';
import { ApiError, type ApiErrorMap } from './api-error';
import { toastApiError } from './toast-api-error';
import { createLocaleI18n } from '@/test/locale-i18n';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const MAP: ApiErrorMap<'hold'> = {
  codes: { 'not-owner': { code: 'not-owner', key: 'errors.conversation.not_owner' } },
  actions: {
    hold: { 400: { code: 'conversation-conflict', key: 'errors.conversation.conflict' } },
  },
  fallback: { code: 'conversation-failed', key: 'errors.conversation.failed' },
};

function renderedToast(): HTMLElement {
  const content = vi.mocked(toast.error).mock.calls.at(-1)?.[0] as ReactElement;
  render(<div data-testid="toast">{content}</div>);
  return screen.getByTestId('toast').firstElementChild as HTMLElement;
}

describe('toastApiError', () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
  });

  it('should render the localized message inside an element carrying data-error-code', async () => {
    const i18n = await createLocaleI18n('es-419');

    const entry = toastApiError(new ApiError(403, { error: 'not-owner' }), MAP, i18n.t);

    expect(entry.code).toBe('not-owner');
    const el = renderedToast();
    expect(el).toHaveAttribute('data-error-code', 'not-owner');
    expect(el.textContent).toBe(i18n.t('errors.conversation.not_owner'));
    expect(el.textContent).not.toBe('errors.conversation.not_owner');
  });

  it('should never show the server text', async () => {
    const i18n = await createLocaleI18n('pt-BR');

    toastApiError(new ApiError(400, { error: 'Cannot hold conversation' }), MAP, i18n.t, {
      action: 'hold',
    });

    const el = renderedToast();
    expect(el).toHaveAttribute('data-error-code', 'conversation-conflict');
    expect(el.textContent).not.toContain('Cannot hold conversation');
  });

  it('should show the generic failure for an error that is not an ApiError', async () => {
    const i18n = await createLocaleI18n('en-US');

    toastApiError(new TypeError('Failed to fetch'), MAP, i18n.t);

    const el = renderedToast();
    expect(el).toHaveAttribute('data-error-code', 'conversation-failed');
    expect(el.textContent).not.toContain('Failed to fetch');
  });
});
