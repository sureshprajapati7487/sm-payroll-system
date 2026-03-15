import { useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRolePermissionsStore } from '@/store/rolePermissionsStore';
import { PermissionValue } from '@/config/permissions';

/**
 * A hook for optimal permission checks inside React components.
 * It uses the global O(1) cache inside `rolePermissionsStore` and ensures
 * that unnecessary re-renders are prevented by memoizing the result.
 */
export const usePermission = (permission: PermissionValue): boolean => {
    // We subscribe to the user role to re-evaluate if the user logs in/out or is impersonated
    const role = useAuthStore(s => s.impersonatedRole || s.user?.role);

    // We subscribe strictly to the permissions object length/reference 
    // to know when an administrator has changed the global ruleset.
    const permissionsMap = useRolePermissionsStore(s => s.permissions);

    return useMemo(() => {
        if (!role) return false;

        // The actual evaluation runs through the store's O(1) cache.
        return useRolePermissionsStore.getState().hasPermission(role, permission);
    }, [role, permission, permissionsMap]);
};

/**
 * A hook to evaluate multiple permissions optimally.
 * Useful for components protecting complex routes or features.
 */
export const usePermissions = (permissions: PermissionValue[]): Record<string, boolean> => {
    const role = useAuthStore(s => s.impersonatedRole || s.user?.role);
    const permissionsMap = useRolePermissionsStore(s => s.permissions);

    return useMemo(() => {
        const result: Record<string, boolean> = {};
        if (!role) {
            permissions.forEach(p => result[p] = false);
            return result;
        }

        const store = useRolePermissionsStore.getState();
        permissions.forEach(p => {
            result[p] = store.hasPermission(role, p);
        });

        return result;
    }, [role, permissions, permissionsMap]);
};
