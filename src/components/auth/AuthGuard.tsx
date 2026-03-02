import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

/**
 * AuthGuard - Redirects to login if not authenticated
 * Use this at the root level to ensure login page opens first
 */
export const AuthGuard = ({ children }: { children: JSX.Element }) => {
    const { isAuthenticated } = useAuthStore();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return children;
};
