import { formatDistanceToNow } from 'date-fns';
import { Info, AlertTriangle, AlertCircle } from 'lucide-react';
import type { Notification, NotificationSeverity } from '@/core/api/hooks/use-notifications';

interface NotificationItemProps {
  notification: Notification;
  onClick: (notification: Notification) => void;
}

function SeverityIcon({ severity }: { severity: NotificationSeverity }) {
  if (severity === 'Critical') {
    return (
      <AlertCircle
        className="h-5 w-5 shrink-0 text-red-500"
        data-testid="notification-icon-critical"
      />
    );
  }
  if (severity === 'Warning') {
    return (
      <AlertTriangle
        className="h-5 w-5 shrink-0 text-amber-500"
        data-testid="notification-icon-warning"
      />
    );
  }
  return (
    <Info
      className="h-5 w-5 shrink-0 text-blue-500"
      data-testid="notification-icon-info"
    />
  );
}

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const { title, body, severity, isRead, createdAt } = notification;
  const relativeTime = formatDistanceToNow(new Date(createdAt), { addSuffix: true });

  return (
    <button
      type="button"
      onClick={() => onClick(notification)}
      className={`flex w-full items-start gap-3 border-b border-slate-100 p-3 text-left transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 ${
        isRead ? 'opacity-60' : ''
      }`}
      data-testid={`notification-item-${notification.notificationId}`}
    >
      <SeverityIcon severity={severity} />
      <div className="min-w-0 flex-1">
        <div className={`text-sm ${isRead ? 'font-normal' : 'font-medium'} text-foreground`}>
          {title}
        </div>
        <div className="line-clamp-2 text-xs text-muted-foreground">{body}</div>
        <div className="mt-1 text-xs text-muted-foreground">{relativeTime}</div>
      </div>
      {!isRead && (
        <span
          className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand"
          data-testid="notification-unread-dot"
        />
      )}
    </button>
  );
}
