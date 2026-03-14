import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';
import { PermissionValue } from '@/config/permissions';
import { audit, auditAnonymous } from '@/lib/auditLogger';
import { API_URL } from '@/lib/apiConfig';
import { useRolePermissionsStore } from '@/store/rolePermissionsStore';

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    tokenExpiresAt: number | null; // epoch ms
    loginWithCredentials: (idOrEmail: string, password: string) => Promise<{ error: string; attemptsRemaining?: number; retryAfter?: number } | null>;
    refreshAccessToken: () => Promise<boolean>;
    startAutoRefresh: () => void;
    logout: () => void;
    hasPermission: (permission: PermissionValue) => boolean;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            tokenExpiresAt: null,

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

                    // Server login failed
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

                // --- PREVENT DATA BLEED ACROSS LOGINS ---
                // Preserve system-level config keys that are NOT user-specific
                // (role permissions are set by Super Admin and must survive logout)
                try {
                    const PRESERVE_KEYS = ['theme-storage', 'role-permissions-v2'];
                    const preserved: Record<string, string | null> = {};
                    PRESERVE_KEYS.forEach(k => { preserved[k] = localStorage.getItem(k); });
                    localStorage.clear();
                    PRESERVE_KEYS.forEach(k => { if (preserved[k]) localStorage.setItem(k, preserved[k]!); });
                } catch (e) {
                    console.error('Failed to clear local storage on logout', e);
                }
            },

            hasPermission: (permission: PermissionValue) => {
                const { user } = get();
                if (!user) return false;
                return useRolePermissionsStore.getState().hasPermission(user.role, permission);
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
