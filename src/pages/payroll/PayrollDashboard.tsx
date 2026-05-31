import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePayrollStore } from '@/store/payrollStore';
import { useAuthStore } from '@/store/authStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { PERMISSIONS } from '@/config/permissions';
import { calculateSalary } from '@/utils/salaryCalculator';
import { useAttendanceStore } from '@/store/attendanceStore';
import { useProductionStore } from '@/store/productionStore';
import { useLoanStore } from '@/store/loanStore';
import { useSecurityStore } from '@/store/securityStore';
import {
    Banknote,
    Printer,
    Search,
    ClipboardList,
    Eye,
    Download,
    Mail,
} from 'lucide-react';
import { API_URL } from '@/lib/apiConfig';
import { clsx } from 'clsx';
import { LoanSummaryModal } from '@/components/loans/LoanSummaryModal';
import { useDialog } from '@/components/DialogProvider';
import { PayrollDisbursementModal } from '@/components/payroll/PayrollDisbursementModal';
import { EmployeeHistoryModal } from '@/components/payroll/EmployeeHistoryModal';
import { Employee } from '@/types';
import { InfoTip } from '@/components/ui/InfoTip';
import { PasswordConfirmModal } from '@/components/PasswordConfirmModal';

export const PayrollDashboard = () => {
    const navigate = useNavigate();
    const { user, hasPermission } = useAuthStore();
    const { slips, generateMonthlyPayroll, advanceState, fetchPayroll, isLoading, isSaving } = usePayrollStore();
    const { employees } = useEmployeeStore();
    const { currentIp, allowedIps } = useSecurityStore();
    const isIpAllowed = user?.role === 'SUPER_ADMIN' || (currentIp && allowedIps.includes(currentIp));

    // Default to current month YYYY-MM
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [searchTerm, setSearchTerm] = useState('');
    const canGenerate = hasPermission(PERMISSIONS.GENERATE_PAYROLL);
    const canSimulate = hasPermission(PERMISSIONS.RUN_PAYROLL_SIMULATION) || canGenerate;
    const canApprove = hasPermission(PERMISSIONS.APPROVE_PAYROLL) || canGenerate;
    const canLock = hasPermission(PERMISSIONS.LOCK_PAYROLL) || canGenerate;
    const canViewAllSlips = hasPermission(PERMISSIONS.VIEW_ALL_PAYSLIPS) || hasPermission(PERMISSIONS.VIEW_PAYROLL) || canGenerate;
    const canManageLoans = hasPermission(PERMISSIONS.MANAGE_LOANS);

    const [showPendingOnly, setShowPendingOnly] = useState(false);
    const [selectedDept, setSelectedDept] = useState('ALL');
    const [showLoanModal, setShowLoanModal] = useState(false);
    const [showDisbursementModal, setShowDisbursementModal] = useState(false);
    const [selectedHistoryEmployee, setSelectedHistoryEmployee] = useState<Employee | null>(null);
    const [lockConfirmId, setLockConfirmId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isBulkLoading, setIsBulkLoading] = useState(false);
    const { confirm } = useDialog();

    // Fetch payroll data from server when month changes
    useEffect(() => {
        fetchPayroll(selectedMonth);
    }, [selectedMonth]);

    // Get unique departments
    const departments = Array.from(new Set(employees.map(e => e.department))).sort();

    const filteredSlips = slips.filter(s => {
        const monthMatch = s.month === selectedMonth;

        // Search Filter
        const empName = employees.find(e => e.id === s.employeeId)?.name.toLowerCase() || '';
        const searchMatch = empName.includes(searchTerm.toLowerCase());

        // Status Filter
        const statusMatch = showPendingOnly ? s.status !== 'LOCKED' : true;

        // Department Filter
        const emp = employees.find(e => e.id === s.employeeId);
        const deptMatch = selectedDept === 'ALL' || emp?.department === selectedDept;

        // Privacy Access Check
        const accessOk = canViewAllSlips || s.employeeId === user?.id;

        return monthMatch && searchMatch && statusMatch && deptMatch && accessOk;
    });
    const totalPayout = filteredSlips.reduce((sum, s) => sum + s.netSalary, 0);

    const handleGenerate = async () => {
        const ok = await confirm({
            title: '💸 Payroll Generate Karein?',
            message: `${selectedMonth} maah ka payroll generate karna chahte hain? Pehle se existing slips overwrite ho jayengi.`,
            confirmLabel: 'Haan, Generate Karo',
            cancelLabel: 'Cancel',
            variant: 'warning',
        });
        if (ok) {
            await generateMonthlyPayroll(selectedMonth, user?.name);
        }
    };

    const hasActualSlips = filteredSlips.length > 0;
    const allSelected = hasActualSlips && selectedIds.length === filteredSlips.length;
    const toggleSelectAll = () => setSelectedIds(allSelected ? [] : filteredSlips.map(s => s.id));
    const toggleSelect = (id: string) =>
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const authHeader = (): Record<string, string> => {
        try {
            const raw = localStorage.getItem('auth-storage');
            const token = raw ? JSON.parse(raw)?.state?.token : null;
            if (token) return { Authorization: `Bearer ${token}` };
        } catch {}
        return {};
    };

    const handleBulkAction = async (action: 'simulate' | 'approve' | 'lock') => {
        const statusMap = { simulate: 'DRAFT', approve: 'SIMULATION', lock: 'FINAL_APPROVED' } as const;
        const eligible = filteredSlips.filter(s => selectedIds.includes(s.id) && s.status === statusMap[action]);
        if (eligible.length === 0) { alert(`No eligible slips for bulk ${action}.`); return; }
        const ok = await confirm({
            title: `Bulk ${action.charAt(0).toUpperCase() + action.slice(1)}`,
            message: `${eligible.length} slip(s) ko ${action} karna chahte hain?`,
            confirmLabel: 'Haan, Proceed',
            cancelLabel: 'Cancel',
            variant: 'warning',
        });
        if (!ok) return;
        setIsBulkLoading(true);
        for (const slip of eligible) await advanceState(slip.id, action);
        setIsBulkLoading(false);
        setSelectedIds([]);
    };

    const handleExport = async (type: 'pf-ecr' | 'esic') => {
        try {
            const res = await fetch(`${API_URL}/payroll/export/${type}?month=${selectedMonth}`, { headers: authHeader() });
            if (!res.ok) { alert(`Export failed: ${res.statusText}`); return; }
            const blob = await res.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${type}-${selectedMonth}.csv`;
            a.click();
            URL.revokeObjectURL(a.href);
        } catch (e: any) { alert(`Export error: ${e.message}`); }
    };

    const handleEmailAll = async () => {
        const slipsToEmail = filteredSlips.filter(s => s.status !== 'DRAFT');
        if (slipsToEmail.length === 0) { alert('No finalized slips to email.'); return; }
        const ok = await confirm({
            title: 'Email All Payslips',
            message: `${slipsToEmail.length} employees ko payslip email bhejein?`,
            confirmLabel: 'Send',
            cancelLabel: 'Cancel',
            variant: 'warning',
        });
        if (!ok) return;
        setIsBulkLoading(true);
        let sent = 0, failed = 0;
        for (const slip of slipsToEmail) {
            try {
                const res = await fetch(`${API_URL}/notifications/send-payslip`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeader() },
                    body: JSON.stringify({ employeeId: slip.employeeId, month: selectedMonth }),
                });
                if (res.ok) sent++; else failed++;
            } catch { failed++; }
        }
        setIsBulkLoading(false);
        alert(`Done: ${sent} sent, ${failed} failed.`);
    };

    const handleActionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val === 'GENERATE') {
            if (!isIpAllowed) {
                alert('Payroll generation is temporarily restricted to the office network for security.');
                e.target.value = '';
                return;
            }
            handleGenerate();
        }
        if (val === 'REPORT') setShowDisbursementModal(true);
        if (val === 'LOANS') setShowLoanModal(true);
        if (val === 'HISTORY') navigate('/payroll/history');
        if (val === 'TOGGLE_PENDING') setShowPendingOnly(!showPendingOnly);

        // Reset select to default
        e.target.value = '';
    };

    return (
        <div className="space-y-6">
            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex flex-col gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-dark-text mb-1">Payroll Management</h1>
                    <p className="text-dark-muted">Generate and manage monthly salary slips</p>
                </div>

                {/* Filters — responsive grid on mobile, flex row on md+ */}
                <div className="grid grid-cols-2 md:flex md:flex-wrap md:items-center gap-2">
                    {/* Search — full width on mobile */}
                    <div className="relative col-span-2 md:flex-1 md:min-w-[180px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
                        <input
                            type="text"
                            placeholder="Search employee..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-dark-card border border-dark-border text-dark-text rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-primary-500 w-full"
                        />
                    </div>

                    {/* Department Filter */}
                    <select
                        value={selectedDept}
                        onChange={(e) => setSelectedDept(e.target.value)}
                        className="bg-dark-card border border-dark-border text-dark-text rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500 w-full"
                    >
                        <option value="ALL">All Departments</option>
                        {departments.map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                        ))}
                    </select>

                    {/* Month Picker */}
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-dark-card border border-dark-border text-dark-text rounded-lg p-2 text-sm focus:outline-none w-full"
                    />

                    {/* Combined Action Menu — full width on mobile */}
                    <div className="relative col-span-2 md:col-span-1">
                        <select
                            onChange={handleActionChange}
                            className="appearance-none bg-primary-600 hover:bg-primary-500 text-white font-medium rounded-lg pl-4 pr-10 py-2 text-sm focus:outline-none cursor-pointer transition-colors shadow-lg shadow-primary-500/20 w-full"
                            defaultValue=""
                        >
                            <option value="" disabled>Select Action...</option>
                            {canGenerate && <option value="GENERATE" disabled={!isIpAllowed}>{!isIpAllowed ? '🚫 Generate (Office IP Req.)' : isSaving ? '⏳ Saving...' : '⚡ Generate Salary Slips'}</option>}
                            {canViewAllSlips && <option value="REPORT">📊 Final Disbursement Report</option>}
                            {canViewAllSlips && <option value="TOGGLE_PENDING">{showPendingOnly ? '☑ Show All Records' : '☐ Show Pending Only'}</option>}
                            {canManageLoans && <option value="LOANS">💰 Manage Loans</option>}
                            <option value="HISTORY">📜 View History</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <ClipboardList className="w-4 h-4 text-white/80" />
                        </div>
                    </div>
                </div>

                {/* P1-07: Bulk Actions & Export Buttons */}
                {hasActualSlips && (
                    <div className="flex flex-wrap items-center gap-2">
                        {canSimulate && (
                            <button onClick={() => handleBulkAction('simulate')} disabled={isBulkLoading || selectedIds.length === 0}
                                className="px-3 py-1.5 text-xs font-medium bg-info/10 text-info hover:bg-info/20 rounded-lg transition-colors disabled:opacity-40">
                                Bulk Simulate ({filteredSlips.filter(s => selectedIds.includes(s.id) && s.status === 'DRAFT').length})
                            </button>
                        )}
                        {canApprove && (
                            <button onClick={() => handleBulkAction('approve')} disabled={isBulkLoading || selectedIds.length === 0}
                                className="px-3 py-1.5 text-xs font-medium bg-warning/10 text-warning hover:bg-warning/20 rounded-lg transition-colors disabled:opacity-40">
                                Bulk Approve ({filteredSlips.filter(s => selectedIds.includes(s.id) && s.status === 'SIMULATION').length})
                            </button>
                        )}
                        {canLock && (
                            <button onClick={() => handleBulkAction('lock')} disabled={isBulkLoading || selectedIds.length === 0}
                                className="px-3 py-1.5 text-xs font-medium bg-success/10 text-success hover:bg-success/20 rounded-lg transition-colors disabled:opacity-40">
                                Bulk Lock ({filteredSlips.filter(s => selectedIds.includes(s.id) && s.status === 'FINAL_APPROVED').length})
                            </button>
                        )}
                        <div className="ml-auto flex flex-wrap gap-2">
                            <button onClick={() => handleExport('pf-ecr')} disabled={isBulkLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-dark-card border border-dark-border text-dark-text hover:border-primary-500 rounded-lg transition-colors disabled:opacity-40">
                                <Download className="w-3.5 h-3.5" /> Download PF ECR
                            </button>
                            <button onClick={() => handleExport('esic')} disabled={isBulkLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-dark-card border border-dark-border text-dark-text hover:border-primary-500 rounded-lg transition-colors disabled:opacity-40">
                                <Download className="w-3.5 h-3.5" /> Download ESIC CSV
                            </button>
                            <button onClick={handleEmailAll} disabled={isBulkLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-dark-card border border-dark-border text-dark-text hover:border-primary-500 rounded-lg transition-colors disabled:opacity-40">
                                <Mail className="w-3.5 h-3.5" /> Email All Payslips
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass p-5 rounded-xl border border-dark-border">
                    <p className="text-dark-muted text-xs uppercase tracking-wider mb-1">Total Payout</p>
                    <p className="text-2xl font-bold text-white">₹ {totalPayout.toLocaleString()}</p>
                </div>
                <div className="glass p-5 rounded-xl border border-dark-border">
                    <p className="text-dark-muted text-xs uppercase tracking-wider mb-1">Employees Processed</p>
                    <p className="text-2xl font-bold text-primary-400">{filteredSlips.length}</p>
                </div>
                <div className="glass p-5 rounded-xl border border-dark-border">
                    <p className="text-dark-muted text-xs uppercase tracking-wider mb-1">Pending Payment</p>
                    <p className="text-2xl font-bold text-warning">
                        {filteredSlips.filter(s => s.status !== 'LOCKED').length}
                    </p>
                </div>
            </div>

            {/* Table */}
            <div className="glass rounded-2xl overflow-hidden relative">
                {isLoading && (
                    <div className="absolute inset-0 bg-dark-bg/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
                        <div className="flex items-center gap-3 text-primary-400">
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-primary-400" />
                            <span className="text-sm font-medium">Loading payroll data...</span>
                        </div>
                    </div>
                )}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-dark-bg/50 text-dark-muted border-b border-dark-border/50">
                            <tr>
                                <th className="p-4 w-10">
                                    {hasActualSlips && (
                                        <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                                            className="rounded cursor-pointer accent-primary-500" />
                                    )}
                                </th>
                                <th className="p-4">Employee</th>
                                <th className="p-4">Basic + OT</th>
                                <th className="p-4">Production</th>
                                <th className="p-4 text-danger flex items-center gap-1">
                                    <InfoTip id="totalDeductions" label="Deductions" />
                                </th>
                                <th className="p-4 text-success">
                                    <InfoTip id="netSalary" label="Net Salary" />
                                </th>
                                <th className="p-4 text-xs uppercase tracking-wider">Generated By</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border/50">
                            {(() => {
                                const showEstimates = filteredSlips.length === 0;
                                const dataToRender = showEstimates ?
                                    employees.filter(e => e.status === 'ACTIVE' &&
                                        (e.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.code.toLowerCase().includes(searchTerm.toLowerCase())) &&
                                        (selectedDept === 'ALL' || e.department === selectedDept) &&
                                        (canViewAllSlips || e.id === user?.id)
                                    ).map(emp => {
                                        // LIVE CALC
                                        return calculateSalary(
                                            emp,
                                            selectedMonth,
                                            useAttendanceStore.getState().records.filter(r => r.employeeId === emp.id),
                                            useProductionStore.getState().entries.filter(p => p.employeeId === emp.id),
                                            useLoanStore.getState().loans.filter(l => l.employeeId === emp.id && l.status === 'ACTIVE')
                                        );
                                    }) : filteredSlips;

                                if (dataToRender.length === 0) {
                                    return (
                                        <tr>
                                            <td colSpan={9} className="p-8 text-center text-dark-muted">
                                                No employees found.
                                            </td>
                                        </tr>
                                    );
                                }

                                return dataToRender.map((slip: any) => {
                                    const emp = employees.find(e => e.id === slip.employeeId);
                                    const isEstimate = showEstimates;

                                    return (
                                        <tr key={slip.employeeId + selectedMonth} className={clsx("transition-colors", isEstimate ? "opacity-75 hover:opacity-100 bg-white/5" : "hover:bg-dark-card/50")}>
                                            <td className="p-4 w-10">
                                                {!isEstimate && (
                                                    <input type="checkbox"
                                                        checked={selectedIds.includes(slip.id)}
                                                        onChange={() => toggleSelect(slip.id)}
                                                        className="rounded cursor-pointer accent-primary-500" />
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div className="font-medium text-white">{emp?.name || 'Unknown'} {isEstimate && <span className="text-[10px] bg-primary-500/20 text-primary-400 px-1 rounded ml-1">ESTIMATE</span>}</div>
                                                <div className="text-xs text-dark-muted">{emp?.code}</div>
                                            </td>
                                            <td className="p-4 text-white">
                                                ₹ {(slip.basicSalary + slip.overtimeAmount).toLocaleString()}
                                            </td>
                                            <td className="p-4 text-white">
                                                ₹ {slip.productionAmount.toLocaleString()}
                                            </td>
                                            <td className="p-4 text-danger">
                                                - ₹ {slip.totalDeductions.toLocaleString()}
                                            </td>
                                            <td className="p-4">
                                                <span className="text-lg font-bold text-success">
                                                    ₹ {slip.netSalary.toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm text-dark-muted">
                                                {slip.generatedBy || 'Live Calc'}
                                            </td>
                                            <td className="p-4">
                                                <span className={clsx(
                                                    "px-2 py-1 rounded text-xs font-bold",
                                                    !isEstimate && slip.status === 'LOCKED' ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                                                )}>
                                                    {isEstimate ? 'RUNNING' : slip.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => {
                                                            const empToView = employees.find(e => e.id === slip.employeeId);
                                                            if (empToView) setSelectedHistoryEmployee(empToView);
                                                        }}
                                                        className="p-1.5 text-info hover:bg-info/10 rounded transition-colors"
                                                        title="View Detailed History"
                                                    >
                                                        <Eye className="w-5 h-5" />
                                                    </button>

                                                    {!isEstimate ? (
                                                        <>
                                                            {slip.status === 'DRAFT' && canSimulate && (
                                                                <button
                                                                    onClick={() => advanceState(slip.id, 'simulate')}
                                                                    className="p-1.5 text-info hover:bg-info/10 rounded transition-colors"
                                                                    title="Simulate Payroll"
                                                                >
                                                                    <div className="w-5 h-5 flex items-center justify-center font-bold text-xs">SIM</div>
                                                                </button>
                                                            )}
                                                            {slip.status === 'SIMULATION' && canApprove && (
                                                                <button
                                                                    onClick={() => advanceState(slip.id, 'approve')}
                                                                    className="p-1.5 text-warning hover:bg-warning/10 rounded transition-colors"
                                                                    title="Approve Payroll"
                                                                >
                                                                    <div className="w-5 h-5 flex items-center justify-center font-bold text-xs">APP</div>
                                                                </button>
                                                            )}
                                                            {slip.status === 'FINAL_APPROVED' && canLock && (
                                                                <button
                                                                    onClick={() => setLockConfirmId(slip.id)}
                                                                    className="p-1.5 text-success hover:bg-success/10 rounded transition-colors"
                                                                    title="Lock & Finalize Deductions"
                                                                >
                                                                    <Banknote className="w-5 h-5" />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => window.open(`/payroll/slip/${slip.id}`, '_blank')}
                                                                className="p-1.5 text-primary-400 hover:bg-primary-500/10 rounded transition-colors"
                                                                title="View & Print Slip"
                                                            >
                                                                <Printer className="w-5 h-5" />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-dark-muted italic px-2">Auto</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                });
                            })()}
                        </tbody>
                    </table>
                </div>
            </div>
            {showLoanModal && <LoanSummaryModal onClose={() => setShowLoanModal(false)} />}
            {showDisbursementModal && (
                <PayrollDisbursementModal
                    month={selectedMonth}
                    onClose={() => setShowDisbursementModal(false)}
                />
            )}
            {selectedHistoryEmployee && (
                <EmployeeHistoryModal
                    employee={selectedHistoryEmployee}
                    month={selectedMonth}
                    onClose={() => setSelectedHistoryEmployee(null)}
                />
            )}
            <PasswordConfirmModal
                isOpen={!!lockConfirmId}
                onClose={() => setLockConfirmId(null)}
                title="Confirm Payroll Lock"
                description="Once locked, the salary slip cannot be altered and all auto-deductions (like loans) will be permanently recorded for this month."
                actionLabel="Lock Payroll Now"
                actionVariant="warning"
                onConfirm={() => {
                    if (lockConfirmId) {
                        advanceState(lockConfirmId, 'lock');
                        setLockConfirmId(null);
                    }
                }}
            />
        </div>
    );
};
