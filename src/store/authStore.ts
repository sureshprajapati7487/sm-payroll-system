import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Role } from '@/types';
import { PermissionValue } from '@/config/permissions';
import { audit, auditAnonymous } from '@/lib/auditLogger';
import { CapacitorHttp } from '@capacitor/core';
import { API_URL } from '@/lib/apiConfig';
import { useRolePermissionsStore } from '@/store/rolePermissionsStore';
import { useSecurityAlertsStore } from '@/store/securityAlertsStore';

// How long before actual expiry we proactively refresh (2 min before = 13 min into 15-min token)
const REFRESH_BEFORE_MS = 2 * 60 * 1000;
// Buffer: if token expires within 30s, treat as "near-expired" and refresh immediately
const EXPIRY_BUFFER_MS = 30 * 1000;
// Retry config for auto-refresh failures
const MAX_REFRESH_RETRIES = 3;
const RETRY_DELAY_MS = 5 * 1000;

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    tokenExpiresAt: number | null; // epoch ms
    isHydrated: boolean; // true after Zustand persist hydration completes
    impersonatedRole: Role | null;
    setImpersonatedRole: (role: Role | null) => void;
    loginWithCredentials: (idOrEmail: string, password: string) => Promise<{ error: string; fix?: string; attemptsRemaining?: number; retryAfter?: number } | null>;
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
            isHydrated: false,
            impersonatedRole: null,

            setImpersonatedRole: (role) => set({ impersonatedRole: role }),

            loginWithCredentials: async (idOrEmail: string, password: string) => {
                set({ isLoading: true });
                try {
                    const res = await CapacitorHttp.post({
                        url: `${API_URL}/auth/login`,
                        headers: { 'Content-Type': 'application/json' },
                        data: { idOrEmail: idOrEmail.trim(), password: password.trim() },
                    });

                    const data = res.data;

                    if (res.status >= 200 && res.status < 300) {
                        // ✅ Server login success
                        const { token, user, expiresIn } = data as { token: string; user: User; expiresIn?: number };
                        const tokenExpiresAt = Date.now() + (expiresIn ? expiresIn * 1000 : 15 * 60 * 1000);
                        set({ user, token, isAuthenticated: true, isLoading: false, tokenExpiresAt });
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
                            action: 'LOGIN_FAILED', entityType: 'USER',
                            attemptedUserId: idOrEmail.trim(), entityName: idOrEmail.trim(),
                            details: { reason: 'rate_limited', status: res.status },
                            status: 'FAILED', errorMessage: data.error || 'Too many attempts',
                        });
                        useSecurityAlertsStore.getState().addAlert({
                            type: 'failed_login', severity: 'critical',
                            title: '🔒 Account Locked — Rate Limited',
                            description: `Login for "${idOrEmail.trim()}" blocked due to too many failed attempts.`,
                            userId: idOrEmail.trim(), userName: idOrEmail.trim(),
                            metadata: { reason: 'rate_limited' },
                        });
                        return {
                            error: data.error || 'Too many attempts. Please wait.',
                            fix: data.fix,
                            retryAfter: data.retryAfter || data.lockedFor || 900,
                        };
                    }

                    // Server login failed (401/403/etc.)
                    set({ isLoading: false });
                    auditAnonymous({
                        action: 'LOGIN_FAILED', entityType: 'USER',
                        attemptedUserId: idOrEmail.trim(), entityName: idOrEmail.trim(),
                        details: { reason: 'invalid_credentials', attemptsRemaining: data.attemptsRemaining },
                        status: 'FAILED', errorMessage: data.error || 'Invalid Login ID or Password',
                    });
                    useSecurityAlertsStore.getState().addAlert({
                        type: 'failed_login', severity: 'high',
                        title: '⚠️ Failed Login Attempt',
                        description: `Login failed for "${idOrEmail.trim()}". ${data.attemptsRemaining != null ? `${data.attemptsRemaining} attempt(s) remaining.` : ''}`,
                        userId: idOrEmail.trim(), userName: idOrEmail.trim(),
                        metadata: { reason: 'invalid_credentials', attemptsRemaining: data.attemptsRemaining },
                    });
                    return {
                        error: data.error || 'Invalid Login ID or Password',
                        fix: data.fix,
                        attemptsRemaining: data.attemptsRemaining,
                    };

                } catch (e: any) {
                    console.error('Auth error:', e);
                    set({ isLoading: false });

                    // FIX 5: Network error — check if a valid existing session can be reused.
                    // Scenario: user is already logged in, had a brief network blip, ended up on login page.
                    const { isAuthenticated, token: existingToken, tokenExpiresAt: existingExpiry } = get();
                    if (isAuthenticated && existingToken && existingExpiry && existingExpiry > Date.now()) {
                        console.warn('[Auth] Network error during login — reusing existing valid session');
                        return null; // success — keep current session, don't force re-login
                    }

                    // Diagnostic ping to surface a more specific error message
                    let specificError = 'Network error — is the server running?';
                    try {
                        const ping = await CapacitorHttp.get({ url: `${API_URL}/health` });
                        if (ping.status >= 200) {
                            specificError = 'Network error: Server is reachable but login failed (CORS/Payload issue).';
                        }
                    } catch (pingErr: any) {
                        specificError = `Network connection failed: ${pingErr?.message || 'Check your internet connection or server status.'}`;
                    }

                    auditAnonymous({
                        action: 'LOGIN_FAILED', entityType: 'USER',
                        attemptedUserId: idOrEmail.trim(),
                        details: { reason: 'network_error', rawError: e?.message },
                        status: 'FAILED', errorMessage: specificError,
                    });
                    return { error: specificError };
                }
            },

            // ── Refresh Access Token ──────────────────────────────────────────────
            // FIX 1: Only call logout() on explicit 401/403 (token rejected by server).
            // 5xx errors and network failures return false — caller handles retry.
            refreshAccessToken: async () => {
                try {
                    const res = await CapacitorHttp.post({ url: `${API_URL}/auth/refresh` });

                    if (res.status === 401 || res.status === 403) {
                        // Server explicitly rejected the refresh token — session is dead
                        get().logout();
                        return false;
                    }

                    if (res.status < 200 || res.status >= 300) {
                        // Server error (5xx) or unexpected status — treat as transient, do NOT logout
                        console.warn(`[Auth] Refresh returned ${res.status} — treating as transient, will retry`);
                        return false;
                    }

                    const { token, user, expiresIn } = res.data;
                    const tokenExpiresAt = Date.now() + (expiresIn ? expiresIn * 1000 : 15 * 60 * 1000);
                    set({ token, user, tokenExpiresAt });
                    return true;
                } catch {
                    // Network failure — return false without logout (will retry)
                    return false;
                }
            },

            // ── Auto Refresh Timer ────────────────────────────────────────────────
            // FIX 1: Retry up to 3 times with 5s delay before giving up and logging out.
            startAutoRefresh: () => {
                const expiresAt = get().tokenExpiresAt;
                if (!expiresAt) return;

                const delay = Math.max(0, expiresAt - Date.now() - REFRESH_BEFORE_MS);

                setTimeout(async () => {
                    if (!get().isAuthenticated) return; // already logged out

                    let succeeded = false;
                    for (let attempt = 1; attempt <= MAX_REFRESH_RETRIES; attempt++) {
                        succeeded = await get().refreshAccessToken();
                        if (succeeded) break;

                        const hasMoreRetries = attempt < MAX_REFRESH_RETRIES;
                        if (hasMoreRetries && get().isAuthenticated) {
                            console.warn(`[Auth] Token refresh failed (attempt ${attempt}/${MAX_REFRESH_RETRIES}) — retrying in ${RETRY_DELAY_MS / 1000}s`);
                            await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
                        }

                        // Stop retrying if user logged out while we waited
                        if (!get().isAuthenticated) return;
                    }

                    if (succeeded) {
                        get().startAutoRefresh(); // chain next scheduled refresh
                    } else {
                        // All retries exhausted — refreshAccessToken already called logout() on 401/403.
                        // If it returned false for other reasons (5xx/network), force logout now.
                        if (get().isAuthenticated) {
                            console.warn('[Auth] All refresh retries failed — logging out');
                            get().logout();
                        }
                    }
                }, delay);
            },

            logout: () => {
                const user = get().user;
                if (user) {
                    audit({
                        action: 'LOGOUT', entityType: 'USER',
                        entityId: user.id, entityName: user.name,
                        details: { role: user.role }, status: 'SUCCESS',
                    });
                }

                // Clear local state immediately
                set({ user: null, token: null, isAuthenticated: false, tokenExpiresAt: null });

                // Fire-and-forget: clears HTTP-only refresh_token cookie + marks server session inactive
                CapacitorHttp.post({ url: `${API_URL}/auth/logout` }).catch(() => {});

                // Wipe user-session data, preserve system-level config
                try {
                    const PRESERVE_KEYS = [
                        'theme-storage',
                        'theme-store-v2',
                        'role-permissions-v2',
                        'system-config-storage',
                        'sm-payroll-workflows',
                        'sm-custom-fields-v1',
                    ];
                    const preserved: Record<string, string | null> = {};
                    PRESERVE_KEYS.forEach(k => { preserved[k] = localStorage.getItem(k); });
                    localStorage.clear();
                    PRESERVE_KEYS.forEach(k => { if (preserved[k]) localStorage.setItem(k, preserved[k]!); });
                } catch (e) {
                    console.error('Failed to clear local storage on logout', e);
                }
            },

            hasPermission: (permission: PermissionValue) => {
                const { user, impersonatedRole } = get();
                if (!user) return false;
                const roleToCheck = impersonatedRole || user.role;
                return useRolePermissionsStore.getState().hasPermission(roleToCheck, permission);
            },
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                isAuthenticated: state.isAuthenticated,
                tokenExpiresAt: state.tokenExpiresAt,
                // isHydrated intentionally NOT persisted
            }),
            onRehydrateStorage: () => (state) => {
                if (!state) return;

                const token = state.token;

                // Clear old fake/mock tokens
                if (token && token.startsWith('mock-')) {
                    state.token = null;
                    state.isAuthenticated = false;
                    state.user = null;
                    state.tokenExpiresAt = null;
                    state.isHydrated = true;
                    return;
                }

                if (token) {
                    try {
                        const parts = token.split('.');
                        if (parts.length !== 3) throw new Error('Invalid JWT structure');

                        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                        const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
                        const payload = JSON.parse(atob(padded));

                        if (!payload || typeof payload !== 'object') throw new Error('Invalid JWT payload');

                        const nowSec = Date.now() / 1000;
                        const bufferSec = EXPIRY_BUFFER_MS / 1000;

                        // FIX 2: Token near-expiry or just expired — attempt refresh BEFORE clearing.
                        // "near-expiry" = within 30s buffer. Don't immediately logout the user.
                        const isNearExpiredOrExpired = payload.exp && nowSec > (payload.exp - bufferSec);
                        const isClearlyExpired = payload.exp && nowSec > (payload.exp + 60); // >60s past expiry

                        if (isClearlyExpired) {
                            // Token expired >60s ago — refresh token (7-day) likely still valid.
                            // Keep session alive optimistically; refresh will logout if token is truly dead.
                            console.warn('[Auth] Token expired >60s ago — attempting refresh before clearing session');
                            setTimeout(() => {
                                useAuthStore.getState().refreshAccessToken().then(ok => {
                                    if (!ok && useAuthStore.getState().isAuthenticated) {
                                        // Refresh failed and we didn't logout already — clear now
                                        useAuthStore.setState({
                                            token: null, isAuthenticated: false,
                                            user: null, tokenExpiresAt: null,
                                        });
                                    }
                                });
                            }, 0);
                            // Keep isAuthenticated true while refresh is in-flight (ProtectedRoute shows spinner)

                        } else if (isNearExpiredOrExpired) {
                            // Token expires within 30s — refresh immediately, don't disrupt user
                            if (!state.tokenExpiresAt && payload.exp) {
                                state.tokenExpiresAt = payload.exp * 1000;
                            }
                            setTimeout(() => {
                                useAuthStore.getState().refreshAccessToken();
                            }, 0);

                        } else {
                            // Token is valid — reconstruct tokenExpiresAt if missing, start auto-refresh
                            if (!state.tokenExpiresAt && payload.exp) {
                                state.tokenExpiresAt = payload.exp * 1000;
                            }
                            setTimeout(() => {
                                useAuthStore.getState().startAutoRefresh();
                            }, 100);
                        }

                    } catch {
                        // Malformed token — clear everything
                        state.token = null;
                        state.isAuthenticated = false;
                        state.user = null;
                        state.tokenExpiresAt = null;
                    }
                }

                // Mark hydration complete — unblocks ProtectedRoute and AuthGuard rendering
                state.isHydrated = true;
            },
        }
    )
);
