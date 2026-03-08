import { useState } from 'react';
import {
    ShieldCheck, RotateCcw, Lock, Check, X,
    Users, CalendarClock, Banknote, Factory, Wallet,
    UserCheck,
    TrendingUp, BarChart2, ShoppingBag,
    FileText, Database,
    Eye, Navigation, ChevronDown, ChevronRight,
    AlertTriangle, Zap, Globe, User, Building
} from 'lucide-react';
import { useRolePermissionsStore, DataScope, DataVisibility } from '@/store/rolePermissionsStore';
import { useAuthStore } from '@/store/authStore';
import { PERMISSIONS } from '@/config/permissions';
import { Roles, Role } from '@/types';
import type { PermissionValue } from '@/config/permissions';
import { WarningModal } from '@/components/ui/WarningModal';

// ─── Data Scope Options ───────────────────────────────────────────────────────
const SCOPE_OPTIONS: {
    scope: DataScope;
    label: string;
    subLabel: string;
    icon: React.ReactNode;
    example: string;
    color: string;
    ring: string;
    bg: string;
}[] = [
        {
            scope: 'OWN',
            label: 'Only Own Data',
            subLabel: 'Apna hi dekh sakta hai',
            icon: <User className="w-5 h-5" />,
            example: 'Employee: Sirf apni attendance, apna payslip, apna loan',
            color: 'text-slate-300',
            ring: 'ring-slate-500',
            bg: 'bg-slate-700/50',
        },
        {
            scope: 'TEAM',
            label: 'Team Data',
            subLabel: 'Apni team ka dikh sakta hai',
            icon: <Users className="w-5 h-5" />,
            example: 'Manager: Apni team ke employees ka attendance, leave, production',
            color: 'text-emerald-300',
            ring: 'ring-emerald-500',
            bg: 'bg-emerald-700/20',
        },
        {
            scope: 'DEPARTMENT',
            label: 'Department Data',
            subLabel: 'Pure department ka dikh sakta hai',
            icon: <Building className="w-5 h-5" />,
            example: 'Dept Head: Apne pore department ke records',
            color: 'text-blue-300',
            ring: 'ring-blue-500',
            bg: 'bg-blue-700/20',
        },
        {
            scope: 'ALL',
            label: 'Company-wide',
            subLabel: 'Sabka data dekh sakta hai',
            icon: <Globe className="w-5 h-5" />,
            example: 'Admin: Sab employees ka sab kuch',
            color: 'text-violet-300',
            ring: 'ring-violet-500',
            bg: 'bg-violet-700/20',
        },
    ];

// ─── Data Visibility Flags ────────────────────────────────────────────────────
const VISIBILITY_FLAGS: { key: keyof Omit<DataVisibility, 'scope'>; label: string; desc: string; danger?: boolean }[] = [
    { key: 'canSeeOthersSalary', label: 'Doosron ki Salary', desc: 'Other employees ke salary figures dekh sakta hai', danger: true },
    { key: 'canSeeOthersAttendance', label: 'Doosron ki Attendance', desc: 'Other employees ki attendance records dekh sakta hai' },
    { key: 'canSeeOthersLeaves', label: 'Doosron ki Leaves', desc: 'Other employees ki leave history dekh sakta hai' },
    { key: 'canSeeOthersLoans', label: 'Doosron ke Loans', desc: 'Other employees ke loan details dekh sakta hai', danger: true },
    { key: 'canSeeOthersProduction', label: 'Doosron ki Production', desc: 'Other employees ki production data dekh sakta hai' },
    { key: 'canSeeOthersBankDetails', label: 'Bank / Aadhaar / PAN', desc: 'Sensitive financial identity data dekh sakta hai', danger: true },
    { key: 'canSeeOthersPersonalInfo', label: 'Personal Info (Phone/Address)', desc: 'Contact aur personal info dekh sakta hai' },
    { key: 'canEditOthersProfile', label: 'Doosron ka Profile Edit', desc: 'Other employees ki profile fields update kar sakta hai', danger: true },
    { key: 'canDownloadReports', label: 'Reports Download/Export', desc: 'Data Excel/PDF mein export kar sakta hai' },
    { key: 'canBulkOperate', label: 'Bulk Operations', desc: 'Bulk import, bulk edit, bulk actions kar sakta hai', danger: true },
];

