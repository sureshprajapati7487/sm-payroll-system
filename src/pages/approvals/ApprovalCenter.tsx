import { useState } from 'react';
import { useLoanStore } from '@/store/loanStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { useAuthStore } from '@/store/authStore';
import { useProductionStore } from '@/store/productionStore';
import { useAttendanceStore } from '@/store/attendanceStore';
import { LoanStatus, ProductionStatus, Employee } from '@/types';
import { CheckCircle, XCircle, UserCheck, Wallet, Hammer, Eye } from 'lucide-react';
import { clsx } from 'clsx';
import { calculateSalary } from '@/utils/salaryCalculator';
import { EmployeeHistoryModal } from '@/components/payroll/EmployeeHistoryModal';
import { useDialog } from '@/components/DialogProvider';

export const ApprovalCenter = () => {
    const { user } = useAuthStore();
    const { loans, approveLoan, rejectLoan } = useLoanStore();
    const { entries: productionEntries, approveEntry, rejectEntry } = useProductionStore();
    const { employees } = useEmployeeStore();
    const { records: attendanceRecords } = useAttendanceStore();

    const [category, setCategory] = useState<'LOANS' | 'PRODUCTION'>('LOANS');
    const [filter, setFilter] = useState<'MY_APPROVALS' | 'ALL' | 'HISTORY'>('MY_APPROVALS');
    const [selectedEmpForStatement, setSelectedEmpForStatement] = useState<Employee | null>(null);
    const { confirm } = useDialog();

    const currentMonth = "2026-01"; // Dynamically derived from System Time

    // Get Relevant Loans based on filter
    const relevantLoans = filter === 'HISTORY'
        ? loans.filter(l => l.status !== LoanStatus.REQUESTED && l.status !== LoanStatus.CHECKED)
        : loans.filter(l => l.status === LoanStatus.REQUESTED || l.status === LoanStatus.CHECKED);

    const filteredLoans = relevantLoans.filter(l => {
        if (filter === 'ALL') return true;
        if (filter === 'HISTORY') return true;

        if (l.checkingApproverId === user?.id && l.status === LoanStatus.REQUESTED) return true;
        if (l.approverId === user?.id && (l.status === LoanStatus.REQUESTED || l.status === LoanStatus.CHECKED)) return true;
        if (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') return true;

        return false;
    });

    // Get Relevant Production Entries based on filter
    const relevantProduction = filter === 'HISTORY'
        ? productionEntries.filter(e => e.status !== ProductionStatus.PENDING)
        : productionEntries.filter(e => e.status === ProductionStatus.PENDING);

    const filteredProduction = relevantProduction.filter(_ => {
        if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') return true;
        return false;
    });

    const getEmployeeName = (id: string) => employees.find(e => e.id === id)?.name || 'Unknown';

    const getEstimatedNetPay = (employeeId: string) => {
        const emp = employees.find(e => e.id === employeeId);
        if (!emp) return 0;

        const empAttendance = attendanceRecords.filter(r => r.employeeId === employeeId);
        const empProduction = productionEntries.filter(p => p.employeeId === employeeId);
        const empLoans = loans.filter(l => l.employeeId === employeeId && l.status === 'ACTIVE');

        const slip = calculateSalary(emp, currentMonth, empAttendance, empProduction, empLoans);
        return slip.netSalary;
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <UserCheck className="w-8 h-8 text-primary-400" />
                        Approval Center
                    </h1>
                    <p className="text-dark-muted">Centralized management for loans and production work.</p>
                </div>

                <div className="flex flex-col items-end gap-3">
                    {/* Category Tabs */}
                    <div className="flex bg-dark-card p-1 rounded-xl border border-dark-border shadow-inner">
                        <button
                            onClick={() => setCategory('LOANS')}
                            className={clsx(
                                "flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all",
                                category === 'LOANS'
                                    ? "bg-primary-500 text-white shadow-lg shadow-primary-500/20"
                                    : "text-dark-muted hover:text-white"
                            )}
                        >
                            <Wallet className="w-4 h-4" />
                            Loans
                        </button>
                        <button
                            onClick={() => setCategory('PRODUCTION')}
                            className={clsx(
                                "flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all",
                                category === 'PRODUCTION'
                                    ? "bg-secondary-500 text-white shadow-lg shadow-secondary-500/20"
                                    : "text-dark-muted hover:text-white"
                            )}
                        >
                            <Hammer className="w-4 h-4" />
                            Production
                        </button>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex bg-dark-bg p-1 rounded-lg border border-dark-border">
                        <button
                            onClick={() => setFilter('MY_APPROVALS')}
                            className={clsx(
                                "px-4 py-1.5 rounded-md text-xs font-medium transition-colors",
                                filter === 'MY_APPROVALS' ? "bg-primary-600 text-white" : "text-dark-muted hover:text-white"
                            )}
                        >
                            Pending My Action
                        </button>
                        {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
                            <button
                                onClick={() => setFilter('ALL')}
                                className={clsx(
                                    "px-4 py-1.5 rounded-md text-xs font-medium transition-colors",
                                    filter === 'ALL' ? "bg-primary-600 text-white" : "text-dark-muted hover:text-white"
                                )}
                            >
                                All Requests
                            </button>
                        )}
                        <button
                            onClick={() => setFilter('HISTORY')}
                            className={clsx(
                                "px-4 py-1.5 rounded-md text-xs font-medium transition-colors",
                                filter === 'HISTORY' ? "bg-primary-600 text-white" : "text-dark-muted hover:text-white"
                            )}
                        >
                            History
                        </button>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="glass rounded-2xl overflow-hidden border border-white/5">
                <div className="overflow-x-auto">
                    {category === 'LOANS' ? (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-dark-surface text-dark-muted border-b border-dark-border">
                                <tr>
                                    <th className="p-4">Employee</th>
                                    <th className="p-4">Type / Reason</th>
                                    <th className="p-4">Amount</th>
                                    <th className="p-4">Approvers</th>
                                    <th className="p-4">Status / Audit</th>
                                    <th className="p-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-border/50">
                                {filteredLoans.map(loan => {
                                    const isMyCheck = loan.checkingApproverId === user?.id;
                                    const isMyApprove = loan.approverId === user?.id;
                                    const canAct = (isMyCheck && loan.status === LoanStatus.REQUESTED) ||
                                        (isMyApprove && (loan.status === LoanStatus.REQUESTED || loan.status === LoanStatus.CHECKED)) ||
                                        user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

                                    const isHistory = filter === 'HISTORY';
                                    const lastAudit = loan.auditTrail?.slice(-1)[0];
                                    const netPay = getEstimatedNetPay(loan.employeeId);

                                    return (
                                        <tr key={loan.id} className="hover:bg-white/5 transition-colors">
                                            <td className="p-4 text-xs">
                                                <div className="font-bold text-white">{getEmployeeName(loan.employeeId)}</div>
                                                <div className="text-[10px] text-dark-muted flex flex-col pt-0.5">
                                                    <span>{employees.find(e => e.id === loan.employeeId)?.department}</span>
                                                    <div className="flex items-center gap-1.5 bg-dark-card border border-dark-border px-1.5 py-0.5 rounded mt-1 w-fit group cursor-pointer hover:border-primary-500 transition-colors"
                                                        onClick={() => setSelectedEmpForStatement(employees.find(e => e.id === loan.employeeId) || null)}>
                                                        <span className={clsx(netPay < 0 ? "text-red-400" : "text-success", "font-bold")}>
                                                            Net: ₹{netPay.toLocaleString()}
                                                        </span>
                                                        <Eye className="w-2.5 h-2.5 text-dark-muted group-hover:text-primary-400" />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="px-2 py-0.5 rounded bg-primary-500/20 text-primary-300 text-xs border border-primary-500/30">
                                                    {loan.type.replace('_', ' ')}
                                                </span>
                                                <div className="text-xs text-dark-muted mt-1 max-w-[200px] truncate" title={loan.reason}>
                                                    {loan.reason}
                                                </div>
                                            </td>
                                            <td className="p-4 font-mono text-white font-bold">
                                                ₹ {loan.amount.toLocaleString()}
                                                <div className="text-xs text-dark-muted font-normal">
                                                    {loan.tenureMonths} Months
                                                </div>
                                            </td>
                                            <td className="p-4 text-xs">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-dark-muted w-16">Approver:</span>
                                                        <span className={clsx(loan.approverId ? "text-white" : "text-dark-muted italic")}>
                                                            {loan.approverId ? getEmployeeName(loan.approverId) : 'Auto'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-dark-muted w-16">Checker:</span>
                                                        <span className={clsx(loan.checkingApproverId ? "text-primary-300" : "text-dark-muted italic")}>
                                                            {loan.checkingApproverId ? getEmployeeName(loan.checkingApproverId) : 'None'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {loan.status === LoanStatus.CHECKED ? (
                                                    <div className="flex flex-col gap-1">
                                                        <span className="flex items-center gap-1 text-xs text-success font-medium bg-success/10 px-2 py-1 rounded w-fit">
                                                            <CheckCircle className="w-3 h-3" />
                                                            Verified
                                                        </span>
                                                        {lastAudit && <span className="text-[10px] text-dark-muted">By {lastAudit.performedBy}</span>}
                                                    </div>
                                                ) : loan.status === LoanStatus.ACTIVE ? (
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-xs text-white bg-success/20 px-2 py-1 rounded font-bold border border-success/30 w-fit">Active</span>
                                                        {isHistory && lastAudit && (
                                                            <span className="text-[10px] text-dark-muted">
                                                                {lastAudit.action} by {lastAudit.performedBy}
                                                                <br />
                                                                {new Date(lastAudit.date).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : loan.status === LoanStatus.REJECTED ? (
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-xs text-red-300 bg-red-500/20 px-2 py-1 rounded font-bold border border-red-500/30 w-fit">Rejected</span>
                                                        {isHistory && lastAudit && (
                                                            <span className="text-[10px] text-dark-muted">
                                                                Rej. by {lastAudit.performedBy}
                                                                <br />
                                                                {new Date(lastAudit.date).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : loan.status === LoanStatus.CLOSED ? (
                                                    <span className="text-xs text-dark-muted bg-white/5 px-2 py-1 rounded font-bold border border-white/10">Closed</span>
                                                ) : (
                                                    <span className="text-xs text-warning bg-warning/10 px-2 py-1 rounded">Pending Check</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right">
                                                {canAct && !isHistory && (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={async () => {
                                                                const action = (isMyCheck && loan.status === LoanStatus.REQUESTED) ? 'Verify' : 'Approve';
                                                                const ok = await confirm({ title: `Loan ${action}?`, message: `Kya aap is loan request ko ${action.toLowerCase()} karna chahte hain?`, confirmLabel: `Haan, ${action}`, cancelLabel: 'Cancel', variant: 'info' });
                                                                if (ok) approveLoan(loan.id);
                                                            }}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-success/20 text-success hover:bg-success hover:text-white rounded-lg transition-colors text-xs font-bold"
                                                        >
                                                            <CheckCircle className="w-4 h-4" />
                                                            {(isMyCheck && loan.status === LoanStatus.REQUESTED) ? 'Verify' : 'Approve'}
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                const ok = await confirm({ title: 'Loan Reject Karein?', message: 'Kya aap yeh loan request reject karna chahte hain?', confirmLabel: 'Haan, Reject Karo', cancelLabel: 'Cancel', variant: 'danger' });
                                                                if (ok) rejectLoan(loan.id);
                                                            }}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-colors text-xs font-bold"
                                                        >
                                                            <XCircle className="w-4 h-4" />
                                                            Reject
                                                        </button>
                                                    </div>
                                                )}
                                                {isHistory && (
                                                    <span className="text-xs text-dark-muted">Completed</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredLoans.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-12 text-center text-dark-muted">
                                            No loan requests found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    ) : (
                        /* PRODUCTION VIEW */
                        <table className="w-full text-left text-sm">
                            <thead className="bg-dark-surface text-dark-muted border-b border-dark-border">
                                <tr>
                                    <th className="p-4">Employee</th>
                                    <th className="p-4">Item / Category</th>
                                    <th className="p-4 text-right">Qty</th>
                                    <th className="p-4 text-right">Rate</th>
                                    <th className="p-4 text-right">Total</th>
                                    <th className="p-4 text-right">Status</th>
                                    <th className="p-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-border/50">
                                {filteredProduction.map(entry => {
                                    const netPay = getEstimatedNetPay(entry.employeeId);
                                    return (
                                        <tr key={entry.id} className="hover:bg-white/5 transition-colors">
                                            <td className="p-4 text-xs">
                                                <div className="font-bold text-white">{getEmployeeName(entry.employeeId)}</div>
                                                <div className="text-[10px] text-dark-muted flex flex-col pt-0.5">
                                                    <span>{entry.date}</span>
                                                    <div className="flex items-center gap-1.5 bg-dark-card border border-dark-border px-1.5 py-0.5 rounded mt-1 w-fit group cursor-pointer hover:border-primary-500 transition-colors"
                                                        onClick={() => setSelectedEmpForStatement(employees.find(e => e.id === entry.employeeId) || null)}>
                                                        <span className={clsx(netPay < 0 ? "text-red-400" : "text-success", "font-bold")}>
                                                            Net: ₹{netPay.toLocaleString()}
                                                        </span>
                                                        <Eye className="w-2.5 h-2.5 text-dark-muted group-hover:text-primary-400" />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="text-white font-medium">{entry.item}</div>
                                                <div className="text-xs text-dark-muted">Piece Rate Work</div>
                                            </td>
                                            <td className="p-4 text-right font-mono text-white">{entry.qty}</td>
                                            <td className="p-4 text-right font-mono text-white">₹{entry.rate}</td>
                                            <td className="p-4 text-right font-mono text-primary-400 font-bold">₹{entry.totalAmount.toLocaleString()}</td>
                                            <td className="p-4 text-right">
                                                <span className={clsx(
                                                    "px-2 py-1 rounded text-[10px] font-bold uppercase",
                                                    entry.status === ProductionStatus.APPROVED ? "bg-success/20 text-success" :
                                                        entry.status === ProductionStatus.REJECTED ? "bg-red-500/20 text-red-400" :
                                                            "bg-warning/20 text-warning"
                                                )}>
                                                    {entry.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                {entry.status === ProductionStatus.PENDING && (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={async () => {
                                                                const ok = await confirm({ title: 'Work Entry Approve?', message: 'Is production entry ko approve karna chahte hain?', confirmLabel: 'Approve', cancelLabel: 'Cancel', variant: 'info' });
                                                                if (ok) approveEntry(entry.id);
                                                            }}
                                                            className="p-1.5 bg-success/20 text-success hover:bg-success hover:text-white rounded-lg transition-colors"
                                                            title="Approve"
                                                        >
                                                            <CheckCircle className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                const ok = await confirm({ title: 'Work Entry Reject?', message: 'Is production entry ko reject karna chahte hain?', confirmLabel: 'Reject', cancelLabel: 'Cancel', variant: 'danger' });
                                                                if (ok) rejectEntry(entry.id);
                                                            }}
                                                            className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-colors"
                                                            title="Reject"
                                                        >
                                                            <XCircle className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredProduction.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="p-12 text-center text-dark-muted">
                                            No production entries found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Salary Statement Modal */}
            {selectedEmpForStatement && (
                <EmployeeHistoryModal
                    employee={selectedEmpForStatement}
                    month={currentMonth}
                    onClose={() => setSelectedEmpForStatement(null)}
                />
            )}
        </div>
    );
};
