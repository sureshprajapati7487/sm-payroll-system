import { Roles, Role } from '@/types';

// ──────────────────────────────────────────────────────────────────────────────
// ALL SYSTEM PERMISSIONS — granular, module-level
// ──────────────────────────────────────────────────────────────────────────────
export const PERMISSIONS = {
    // ── Company & System ──────────────────────────────────────────────────
    MANAGE_COMPANY: 'manage_company',
    MANAGE_ROLES: 'manage_roles',
    MANAGE_SETTINGS: 'manage_settings',

    // ── Sidebar / Navigation Visibility ──────────────────────────────────
    NAV_DASHBOARD: 'nav_dashboard',
    NAV_EMPLOYEES: 'nav_employees',
    NAV_ATTENDANCE: 'nav_attendance',
    NAV_SALESMAN: 'nav_salesman',
    NAV_PRODUCTION: 'nav_production',
    NAV_LEAVES: 'nav_leaves',
    NAV_LOANS: 'nav_loans',
    NAV_APPROVALS: 'nav_approvals',
    NAV_PAYROLL: 'nav_payroll',
    NAV_EXPENSES: 'nav_expenses',
    NAV_FINANCE: 'nav_finance',
    NAV_CALCULATORS: 'nav_calculators',
    NAV_REPORTS: 'nav_reports',
    NAV_STATUTORY: 'nav_statutory',
    NAV_SYSTEM: 'nav_system',

    // ── Employees ─────────────────────────────────────────────────────────
    VIEW_EMPLOYEES: 'view_employees',
    ADD_EMPLOYEE: 'add_employee',
    EDIT_EMPLOYEE: 'edit_employee',
    DELETE_EMPLOYEE: 'delete_employee',
    VIEW_EMPLOYEE_SALARY: 'view_employee_salary',     // Salary column in list
    VIEW_EMPLOYEE_BANK: 'view_employee_bank',          // Bank/Aadhaar/PAN
    EXPORT_EMPLOYEES: 'export_employees',

    // ── Attendance ────────────────────────────────────────────────────────
    VIEW_ATTENDANCE: 'view_attendance',
    EDIT_ATTENDANCE: 'edit_attendance',
    APPROVE_ATTENDANCE: 'approve_attendance',
    MANUAL_ATTENDANCE: 'manual_attendance',
    MANAGE_HOLIDAYS: 'manage_holidays',
    VIEW_ATTENDANCE_REPORTS: 'view_attendance_reports',
    USE_FACE_KIOSK: 'use_face_kiosk',

    // ── Payroll & Accounts ────────────────────────────────────────────────
    VIEW_PAYROLL: 'view_payroll',
    GENERATE_PAYROLL: 'generate_payroll',
    APPROVE_PAYROLL: 'approve_payroll',
    LOCK_PAYROLL: 'lock_payroll',
    VIEW_PAYSLIP: 'view_payslip',                     // Own payslip
    VIEW_ALL_PAYSLIPS: 'view_all_payslips',           // Everyone's payslips
    RUN_PAYROLL_SIMULATION: 'run_payroll_simulation',
    VIEW_SALARY: 'view_salary',

    // ── Loans ─────────────────────────────────────────────────────────────
    MANAGE_LOANS: 'manage_loans',
    VIEW_OWN_LOANS: 'view_own_loans',
    APPROVE_LOANS: 'approve_loans',
    VIEW_ALL_LOANS: 'view_all_loans',

    // ── Leaves ────────────────────────────────────────────────────────────
    VIEW_LEAVES: 'view_leaves',
    REQUEST_LEAVES: 'request_leaves',
    APPROVE_LEAVES: 'approve_leaves',
    VIEW_ALL_LEAVES: 'view_all_leaves',
    MANAGE_LEAVE_BALANCE: 'manage_leave_balance',

    // ── Production ────────────────────────────────────────────────────────
    VIEW_PRODUCTION: 'view_production',
    ADD_PRODUCTION: 'add_production',
    APPROVE_PRODUCTION: 'approve_production',
    MANAGE_PRODUCTION_RATES: 'manage_production_rates',
    VIEW_PRODUCTION_REPORTS: 'view_production_reports',
    BULK_PRODUCTION_ENTRY: 'bulk_production_entry',

    // ── Salesman / Sales ──────────────────────────────────────────────────
    VIEW_SALESMAN: 'view_salesman',
    MANAGE_SALESMAN: 'manage_salesman',
    VIEW_CLIENTS: 'view_clients',
    MANAGE_CLIENTS: 'manage_clients',

    // ── Finance ───────────────────────────────────────────────────────────
    VIEW_FINANCE_DASHBOARD: 'view_finance_dashboard',
    VIEW_DEPT_FINANCE: 'view_dept_finance',
    VIEW_COST_CENTERS: 'view_cost_centers',
    MANAGE_EXPENSES: 'manage_expenses',
    MANAGE_ADVANCE_SALARY: 'manage_advance_salary',

    // ── Reports ───────────────────────────────────────────────────────────
    VIEW_REPORTS: 'view_reports',
    BUILD_REPORTS: 'build_reports',
    EXPORT_REPORTS: 'export_reports',
    SCHEDULE_REPORTS: 'schedule_reports',

    // ── Statutory / Compliance ────────────────────────────────────────────
    VIEW_STATUTORY: 'view_statutory',
    MANAGE_STATUTORY: 'manage_statutory',
    VIEW_FORM16: 'view_form16',

    // ── System / Admin Tools ──────────────────────────────────────────────
    VIEW_AUDIT_LOGS: 'view_audit_logs',
    DATABASE_BACKUP: 'database_backup',
    BULK_IMPORT: 'bulk_import',
    MANAGE_TRASH: 'manage_trash',
    VIEW_SECURITY_ALERTS: 'view_security_alerts',
    DATA_CONSISTENCY_CHECK: 'data_consistency_check',
    MANAGE_COMPANY_SWITCH: 'manage_company_switch',

    // ── Approvals ─────────────────────────────────────────────────────────
    VIEW_APPROVALS: 'view_approvals',
    PROCESS_APPROVALS: 'process_approvals',

    // ── Calculators ───────────────────────────────────────────────────────
    USE_CALCULATORS: 'use_calculators',

} as const;

