import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { PermissionValue } from '@/config/permissions';
import { Role } from '@/types';

interface ProtectedRouteProps {
    requiredPermission?: PermissionValue;
    requiredRole?: Role;
}

export const ProtectedRoute = ({ requiredPermission, requiredRole }: ProtectedRouteProps) => {
    const { isAuthenticated, isHydrated, user, hasPermission, token, tokenExpiresAt, refreshAccessToken } = useAuthStore();

    // FIX 3: Check real token validity on every render, not just the isAuthenticated flag.
    // If token is expired or near-expiry, trigger a refresh. refreshAccessToken() handles
    // logout internally if the refresh token is also rejected (401/403).
    useEffect(() => {
        if (!isHydrated || !isAuthenticated || !token) return;

        const isExpiredOrNearExpiry = !tokenExpiresAt || Date.now() > tokenExpiresAt - 30 * 1000;
        if (isExpiredOrNearExpiry) {
            refreshAccessToken();
        }
    }, [isHydrated, isAuthenticated, token, tokenExpiresAt, refreshAccessToken]);

    // Wait for Zustand persist hydration before making auth decisions.
    if (!isHydrated) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-900">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500" />
            </div>
        );
    }

    if (!isAuthenticated || !user) {
        return <Navigate to="/login" replace />;
    }

    // Strict role check
    if (requiredRole && user.role !== requiredRole) {
        return <Navigate to="/unauthorized" replace />;
    }

    // Permission check
    if (requiredPermission && !hasPermission(requiredPermission)) {
        return <Navigate to="/unauthorized" replace />;
    }

    return <Outlet />;
};
