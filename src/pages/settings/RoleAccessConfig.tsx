import { useState, useEffect } from 'react';
import {
    ShieldCheck, RotateCcw, Lock, Check, X,
    Users, CalendarClock, Banknote, Factory, Wallet,
    UserCheck,
    TrendingUp, BarChart2, ShoppingBag,
    FileText, Database,
    Eye, Navigation, ChevronDown, ChevronRight,
    AlertTriangle, Zap, Globe, Network, User, Save
} from 'lucide-react';
import { useRolePermissionsStore, DataScope } from '@/store/rolePermissionsStore';
import { useAuthStore } from '@/store/authStore';
import { PERMISSIONS } from '@/config/permissions';
import { Roles, Role } from '@/types';
import type { PermissionValue } from '@/config/permissions';
import { WarningModal } from '@/components/ui/WarningModal';
import { InfoTip } from '@/components/ui/InfoTip';
import { useAuditStore } from '@/store/auditStore';
import { useNavigate } from 'react-router-dom';
import { useDialog } from '@/components/DialogProvider';
import { useSecurityAlerts } from '@/hooks/useSecurityAlerts';

// ─── Permission Groups with full hierarchy ────────────────────────────────────
const PERMISSION_GROUPS: {
    id: string;
    title: string;
    icon: React.ReactNode;
    color: string;
    bg: string;
    border: string;
    subGroups: {
        title: string;
        permissions: { key: string; label: string; desc: string; danger?: boolean }[];
    }[];
}[] = [
        {
            id: 'sidebar',
            title: 'Sidebar Visibility',
            icon: <Navigation className="w-4 h-4" />,
            color: 'text-violet-400',
            bg: 'bg-violet-500/10',
            border: 'border-violet-500/30',
            subGroups: [
                {
                    title: 'Main Navigation',
                    permissions: [
                        { key: PERMISSIONS.NAV_DASHBOARD, label: 'Dashboard', desc: 'Main dashboard link in sidebar' },
                        { key: PERMISSIONS.NAV_EMPLOYEES, label: 'Employees', desc: 'Employee management section' },
                        { key: PERMISSIONS.NAV_ATTENDANCE, label: 'Attendance', desc: 'Attendance section + Holiday Manager' },
                        { key: PERMISSIONS.NAV_SALESMAN, label: 'Salesman', desc: 'Salesman & Clients section' },
                        { key: PERMISSIONS.NAV_PRODUCTION, label: 'Production', desc: 'Production entries & rate manager' },
                    ],
                },
                {
                    title: 'Finance Navigation',
                    permissions: [
                        { key: PERMISSIONS.NAV_LEAVES, label: 'Leaves', desc: 'Leave requests & approvals' },
                        { key: PERMISSIONS.NAV_LOANS, label: 'Loans', desc: 'Loan management section' },
                        { key: PERMISSIONS.NAV_APPROVALS, label: 'Approvals', desc: 'Approval center' },
                        { key: PERMISSIONS.NAV_PAYROLL, label: 'Payroll', desc: 'Payroll & payslips' },
                        { key: PERMISSIONS.NAV_EXPENSES, label: 'Expenses', desc: 'Expense tracking' },
                        { key: PERMISSIONS.NAV_FINANCE, label: 'Finance Modules', desc: 'Finance Dashboard, Dept Finance, Cost Centers, Advance Salary' },
                    ],
                },
                {
                    title: 'Tools & Admin Navigation',
                    permissions: [
                        { key: PERMISSIONS.NAV_CALCULATORS, label: 'Calculators', desc: 'CTC, TDS, PF/ESI calculators' },
                        { key: PERMISSIONS.NAV_REPORTS, label: 'Reports', desc: 'Report builder & scheduled reports' },
                        { key: PERMISSIONS.NAV_STATUTORY, label: 'Statutory', desc: 'Form 16 & compliance reports' },
                        { key: PERMISSIONS.NAV_SYSTEM, label: 'System Tools', desc: 'Audit Logs, Backup, Bulk Import, Trash, Security Alerts', danger: true },
                    ],
                },
            ],
        },
        {
            id: 'employees',
            title: 'Employees',
            icon: <Users className="w-4 h-4" />,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10',
            border: 'border-blue-500/30',
            subGroups: [
                {
                    title: 'Employee Access',
                    permissions: [
                        { key: PERMISSIONS.VIEW_EMPLOYEES, label: 'View Employee List', desc: 'See the employees directory' },
                        { key: PERMISSIONS.ADD_EMPLOYEE, label: 'Add Employee', desc: 'Create new employee records' },
                        { key: PERMISSIONS.EDIT_EMPLOYEE, label: 'Edit Employee', desc: 'Update employee information' },
                        { key: PERMISSIONS.DELETE_EMPLOYEE, label: 'Delete Employee', desc: 'Permanently delete employees', danger: true },
                        { key: PERMISSIONS.VIEW_EMPLOYEE_PERSONAL, label: 'View Personal Details', desc: 'View basic personal/family info' },
                        { key: PERMISSIONS.VIEW_EMPLOYEE_FINANCIALS, label: 'View Financials Tab', desc: 'View employee financial settings' },
                        { key: PERMISSIONS.EDIT_EMPLOYEE_FINANCIALS, label: 'Edit Financials Tab', desc: 'Make changes to employee financial settings', danger: true },
                        { key: PERMISSIONS.VIEW_EMPLOYEE_DOCUMENTS, label: 'View Documents', desc: 'Access uploaded documents' },
                        { key: PERMISSIONS.VIEW_EMPLOYEE_SALARY, label: 'View Salary Figures', desc: 'See salary amounts in employee list' },
                        { key: PERMISSIONS.VIEW_EMPLOYEE_BANK, label: 'View Bank / Aadhaar / PAN', desc: 'Access sensitive banking and ID information' },
                        { key: PERMISSIONS.EXPORT_EMPLOYEES, label: 'Export Employee Data', desc: 'Download employee list as Excel/PDF' },
                        { key: PERMISSIONS.BULK_IMPORT, label: 'Bulk Import', desc: 'Import employees via Excel upload' },
                    ],
                },
                {
                    title: 'Own Profile (Self-Service)',
                    permissions: [
                        { key: PERMISSIONS.VIEW_OWN_PROFILE, label: 'View Own Profile', desc: 'Employee khud ka profile dekhe' },
                        { key: PERMISSIONS.UPDATE_OWN_PROFILE, label: 'Update Own Profile', desc: 'Phone, address, emergency contact update kare' },
                        { key: PERMISSIONS.UPLOAD_OWN_DOCUMENTS, label: 'Upload Own Documents', desc: 'Aadhaar, PAN, certificates upload kare' },
                    ],
                },
            ],
        },
        {
            id: 'attendance',
            title: 'Attendance',
            icon: <CalendarClock className="w-4 h-4" />,
            color: 'text-green-400',
            bg: 'bg-green-500/10',
            border: 'border-green-500/30',
            subGroups: [
                {
                    title: 'Attendance Controls',
                    permissions: [
                        { key: PERMISSIONS.VIEW_ATTENDANCE, label: 'View Attendance', desc: 'See attendance records' },
                        { key: PERMISSIONS.EDIT_ATTENDANCE, label: 'Edit Attendance', desc: 'Override attendance status' },
                        { key: PERMISSIONS.APPROVE_ATTENDANCE, label: 'Approve Attendance', desc: 'Approve regular attendance' },
                        { key: PERMISSIONS.APPROVE_REGULARIZATION, label: 'Approve Regularization', desc: 'Approve regularization requests' },
                        { key: PERMISSIONS.MANUAL_ATTENDANCE, label: 'Mark Manual Attendance', desc: 'Mark Present / Absent / Half Day on behalf' },
                        { key: PERMISSIONS.ADD_MANUAL_PUNCH, label: 'Add Manual Punch', desc: 'Insert manual time punch records' },
                        { key: PERMISSIONS.MANAGE_HOLIDAYS, label: 'Manage Holidays', desc: 'Add, edit & delete holiday calendar' },
                        { key: PERMISSIONS.VIEW_ATTENDANCE_REPORTS, label: 'Attendance Reports', desc: 'View monthly/weekly summary reports' },
                        { key: PERMISSIONS.VIEW_TEAM_ATTENDANCE, label: 'View Team Attendance', desc: 'Manager - sirf apni team ki attendance dekhe' },
                        { key: PERMISSIONS.USE_FACE_KIOSK, label: 'Face Kiosk Access', desc: 'Use facial recognition kiosk for punch-in' },
                    ],
                },
                {
                    title: 'Self Attendance (Employee)',
                    permissions: [
                        { key: PERMISSIONS.MARK_OWN_ATTENDANCE, label: 'Punch In / Punch Out', desc: 'Employee khud apna punch mark kare' },
                        { key: PERMISSIONS.VIEW_OWN_ATTENDANCE, label: 'View Own Attendance', desc: 'Sirf apni attendance history dekhe' },
                        { key: PERMISSIONS.REQUEST_REGULARIZATION, label: 'Request Regularization', desc: 'Galat punch correct karne ki request bheje' },
                    ],
                },
            ],
        },
        {
            id: 'payroll',
            title: 'Payroll & Salary',
            icon: <Banknote className="w-4 h-4" />,
            color: 'text-yellow-400',
            bg: 'bg-yellow-500/10',
            border: 'border-yellow-500/30',
            subGroups: [
                {
                    title: 'Payroll Controls',
                    permissions: [
                        { key: PERMISSIONS.VIEW_PAYROLL, label: 'View Payroll', desc: 'Access payroll dashboard & summary' },
                        { key: PERMISSIONS.GENERATE_PAYROLL, label: 'Generate Payroll', desc: 'Process and create salary payroll' },
                        { key: PERMISSIONS.APPROVE_PAYROLL, label: 'Approve Payroll', desc: 'Authorize payroll before locking' },
                        { key: PERMISSIONS.LOCK_PAYROLL, label: 'Lock Payroll', desc: 'Permanently lock a payroll cycle', danger: true },
                        { key: PERMISSIONS.RUN_PAYROLL_SIMULATION, label: 'Payroll Simulation', desc: 'Run trial/simulation before actual payroll' },
                        { key: PERMISSIONS.VIEW_PAYSLIP, label: 'View Own Payslip', desc: 'See own salary slip' },
                        { key: PERMISSIONS.VIEW_ALL_PAYSLIPS, label: 'View All Payslips', desc: 'Access everyone\'s payslips' },
                        { key: PERMISSIONS.VIEW_SALARY, label: 'View Salary Amounts', desc: 'See net/gross salary of all employees' },
                    ],
                },
            ],
        },
        {
            id: 'loans',
            title: 'Loans',
            icon: <Wallet className="w-4 h-4" />,
            color: 'text-orange-400',
            bg: 'bg-orange-500/10',
            border: 'border-orange-500/30',
            subGroups: [
                {
                    title: 'Loan Access',
                    permissions: [
                        { key: PERMISSIONS.VIEW_OWN_LOANS, label: 'View Own Loans', desc: 'See personal loan records' },
                        { key: PERMISSIONS.REQUEST_LOAN, label: 'Apply for Loan', desc: 'Employee loan ke liye request bheje' },
                        { key: PERMISSIONS.VIEW_ALL_LOANS, label: 'View All Loans', desc: 'Access all employees\' loan records' },
                        { key: PERMISSIONS.MANAGE_LOANS, label: 'Manage Loans', desc: 'Create, edit & process loan records' },
                        { key: PERMISSIONS.APPROVE_LOANS, label: 'Approve Loans', desc: 'Approve or reject loan requests' },
                    ],
                },
            ],
        },
        {
            id: 'leaves',
            title: 'Leaves',
            icon: <CalendarClock className="w-4 h-4" />,
            color: 'text-teal-400',
            bg: 'bg-teal-500/10',
            border: 'border-teal-500/30',
            subGroups: [
                {
                    title: 'Leave Management',
                    permissions: [
                        { key: PERMISSIONS.VIEW_LEAVES, label: 'View Leaves', desc: 'See leave request list' },
                        { key: PERMISSIONS.REQUEST_LEAVES, label: 'Apply for Leave', desc: 'Submit personal leave requests' },
                        { key: PERMISSIONS.APPROVE_LEAVES, label: 'Approve Leaves', desc: 'Approve or reject leave requests' },
                        { key: PERMISSIONS.MANAGE_LEAVES, label: 'Manage Leaves', desc: 'Apply leaves on behalf of employees' },
                        { key: PERMISSIONS.VIEW_ALL_LEAVES, label: 'View All Leaves', desc: 'See all employees\' leave history' },
                        { key: PERMISSIONS.MANAGE_LEAVE_BALANCE, label: 'Manage Leave Balance', desc: 'Add/deduct leave balance for employees' },
                    ],
                },
            ],
        },
        {
            id: 'production',
            title: 'Production',
            icon: <Factory className="w-4 h-4" />,
            color: 'text-amber-400',
            bg: 'bg-amber-500/10',
            border: 'border-amber-500/30',
            subGroups: [
                {
                    title: 'Production Controls',
                    permissions: [
                        { key: PERMISSIONS.VIEW_PRODUCTION, label: 'View Production', desc: 'See production entries' },
                        { key: PERMISSIONS.ADD_PRODUCTION, label: 'Add Production Entry', desc: 'Submit new production records' },
                        { key: PERMISSIONS.APPROVE_PRODUCTION, label: 'Approve Production', desc: 'Approve or reject entries' },
                        { key: PERMISSIONS.MANAGE_PRODUCTION_RATES, label: 'Manage Rates', desc: 'Edit production rates and items' },
                        { key: PERMISSIONS.VIEW_PRODUCTION_REPORTS, label: 'Production Reports', desc: 'View production summary and analytics' },
                        { key: PERMISSIONS.BULK_PRODUCTION_ENTRY, label: 'Bulk Entry', desc: 'Upload bulk production data' },
                    ],
                },
            ],
        },
        {
            id: 'salesman',
            title: 'Salesman & Clients',
            icon: <ShoppingBag className="w-4 h-4" />,
            color: 'text-rose-400',
            bg: 'bg-rose-500/10',
            border: 'border-rose-500/30',
            subGroups: [
                {
                    title: 'Sales Access',
                    permissions: [
                        { key: PERMISSIONS.VIEW_SALESMAN, label: 'View Salesman', desc: 'See salesman dashboard & entries' },
                        { key: PERMISSIONS.MANAGE_SALESMAN, label: 'Manage Salesman', desc: 'Add/edit salesman records' },
                        { key: PERMISSIONS.VIEW_CLIENTS, label: 'View Clients', desc: 'See client/party list' },
                        { key: PERMISSIONS.MANAGE_CLIENTS, label: 'Manage Clients', desc: 'Add/edit client records' },
                    ],
                },
            ],
        },
        {
            id: 'finance',
            title: 'Finance & Expenses',
            icon: <TrendingUp className="w-4 h-4" />,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10',
            border: 'border-emerald-500/30',
            subGroups: [
                {
                    title: 'Finance Access',
                    permissions: [
                        { key: PERMISSIONS.VIEW_FINANCE_DASHBOARD, label: 'Finance Dashboard', desc: 'View overall finance overview' },
                        { key: PERMISSIONS.VIEW_DEPT_FINANCE, label: 'Dept Finance Report', desc: 'Department-wise finance breakdown' },
                        { key: PERMISSIONS.VIEW_COST_CENTERS, label: 'Cost Centers', desc: 'View and manage cost center mapping' },
                        { key: PERMISSIONS.MANAGE_EXPENSES, label: 'Manage Expenses', desc: 'Add and track team expenses' },
                        { key: PERMISSIONS.MANAGE_ADVANCE_SALARY, label: 'Manage Advance Salary', desc: 'Process advance salary requests' },
                    ],
                },
                {
                    title: 'Self Finance (Employee)',
                    permissions: [
                        { key: PERMISSIONS.SUBMIT_EXPENSE, label: 'Submit Expense', desc: 'Employee apna expense claim kare' },
                        { key: PERMISSIONS.VIEW_OWN_EXPENSES, label: 'View Own Expenses', desc: 'Khud ke submitted expenses dekhe' },
                        { key: PERMISSIONS.REQUEST_ADVANCE_SALARY, label: 'Request Advance Salary', desc: 'Employee advance salary ke liye apply kare' },
                    ],
                },
            ],
        },
        {
            id: 'reports',
            title: 'Reports',
            icon: <BarChart2 className="w-4 h-4" />,
            color: 'text-indigo-400',
            bg: 'bg-indigo-500/10',
            border: 'border-indigo-500/30',
            subGroups: [
                {
                    title: 'Report Access',
                    permissions: [
                        { key: PERMISSIONS.VIEW_REPORTS, label: 'View Reports', desc: 'Access pre-built reports' },
                        { key: PERMISSIONS.BUILD_REPORTS, label: 'Build Reports', desc: 'Create custom report queries' },
                        { key: PERMISSIONS.EXPORT_REPORTS, label: 'Export Reports', desc: 'Download reports as PDF/Excel' },
                        { key: PERMISSIONS.SCHEDULE_REPORTS, label: 'Schedule Reports', desc: 'Set automated report delivery' },
                        { key: PERMISSIONS.VIEW_OWN_REPORTS, label: 'View Own Reports', desc: 'Employee khud ki performance/production report dekhe' },
                    ],
                },
            ],
        },
        {
            id: 'statutory',
            title: 'Statutory & Compliance',
            icon: <FileText className="w-4 h-4" />,
            color: 'text-cyan-400',
            bg: 'bg-cyan-500/10',
            border: 'border-cyan-500/30',
            subGroups: [
                {
                    title: 'Statutory Access',
                    permissions: [
                        { key: PERMISSIONS.VIEW_STATUTORY, label: 'View Statutory Reports', desc: 'Access PF, ESI, PT reports' },
                        { key: PERMISSIONS.MANAGE_STATUTORY, label: 'Manage Statutory', desc: 'Edit compliance settings' },
                        { key: PERMISSIONS.VIEW_FORM16, label: 'Form 16', desc: 'Access Form 16 generation' },
                    ],
                },
            ],
        },
        {
            id: 'system',
            title: 'System & Admin Tools',
            icon: <Database className="w-4 h-4" />,
            color: 'text-red-400',
            bg: 'bg-red-500/10',
            border: 'border-red-500/30',
            subGroups: [
                {
                    title: 'Admin Privileges',
                    permissions: [
                        { key: PERMISSIONS.VIEW_AUDIT_LOGS, label: 'Audit Logs', desc: 'View system activity log' },
                        { key: PERMISSIONS.DATABASE_BACKUP, label: 'Database Backup', desc: 'Trigger and restore DB backups', danger: true },
                        { key: PERMISSIONS.MANAGE_TRASH, label: 'Manage Trash', desc: 'Manage trash records', danger: true },
                        { key: PERMISSIONS.RESTORE_DELETED, label: 'Restore Deleted Records', desc: 'Trash se records restore kare' },
                        { key: PERMISSIONS.VIEW_SECURITY_ALERTS, label: 'Security Alerts', desc: 'View login failures and breach alerts' },
                        { key: PERMISSIONS.DATA_CONSISTENCY_CHECK, label: 'Data Consistency', desc: 'Run data validity checks' },
                        { key: PERMISSIONS.MANAGE_COMPANY_SWITCH, label: 'Company Switcher', desc: 'Switch between companies', danger: true },
                        { key: PERMISSIONS.MANAGE_SETTINGS, label: 'System Settings', desc: 'Access full Configuration panel', danger: true },
                        { key: PERMISSIONS.MANAGE_COMPANY, label: 'Manage Company', desc: 'Edit company profile & details', danger: true },
                        { key: PERMISSIONS.MANAGE_ROLES, label: 'Manage Roles', desc: 'Change employee role assignments', danger: true },
                    ],
                },
            ],
        },
        {
            id: 'announcements',
            title: 'Announcements',
            icon: <Globe className="w-4 h-4" />,
            color: 'text-sky-400',
            bg: 'bg-sky-500/10',
            border: 'border-sky-500/30',
            subGroups: [
                {
                    title: 'Communication',
                    permissions: [
                        { key: PERMISSIONS.VIEW_ANNOUNCEMENTS, label: 'View Announcements', desc: 'Company notices/announcements dekhe' },
                        { key: PERMISSIONS.SEND_ANNOUNCEMENTS, label: 'Send Announcements', desc: 'Team ya company ko notice bheje' },
                    ],
                },
            ],
        },
        {
            id: 'configuration',
            title: 'Configuration',
            icon: <Network className="w-4 h-4" />,
            color: 'text-slate-400',
            bg: 'bg-slate-500/10',
            border: 'border-slate-500/30',
            subGroups: [
                {
                    title: 'Company Setup',
                    permissions: [
                        { key: PERMISSIONS.MANAGE_DEPARTMENTS, label: 'Manage Departments', desc: 'Department create, edit, delete kare' },
                        { key: PERMISSIONS.MANAGE_SHIFTS, label: 'Manage Shifts', desc: 'Shift timings define/edit kare' },
                        { key: PERMISSIONS.MANAGE_WORK_GROUPS, label: 'Manage Work Groups', desc: 'Work groups/teams manage kare' },
                    ],
                },
            ],
        },
        {
            id: 'approvals',
            title: 'Approvals',
            icon: <UserCheck className="w-4 h-4" />,
            color: 'text-purple-400',
            bg: 'bg-purple-500/10',
            border: 'border-purple-500/30',
            subGroups: [
                {
                    title: 'Approval Rights',
                    permissions: [
                        { key: PERMISSIONS.VIEW_APPROVALS, label: 'View Approvals', desc: 'See pending approvals list' },
                        { key: PERMISSIONS.PROCESS_APPROVALS, label: 'Process Approvals', desc: 'Approve / reject pending requests' },
                        { key: PERMISSIONS.USE_CALCULATORS, label: 'Use Calculators', desc: 'Access CTC, TDS, PF/ESI calculators' },
                    ],
                },
            ],
        },
    ];