export type PermissionKey = keyof typeof PERMISSIONS;
export type PermissionValue = typeof PERMISSIONS[PermissionKey];

// ──────────────────────────────────────────────────────────────────────────────
// DEFAULT ROLE PERMISSIONS — Super Admin always gets everything in the store
// ──────────────────────────────────────────────────────────────────────────────
export const ROLE_PERMISSIONS: Record<Role, PermissionValue[]> = {
    [Roles.SUPER_ADMIN]: Object.values(PERMISSIONS),

    [Roles.ADMIN]: [
        // Sidebar
        PERMISSIONS.NAV_DASHBOARD,
        PERMISSIONS.NAV_EMPLOYEES,
        PERMISSIONS.NAV_ATTENDANCE,
        PERMISSIONS.NAV_PRODUCTION,
        PERMISSIONS.NAV_LEAVES,
        PERMISSIONS.NAV_LOANS,
        PERMISSIONS.NAV_APPROVALS,
        PERMISSIONS.NAV_PAYROLL,
        PERMISSIONS.NAV_EXPENSES,
        PERMISSIONS.NAV_SALESMAN,
        PERMISSIONS.NAV_CALCULATORS,

        // Employees
        PERMISSIONS.VIEW_EMPLOYEES,
        PERMISSIONS.ADD_EMPLOYEE,
        PERMISSIONS.EDIT_EMPLOYEE,
        PERMISSIONS.VIEW_EMPLOYEE_SALARY,
        PERMISSIONS.EXPORT_EMPLOYEES,

        // Attendance
        PERMISSIONS.VIEW_ATTENDANCE,
        PERMISSIONS.EDIT_ATTENDANCE,
        PERMISSIONS.APPROVE_ATTENDANCE,
        PERMISSIONS.MANUAL_ATTENDANCE,
        PERMISSIONS.MANAGE_HOLIDAYS,
        PERMISSIONS.VIEW_ATTENDANCE_REPORTS,
        PERMISSIONS.USE_FACE_KIOSK,

        // Payroll
        PERMISSIONS.VIEW_PAYROLL,
        PERMISSIONS.GENERATE_PAYROLL,
        PERMISSIONS.VIEW_PAYSLIP,
        PERMISSIONS.VIEW_ALL_PAYSLIPS,
        PERMISSIONS.APPROVE_PAYROLL,

        // Loans
        PERMISSIONS.MANAGE_LOANS,
        PERMISSIONS.APPROVE_LOANS,
        PERMISSIONS.VIEW_ALL_LOANS,
        PERMISSIONS.VIEW_OWN_LOANS,

        // Leaves
        PERMISSIONS.VIEW_LEAVES,
        PERMISSIONS.APPROVE_LEAVES,
        PERMISSIONS.VIEW_ALL_LEAVES,
        PERMISSIONS.MANAGE_LEAVE_BALANCE,

        // Production
        PERMISSIONS.VIEW_PRODUCTION,
        PERMISSIONS.APPROVE_PRODUCTION,
        PERMISSIONS.VIEW_PRODUCTION_REPORTS,

        // Salesman
        PERMISSIONS.VIEW_SALESMAN,
        PERMISSIONS.VIEW_CLIENTS,

        // Approvals
        PERMISSIONS.VIEW_APPROVALS,
        PERMISSIONS.PROCESS_APPROVALS,

        // Calculators
        PERMISSIONS.USE_CALCULATORS,

        // Expenses
        PERMISSIONS.MANAGE_EXPENSES,

        // Settings
        PERMISSIONS.MANAGE_SETTINGS,
    ],

    [Roles.ACCOUNT_ADMIN]: [
        // Sidebar
        PERMISSIONS.NAV_DASHBOARD,
        PERMISSIONS.NAV_EMPLOYEES,
        PERMISSIONS.NAV_ATTENDANCE,
        PERMISSIONS.NAV_PAYROLL,
        PERMISSIONS.NAV_LOANS,
        PERMISSIONS.NAV_LEAVES,
        PERMISSIONS.NAV_EXPENSES,
        PERMISSIONS.NAV_PRODUCTION,
        PERMISSIONS.NAV_FINANCE,
        PERMISSIONS.NAV_CALCULATORS,
        PERMISSIONS.NAV_REPORTS,
        PERMISSIONS.NAV_STATUTORY,
        PERMISSIONS.NAV_APPROVALS,

        // Employees
        PERMISSIONS.VIEW_EMPLOYEES,
        PERMISSIONS.ADD_EMPLOYEE,
        PERMISSIONS.EDIT_EMPLOYEE,
        PERMISSIONS.VIEW_EMPLOYEE_SALARY,
        PERMISSIONS.VIEW_EMPLOYEE_BANK,
        PERMISSIONS.EXPORT_EMPLOYEES,

        // Attendance
        PERMISSIONS.VIEW_ATTENDANCE,
        PERMISSIONS.MANUAL_ATTENDANCE,
        PERMISSIONS.MANAGE_HOLIDAYS,
        PERMISSIONS.VIEW_ATTENDANCE_REPORTS,

        // Payroll
        PERMISSIONS.VIEW_PAYROLL,
        PERMISSIONS.GENERATE_PAYROLL,
        PERMISSIONS.APPROVE_PAYROLL,
        PERMISSIONS.LOCK_PAYROLL,
        PERMISSIONS.VIEW_PAYSLIP,
        PERMISSIONS.VIEW_ALL_PAYSLIPS,
        PERMISSIONS.RUN_PAYROLL_SIMULATION,
        PERMISSIONS.VIEW_SALARY,

        // Loans
        PERMISSIONS.MANAGE_LOANS,
        PERMISSIONS.APPROVE_LOANS,
        PERMISSIONS.VIEW_ALL_LOANS,
        PERMISSIONS.VIEW_OWN_LOANS,

        // Leaves
        PERMISSIONS.VIEW_LEAVES,
        PERMISSIONS.REQUEST_LEAVES,
        PERMISSIONS.APPROVE_LEAVES,
        PERMISSIONS.VIEW_ALL_LEAVES,
        PERMISSIONS.MANAGE_LEAVE_BALANCE,

        // Production
        PERMISSIONS.VIEW_PRODUCTION,
        PERMISSIONS.ADD_PRODUCTION,
        PERMISSIONS.APPROVE_PRODUCTION,
        PERMISSIONS.MANAGE_PRODUCTION_RATES,
        PERMISSIONS.VIEW_PRODUCTION_REPORTS,
        PERMISSIONS.BULK_PRODUCTION_ENTRY,

        // Finance
        PERMISSIONS.VIEW_FINANCE_DASHBOARD,
        PERMISSIONS.VIEW_DEPT_FINANCE,
        PERMISSIONS.VIEW_COST_CENTERS,
        PERMISSIONS.MANAGE_EXPENSES,
        PERMISSIONS.MANAGE_ADVANCE_SALARY,

        // Reports
        PERMISSIONS.VIEW_REPORTS,
        PERMISSIONS.BUILD_REPORTS,
        PERMISSIONS.EXPORT_REPORTS,

        // Statutory
        PERMISSIONS.VIEW_STATUTORY,
        PERMISSIONS.VIEW_FORM16,

        // Approvals
        PERMISSIONS.VIEW_APPROVALS,
        PERMISSIONS.PROCESS_APPROVALS,

        // Calculators
        PERMISSIONS.USE_CALCULATORS,
    ],

    [Roles.MANAGER]: [
        // Sidebar
        PERMISSIONS.NAV_DASHBOARD,
        PERMISSIONS.NAV_EMPLOYEES,
        PERMISSIONS.NAV_ATTENDANCE,
        PERMISSIONS.NAV_PRODUCTION,
        PERMISSIONS.NAV_LEAVES,
        PERMISSIONS.NAV_APPROVALS,
        PERMISSIONS.NAV_CALCULATORS,

        // Employees (team only, enforced in component)
        PERMISSIONS.VIEW_EMPLOYEES,

        // Attendance (team only)
        PERMISSIONS.VIEW_ATTENDANCE,
        PERMISSIONS.VIEW_ATTENDANCE_REPORTS,

        // Production
        PERMISSIONS.VIEW_PRODUCTION,
        PERMISSIONS.ADD_PRODUCTION,
        PERMISSIONS.VIEW_PRODUCTION_REPORTS,

        // Leaves
        PERMISSIONS.VIEW_LEAVES,
        PERMISSIONS.REQUEST_LEAVES,
        PERMISSIONS.APPROVE_LEAVES,
        PERMISSIONS.VIEW_ALL_LEAVES,

        // Approvals
        PERMISSIONS.VIEW_APPROVALS,
        PERMISSIONS.PROCESS_APPROVALS,

        // Calculators
        PERMISSIONS.USE_CALCULATORS,
    ],

    [Roles.EMPLOYEE]: [
        // Sidebar
        PERMISSIONS.NAV_DASHBOARD,
        PERMISSIONS.NAV_ATTENDANCE,
        PERMISSIONS.NAV_LEAVES,
        PERMISSIONS.NAV_LOANS,

        // Attendance (own only)
        PERMISSIONS.VIEW_ATTENDANCE,
        PERMISSIONS.USE_FACE_KIOSK,

        // Leaves
        PERMISSIONS.VIEW_LEAVES,
        PERMISSIONS.REQUEST_LEAVES,

        // Loans (own only)
        PERMISSIONS.VIEW_OWN_LOANS,

        // Payslips (own only)
        PERMISSIONS.VIEW_PAYSLIP,

        // Production (own view)
        PERMISSIONS.VIEW_PRODUCTION,
        PERMISSIONS.ADD_PRODUCTION,

        // Calculators
        PERMISSIONS.USE_CALCULATORS,
    ],
};
