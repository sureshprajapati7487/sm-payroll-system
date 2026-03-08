import { useState } from 'react';
import { Shield, ShieldCheck, RotateCcw, Lock, Check, X } from 'lucide-react';
import { useRolePermissionsStore } from '@/store/rolePermissionsStore';
import { useAuthStore } from '@/store/authStore';
import { PERMISSIONS } from '@/config/permissions';
import { Roles, Role } from '@/types';
import type { PermissionValue } from '@/config/permissions';
import { WarningModal } from '@/components/ui/WarningModal';

// ─── Permission Groups ───────────────────────────────────────────────────────
const PERMISSION_GROUPS = [
    {
        title: '🏢 Company & System',
        color: 'blue',
        permissions: [
            { key: PERMISSIONS.MANAGE_COMPANY, label: 'Manage Company', desc: 'Edit company details & settings' },
            { key: PERMISSIONS.MANAGE_ROLES, label: 'Manage Roles', desc: 'Assign & change employee roles' },
            { key: PERMISSIONS.MANAGE_SETTINGS, label: 'Manage Settings', desc: 'Access system configuration' },
        ],
    },
    {
        title: '👥 Employees',
        color: 'purple',
        permissions: [
            { key: PERMISSIONS.VIEW_EMPLOYEES, label: 'View Employees', desc: 'See employee list & profiles' },
            { key: PERMISSIONS.ADD_EMPLOYEE, label: 'Add Employee', desc: 'Create new employee records' },
            { key: PERMISSIONS.EDIT_EMPLOYEE, label: 'Edit Employee', desc: 'Modify employee details' },
            { key: PERMISSIONS.DELETE_EMPLOYEE, label: 'Delete Employee', desc: 'Remove employee from system' },
        ],
    },
    {
        title: '📋 Attendance',
        color: 'green',
        permissions: [
            { key: PERMISSIONS.VIEW_ATTENDANCE, label: 'View Attendance', desc: 'See attendance records' },
            { key: PERMISSIONS.EDIT_ATTENDANCE, label: 'Edit Attendance', desc: 'Override attendance status' },
            { key: PERMISSIONS.APPROVE_ATTENDANCE, label: 'Approve Attendance', desc: 'Approve regularization requests' },
            { key: PERMISSIONS.MANUAL_ATTENDANCE, label: 'Manual Punch', desc: 'Mark Present/Absent/Half Day' },
            { key: PERMISSIONS.MANAGE_HOLIDAYS, label: 'Manage Holidays', desc: 'Add and edit holiday calendar' },
        ],
    },
    {
        title: '💰 Payroll & Accounts',
        color: 'yellow',
        permissions: [
            { key: PERMISSIONS.VIEW_PAYROLL, label: 'View Payroll', desc: 'Access payroll dashboard' },
            { key: PERMISSIONS.GENERATE_PAYROLL, label: 'Generate Payroll', desc: 'Process & lock salary payroll' },
            { key: PERMISSIONS.MANAGE_LOANS, label: 'Manage Loans', desc: 'Approve & manage loan requests' },
            { key: PERMISSIONS.VIEW_SALARY, label: 'View Salary Amounts', desc: 'See sensitive salary figures' },
        ],
    },
    {
        title: '🏭 Production',
        color: 'orange',
        permissions: [
            { key: PERMISSIONS.VIEW_PRODUCTION, label: 'View Production', desc: 'See production entries' },
            { key: PERMISSIONS.ADD_PRODUCTION, label: 'Add Production', desc: 'Submit production records' },
            { key: PERMISSIONS.APPROVE_PRODUCTION, label: 'Approve Production', desc: 'Approve production entries' },
        ],
    },
    {
        title: '🌴 Leaves',
        color: 'teal',
        permissions: [
            { key: PERMISSIONS.VIEW_LEAVES, label: 'View Leaves', desc: 'See leave requests' },
            { key: PERMISSIONS.REQUEST_LEAVES, label: 'Request Leaves', desc: 'Apply for leave (self)' },
            { key: PERMISSIONS.APPROVE_LEAVES, label: 'Approve Leaves', desc: 'Approve / reject leave requests' },
        ],
    },
];

// ─── Editable Roles (Super Admin is locked) ─────────────────────────────────
const EDITABLE_ROLES: { role: Role; label: string; color: string; icon: string }[] = [
    { role: Roles.ADMIN, label: 'Admin', color: 'blue', icon: '🛡️' },
    { role: Roles.ACCOUNT_ADMIN, label: 'Account Admin', color: 'violet', icon: '💼' },
    { role: Roles.MANAGER, label: 'Manager', color: 'emerald', icon: '👔' },
    { role: Roles.EMPLOYEE, label: 'Employee', color: 'slate', icon: '👤' },
];

