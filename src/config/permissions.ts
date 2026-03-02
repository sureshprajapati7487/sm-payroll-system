import { Roles, Role } from '@/types';

// Define all possible permissions in the system
export const PERMISSIONS = {
    // Company & System
    MANAGE_COMPANY: 'manage_company',
    MANAGE_ROLES: 'manage_roles',
    MANAGE_SETTINGS: 'manage_settings',

    // Employees
    VIEW_EMPLOYEES: 'view_employees',
    ADD_EMPLOYEE: 'add_employee',
    EDIT_EMPLOYEE: 'edit_employee',
    DELETE_EMPLOYEE: 'delete_employee',

    // Attendance
    VIEW_ATTENDANCE: 'view_attendance',
    EDIT_ATTENDANCE: 'edit_attendance', // Admin override
    APPROVE_ATTENDANCE: 'approve_attendance',
    MANUAL_ATTENDANCE: 'manual_attendance', // For Status Update (Present/Absent/Half Day)
    MANAGE_HOLIDAYS: 'manage_holidays', // Added for Calendar Management

    // Payroll & Accounts
    VIEW_PAYROLL: 'view_payroll',
    GENERATE_PAYROLL: 'generate_payroll',
    MANAGE_LOANS: 'manage_loans',
    VIEW_SALARY: 'view_salary', // Sensitive

    // Production
    VIEW_PRODUCTION: 'view_production',
    ADD_PRODUCTION: 'add_production',
    APPROVE_PRODUCTION: 'approve_production',

    // Leaves
    VIEW_LEAVES: 'view_leaves',
    REQUEST_LEAVES: 'request_leaves',
    APPROVE_LEAVES: 'approve_leaves',
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;
export type PermissionValue = typeof PERMISSIONS[PermissionKey];

// The detailed matrix of what each role can do by default
export const ROLE_PERMISSIONS: Record<Role, PermissionValue[]> = {
    [Roles.SUPER_ADMIN]: Object.values(PERMISSIONS), // God Mode: Has everything

    [Roles.ADMIN]: [
        PERMISSIONS.VIEW_EMPLOYEES,
        PERMISSIONS.ADD_EMPLOYEE,
        PERMISSIONS.EDIT_EMPLOYEE,
        PERMISSIONS.VIEW_ATTENDANCE,
        PERMISSIONS.EDIT_ATTENDANCE,
        PERMISSIONS.APPROVE_ATTENDANCE,
        PERMISSIONS.MANUAL_ATTENDANCE,
        PERMISSIONS.MANAGE_HOLIDAYS, // Added
        PERMISSIONS.VIEW_PRODUCTION,
        PERMISSIONS.APPROVE_PRODUCTION,
        PERMISSIONS.MANAGE_LOANS,
        PERMISSIONS.VIEW_LEAVES,
        PERMISSIONS.APPROVE_LEAVES,
    ],

    [Roles.ACCOUNT_ADMIN]: [
        PERMISSIONS.VIEW_PAYROLL,
        PERMISSIONS.GENERATE_PAYROLL,
        PERMISSIONS.MANAGE_LOANS,
        PERMISSIONS.VIEW_SALARY,
        PERMISSIONS.VIEW_ATTENDANCE,
        PERMISSIONS.MANUAL_ATTENDANCE,
        PERMISSIONS.MANAGE_HOLIDAYS, // Added
        PERMISSIONS.VIEW_EMPLOYEES,
        PERMISSIONS.ADD_EMPLOYEE,
        PERMISSIONS.EDIT_EMPLOYEE,
        PERMISSIONS.VIEW_LEAVES,
        PERMISSIONS.APPROVE_LEAVES, // Added to allow "On Behalf Of"
        PERMISSIONS.REQUEST_LEAVES,

        // Production access
        PERMISSIONS.VIEW_PRODUCTION,
        PERMISSIONS.ADD_PRODUCTION,
        PERMISSIONS.APPROVE_PRODUCTION,
    ],

    [Roles.MANAGER]: [
        PERMISSIONS.VIEW_ATTENDANCE, // Team only (logic in component)
        PERMISSIONS.ADD_PRODUCTION,
        PERMISSIONS.VIEW_PRODUCTION,
        PERMISSIONS.VIEW_EMPLOYEES, // Team only
        PERMISSIONS.VIEW_LEAVES,
        PERMISSIONS.APPROVE_LEAVES,
    ],

    [Roles.EMPLOYEE]: [
        // Very limited, mostly self-view (handled by "Locked System" logic)
        // Fixed: Employees need to see Attendance to Check In
        PERMISSIONS.VIEW_ATTENDANCE,
        PERMISSIONS.VIEW_PRODUCTION, // View own work
        PERMISSIONS.VIEW_LEAVES,
        PERMISSIONS.REQUEST_LEAVES,
        // Employees typically view their own data, not "Manage"
    ],
};
