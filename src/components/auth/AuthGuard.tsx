import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

/**
 * AuthGuard — wraps the Login page.
 * FIX 3: Checks real token validity (not just isAuthenticated flag).
 * If token is expired, lets user see login page even if flag is still true.
 */
export const AuthGuard = ({ children }: { children: JSX.Element }) => {
    const { isAuthenticated, isHydrated, token, tokenExpiresAt } = useAuthStore();

    if (!isHydrated) return null; // wait silently — login page is the default

    if (isAuthenticated && token) {
        const isTokenValid = tokenExpiresAt && Date.now() < tokenExpiresAt;
        if (isTokenValid) return <Navigate to="/dashboard" replace />;
        // Token expired but flag still true — fall through to show login page
    }

    return children;
};
