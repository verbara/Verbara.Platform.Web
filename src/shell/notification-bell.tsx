import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '@/core/stores/notification-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/core/ui/dropdown-menu';
import { Bell } from 'lucide-react';

export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const markRead = useNotificationStore((s) => s.markRead);
  const clearAll = useNotificationStore((s) => s.clearAll);

  const recent = notifications.slice(0, 10);

  function handleClick(id: string, conversationId?: string) {
    markRead(id);
    if (conversationId) {
      navigate(`/agent/conversation/${conversationId}`);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(props) => (
          <button
            {...props}
            className="relative flex h-10 w-10 items-center justify-center rounded-md text-rail-icon hover:bg-slate-800 hover:text-rail-icon-active"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        )}
      />
      <DropdownMenuContent side="right" align="end" className="w-72">
        <DropdownMenuLabel>{t('nav.notifications')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {recent.length === 0 ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            {t('status.no_results')}
          </div>
        ) : (
          <>
            {recent.map((n) => (
              <DropdownMenuItem
                key={n.id}
                onClick={() => handleClick(n.id, n.conversationId)}
                className={n.read ? 'opacity-60' : ''}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm">{n.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(n.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {!n.read && (
                  <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-brand" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={clearAll} className="justify-center text-xs">
              {t('actions.clear_all')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
