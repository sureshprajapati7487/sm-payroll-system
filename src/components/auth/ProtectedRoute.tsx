import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { PermissionValue } from '@/config/permissions';
import { Role } from '@/types';

interface ProtectedRouteProps {
    requiredPermission?: PermissionValue;
    requiredRole?: Role; // Optional: Strict role check if needed
}

export const ProtectedRoute = ({ requiredPermission, requiredRole }: ProtectedRouteProps) => {
    const { isAuthenticated, user, hasPermission } = useAuthStore();

    if (!isAuthenticated || !user) {
        return <Navigate to="/login" replace />;
    }

    // 1. Check strict role if provided
    if (requiredRole && user.role !== requiredRole) {
        return <Navigate to="/unauthorized" replace />;
    }

    // 2. Check specific permission if provided
    if (requiredPermission && !hasPermission(requiredPermission)) {
        return <Navigate to="/unauthorized" replace />;
    }

    // Authorized
    return <Outlet />;
};
