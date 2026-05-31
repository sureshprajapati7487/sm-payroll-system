/** Returns an Authorization header object for use in fetch() calls. */
export function authHeader(): Record<string, string> {
    try {
        const raw = localStorage.getItem('auth-storage');
        const token = raw ? JSON.parse(raw)?.state?.token : null;
        if (token) return { Authorization: `Bearer ${token}` };
    } catch {}
    return {};
}