// ─── Permission Groups ────────────────────────────────────────────────────────
const PERMISSION_GROUPS: {
    id: string; title: string; icon: React.ReactNode;
    color: string; bg: string; border: string;
    subGroups: { title: string; permissions: { key: string; label: string; desc: string; danger?: boolean }[] }[];
}[] = [
        {
            id: 'sidebar', title: 'Sidebar Visibility', icon: <Navigation className="w-4 h-4" />,
            color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/30',
            subGroups: [{
                title: 'Main Navigation',
                permissions: [
                    { key: PERMISSIONS.NAV_DASHBOARD, label: 'Dashboard', desc: 'Main dashboard link' },
                    { key: PERMISSIONS.NAV_EMPLOYEES, label: 'Employees', desc: 'Employee management' },
                    { key: PERMISSIONS.NAV_ATTENDANCE, label: 'Attendance', desc: 'Attendance section' },
                    { key: PERMISSIONS.NAV_SALESMAN, label: 'Salesman', desc: 'Salesman & Clients' },
                    { key: PERMISSIONS.NAV_PRODUCTION, label: 'Production', desc: 'Production entries' },
                    { key: PERMISSIONS.NAV_LEAVES, label: 'Leaves', desc: 'Leave requests' },
                    { key: PERMISSIONS.NAV_LOANS, label: 'Loans', desc: 'Loan management' },
                    { key: PERMISSIONS.NAV_APPROVALS, label: 'Approvals', desc: 'Approval center' },
                    { key: PERMISSIONS.NAV_PAYROLL, label: 'Payroll', desc: 'Payroll & payslips' },
                    { key: PERMISSIONS.NAV_EXPENSES, label: 'Expenses', desc: 'Expense tracking' },
                    { key: PERMISSIONS.NAV_FINANCE, label: 'Finance Modules', desc: 'Finance Dashboard, Dept Finance, Cost Centers' },
                    { key: PERMISSIONS.NAV_CALCULATORS, label: 'Calculators', desc: 'CTC, TDS, PF/ESI calculators' },
                    { key: PERMISSIONS.NAV_REPORTS, label: 'Reports', desc: 'Report builder' },
                    { key: PERMISSIONS.NAV_STATUTORY, label: 'Statutory', desc: 'Form 16 & compliance' },
                    { key: PERMISSIONS.NAV_SYSTEM, label: 'System Tools', desc: 'Audit, Backup, Security', danger: true },
                ],
            }],
        },
        {
            id: 'employees', title: 'Employees', icon: <Users className="w-4 h-4" />,
            color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30',
            subGroups: [{
                title: 'Employee Access',
                permissions: [
                    { key: PERMISSIONS.VIEW_EMPLOYEES, label: 'View Employee List', desc: 'Directory dekh sakta hai' },
                    { key: PERMISSIONS.ADD_EMPLOYEE, label: 'Add Employee', desc: 'Naye employee add kar sakta hai' },
                    { key: PERMISSIONS.EDIT_EMPLOYEE, label: 'Edit Employee', desc: 'Employee info update kar sakta hai' },
                    { key: PERMISSIONS.DELETE_EMPLOYEE, label: 'Delete Employee', desc: 'Employee delete kar sakta hai', danger: true },
                    { key: PERMISSIONS.VIEW_EMPLOYEE_SALARY, label: 'Salary Column Visible', desc: 'Employee list mein salary column dikhega' },
                    { key: PERMISSIONS.VIEW_EMPLOYEE_BANK, label: 'Bank / Aadhaar / PAN', desc: 'Sensitive ID info access kar sakta hai' },
                    { key: PERMISSIONS.EXPORT_EMPLOYEES, label: 'Export Employee Data', desc: 'Excel/PDF mein download kar sakta hai' },
                ],
            }],
        },
        {
            id: 'attendance', title: 'Attendance', icon: <CalendarClock className="w-4 h-4" />,
            color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30',
            subGroups: [{
                title: 'Attendance Controls',
                permissions: [
                    { key: PERMISSIONS.VIEW_ATTENDANCE, label: 'View Attendance', desc: 'Records dekh sakta hai' },
                    { key: PERMISSIONS.EDIT_ATTENDANCE, label: 'Edit Attendance', desc: 'Status override kar sakta hai' },
                    { key: PERMISSIONS.APPROVE_ATTENDANCE, label: 'Approve Regularization', desc: 'Regularization approve kar sakta hai' },
                    { key: PERMISSIONS.MANUAL_ATTENDANCE, label: 'Manual Punch', desc: 'Kisi ke liye Present/Absent mark kar sakta hai' },
                    { key: PERMISSIONS.MANAGE_HOLIDAYS, label: 'Manage Holidays', desc: 'Holiday calendar edit kar sakta hai' },
                    { key: PERMISSIONS.VIEW_ATTENDANCE_REPORTS, label: 'Attendance Reports', desc: 'Monthly/weekly reports dekh sakta hai' },
                    { key: PERMISSIONS.USE_FACE_KIOSK, label: 'Face Kiosk', desc: 'Facial recognition kiosk use kar sakta hai' },
                ],
            }],
        },
        {
            id: 'payroll', title: 'Payroll & Salary', icon: <Banknote className="w-4 h-4" />,
            color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30',
            subGroups: [{
                title: 'Payroll Controls',
                permissions: [
                    { key: PERMISSIONS.VIEW_PAYROLL, label: 'View Payroll', desc: 'Payroll dashboard dekh sakta hai' },
                    { key: PERMISSIONS.GENERATE_PAYROLL, label: 'Generate Payroll', desc: 'Payroll process kar sakta hai' },
                    { key: PERMISSIONS.APPROVE_PAYROLL, label: 'Approve Payroll', desc: 'Payroll authorize kar sakta hai' },
                    { key: PERMISSIONS.LOCK_PAYROLL, label: 'Lock Payroll', desc: 'Payroll cycle permanently lock kar sakta hai', danger: true },
                    { key: PERMISSIONS.RUN_PAYROLL_SIMULATION, label: 'Simulation', desc: 'Test payroll run kar sakta hai' },
                    { key: PERMISSIONS.VIEW_PAYSLIP, label: 'View Own Payslip', desc: 'Apna payslip dekh sakta hai' },
                    { key: PERMISSIONS.VIEW_ALL_PAYSLIPS, label: 'View All Payslips', desc: 'Sabke payslips dekh sakta hai' },
                    { key: PERMISSIONS.VIEW_SALARY, label: 'View Salary Amounts', desc: 'Net/gross salary figures dekh sakta hai' },
                ],
            }],
        },
        {
            id: 'loans', title: 'Loans', icon: <Wallet className="w-4 h-4" />,
            color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30',
            subGroups: [{
                title: 'Loan Access',
                permissions: [
                    { key: PERMISSIONS.VIEW_OWN_LOANS, label: 'Apna Loan Dekhe', desc: 'Sirf apne loan records dekh sakta hai' },
                    { key: PERMISSIONS.VIEW_ALL_LOANS, label: 'Sabke Loan Dekhe', desc: 'Sabke loan records dekh sakta hai' },
                    { key: PERMISSIONS.MANAGE_LOANS, label: 'Manage Loans', desc: 'Loan create aur edit kar sakta hai' },
                    { key: PERMISSIONS.APPROVE_LOANS, label: 'Approve Loans', desc: 'Loan approve/reject kar sakta hai' },
                ],
            }],
        },
        {
            id: 'leaves', title: 'Leaves', icon: <CalendarClock className="w-4 h-4" />,
            color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30',
            subGroups: [{
                title: 'Leave Management',
                permissions: [
                    { key: PERMISSIONS.VIEW_LEAVES, label: 'View Leaves', desc: 'Leave list dekh sakta hai' },
                    { key: PERMISSIONS.REQUEST_LEAVES, label: 'Apply Leave', desc: 'Apni leave apply kar sakta hai' },
                    { key: PERMISSIONS.APPROVE_LEAVES, label: 'Approve Leaves', desc: 'Leave approve/reject kar sakta hai' },
                    { key: PERMISSIONS.VIEW_ALL_LEAVES, label: 'Sabki Leaves Dekhe', desc: 'Sab employees ki leave history' },
                    { key: PERMISSIONS.MANAGE_LEAVE_BALANCE, label: 'Leave Balance Manage', desc: 'Balance add/deduct kar sakta hai' },
                ],
            }],
        },
        {
            id: 'production', title: 'Production', icon: <Factory className="w-4 h-4" />,
            color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30',
            subGroups: [{
                title: 'Production Controls',
                permissions: [
                    { key: PERMISSIONS.VIEW_PRODUCTION, label: 'View Production', desc: 'Production entries dekh sakta hai' },
                    { key: PERMISSIONS.ADD_PRODUCTION, label: 'Add Production', desc: 'Production records add kar sakta hai' },
                    { key: PERMISSIONS.APPROVE_PRODUCTION, label: 'Approve Production', desc: 'Production entries approve kar sakta hai' },
                    { key: PERMISSIONS.MANAGE_PRODUCTION_RATES, label: 'Manage Rates', desc: 'Production rates edit kar sakta hai' },
                    { key: PERMISSIONS.VIEW_PRODUCTION_REPORTS, label: 'Production Reports', desc: 'Production analytics dekh sakta hai' },
                    { key: PERMISSIONS.BULK_PRODUCTION_ENTRY, label: 'Bulk Entry', desc: 'Bulk upload kar sakta hai' },
                ],
            }],
        },
        {
            id: 'finance', title: 'Finance & Expenses', icon: <TrendingUp className="w-4 h-4" />,
            color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30',
            subGroups: [{
                title: 'Finance Access',
                permissions: [
                    { key: PERMISSIONS.VIEW_FINANCE_DASHBOARD, label: 'Finance Dashboard', desc: 'Finance overview dekh sakta hai' },
                    { key: PERMISSIONS.VIEW_DEPT_FINANCE, label: 'Dept Finance', desc: 'Department finance dekh sakta hai' },
                    { key: PERMISSIONS.VIEW_COST_CENTERS, label: 'Cost Centers', desc: 'Cost center mapping dekh sakta hai' },
                    { key: PERMISSIONS.MANAGE_EXPENSES, label: 'Manage Expenses', desc: 'Expenses add aur track kar sakta hai' },
                    { key: PERMISSIONS.MANAGE_ADVANCE_SALARY, label: 'Advance Salary', desc: 'Advance salary process kar sakta hai' },
                ],
            }],
        },
        {
            id: 'reports', title: 'Reports', icon: <BarChart2 className="w-4 h-4" />,
            color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30',
            subGroups: [{
                title: 'Report Access',
                permissions: [
                    { key: PERMISSIONS.VIEW_REPORTS, label: 'View Reports', desc: 'Pre-built reports dekh sakta hai' },
                    { key: PERMISSIONS.BUILD_REPORTS, label: 'Build Reports', desc: 'Custom reports bana sakta hai' },
                    { key: PERMISSIONS.EXPORT_REPORTS, label: 'Export Reports', desc: 'PDF/Excel mein download kar sakta hai' },
                    { key: PERMISSIONS.SCHEDULE_REPORTS, label: 'Schedule Reports', desc: 'Automated report delivery set kar sakta hai' },
                ],
            }],
        },
        {
            id: 'statutory', title: 'Statutory & Compliance', icon: <FileText className="w-4 h-4" />,
            color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30',
            subGroups: [{
                title: 'Statutory Access',
                permissions: [
                    { key: PERMISSIONS.VIEW_STATUTORY, label: 'Statutory Reports', desc: 'PF, ESI, PT reports dekh sakta hai' },
                    { key: PERMISSIONS.MANAGE_STATUTORY, label: 'Manage Statutory', desc: 'Compliance settings edit kar sakta hai' },
                    { key: PERMISSIONS.VIEW_FORM16, label: 'Form 16', desc: 'Form 16 generation access hai' },
                ],
            }],
        },
        {
            id: 'salesman', title: 'Salesman & Clients', icon: <ShoppingBag className="w-4 h-4" />,
            color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30',
            subGroups: [{
                title: 'Sales Access',
                permissions: [
                    { key: PERMISSIONS.VIEW_SALESMAN, label: 'View Salesman', desc: 'Salesman dashboard dekh sakta hai' },
                    { key: PERMISSIONS.MANAGE_SALESMAN, label: 'Manage Salesman', desc: 'Salesman records add/edit kar sakta hai' },
                    { key: PERMISSIONS.VIEW_CLIENTS, label: 'View Clients', desc: 'Client list dekh sakta hai' },
                    { key: PERMISSIONS.MANAGE_CLIENTS, label: 'Manage Clients', desc: 'Client records add/edit kar sakta hai' },
                ],
            }],
        },
        {
            id: 'system', title: 'System & Admin Tools', icon: <Database className="w-4 h-4" />,
            color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30',
            subGroups: [{
                title: 'Admin Privileges',
                permissions: [
                    { key: PERMISSIONS.VIEW_AUDIT_LOGS, label: 'Audit Logs', desc: 'System activity log dekh sakta hai' },
                    { key: PERMISSIONS.DATABASE_BACKUP, label: 'Database Backup', desc: 'DB backup trigger/restore kar sakta hai', danger: true },
                    { key: PERMISSIONS.BULK_IMPORT, label: 'Bulk Import', desc: 'Excel upload se data import kar sakta hai' },
                    { key: PERMISSIONS.MANAGE_TRASH, label: 'Manage Trash', desc: 'Records restore ya permanently delete kar sakta hai', danger: true },
                    { key: PERMISSIONS.VIEW_SECURITY_ALERTS, label: 'Security Alerts', desc: 'Login failures aur breach alerts dekh sakta hai' },
                    { key: PERMISSIONS.DATA_CONSISTENCY_CHECK, label: 'Data Consistency', desc: 'Data validity checks run kar sakta hai' },
                    { key: PERMISSIONS.MANAGE_COMPANY_SWITCH, label: 'Company Switch', desc: 'Companies ke beech switch kar sakta hai', danger: true },
                    { key: PERMISSIONS.MANAGE_SETTINGS, label: 'System Settings', desc: 'Full configuration panel access', danger: true },
                    { key: PERMISSIONS.MANAGE_COMPANY, label: 'Company Profile', desc: 'Company details edit kar sakta hai', danger: true },
                    { key: PERMISSIONS.MANAGE_ROLES, label: 'Manage Roles', desc: 'Employee roles change kar sakta hai', danger: true },
                ],
            }],
        },
        {
            id: 'approvals', title: 'Approvals & Calculators', icon: <UserCheck className="w-4 h-4" />,
            color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30',
            subGroups: [{
                title: 'Approval Rights',
                permissions: [
                    { key: PERMISSIONS.VIEW_APPROVALS, label: 'View Approvals', desc: 'Pending approvals list dekh sakta hai' },
                    { key: PERMISSIONS.PROCESS_APPROVALS, label: 'Process Approvals', desc: 'Approve/reject requests kar sakta hai' },
                    { key: PERMISSIONS.USE_CALCULATORS, label: 'Use Calculators', desc: 'CTC, TDS, PF/ESI calculators use kar sakta hai' },
                ],
            }],
        },
    ];

