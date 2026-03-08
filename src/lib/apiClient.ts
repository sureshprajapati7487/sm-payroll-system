/**
 * apiClient.ts — Centralized fetch wrapper with JWT auth + auto-refresh
 *
 * All store fetch() calls should use apiFetch() instead of raw fetch() so
 * the Bearer token is automatically included in every request.
 * On 401 (token expired), it will attempt to refresh via /api/auth/refresh
 * before retrying once. If refresh fails, it force-logs out.
 */

import { API_URL } from './apiConfig';

/** Read token from Zustand persisted storage without importing the store (avoids circular deps) */
function getToken(): string | null {
    try {
        const raw = localStorage.getItem('auth-storage');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed?.state?.token ?? null;
    } catch {
        return null;
    }
}

/** Read current company ID from Zustand persisted storage without importing the store */
function getActiveCompanyId(): string | null {
    try {
        const raw = localStorage.getItem('multi-company-store');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed?.state?.currentCompanyId ?? null;
    } catch {
        return null;
    }
}

/** Set a new token in Zustand persisted storage directly (avoids circular import) */
function setToken(token: string | null) {
    try {
        const raw = localStorage.getItem('auth-storage');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed?.state) return;
        parsed.state.token = token;
        localStorage.setItem('auth-storage', JSON.stringify(parsed));
    } catch { }
}

// Prevents multiple concurrent refresh attempts
let _refreshPromise: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
    if (_refreshPromise) return _refreshPromise;
    _refreshPromise = (async () => {
        try {
            const res = await fetch(`${API_URL}/auth/refresh`, {
                method: 'POST',
                credentials: 'include', // send httpOnly refresh cookie
            });
            if (!res.ok) {
                // Refresh token expired — clear local storage and force re-login
                localStorage.removeItem('auth-storage');
                return false;
            }
            const data = await res.json();
            if (data.token) {
                setToken(data.token);
                // Also update the Zustand store in memory if available
                try {
                    const { useAuthStore } = await import('@/store/authStore');
                    const expiresIn = data.expiresIn ?? 15 * 60;
                    useAuthStore.setState({
                        token: data.token,
                        user: data.user,
                        tokenExpiresAt: Date.now() + expiresIn * 1000,
                    });
                } catch { /* store import may fail in some edge cases */ }
            }
            return !!data.token;
        } catch {
            return false;
        } finally {
            _refreshPromise = null;
        }
    })();
    return _refreshPromise;
}

type FetchOptions = RequestInit & { skipAuth?: boolean; _isRetry?: boolean };

/**
 * Drop-in replacement for fetch() that:
 * 1. Prepends API_URL if path starts with /
 * 2. Adds Authorization: Bearer <token> header automatically
 * 3. Sets Content-Type: application/json if body is present
 * 4. On 401: tries to refresh the access token ONCE, then retries
 */
export async function apiFetch(path: string, options: FetchOptions = {}): Promise<Response> {
    const { skipAuth = false, _isRetry = false, headers: extraHeaders, ...rest } = options;

    const url = path.startsWith('http') ? path : `${API_URL}${path}`;

    const headers: Record<string, string> = {
        ...(extraHeaders as Record<string, string>),
    };

    // Auto-set Content-Type for JSON bodies
    if (rest.body && typeof rest.body === 'string') {
        headers['Content-Type'] = 'application/json';
    }

    // Inject JWT token and Company ID
    if (!skipAuth) {
        const token = getToken();
        const companyId = getActiveCompanyId();

        if (companyId) {
            headers['x-company-id'] = companyId;
        }

        if (!token && !_isRetry) {
            // No token — return synthetic 401 (prevents API loop on login page)
            return new Response(JSON.stringify({ error: 'No token' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...rest,
        headers,
        credentials: 'include', // always include cookies for refresh_token
    });

    // On 401 from server — try to refresh once, then retry the original request
    if (response.status === 401 && !skipAuth && !_isRetry) {
        const refreshed = await doRefresh();
        if (refreshed) {
            // Retry original request with new token
            return apiFetch(path, { ...options, _isRetry: true });
        }
        // Refresh failed — force logout
        try { localStorage.removeItem('auth-storage'); } catch { }
    }

    return response;
}

/**
 * Convenience: makes an authenticated GET and returns parsed JSON
 */
export async function apiGet<T = unknown>(path: string): Promise<T> {
    const res = await apiFetch(path);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `GET ${path} failed: ${res.status}`);
    }
    return res.json() as Promise<T>;
}

/**
 * Convenience: makes an authenticated POST/PUT/PATCH/DELETE with JSON body
 */
export async function apiJson<T = unknown>(
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown
): Promise<T> {
    const res = await apiFetch(path, {
        method,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `${method} ${path} failed: ${res.status}`);
    }
    return res.json() as Promise<T>;
}
