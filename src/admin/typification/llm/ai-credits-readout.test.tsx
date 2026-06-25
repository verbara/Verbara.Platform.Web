import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiCreditsResponse } from '@/core/api/hooks/use-typification-llm';

// Module-level mock state, mutated per test before each render. The hook mock
// reads from this object so individual tests can swap the credits payload.
const aiCreditsState: { data: AiCreditsResponse; isPending: boolean } = {
  data: {
    allowanceCredits: 1000,
    consumedCredits: 250,
    remainingCredits: 750,
    usagePercent: 25,
    periodEnd: '2026-07-01T00:00:00Z',
    actionOnExhaustion: 'Warn',
  },
  isPending: false,
};

vi.mock('@/core/api/hooks/use-typification-llm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/api/hooks/use-typification-llm')>();
  return {
    ...actual,
    useAiCredits: () => aiCreditsState,
  };
});

// Stub react-i18next so assertions key off i18n KEYS, not translated copy.
// Interpolation options are echoed as `${key}:${JSON.stringify(opts)}` so the
// near-exhaustion percent can be asserted without depending on locale strings.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

import { AiCreditsReadout } from './ai-credits-readout';

const baseData: AiCreditsResponse = {
  allowanceCredits: 1000,
  consumedCredits: 250,
  remainingCredits: 750,
  usagePercent: 25,
  periodEnd: '2026-07-01T00:00:00Z',
  actionOnExhaustion: 'Warn',
};

function setCredits(overrides: Partial<AiCreditsResponse>): void {
  aiCreditsState.data = { ...baseData, ...overrides };
  aiCreditsState.isPending = false;
}

beforeEach(() => {
  setCredits({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('AiCreditsReadout near-exhaustion band', () => {
  it('Band_ShouldRender_WhenUsageAtOrAbove80AndAllowanceFinite', () => {
    setCredits({ allowanceCredits: 1000, usagePercent: 85 });
    render(<AiCreditsReadout />);
    const band = screen.getByTestId('llm-ai-credits-near-exhaustion');
    expect(band).toBeInTheDocument();
    expect(band.textContent).toContain('admin:typification.aiCredits.nearExhaustion');
    expect(band.textContent).toContain('"percent":85');
  });

  it('Band_ShouldRoundPercent_WhenUsageIsFractional', () => {
    setCredits({ allowanceCredits: 1000, usagePercent: 84.6 });
    render(<AiCreditsReadout />);
    const band = screen.getByTestId('llm-ai-credits-near-exhaustion');
    expect(band.textContent).toContain('"percent":85');
  });

  it('Band_ShouldBeAbsent_WhenUsageBelow80', () => {
    setCredits({ allowanceCredits: 1000, usagePercent: 79 });
    render(<AiCreditsReadout />);
    expect(screen.queryByTestId('llm-ai-credits-near-exhaustion')).not.toBeInTheDocument();
  });

  it('Band_ShouldBeAbsent_WhenUnlimitedEvenIfUsageAtOrAbove80', () => {
    setCredits({ allowanceCredits: null, remainingCredits: null, usagePercent: 95 });
    render(<AiCreditsReadout />);
    expect(screen.queryByTestId('llm-ai-credits-near-exhaustion')).not.toBeInTheDocument();
  });
});

describe('AiCreditsReadout actionOnExhaustion badge', () => {
  it('Badge_ShouldRenderWarnKey_WhenActionIsWarn', () => {
    setCredits({ actionOnExhaustion: 'Warn' });
    render(<AiCreditsReadout />);
    const badge = screen.getByTestId('llm-ai-credits-action');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain('admin:typification.aiCredits.actionOnExhaustion.warn');
  });

  it('Badge_ShouldRenderSoftBlockKey_WhenActionIsSoftBlock', () => {
    setCredits({ actionOnExhaustion: 'SoftBlock' });
    render(<AiCreditsReadout />);
    const badge = screen.getByTestId('llm-ai-credits-action');
    expect(badge.textContent).toContain(
      'admin:typification.aiCredits.actionOnExhaustion.softBlock',
    );
  });

  it('Badge_ShouldRenderHardBlockKey_WhenActionIsHardBlock', () => {
    setCredits({ actionOnExhaustion: 'HardBlock' });
    render(<AiCreditsReadout />);
    const badge = screen.getByTestId('llm-ai-credits-action');
    expect(badge.textContent).toContain(
      'admin:typification.aiCredits.actionOnExhaustion.hardBlock',
    );
  });

  it('Badge_ShouldRenderRawValue_WhenActionIsUnknown', () => {
    setCredits({ actionOnExhaustion: 'Detonate' });
    render(<AiCreditsReadout />);
    const badge = screen.getByTestId('llm-ai-credits-action');
    // Unknown values fall back to the raw server string (no i18n key match).
    expect(badge.textContent).toContain('Detonate');
    expect(badge.textContent).not.toContain('actionOnExhaustion.warn');
  });
});
