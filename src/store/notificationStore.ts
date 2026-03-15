import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppNotification, Role } from '@/types';

interface NotificationState {
    notifications: AppNotification[];
    activeNotificationId: string | null;

    // Actions
    addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'>) => string;
    removeNotification: (id: string) => void;
    markAsRead: (id: string) => void;
    setActiveNotification: (id: string | null) => void;
    clearNotification: (id: string) => void;

    // Permission-aware selectors
    getUnreadCount: (userId: string, userRole: Role, userPermissions: string[]) => number;
    getNotificationsForUser: (userId: string, userRole: Role, userPermissions: string[]) => AppNotification[];
}

/** Returns true if the notification targets this user based on routing criteria */
function matchesUser(
    n: AppNotification,
    userId: string,
    userRole: Role,
    userPermissions: string[]
): boolean {
    // Direct user targeting
    if (n.targetUserIds?.includes(userId)) return true;
    // Legacy approverId field (loan notifications)
    if (n.approverId === userId) return true;
    // Role-based routing
    if (n.targetRoles?.includes(userRole)) return true;
    // Permission-based routing
    if (n.targetPermissions?.some(p => userPermissions.includes(p))) return true;
    return false;
}

export const useNotificationStore = create<NotificationState>()(
    persist(
        (set, get) => ({
            notifications: [],
            activeNotificationId: null,

            addNotification: (notification) => {
                const newNotification: AppNotification = {
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

            clearNotification: (id) => {
                set((state) => ({
                    notifications: state.notifications.filter((n) => n.id !== id),
                }));
            },

            // Permission-aware
            getUnreadCount: (userId, userRole, userPermissions) => {
                return get().notifications.filter(
                    (n) => !n.isRead && matchesUser(n, userId, userRole, userPermissions)
                ).length;
            },

            getNotificationsForUser: (userId, userRole, userPermissions) => {
                return get()
                    .notifications
                    .filter((n) => matchesUser(n, userId, userRole, userPermissions))
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            },
        }),
        {
            name: 'notification-store',
        }
    )
);
