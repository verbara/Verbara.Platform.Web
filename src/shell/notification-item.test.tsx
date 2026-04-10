import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { NotificationItem } from './notification-item';
import type { Notification } from '@/core/api/hooks/use-notifications';

const base: Notification = {
  notificationId: 'n-1',
  type: 'billing.quota_warning',
  category: 'Billing',
  severity: 'Warning',
  title: 'Quota warning',
  body: 'You are at 85% of monthly limit',
  actionUrl: '/admin/billing/usage',
  isRead: false,
  createdAt: new Date().toISOString(),
  readAt: null,
};

function renderItem(n: Notification) {
  return render(<NotificationItem notification={n} onClick={() => {}} />);
}

describe('NotificationItem', () => {
  it('should_RenderTitleAndBody_WhenGivenNotification', () => {
    renderItem(base);
    expect(screen.getByText('Quota warning')).toBeInTheDocument();
    expect(screen.getByText(/85% of monthly limit/)).toBeInTheDocument();
  });

  it('should_ShowUnreadDot_WhenNotificationIsUnread', () => {
    renderItem(base);
    expect(screen.getByTestId('notification-unread-dot')).toBeInTheDocument();
  });

  it('should_HideUnreadDot_WhenNotificationIsRead', () => {
    renderItem({ ...base, isRead: true, readAt: new Date().toISOString() });
    expect(screen.queryByTestId('notification-unread-dot')).not.toBeInTheDocument();
  });

  it('should_RenderWarningIcon_WhenSeverityIsWarning', () => {
    renderItem(base);
    expect(screen.getByTestId('notification-icon-warning')).toBeInTheDocument();
  });

  it('should_RenderCriticalIcon_WhenSeverityIsCritical', () => {
    renderItem({ ...base, severity: 'Critical' });
    expect(screen.getByTestId('notification-icon-critical')).toBeInTheDocument();
  });

  it('should_RenderInfoIcon_WhenSeverityIsInfo', () => {
    renderItem({ ...base, severity: 'Info' });
    expect(screen.getByTestId('notification-icon-info')).toBeInTheDocument();
  });
});
