import { useEffect } from 'react';
import { DollarSign, TrendingUp, Building, PieChart, Download, RefreshCw, AlertCircle } from 'lucide-react';
import { usePayrollStore } from '@/store/payrollStore';
import { useLoanStore } from '@/store/loanStore';
import { useExpenseStore } from '@/store/expenseStore';
import { useNavigate } from 'react-router-dom';

export const FinanceDashboard = () => {
    const navigate = useNavigate();
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevMonth = now.getMonth() === 0
        ? `${now.getFullYear() - 1}-12`
        : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;

    // ── Stores ────────────────────────────────────────────────────────────────
    const { slips, fetchPayroll } = usePayrollStore();
    const { loans } = useLoanStore();
    const { fetchExpenses, getStats } = useExpenseStore();

    useEffect(() => {
        fetchPayroll(currentMonth);
        fetchPayroll(prevMonth);
        fetchExpenses(currentMonth);
    }, []);

    // ── Current Month Payroll ──────────────────────────────────────────────────
    const currentSlips = slips.filter(s => s.month === currentMonth);
    const prevSlips = slips.filter(s => s.month === prevMonth);
    const totalPayroll = currentSlips.reduce((sum, s) => sum + s.netSalary, 0);
    const prevPayroll = prevSlips.reduce((sum, s) => sum + s.netSalary, 0);
    const payrollChange = prevPayroll > 0 ? ((totalPayroll - prevPayroll) / prevPayroll) * 100 : 0;

    // ── Loans ─────────────────────────────────────────────────────────────────
    const activeLoans = loans.filter(l => l.status === 'ACTIVE');
    const totalLoanBalance = activeLoans.reduce((sum, l) => sum + l.balance, 0);

    // ── PF/ESI Dues (from current slips) ─────────────────────────────────────
    const totalPFDues = currentSlips.reduce((sum, s) => sum + (s.pfDeduction || 0), 0);

    // ── Expenses ─────────────────────────────────────────────────────────────
    const expenseStats = getStats(currentMonth);

    // ── Stats cards ──────────────────────────────────────────────────────────
    const stats = [
        {
            label: 'Total Payroll Disbursed',
            value: totalPayroll > 0 ? `₹${(totalPayroll / 100000).toFixed(2)}L` : '—',
            rawValue: totalPayroll,
            change: payrollChange !== 0 ? `${payrollChange > 0 ? '+' : ''}${payrollChange.toFixed(1)}%` : 'No prev data',
            positive: payrollChange >= 0,
            icon: DollarSign,
            color: 'text-green-400',
            bg: 'bg-green-500/10',
            action: () => navigate('/payroll'),
        },
        {
            label: 'Pending Loan Balance',
            value: totalLoanBalance > 0 ? `₹${totalLoanBalance.toLocaleString('en-IN')}` : '₹0',
            rawValue: totalLoanBalance,
            change: `${activeLoans.length} active loan${activeLoans.length !== 1 ? 's' : ''}`,
            positive: false,
            icon: TrendingUp,
            color: 'text-yellow-400',
            bg: 'bg-yellow-500/10',
            action: () => navigate('/loans'),
        },
        {
            label: 'Statutory Dues (PF/ESI)',
            value: totalPFDues > 0 ? `₹${totalPFDues.toLocaleString('en-IN')}` : currentSlips.length > 0 ? '₹0' : '—',
            rawValue: totalPFDues,
            change: currentSlips.length > 0 ? `${currentSlips.length} employees` : 'Payroll not run',
            positive: true,
            icon: Building,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10',
            action: () => navigate('/statutory/reports'),
        },
        {
            label: 'Operating Expenses',
            value: expenseStats.total > 0 ? `₹${expenseStats.total.toLocaleString('en-IN')}` : '₹0',
            rawValue: expenseStats.total,
            change: `${expenseStats.count} entries${expenseStats.pending > 0 ? `, ${expenseStats.pending} pending` : ''}`,
            positive: expenseStats.pending === 0,
            icon: PieChart,
            color: 'text-purple-400',
            bg: 'bg-purple-500/10',
            action: () => navigate('/expenses'),
        },
    ];

    // ── Month label ───────────────────────────────────────────────────────────
    const monthLabel = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    const payrollNotRun = currentSlips.length === 0;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <DollarSign className="w-8 h-8 text-primary-500" />
                        Finance Overview
                    </h1>
                    <p className="text-dark-muted mt-1">
                        {monthLabel} — Live data from payroll, loans &amp; expenses
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap sm:gap-3">
                    <button
                        onClick={() => { fetchPayroll(currentMonth); fetchExpenses(currentMonth); }}
                        className="flex items-center gap-2 px-4 py-2 bg-dark-surface hover:bg-white/5 text-white rounded-xl transition-all"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                    <button
                        onClick={() => navigate('/statutory/reports')}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition-all"
                    >
                        <Download className="w-4 h-4" />
                        Download P&amp;L
                    </button>
                </div>
            </div>

            {/* Payroll not run warning */}
            {payrollNotRun && (
                <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                    <div>
                        <div className="text-amber-400 font-semibold text-sm">{monthLabel} ka payroll abhi run nahi kiya gaya</div>
                        <div className="text-dark-muted text-xs mt-0.5">
                            Finance data tab dikhega jab payroll generate hoga.{' '}
                            <button onClick={() => navigate('/payroll')} className="text-primary-400 hover:underline">
                                Payroll Dashboard jaayein →
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                    <button
                        key={i}
                        onClick={stat.action}
                        className="glass p-6 rounded-2xl text-left hover:bg-white/5 transition-all group"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-xl ${stat.bg}`}>
                                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                            </div>
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${stat.change.startsWith('+') || stat.positive
                                ? 'bg-green-500/20 text-green-400'
                                : stat.change.startsWith('-')
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-dark-surface text-dark-muted'
                                }`}>
                                {stat.change}
                            </span>
                        </div>
                        <h3 className="text-dark-muted text-sm font-medium">{stat.label}</h3>
                        <p className="text-2xl font-bold text-white mt-1 group-hover:text-primary-400 transition-colors">
                            {stat.value}
                        </p>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Payroll Slips */}
                <div className="glass rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">
                        Recent Payroll — {monthLabel}
                    </h3>
                    {currentSlips.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-dark-muted">
                            <DollarSign className="w-10 h-10 opacity-20 mb-3" />
                            <div className="text-sm">Is mahinे का payroll abhi generate nahi hua</div>
                            <button
                                onClick={() => navigate('/payroll')}
                                className="mt-3 text-xs text-primary-400 hover:underline"
                            >
                                Payroll Generate Karein →
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {currentSlips.slice(0, 4).map((slip, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-dark-surface rounded-xl">
                                    <div>
                                        <div className="text-white text-sm font-medium">Employee #{slip.employeeId.slice(-4)}</div>
                                        <div className="text-xs text-dark-muted">{slip.month}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-white font-bold text-sm">₹{slip.netSalary.toLocaleString('en-IN')}</div>
                                        <div className={`text-xs ${slip.status === 'PAID' ? 'text-green-400' : 'text-yellow-500'}`}>
                                            {slip.status}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {currentSlips.length > 4 && (
                                <button
                                    onClick={() => navigate('/payroll/history')}
                                    className="w-full text-center text-primary-400 text-xs hover:underline pt-1"
                                >
                                    +{currentSlips.length - 4} more — View All
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Active Loans */}
                <div className="glass rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Active Loans</h3>
                    {activeLoans.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-dark-muted">
                            <TrendingUp className="w-10 h-10 opacity-20 mb-3" />
                            <div className="text-sm">Koi active loan nahi hai</div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {activeLoans.slice(0, 4).map((loan, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-dark-surface rounded-xl">
                                    <div>
                                        <div className="text-white text-sm font-medium">
                                            {loan.type} Loan
                                        </div>
                                        <div className="text-xs text-dark-muted">
                                            EMI: ₹{loan.emiAmount?.toLocaleString('en-IN') || 0}/mo
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-white font-bold text-sm">
                                            ₹{loan.balance.toLocaleString('en-IN')}
                                        </div>
                                        <div className="text-xs text-yellow-500">Outstanding</div>
                                    </div>
                                </div>
                            ))}
                            {activeLoans.length > 4 && (
                                <button
                                    onClick={() => navigate('/loans')}
                                    className="w-full text-center text-primary-400 text-xs hover:underline pt-1"
                                >
                                    +{activeLoans.length - 4} more — View All
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
