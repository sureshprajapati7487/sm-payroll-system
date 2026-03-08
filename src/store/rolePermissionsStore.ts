import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Role, Roles } from '@/types';
import { ROLE_PERMISSIONS, PERMISSIONS, PermissionValue } from '@/config/permissions';

// ─── Data Scope ──────────────────────────────────────────────────────────────
// Controls WHAT DATA a role can see, not just which features they access
export type DataScope = 'OWN' | 'TEAM' | 'DEPARTMENT' | 'ALL';

export interface DataVisibility {
    scope: DataScope;                  // Global data scope for the role
    canSeeOthersSalary: boolean;       // Can view other employees' salary?
    canSeeOthersAttendance: boolean;   // Can view others' attendance records?
    canSeeOthersLeaves: boolean;       // Can view others' leave history?
    canSeeOthersLoans: boolean;        // Can view others' loan records?
    canSeeOthersProduction: boolean;   // Can view others' production data?
    canSeeOthersBankDetails: boolean;  // Can view bank/Aadhaar/PAN of others?
    canSeeOthersPersonalInfo: boolean; // Can see phone/address of others?
    canEditOthersProfile: boolean;     // Can edit other's profile fields?
    canDownloadReports: boolean;       // Can export / download reports?
    canBulkOperate: boolean;           // Can do bulk actions (bulk import/edit)?
}

export const DATA_VISIBILITY_DEFAULTS: Record<Role, DataVisibility> = {
    [Roles.SUPER_ADMIN]: {
        scope: 'ALL', canSeeOthersSalary: true, canSeeOthersAttendance: true,
        canSeeOthersLeaves: true, canSeeOthersLoans: true, canSeeOthersProduction: true,
        canSeeOthersBankDetails: true, canSeeOthersPersonalInfo: true,
        canEditOthersProfile: true, canDownloadReports: true, canBulkOperate: true,
    },
    [Roles.ADMIN]: {
        scope: 'ALL', canSeeOthersSalary: true, canSeeOthersAttendance: true,
        canSeeOthersLeaves: true, canSeeOthersLoans: true, canSeeOthersProduction: true,
        canSeeOthersBankDetails: true, canSeeOthersPersonalInfo: true,
        canEditOthersProfile: true, canDownloadReports: true, canBulkOperate: true,
    },
    [Roles.ACCOUNT_ADMIN]: {
        scope: 'ALL', canSeeOthersSalary: true, canSeeOthersAttendance: true,
        canSeeOthersLeaves: true, canSeeOthersLoans: true, canSeeOthersProduction: true,
        canSeeOthersBankDetails: true, canSeeOthersPersonalInfo: true,
        canEditOthersProfile: false, canDownloadReports: true, canBulkOperate: false,
    },
    [Roles.MANAGER]: {
        scope: 'TEAM', canSeeOthersSalary: false, canSeeOthersAttendance: true,
        canSeeOthersLeaves: true, canSeeOthersLoans: false, canSeeOthersProduction: true,
        canSeeOthersBankDetails: false, canSeeOthersPersonalInfo: true,
        canEditOthersProfile: false, canDownloadReports: false, canBulkOperate: false,
    },
    [Roles.EMPLOYEE]: {
        scope: 'OWN', canSeeOthersSalary: false, canSeeOthersAttendance: false,
        canSeeOthersLeaves: false, canSeeOthersLoans: false, canSeeOthersProduction: false,
        canSeeOthersBankDetails: false, canSeeOthersPersonalInfo: false,
        canEditOthersProfile: false, canDownloadReports: false, canBulkOperate: false,
    },
};

// ─── Store Types ──────────────────────────────────────────────────────────────
type RolePermMap = Record<Role, PermissionValue[]>;
type DataVisibilityMap = Record<Role, DataVisibility>;

interface RolePermissionsState {
    permissions: RolePermMap;
    dataVisibility: DataVisibilityMap;

