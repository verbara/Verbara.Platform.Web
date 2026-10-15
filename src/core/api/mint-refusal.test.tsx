import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ApiError } from './api-error';
import { describeMintRefusal, RECOVERY_CODES_THROTTLED } from './mint-refusal';
import { TEST_LOCALES, createLocaleI18n } from '@/test/locale-i18n';

/**
 * Host contract `tests/fixtures/contracts/recovery-code-mint-throttled.v1.json`, entry `throttled`:
 * `status` 429, `headers["Retry-After"]` "7", `body.error` prose that is never rendered.
 */
const THROTTLED_STATUS = 429;
const THROTTLED_BODY = {
  error: 'Recovery codes were generated moments ago. Wait before generating them again.',
};

function renderNode(node: ReturnType<typeof describeMintRefusal>) {
  const { container } = render(<div>{node}</div>);
  return container;
}

describe.each(TEST_LOCALES)('describeMintRefusal in %s', (lng) => {
  it('DescribeMintRefusal_ShouldNameTheSeconds_WhenA429CarriesRetryAfter', async () => {
    const i18n = await createLocaleI18n(lng);

    const node = describeMintRefusal(new ApiError(THROTTLED_STATUS, THROTTLED_BODY, 7), i18n.t);

    const container = renderNode(node);
    const el = container.querySelector(`[data-error-code="${RECOVERY_CODES_THROTTLED}"]`);
    expect(el?.textContent).toBe(i18n.t('auth.recovery_codes_throttled_seconds', { seconds: 7 }));
    expect(el?.textContent).toContain('7');
    expect(el?.textContent).not.toBe('auth.recovery_codes_throttled_seconds');
    expect(container.textContent).not.toContain(THROTTLED_BODY.error);
  });

  it('DescribeMintRefusal_ShouldOmitTheNumber_WhenA429HasNoRetryAfter', async () => {
    const i18n = await createLocaleI18n(lng);

    const node = describeMintRefusal(new ApiError(THROTTLED_STATUS, THROTTLED_BODY, null), i18n.t);

    const el = renderNode(node).querySelector(`[data-error-code="${RECOVERY_CODES_THROTTLED}"]`);
    expect(el?.textContent).toBe(i18n.t('auth.recovery_codes_throttled'));
    expect(el?.textContent).not.toBe('auth.recovery_codes_throttled');
  });
});

describe('describeMintRefusal for other failures', () => {
  it('DescribeMintRefusal_ShouldReturnNull_WhenTheStatusIsNot429', async () => {
    const i18n = await createLocaleI18n('en-US');
    expect(
      describeMintRefusal(new ApiError(401, { error: 'Invalid password' }, 7), i18n.t),
    ).toBeNull();
  });

  it('DescribeMintRefusal_ShouldReturnNull_WhenTheErrorIsNotAnApiError', async () => {
    const i18n = await createLocaleI18n('en-US');
    expect(describeMintRefusal(new TypeError('Failed to fetch'), i18n.t)).toBeNull();
  });
});
