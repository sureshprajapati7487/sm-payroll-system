import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Role, Roles } from '@/types';
import { ROLE_PERMISSIONS, PERMISSIONS, PermissionValue } from '@/config/permissions';
import { useMultiCompanyStore } from './multiCompanyStore';
import { apiFetch } from '@/lib/apiClient';

export type DataScope = 'ALL' | 'TEAM' | 'OWN';

type RolePermMap = Record<string, PermissionValue[]>;
type RoleScopeMap = Record<string, DataScope>;

// Internal global cache for O(1) lookups
// Cleared instantly on any permission modification
const permissionCache = new Map<string, boolean>();
const getCacheKey = (role: string, permission: string) => `${role}:${permission}`;
const clearCache = () => permissionCache.clear();

export interface RolePermissionsState {
    permissions: RolePermMap;
    scopes: RoleScopeMap;
    _hydrated: boolean; // true once localStorage data has been loaded

    // Set _hydrated flag (called by onRehydrateStorage)
    _setHydrated: (v: boolean) => void;

    // Directly set the full permissions + scopes map and persist to localStorage
    setPermissions: (permissions: RolePermMap, scopes: RoleScopeMap) => void;

    // Check if a role has a specific permission
    hasPermission: (role: Role, permission: PermissionValue) => boolean;
    getScope: (role: Role) => DataScope;

    // Legacy per-permission toggle (used internally from draft UI)
    togglePermission: (role: Role, permission: PermissionValue) => void;
    setScope: (role: Role, scope: DataScope) => void;

    // Reset to factory defaults
    resetRole: (role: Role) => void;
    resetAll: () => void;

    // For backwards compatibility (used in App.tsx)
    fetchPermissions: (companyId: string) => Promise<void>;
}

export const defaultPermissions = (): RolePermMap => ({
    [Roles.SUPER_ADMIN]: [...Object.values(PERMISSIONS)],
    [Roles.ADMIN]: [...ROLE_PERMISSIONS[Roles.ADMIN]],
    [Roles.ACCOUNT_ADMIN]: [...ROLE_PERMISSIONS[Roles.ACCOUNT_ADMIN]],
    [Roles.MANAGER]: [...ROLE_PERMISSIONS[Roles.MANAGER]],
    [Roles.EMPLOYEE]: [...ROLE_PERMISSIONS[Roles.EMPLOYEE]],
});

export const defaultScopes = (): RoleScopeMap => ({
    [Roles.SUPER_ADMIN]: 'ALL',
    [Roles.ADMIN]: 'ALL',
    [Roles.ACCOUNT_ADMIN]: 'ALL',
    [Roles.MANAGER]: 'TEAM',
    [Roles.EMPLOYEE]: 'OWN',
});

export const useRolePermissionsStore = create<RolePermissionsState>()(
    persist(
        (set, get) => ({
            permissions: defaultPermissions(),
            scopes: defaultScopes(),
            _hydrated: false,

            _setHydrated: (v) => set({ _hydrated: v }),

            // Helper to sync to backend
            _syncToServer: async (permissions: RolePermMap, scopes: RoleScopeMap) => {
                const companyId = useMultiCompanyStore.getState().currentCompanyId;
                if (!companyId) return;
                try {
                    await apiFetch(`/system-settings`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            companyId,
                            key: 'ROLE_PERMISSIONS_V2',
                            value: JSON.stringify({ permissions, scopes })
                        })
                    });
                } catch (error) {
                    console.error('Failed to sync permissions to server:', error);
                }
            },

            // ── Atomic save: replaces everything at once → persisted immediately ──
            setPermissions: (permissions, scopes) => {
                clearCache(); // Invalidate performance cache
                // Lock SUPER_ADMIN
                const safePerms = {
                    ...permissions,
                    [Roles.SUPER_ADMIN]: [...Object.values(PERMISSIONS)],
                };
                const safeScopes = {
                    ...scopes,
                    [Roles.SUPER_ADMIN]: 'ALL' as DataScope,
                };
                set({ permissions: safePerms, scopes: safeScopes });
                (get() as any)._syncToServer(safePerms, safeScopes);
            },

            togglePermission: (role, permission) => {
                if (role === Roles.SUPER_ADMIN) return;
                clearCache(); // Invalidate performance cache
                set((state) => {
                    const current = state.permissions[role] ?? [];
                    const has = current.includes(permission);
                    const newPermissions = {
                        ...state.permissions,
                        [role]: has
                            ? current.filter((p) => p !== permission)
                            : [...current, permission],
                    };
                    return {
                        permissions: newPermissions
                    };
                });
                const state = get();
                (state as any)._syncToServer(state.permissions, state.scopes);
            },

            hasPermission: (role, permission) => {
                const normalizedRole = (role || '').toUpperCase().replace(/ /g, '_') as Role;
                if (normalizedRole === Roles.SUPER_ADMIN) return true;

                const cacheKey = getCacheKey(normalizedRole, permission);
                if (permissionCache.has(cacheKey)) {
                    return permissionCache.get(cacheKey)!;
                }

                const perms = get().permissions[normalizedRole] ?? [];
                // Use Set under the hood for next time if we wanted, but array .includes is cached now
                const result = perms.includes(permission);
                permissionCache.set(cacheKey, result);

                return result;
            },

            setScope: (role, scope) => {
                if (role === Roles.SUPER_ADMIN) return;
                set((state) => {
                    const newScopes = { ...state.scopes, [role]: scope };
                    (get() as any)._syncToServer(state.permissions, newScopes);
                    return { scopes: newScopes };
                });
            },

            getScope: (role) => {
                if (role === Roles.SUPER_ADMIN) return 'ALL';
                return (get().scopes?.[role] as DataScope) ?? 'OWN';
            },

            resetRole: (role) => {
                if (role === Roles.SUPER_ADMIN) return;
                clearCache(); // Invalidate performance cache
                set((state) => {
                    const newPermissions = {
                        ...state.permissions,
                        [role]: [...(ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] ?? [])],
                    };
                    const newScopes = { ...state.scopes, [role]: defaultScopes()[role] };
                    (get() as any)._syncToServer(newPermissions, newScopes);
                    return {
                        permissions: newPermissions,
                        scopes: newScopes,
                    };
                });
            },

            resetAll: () => {
                clearCache(); // Invalidate performance cache
                const perms = defaultPermissions();
                const scps = defaultScopes();
                set({ permissions: perms, scopes: scps });
                (get() as any)._syncToServer(perms, scps);
            },

            // Fetches global permissions from backend so mobile devices sync up
            fetchPermissions: async (companyId: string) => {
                if (!companyId) return;
                try {
                    const res = await apiFetch(`/system-settings?companyId=${companyId}`);
                    if (res.ok) {
                        const data = await res.json();
                        const roleSetting = data.find((s: any) => s.key === 'ROLE_PERMISSIONS_V2');
                        if (roleSetting) {
                            const parsed = JSON.parse(roleSetting.value);
                            if (parsed.permissions && parsed.scopes) {
                                clearCache();
                                set({ permissions: parsed.permissions, scopes: parsed.scopes });
                            }
                        }
                    }
                } catch (error) {
                    console.error('Failed to fetch permissions from server:', error);
                }
            },
        }),
        {
            name: 'role-permissions-v2', // New key clears any stale/broken old cache
            storage: createJSONStorage(() => localStorage),
            onRehydrateStorage: () => (state) => {
                // Called when localStorage data has finished loading into the store
                if (state) {
                    state._setHydrated(true);
                    clearCache(); // clear cache on rehydrate to ensure fresh evaluation
                }
            },
        }
    )
);
