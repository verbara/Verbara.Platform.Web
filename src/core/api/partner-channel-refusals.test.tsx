import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isValidElement, type ReactElement } from 'react';
import { toast } from 'sonner';
import type { TFunction } from 'i18next';
import { ApiError } from './api-error';
import {
  PARTNER_CHANNEL_ENTRIES,
  partnerChannelCodeOf,
  toastPartnerChannelRefusal,
} from './partner-channel-refusals';
import { TEST_LOCALES, createLocaleI18n } from '@/test/locale-i18n';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const contract = (name: string) =>
  JSON.parse(
    readFileSync(resolve(process.cwd(), 'tests/fixtures/contracts', name), 'utf-8'),
  ) as Record<string, { status: number; body: Record<string, unknown> }> & {
    status: number;
    body: Record<string, unknown>;
  };

const plan = contract('plan-above-parent-409.json');
const dunning = contract('dunning-partner-customer-409.json');
const currency = contract('rate-card-currency-refusals.json');

function lastToast(): { code: string | undefined; text: string } {
  const arg = vi.mocked(toast.error).mock.calls.at(-1)?.[0];
  if (!isValidElement(arg)) throw new Error('no coded toast');
  const el = arg as ReactElement<{ 'data-error-code'?: string; children?: unknown }>;
  return { code: el.props['data-error-code'], text: String(el.props.children) };
}

describe('toastPartnerChannelRefusal', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(TEST_LOCALES)(
    'should name the localized requested and parent plans in %s',
    async (lng) => {
      const i18n = await createLocaleI18n(lng);
      const shown = toastPartnerChannelRefusal(
        new ApiError(plan.status, plan.body),
        ['plan-exceeds-parent'],
        i18n.t as TFunction,
      );

      expect(shown).toBe(true);
      const { code, text } = lastToast();
      expect(code).toBe('plan-exceeds-parent');
      expect(text).toContain(i18n.t('common:errors.partner_channel.plans.Enterprise'));
      expect(text).toContain(i18n.t('common:errors.partner_channel.plans.Pro'));
      expect(text).not.toContain('errors.partner_channel');
      expect(text).not.toContain('plan-exceeds-parent');
    },
  );

  it.each(TEST_LOCALES)('should name both currencies of a mismatch in %s', async (lng) => {
    const i18n = await createLocaleI18n(lng);
    toastPartnerChannelRefusal(
      new ApiError(currency.currencyMismatch.status, currency.currencyMismatch.body),
      ['currency-invalid', 'currency-mismatch'],
      i18n.t as TFunction,
    );

    const { code, text } = lastToast();
    expect(code).toBe('currency-mismatch');
    expect(text).toContain('PEN');
    expect(text).toContain('USD');
    expect(text).not.toContain('currency-mismatch');
  });

  it.each(TEST_LOCALES)('should name the invalid currency in %s', async (lng) => {
    const i18n = await createLocaleI18n(lng);
    toastPartnerChannelRefusal(
      new ApiError(currency.invalidCurrency.status, currency.invalidCurrency.body),
      ['currency-invalid'],
      i18n.t as TFunction,
    );

    const { code, text } = lastToast();
    expect(code).toBe('currency-invalid');
    expect(text).toContain('banana');
    expect(text).not.toContain('currency-invalid');
  });

  it('should say the currency is missing when the refused currency is null', async () => {
    const i18n = await createLocaleI18n('en-US');
    toastPartnerChannelRefusal(
      new ApiError(400, { error: 'currency-invalid', currency: null }),
      ['currency-invalid'],
      i18n.t as TFunction,
    );

    const { code, text } = lastToast();
    expect(code).toBe('currency-invalid');
    expect(text).toBe(i18n.t('common:errors.partner_channel.currency_missing'));
  });

  it('should show an unknown plan as received', async () => {
    const i18n = await createLocaleI18n('es-419');
    toastPartnerChannelRefusal(
      new ApiError(409, { ...plan.body, requestedPlan: 'Ultra' }),
      ['plan-exceeds-parent'],
      i18n.t as TFunction,
    );

    expect(lastToast().text).toContain('Ultra');
  });

  it('should show the dunning refusal in the user locale', async () => {
    const i18n = await createLocaleI18n('pt-BR');
    toastPartnerChannelRefusal(
      new ApiError(dunning.status, dunning.body),
      ['dunning-partner-customer'],
      i18n.t as TFunction,
    );

    const { code, text } = lastToast();
    expect(code).toBe('dunning-partner-customer');
    expect(text).toBe(i18n.t('common:errors.partner_channel.dunning_partner_customer'));
  });

  it('should leave every other refusal to the caller', () => {
    const t = ((k: string) => k) as unknown as TFunction;
    expect(toastPartnerChannelRefusal(new ApiError(409, plan.body), ['currency-invalid'], t)).toBe(
      false,
    );
    expect(
      toastPartnerChannelRefusal(new ApiError(400, { error: 'Bad' }), ['currency-invalid'], t),
    ).toBe(false);
    expect(toastPartnerChannelRefusal(new Error('network'), ['currency-invalid'], t)).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('partnerChannelCodeOf should return null for a code outside the list', () => {
    expect(partnerChannelCodeOf(new ApiError(409, plan.body), ['plan-exceeds-parent'])).toBe(
      'plan-exceeds-parent',
    );
    expect(
      partnerChannelCodeOf(new ApiError(409, { error: 'not-owner' }), ['plan-exceeds-parent']),
    ).toBeNull();
  });

  it.each(TEST_LOCALES)('should have every message key in %s', async (lng) => {
    const i18n = await createLocaleI18n(lng);
    for (const entry of PARTNER_CHANNEL_ENTRIES) {
      expect(i18n.exists(entry.key), entry.key).toBe(true);
    }
    for (const p of ['Starter', 'Pro', 'Enterprise']) {
      expect(i18n.exists(`common:errors.partner_channel.plans.${p}`)).toBe(true);
    }
  });
});
