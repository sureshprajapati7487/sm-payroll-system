import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Role, Roles } from '@/types';
import { ROLE_PERMISSIONS, PERMISSIONS, PermissionValue } from '@/config/permissions';

export type DataScope = 'ALL' | 'TEAM' | 'OWN';

// A map of role -> list of permissions
type RolePermMap = Record<Role, PermissionValue[]>;
// A map of role -> data visibility scope
type RoleScopeMap = Record<Role, DataScope>;

interface RolePermissionsState {
    permissions: RolePermMap;
    scopes: RoleScopeMap;

    // Toggle a single permission for a role (SUPER_ADMIN is always locked)
    togglePermission: (role: Role, permission: PermissionValue) => void;
    // Check if a role has a specific permission (used by authStore)
    hasPermission: (role: Role, permission: PermissionValue) => boolean;

    // Set the data visibility scope for a role
    setScope: (role: Role, scope: DataScope) => void;
    // Get the data visibility scope for a role
    getScope: (role: Role) => DataScope;

    // Reset a specific role to the factory defaults
    resetRole: (role: Role) => void;
    // Reset ALL roles to factory defaults
    resetAll: () => void;
}

// Deep clone the default permissions
const defaultPermissions = (): RolePermMap => ({
    [Roles.SUPER_ADMIN]: [...Object.values(PERMISSIONS)],
    [Roles.ADMIN]: [...ROLE_PERMISSIONS[Roles.ADMIN]],
    [Roles.ACCOUNT_ADMIN]: [...ROLE_PERMISSIONS[Roles.ACCOUNT_ADMIN]],
    [Roles.MANAGER]: [...ROLE_PERMISSIONS[Roles.MANAGER]],
    [Roles.EMPLOYEE]: [...ROLE_PERMISSIONS[Roles.EMPLOYEE]],
});

// Default scopes based on standard hierarchy
const defaultScopes = (): RoleScopeMap => ({
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

            togglePermission: (role, permission) => {
                // Super Admin always gets everything — cannot be changed
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

            hasPermission: (role, permission) => {
                // Normalize role string (backend might send space instead of underscore)
                const normalizedRole = (role || '').toUpperCase().replace(/ /g, '_') as Role;
                // SUPER_ADMIN always has everything
                if (normalizedRole === Roles.SUPER_ADMIN) return true;
                const perms = get().permissions[normalizedRole] ?? [];
                return perms.includes(permission);
            },

            setScope: (role, scope) => {
                // Super Admin must always see ALL
                if (role === Roles.SUPER_ADMIN) return;
                set((state) => ({
                    scopes: { ...state.scopes, [role]: scope },
                }));
            },

            getScope: (role) => {
                if (role === Roles.SUPER_ADMIN) return 'ALL';
                // Fallback to OWN if somehow missing
                return get().scopes?.[role] ?? 'OWN';
            },

            resetRole: (role) => {
                if (role === Roles.SUPER_ADMIN) return;
                set((state) => ({
                    permissions: {
                        ...state.permissions,
                        [role]: [...(ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] ?? [])],
                    },
                    scopes: {
                        ...state.scopes,
                        [role]: defaultScopes()[role],
                    }
                }));
            },

            resetAll: () => {
                set({
                    permissions: defaultPermissions(),
                    scopes: defaultScopes()
                });
            },
        }),
        {
            name: 'role-permissions-config',
            version: 1, // Bump version to clear old cache so new granular permissions apply
        }
    )
);
