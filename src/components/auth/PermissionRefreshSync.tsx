/**
 * PermissionRefreshSync.tsx
 *
 * ✅ Improvements:
 * 1. Login ke saath TURANT server se permissions fetch karo (stale localStorage se nahi)
 * 2. Polling 60s → 15s (faster cross-device sync)
 * 3. Agar server pe ROLE_PERMISSIONS_V2 nahi hai, toh current state push karo (first admin session)
 * 4. Visibility change pe bhi fetch karo (app foreground pe aate hi)
 * 5. Admin/Super Admin ne kuch change kiya → baaki devices 15s mein sync hote hain
 */

import { useEffect, useRef } from 'react';
import { useDialog } from '@/components/DialogProvider';
import { useRolePermissionsStore } from '@/store/rolePermissionsStore';
import { useAuthStore } from '@/store/authStore';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';
import { apiFetch } from '@/lib/apiClient';
import { Roles } from '@/types';

const POLL_INTERVAL_MS = 15_000; // 15 seconds (was 60s)

export const PermissionRefreshSync = () => {
    const { toast } = useDialog();
    const { user } = useAuthStore();
    const { currentCompanyId } = useMultiCompanyStore();
    const { permissions, scopes, fetchPermissions, setPermissions, _hydrated } = useRolePermissionsStore();

    const userRole = user?.role;
    const initialSignature = useRef<string | null>(null);
    const isReloading = useRef(false);
    const hasFetchedOnLogin = useRef(false); // Login ke baad ek baar hi fetch karo

    // ── Helper: current role's permission signature ──────────────────────────
    const getSignature = () => {
        if (!userRole) return '';
        return JSON.stringify({
            perms: permissions[userRole] || [],
            scope: scopes[userRole] || 'OWN',
        });
    };

    // ── 1. IMMEDIATE fetch on login — server se fresh data lo, localStorage nahi ──
    useEffect(() => {
        if (!user || !currentCompanyId || !_hydrated || hasFetchedOnLogin.current) return;

        hasFetchedOnLogin.current = true;

        const loginSync = async () => {
            try {
                // Server se fetch karo
                const res = await apiFetch(`/system-settings?companyId=${currentCompanyId}`);
                if (!res.ok) return;

                const data = await res.json();
                const roleSetting = data.find((s: any) => s.key === 'ROLE_PERMISSIONS_V2');

                if (roleSetting?.value) {
                    // Server pe data hai → load it (overwrite localStorage)
                    const parsed = JSON.parse(roleSetting.value);
                    if (parsed.permissions && parsed.scopes) {
                        setPermissions(parsed.permissions, parsed.scopes);
                        // Snapshot AFTER loading fresh server data
                        setTimeout(() => {
                            initialSignature.current = getSignature();
                        }, 200);
                    }
                } else {
                    // Server pe koi data NAHI — agar Super Admin hai toh current defaults push karo
                    // Taaki baaki devices bhi sync ho sakein
                    if (userRole === Roles.SUPER_ADMIN || userRole === Roles.ADMIN) {
                        console.log('[PermSync] No server permissions found — pushing defaults to server...');
                        setPermissions(permissions, scopes); // This calls _syncToServer internally
                    }
                    initialSignature.current = getSignature();
                }
            } catch (e) {
                console.warn('[PermSync] Login sync failed:', e);
                initialSignature.current = getSignature();
            }
        };

        loginSync();
    }, [user, currentCompanyId, _hydrated]);

    // ── 2. Snapshot initial signature ONCE (fallback if loginSync runs before hydration) ──
    useEffect(() => {
        if (!initialSignature.current && _hydrated && userRole) {
            initialSignature.current = getSignature();
        }
    }, [_hydrated, userRole]);

    // ── 3. Detect permission CHANGE → toast + auto reload ────────────────────
    useEffect(() => {
        if (!userRole || !initialSignature.current || isReloading.current) return;

        const currentSignature = getSignature();
        if (currentSignature !== initialSignature.current) {
            isReloading.current = true;
            toast('Your permissions were updated by an Admin. Reloading session...', 'warning');
            setTimeout(() => {
                window.location.reload();
            }, 2500); // 2.5s (was 3s)
        }
    }, [permissions, scopes, userRole, toast]);

    // ── 4. Polling every 15s + visibility change ─────────────────────────────
    useEffect(() => {
        if (!user || !currentCompanyId) return;

        // Immediate poll when effect runs
        fetchPermissions(currentCompanyId);

        // Recurring poll every 15s
        const intervalId = setInterval(() => {
            fetchPermissions(currentCompanyId);
        }, POLL_INTERVAL_MS);

        // Re-fetch when app comes back to foreground
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
