import { useState } from 'react';
import { useExpenseStore, Expense } from '@/store/expenseStore';
import { useAuthStore } from '@/store/authStore';
import {
    Banknote, Plus, Trash2, Calendar,
    TrendingUp, Coffee, Truck, Wrench, CircleDollarSign, CheckCircle, XCircle, Clock
} from 'lucide-react';
import { clsx } from 'clsx';
import { SkeletonPage } from '@/components/SkeletonLoaders';

export const ExpensesDashboard = () => {
    const { user } = useAuthStore();
    const { expenses, isLoading, addExpense, updateStatus, deleteExpense, getStats } = useExpenseStore();

    // State
    const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [form, setForm] = useState({
        date: new Date().toISOString().split('T')[0],
        category: 'OTHER' as Expense['category'],
        amount: '',
        description: '',
        paidTo: ''
    });
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING'>('ALL');

    // Stats
    const stats = getStats(currentMonth);

    // Filtered List
    const filteredExpenses = expenses
        .filter(e => e.date.startsWith(currentMonth))
        .filter(e => filterStatus === 'ALL' || e.status === filterStatus)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.amount || !form.description) return;

        addExpense({
            date: form.date,
            category: form.category,
            amount: Number(form.amount),
            description: form.description,
            paidTo: form.paidTo || undefined,
            addedBy: user?.name || 'Admin',
        });

        // Reset but keep date
        setForm({ ...form, amount: '', description: '', paidTo: '' });
    };

    const getCategoryIcon = (cat: string) => {
        switch (cat) {
            case 'TEA': return <Coffee className="w-4 h-4 text-orange-400" />;
            case 'TRANSPORT': return <Truck className="w-4 h-4 text-blue-400" />;
            case 'MAINTENANCE': return <Wrench className="w-4 h-4 text-gray-400" />;
            case 'S_ADVANCE': return <Banknote className="w-4 h-4 text-green-400" />;
            default: return <CircleDollarSign className="w-4 h-4 text-purple-400" />;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-dark-text flex items-center gap-2">
                        <Banknote className="w-8 h-8 text-primary-400" />
                        Petty Cash & Expenses
                    </h1>
                    <p className="text-dark-muted">Track daily office expenses with full audit history.</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex bg-dark-bg p-1 rounded-lg border border-dark-border">
                        <button
                            onClick={() => setFilterStatus('ALL')}
                            className={clsx(
                                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                                filterStatus === 'ALL' ? "bg-primary-600 text-white" : "text-dark-muted hover:text-white"
                            )}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilterStatus('PENDING')}
                            className={clsx(
                                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                                filterStatus === 'PENDING' ? "bg-primary-600 text-white" : "text-dark-muted hover:text-white"
                            )}
                        >
                            Pending
                        </button>
                    </div>

                    <div className="flex items-center gap-2 bg-dark-bg p-2 rounded-lg border border-dark-border">
                        <Calendar className="w-4 h-4 text-dark-muted" />
                        <input
                            type="month"
                            value={currentMonth}
                            onChange={(e) => setCurrentMonth(e.target.value)}
                            className="bg-transparent text-white focus:outline-none text-sm"
                        />
                    </div>
                </div>
            </div>

            {isLoading ? (
                <SkeletonPage statCols={3} tableRows={5} tableCols={5} title={false} />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Entry Form */}
                    <div className="glass p-6 rounded-2xl h-fit">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                            <Plus className="w-5 h-5 text-success" />
                            Add New Expense
                        </h3>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs text-dark-muted mb-1">Date</label>
                                <input
                                    type="date"
                                    value={form.date}
                                    onChange={e => setForm({ ...form, date: e.target.value })}
                                    className="w-full bg-dark-bg border border-dark-border rounded-lg p-2 text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-dark-muted mb-1">Category</label>
                                <select
                                    value={form.category}
                                    onChange={e => setForm({ ...form, category: e.target.value as any })}
                                    className="w-full bg-dark-bg border border-dark-border rounded-lg p-2 text-white"
                                >
                                    <option value="TEA">Tea / Snacks</option>
                                    <option value="TRANSPORT">Transport / Petrol</option>
                                    <option value="MAINTENANCE">Maintenance / Repairs</option>
                                    <option value="S_ADVANCE">Staff Advance (Casual)</option>
                                    <option value="OTHER">Other / Misc</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs text-dark-muted mb-1">Amount (₹)</label>
                                <input
                                    type="number"
                                    value={form.amount}
                                    onChange={e => setForm({ ...form, amount: e.target.value })}
                                    placeholder="0.00"
                                    className="w-full bg-dark-bg border border-dark-border rounded-lg p-2 text-white font-mono text-lg"
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-dark-muted mb-1">Description</label>
                                <input
                                    type="text"
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    placeholder="e.g. Guest Tea, Stationary"
                                    className="w-full bg-dark-bg border border-dark-border rounded-lg p-2 text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-dark-muted mb-1">Paid To (Optional)</label>
                                <input
                                    type="text"
                                    value={form.paidTo}
                                    onChange={e => setForm({ ...form, paidTo: e.target.value })}
                                    placeholder="Person Name / Shop"
                                    className="w-full bg-dark-bg border border-dark-border rounded-lg p-2 text-white"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Submit Request
                            </button>
                        </form>
                    </div>

                    {/* List & Stats */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Stats Card */}
                        <div className="glass p-6 rounded-2xl flex items-center justify-between">
                            <div>
                                <p className="text-dark-muted text-sm uppercase tracking-wider">Total Approved ({new Date(currentMonth).toLocaleString('default', { month: 'long' })})</p>
                                <h2 className="text-3xl font-bold text-white mt-1">₹ {stats.total.toLocaleString()}</h2>
                            </div>
                            <div className="flex gap-4">
                                <div className="text-right">
                                    <p className="text-warning text-xs uppercase tracking-wider">Pending</p>
                                    <p className="text-xl font-bold text-white">{stats.pending}</p>
                                </div>
                                <div className="p-4 bg-primary-500/20 rounded-full">
                                    <TrendingUp className="w-8 h-8 text-primary-400" />
                                </div>
                            </div>
                        </div>

                        {/* Transactions List */}
                        <div className="glass rounded-2xl overflow-hidden">
                            <div className="p-4 border-b border-dark-border bg-dark-bg/50 flex justify-between items-center">
                                <h3 className="font-bold text-white">Expense History</h3>
                                <span className="text-xs text-dark-muted">{filteredExpenses.length} entries</span>
                            </div>

                            <div className="max-h-[500px] overflow-y-auto">
                                {filteredExpenses.length > 0 ? (
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-dark-surface text-dark-muted sticky top-0 z-10">
                                            <tr>
                                                <th className="p-4">Date</th>
                                                <th className="p-4">Details</th>
                                                <th className="p-4">Status & Audit</th>
                                                <th className="p-4 text-right">Amount</th>
                                                <th className="p-4 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-dark-border/50">
                                            {filteredExpenses.map(exp => {
                                                const lastAudit = exp.auditTrail?.slice(-1)[0];
                                                return (
                                                    <tr key={exp.id} className="hover:bg-white/5 transition-colors group">
                                                        <td className="p-4 text-dark-muted font-mono whitespace-nowrap">{exp.date}</td>
                                                        <td className="p-4">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                {getCategoryIcon(exp.category)}
                                                                <span className="text-white capitalize text-xs bg-dark-bg px-2 py-1 rounded border border-dark-border">
                                                                    {exp.category.replace('_', ' ')}
                                                                </span>
                                                            </div>
                                                            <div className="text-white font-medium">{exp.description}</div>
                                                            {exp.paidTo && <div className="text-xs text-dark-muted">Paid to: {exp.paidTo}</div>}
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex flex-col gap-1">
                                                                {exp.status === 'PENDING' && (
                                                                    <span className="flex items-center gap-1 text-xs text-warning bg-warning/10 px-2 py-1 rounded w-fit">
                                                                        <Clock className="w-3 h-3" /> Pending
                                                                    </span>
                                                                )}
                                                                {exp.status === 'APPROVED' && (
                                                                    <span className="flex items-center gap-1 text-xs text-success bg-success/10 px-2 py-1 rounded w-fit">
                                                                        <CheckCircle className="w-3 h-3" /> Approved
                                                                    </span>
                                                                )}
                                                                {exp.status === 'REJECTED' && (
                                                                    <span className="flex items-center gap-1 text-xs text-red-400 bg-red-400/10 px-2 py-1 rounded w-fit">
                                                                        <XCircle className="w-3 h-3" /> Rejected
                                                                    </span>
                                                                )}

                                                                {/* Audit Info */}
                                                                {lastAudit && (
                                                                    <span className="text-[10px] text-dark-muted">
                                                                        {lastAudit.action === 'CREATED' ? 'Created' : lastAudit.action} by {lastAudit.performedBy}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-right font-mono text-white font-bold">
                                                            ₹ {exp.amount.toLocaleString()}
                                                        </td>
                                                        <td className="p-4 text-right">
                                                            <div className="flex items-center justify-end gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                                                                {exp.status === 'PENDING' && (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => updateStatus(exp.id, 'APPROVED')}
                                                                            className="p-1.5 hover:bg-success/20 text-success rounded transition-colors"
                                                                            title="Approve"
                                                                        >
                                                                            <CheckCircle className="w-4 h-4" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => updateStatus(exp.id, 'REJECTED')}
                                                                            className="p-1.5 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                                                                            title="Reject"
                                                                        >
                                                                            <XCircle className="w-4 h-4" />
                                                                        </button>
                                                                    </>
                                                                )}
                                                                <button
                                                                    onClick={() => {
                                                                        if (confirm('Delete this entry?')) deleteExpense(exp.id);
                                                                    }}
                                                                    className="p-1.5 hover:bg-red-500/20 text-dark-muted hover:text-red-500 rounded transition-colors"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="p-12 text-center text-dark-muted">
                                        No entries found.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
