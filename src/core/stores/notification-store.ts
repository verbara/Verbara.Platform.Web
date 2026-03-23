import { create } from 'zustand';

export interface Notification {
  id: string;
  type: string;
  title: string;
  conversationId?: string;
  timestamp: string;
  read: boolean;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (n: Omit<Notification, 'id' | 'read'>) => void;
  markRead: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  notifications: [],
  unreadCount: 0,
  addNotification: (n) =>
    set((s) => {
      const notification: Notification = { ...n, id: crypto.randomUUID(), read: false };
      return {
        notifications: [notification, ...s.notifications].slice(0, 50),
        unreadCount: s.unreadCount + 1,
      };
    }),
  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      unreadCount: Math.max(0, s.unreadCount - 1),
    })),
  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}));
