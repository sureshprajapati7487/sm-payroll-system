import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Role, Roles, User } from '@/types';
import { ROLE_PERMISSIONS, PermissionValue } from '@/config/permissions';
import { audit, auditAnonymous } from '@/lib/auditLogger';
import { API_URL } from '@/lib/apiConfig';

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    tokenExpiresAt: number | null; // epoch ms
    login: (role: Role) => void;
    loginWithCredentials: (idOrEmail: string, password: string) => Promise<{ error: string; attemptsRemaining?: number; retryAfter?: number } | null>;
    refreshAccessToken: () => Promise<boolean>;
    startAutoRefresh: () => void;
    logout: () => void;
    hasPermission: (permission: PermissionValue) => boolean;
}

// Quick dev mock users (used by one-click role buttons on login page)
const MOCK_USERS: Record<Role, User> = {
    [Roles.SUPER_ADMIN]: { id: '1', name: 'Suresh Owner', role: Roles.SUPER_ADMIN, email: 'owner@smpayroll.com', avatar: 'https://ui-avatars.com/api/?name=Super+Admin' },
    [Roles.ADMIN]: { id: '2', name: 'Operational Admin', role: Roles.ADMIN, email: 'admin@smpayroll.com', avatar: 'https://ui-avatars.com/api/?name=Admin' },
    [Roles.ACCOUNT_ADMIN]: { id: '3', name: 'Finance Controller', role: Roles.ACCOUNT_ADMIN, email: 'accounts@smpayroll.com', avatar: 'https://ui-avatars.com/api/?name=Account+Admin' },
    [Roles.MANAGER]: { id: '4', name: 'Team Manager', role: Roles.MANAGER, email: 'manager@smpayroll.com', avatar: 'https://ui-avatars.com/api/?name=Manager' },
    [Roles.EMPLOYEE]: { id: '5', name: 'Rahul Employee', role: Roles.EMPLOYEE, email: 'rahul@smpayroll.com', avatar: 'https://ui-avatars.com/api/?name=Employee' },
};

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            tokenExpiresAt: null,

            // One-click dev login — calls server to get a real signed JWT
            login: (role: Role) => {
                set({ isLoading: true });
                const user = MOCK_USERS[role];
                // Call real server dev-login to get a properly signed JWT
                fetch(`${API_URL}/auth/dev-login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: user.id, name: user.name, role: user.role, email: user.email }),
                })
                    .then(r => r.ok ? r.json() : null)
                    .then(data => {
                        const token = data?.token || null;
                        set({ user, token, isAuthenticated: true, isLoading: false, tokenExpiresAt: Date.now() + 8 * 60 * 60 * 1000 });
                        setTimeout(() => audit({
                            action: 'LOGIN',
                            entityType: 'USER',
                            entityId: user.id,
                            entityName: user.name,
                            details: { role: user.role, method: 'mock' },
                            status: 'SUCCESS',
                        }), 100);
                    })
                    .catch(() => {
                        // Fallback: set without token (offline mode)
                        set({ user, token: null, isAuthenticated: true, isLoading: false });
                    });
            },

            // Real JWT login — calls server, returns null on success or error object on failure
            loginWithCredentials: async (idOrEmail: string, password: string) => {
                set({ isLoading: true });
                try {
                    const res = await fetch(`${API_URL}/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ idOrEmail: idOrEmail.trim(), password: password.trim() }),
                    });

                    const data = await res.json();

                    if (res.ok) {
                        // ✅ Server login success
                        const { token, user, expiresIn } = data as { token: string; user: User; expiresIn?: number };
                        const tokenExpiresAt = Date.now() + (expiresIn ? expiresIn * 1000 : 15 * 60 * 1000);
                        set({ user, token, isAuthenticated: true, isLoading: false, tokenExpiresAt });
                        // Start auto-refresh timer
                        setTimeout(() => get().startAutoRefresh(), 100);
                        setTimeout(() => audit({
                            action: 'LOGIN', entityType: 'USER', entityId: user.id,
                            entityName: user.name, details: { role: user.role, method: 'credentials' }, status: 'SUCCESS',
                        }), 100);
                        return null; // null = success
                    }

                    // 429 — Rate limited or account locked
                    if (res.status === 429) {
                        set({ isLoading: false });
                        auditAnonymous({
                            action: 'LOGIN_FAILED',
                            entityType: 'USER',
                            attemptedUserId: idOrEmail.trim(),
                            entityName: idOrEmail.trim(),
                            details: { reason: 'rate_limited', status: res.status },
                            status: 'FAILED',
                            errorMessage: data.error || 'Too many attempts',
                        });
                        return {
                            error: data.error || 'Too many attempts. Please wait.',
                            retryAfter: data.retryAfter || data.lockedFor || 900,
                        };
                    }

                    // ❌ Server login failed — try LOCAL fallback (employee saved locally but not in DB)
                    const { useEmployeeStore } = await import('@/store/employeeStore');
                    const { _rawEmployees } = useEmployeeStore.getState();
                    const input = idOrEmail.trim().toUpperCase();
                    const localEmployee = (_rawEmployees || []).find(
                        (e: any) => e.code?.toUpperCase() === input || e.id?.toUpperCase() === input
                    );

                    if (localEmployee && (localEmployee.password || '').trim() === password.trim()) {
                        // Found in local store — get a dev-login JWT from server
                        const devRes = await fetch(`${API_URL}/auth/dev-login`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                id: localEmployee.id,
                                name: localEmployee.name,
                                role: localEmployee.role || 'SUPER_ADMIN',
                                email: localEmployee.email,
                                companyId: localEmployee.companyId,
                            }),
                        });
                        const devData = devRes.ok ? await devRes.json() : null;
                        const token = devData?.token || null;
                        const user: User = {
                            id: localEmployee.id,
                            name: localEmployee.name,
                            role: localEmployee.role as Role,
                            email: localEmployee.email,
                        };
                        set({ user, token, isAuthenticated: true, isLoading: false });
                        return null; // success via local fallback
                    }

                    // Both server and local failed
                    set({ isLoading: false });
                    auditAnonymous({
                        action: 'LOGIN_FAILED',
                        entityType: 'USER',
                        attemptedUserId: idOrEmail.trim(),
                        entityName: idOrEmail.trim(),
                        details: {
                            reason: 'invalid_credentials',
                            attemptsRemaining: data.attemptsRemaining,
                        },
                        status: 'FAILED',
                        errorMessage: data.error || 'Invalid Login ID or Password',
                    });
                    return {
                        error: data.error || 'Invalid Login ID or Password',
                        attemptsRemaining: data.attemptsRemaining,
                    };

                } catch (e) {
                    console.error('Auth error:', e);
                    set({ isLoading: false });
                    auditAnonymous({
                        action: 'LOGIN_FAILED',
                        entityType: 'USER',
                        attemptedUserId: idOrEmail.trim(),
                        details: { reason: 'network_error' },
                        status: 'FAILED',
                        errorMessage: 'Network error',
                    });
                    return { error: 'Network error — is the server running?' };
                }
            },

            // ── Refresh Access Token ────────────────────────────────────────
            refreshAccessToken: async () => {
                try {
                    const res = await fetch(`${API_URL}/auth/refresh`, {
                        method: 'POST',
                        credentials: 'include', // send httpOnly cookie
                    });
                    if (!res.ok) {
                        // Refresh token expired — force logout
                        get().logout();
                        return false;
                    }
                    const { token, user, expiresIn } = await res.json();
                    const tokenExpiresAt = Date.now() + (expiresIn ? expiresIn * 1000 : 15 * 60 * 1000);
                    set({ token, user, tokenExpiresAt });
                    if (import.meta.env.DEV) console.log('🔄 Access token auto-refreshed');
                    return true;
                } catch {
                    return false;
                }
            },

            // ── Auto Refresh Timer ────────────────────────────────────────
            startAutoRefresh: () => {
                // Refresh 2 min before expiry (token is 15 min, so refresh at 13 min)
                const REFRESH_BEFORE_MS = 2 * 60 * 1000;
                const expiresAt = get().tokenExpiresAt;
                if (!expiresAt) return;
                const delay = Math.max(0, expiresAt - Date.now() - REFRESH_BEFORE_MS);
                setTimeout(async () => {
                    if (!get().isAuthenticated) return; // user already logged out
                    const ok = await get().refreshAccessToken();
                    if (ok) get().startAutoRefresh(); // chain next refresh
                }, delay);
            },

            logout: () => {
                const user = get().user;
                if (user) {
                    audit({
                        action: 'LOGOUT',
                        entityType: 'USER',
                        entityId: user.id,
                        entityName: user.name,
                        details: { role: user.role },
                        status: 'SUCCESS',
                    });
                }
                set({ user: null, token: null, isAuthenticated: false });
            },

            hasPermission: (permission: PermissionValue) => {
                const { user } = get();
                if (!user) return false;
                return ROLE_PERMISSIONS[user.role].includes(permission);
            },
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                isAuthenticated: state.isAuthenticated,
            }),
            // On app startup: validate stored token (clear expired / mock tokens)
            onRehydrateStorage: () => (state) => {
                if (!state) return;

                const token = state.token;

                // 1. Clear old fake/mock tokens
                if (token && token.startsWith('mock-')) {
                    state.token = null;
                    state.isAuthenticated = false;
                    state.user = null;
                    return;
                }

                // 2. Check real JWT expiry (decode payload without library)
                if (token) {
                    try {
                        const payload = JSON.parse(atob(token.split('.')[1]));
                        const isExpired = payload.exp && Date.now() / 1000 > payload.exp;
                        if (isExpired) {
                            // Token expired — force re-login
                            state.token = null;
                            state.isAuthenticated = false;
                            state.user = null;
                        }
                        // ✅ Token valid — isAuthenticated stays true (auto-dash redirect works)
                    } catch {
                        // Malformed token — clear everything
                        state.token = null;
                        state.isAuthenticated = false;
                        state.user = null;
                    }
                }
            },
        }
    )
);