const COLOR_MAP: Record<string, string> = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/40 text-blue-400',
    violet: 'from-violet-500/20 to-violet-600/10 border-violet-500/40 text-violet-400',
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/40 text-emerald-400',
    slate: 'from-slate-500/20 to-slate-600/10 border-slate-500/40 text-slate-400',
};

// ─── Component ───────────────────────────────────────────────────────────────
export const RoleAccessConfig = () => {
    const { user } = useAuthStore();
    const { permissions, togglePermission, resetRole, resetAll } = useRolePermissionsStore();
    const [selectedRole, setSelectedRole] = useState<Role>(Roles.ADMIN);
    const [warning, setWarning] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    // Guard — only SUPER_ADMIN can access this
    if (!user || user.role !== Roles.SUPER_ADMIN) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
                    <Lock className="w-10 h-10 text-red-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Access Denied</h2>
                <p className="text-slate-400 text-center max-w-sm">
                    Only the Super Admin can manage Role Permissions.
                </p>
            </div>
        );
    }

    const activePerms = permissions[selectedRole] ?? [];
    const activeRoleMeta = EDITABLE_ROLES.find(r => r.role === selectedRole)!;
    const totalCount = PERMISSION_GROUPS.reduce((s, g) => s + g.permissions.length, 0);
    const activeCount = activePerms.length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <ShieldCheck className="w-7 h-7 text-primary-400" />
                        Role Access Control
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                        Toggle permissions for each role. Changes take effect immediately.
                    </p>
                </div>
                <button
                    onClick={() => setWarning({
                        isOpen: true,
                        title: 'Reset All Roles?',
                        message: 'This will reset ALL roles back to their default permissions. Any customizations you made will be lost.',
                        onConfirm: () => resetAll(),
                    })}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm font-medium transition-all border border-slate-600"
                >
                    <RotateCcw className="w-4 h-4" />
                    Reset All to Defaults
                </button>
            </div>

            {/* Role Selector */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {EDITABLE_ROLES.map(({ role, label, color, icon }) => {
                    const perms = permissions[role] ?? [];
                    const isSelected = selectedRole === role;
                    const colorCls = COLOR_MAP[color];
                    return (
                        <button
                            key={role}
                            onClick={() => setSelectedRole(role)}
                            className={`relative p-4 rounded-2xl border text-left transition-all ${isSelected
                                    ? `bg-gradient-to-br ${colorCls} shadow-lg scale-[1.02]`
                                    : 'bg-slate-800/40 border-slate-700 hover:border-slate-500'
                                }`}
                        >
                            <div className="text-2xl mb-1">{icon}</div>
                            <div className="font-bold text-white text-sm">{label}</div>
                            <div className="text-xs text-slate-400 mt-0.5">
                                {perms.length}/{totalCount} permissions
                            </div>
                            {isSelected && (
                                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary-400" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Permission Matrix */}
            <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{activeRoleMeta.icon}</span>
                        <div>
                            <h3 className="text-lg font-bold text-white">{activeRoleMeta.label}</h3>
                            <p className="text-xs text-slate-400">{activeCount} of {totalCount} permissions active</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setWarning({
                            isOpen: true,
                            title: `Reset ${activeRoleMeta.label}?`,
                            message: `Reset the "${activeRoleMeta.label}" role back to its default permissions?`,
                            onConfirm: () => resetRole(selectedRole),
                        })}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-all border border-slate-600"
                    >
                        <RotateCcw className="w-3 h-3" />
                        Reset Role
                    </button>
                </div>

                <div className="space-y-5">
                    {PERMISSION_GROUPS.map(group => (
                        <div key={group.title}>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                {group.title}
                                <span className="h-px flex-1 bg-slate-700/60" />
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {group.permissions.map(({ key, label, desc }) => {
                                    const isOn = activePerms.includes(key as PermissionValue);
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => togglePermission(selectedRole, key as PermissionValue)}
                                            className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all group ${isOn
                                                    ? 'bg-green-500/10 border-green-500/40 hover:bg-green-500/15'
                                                    : 'bg-slate-900/40 border-slate-700/50 hover:border-slate-600'
                                                }`}
                                        >
                                            <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center transition-all ${isOn ? 'bg-green-500/20' : 'bg-slate-700/60'
                                                }`}>
                                                {isOn
                                                    ? <Check className="w-4 h-4 text-green-400" />
                                                    : <X className="w-4 h-4 text-slate-500" />
                                                }
                                            </div>
                                            <div className="min-w-0">
                                                <p className={`text-sm font-semibold truncate ${isOn ? 'text-green-300' : 'text-slate-400'}`}>
                                                    {label}
                                                </p>
                                                <p className="text-[11px] text-slate-500 truncate">{desc}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Super Admin Note */}
            <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-sm">
                <Shield className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-yellow-300/80">
                    <strong className="text-yellow-400">Super Admin</strong> always has full access to all permissions and cannot be restricted.
                    These settings only apply to the four roles listed above.
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