const EDITABLE_ROLES: { role: Role; label: string; emoji: string; grad: string; ring: string }[] = [
    { role: Roles.ADMIN, label: 'Admin', emoji: '🛡️', grad: 'from-blue-600/30 to-blue-800/10', ring: 'ring-blue-500' },
    { role: Roles.ACCOUNT_ADMIN, label: 'Account Admin', emoji: '💼', grad: 'from-violet-600/30 to-violet-800/10', ring: 'ring-violet-500' },
    { role: Roles.MANAGER, label: 'Manager', emoji: '👔', grad: 'from-emerald-600/30 to-emerald-800/10', ring: 'ring-emerald-500' },
    { role: Roles.EMPLOYEE, label: 'Employee', emoji: '👤', grad: 'from-slate-600/30 to-slate-800/10', ring: 'ring-slate-400' },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export const RoleAccessConfig = () => {
    const { user } = useAuthStore();
    const {
        permissions, togglePermission, resetRole, resetAll,
        dataVisibility, setDataScope, toggleDataVisibilityFlag,
    } = useRolePermissionsStore();
    const [selectedRole, setSelectedRole] = useState<Role>(Roles.ADMIN);
    const [activeSection, setActiveSection] = useState<'visibility' | 'permissions'>('visibility');
    const [expandedGroups, setExpandedGroups] = useState<string[]>(['sidebar']);
    const [searchQuery, setSearchQuery] = useState('');
    const [showDangerOnly, setShowDangerOnly] = useState(false);
    const [warning, setWarning] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false, title: '', message: '', onConfirm: () => { },
    });

    if (!user || user.role !== Roles.SUPER_ADMIN) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
                    <Lock className="w-10 h-10 text-red-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Access Denied</h2>
                <p className="text-slate-400">Only Super Admin can manage Role Permissions.</p>
            </div>
        );
    }

    const activePerms = permissions[selectedRole] ?? [];
    const activeVis = dataVisibility[selectedRole];
    const activeRoleMeta = EDITABLE_ROLES.find(r => r.role === selectedRole)!;
    const totalPermCount = Object.keys(PERMISSIONS).length;

    const toggleGroup = (id: string) =>
        setExpandedGroups(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);

    const groupMatchesSearch = (group: typeof PERMISSION_GROUPS[0]) => {
        if (!searchQuery && !showDangerOnly) return true;
        return group.subGroups.some(sg => sg.permissions.some(p => {
            const qMatch = !searchQuery || p.label.toLowerCase().includes(searchQuery.toLowerCase()) || p.desc.toLowerCase().includes(searchQuery.toLowerCase());
            return qMatch && (!showDangerOnly || p.danger);
        }));
    };

    const permMatchesFilter = (p: { label: string; desc: string; danger?: boolean }) => {
        const qMatch = !searchQuery || p.label.toLowerCase().includes(searchQuery.toLowerCase()) || p.desc.toLowerCase().includes(searchQuery.toLowerCase());
        return qMatch && (!showDangerOnly || p.danger);
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <ShieldCheck className="w-7 h-7 text-rose-400" />
                        Role Access Control
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                        Super Admin decides everything — Bina coding ke pura control.
                    </p>
                </div>
                <button
                    onClick={() => setWarning({ isOpen: true, title: 'Reset ALL Roles?', message: 'Sab roles factory defaults par reset honge. Sab customizations khatam ho jayenge.', onConfirm: () => resetAll() })}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-sm font-medium transition-all border border-red-500/30 shrink-0"
                >
                    <RotateCcw className="w-4 h-4" /> Reset All
                </button>
            </div>

            {/* Role Selector */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {EDITABLE_ROLES.map(({ role, label, emoji, grad, ring }) => {
                    const perms = permissions[role] ?? [];
                    const vis = dataVisibility[role];
                    const isSelected = selectedRole === role;
                    const pct = Math.round((perms.length / totalPermCount) * 100);
                    const scopeLabel = SCOPE_OPTIONS.find(s => s.scope === vis?.scope)?.label ?? '—';
                    return (
                        <button
                            key={role}
                            onClick={() => setSelectedRole(role)}
                            className={`relative p-4 rounded-2xl border text-left transition-all duration-200 ${isSelected ? `bg-gradient-to-br ${grad} ring-1 ${ring}/50 border-transparent shadow-xl scale-[1.02]` : 'bg-slate-800/40 border-slate-700 hover:border-slate-500'}`}
                        >
                            <div className="text-2xl mb-2">{emoji}</div>
                            <div className="font-bold text-white text-sm">{label}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5 mb-2 truncate">Scope: {scopeLabel}</div>
                            <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-primary-500/70 transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1">{perms.length}/{totalPermCount} permissions</div>
                            {isSelected && <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
                        </button>
                    );
                })}
            </div>

            {/* Section Tabs */}
            <div className="flex gap-2 border-b border-slate-700 pb-0">
                <button
                    onClick={() => setActiveSection('visibility')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all -mb-px ${activeSection === 'visibility' ? 'border-rose-500 text-rose-400' : 'border-transparent text-slate-400 hover:text-white'}`}
                >
                    <Eye className="w-4 h-4" />
                    Data Visibility
                    <span className="text-[10px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded-full font-bold">NEW</span>
                </button>
                <button
                    onClick={() => setActiveSection('permissions')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all -mb-px ${activeSection === 'permissions' ? 'border-primary-500 text-primary-400' : 'border-transparent text-slate-400 hover:text-white'}`}
                >
                    <ShieldCheck className="w-4 h-4" />
                    Feature Permissions
                </button>
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* DATA VISIBILITY SECTION */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {activeSection === 'visibility' && activeVis && (
                <div className="space-y-5">
                    {/* Role header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{activeRoleMeta.emoji}</span>
                            <div>
                                <h3 className="text-base font-bold text-white">{activeRoleMeta.label} — Data Visibility</h3>
                                <p className="text-xs text-slate-400">Yeh role kiska data dekh sakta hai?</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setWarning({ isOpen: true, title: `Reset ${activeRoleMeta.label}?`, message: `"${activeRoleMeta.label}" role ki visibility defaults par reset karein?`, onConfirm: () => resetRole(selectedRole) })}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg border border-slate-600"
                        >
                            <RotateCcw className="w-3 h-3" /> Reset
                        </button>
                    </div>

                    {/* Data Scope Picker */}
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">📊 Data Scope — Kiski data access milti hai?</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {SCOPE_OPTIONS.map(opt => {
                                const isActive = activeVis.scope === opt.scope;
                                return (
                                    <button
                                        key={opt.scope}
                                        onClick={() => setDataScope(selectedRole, opt.scope)}
                                        className={`relative p-4 rounded-xl border-2 text-left transition-all ${isActive ? `${opt.bg} border-current ${opt.color} shadow-lg` : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'}`}
                                    >
                                        {isActive && (
                                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                                                <Check className="w-3 h-3 text-white" />
                                            </div>
                                        )}
                                        <div className={`mb-2 ${isActive ? opt.color : 'text-slate-500'}`}>{opt.icon}</div>
                                        <div className={`font-bold text-sm ${isActive ? opt.color : 'text-slate-300'}`}>{opt.label}</div>
                                        <div className="text-[11px] text-slate-500 mt-0.5">{opt.subLabel}</div>
                                        <div className="text-[10px] text-slate-600 mt-2 leading-relaxed">{opt.example}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Fine-grained Visibility Flags */}
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">🔍 Fine-grained Controls — Kya-kya dekh sakta hai?</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {VISIBILITY_FLAGS.map(({ key, label, desc, danger }) => {
                                const isOn = activeVis[key] as boolean;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => toggleDataVisibilityFlag(selectedRole, key)}
                                        className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${isOn
                                            ? danger ? 'bg-red-500/10 border-red-500/40 hover:bg-red-500/15' : 'bg-green-500/10 border-green-500/40 hover:bg-green-500/15'
                                            : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600'
                                            }`}
                                    >
                                        <div className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center transition-all ${isOn ? (danger ? 'bg-red-500/20' : 'bg-green-500/20') : 'bg-slate-700/60'}`}>
                                            {isOn ? <Check className={`w-4 h-4 ${danger ? 'text-red-400' : 'text-green-400'}`} /> : <X className="w-4 h-4 text-slate-600" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <p className={`text-sm font-semibold truncate ${isOn ? (danger ? 'text-red-300' : 'text-green-300') : 'text-slate-400'}`}>{label}</p>
                                                {danger && <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                                            </div>
                                            <p className="text-[11px] text-slate-500 truncate">{desc}</p>
                                        </div>
                                        {/* Live toggle pill */}
                                        <div className={`flex-shrink-0 w-10 h-5 rounded-full transition-all relative ${isOn ? (danger ? 'bg-red-500' : 'bg-green-500') : 'bg-slate-700'}`}>
                                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${isOn ? 'left-5' : 'left-0.5'}`} />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Summary Card */}
                    <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">📋 Summary: {activeRoleMeta.label} ki access</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                            <div className={`p-2 rounded-lg ${activeVis.scope === 'OWN' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-500'}`}>
                                <div className="font-bold">Data Scope</div>
                                <div className="text-primary-400 font-semibold">{SCOPE_OPTIONS.find(s => s.scope === activeVis.scope)?.label}</div>
                            </div>
                            {VISIBILITY_FLAGS.map(({ key, label }) => {
                                const isOn = activeVis[key] as boolean;
                                return (
                                    <div key={key} className={`p-2 rounded-lg flex items-center gap-1.5 ${isOn ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                                        {isOn ? <Check className="w-3 h-3 text-green-400 shrink-0" /> : <X className="w-3 h-3 text-red-400 shrink-0" />}
                                        <span className={`text-[11px] ${isOn ? 'text-green-300' : 'text-red-300'} truncate`}>{label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* FEATURE PERMISSIONS SECTION */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {activeSection === 'permissions' && (
                <div className="space-y-4">
                    {/* Controls bar */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Permission search karo..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary-500 outline-none pl-10"
                            />
                            <Eye className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        </div>
                        <button onClick={() => setShowDangerOnly(!showDangerOnly)} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border ${showDangerOnly ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-red-400'}`}>
                            <AlertTriangle className="w-4 h-4" /> Sensitive Only
                        </button>
                        <button onClick={() => setExpandedGroups(PERMISSION_GROUPS.map(g => g.id))} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium bg-slate-800 border border-slate-700 text-slate-400 hover:text-white">
                            Expand All
                        </button>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-center">
                            <div className="text-2xl font-bold text-green-400">{activePerms.length}</div>
                            <div className="text-xs text-slate-400">Enabled</div>
                        </div>
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-center">
                            <div className="text-2xl font-bold text-red-400">{totalPermCount - activePerms.length}</div>
                            <div className="text-xs text-slate-400">Blocked</div>
                        </div>
                        <div className="bg-slate-700/30 border border-slate-700 rounded-xl px-4 py-3 text-center">
                            <div className="text-2xl font-bold text-white">{totalPermCount}</div>
                            <div className="text-xs text-slate-400">Total</div>
                        </div>
                    </div>

                    {/* Permission Groups */}
                    <div className="space-y-3">
                        {PERMISSION_GROUPS.filter(groupMatchesSearch).map(group => {
                            const isExpanded = expandedGroups.includes(group.id);
                            const all = group.subGroups.flatMap(sg => sg.permissions.map(p => p.key));
                            const enabled = all.filter(k => activePerms.includes(k as PermissionValue)).length;
                            return (
                                <div key={group.id} className={`border rounded-2xl overflow-hidden ${group.border} bg-slate-800/30`}>
                                    <button onClick={() => toggleGroup(group.id)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-700/30 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg ${group.bg} flex items-center justify-center ${group.color}`}>{group.icon}</div>
                                            <div className="text-left">
                                                <span className="font-bold text-white text-sm">{group.title}</span>
                                                <div className="text-xs text-slate-500">{enabled} / {all.length} active</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="hidden sm:flex items-center gap-2">
                                                <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full bg-green-500/70 transition-all" style={{ width: all.length > 0 ? `${(enabled / all.length) * 100}%` : '0%' }} />
                                                </div>
                                                <span className="text-xs text-slate-500">{all.length > 0 ? Math.round((enabled / all.length) * 100) : 0}%</span>
                                            </div>
                                            {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                        </div>
                                    </button>
                                    {isExpanded && (
                                        <div className="px-5 pb-5 space-y-5 border-t border-slate-700/50 pt-4">
                                            {group.subGroups.map(sg => {
                                                const filtered = sg.permissions.filter(permMatchesFilter);
                                                if (!filtered.length) return null;
                                                return (
                                                    <div key={sg.title}>
                                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">{sg.title}</p>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                                                            {filtered.map(({ key, label, desc, danger }) => {
                                                                const isOn = activePerms.includes(key as PermissionValue);
                                                                return (
                                                                    <button
                                                                        key={key}
                                                                        onClick={() => togglePermission(selectedRole, key as PermissionValue)}
                                                                        className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${isOn ? (danger ? 'bg-red-500/10 border-red-500/40' : 'bg-green-500/10 border-green-500/40') : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600'}`}
                                                                    >
                                                                        <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${isOn ? (danger ? 'bg-red-500/20' : 'bg-green-500/20') : 'bg-slate-700/60'}`}>
                                                                            {isOn ? <Check className={`w-4 h-4 ${danger ? 'text-red-400' : 'text-green-400'}`} /> : <X className="w-4 h-4 text-slate-600" />}
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="flex items-center gap-1">
                                                                                <p className={`text-sm font-semibold truncate ${isOn ? (danger ? 'text-red-300' : 'text-green-300') : 'text-slate-400'}`}>{label}</p>
                                                                                {danger && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
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
                </div>
            )}

            {/* Super Admin Note */}
            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-yellow-500/10 to-amber-500/5 border border-yellow-500/20 rounded-xl">
                <Zap className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                <div className="text-sm text-yellow-300/80">
                    <strong className="text-yellow-400">Super Admin</strong> ke paas hamesha sab kuch hai — In settings ka asar Super Admin par nahi padta. Yeh sirf baaki 4 roles ke liye hai.
                </div>
            </div>

            <WarningModal
                isOpen={warning.isOpen}
                onClose={() => setWarning(p => ({ ...p, isOpen: false }))}
                onConfirm={warning.onConfirm}
                title={warning.title}
                message={warning.message}
                severity="danger"
                confirmText="Haan, Proceed Karo"
            />
        </div>
    );
};
