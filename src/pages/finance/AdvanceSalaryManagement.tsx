// AdvanceSalaryManagement — Full server-backed advance salary with payroll integration
import { useState, useEffect } from 'react';
import {
    DollarSign, CheckCircle, XCircle, Clock, TrendingDown, RefreshCw,
    Loader2, Plus, Trash2, Users, AlertTriangle, Info
} from 'lucide-react';
import { useAdvanceSalaryStore } from '@/store/advanceSalaryStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { useAuthStore } from '@/store/authStore';

const STATUS_COLORS = {
    approved: 'bg-green-500/20 text-green-400 border-green-500/30',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

export const AdvanceSalaryManagement = () => {
    const { requests, isLoading, fetchAdvances, createRequest, approveRequest, rejectRequest, deleteRequest } = useAdvanceSalaryStore();
    const { _rawEmployees: employees } = useEmployeeStore();
    const { user } = useAuthStore();
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

    const [showForm, setShowForm] = useState(false);
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
    const [formData, setFormData] = useState({ employeeId: '', amount: 0, reason: '', installments: 3 });
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

    const showToast = (ok: boolean, msg: string) => {
        setToast({ ok, msg });
        setTimeout(() => setToast(null), 4000);
    };

    useEffect(() => { fetchAdvances(); }, []);

    const handleCreate = async () => {
        if (!formData.employeeId || !formData.amount) { showToast(false, 'Employee and amount are required'); return; }
        setSubmitting(true);
        const emp = employees.find(e => e.id === formData.employeeId);
        try {
            await createRequest(formData.employeeId, emp?.name || formData.employeeId, formData.amount, formData.reason, formData.installments);
            setFormData({ employeeId: '', amount: 0, reason: '', installments: 3 });
            setShowForm(false);
            showToast(true, 'Advance salary request created');
        } catch { showToast(false, 'Failed to create request'); }
        setSubmitting(false);
    };

    const handleApprove = async (id: string) => {
        await approveRequest(id, user?.name || 'Admin');
        showToast(true, 'Request approved — will deduct from next payroll');
    };
    const handleReject = async (id: string) => {
        await rejectRequest(id);
        showToast(false, 'Request rejected');
    };
    const handleDelete = async (id: string) => {
        if (!confirm('Delete this request permanently?')) return;
        await deleteRequest(id);
        showToast(true, 'Request deleted');
    };

    const filtered = requests.filter(r => filterStatus === 'all' || r.status === filterStatus);
    const pendingCount = requests.filter(r => r.status === 'pending').length;
    const totalAdvanced = requests.filter(r => r.status === 'approved').reduce((s, r) => s + r.amount, 0);
    const totalOutstanding = requests.filter(r => r.status === 'approved').reduce((s, r) => s + r.remainingBalance, 0);
    const recoveryRate = totalAdvanced > 0 ? Math.round(((totalAdvanced - totalOutstanding) / totalAdvanced) * 100) : 0;

    const selectedEmp = employees.find(e => e.id === formData.employeeId);
    const monthlySalary = selectedEmp ? ((selectedEmp.basicSalary || 0) + (selectedEmp.paymentRate || 0)) : 0;
    const emiPreview = formData.amount && formData.installments ? Math.round(formData.amount / formData.installments) : 0;

    return (
        <div className="p-6 space-y-6">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium ${toast.ok ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                    {toast.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <DollarSign className="w-8 h-8 text-primary-500" /> Advance Salary
                    </h1>
                    <p className="text-dark-muted mt-1">Manage advance requests — auto-deducted from payroll on approval</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => fetchAdvances()} disabled={isLoading}
                        className="flex items-center gap-2 border border-dark-border text-slate-400 hover:text-white px-4 py-2.5 rounded-xl text-sm transition-colors">
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </button>
                    <button onClick={() => setShowForm(!showForm)}
                        className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors">
                        <Plus className="w-4 h-4" /> {showForm ? 'Cancel' : 'New Request'}
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Pending', value: pendingCount, color: 'text-yellow-400', icon: <Clock className="w-5 h-5" /> },
                    { label: 'Total Advanced', value: `₹${totalAdvanced.toLocaleString()}`, color: 'text-white', icon: <DollarSign className="w-5 h-5" /> },
                    { label: 'Outstanding', value: `₹${totalOutstanding.toLocaleString()}`, color: 'text-red-400', icon: <TrendingDown className="w-5 h-5" /> },
                    { label: 'Recovery', value: `${recoveryRate}%`, color: 'text-green-400', icon: <CheckCircle className="w-5 h-5" /> },
                ].map(s => (
                    <div key={s.label} className="glass rounded-2xl p-5 flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 ${s.color}`}>{s.icon}</div>
                        <div>
                            <p className="text-dark-muted text-xs">{s.label}</p>
                            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* How it works info */}
            <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-sm text-blue-300">
                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                    <strong className="text-blue-200">How it works:</strong> When you approve an advance and then generate & mark payroll as paid,
                    the monthly EMI is automatically deducted from the employee's net salary until the balance reaches ₹0.
                </div>
            </div>

            {/* Request Form */}
            {showForm && (
                <div className="glass rounded-2xl p-6 space-y-5">
                    <h3 className="text-lg font-semibold text-white">New Advance Request</h3>

                    {/* Employee picker */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1"><Users className="w-3 h-3" /> Employee</label>
                            <select value={formData.employeeId} onChange={e => setFormData({ ...formData, employeeId: e.target.value })}
                                className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2.5 text-white text-sm">
                                <option value="">Select employee…</option>
                                {employees.filter(e => e.status === 'ACTIVE').map(e => (
                                    <option key={e.id} value={e.id}>{e.name} ({e.code})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Amount (₹)</label>
                            <input type="number" min={0} value={formData.amount || ''} onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })}
                                placeholder="0" className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2.5 text-white text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Installments (months)</label>
                            <input type="number" min={1} max={24} value={formData.installments} onChange={e => setFormData({ ...formData, installments: Number(e.target.value) || 1 })}
                                className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2.5 text-white text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Reason</label>
                            <input type="text" value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })}
                                placeholder="Medical emergency, house rent, etc."
                                className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2.5 text-white text-sm" />
                        </div>
                    </div>

                    {/* Preview */}
                    {formData.employeeId && formData.amount > 0 && (
                        <div className="p-4 bg-dark-surface rounded-xl grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                            <div>
                                <p className="text-xs text-slate-500">Monthly Salary</p>
                                <p className="text-white font-semibold">₹{monthlySalary.toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Monthly EMI Deduction</p>
                                <p className="text-yellow-400 font-semibold">₹{emiPreview.toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">% of Salary</p>
                                <p className={`font-semibold ${monthlySalary > 0 && (emiPreview / monthlySalary) > 0.5 ? 'text-red-400' : 'text-green-400'}`}>
                                    {monthlySalary > 0 ? `${Math.round((emiPreview / monthlySalary) * 100)}%` : '—'}
                                </p>
                            </div>
                            {monthlySalary > 0 && (emiPreview / monthlySalary) > 0.5 && (
                                <div className="col-span-full flex items-center gap-2 text-xs text-orange-400">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    EMI exceeds 50% of salary — consider fewer installments or a lower amount
                                </div>
                            )}
                        </div>
                    )}

                    <button onClick={handleCreate} disabled={submitting}
                        className="bg-gradient-to-r from-green-600 to-emerald-600 hover:brightness-110 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all">
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Submit Request
                    </button>
                </div>
            )}

            {/* Filter tabs */}
            <div className="flex gap-2">
                {(['all', 'pending', 'approved', 'rejected'] as const).map(s => (
                    <button key={s} onClick={() => setFilterStatus(s)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize ${filterStatus === s ? 'bg-primary-600 text-white' : 'bg-dark-surface text-slate-400 hover:text-white'}`}>
                        {s} {s !== 'all' && <span className="ml-1 opacity-60">{requests.filter(r => r.status === s).length}</span>}
                    </button>
                ))}
            </div>

            {/* Requests Table */}
            <div className="glass rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-dark-border flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Requests</h3>
                    <span className="text-xs text-slate-500">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
                </div>
                {isLoading ? (
                    <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 text-primary-400 animate-spin" /></div>
                ) : filtered.length === 0 ? (
                    <div className="p-12 text-center">
                        <DollarSign className="w-14 h-14 mx-auto mb-4 text-dark-muted opacity-20" />
                        <p className="text-dark-muted">No advance salary requests found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-dark-surface text-xs text-slate-500">
                                <tr>
                                    <th className="text-left px-5 py-3">Employee</th>
                                    <th className="text-right px-5 py-3">Amount</th>
                                    <th className="text-right px-5 py-3">Monthly EMI</th>
                                    <th className="text-right px-5 py-3">Balance</th>
                                    <th className="text-center px-5 py-3">Status</th>
                                    <th className="text-center px-5 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-border">
                                {filtered.map(req => {
                                    const emp = employees.find(e => e.id === req.employeeId);
                                    const paidPct = req.amount > 0 ? Math.round(((req.amount - req.remainingBalance) / req.amount) * 100) : 100;
                                    return (
                                        <tr key={req.id} className="hover:bg-white/[0.02] transition-all">
                                            <td className="px-5 py-4">
                                                <p className="text-white font-semibold text-sm">{emp?.name || req.employeeName}</p>
                                                <p className="text-dark-muted text-xs">{req.reason} • {req.installments}m</p>
                                                <p className="text-xs text-slate-600 mt-0.5">{new Date(req.requestDate).toLocaleDateString('en-IN')}</p>
                                            </td>
                                            <td className="px-5 py-4 text-right text-white font-semibold">₹{req.amount.toLocaleString()}</td>
                                            <td className="px-5 py-4 text-right text-yellow-400 text-sm">₹{req.monthlyDeduction.toLocaleString()}</td>
                                            <td className="px-5 py-4 text-right">
                                                <div className={`font-semibold text-sm ${req.remainingBalance > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                    ₹{req.remainingBalance.toLocaleString()}
                                                </div>
                                                {req.status === 'approved' && (
                                                    <div className="mt-1 h-1.5 bg-dark-surface rounded-full overflow-hidden w-20 ml-auto">
                                                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${paidPct}%` }} />
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[req.status]}`}>
                                                    {req.status.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    {req.status === 'pending' && isAdmin && (
                                                        <>
                                                            <button onClick={() => handleApprove(req.id)}
                                                                className="p-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors" title="Approve">
                                                                <CheckCircle className="w-4 h-4" />
                                                            </button>
                                                            <button onClick={() => handleReject(req.id)}
                                                                className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors" title="Reject">
                                                                <XCircle className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                    {req.status === 'approved' && req.remainingBalance === 0 && (
                                                        <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Fully recovered</span>
                                                    )}
                                                    {req.status === 'rejected' && isAdmin && (
                                                        <button onClick={() => handleDelete(req.id)}
                                                            className="p-1.5 bg-slate-700 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-lg transition-colors" title="Delete">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
