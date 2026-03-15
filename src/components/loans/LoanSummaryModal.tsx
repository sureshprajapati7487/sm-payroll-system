import { useState } from 'react';
import { useLoanStore } from '@/store/loanStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { LoanType } from '@/types';
import {
    X, Search, Wallet, Coins, Utensils
} from 'lucide-react';
import { clsx } from 'clsx';
import { exportToExcel, exportLoansToPDF } from '@/utils/exportUtils';
import { FileText, FileSpreadsheet } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

interface LoanSummaryModalProps {
    onClose: () => void;
}

export const LoanSummaryModal = ({ onClose }: LoanSummaryModalProps) => {
    const { loans } = useLoanStore();
    const { employees } = useEmployeeStore();
    const user = useAuthStore(s => s.user);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<string>('ALL');

    // Filter Active Loans (and optionally Closed if recent?) 
    // Usually "Outstanding" means Active.
    const activeLoans = loans.filter(l => l.status === 'ACTIVE' || l.status === 'REQUESTED');

    const filteredLoans = activeLoans.filter(l => {
        const emp = employees.find(e => e.id === l.employeeId);
        const nameMatch = emp?.name.toLowerCase().includes(searchTerm.toLowerCase());
        const typeMatch = filterType === 'ALL' || l.type === filterType;
        return nameMatch && typeMatch;
    });

    const getTypeIcon = (type: LoanType) => {
        switch (type) {
            case LoanType.FOOD: return <Utensils className="w-4 h-4" />;
            case LoanType.ADVANCE_CASH: return <Coins className="w-4 h-4" />;
            default: return <Wallet className="w-4 h-4" />;
        }
    };

    const totalOutstanding = filteredLoans.reduce((sum, l) => sum + l.balance, 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-2 md:p-4">
            <div className="glass w-full h-[95vh] rounded-2xl flex flex-col animate-in zoom-in-95">

                {/* Header */}
                <div className="p-6 border-b border-dark-border flex justify-between items-center bg-dark-bg/50 rounded-t-2xl">
                    <div className="flex items-center gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Wallet className="w-6 h-6 text-primary-400" />
                                Employee Loan Summary
                            </h2>
                            <p className="text-dark-muted text-sm">Overview of outstanding loans and balances</p>
                        </div>

                        {/* Export Buttons */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => exportToExcel(filteredLoans, 'Loan_Summary', user)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-green-600/20 text-green-500 hover:bg-green-600 hover:text-white rounded-lg text-sm transition-colors border border-green-600/30"
                                title="Export to Excel"
                            >
                                <FileSpreadsheet className="w-4 h-4" />
                                Excel
                            </button>
                            <button
                                onClick={() => exportLoansToPDF(filteredLoans, employees, user)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white rounded-lg text-sm transition-colors border border-red-600/30"
                                title="Export to PDF"
                            >
                                <FileText className="w-4 h-4" />
                                PDF
                            </button>
                        </div>
                    </div>

                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-dark-muted hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Filters & Stats */}
                <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-dark-bg/30">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
                        <input
                            type="text"
                            placeholder="Search employee..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-dark-bg border border-dark-border rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-primary-500"
                        />
                    </div>

                    <select
                        value={filterType}
                        onChange={e => setFilterType(e.target.value)}
                        className="bg-dark-bg border border-dark-border text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
                    >
                        <option value="ALL">All Loan Types</option>
                        <option value={LoanType.PF_LOAN}>Personal / PF</option>
                        <option value={LoanType.ADVANCE_CASH}>Cash Advance</option>
                        <option value={LoanType.FOOD}>Food / Canteen</option>
                    </select>

                    <div className="flex items-center justify-end gap-2 px-4 py-2 bg-dark-bg/50 rounded-lg border border-dark-border">
                        <span className="text-dark-muted text-xs uppercase">Total Outstanding</span>
                        <span className="text-xl font-bold text-danger">₹ {totalOutstanding.toLocaleString()}</span>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto p-4">
                    <div className="rounded-xl overflow-hidden border border-dark-border">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-dark-surface text-dark-muted border-b border-dark-border">
                                <tr>
                                    <th className="p-4">Employee</th>
                                    <th className="p-4">Type</th>
                                    <th className="p-4 text-right">Total Loan</th>
                                    <th className="p-4 text-right">Paid So Far</th>
                                    <th className="p-4 text-right text-danger">Balance (Arrears)</th>
                                    <th className="p-4 text-right">EMI / Month</th>
                                    <th className="p-4">Approver</th>
                                    <th className="p-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-border bg-dark-bg/20">
                                {filteredLoans.map(loan => {
                                    const emp = employees.find(e => e.id === loan.employeeId);
                                    const paid = loan.amount - loan.balance;

                                    return (
                                        <tr key={loan.id} className="hover:bg-dark-surface/50 transition-colors">
                                            <td className="p-4">
                                                <div className="font-medium text-white">{emp?.name || 'Unknown'}</div>
                                                <div className="text-xs text-dark-muted">{emp?.department}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    {getTypeIcon(loan.type)}
                                                    <span className="text-white">{loan.type.replace('_', ' ')}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right font-mono text-white">₹ {loan.amount.toLocaleString()}</td>
                                            <td className="p-4 text-right font-mono text-success">₹ {paid.toLocaleString()}</td>
                                            <td className="p-4 text-right font-mono font-bold text-danger">₹ {loan.balance.toLocaleString()}</td>
                                            <td className="p-4 text-right font-mono text-warning">₹ {loan.emiAmount?.toLocaleString()}</td>
                                            <td className="p-4 text-sm text-white">
                                                {employees.find(e => e.id === loan.approverId)?.name || <span className="text-dark-muted italic">System</span>}
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={clsx("px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                                    loan.status === 'ACTIVE' ? "bg-primary-500/20 text-primary-400" :
                                                        "bg-warning/20 text-warning"
                                                )}>
                                                    {loan.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredLoans.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="p-12 text-center text-dark-muted">
                                            No active loans found matching criteria.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
