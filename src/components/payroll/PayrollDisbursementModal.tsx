import { useState } from 'react';
import { usePayrollStore } from '@/store/payrollStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { useLoanStore } from '@/store/loanStore';
import { PayrollStatus } from '@/types';
import {
    X, CheckCircle, FileSpreadsheet, FileText,
    Banknote, DollarSign, Wallet, Send
} from 'lucide-react';
import { exportToExcel } from '@/utils/exportUtils';
import { clsx } from 'clsx';
import { sendPayslipWhatsApp, sendBulkPayslipWhatsApp } from '@/utils/whatsappService';
import { useDialog } from '@/components/DialogProvider';

interface PayrollDisbursementModalProps {
    month: string;
    onClose: () => void;
}

export const PayrollDisbursementModal = ({ month, onClose }: PayrollDisbursementModalProps) => {
    const { getSlipsByMonth, markAsPaid } = usePayrollStore();
    const { employees } = useEmployeeStore();
    const { loans } = useLoanStore();

    const [selectedSlips, setSelectedSlips] = useState<Set<string>>(new Set());
    const [waBulkProgress, setWaBulkProgress] = useState<{ done: number; total: number } | null>(null);
    const { confirm } = useDialog();

    const slips = getSlipsByMonth(month);

    const toggleSelect = (id: string) => {
        setSelectedSlips(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };
    const toggleAll = () => {
        setSelectedSlips(prev => prev.size === slips.length ? new Set() : new Set(slips.map(s => s.id)));
    };
    const handleApproveSelected = async () => {
        if (selectedSlips.size === 0) return;
        const ok = await confirm({
            title: `${selectedSlips.size} Employees Ko Paid Mark Karein?`,
            message: `${selectedSlips.size} selected employees ka salary disburse karke Paid mark karna chahte hain?`,
            confirmLabel: 'Haan, Approve Karo',
            cancelLabel: 'Cancel',
            variant: 'warning',
        });
        if (ok) {
            selectedSlips.forEach(id => { const s = slips.find(x => x.id === id); if (s && s.status !== PayrollStatus.PAID) markAsPaid(id); });
            setSelectedSlips(new Set());
        }
    };

    // Stats
    const totalPayout = slips.reduce((sum, s) => sum + s.netSalary, 0);
    const totalEMI = slips.reduce((sum, s) => sum + (s.loanDeduction || 0), 0);
    const totalPending = slips.filter(s => s.status !== PayrollStatus.PAID).reduce((sum, s) => sum + s.netSalary, 0);
    const totalPaid = slips.filter(s => s.status === PayrollStatus.PAID).reduce((sum, s) => sum + s.netSalary, 0);
    const pendingCount = slips.filter(s => s.status !== PayrollStatus.PAID).length;

    const handleApproveAll = async () => {
        const ok = await confirm({
            title: 'Sabhi Employees Ko Paid Mark Karein?',
            message: `Sabhi ${slips.length} employees ka total ₹${totalPayout.toLocaleString()} salary disburse karna chahte hain?`,
            confirmLabel: 'Haan, Approve All',
            cancelLabel: 'Cancel',
            variant: 'warning',
        });
        if (ok) {
            slips.forEach(slip => { if (slip.status !== PayrollStatus.PAID) markAsPaid(slip.id); });
        }
    };

    // ── WhatsApp Bulk Send ────────────────────────────────────────────────
    const handleWhatsAppBulk = () => {
        const targetSlips = selectedSlips.size > 0
            ? slips.filter(s => selectedSlips.has(s.id))
            : slips;

        if (targetSlips.length === 0) return;

        const pairs = targetSlips.map(slip => ({
            employee: employees.find(e => e.id === slip.employeeId)!,
            slip
        })).filter(p => !!p.employee);

        setWaBulkProgress({ done: 0, total: pairs.length });
        sendBulkPayslipWhatsApp(pairs, (done, total) => {
            setWaBulkProgress({ done, total });
            if (done >= total) setTimeout(() => setWaBulkProgress(null), 2000);
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-2 md:p-4">
            <div className="glass w-full h-[95vh] rounded-2xl flex flex-col animate-in zoom-in-95">

                {/* Header */}
                <div className="p-6 border-b border-dark-border flex justify-between items-center bg-dark-bg/50 rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Banknote className="w-6 h-6 text-success" />
                            Final Salary Disbursement Report
                        </h2>
                        <p className="text-dark-muted text-sm">Review Salary minus EMI deductions before final approval.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Stats Pill */}
                        <div className="hidden md:flex items-center gap-4 px-4 py-2 bg-dark-bg/50 rounded-lg border border-dark-border">
                            <div>
                                <p className="text-[10px] text-dark-muted uppercase">Total Net Pay</p>
                                <p className="text-lg font-bold text-success">₹ {totalPayout.toLocaleString()}</p>
                            </div>
                            <div className="w-px h-8 bg-dark-border" />
                            <div>
                                <p className="text-[10px] text-dark-muted uppercase">Total EMI Recovered</p>
                                <p className="text-lg font-bold text-warning">₹ {totalEMI.toLocaleString()}</p>
                            </div>
                        </div>

                        {/* WhatsApp Bulk Notify Button */}
                        <button
                            onClick={handleWhatsAppBulk}
                            className="flex items-center gap-2 px-3 py-2 bg-[#25D366] hover:bg-[#1ebe59] text-white rounded-lg transition-colors font-medium shadow-sm"
                            title={selectedSlips.size > 0 ? `WhatsApp ${selectedSlips.size} selected` : 'WhatsApp All'}
                        >
                            {waBulkProgress ? (
                                <span className="text-xs font-bold">{waBulkProgress.done}/{waBulkProgress.total}</span>
                            ) : (
                                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                            )}
                            <span className="hidden md:inline">{selectedSlips.size > 0 ? `WA (${selectedSlips.size})` : 'WA All'}</span>
                        </button>

                        {/* Export button */}
                        <button
                            onClick={() => {
                                const data = slips.map(s => {
                                    const emp = employees.find(e => e.id === s.employeeId);
                                    const empLoans = loans.filter(l => l.employeeId === s.employeeId && (l.status === 'ACTIVE' || l.status === 'REQUESTED'));
                                    const loanBalance = empLoans.reduce((sum, l) => sum + l.balance, 0);

                                    return {
                                        Employee: emp?.name || 'Unknown',
                                        Code: emp?.code,
                                        Department: emp?.department,
                                        Days_Paid: s.paidLeaveDays + s.presentDays,
                                        Gross_Salary: s.grossSalary,
                                        Loan_EMI_Deducted: s.loanDeduction,
                                        Loan_Balance_Remaining: loanBalance,
                                        PF_Tax_Deduction: s.pfDeduction + s.taxDeduction,
                                        Other_Deductions: s.otherDeduction,
                                        Net_Payable: s.netSalary,
                                        Generated_By: s.generatedBy || 'System',
                                        Status: s.status
                                    };
                                });
                                exportToExcel(data, `Salary_Disbursement_${month}`);
                            }}
                            className="flex items-center gap-2 px-3 py-2 bg-dark-bg/50 border border-dark-border hover:bg-white/10 text-white rounded-lg transition-colors"
                            title="Export to Excel"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span className="hidden md:inline">Export</span>
                        </button>

                        <button
                            onClick={handleApproveSelected}
                            disabled={selectedSlips.size === 0}
                            className={clsx(
                                "flex items-center gap-2 px-3 py-2 rounded-lg font-bold transition-all text-sm",
                                selectedSlips.size > 0
                                    ? "bg-primary-600 text-white hover:bg-primary-500"
                                    : "bg-dark-bg text-dark-muted cursor-not-allowed"
                            )}
                        >
                            <CheckCircle className="w-4 h-4" />
                            {selectedSlips.size > 0 ? `Approve (${selectedSlips.size})` : 'Select Rows'}
                        </button>

                        <button
                            onClick={handleApproveAll}
                            disabled={totalPending === 0}
                            className={clsx(
                                "flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all",
                                totalPending > 0
                                    ? "bg-success text-white hover:bg-success/90 shadow-lg shadow-success/20"
                                    : "bg-dark-bg text-dark-muted cursor-not-allowed"
                            )}
                        >
                            <CheckCircle className="w-5 h-5" />
                            {totalPending === 0 ? 'All Paid' : 'Approve All'}
                        </button>

                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-dark-muted hover:text-white transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto p-4">
                    <div className="rounded-xl overflow-hidden border border-dark-border">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-dark-surface text-dark-muted border-b border-dark-border sticky top-0 z-10">
                                <tr>
                                    <th className="p-4 w-10">
                                        <input type="checkbox"
                                            checked={selectedSlips.size === slips.length && slips.length > 0}
                                            onChange={toggleAll}
                                            className="w-4 h-4 accent-primary-500 cursor-pointer"
                                        />
                                    </th>
                                    <th className="p-4">Employee</th>
                                    <th className="p-4 text-center">Days</th>
                                    <th className="p-4 text-right">Gross</th>
                                    <th className="p-4 text-right text-warning">Loan EMI (Bal)</th>
                                    <th className="p-4 text-right text-danger">Deductions</th>
                                    <th className="p-4 text-right text-success font-bold text-base">Net Payable</th>
                                    <th className="p-4 text-center">Status</th>
                                    <th className="p-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-border bg-dark-bg/20">
                                {slips.map(slip => {
                                    const emp = employees.find(e => e.id === slip.employeeId);
                                    const otherDeductions = slip.totalDeductions - slip.loanDeduction;
                                    const empLoans = loans.filter(l => l.employeeId === slip.employeeId && l.status === 'ACTIVE');
                                    const totalLoanBalance = empLoans.reduce((sum, l) => sum + l.balance, 0);
                                    const totalDays = slip.presentDays + slip.paidLeaveDays;

                                    return (
                                        <tr key={slip.id} className={clsx(
                                            "hover:bg-dark-surface/50 transition-colors",
                                            selectedSlips.has(slip.id) && "bg-primary-500/10 border-l-2 border-primary-500"
                                        )}>
                                            <td className="p-4">
                                                <input type="checkbox"
                                                    checked={selectedSlips.has(slip.id)}
                                                    onChange={() => toggleSelect(slip.id)}
                                                    className="w-4 h-4 accent-primary-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="p-4">
                                                <div className="font-medium text-white">{emp?.name || 'Unknown'}</div>
                                                <div className="text-xs text-dark-muted">{emp?.department}</div>
                                            </td>
                                            <td className="p-4 text-center text-white">
                                                <span className="px-2 py-1 bg-white/5 rounded text-xs">{totalDays} / {slip.totalDays}</span>
                                            </td>
                                            <td className="p-4 text-right text-white">₹ {slip.grossSalary.toLocaleString()}</td>
                                            <td className="p-4 text-right">
                                                <div className="text-warning font-mono">
                                                    {slip.loanDeduction > 0 ? `- ₹ ${slip.loanDeduction.toLocaleString()}` : '-'}
                                                </div>
                                                {totalLoanBalance > 0 && (
                                                    <div className="text-[10px] text-dark-muted mt-1">
                                                        Bal: ₹ {totalLoanBalance.toLocaleString()}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 text-right text-danger">
                                                {otherDeductions > 0 ? (
                                                    <div title={`PF: ${slip.pfDeduction}, Tax: ${slip.taxDeduction}`}>
                                                        - ₹ {otherDeductions.toLocaleString()}
                                                    </div>
                                                ) : '-'}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="text-lg font-bold text-success font-mono">₹ {slip.netSalary.toLocaleString()}</div>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={clsx(
                                                    "px-2 py-1 rounded text-xs font-bold uppercase",
                                                    slip.status === PayrollStatus.PAID ? "bg-success/20 text-success" : "bg-warning/20 text-warning"
                                                )}>
                                                    {slip.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {slip.status !== PayrollStatus.PAID && (
                                                        <button
                                                            onClick={() => markAsPaid(slip.id)}
                                                            className="px-3 py-1.5 bg-success/20 text-success hover:bg-success hover:text-white rounded-lg transition-colors text-xs font-bold"
                                                        >
                                                            Approve
                                                        </button>
                                                    )}
                                                    {slip.status === PayrollStatus.PAID && (
                                                        <span className="text-xs text-dark-muted flex items-center gap-1">
                                                            <CheckCircle className="w-3 h-3" /> Paid
                                                        </span>
                                                    )}
                                                    {/* Per-row WhatsApp button */}
                                                    <button
                                                        onClick={() => {
                                                            const emp = employees.find(e => e.id === slip.employeeId);
                                                            if (emp) sendPayslipWhatsApp(emp, slip);
                                                        }}
                                                        className="p-1.5 rounded-lg bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white transition-all"
                                                        title="Send Payslip on WhatsApp"
                                                    >
                                                        <Send className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {slips.length === 0 && (
                                    <tr><td colSpan={7} className="p-12 text-center text-dark-muted">No payroll generated for this month.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Bottom Summary Bar */}
                <div className="border-t border-dark-border bg-dark-bg/80 px-6 py-4 rounded-b-2xl">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex flex-wrap gap-6">
                            {/* Paid */}
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-success/10 rounded-lg">
                                    <DollarSign className="w-5 h-5 text-success" />
                                </div>
                                <div>
                                    <p className="text-xs text-dark-muted uppercase">Already Paid</p>
                                    <p className="text-lg font-bold text-success">₹ {totalPaid.toLocaleString()}</p>
                                </div>
                            </div>
                            {/* Pending */}
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-warning/10 rounded-lg">
                                    <Wallet className="w-5 h-5 text-warning" />
                                </div>
                                <div>
                                    <p className="text-xs text-dark-muted uppercase">Pending Payout</p>
                                    <p className="text-lg font-bold text-warning">₹ {totalPending.toLocaleString()}</p>
                                </div>
                            </div>
                            {/* Slips */}
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary-500/10 rounded-lg">
                                    <FileText className="w-5 h-5 text-primary-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-dark-muted uppercase">Salary Slips</p>
                                    <p className="text-lg font-bold text-white">
                                        <span className="text-success">{slips.length - pendingCount}</span>
                                        <span className="text-dark-muted"> / {slips.length}</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                        {/* Progress Bar */}
                        <div className="flex-1 min-w-[200px]">
                            <div className="flex justify-between text-xs text-dark-muted mb-1">
                                <span>Disbursement Progress</span>
                                <span>{slips.length > 0 ? Math.round(((slips.length - pendingCount) / slips.length) * 100) : 0}%</span>
                            </div>
                            <div className="w-full bg-dark-border rounded-full h-2">
                                <div
                                    className="bg-success h-2 rounded-full transition-all duration-500"
                                    style={{ width: `${slips.length > 0 ? ((slips.length - pendingCount) / slips.length) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
