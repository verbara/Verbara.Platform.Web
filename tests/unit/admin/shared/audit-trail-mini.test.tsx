import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// ─── Mock i18n so useTranslation returns default text ─────────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

// ─── Mock the audit hook the component depends on ────────────────────────────
// We control the response per test via `auditMock.mockReturnValue`.
const auditMock = vi.fn();
vi.mock('@/core/api/hooks/use-audit-events', () => ({
  useAuditEvents: (...args: unknown[]) => auditMock(...args),
}));

import { AuditTrailMini } from '@/admin/shared/audit-trail-mini';
import type { AuditEntry } from '@/core/api/hooks/use-audit';

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    entryId: overrides.entryId ?? crypto.randomUUID(),
    occurredAt: overrides.occurredAt ?? '2026-04-20T10:00:00Z',
    action: overrides.action ?? 'drain_started',
    entityType: overrides.entityType ?? 'cluster_node',
    entityId: overrides.entityId ?? 'asterisk-01',
    performedBy: overrides.performedBy ?? 'admin@example.com',
    metadata: overrides.metadata ?? null,
    details: overrides.details ?? null,
    ...overrides,
  } as AuditEntry;
}

describe('AuditTrailMini', () => {
  it('Render_ShouldListEntries_WhenHookReturnsData', () => {
    auditMock.mockReturnValue({
      data: [
        makeEntry({ action: 'drain_started', performedBy: 'ops@example.com' }),
        makeEntry({ action: 'drain_cancelled', performedBy: 'ops@example.com' }),
      ],
      isLoading: false,
    });
    render(<AuditTrailMini resourceType="cluster_node" resourceId="asterisk-01" />);

    // Timeline container rendered.
    expect(screen.getByTestId('audit-trail-mini')).toBeInTheDocument();

    // Actions converted from snake_case to spaces — assertion against the
    // rendered text, case-insensitive + fuzzy to tolerate formatting.
    expect(screen.getByText(/drain started/i)).toBeInTheDocument();
    expect(screen.getByText(/drain cancelled/i)).toBeInTheDocument();
  });

  it('EmptyState_ShouldRenderPlaceholder_WhenNoEntries', () => {
    auditMock.mockReturnValue({ data: [], isLoading: false });
    render(<AuditTrailMini resourceType="cluster_node" resourceId="asterisk-01" />);
    expect(screen.getByTestId('audit-trail-mini-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('audit-trail-mini')).toBeNull();
  });
});
