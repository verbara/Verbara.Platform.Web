import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { toast } from 'sonner';
import * as client from '@/core/api/client';
import { ApiError } from '@/core/api/api-error';
import {
  useCreatePartnerCustomer,
  useUpdateCustomerSettings,
  useCreatePartnerRateCard,
  useGeneratePartnerInvoice,
  useUpdatePartnerRateCard,
} from '@/core/api/hooks/use-partner';
import {
  useCreateRateCard,
  useUpdateRateCard,
  type CreateRateCardInput,
} from '@/core/api/hooks/use-billing';
import { useCreateTenant } from '@/core/api/hooks/use-tenants';
import { useUpdateTenantSettings } from '@/admin/tenants/use-tenant-settings';

/**
 * The hooks on the partner-channel paths map the host's coded refusals (host change
 * `partner-channel-pilot-fixes`) to localized toasts carrying `data-error-code`, never the raw
 * `error`, and show no success toast. Every other refusal keeps its current handling.
 */

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, v?: Record<string, unknown>) => (v ? `${k} ${JSON.stringify(v)}` : k),
  }),
}));
vi.mock('@/core/tenant/tenant-store', () => ({
  useTenantStore: Object.assign(
    (selector: (s: { activeTenantId: string }) => string) => selector({ activeTenantId: 't1' }),
    { getState: () => ({ activeTenantId: 't1' }) },
  ),
}));
vi.mock('@/core/auth/auth-store', () => ({
  useAuthStore: Object.assign(
    (selector: (s: { tenantId: string; accessToken: string }) => string) =>
      selector({ tenantId: 't1', accessToken: 'tok' }),
    { getState: () => ({ accessToken: 'tok', tenantId: 't1' }) },
  ),
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

type Refusal = { status: number; body: Record<string, unknown> };
const contract = (name: string) =>
  JSON.parse(
    readFileSync(resolve(process.cwd(), 'tests/fixtures/contracts', name), 'utf-8'),
  ) as Record<string, unknown>;
const currency = contract('rate-card-currency-refusals.json') as Record<string, Refusal>;
const planCeiling = contract('plan-above-parent-409.json') as unknown as Refusal;

function lastErrorToast(): { code: string | null; text: string } {
  const arg = vi.mocked(toast.error).mock.calls.at(-1)?.[0];
  if (!isValidElement(arg)) return { code: null, text: String(arg) };
  const el = arg as ReactElement<{ 'data-error-code'?: string; children?: unknown }>;
  return { code: el.props['data-error-code'] ?? null, text: String(el.props.children) };
}

async function runRejected(
  useHook: () => { mutate: (v: never) => void; isError: boolean },
  vars: unknown,
  refusal: Refusal,
) {
  vi.mocked(client.customFetch).mockRejectedValue(new ApiError(refusal.status, refusal.body));
  const { result } = renderHook(useHook, { wrapper });
  act(() => result.current.mutate(vars as never));
  await waitFor(() => expect(result.current.isError).toBe(true));
  return lastErrorToast();
}

const card: CreateRateCardInput = {
  name: 'Base',
  currency: 'banana',
  effectiveFrom: '2026-10-01T00:00:00.000Z',
  effectiveTo: null,
  isDefault: false,
  rates: [],
};

beforeEach(() => vi.clearAllMocks());

describe('currency refusals (P2)', () => {
  const writers = [
    ['useCreatePartnerRateCard', () => useCreatePartnerRateCard(), card],
    ['useUpdatePartnerRateCard', () => useUpdatePartnerRateCard(), { id: 'rc1', ...card }],
    ['useCreateRateCard', () => useCreateRateCard(), card],
    ['useUpdateRateCard', () => useUpdateRateCard(), { id: 'rc1', ...card }],
  ] as const;

  it.each(writers)(
    '%s_ShouldToastCurrencyInvalidWithTheCode_WhenTheHostRefusesTheCurrency',
    async (_name, useHook, vars) => {
      const shown = await runRejected(useHook as never, vars, currency.invalidCurrency);

      expect(shown.code).toBe('currency-invalid');
      expect(shown.text).toContain('common:errors.partner_channel.currency_invalid');
      expect(shown.text).toContain('banana');
      expect(shown.text).not.toBe(currency.invalidCurrency.body.error);
      expect(toast.success).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['invalidCurrency', 'currency-invalid', ['banana']],
    ['currencyMismatch', 'currency-mismatch', ['PEN', 'USD']],
  ] as const)(
    'UseGeneratePartnerInvoice_ShouldToastTheCodedRefusal_WhenTheHostAnswers %s',
    async (fixtureKey, code, named) => {
      const shown = await runRejected(
        (() => useGeneratePartnerInvoice('pc1')) as never,
        { from: '2026-09-01', to: '2026-09-30' },
        currency[fixtureKey],
      );

      expect(shown.code).toBe(code);
      for (const value of named) expect(shown.text).toContain(value);
      expect(shown.text).not.toBe(currency[fixtureKey].body.error);
      expect(toast.success).not.toHaveBeenCalled();
    },
  );

  it('UseCreateRateCard_ShouldKeepTheServerMessage_WhenAnother400Answers', async () => {
    const shown = await runRejected((() => useCreateRateCard()) as never, card, {
      status: 400,
      body: { error: 'Rates are required' },
    });

    expect(shown).toEqual({ code: null, text: 'Rates are required' });
  });
});

describe('the 409 plan ceiling (P3)', () => {
  const paths = [
    [
      'useCreatePartnerCustomer',
      () => useCreatePartnerCustomer(),
      { tenantId: 'pc1', name: 'Customer One', plan: 'Enterprise' },
    ],
    [
      'useUpdateCustomerSettings',
      () => useUpdateCustomerSettings(),
      { id: 'pc1', platformName: 'X' },
    ],
    ['useUpdateTenantSettings', () => useUpdateTenantSettings('pc1'), { platformName: 'X' }],
    ['useCreateTenant', () => useCreateTenant(), { tenantId: 'pc1', name: 'Customer One' }],
  ] as const;

  it.each(paths)(
    '%s_ShouldToastPlanExceedsParentNamingBothPlans_WhenTheHostAnswers409',
    async (_name, useHook, vars) => {
      const shown = await runRejected(useHook as never, vars, planCeiling);

      expect(shown.code).toBe('plan-exceeds-parent');
      expect(shown.text).toContain('common:errors.partner_channel.plan_exceeds_parent');
      expect(shown.text).toContain('common:errors.partner_channel.plans.Enterprise');
      expect(shown.text).toContain('common:errors.partner_channel.plans.Pro');
      expect(shown.text).not.toBe(planCeiling.body.error);
      expect(toast.success).not.toHaveBeenCalled();
    },
  );

  it.each(paths)(
    '%s_ShouldKeepTheServerMessage_WhenAnotherRefusalAnswers',
    async (_n, useHook, vars) => {
      const shown = await runRejected(useHook as never, vars, {
        status: 400,
        body: { error: 'Tenant already exists' },
      });

      expect(shown).toEqual({ code: null, text: 'Tenant already exists' });
    },
  );
});
