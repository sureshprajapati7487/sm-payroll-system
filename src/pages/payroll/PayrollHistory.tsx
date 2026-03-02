import { useState, useEffect } from 'react';
import { History, RotateCcw, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { usePayrollVersionStore } from '@/store/payrollVersionStore';
import { usePayrollStore } from '@/store/payrollStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { exportToExcel, exportPayrollToPDF } from '@/utils/exportUtils';
import { Download, FileSpreadsheet, Search, ArrowUpRight } from 'lucide-react';


export const PayrollHistory = () => {
    const { rollbackToVersion, getVersionHistory } = usePayrollVersionStore();
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [showConfirm, setShowConfirm] = useState<string | null>(null);

    const [month, year] = selectedMonth.split('-');
    const history = getVersionHistory(month, parseInt(year));

    const handleRollback = (versionId: string) => {
        rollbackToVersion(versionId);
        setShowConfirm(null);
        alert('Payroll rolled back successfully!');
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'finalized': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'draft': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'simulated': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'rolled-back': return 'bg-red-500/20 text-red-400 border-red-500/30';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    // --- NEW: Detailed View & Filters ---
    const { slips, fetchPayroll } = usePayrollStore();
    const { employees } = useEmployeeStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');

    // Fetch payroll data from server when month changes
    useEffect(() => {
        fetchPayroll(selectedMonth);
    }, [selectedMonth]);

    const currentMonthSlips = slips.filter(s => s.month === selectedMonth);

    const filteredSlips = currentMonthSlips.filter(s => {
        const emp = employees.find(e => e.id === s.employeeId);
        const nameMatch = emp?.name.toLowerCase().includes(searchTerm.toLowerCase()) || false;
        const statusMatch = statusFilter === 'ALL' || s.status === statusFilter;
        return nameMatch && statusMatch;
    });

    const handleExportExcel = () => {
        const data = filteredSlips.map(s => {
            const emp = employees.find(e => e.id === s.employeeId);
            return {
                'Employee ID': emp?.code,
                'Name': emp?.name,
                'Department': emp?.department,
                'Month': s.month,
                'Basic': s.basicSalary,
                'Allowances': s.allowances,
                'Overtime': s.overtimeAmount,
                'Production Bonus': s.productionAmount,
                'Gross Salary': s.grossSalary,
                'PF': s.pfDeduction,
                'TDS': s.taxDeduction,
                'Advance/Loan': s.loanDeduction,
                'Other Deductions': s.otherDeduction,
                'Total Deductions': s.totalDeductions,
                'Net Salary': s.netSalary,
                'Status': s.status
            };
        });
        exportToExcel(data, `Payroll_Register_${selectedMonth}`);
    };

    const handleExportPDF = () => {
        // Enhance PDF export with names
        const slipsWithNames = filteredSlips.map(s => {
            const emp = employees.find(e => e.id === s.employeeId);
            return { ...s, employeeId: emp?.name || s.employeeId } as any; // Hack: Using employeeId field to store Name for the generic utility
        });
        exportPayrollToPDF(slipsWithNames, selectedMonth);
    };

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <History className="w-8 h-8 text-primary-500" />
                    Payroll History & Rollback
                </h1>
                <p className="text-dark-muted mt-1">View version history and rollback payroll changes</p>
            </div>

            {/* Month Selector */}
            <div className="glass rounded-2xl p-4 flex items-center gap-4">
                <Clock className="w-5 h-5 text-primary-400" />
                <label className="text-white font-medium">Select Month:</label>
                <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-white border border-gray-300 rounded-lg px-4 py-2 text-black"
                />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="glass rounded-2xl p-6">
                    <div className="text-dark-muted text-sm">Total Versions</div>
                    <div className="text-3xl font-bold text-white mt-1">{history.length}</div>
                </div>

                <div className="glass rounded-2xl p-6">
                    <div className="text-dark-muted text-sm">Current Version</div>
                    <div className="text-3xl font-bold text-white mt-1">
                        v{history.find(v => v.status === 'finalized')?.versionNumber || '-'}
                    </div>
                </div>

                <div className="glass rounded-2xl p-6">
                    <div className="text-dark-muted text-sm">Status</div>
                    <div className="text-xl font-bold text-green-400 mt-1">
                        {history.find(v => v.status === 'finalized') ? 'Finalized' : 'Draft'}
                    </div>
                </div>
            </div>

            {/* Split Layout: Timeline vs Details */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* LEFT: Timeline */}
                <div className="glass rounded-2xl overflow-hidden h-fit">
                    <div className="p-6 border-b border-dark-border">
                        <h3 className="text-lg font-semibold text-white">Version History</h3>
                        <p className="text-xs text-dark-muted">Audit logs for {selectedMonth}</p>
                    </div>

                    {history.length === 0 ? (
                        <div className="p-8 text-center text-dark-muted">
                            <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <div>No history found</div>
                        </div>
                    ) : (
                        <div className="divide-y divide-dark-border max-h-[500px] overflow-y-auto">
                            {history.map((version, idx) => (
                                <div key={version.id} className="p-4 hover:bg-white/5 transition-all">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${getStatusColor(version.status)}`}>
                                            v{version.versionNumber}
                                        </span>
                                        <span className="text-xs text-dark-muted">{new Date(version.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-white text-sm font-medium mb-1 truncate">
                                        Modified by {version.createdBy}
                                    </p>
                                    <div className="flex justify-between items-center text-xs text-dark-muted">
                                        <span>Items: {version.changes.length}</span>
                                        {version.status === 'finalized' && idx !== 0 && (
                                            <button
                                                onClick={() => setShowConfirm(version.id)}
                                                className="text-yellow-500 hover:text-yellow-400 flex items-center gap-1"
                                            >
                                                <RotateCcw className="w-3 h-3" /> Rollback
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* RIGHT: Detailed Register */}
                <div className="lg:col-span-2 space-y-4">

                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-4 p-4 glass rounded-xl">
                        <div className="flex items-center gap-2 flex-1">
                            <div className="relative flex-1 max-w-xs">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
                                <input
                                    type="text"
                                    placeholder="Search by name..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-dark-bg border border-dark-border rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-primary-500"
                                />
                            </div>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                            >
                                <option value="ALL">All Status</option>
                                <option value="PAID">Paid</option>
                                <option value="PENDING">Pending</option>
                            </select>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={handleExportExcel}
                                className="flex items-center gap-2 px-3 py-2 bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-600/30 rounded-lg text-sm transition-all"
                            >
                                <FileSpreadsheet className="w-4 h-4" />
                                Excel
                            </button>
                            <button
                                onClick={handleExportPDF}
                                className="flex items-center gap-2 px-3 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/30 rounded-lg text-sm transition-all"
                            >
                                <Download className="w-4 h-4" />
                                PDF
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="glass rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-dark-bg/50 text-dark-muted border-b border-dark-border">
                                    <tr>
                                        <th className="p-4">Employee</th>
                                        <th className="p-4 text-right">Gross Pay</th>
                                        <th className="p-4 text-right">Deductions</th>
                                        <th className="p-4 text-right">Net Pay</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 block">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-dark-border/50">
                                    {filteredSlips.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-dark-muted">
                                                No records found for this selection.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredSlips.map(slip => {
                                            const emp = employees.find(e => e.id === slip.employeeId);
                                            return (
                                                <tr key={slip.id} className="hover:bg-dark-card/50 transition-colors">
                                                    <td className="p-4">
                                                        <div className="font-medium text-white">{emp?.name || 'Unknown'}</div>
                                                        <div className="text-xs text-dark-muted">{emp?.department}</div>
                                                    </td>
                                                    <td className="p-4 text-right text-white">
                                                        ₹{slip.grossSalary.toLocaleString()}
                                                    </td>
                                                    <td className="p-4 text-right text-red-400">
                                                        -₹{slip.totalDeductions.toLocaleString()}
                                                    </td>
                                                    <td className="p-4 text-right text-green-400 font-bold">
                                                        ₹{slip.netSalary.toLocaleString()}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${slip.status === 'PAID' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                                                            }`}>
                                                            {slip.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        <button
                                                            onClick={() => window.open(`/payroll/slip/${slip.id}`, '_blank')}
                                                            className="p-1.5 text-primary-400 hover:bg-primary-500/10 rounded"
                                                            title="View Slip"
                                                        >
                                                            <ArrowUpRight className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex justify-between items-center px-4 text-dark-muted text-sm">
                        <div>Showing {filteredSlips.length} records</div>
                        <div>Total: ₹ {filteredSlips.reduce((sum, s) => sum + s.netSalary, 0).toLocaleString()}</div>
                    </div>

                </div>
            </div>

            {/* Rollback Confirmation Modal */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="glass rounded-2xl max-w-md w-full p-6 m-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-yellow-500/20 rounded-xl">
                                <AlertTriangle className="w-6 h-6 text-yellow-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Confirm Rollback</h3>
                        </div>

                        <p className="text-dark-muted mb-6">
                            Are you sure you want to rollback to this version? This will create a new draft
                            based on the selected version.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirm(null)}
                                className="flex-1 bg-dark-surface hover:bg-white/5 text-white px-4 py-3 rounded-xl transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleRollback(showConfirm)}
                                className="flex-1 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white px-4 py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                <CheckCircle className="w-5 h-5" />
                                Confirm Rollback
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