// ─── Roles ───────────────────────────────────────────────────────────────────
const EDITABLE_ROLES: { role: Role; label: string; emoji: string; gradFrom: string; gradTo: string; ring: string }[] = [
    { role: Roles.ADMIN, label: 'Admin', emoji: '🛡️', gradFrom: 'from-blue-600', gradTo: 'to-blue-800', ring: 'ring-blue-500' },
    { role: Roles.ACCOUNT_ADMIN, label: 'Account Admin', emoji: '💼', gradFrom: 'from-violet-600', gradTo: 'to-violet-800', ring: 'ring-violet-500' },
    { role: Roles.MANAGER, label: 'Manager', emoji: '👔', gradFrom: 'from-emerald-600', gradTo: 'to-emerald-800', ring: 'ring-emerald-500' },
    { role: Roles.EMPLOYEE, label: 'Employee', emoji: '👤', gradFrom: 'from-slate-600', gradTo: 'to-slate-800', ring: 'ring-slate-400' },
];

// ─── Quick Presets ───────────────────────────────────────────────────────────
const PRESETS: { id: string; label: string; icon: React.ReactNode; scope: DataScope; color: string; border: string; bg: string; perms: string[] }[] = [
    {
        id: 'preset:factory', label: 'Factory Floor Manager', icon: <Factory className="w-5 h-5" />, scope: 'TEAM', color: 'text-amber-400', border: 'border-amber-500/30 hover:border-amber-500/60', bg: 'bg-amber-500/10 hover:bg-amber-500/20',
        perms: [
            PERMISSIONS.NAV_DASHBOARD, PERMISSIONS.NAV_ATTENDANCE, PERMISSIONS.NAV_PRODUCTION, PERMISSIONS.NAV_EMPLOYEES,
            PERMISSIONS.VIEW_EMPLOYEES, PERMISSIONS.VIEW_EMPLOYEE_PERSONAL, PERMISSIONS.VIEW_OWN_PROFILE,
            PERMISSIONS.VIEW_ATTENDANCE, PERMISSIONS.APPROVE_ATTENDANCE, PERMISSIONS.MANUAL_ATTENDANCE, PERMISSIONS.ADD_MANUAL_PUNCH, PERMISSIONS.VIEW_TEAM_ATTENDANCE, PERMISSIONS.USE_FACE_KIOSK,
            PERMISSIONS.MARK_OWN_ATTENDANCE, PERMISSIONS.VIEW_OWN_ATTENDANCE, PERMISSIONS.REQUEST_REGULARIZATION,
            PERMISSIONS.VIEW_PRODUCTION, PERMISSIONS.ADD_PRODUCTION, PERMISSIONS.APPROVE_PRODUCTION, PERMISSIONS.VIEW_PRODUCTION_REPORTS
        ]
    },
    {
        id: 'preset:hr', label: 'HR Executive', icon: <Users className="w-5 h-5" />, scope: 'ALL', color: 'text-blue-400', border: 'border-blue-500/30 hover:border-blue-500/60', bg: 'bg-blue-500/10 hover:bg-blue-500/20',
        perms: [
            PERMISSIONS.NAV_DASHBOARD, PERMISSIONS.NAV_EMPLOYEES, PERMISSIONS.NAV_ATTENDANCE, PERMISSIONS.NAV_LEAVES, PERMISSIONS.NAV_APPROVALS,
            PERMISSIONS.VIEW_EMPLOYEES, PERMISSIONS.ADD_EMPLOYEE, PERMISSIONS.EDIT_EMPLOYEE, PERMISSIONS.VIEW_EMPLOYEE_PERSONAL, PERMISSIONS.VIEW_EMPLOYEE_DOCUMENTS, PERMISSIONS.EXPORT_EMPLOYEES,
            PERMISSIONS.VIEW_OWN_PROFILE, PERMISSIONS.UPDATE_OWN_PROFILE, PERMISSIONS.UPLOAD_OWN_DOCUMENTS,
            PERMISSIONS.VIEW_ATTENDANCE, PERMISSIONS.EDIT_ATTENDANCE, PERMISSIONS.MANAGE_HOLIDAYS, PERMISSIONS.VIEW_ATTENDANCE_REPORTS,
            PERMISSIONS.MARK_OWN_ATTENDANCE, PERMISSIONS.VIEW_OWN_ATTENDANCE, PERMISSIONS.REQUEST_REGULARIZATION,
            PERMISSIONS.VIEW_LEAVES, PERMISSIONS.APPROVE_LEAVES, PERMISSIONS.MANAGE_LEAVES, PERMISSIONS.VIEW_ALL_LEAVES, PERMISSIONS.MANAGE_LEAVE_BALANCE,
            PERMISSIONS.VIEW_APPROVALS, PERMISSIONS.PROCESS_APPROVALS
        ]
    },
    {
        id: 'preset:accountant', label: 'Accountant', icon: <Banknote className="w-5 h-5" />, scope: 'ALL', color: 'text-emerald-400', border: 'border-emerald-500/30 hover:border-emerald-500/60', bg: 'bg-emerald-500/10 hover:bg-emerald-500/20',
        perms: [
            PERMISSIONS.NAV_DASHBOARD, PERMISSIONS.NAV_PAYROLL, PERMISSIONS.NAV_EXPENSES, PERMISSIONS.NAV_FINANCE, PERMISSIONS.NAV_LOANS, PERMISSIONS.NAV_CALCULATORS, PERMISSIONS.NAV_REPORTS, PERMISSIONS.NAV_STATUTORY,
            PERMISSIONS.VIEW_PAYROLL, PERMISSIONS.GENERATE_PAYROLL, PERMISSIONS.APPROVE_PAYROLL, PERMISSIONS.RUN_PAYROLL_SIMULATION, PERMISSIONS.VIEW_ALL_PAYSLIPS, PERMISSIONS.VIEW_SALARY,
            PERMISSIONS.VIEW_FINANCE_DASHBOARD, PERMISSIONS.VIEW_DEPT_FINANCE, PERMISSIONS.VIEW_COST_CENTERS, PERMISSIONS.MANAGE_EXPENSES, PERMISSIONS.MANAGE_ADVANCE_SALARY,
            PERMISSIONS.VIEW_OWN_EXPENSES, PERMISSIONS.SUBMIT_EXPENSE, PERMISSIONS.REQUEST_ADVANCE_SALARY,
            PERMISSIONS.VIEW_ALL_LOANS, PERMISSIONS.MANAGE_LOANS, PERMISSIONS.APPROVE_LOANS,
            PERMISSIONS.VIEW_REPORTS, PERMISSIONS.BUILD_REPORTS, PERMISSIONS.EXPORT_REPORTS, PERMISSIONS.SCHEDULE_REPORTS,
            PERMISSIONS.VIEW_STATUTORY, PERMISSIONS.MANAGE_STATUTORY, PERMISSIONS.VIEW_FORM16,
            PERMISSIONS.USE_CALCULATORS, PERMISSIONS.VIEW_EMPLOYEES, PERMISSIONS.VIEW_EMPLOYEE_FINANCIALS, PERMISSIONS.VIEW_EMPLOYEE_BANK, PERMISSIONS.EDIT_EMPLOYEE_FINANCIALS
        ]
    },
    {
        id: 'preset:sales', label: 'Sales Rep', icon: <ShoppingBag className="w-5 h-5" />, scope: 'OWN', color: 'text-rose-400', border: 'border-rose-500/30 hover:border-rose-500/60', bg: 'bg-rose-500/10 hover:bg-rose-500/20',
        perms: [
            PERMISSIONS.NAV_DASHBOARD, PERMISSIONS.NAV_SALESMAN, PERMISSIONS.VIEW_SALESMAN, PERMISSIONS.VIEW_CLIENTS,
            PERMISSIONS.VIEW_OWN_PROFILE, PERMISSIONS.UPDATE_OWN_PROFILE, PERMISSIONS.MARK_OWN_ATTENDANCE, PERMISSIONS.VIEW_OWN_ATTENDANCE,
            PERMISSIONS.REQUEST_REGULARIZATION, PERMISSIONS.VIEW_PAYSLIP, PERMISSIONS.VIEW_OWN_LOANS, PERMISSIONS.REQUEST_LOAN,
            PERMISSIONS.REQUEST_LEAVES, PERMISSIONS.VIEW_OWN_EXPENSES, PERMISSIONS.SUBMIT_EXPENSE, PERMISSIONS.REQUEST_ADVANCE_SALARY,
            PERMISSIONS.VIEW_OWN_REPORTS, PERMISSIONS.VIEW_ANNOUNCEMENTS
        ]
    }
];

