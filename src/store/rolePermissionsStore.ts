import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Role, Roles } from '@/types';
import { ROLE_PERMISSIONS, PERMISSIONS, PermissionValue } from '@/config/permissions';

// A map of role -> list of permissions
type RolePermMap = Record<Role, PermissionValue[]>;

interface RolePermissionsState {
    permissions: RolePermMap;
    // Toggle a single permission for a role (SUPER_ADMIN is always locked)
    togglePermission: (role: Role, permission: PermissionValue) => void;
    // Check if a role has a specific permission (used by authStore)
    hasPermission: (role: Role, permission: PermissionValue) => boolean;
    // Reset a specific role to the factory defaults
    resetRole: (role: Role) => void;
    // Reset ALL roles to factory defaults
    resetAll: () => void;
}

// Deep clone the defaults so the store doesn't mutate the original
const defaultPermissions = (): RolePermMap => ({
    [Roles.SUPER_ADMIN]: [...Object.values(PERMISSIONS)],
    [Roles.ADMIN]: [...ROLE_PERMISSIONS[Roles.ADMIN]],
    [Roles.ACCOUNT_ADMIN]: [...ROLE_PERMISSIONS[Roles.ACCOUNT_ADMIN]],
    [Roles.MANAGER]: [...ROLE_PERMISSIONS[Roles.MANAGER]],
    [Roles.EMPLOYEE]: [...ROLE_PERMISSIONS[Roles.EMPLOYEE]],
});

export const useRolePermissionsStore = create<RolePermissionsState>()(
    persist(
        (set, get) => ({
            permissions: defaultPermissions(),

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
                // SUPER_ADMIN always has everything
                if (role === Roles.SUPER_ADMIN) return true;
                const perms = get().permissions[role] ?? [];
                return perms.includes(permission);
            },

            resetRole: (role) => {
                if (role === Roles.SUPER_ADMIN) return;
                set((state) => ({
                    permissions: {
                        ...state.permissions,
                        [role]: [...(ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] ?? [])],
                    },
                }));
            },

            resetAll: () => {
                set({ permissions: defaultPermissions() });
            },
        }),
        {
            name: 'role-permissions-config',
        }
    )
);
