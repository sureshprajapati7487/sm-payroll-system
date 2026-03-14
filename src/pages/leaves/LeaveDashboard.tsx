import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useLeaveStore } from '@/store/leaveStore';
import { useEmployeeStore } from '@/store/employeeStore'; // To get names
import { LeaveType, LeaveStatus } from '@/types';
import { PERMISSIONS } from '@/config/permissions';
import {
    CalendarPlus,
    CheckCircle,
    XCircle,
    CalendarDays,
    Search,
    User,
    ChevronDown
} from 'lucide-react';
import { clsx } from 'clsx';
import { SkeletonList, SkeletonForm } from '@/components/SkeletonLoaders';
import { InfoTip } from '@/components/ui/InfoTip';

// --- Custom Searchable Select Component ---
const EmployeeSearchableSelect = ({ employees, selectedId, currentUserId, onSelect }: {
    employees: any[],
    selectedId: string,
    currentUserId: string,
    onSelect: (id: string) => void
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');

    // Close on click outside
    useEffect(() => {
        const handleClick = () => setIsOpen(false);
        if (isOpen) window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, [isOpen]);

    const activeEmployees = employees.filter(e => e.status === 'ACTIVE' && e.id !== currentUserId);
    const filteredOptions = activeEmployees.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));

    const selectedName = selectedId === currentUserId ? 'Myself' : employees.find(e => e.id === selectedId)?.name || 'Select Employee';

    return (
        <div className="relative" onClick={e => e.stopPropagation()}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-dark-bg border border-dark-border rounded-lg pl-3 pr-3 py-2 text-white flex justify-between items-center focus:border-primary-500 outline-none hover:bg-dark-bg/80 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-dark-muted" />
                    <span className="text-sm">{selectedName}</span>
                </div>
                <ChevronDown className="w-4 h-4 text-dark-muted opacity-50" />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-dark-card border border-dark-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2 border-b border-dark-border/50 sticky top-0 bg-dark-card">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-muted" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search name..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full bg-dark-bg/50 border border-dark-border rounded-lg pl-8 pr-2 py-1.5 text-xs text-white focus:border-primary-500 outline-none"
                            />
                        </div>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto p-1 space-y-0.5">
                        <button
                            type="button"
                            onClick={() => { onSelect(currentUserId); setIsOpen(false); }}
                            className={clsx(
                                "w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between group transition-colors",
                                selectedId === currentUserId ? "bg-primary-500/20 text-primary-500" : "text-white hover:bg-white/5"
                            )}
                        >
                            <span>Myself</span>
                            {selectedId === currentUserId && <CheckCircle className="w-3.5 h-3.5" />}
                        </button>

                        {filteredOptions.length === 0 && (
                            <p className="text-[10px] text-dark-muted text-center py-2">No employees found.</p>
                        )}

                        {filteredOptions.map(emp => (
                            <button
                                key={emp.id}
                                type="button"
                                onClick={() => { onSelect(emp.id); setIsOpen(false); }}
                                className={clsx(
                                    "w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between group transition-colors",
                                    selectedId === emp.id ? "bg-primary-500/20 text-primary-500" : "text-white hover:bg-white/5"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <img src={emp.avatar} className="w-5 h-5 rounded-full border border-dark-border bg-dark-bg" />
                                    <span>{emp.name}</span>
                                </div>
                                {selectedId === emp.id && <CheckCircle className="w-3.5 h-3.5" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};


export const LeaveDashboard = () => {
    const { user, hasPermission } = useAuthStore();
    const { requests, isLoading, requestLeave, approveLeave, rejectLeave } = useLeaveStore();
    const { employees } = useEmployeeStore();

    // Default to current user, but allowed to change if admin
    const [targetEmployeeId, setTargetEmployeeId] = useState(user?.id || '');

    const [form, setForm] = useState({
        type: LeaveType.CASUAL,
        startDate: '',
        endDate: '',
        isHalfDay: false, // New State
        reason: '',
    });

    const [searchTerm, setSearchTerm] = useState('');

    const canApprove = hasPermission(PERMISSIONS.APPROVE_LEAVES);
    const canManageLeaves = hasPermission(PERMISSIONS.MANAGE_LEAVES) || canApprove;
    const canViewAllLeaves = hasPermission(PERMISSIONS.VIEW_ALL_LEAVES) || canManageLeaves;

    // Get Target Employee Data
    const targetEmployee = employees.find(e => e.id === targetEmployeeId);
    const isBlocked = targetEmployee?.isLeaveBlocked;

    // Ensure targetEmployeeId is set when user loads
    useEffect(() => {
        if (user && !targetEmployeeId) {
            setTargetEmployeeId(user.id);
        }
    }, [user]);

    const visibleRequests = requests.filter(r => {
        const roleMatch = canViewAllLeaves ? true : r.employeeId === user?.id;

        // Search Filter (Employee Name)
        const empName = employees.find(e => e.id === r.employeeId)?.name.toLowerCase() || '';
        const searchMatch = empName.includes(searchTerm.toLowerCase());

        return roleMatch && searchMatch;
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isBlocked) return; // Security Check
        if (!targetEmployeeId || !form.startDate || (!form.endDate && !form.isHalfDay)) return;

        requestLeave({
            employeeId: targetEmployeeId,
            type: form.type,
            startDate: form.startDate,
            endDate: form.isHalfDay ? form.startDate : form.endDate, // Same day for half day
            isHalfDay: form.isHalfDay,
            reason: form.reason,
        });

        // Reset
        setForm({ type: LeaveType.CASUAL, startDate: '', endDate: '', isHalfDay: false, reason: '' });
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-dark-text mb-1">Leave Management</h1>
                <p className="text-dark-muted">Request time off and manage approvals</p>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <SkeletonForm />
                    <div className="lg:col-span-2"><SkeletonList items={5} /></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Request Form */}
                    <div className="glass p-6 rounded-2xl h-fit border-l-4 border-primary-500">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                            <CalendarPlus className="w-5 h-5 text-primary-500" />
                            Request Leave
                        </h3>

                        {/* BLOCKED ALERT */}
                        {isBlocked && (
                            <div className="mb-4 p-3 bg-danger/20 border border-danger/50 rounded-lg flex items-center gap-2 text-danger text-sm font-bold animate-pulse">
                                <XCircle className="w-4 h-4" />
                                <span>Leave Access Blocked by Admin</span>
                            </div>
                        )}

                        {/* BALANCE CARDS (Mini) */}
                        {targetEmployee?.leaveBalance && (
                            <div className="grid grid-cols-3 gap-2 mb-4">
                                {Object.entries(targetEmployee.leaveBalance).map(([key, val]) => (
                                    key !== 'UNPAID' && (
                                        <div key={key} className="bg-dark-bg/50 p-2 rounded-lg text-center border border-dark-border">
                                            <p className="text-[10px] text-dark-muted uppercase">{key}</p>
                                            <p className={clsx("text-sm font-bold", val > 0 ? "text-success" : "text-danger")}>
                                                {val}
                                            </p>
                                        </div>
                                    )
                                ))}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">

                            {/* Employee Selector (Only for Admins/Managers) */}
                            {canManageLeaves && (
                                <div className="relative">
                                    <InfoTip id="leaveEmployee" label="Employee" />
                                    <EmployeeSearchableSelect
                                        employees={employees}
                                        selectedId={targetEmployeeId}
                                        currentUserId={user?.id || ''}
                                        onSelect={setTargetEmployeeId}
                                    />
                                </div>
                            )}

                            <div>
                                <InfoTip id="leaveTypeField" label="Leave Type" />
                                <select
                                    value={form.type}
                                    onChange={e => setForm({ ...form, type: e.target.value as LeaveType })}
                                    className="w-full bg-dark-bg border border-dark-border rounded-lg p-2 text-white"
                                >
                                    {Object.values(LeaveType).map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <InfoTip id="leaveStartDate" label="From" />
                                    <input
                                        type="date"
                                        value={form.startDate}
                                        onChange={e => setForm({ ...form, startDate: e.target.value })}
                                        className="w-full bg-dark-bg border border-dark-border rounded-lg p-2 text-white"
                                    />
                                </div>
                                <div>
                                    <InfoTip id="leaveEndDate" label="To" />
                                    <input
                                        type="date"
                                        value={form.endDate}
                                        onChange={e => setForm({ ...form, endDate: e.target.value })}
                                        className="w-full bg-dark-bg border border-dark-border rounded-lg p-2 text-white"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 mb-2">
                                <input
                                    type="checkbox"
                                    id="halfDay"
                                    checked={form.isHalfDay}
                                    onChange={e => setForm({ ...form, isHalfDay: e.target.checked })}
                                    className="accent-primary-500 w-4 h-4 rounded"
                                />
                                <label htmlFor="halfDay" className="text-sm text-white cursor-pointer select-none">Half Day Leave (0.5)</label>
                                <InfoTip id="halfDayLeave" />
                            </div>

                            <div>
                                <InfoTip id="leaveReason" label="Reason" />
                                <textarea
                                    required
                                    value={form.reason}
                                    onChange={e => setForm({ ...form, reason: e.target.value })}
                                    className="w-full bg-dark-bg border border-dark-border rounded-lg p-2 text-white h-24 resize-none"
                                    placeholder="Why do you need leave?"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isBlocked}
                                className={clsx(
                                    "w-full py-2 text-white rounded-lg font-medium transition-colors",
                                    isBlocked ? "bg-dark-border cursor-not-allowed opacity-50" : "bg-primary-600 hover:bg-primary-500"
                                )}>
                                {isBlocked ? 'Blocked' : 'Submit Request'}
                            </button>
                        </form>
                    </div>

                    {/* List */}
                    <div className="lg:col-span-2 glass rounded-2xl overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-dark-border/50 flex flex-col md:flex-row justify-between items-center gap-4">
                            <h3 className="font-bold text-white">Leave History</h3>

                            {/* Search Bar */}
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
                                <input
                                    type="text"
                                    placeholder="Search employee..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-dark-bg border border-dark-border rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-primary-500"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto max-h-[600px]">
                            <div className="divide-y divide-dark-border/50">
                                {visibleRequests.length === 0 && (
                                    <div className="p-8 text-center text-dark-muted">No leave requests found.</div>
                                )}

                                {visibleRequests.map(req => {
                                    const emp = employees.find(e => e.id === req.employeeId);
                                    return (
                                        <div key={req.id} className="p-4 hover:bg-dark-card/50 transition-colors flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-dark-bg flex items-center justify-center text-primary-500 shrink-0">
                                                    <CalendarDays className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-white">{emp?.name || 'Unknown'} <span className="text-xs text-dark-muted font-normal">({req.type})</span></p>
                                                    <p className="text-sm text-dark-muted">{req.startDate} to {req.endDate}</p>
                                                    <p className="text-xs text-dark-muted mt-1 italic">"{req.reason}"</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                                                <span className={clsx(
                                                    "px-2 py-1 rounded text-xs font-bold flex items-center gap-1",
                                                    req.status === LeaveStatus.APPROVED && "bg-success/10 text-success",
                                                    req.status === LeaveStatus.REJECTED && "bg-danger/10 text-danger",
                                                    req.status === LeaveStatus.PENDING && "bg-warning/10 text-warning",
                                                )}>
                                                    {req.status}
                                                </span>

                                                {canApprove && req.status === LeaveStatus.PENDING && (
                                                    <div className="flex gap-2">
                                                        <button onClick={() => approveLeave(req.id)} className="p-1.5 bg-success/10 text-success hover:bg-success hover:text-white rounded-lg transition-colors" title="Approve">
                                                            <CheckCircle className="w-5 h-5" />
                                                        </button>
                                                        <button onClick={() => rejectLeave(req.id)} className="p-1.5 bg-danger/10 text-danger hover:bg-danger hover:text-white rounded-lg transition-colors" title="Reject">
                                                            <XCircle className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
