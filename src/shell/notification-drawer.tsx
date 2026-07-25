import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Bell, Check } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/core/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/core/ui/tabs';
import { Button } from '@/core/ui/button';
import { VirtualList } from '@/core/ui/virtual-list';
import { NotificationItem } from './notification-item';
import {
  useNotifications,
  useUnreadCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type Notification,
  type NotificationCategory,
} from '@/core/api/hooks/use-notifications';

interface NotificationDrawerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

type TabValue = 'all' | NotificationCategory;

const CATEGORY_VALUES: TabValue[] = ['all', 'Operational', 'System', 'Security', 'Billing'];

const PAGE_SIZE = 50;

export function NotificationDrawer({ open, onOpenChange }: NotificationDrawerProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const { data: notifications = [], isLoading } = useNotifications({ limit });
  const { data: unreadCount } = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // Reset drawer state when closed so reopening lands on a predictable view.
  function handleOpenChange(next: boolean) {
    if (!next) {
      setActiveTab('all');
      setLimit(PAGE_SIZE);
    }
    onOpenChange(next);
  }

  // Category filtering is client-side: backend /notifications endpoint does not
  // accept a ?category= param. Counts and filtered list operate only on the
  // currently loaded page (up to `limit` items).
  const categoryCounts = useMemo(() => {
    const counts: Record<TabValue, number> = {
      all: 0,
      Operational: 0,
      System: 0,
      Security: 0,
      Billing: 0,
    };
    for (const n of notifications) {
      if (!n.isRead) {
        counts.all += 1;
        counts[n.category] += 1;
      }
    }
    return counts;
  }, [notifications]);

  const filtered = useMemo(() => {
    if (activeTab === 'all') return notifications;
    return notifications.filter((n) => n.category === activeTab);
  }, [notifications, activeTab]);

  const canLoadMore = notifications.length === limit;

  function handleItemClick(n: Notification) {
    if (!n.isRead) {
      markRead.mutate(n.notificationId);
    }
    if (n.actionUrl) {
      navigate(n.actionUrl);
      handleOpenChange(false);
    }
  }

  function handleMarkAll() {
    markAllRead.mutate();
  }

  function handleLoadMore() {
    setLimit((prev) => prev + PAGE_SIZE);
  }

  const hasUnread = (unreadCount?.count ?? 0) > 0;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:!max-w-md overflow-hidden flex flex-col p-0">
        <SheetHeader className="flex-row items-center justify-between gap-0 border-b border-slate-200 px-4 py-3 pr-12 dark:border-slate-700">
          <SheetTitle>{t('notifications.title')}</SheetTitle>
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAll}
              disabled={markAllRead.isPending}
              data-testid="notification-mark-all-btn"
            >
              <Check className="mr-1 h-4 w-4" />
              {t('notifications.mark_all_read')}
            </Button>
          )}
        </SheetHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => v && setActiveTab(v as TabValue)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <TabsList className="flex w-full justify-start overflow-x-auto border-b border-slate-200 px-2 dark:border-slate-700">
            {CATEGORY_VALUES.map((cat) => (
              <TabsTrigger key={cat} value={cat} className="gap-1.5">
                {t(`notifications.category.${cat}`)}
                {categoryCounts[cat] > 0 && (
                  <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                    {categoryCounts[cat]}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {CATEGORY_VALUES.map((cat) => (
            <TabsContent key={cat} value={cat} className="flex-1 overflow-y-auto p-0">
              {isLoading ? (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  {t('notifications.loading')}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Bell className="h-8 w-8" />
                  <span className="text-sm">{t('notifications.empty')}</span>
                </div>
              ) : (
                <VirtualList
                  items={filtered}
                  getItemKey={(n) => n.notificationId}
                  estimateSize={() => 80}
                  onEndReached={canLoadMore && activeTab === 'all' ? handleLoadMore : undefined}
                  renderItem={(n) => (
                    <NotificationItem notification={n} onClick={handleItemClick} />
                  )}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