    togglePermission: (role: Role, permission: PermissionValue) => void;
    hasPermission: (role: Role, permission: PermissionValue) => boolean;
    resetRole: (role: Role) => void;
    resetAll: () => void;

    // Data Visibility actions
    setDataScope: (role: Role, scope: DataScope) => void;
    toggleDataVisibilityFlag: (role: Role, flag: keyof Omit<DataVisibility, 'scope'>) => void;
    getDataVisibility: (role: Role) => DataVisibility;
}

const defaultPermissions = (): RolePermMap => ({
    [Roles.SUPER_ADMIN]: [...Object.values(PERMISSIONS)],
    [Roles.ADMIN]: [...ROLE_PERMISSIONS[Roles.ADMIN]],
    [Roles.ACCOUNT_ADMIN]: [...ROLE_PERMISSIONS[Roles.ACCOUNT_ADMIN]],
    [Roles.MANAGER]: [...ROLE_PERMISSIONS[Roles.MANAGER]],
    [Roles.EMPLOYEE]: [...ROLE_PERMISSIONS[Roles.EMPLOYEE]],
});

const defaultDataVisibility = (): DataVisibilityMap => ({
    [Roles.SUPER_ADMIN]: { ...DATA_VISIBILITY_DEFAULTS[Roles.SUPER_ADMIN] },
    [Roles.ADMIN]: { ...DATA_VISIBILITY_DEFAULTS[Roles.ADMIN] },
    [Roles.ACCOUNT_ADMIN]: { ...DATA_VISIBILITY_DEFAULTS[Roles.ACCOUNT_ADMIN] },
    [Roles.MANAGER]: { ...DATA_VISIBILITY_DEFAULTS[Roles.MANAGER] },
    [Roles.EMPLOYEE]: { ...DATA_VISIBILITY_DEFAULTS[Roles.EMPLOYEE] },
});

export const useRolePermissionsStore = create<RolePermissionsState>()(
    persist(
        (set, get) => ({
            permissions: defaultPermissions(),
            dataVisibility: defaultDataVisibility(),

            togglePermission: (role, permission) => {
                if (role === Roles.SUPER_ADMIN) return;
                set((state) => {
                    const current = state.permissions[role] ?? [];
                    const has = current.includes(permission);
                    return {
                        permissions: {
                            ...state.permissions,
                            [role]: has
                                ? current.filter(p => p !== permission)
                                : [...current, permission],
                        },
                    };
                });
            },

            hasPermission: (role, permission) => {
                if (role === Roles.SUPER_ADMIN) return true;
                const perms = get().permissions[role] ?? [];
                return perms.includes(permission);
            },

            setDataScope: (role, scope) => {
                if (role === Roles.SUPER_ADMIN) return;
                set(state => ({
                    dataVisibility: {
                        ...state.dataVisibility,
                        [role]: { ...state.dataVisibility[role], scope },
                    },
                }));
            },

            toggleDataVisibilityFlag: (role, flag) => {
                if (role === Roles.SUPER_ADMIN) return;
                set(state => ({
                    dataVisibility: {
                        ...state.dataVisibility,
                        [role]: {
                            ...state.dataVisibility[role],
                            [flag]: !state.dataVisibility[role][flag],
                        },
                    },
                }));
            },

            getDataVisibility: (role) => {
                return get().dataVisibility[role] ?? DATA_VISIBILITY_DEFAULTS[role];
            },

            resetRole: (role) => {
                if (role === Roles.SUPER_ADMIN) return;
                set(state => ({
                    permissions: {
                        ...state.permissions,
                        [role]: [...(ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] ?? [])],
                    },
                    dataVisibility: {
                        ...state.dataVisibility,
                        [role]: { ...DATA_VISIBILITY_DEFAULTS[role] },
                    },
                }));
            },

            resetAll: () => {
                set({ permissions: defaultPermissions(), dataVisibility: defaultDataVisibility() });
            },
        }),
        { name: 'role-permissions-config' }
    )
);
