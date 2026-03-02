import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LoanNotification } from '@/types';

interface NotificationState {
    notifications: LoanNotification[];
    activeNotificationId: string | null;

    // Actions
    addNotification: (notification: Omit<LoanNotification, 'id' | 'timestamp' | 'isRead'>) => void;
    removeNotification: (id: string) => void;
    markAsRead: (id: string) => void;
    setActiveNotification: (id: string | null) => void;
    getUnreadCount: (userId: string) => number;
    getNotificationsForUser: (userId: string) => LoanNotification[];
    clearNotification: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>()(
    persist(
        (set, get) => ({
            notifications: [],
            activeNotificationId: null,

            addNotification: (notification) => {
                const newNotification: LoanNotification = {
                    ...notification,
                    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    timestamp: new Date().toISOString(),
                    isRead: false,
                };

                set((state) => ({
                    notifications: [...state.notifications, newNotification],
                }));

                return newNotification.id;
            },

            removeNotification: (id) => {
                set((state) => ({
                    notifications: state.notifications.filter((n) => n.id !== id),
                    activeNotificationId: state.activeNotificationId === id ? null : state.activeNotificationId,
                }));
            },

            markAsRead: (id) => {
                set((state) => ({
                    notifications: state.notifications.map((n) =>
                        n.id === id ? { ...n, isRead: true } : n
                    ),
                }));
            },

            setActiveNotification: (id) => {
                set({ activeNotificationId: id });
            },

            getUnreadCount: (userId) => {
                const state = get();
                return state.notifications.filter(
                    (n) => n.approverId === userId && !n.isRead
                ).length;
            },

            getNotificationsForUser: (userId) => {
                const state = get();
                return state.notifications
                    .filter((n) => n.approverId === userId)
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            },

            clearNotification: (id) => {
                set((state) => ({
                    notifications: state.notifications.filter((n) => n.id !== id),
                }));
            },
        }),
        {
            name: 'notification-store',
        }
    )
);
