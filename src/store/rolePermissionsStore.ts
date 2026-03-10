import { create } from 'zustand';
import { Role, Roles } from '@/types';
import { ROLE_PERMISSIONS, PERMISSIONS, PermissionValue } from '@/config/permissions';
import { apiFetch } from '@/lib/apiClient';
import { useMultiCompanyStore } from './multiCompanyStore';

export type DataScope = 'ALL' | 'TEAM' | 'OWN';

// A map of role -> list of permissions
type RolePermMap = Record<string, PermissionValue[]>;
// A map of role -> data visibility scope
type RoleScopeMap = Record<string, DataScope>;

interface RolePermissionsState {
    permissions: RolePermMap;
    scopes: RoleScopeMap;
    isLoaded: boolean; // true once fetched from DB

    // Load from backend DB (call once on app start)
    fetchPermissions: (companyId: string) => Promise<void>;
    // Directly set the full permission map (used by Save button in UI)
    setPermissions: (permissions: RolePermMap, scopes: RoleScopeMap) => Promise<void>;

    // Check if a role has a specific permission (used by authStore)
    hasPermission: (role: Role, permission: PermissionValue) => boolean;
    // Get the data visibility scope for a role
    getScope: (role: Role) => DataScope;

    // Reset a specific role to the factory defaults (and persist)
    resetRole: (role: Role) => Promise<void>;
    // Reset ALL roles to factory defaults (and persist)
    resetAll: () => Promise<void>;

    // Legacy toggles (used internally from UI via draft state)
    togglePermission: (role: Role, permission: PermissionValue) => void;
    setScope: (role: Role, scope: DataScope) => void;
}

// Deep clone the default permissions
export const defaultPermissions = (): RolePermMap => ({
    [Roles.SUPER_ADMIN]: [...Object.values(PERMISSIONS)],
    [Roles.ADMIN]: [...ROLE_PERMISSIONS[Roles.ADMIN]],
    [Roles.ACCOUNT_ADMIN]: [...ROLE_PERMISSIONS[Roles.ACCOUNT_ADMIN]],
    [Roles.MANAGER]: [...ROLE_PERMISSIONS[Roles.MANAGER]],
    [Roles.EMPLOYEE]: [...ROLE_PERMISSIONS[Roles.EMPLOYEE]],
});

// Default scopes based on standard hierarchy
export const defaultScopes = (): RoleScopeMap => ({
    [Roles.SUPER_ADMIN]: 'ALL',
    [Roles.ADMIN]: 'ALL',
    [Roles.ACCOUNT_ADMIN]: 'ALL',
    [Roles.MANAGER]: 'TEAM',
    [Roles.EMPLOYEE]: 'OWN',
});

const DB_KEY = 'ROLE_PERMISSIONS_CONFIG';

// Save the current permissions+scopes to backend DB
async function saveToDb(permissions: RolePermMap, scopes: RoleScopeMap): Promise<void> {
    const currentCompanyId = useMultiCompanyStore.getState().currentCompanyId;
    if (!currentCompanyId) return;
    try {
        await apiFetch('/system-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                companyId: currentCompanyId,
                key: DB_KEY,
                value: JSON.stringify({ permissions, scopes }),
            }),
        });
    } catch (err) {
        console.error('[RolePermissions] Failed to save to DB:', err);
    }
}

export const useRolePermissionsStore = create<RolePermissionsState>((set, get) => ({
    permissions: defaultPermissions(),
    scopes: defaultScopes(),
    isLoaded: false,

    // ── Fetch from DB ─────────────────────────────────────────────────────────
    fetchPermissions: async (companyId) => {
        if (!companyId) return;
        try {
            const res = await apiFetch(`/system-settings?companyId=${companyId}`);
            if (!res.ok) return;
            const data: { key: string; value: string }[] = await res.json();
            const entry = data.find((d) => d.key === DB_KEY);
            if (entry) {
                const parsed = JSON.parse(entry.value);

                // Merge saved data with current defaults so new permissions added
                // in code are always available, even if they weren't in the DB yet.
                const mergedPerms: RolePermMap = defaultPermissions();
                if (parsed.permissions) {
                    Object.keys(mergedPerms).forEach((role) => {
                        if (parsed.permissions[role]) {
                            mergedPerms[role] = parsed.permissions[role] as PermissionValue[];
                        }
                    });
                }
                const mergedScopes: RoleScopeMap = defaultScopes();
                if (parsed.scopes) {
                    Object.keys(mergedScopes).forEach((role) => {
                        if (parsed.scopes[role]) {
                            mergedScopes[role] = parsed.scopes[role] as DataScope;
                        }
                    });
                }
                // SUPER_ADMIN is always locked to all permissions
                mergedPerms[Roles.SUPER_ADMIN] = [...Object.values(PERMISSIONS)];
                mergedScopes[Roles.SUPER_ADMIN] = 'ALL';

                set({ permissions: mergedPerms, scopes: mergedScopes, isLoaded: true });
            } else {
                // No saved config in DB yet — use defaults, mark as loaded
                set({ isLoaded: true });
            }
        } catch (err) {
            console.error('[RolePermissions] Failed to fetch from DB:', err);
            set({ isLoaded: true }); // still mark loaded so UI doesn't block
        }
    },

    // ── Save full config to DB (called by Save button) ────────────────────────
    setPermissions: async (permissions, scopes) => {
        // SUPER_ADMIN is always locked
        const safePerms = {
            ...permissions,
            [Roles.SUPER_ADMIN]: [...Object.values(PERMISSIONS)],
        };
        const safeScopes = {
            ...scopes,
            [Roles.SUPER_ADMIN]: 'ALL' as DataScope,
        };
        set({ permissions: safePerms, scopes: safeScopes });
        await saveToDb(safePerms, safeScopes);
    },

    // ── Legacy in-memory toggle (used by draft system in UI) ─────────────────
    togglePermission: (role, permission) => {
        if (role === Roles.SUPER_ADMIN) return;
        set((state) => {
            const current = state.permissions[role] ?? [];
            const has = current.includes(permission);
            return {
                permissions: {
                    ...state.permissions,
                    [role]: has
                        ? current.filter((p) => p !== permission)
                        : [...current, permission],
                },
            };
        });
    },

    setScope: (role, scope) => {
        if (role === Roles.SUPER_ADMIN) return;
        set((state) => ({
            scopes: { ...state.scopes, [role]: scope },
        }));
    },

    // ── hasPermission ─────────────────────────────────────────────────────────
    hasPermission: (role, permission) => {
        const normalizedRole = (role || '').toUpperCase().replace(/ /g, '_') as Role;
        if (normalizedRole === Roles.SUPER_ADMIN) return true;
        const perms = get().permissions[normalizedRole] ?? [];
        return perms.includes(permission);
    },

    getScope: (role) => {
        if (role === Roles.SUPER_ADMIN) return 'ALL';
        return (get().scopes?.[role] as DataScope) ?? 'OWN';
    },

    // ── Reset role to defaults and persist ────────────────────────────────────
    resetRole: async (role) => {
        if (role === Roles.SUPER_ADMIN) return;
        const state = get();
        const newPerms = {
            ...state.permissions,
            [role]: [...(ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] ?? [])],
        };
        const newScopes = {
            ...state.scopes,
            [role]: defaultScopes()[role],
        };
        set({ permissions: newPerms, scopes: newScopes });
        await saveToDb(newPerms, newScopes);
    },

    resetAll: async () => {
        const perms = defaultPermissions();
        const scopes = defaultScopes();
        set({ permissions: perms, scopes });
        await saveToDb(perms, scopes);
    },
}));
