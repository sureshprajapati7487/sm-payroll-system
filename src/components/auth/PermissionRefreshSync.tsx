import { useEffect, useRef } from 'react';
import { useDialog } from '@/components/DialogProvider';
import { useRolePermissionsStore } from '@/store/rolePermissionsStore';
import { useAuthStore } from '@/store/authStore';

export const PermissionRefreshSync = () => {
    const { toast } = useDialog();
    const { user } = useAuthStore();
    const { permissions, scopes } = useRolePermissionsStore();

    // Store the initial signature of the store to detect diffs
    const initialSignature = useRef(JSON.stringify({ permissions, scopes }));
    const isReloading = useRef(false);

    useEffect(() => {
        if (!user) return; // Don't trigger if user is not logged in

        const triggerReload = () => {
            if (isReloading.current) return;
            isReloading.current = true;

            toast('Your permissions were updated by an Admin. Reloading session...', 'warning');

            setTimeout(() => {
                window.location.reload();
            }, 3000);
        };

        // 1. Storage Event Listener (Instantly fires across tabs)
        const handleStorage = (e: StorageEvent) => {
            if (e.key === 'role-permissions-v2') {
                if (!e.newValue) return;
                try {
                    const nextState = JSON.parse(e.newValue).state;
                    const nextSignature = JSON.stringify({
                        permissions: nextState.permissions,
                        scopes: nextState.scopes
                    });

                    if (nextSignature !== initialSignature.current) {
                        triggerReload();
                    }
                } catch (err) {
                    console.error('Failed to parse storage event for permission sync', err);
                }
            }
        };

        window.addEventListener('storage', handleStorage);

        // 2. Fallback Polling (Every 60s)
        const intervalId = setInterval(() => {
            const raw = localStorage.getItem('role-permissions-v2');
            if (raw) {
                try {
                    const parsed = JSON.parse(raw).state;
                    const currentSignature = JSON.stringify({
                        permissions: parsed.permissions,
                        scopes: parsed.scopes
                    });

                    if (currentSignature !== initialSignature.current) {
                        triggerReload();
                    }
                } catch {
                    // Ignore JSON parse errors here
                }
            }
        }, 60000);

        return () => {
            window.removeEventListener('storage', handleStorage);
            clearInterval(intervalId);
        };
    }, [user, toast]);

    return null; // Headless component, renders no UI
};
