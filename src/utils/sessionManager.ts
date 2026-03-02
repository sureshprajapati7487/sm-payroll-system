// Session Management & Auto Logout for Phase 15

import { useAuditStore } from '@/store/auditStore';
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
            useAuditStore.getState().checkSessionExpiry();
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

        // Update last activity
        const session = useAuditStore.getState().getActiveSession(user.id);
        if (session) {
            useAuditStore.getState().updateSessionActivity(session.sessionId);
        }

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

        console.log('⏰ Session expired due to inactivity');

        // Log the auto-logout
        useAuditStore.getState().addLog({
            userId: user.id,
            userName: user.name,
            userRole: user.role,
            action: 'LOGOUT',
            entityType: 'USER',
            details: { reason: 'AUTO_LOGOUT_INACTIVITY' },
            ipAddress: this.getIPAddress(),
            userAgent: navigator.userAgent,
            status: 'SUCCESS'
        });

        // End session
        const session = useAuditStore.getState().getActiveSession(user.id);
        if (session) {
            useAuditStore.getState().endSession(session.sessionId);
        }

        // Logout user
        useAuthStore.getState().logout();

        // Show alert
        if (typeof window !== 'undefined') {
            alert('Your session has expired due to inactivity. Please login again.');
            window.location.href = '/';
        }
    }

    /**
     * Check if current session is expired
     */
    private checkForExpiredSession() {
        const user = useAuthStore.getState().user;
        if (!user) return;

        const session = useAuditStore.getState().getActiveSession(user.id);
        if (!session) return;

        if (!session.isActive) {
            console.log('⏰ Session no longer active');
            useAuthStore.getState().logout();
            if (typeof window !== 'undefined') {
                alert('Your session has expired. Please login again.');
                window.location.href = '/';
            }
        }
    }

    /**
     * Get user's IP address (client-side approximation)
     */
    private getIPAddress(): string {
        // In real app, fetch from backend
        return 'CLIENT_IP';
    }

    /**
     * Create new session on login
     */
    static createSession(userId: string) {
        const ipAddress = 'CLIENT_IP'; // In real app, get from server
        const userAgent = navigator.userAgent;

        return useAuditStore.getState().createSession(userId, ipAddress, userAgent);
    }

    /**
     * End session on logout
     */
    static endSession(userId: string) {
        const session = useAuditStore.getState().getActiveSession(userId);
        if (session) {
            useAuditStore.getState().endSession(session.sessionId);
        }
    }
}

// Auto-initialize
if (typeof window !== 'undefined') {
    SessionManager.getInstance();
}

export const sessionManager = SessionManager.getInstance();
