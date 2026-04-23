import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ─── mock i18n so useTranslation returns the key as-is ───────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

import { StatusBadge } from '@/core/ui/status-badge';

afterEach(() => {
  vi.restoreAllMocks();
});

function renderBadge(element: React.ReactElement): HTMLElement {
  const { container } = render(element);
  const badge = container.firstElementChild as HTMLElement | null;
  if (badge === null) {
    throw new Error('StatusBadge did not render a root element');
  }
  return badge;
}

describe('StatusBadge', () => {
  it('Render_ShouldApplyGreenClasses_WhenClusterNodeHealthy', () => {
    const badge = renderBadge(
      <StatusBadge variant="cluster-node" status="Healthy" />
    );
    expect(badge.className).toMatch(/bg-green-500\/20/);
    expect(badge.className).toMatch(/text-green-700/);
    expect(badge.className).toMatch(/dark:text-green-400/);
    // i18n mock returns defaultValue (the raw status) when no translation is
    // supplied, so the label surface renders the human-facing string.
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });

  it('Render_ShouldApplyAmberClasses_WhenLicenseGrace', () => {
    const badge = renderBadge(
      <StatusBadge variant="license" status="Grace" />
    );
    expect(badge.className).toMatch(/bg-amber-500\/20/);
    expect(badge.className).toMatch(/text-amber-700/);
    expect(badge.className).toMatch(/dark:text-amber-400/);
  });

  it('Render_ShouldApplyRedClasses_WhenApiKeyRevoked', () => {
    const badge = renderBadge(
      <StatusBadge variant="api-key" status="Revoked" />
    );
    expect(badge.className).toMatch(/bg-red-500\/20/);
    expect(badge.className).toMatch(/text-red-700/);
    expect(badge.className).toMatch(/dark:text-red-400/);
  });

  it('Render_ShouldApplyRedClasses_WhenWebhookCircuitOpen', () => {
    const badge = renderBadge(
      <StatusBadge variant="webhook-circuit" status="Open" />
    );
    expect(badge.className).toMatch(/bg-red-500\/20/);
    expect(badge.className).toMatch(/text-red-700/);
    expect(badge.className).toMatch(/dark:text-red-400/);
  });

  it('Render_ShouldApplyGreenClasses_WhenMfaEnrolled', () => {
    const badge = renderBadge(
      <StatusBadge variant="mfa" status="Enrolled" />
    );
    expect(badge.className).toMatch(/bg-green-500\/20/);
    expect(badge.className).toMatch(/text-green-700/);
    expect(badge.className).toMatch(/dark:text-green-400/);
  });

  it('Render_ShouldFallbackToGrayAndWarn_WhenGenericUnknownStatus', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const badge = renderBadge(
      <StatusBadge variant="generic" status="SomeUnknownValue" />
    );
    expect(badge.className).toMatch(/bg-gray-500\/20/);
    expect(badge.className).toMatch(/text-gray-700/);
    expect(badge.className).toMatch(/dark:text-gray-400/);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('SomeUnknownValue')
    );
    warnSpy.mockRestore();
  });
});
