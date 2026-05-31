/** Returns an Authorization header object for use in fetch() calls.
 *  If localStorage is corrupted or the token is missing, clears auth state
 *  and redirects to login rather than silently sending unauthenticated requests.
 */
export function authHeader(): Record<string, string> {
    try {
        const raw = localStorage.getItem('auth-storage');
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        const token = parsed?.state?.token ?? null;
        if (token && typeof token === 'string') return { Authorization: `Bearer ${token}` };
        return {};
    } catch (e) {
        // Corrupted localStorage — clear and emit a custom event so the app can handle logout/redirect
        console.error('[authHeader] Corrupted auth token in localStorage — clearing session.', e);
        try {
            localStorage.removeItem('auth-storage');
            // Custom event handled by the auth provider to redirect to /login
            window.dispatchEvent(new CustomEvent('sm:auth:corrupted'));
        } catch { /* localStorage or window unavailable (SSR/test) */ }
        return {};
    }
}
