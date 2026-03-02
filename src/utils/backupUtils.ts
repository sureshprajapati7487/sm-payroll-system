import { saveAs } from 'file-saver';

const STORAGE_KEYS = [
    'employee-storage',
    'auth-storage',
    'attendance-storage',
    'payroll-storage',
    'loan-storage',
    'expense-storage',
    'leave-storage',
    'notification-storage',
    'settings-storage'
];

export const generateBackup = () => {
    const backup: Record<string, any> = {
        metadata: {
            version: '1.0',
            timestamp: new Date().toISOString(),
            appName: 'SM_PAYROLL_SYSTEM'
        },
        data: {}
    };

    STORAGE_KEYS.forEach(key => {
        const raw = localStorage.getItem(key);
        if (raw) {
            try {
                backup.data[key] = JSON.parse(raw);
            } catch (e) {
                console.warn(`Failed to parse ${key}`, e);
                backup.data[key] = null;
            }
        }
    });

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const filename = `sm_payroll_backup_${new Date().toISOString().split('T')[0]}.json`;
    saveAs(blob, filename);
    return true;
};

export const restoreBackup = async (file: File): Promise<{ success: boolean; message: string }> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const backup = JSON.parse(content);

                if (backup.metadata?.appName !== 'SM_PAYROLL_SYSTEM') {
                    resolve({ success: false, message: 'Invalid backup file' });
                    return;
                }

                // Restore keys
                Object.entries(backup.data).forEach(([key, value]) => {
                    if (STORAGE_KEYS.includes(key) && value) {
                        // Zustand persist expects stringified JSON wrapped sometimes or just the object?
                        // LocalStorage stores strings.
                        // We parsed it for JSON, now stringify back.
                        localStorage.setItem(key, JSON.stringify(value));
                    }
                });

                resolve({ success: true, message: 'Backup restored successfully! Reloading...' });
            } catch (error) {
                resolve({ success: false, message: 'Error parsing backup file' });
            }
        };
        reader.readAsText(file);
    });
};
