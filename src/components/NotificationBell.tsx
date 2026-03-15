import { Bell, AlertCircle, CheckCircle, CreditCard, FileText, CalendarClock, Info } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useRolePermissionsStore } from '@/store/rolePermissionsStore';
import { useState, useRef, useEffect } from 'react';
import { AppNotification, NotificationType } from '@/types';

// Map notification types to icons and accent colors
const TYPE_META: Record<NotificationType, { icon: JSX.Element; accent: string; bg: string }> = {
    [NotificationType.LOAN_APPROVAL]: {
        icon: <CreditCard className="w-4 h-4" />,
        accent: 'text-amber-400',
        bg: 'bg-amber-500/10 border-amber-500/20',
    },
    [NotificationType.PAYROLL_GENERATED]: {
        icon: <FileText className="w-4 h-4" />,
        accent: 'text-green-400',
        bg: 'bg-green-500/10 border-green-500/20',
    },
    [NotificationType.LEAVE_REQUEST]: {
        icon: <CalendarClock className="w-4 h-4" />,
        accent: 'text-blue-400',
        bg: 'bg-blue-500/10 border-blue-500/20',
    },
    [NotificationType.LEAVE_DECISION]: {
        icon: <CheckCircle className="w-4 h-4" />,
        accent: 'text-emerald-400',
        bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    [NotificationType.ATTENDANCE_REGULARIZATION]: {
        icon: <AlertCircle className="w-4 h-4" />,
        accent: 'text-orange-400',
        bg: 'bg-orange-500/10 border-orange-500/20',
    },
    [NotificationType.SYSTEM]: {
        icon: <Info className="w-4 h-4" />,
        accent: 'text-slate-400',
        bg: 'bg-slate-500/10 border-slate-500/20',
    },
};

export const NotificationBell = () => {
    const { user } = useAuthStore();
    const { permissions } = useRolePermissionsStore();
    const { getUnreadCount, getNotificationsForUser, setActiveNotification, markAsRead } = useNotificationStore();
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Build user's permission list for routing
    const userPermissions: string[] = user ? (permissions[user.role] ?? []) : [];

    const unreadCount = user ? getUnreadCount(user.id, user.role, userPermissions) : 0;
    const notifications = user ? getNotificationsForUser(user.id, user.role, userPermissions) : [];

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleNotificationClick = (notification: AppNotification) => {
        markAsRead(notification.id);
        // For loan notifications, open modal if loanId exists
        if (notification.loanId) {
            setActiveNotification(notification.id);
        }
        setShowDropdown(false);
    };

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        return `${diffDays}d ago`;
    };

    // Only render if logged in and has notifications (or unread)
    if (!user) return null;

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Icon */}
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="relative p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
                <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-white' : 'text-dark-muted'}`} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-gradient-to-r from-red-600 to-rose-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {showDropdown && (
                <div className="absolute right-0 mt-2 w-96 glass rounded-xl shadow-2xl border border-dark-border z-50 max-h-[500px] overflow-hidden flex flex-col animate-in slide-in-from-top-2 duration-200">
                    {/* Header */}
                    <div className="p-4 border-b border-dark-border flex items-center justify-between">
                        <div>
                            <h3 className="text-white font-semibold">Notifications</h3>
                            <p className="text-xs text-dark-muted">
                                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                            </p>
                        </div>
                        {notifications.length > 0 && (
                            <button
                                onClick={() => { notifications.forEach(n => markAsRead(n.id)); }}
                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    {/* Notification List */}
                    <div className="overflow-y-auto flex-1">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center">
                                <Bell className="w-12 h-12 text-dark-muted mx-auto mb-3 opacity-50" />
                                <p className="text-dark-muted text-sm">No notifications</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-dark-border">
                                {notifications.map((n) => {
                                    const meta = TYPE_META[n.type] ?? TYPE_META[NotificationType.SYSTEM];
                                    return (
                                        <button
                                            key={n.id}
                                            onClick={() => handleNotificationClick(n)}
                                            className={`w-full p-4 text-left transition-colors hover:bg-white/5 ${!n.isRead ? 'bg-blue-500/5' : ''}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                {/* Type icon badge */}
                                                <div className={`shrink-0 mt-0.5 w-8 h-8 flex items-center justify-center rounded-xl border ${meta.bg} ${meta.accent}`}>
                                                    {meta.icon}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2 mb-0.5">
                                                        <p className="text-white font-medium text-sm truncate">{n.title}</p>
                                                        <span className="text-xs text-dark-muted whitespace-nowrap">{formatTime(n.timestamp)}</span>
                                                    </div>
                                                    <p className="text-dark-muted text-xs leading-relaxed line-clamp-2">{n.message}</p>
                                                </div>

                                                {/* Unread dot */}
                                                {!n.isRead && (
                                                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
