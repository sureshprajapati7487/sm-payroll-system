/**
 * Browser Notification Service
 * Handles browser push notifications using the Notifications API
 */

export interface NotificationOptions {
    title: string;
    body: string;
    icon?: string;
    tag?: string;
    data?: any;
    requireInteraction?: boolean;
}

class NotificationService {
    private static instance: NotificationService;
    private permission: NotificationPermission = 'default';

    private constructor() {
        if ('Notification' in window) {
            this.permission = Notification.permission;
        }
    }

    public static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    /**
     * Check if browser supports notifications
     */
    public isSupported(): boolean {
        return 'Notification' in window;
    }

    /**
     * Request notification permission from user
     */
    public async requestPermission(): Promise<NotificationPermission> {
        if (!this.isSupported()) {
            console.warn('Browser does not support notifications');
            return 'denied';
        }

        if (this.permission === 'granted') {
            return 'granted';
        }

        try {
            const permission = await Notification.requestPermission();
            this.permission = permission;
            return permission;
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            return 'denied';
        }
    }

    /**
     * Send a browser notification
     */
    public async sendNotification(options: NotificationOptions): Promise<Notification | null> {
        if (!this.isSupported()) {
            console.warn('Browser does not support notifications');
            return null;
        }

        // Request permission if not already granted
        if (this.permission !== 'granted') {
            const permission = await this.requestPermission();
            if (permission !== 'granted') {
                console.warn('Notification permission denied');
                return null;
            }
        }

        try {
            const notification = new Notification(options.title, {
                body: options.body,
                icon: options.icon || '/logo.svg',
                tag: options.tag,
                data: options.data,
                requireInteraction: options.requireInteraction ?? true, // Keep notification visible
                badge: '/logo.svg',
            });

            // Handle notification click
            notification.onclick = () => {
                window.focus();
                notification.close();

                // If there's custom data, we can use it to navigate
                if (options.data?.loanId) {
                    // The modal will handle this via the notification store
                    console.log('Notification clicked for loan:', options.data.loanId);
                }
            };

            return notification;
        } catch (error) {
            console.error('Error sending notification:', error);
            return null;
        }
    }

    /**
     * Get current permission status
     */
    public getPermission(): NotificationPermission {
        return this.permission;
    }

    /**
     * Check if permission is granted
     */
    public isPermissionGranted(): boolean {
        return this.permission === 'granted';
    }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();

// Helper function to send loan approval notification
export const sendLoanApprovalNotification = async (
    employeeName: string,
    amount: number,
    loanId: string
) => {
    await notificationService.sendNotification({
        title: '🔔 New Loan Approval Request',
        body: `${employeeName} has requested a loan of ₹${amount.toLocaleString('en-IN')}`,
        tag: `loan-${loanId}`,
        data: { loanId, type: 'loan-approval' },
        requireInteraction: true,
    });
};
