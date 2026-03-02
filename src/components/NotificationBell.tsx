import { Bell } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useState, useRef, useEffect } from 'react';
import { LoanNotification } from '@/types';

export const NotificationBell = () => {
    const { user } = useAuthStore();
    const { getUnreadCount, getNotificationsForUser, setActiveNotification, markAsRead } = useNotificationStore();
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const unreadCount = user ? getUnreadCount(user.id) : 0;
    const notifications = user ? getNotificationsForUser(user.id) : [];

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

    const handleNotificationClick = (notification: LoanNotification) => {
        setActiveNotification(notification.id);
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

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return null; // Only show for admins
    }

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Icon */}
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="relative p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
                <Bell className="w-5 h-5 text-white" />
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
                    <div className="p-4 border-b border-dark-border">
                        <h3 className="text-white font-semibold">Loan Approvals</h3>
                        <p className="text-xs text-dark-muted">
                            {unreadCount > 0 ? `${unreadCount} pending approval${unreadCount > 1 ? 's' : ''}` : 'No pending approvals'}
                        </p>
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
                                {notifications.map((notification) => (
                                    <button
                                        key={notification.id}
                                        onClick={() => handleNotificationClick(notification)}
                                        className={`w-full p-4 text-left transition-colors hover:bg-white/5 ${!notification.isRead ? 'bg-blue-500/5' : ''
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            {!notification.isRead && (
                                                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2 mb-1">
                                                    <p className="text-white font-medium text-sm truncate">
                                                        {notification.employeeName}
                                                    </p>
                                                    <span className="text-xs text-dark-muted whitespace-nowrap">
                                                        {formatTime(notification.timestamp)}
                                                    </span>
                                                </div>
                                                <p className="text-dark-muted text-xs mb-2">
                                                    {notification.employeeCode} • {notification.loanType}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-green-400 font-semibold text-sm">
                                                        {formatCurrency(notification.amount)}
                                                    </span>
                                                    <span className="text-dark-muted text-xs">
                                                        • {notification.tenureMonths} months
                                                    </span>
                                                </div>
                                                {notification.reason && (
                                                    <p className="text-dark-muted text-xs mt-1 line-clamp-1">
                                                        {notification.reason}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="p-3 border-t border-dark-border">
                            <button
                                onClick={() => {
                                    notifications.forEach(n => markAsRead(n.id));
                                    setShowDropdown(false);
                                }}
                                className="w-full text-center text-sm text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                Mark all as read
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
