import { describe, it, expect, beforeEach } from 'vitest';
import { useRolePermissionsStore } from '@/store/rolePermissionsStore';
import { Roles } from '@/types';
import { PERMISSIONS } from '@/config/permissions';

describe('RolePermissionsStore -> hasPermission', () => {
    beforeEach(() => {
        // Reset the store to default state before each test
        useRolePermissionsStore.getState().resetAll();
    });

    it('SUPER_ADMIN should ALWAYS have ALL permissions, even ones not explicitly granted', () => {
        const store = useRolePermissionsStore.getState();

        // Known permission
        expect(store.hasPermission(Roles.SUPER_ADMIN, PERMISSIONS.VIEW_EMPLOYEES)).toBe(true);
        expect(store.hasPermission(Roles.SUPER_ADMIN, PERMISSIONS.MANAGE_ROLES)).toBe(true);

        // Fake permission that doesn't exist to prove the God Mode bypass is active
        expect(store.hasPermission(Roles.SUPER_ADMIN, 'SOME_FAKE_GOD_PERMISSION' as any)).toBe(true);
    });

    it('EMPLOYEE should NOT have admin-level permissions by default', () => {
        const store = useRolePermissionsStore.getState();

        // allowed
        expect(store.hasPermission(Roles.EMPLOYEE, PERMISSIONS.NAV_DASHBOARD)).toBe(true);
        // denied
        expect(store.hasPermission(Roles.EMPLOYEE, PERMISSIONS.MANAGE_SETTINGS)).toBe(false);
        expect(store.hasPermission(Roles.EMPLOYEE, PERMISSIONS.MANAGE_STATUTORY)).toBe(false);
    });

    it('O(1) Map Cache should accurately reflect changes when togglePermission is called', () => {
        const store = useRolePermissionsStore.getState();

        // Initially false
        expect(store.hasPermission(Roles.MANAGER, PERMISSIONS.MANAGE_SETTINGS)).toBe(false);

        // Grant the permission
        store.togglePermission(Roles.MANAGER, PERMISSIONS.MANAGE_SETTINGS);

        // Should be true now (proves the cache was cleared and the new state is fetched)
        expect(store.hasPermission(Roles.MANAGER, PERMISSIONS.MANAGE_SETTINGS)).toBe(true);

        // Revoke the permission
        store.togglePermission(Roles.MANAGER, PERMISSIONS.MANAGE_SETTINGS);
        expect(store.hasPermission(Roles.MANAGER, PERMISSIONS.MANAGE_SETTINGS)).toBe(false);
    });

    it('setPermissions should overwrite everything and clear the cache', () => {
        const store = useRolePermissionsStore.getState();

        // Initially true
        expect(store.hasPermission(Roles.ADMIN, PERMISSIONS.MANAGE_WORK_GROUPS)).toBe(true);

        const emptyPerms = {
            [Roles.ADMIN]: [],
        };

        const existingScopes = store.scopes;

        store.setPermissions(emptyPerms, existingScopes);

        // Administrator should now be stripped of work group management
        expect(store.hasPermission(Roles.ADMIN, PERMISSIONS.MANAGE_WORK_GROUPS)).toBe(false);

        // but SUPER_ADMIN should be natively protected against lockout
        expect(store.hasPermission(Roles.SUPER_ADMIN, PERMISSIONS.MANAGE_ROLES)).toBe(true);
    });
});
