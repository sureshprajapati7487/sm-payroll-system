// Push Notification Service
class PushNotificationService {
    private static instance: PushNotificationService;
    private registration: ServiceWorkerRegistration | null = null;
    private permission: NotificationPermission = 'default';

    private constructor() {
        this.init();
    }

    static getInstance(): PushNotificationService {
        if (!PushNotificationService.instance) {
            PushNotificationService.instance = new PushNotificationService();
        }
        return PushNotificationService.instance;
    }

    private async init() {
        if ('serviceWorker' in navigator && 'Notification' in window) {
            this.permission = Notification.permission;

            try {
                this.registration = await navigator.serviceWorker.ready;
            } catch (error) {
                console.error('Service Worker not ready:', error);
            }
        }
    }

    async requestPermission(): Promise<boolean> {
        if (!('Notification' in window)) {
            console.warn('This browser does not support notifications');
            return false;
        }

        const permission = await Notification.requestPermission();
        this.permission = permission;
        return permission === 'granted';
    }

    hasPermission(): boolean {
        return this.permission === 'granted';
    }

    async sendNotification(title: string, options?: NotificationOptions) {
        if (!this.hasPermission()) {
            console.warn('Notification permission not granted');
            return;
        }

        if (this.registration) {
            await this.registration.showNotification(title, {
                icon: '/icon-192x192.png',
                badge: '/icon-192x192.png',
                ...options
            });
        } else {
            new Notification(title, options);
        }
    }

    // Shift Start Reminder
    scheduleShiftReminder(shiftTime: string, _employeeName: string) {
        const shiftDate = new Date(shiftTime);
        const reminderTime = new Date(shiftDate.getTime() - 30 * 60 * 1000); // 30 min before
        const now = new Date();

        if (reminderTime > now) {
            const timeout = reminderTime.getTime() - now.getTime();
            setTimeout(() => {
                this.sendNotification('Shift Starting Soon! 🕐', {
                    body: `Your shift starts in 30 minutes.`,
                    tag: 'shift-reminder',
                    requireInteraction: true
                });
            }, timeout);
        }
    }

    // Late Warning Alert
    sendLateWarning(_employeeName: string, minutesLate: number) {
        this.sendNotification('Running Late? ⏰', {
            body: `You're ${minutesLate} minutes late. Please check in ASAP.`,
            tag: 'late-warning',
            requireInteraction: true
        });
    }

    // Payslip Ready Notification
    sendPayslipReady(month: string) {
        this.sendNotification('Payslip Ready! 💰', {
            body: `Your ${month} payslip is now available.`,
            tag: 'payslip-ready'
        });
    }

    // Generic Notification
    send(title: string, body: string, tag?: string) {
        this.sendNotification(title, { body, tag });
    }
}

export const pushNotificationService = PushNotificationService.getInstance();
