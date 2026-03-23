import { useNotificationStore } from './notification-store';

describe('NotificationStore', () => {
  beforeEach(() => useNotificationStore.getState().clearAll());

  it('should_IncrementUnreadCount_WhenNotificationAdded', () => {
    useNotificationStore.getState().addNotification({
      type: 'conversation.assigned',
      title: 'New conversation',
      timestamp: new Date().toISOString(),
    });
    expect(useNotificationStore.getState().unreadCount).toBe(1);
    expect(useNotificationStore.getState().notifications).toHaveLength(1);
  });

  it('should_DecrementUnreadCount_WhenMarkedRead', () => {
    useNotificationStore.getState().addNotification({
      type: 'test',
      title: 'Test',
      timestamp: new Date().toISOString(),
    });
    const id = useNotificationStore.getState().notifications[0]!.id;
    useNotificationStore.getState().markRead(id);
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it('should_LimitTo50Notifications', () => {
    for (let i = 0; i < 60; i++) {
      useNotificationStore.getState().addNotification({
        type: 'test',
        title: `N${i}`,
        timestamp: new Date().toISOString(),
      });
    }
    expect(useNotificationStore.getState().notifications).toHaveLength(50);
  });
});
