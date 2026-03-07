// Session Management & Auto Logout for Phase 15

import { useAuthStore } from '@/store/authStore';

export class SessionManager {
    private static instance: SessionManager;
    private inactivityTimer: number | null = null;
    private readonly TIMEOUT_MINUTES = 30; // 30 minutes inactivity
    private readonly CHECK_INTERVAL = 60000; // Check every minute

    private constructor() {
        this.startMonitoring();
    }

    static getInstance(): SessionManager {
        if (!SessionManager.instance) {
            SessionManager.instance = new SessionManager();
        }
        return SessionManager.instance;
    }

    /**
     * Start session monitoring
     */
    startMonitoring() {
        // Monitor user activity
        if (typeof window !== 'undefined') {
            const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
            events.forEach(event => {
                window.addEventListener(event, () => this.resetInactivityTimer(), { passive: true });
            });
        }

        // Check session expiry
        setInterval(() => {
            this.checkForExpiredSession();
        }, this.CHECK_INTERVAL);
    }

    /**
     * Reset inactivity timer
     */
    private resetInactivityTimer() {
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
        }

        const user = useAuthStore.getState().user;
        if (!user) return;

        // Set new timeout
        this.inactivityTimer = setTimeout(() => {
            this.handleInactivity();
        }, this.TIMEOUT_MINUTES * 60 * 1000);
    }

    /**
     * Handle user inactivity
     */
    private handleInactivity() {
        const user = useAuthStore.getState().user;
        if (!user) return;

        // Logout user
        useAuthStore.getState().logout();

        // Show toast via global event that DialogProvider listens to
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('session-expired', {
                detail: { message: 'Your session has expired due to inactivity. Please login again.' }
            }));
        }
    }

    /**
     * Check if current session is expired
     */
    private checkForExpiredSession() {
        // Backend tokens handle true expiry, this is just a fallback interval
    }

}

// Auto-initialize
if (typeof window !== 'undefined') {
    SessionManager.getInstance();
}

export const sessionManager = SessionManager.getInstance();
