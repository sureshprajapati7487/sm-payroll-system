import { useEffect, useRef } from 'react';
import { useDialog } from '@/components/DialogProvider';
import { useRolePermissionsStore } from '@/store/rolePermissionsStore';
import { useAuthStore } from '@/store/authStore';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';

export const PermissionRefreshSync = () => {
    const { toast } = useDialog();
    const { user } = useAuthStore();
    const { currentCompanyId } = useMultiCompanyStore();
    const { permissions, scopes, fetchPermissions, _hydrated } = useRolePermissionsStore();

    const userRole = user?.role;

    // Extract only the current user's permissions to avoid reloading everyone when ANY role changes.
    const getSignature = () => {
        if (!userRole) return '';
        return JSON.stringify({
            perms: permissions[userRole] || [],
            scope: scopes[userRole] || 'OWN'
        });
    };

    const initialSignature = useRef<string | null>(null);
    const isReloading = useRef(false);

    // 1. Snapshot the initial signature ONCE per session after hydration
    useEffect(() => {
        if (!initialSignature.current && _hydrated && userRole) {
            initialSignature.current = getSignature();
        }
    }, [_hydrated, userRole]);

    // 2. Diff and Trigger Reload
    useEffect(() => {
        if (!userRole || !initialSignature.current || isReloading.current) return;

        const currentSignature = getSignature();

        if (currentSignature !== initialSignature.current) {
            isReloading.current = true;
            toast('Your permissions were updated by an Admin. Reloading session...', 'warning');

            setTimeout(() => {
                window.location.reload();
            }, 3000);
        }
    }, [permissions, scopes, userRole, toast]);

    // 3. Network Sync Polling (cross-device mobile syncing)
    useEffect(() => {
        if (!user || !currentCompanyId) return;

        // Fetch from backend every 60 seconds
        const intervalId = setInterval(() => {
            fetchPermissions(currentCompanyId);
        }, 60000);

        // Also add visibility listener to fetch immediately when app comes to foreground
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchPermissions(currentCompanyId);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [user, currentCompanyId, fetchPermissions]);

    return null; // Headless component
};
