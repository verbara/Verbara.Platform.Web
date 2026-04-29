import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { useUnreadCount } from '@/core/api/hooks/use-notifications';
import { NotificationDrawer } from './notification-drawer';

export function NotificationBell() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data } = useUnreadCount();
  const count = data?.count ?? 0;

  const ariaLabel =
    count > 0
      ? t('notifications.aria_label_with_count', { count })
      : t('notifications.aria_label');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={ariaLabel}
        className="relative flex h-10 w-10 items-center justify-center rounded-md text-rail-icon hover:bg-slate-800 hover:text-rail-icon-active"
        data-testid="notification-bell-btn"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span
            className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
            data-testid="notification-bell-badge"
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
      <NotificationDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
