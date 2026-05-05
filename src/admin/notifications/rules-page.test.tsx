import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NotificationRulesPage from './rules-page';

vi.mock('@/core/api/hooks/use-notification-rules', () => ({
  useNotificationRules: vi.fn(() => ({ data: [], isLoading: false })),
  useDeleteNotificationRule: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  usePauseNotificationRule: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useActivateNotificationRule: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('@/admin/shared/page-header', () => ({
  PageHeader: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock('@/admin/shared/data-table', () => ({
  DataTable: () => <div data-testid="data-table">table</div>,
}));

vi.mock('@/core/ui/button', () => ({
  Button: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/core/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/core/ui/confirm-delete-dialog', () => ({
  ConfirmDeleteDialog: () => null,
}));

vi.mock('./rule-editor-sheet', () => ({
  RuleEditorSheet: () => null,
}));

vi.mock('./rule-detail-drawer', () => ({
  RuleDetailDrawer: () => null,
}));

describe('NotificationRulesPage', () => {
  it('renders empty state when no rules', () => {
    render(<NotificationRulesPage />);

    expect(screen.getByText('admin:notifications.rules.emptyState')).toBeInTheDocument();
    expect(screen.getByText('admin:notifications.rules.emptyStateCta')).toBeInTheDocument();
  });

  it('renders create button', () => {
    render(<NotificationRulesPage />);

    expect(screen.getByTestId('rules-create-btn')).toBeInTheDocument();
  });

  it('renders page title', () => {
    render(<NotificationRulesPage />);

    expect(screen.getByText('admin:notifications.rules.title')).toBeInTheDocument();
  });

  it('renders table when rules exist', async () => {
    const { useNotificationRules } = await import('@/core/api/hooks/use-notification-rules');
    vi.mocked(useNotificationRules).mockReturnValue({
      data: [
        {
          ruleId: '1',
          tenantId: 't1',
          name: 'Queue Alert',
          eventType: 'queue.threshold',
          channels: ['Email'],
          severity: 'Warning',
          recipients: ['admin'],
          state: 'Active',
          lastFiredAt: null,
          trigger: { eventType: 'queue.threshold', subConditions: {} },
          conditions: [],
          actions: [{ channel: 'Email', config: {} }],
          schedule: { mode: 'always' },
          throttling: { maxPerPeriod: 10, periodUnit: 'hour', cooldownMinutes: 5 },
          createdAt: '2026-04-01T00:00:00Z',
          updatedAt: '2026-04-01T00:00:00Z',
        },
      ],
      isLoading: false,
    } as never);

    render(<NotificationRulesPage />);

    expect(screen.getByTestId('data-table')).toBeInTheDocument();
  });
});
