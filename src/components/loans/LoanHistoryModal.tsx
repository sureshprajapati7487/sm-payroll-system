import { useState } from 'react';
import { useLoanStore } from '@/store/loanStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { LoanStatus } from '@/types';
import { X, Filter, Download, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';

interface LoanHistoryModalProps {
    onClose: () => void;
}

export const LoanHistoryModal = ({ onClose }: LoanHistoryModalProps) => {
    const { loans } = useLoanStore();
    const { employees } = useEmployeeStore();

    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    // Get all loans (not just active/pending)
    const filteredLoans = loans.filter(loan => {
        const emp = employees.find(e => e.id === loan.employeeId);
        const nameMatch = emp?.name.toLowerCase().includes(searchTerm.toLowerCase()) || false;
        const statusMatch = statusFilter === 'ALL' || loan.status === statusFilter;
        return nameMatch && statusMatch;
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case LoanStatus.ACTIVE: return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case LoanStatus.REQUESTED: return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case LoanStatus.CHECKED: return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
            case LoanStatus.REJECTED: return 'bg-red-500/20 text-red-400 border-red-500/30';
            case LoanStatus.CLOSED: return 'bg-green-500/20 text-green-400 border-green-500/30';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case LoanStatus.ACTIVE: return <AlertCircle className="w-4 h-4" />;
            case LoanStatus.REQUESTED: return <Clock className="w-4 h-4" />;
            case LoanStatus.CHECKED: return <Clock className="w-4 h-4" />;
            case LoanStatus.REJECTED: return <XCircle className="w-4 h-4" />;
            case LoanStatus.CLOSED: return <CheckCircle className="w-4 h-4" />;
            default: return <AlertCircle className="w-4 h-4" />;
        }
    };

    const handleExport = () => {
        // Simple CSV export
        const headers = ['Employee', 'Type', 'Amount', 'EMI', 'Balance', 'Status', 'Issued Date', 'Skipped Months'];
        const rows = filteredLoans.map(loan => {
            const emp = employees.find(e => e.id === loan.employeeId);
            const skippedCount = loan.skippedMonths?.filter(s => s.status === 'APPROVED').length || 0;
            return [
                emp?.name || 'Unknown',
                loan.type,
                loan.amount,
                loan.emiAmount,
                loan.balance,
                loan.status,
                loan.issuedDate || 'N/A',
                skippedCount
            ];
        });

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Loan_History_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="glass w-full max-w-6xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-dark-border flex items-center justify-between bg-dark-surface/50">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Loan History</h2>
                        <p className="text-sm text-dark-muted mt-1">Complete audit trail of all loans and transactions</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-dark-bg rounded-lg transition-colors text-dark-muted hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Filters */}
                <div className="p-4 bg-dark-surface/30 border-b border-dark-border flex flex-wrap gap-3">
                    <div className="flex-1 min-w-[200px]">
                        <input
                            type="text"
                            placeholder="Search employee..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-dark-muted" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                        >
                            <option value="ALL">All Status</option>
                            <option value={LoanStatus.ACTIVE}>Active</option>
                            <option value={LoanStatus.REQUESTED}>Requested</option>
                            <option value={LoanStatus.CHECKED}>Checked</option>
                            <option value={LoanStatus.REJECTED}>Rejected</option>
                            <option value={LoanStatus.CLOSED}>Closed</option>
                        </select>
                    </div>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-600/20 text-primary-400 hover:bg-primary-600 hover:text-white rounded-lg transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        <span className="text-sm font-medium">Export CSV</span>
                    </button>
                </div>

                {/* Stats */}
                <div className="p-4 bg-dark-surface/20 border-b border-dark-border grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="text-center">
                        <div className="text-xs text-dark-muted uppercase">Total</div>
                        <div className="text-xl font-bold text-white">{loans.length}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-dark-muted uppercase">Active</div>
                        <div className="text-xl font-bold text-blue-400">{loans.filter(l => l.status === LoanStatus.ACTIVE).length}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-dark-muted uppercase">Pending</div>
                        <div className="text-xl font-bold text-yellow-400">{loans.filter(l => l.status === LoanStatus.REQUESTED || l.status === LoanStatus.CHECKED).length}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-dark-muted uppercase">Rejected</div>
                        <div className="text-xl font-bold text-red-400">{loans.filter(l => l.status === LoanStatus.REJECTED).length}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-dark-muted uppercase">Closed</div>
                        <div className="text-xl font-bold text-green-400">{loans.filter(l => l.status === LoanStatus.CLOSED).length}</div>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto p-4">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-dark-surface/50 sticky top-0 z-10">
                            <tr className="text-dark-muted border-b border-dark-border">
                                <th className="p-3">Employee</th>
                                <th className="p-3">Type</th>
                                <th className="p-3 text-right">Amount</th>
                                <th className="p-3 text-right">EMI</th>
                                <th className="p-3 text-right">Balance</th>
                                <th className="p-3">Status</th>
                                <th className="p-3">Issued</th>
                                <th className="p-3 text-center">Skipped</th>
                                <th className="p-3 text-center">Transactions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border/50">
                            {filteredLoans.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="p-8 text-center text-dark-muted">
                                        No loans found matching the criteria.
                                    </td>
                                </tr>
                            ) : (
                                filteredLoans.map(loan => {
                                    const emp = employees.find(e => e.id === loan.employeeId);
                                    const skippedCount = loan.skippedMonths?.filter(s => s.status === 'APPROVED').length || 0;
                                    const hasSettlement = !!loan.settlementRequest;

                                    return (
                                        <tr key={loan.id} className="hover:bg-dark-surface/30 transition-colors">
                                            <td className="p-3">
                                                <div className="font-medium text-white">{emp?.name || 'Unknown'}</div>
                                                <div className="text-xs text-dark-muted">{emp?.code}</div>
                                            </td>
                                            <td className="p-3">
                                                <span className="text-xs px-2 py-1 rounded bg-dark-bg border border-dark-border text-dark-muted">
                                                    {loan.type.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right font-mono text-white">₹{loan.amount.toLocaleString()}</td>
                                            <td className="p-3 text-right font-mono text-warning">₹{loan.emiAmount.toLocaleString()}</td>
                                            <td className="p-3 text-right font-mono font-bold text-danger">₹{loan.balance.toLocaleString()}</td>
                                            <td className="p-3">
                                                <span className={clsx("px-2 py-1 rounded text-xs font-bold uppercase border flex items-center gap-1 w-fit", getStatusColor(loan.status))}>
                                                    {getStatusIcon(loan.status)}
                                                    {loan.status}
                                                </span>
                                                {hasSettlement && (
                                                    <div className="text-[10px] text-orange-400 mt-1">Settlement Pending</div>
                                                )}
                                            </td>
                                            <td className="p-3 text-sm text-dark-muted">{loan.issuedDate || 'N/A'}</td>
                                            <td className="p-3 text-center">
                                                {skippedCount > 0 ? (
                                                    <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 text-xs font-bold">
                                                        {skippedCount} skipped
                                                    </span>
                                                ) : (
                                                    <span className="text-dark-muted text-xs">-</span>
                                                )}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="text-white font-medium">{loan.ledger?.length || 0}</span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="p-4 bg-dark-surface/30 border-t border-dark-border flex justify-between items-center">
                    <div className="text-sm text-dark-muted">
                        Showing {filteredLoans.length} of {loans.length} total loans
                    </div>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-dark-bg hover:bg-dark-elem text-white rounded-lg transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
