export class SessionManager {
    private static instance: SessionManager;
    private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
    
    private constructor() {
        this.setupActivityListeners();
        this.startInactivityTimer();
    }

    public static getInstance(): SessionManager {
        if (!SessionManager.instance) {
            SessionManager.instance = new SessionManager();
            if (typeof document !== 'undefined') {
                SessionManager.instance.initialize();
            }
        }
        return SessionManager.instance;
    }

    private initialize() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.checkSessionStatus();
            }
        });

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data.type === 'SYNC_COMPLETED') {
                    this.resetInactivityTimer();
                }
            });
        }
    }

    private setupActivityListeners() {
        if (typeof window === 'undefined') return;
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
        let throttleTimer: ReturnType<typeof setTimeout> | null = null;

        const handleActivity = () => {
            if (throttleTimer) return;
            this.resetInactivityTimer();
            throttleTimer = setTimeout(() => { throttleTimer = null; }, 5000);
        };

        events.forEach(event => {
            window.addEventListener(event, handleActivity, { passive: true });
        });
    }

    private startInactivityTimer() {
        if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
        this.inactivityTimer = setTimeout(() => { this.handleTimeout(); }, 30 * 60 * 1000);
    }

    public resetInactivityTimer() {
        this.startInactivityTimer();
    }

    private async checkSessionStatus() {
        // Assume OK if active, real check happens in hooks
    }

    private handleTimeout() {
        window.dispatchEvent(new CustomEvent('session-timeout'));
    }

    public destroy() {
        if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    }
}