// ─── Main Component ───────────────────────────────────────────────────────────
export const RoleAccessConfig = () => {
    const { user } = useAuthStore();
    const { permissions, scopes, setPermissions, resetRole, resetAll, _hydrated } = useRolePermissionsStore();
    const { addLog } = useAuditStore();
    const navigate = useNavigate();
    const { toast } = useDialog();
    const { alertRoleChange } = useSecurityAlerts();

    // ── Draft state: local copy of permissions/scopes before Save ──────────────
    const [draftPerms, setDraftPerms] = useState<Record<string, string[]>>(() => {
        const map: Record<string, string[]> = {};
        EDITABLE_ROLES.forEach(({ role }) => { map[role] = [...(permissions[role] ?? [])]; });
        return map;
    });
    const [draftScopes, setDraftScopes] = useState<Record<string, DataScope>>(() => {
        const map: Record<string, DataScope> = {};
        EDITABLE_ROLES.forEach(({ role }) => { map[role] = scopes[role] ?? 'ALL'; });
        return map;
    });
    const [savedAt, setSavedAt] = useState<string | null>(null);

    const [selectedRole, setSelectedRole] = useState<Role>(Roles.ADMIN);
    const [expandedGroups, setExpandedGroups] = useState<string[]>(['sidebar', 'employees']);
    const [searchQuery, setSearchQuery] = useState('');
    const [showDangerOnly, setShowDangerOnly] = useState(false);
    const [warning, setWarning] = useState<{
        isOpen: boolean; title: string; message: string; onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    // Sync draft once localStorage hydration is complete (after _hydrated flips true)
    useEffect(() => {
        if (!_hydrated) return; // wait until localStorage data is loaded
        const perms: Record<string, string[]> = {};
        const scopeMap: Record<string, DataScope> = {};
        EDITABLE_ROLES.forEach(({ role }) => {
            perms[role] = [...(permissions[role] ?? [])];
            scopeMap[role] = scopes[role] ?? 'ALL';
        });
        setDraftPerms(perms);
        setDraftScopes(scopeMap);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [_hydrated]);

    if (!user || user.role !== Roles.SUPER_ADMIN) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
                    <Lock className="w-10 h-10 text-red-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Access Denied</h2>
                <p className="text-slate-400 text-center max-w-sm">Only the Super Admin can manage Role Permissions.</p>
            </div>
        );
    }

    // ── Computed from draft ──────────────────────────────────────────────────
    const activePerms = draftPerms[selectedRole] ?? permissions[selectedRole] ?? [];
    const savedPerms = permissions[selectedRole] ?? [];
    const activeRoleMeta = EDITABLE_ROLES.find(r => r.role === selectedRole)!;
    const totalPermCount = Object.keys(PERMISSIONS).length;
    const enabledCount = activePerms.length;

    // Check if any role has unsaved changes vs persisted store
    const hasUnsaved = EDITABLE_ROLES.some(({ role }) => {
        const draft = draftPerms[role] ?? [];
        const saved = permissions[role] ?? [];
        if (draft.length !== saved.length) return true;
        if ((draftScopes[role] ?? scopes[role]) !== scopes[role]) return true;
        return draft.some(p => !saved.includes(p as PermissionValue));
    });

    // ── Draft toggle (does NOT touch the store) ──────────────────────────────
    const toggleDraft = (role: Role, permission: string) => {
        setDraftPerms(prev => {
            const current = prev[role] ?? [];
            const has = current.includes(permission);
            return { ...prev, [role]: has ? current.filter(p => p !== permission) : [...current, permission] };
        });
        setSavedAt(null);
    };

    // ── Save: atomically write all drafts to Zustand store (persisted to localStorage) ─
    const saveChanges = () => {
        const permsToSave: Record<string, PermissionValue[]> = {};
        const scopesToSave: Record<string, DataScope> = {};

        let hasChanges = false;
        const details: any = {};
        let hasDangerousChanges = false;

        const isDanger = (pKey: string) => {
            for (const group of PERMISSION_GROUPS) {
                for (const sg of group.subGroups) {
                    const perm = sg.permissions.find(p => p.key === pKey);
                    if (perm) return !!perm.danger;
                }
            }
            return false;
        };

        EDITABLE_ROLES.forEach(({ role }) => {
            const newPerms = (draftPerms[role] ?? []) as PermissionValue[];
            const newScope = draftScopes[role] ?? scopes[role] ?? 'ALL';

            permsToSave[role] = newPerms;
            scopesToSave[role] = newScope;

            const oldPerms = permissions[role] ?? [];
            const oldScope = scopes[role] ?? 'ALL';

            const added = newPerms.filter(p => !oldPerms.includes(p));
            const removed = oldPerms.filter(p => !newPerms.includes(p));

            if (added.length > 0 || removed.length > 0 || oldScope !== newScope) {
                hasChanges = true;
                details[role] = {};
                if (added.length > 0) details[role].added = added;
                if (removed.length > 0) details[role].removed = removed;
                if (oldScope !== newScope) details[role].scope = { from: oldScope, to: newScope };

                if (added.some(isDanger) || removed.some(isDanger)) {
                    hasDangerousChanges = true;
                }

                // Fire Security Alert for the role modification
                alertRoleChange(role, added.length, removed.length);
            }
        });

        setPermissions(permsToSave as any, scopesToSave as any);
        setSavedAt(new Date().toLocaleTimeString());

        if (hasChanges && user) {
            addLog({
                userId: user.id || 'system',
                userName: user.name || 'Super Admin',
                userRole: user.role,
                action: 'PERMISSION_CHANGE',
                entityType: 'SETTINGS',
                entityId: 'role-permissions',
                entityName: 'Role Permissions & Scopes',
                details,
                ipAddress: '127.0.0.1',
                userAgent: navigator.userAgent,
                status: 'SUCCESS'
            });

            if (hasDangerousChanges) {
                toast('Sensitive permissions were modified! An audit log has been generated.', 'warning');
            } else {
                toast('Permissions saved successfully.', 'success');
            }
        }
    };

    // ── Discard: restore draft from persisted store ──────────────────────────
    const discardChanges = () => {
        const perms: Record<string, string[]> = {};
        const scopeMap: Record<string, DataScope> = {};
        EDITABLE_ROLES.forEach(({ role }) => {
            perms[role] = [...(permissions[role] ?? [])];
            scopeMap[role] = scopes[role] ?? 'ALL';
        });
        setDraftPerms(perms);
        setDraftScopes(scopeMap);
    };

    // ── Reset helpers that also clear draft ─────────────────────────────────
    const handleResetRole = (role: Role) => {
        resetRole(role);
        const st = useRolePermissionsStore.getState();
        setDraftPerms(prev => ({ ...prev, [role]: [...(st.permissions[role] ?? [])] }));
        setDraftScopes(prev => ({ ...prev, [role]: st.scopes[role] ?? 'OWN' }));
    };
    const handleResetAll = () => {
        resetAll();
        const st = useRolePermissionsStore.getState();
        const perms: Record<string, string[]> = {};
        const scopeMap: Record<string, DataScope> = {};
        EDITABLE_ROLES.forEach(({ role }) => {
            perms[role] = [...(st.permissions[role] ?? [])];
            scopeMap[role] = st.scopes[role] ?? 'ALL';
        });
        setDraftPerms(perms);
        setDraftScopes(scopeMap);
    };

    const toggleGroup = (id: string) =>
        setExpandedGroups(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);

    const groupMatchesSearch = (group: typeof PERMISSION_GROUPS[0]) => {
        if (!searchQuery && !showDangerOnly) return true;
        return group.subGroups.some(sg =>
            sg.permissions.some(p => {
                const matchesQuery = !searchQuery || p.label.toLowerCase().includes(searchQuery.toLowerCase()) || p.desc.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesDanger = !showDangerOnly || p.danger;
                return matchesQuery && matchesDanger;
            })
        );
    };

    const permMatchesFilter = (p: { label: string; desc: string; danger?: boolean }) => {
        const matchesQuery = !searchQuery || p.label.toLowerCase().includes(searchQuery.toLowerCase()) || p.desc.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDanger = !showDangerOnly || p.danger;
        return matchesQuery && matchesDanger;
    };

    return (
        <div className="space-y-6">
            {/* Sticky Unsaved Banner */}
            {hasUnsaved && (
                <div className="sticky top-0 z-40 flex items-center justify-between gap-4 px-5 py-3 bg-amber-500/10 border border-amber-500/40 rounded-2xl backdrop-blur-sm shadow-xl">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-semibold text-amber-300">Unsaved changes — click Save to apply permissions</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={discardChanges} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-400 hover:text-white bg-slate-800 border border-slate-700 rounded-lg transition-all">
                            <X className="w-3.5 h-3.5" /> Discard
                        </button>
                        <button onClick={saveChanges} className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-all shadow-lg shadow-emerald-600/20">
                            <Save className="w-3.5 h-3.5" /> Save Changes
                        </button>
                    </div>
                </div>
            )}
            {!hasUnsaved && savedAt && (
                <div className="flex items-center gap-2 px-5 py-3 bg-green-500/10 border border-green-500/30 rounded-2xl">
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-green-300">Permissions saved at {savedAt} — active until Super Admin changes them.</span>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <ShieldCheck className="w-7 h-7 text-rose-400" />
                        Role Access Control
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                        Super Admin controls — decide exactly what each role can see and do.
                    </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
                    <button
                        onClick={() => useAuthStore.getState().setImpersonatedRole(selectedRole)}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-xl text-sm font-bold transition-all border border-amber-500/30 shadow-lg shadow-amber-500/10"
                    >
                        <Eye className="w-4 h-4" /> Preview as {activeRoleMeta.label}
                    </button>
                    <button
                        onClick={() => navigate('/admin/audit-logs?filter=permissions')}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-all border border-slate-700"
                    >
                        <ShieldCheck className="w-4 h-4 text-yellow-400" /> Permission History
                    </button>
                    <button
                        onClick={() => setWarning({
                            isOpen: true, title: 'Reset ALL Roles?',
                            message: 'This will reset every role back to factory defaults. All customizations will be lost.',
                            onConfirm: () => handleResetAll(),
                        })}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-sm font-medium transition-all border border-red-500/30"
                    >
                        <RotateCcw className="w-4 h-4" /> Reset All Roles
                    </button>
                </div>
            </div>

            {/* Role Selector Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {EDITABLE_ROLES.map(({ role, label, emoji, gradFrom, gradTo, ring }) => {
                    const perms = draftPerms[role] ?? permissions[role] ?? [];
                    const savedLen = (permissions[role] ?? []).length;
                    const isDirty = perms.length !== savedLen || perms.some(p => !(permissions[role] ?? []).includes(p as PermissionValue));
                    const isSelected = selectedRole === role;
                    const pct = Math.round((perms.length / totalPermCount) * 100);
                    return (
                        <button
                            key={role}
                            onClick={() => setSelectedRole(role)}
                            className={`relative p-4 rounded-2xl border text-left transition-all duration-200 ${isSelected
                                ? `bg-gradient-to-br ${gradFrom}/${30} ${gradTo}/${10} ring-1 ${ring}/50 border-transparent shadow-xl scale-[1.02]`
                                : 'bg-slate-800/40 border-slate-700 hover:border-slate-500 hover:scale-[1.01]'
                                }`}
                        >
                            <div className="text-2xl mb-2">{emoji}</div>
                            <div className="font-bold text-white text-sm mb-1">{label}{isDirty && <span className="ml-1 text-amber-400">*</span>}</div>
                            <div className="text-xs text-slate-400 mb-2">{perms.length} / {totalPermCount} permissions</div>
                            {/* Progress bar */}
                            <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all bg-gradient-to-r ${gradFrom} ${gradTo}`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                            {isSelected && (
                                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                                    <Check className="w-3 h-3 text-white" />
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Quick Presets */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
                <div className="mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Zap className="w-5 h-5 text-amber-400" />
                        Quick Presets
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                        Apply pre-configured templates for <strong>{activeRoleMeta.label}</strong>
                    </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {PRESETS.map((preset) => (
                        <button
                            key={preset.id}
                            onClick={() => {
                                setWarning({
                                    isOpen: true,
                                    title: `Apply ${preset.label}?`,
                                    message: `This will overwrite current draft permissions and set visibility to ${preset.scope} for the ${activeRoleMeta.label} role.`,
                                    onConfirm: () => {
                                        setDraftPerms(prev => ({ ...prev, [selectedRole]: preset.perms }));
                                        setDraftScopes(prev => ({ ...prev, [selectedRole]: preset.scope }));
                                        toast(`Applied ${preset.label} preset to draft.`, 'success');
                                    }
                                });
                            }}
                            className={`flex flex-col gap-3 p-4 rounded-xl border transition-all text-left bg-slate-900/50 hover:-translate-y-0.5 ${preset.border} ${preset.bg}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center ${preset.color}`}>
                                    {preset.icon}
                                </div>
                                <div className="font-bold text-sm text-white">{preset.label}</div>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                                <span className="bg-slate-800 border border-slate-700 px-2 py-1 rounded-md">{preset.perms.length} perms</span>
                                <span className="bg-slate-800 border border-slate-700 px-2 py-1 rounded-md text-[10px] uppercase tracking-wider">{preset.scope} Data</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Data Visibility Level */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
                <div className="mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Eye className="w-5 h-5 text-blue-400" />
                        <InfoTip id="roleScope" label="Data Visibility Level" />
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                        Whose data can the <strong>{activeRoleMeta.label}</strong> role see across the system?
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                        { scope: 'ALL' as DataScope, label: 'Everything (ALL)', desc: 'Can see all employees and data across the entire company', icon: Globe, color: 'text-indigo-400', border: 'border-indigo-500/50', bg: 'bg-indigo-500/10' },
                        { scope: 'TEAM' as DataScope, label: 'Team Only (TEAM)', desc: 'Can see data only for employees in their own department', icon: Network, color: 'text-emerald-400', border: 'border-emerald-500/50', bg: 'bg-emerald-500/10' },
                        { scope: 'OWN' as DataScope, label: 'Own Only (OWN)', desc: 'Can see only their personal data and records', icon: User, color: 'text-amber-400', border: 'border-amber-500/50', bg: 'bg-amber-500/10' },
                    ].map(({ scope, label, desc, icon: Icon, color, border, bg }) => {
                        const isSelected = (draftScopes[selectedRole] ?? scopes[selectedRole]) === scope;
                        return (
                            <button
                                key={scope}
                                onClick={() => setDraftScopes(prev => ({ ...prev, [selectedRole]: scope }))}
                                className={`text-left p-4 rounded-xl border transition-all ${isSelected
                                    ? `${bg} ${border} ring-1 ring-white/10 shadow-lg scale-[1.02]`
                                    : 'bg-slate-900/50 border-slate-700 hover:border-slate-500 opacity-60 hover:opacity-100 cursor-pointer'
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Icon className={`w-5 h-5 ${isSelected ? color : 'text-slate-400'}`} />
                                        <span className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-slate-300'}`}>{label}</span>
                                    </div>
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? `border-transparent ${bg} ${color}` : 'border-slate-600'
                                        }`}>
                                        {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-current" />}
                                    </div>
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Controls Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="relative flex-1">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search permissions..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary-500 outline-none pl-10"
                    />
                    <Eye className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                </div>
                <button
                    onClick={() => setShowDangerOnly(!showDangerOnly)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border ${showDangerOnly
                        ? 'bg-red-500/20 border-red-500/40 text-red-400'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-red-400'
                        }`}
                >
                    <AlertTriangle className="w-4 h-4" />
                    Sensitive Only
                </button>
                <button
                    onClick={() => setExpandedGroups(PERMISSION_GROUPS.map(g => g.id))}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                >
                    Expand All
                </button>
                <button
                    onClick={() => setWarning({
                        isOpen: true,
                        title: `Reset "${activeRoleMeta.label}"?`,
                        message: `Reset the "${activeRoleMeta.label}" role back to its default permissions?`,
                        onConfirm: () => handleResetRole(selectedRole),
                    })}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                >
                    <RotateCcw className="w-4 h-4" />
                    Reset Role
                </button>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-center">
                    <div className="text-2xl font-bold text-green-400">{enabledCount}</div>
                    <div className="text-xs text-slate-400">Draft Enabled</div>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-center">
                    <div className="text-2xl font-bold text-red-400">{totalPermCount - enabledCount}</div>
                    <div className="text-xs text-slate-400">Draft Blocked</div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 text-center">
                    <div className="text-2xl font-bold text-blue-300">{savedPerms.length}</div>
                    <div className="text-xs text-slate-400">Saved &amp; Active</div>
                </div>
            </div>

            {/* Permission Groups */}
            <div className="flex items-center gap-2 mb-3">
                <InfoTip id="permissionToggle" label="Permission Groups" />
            </div>
            <div className="space-y-3">
                {PERMISSION_GROUPS.filter(groupMatchesSearch).map(group => {
                    const isExpanded = expandedGroups.includes(group.id);
                    const allPermsInGroup = group.subGroups.flatMap(sg => sg.permissions.map(p => p.key));
                    const enabledInGroup = allPermsInGroup.filter(k => activePerms.includes(k as PermissionValue)).length;
                    const totalInGroup = allPermsInGroup.length;

                    return (
                        <div key={group.id} className={`border rounded-2xl overflow-hidden ${group.border} bg-slate-800/30`}>
                            {/* Group Header */}
                            <button
                                onClick={() => toggleGroup(group.id)}
                                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-700/30 transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg ${group.bg} flex items-center justify-center ${group.color}`}>
                                        {group.icon}
                                    </div>
                                    <div className="text-left">
                                        <span className="font-bold text-white text-sm">{group.title}</span>
                                        <div className="text-xs text-slate-500">{enabledInGroup} / {totalInGroup} active</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {/* Mini progress */}
                                    <div className="hidden sm:flex items-center gap-2">
                                        <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-green-500/70 transition-all"
                                                style={{ width: totalInGroup > 0 ? `${(enabledInGroup / totalInGroup) * 100}%` : '0%' }}
                                            />
                                        </div>
                                        <span className="text-xs text-slate-500">{totalInGroup > 0 ? Math.round((enabledInGroup / totalInGroup) * 100) : 0}%</span>
                                    </div>
                                    {isExpanded
                                        ? <ChevronDown className="w-4 h-4 text-slate-400" />
                                        : <ChevronRight className="w-4 h-4 text-slate-400" />
                                    }
                                </div>
                            </button>

                            {/* Group Body */}
                            {isExpanded && (
                                <div className="px-5 pb-5 space-y-5 border-t border-slate-700/50 pt-4">
                                    {group.subGroups.map(sg => {
                                        const filtered = sg.permissions.filter(permMatchesFilter);
                                        if (filtered.length === 0) return null;
                                        return (
                                            <div key={sg.title}>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">{sg.title}</p>
                                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                                                    {filtered.map(({ key, label, desc, danger }) => {
                                                        const isOn = activePerms.includes(key as PermissionValue);
                                                        return (
                                                            <button
                                                                key={key}
                                                                onClick={() => toggleDraft(selectedRole, key)}
                                                                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all group ${isOn
                                                                    ? danger
                                                                        ? 'bg-red-500/10 border-red-500/40 hover:bg-red-500/15'
                                                                        : 'bg-green-500/10 border-green-500/40 hover:bg-green-500/15'
                                                                    : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600'
                                                                    }`}
                                                            >
                                                                <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center transition-all ${isOn ? (danger ? 'bg-red-500/20' : 'bg-green-500/20') : 'bg-slate-700/60'
                                                                    }`}>
                                                                    {isOn
                                                                        ? <Check className={`w-4 h-4 ${danger ? 'text-red-400' : 'text-green-400'}`} />
                                                                        : <X className="w-4 h-4 text-slate-600" />
                                                                    }
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <p className={`text-sm font-semibold truncate ${isOn ? (danger ? 'text-red-300' : 'text-green-300') : 'text-slate-400'
                                                                            }`}>{label}</p>
                                                                        {danger && <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                                                                    </div>
                                                                    <p className="text-[11px] text-slate-500 truncate">{desc}</p>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Super Admin Lock Notice */}
            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-yellow-500/10 to-amber-500/5 border border-yellow-500/20 rounded-xl">
                <Zap className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                <div className="text-sm text-yellow-300/80">
                    <strong className="text-yellow-400">Super Admin</strong> always has all {totalPermCount} permissions and cannot be restricted. These settings only apply to the 4 editable roles above.
                </div>
            </div>

            <WarningModal
                isOpen={warning.isOpen}
                onClose={() => setWarning(p => ({ ...p, isOpen: false }))}
                onConfirm={warning.onConfirm}
                title={warning.title}
                message={warning.message}
                severity="danger"
                confirmText="Yes, Proceed"
            />
        </div>
    );
};
