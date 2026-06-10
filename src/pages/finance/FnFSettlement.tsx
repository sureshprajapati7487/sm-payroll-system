import { useState } from 'react';
import { useEmployeeStore } from '@/store/employeeStore';
import { apiFetch } from '@/lib/apiClient';
import { Calculator, CheckCircle, Save, ChevronRight } from 'lucide-react';

interface FnFResult {
    gratuityAmount: number;
    noticePeriodPay: number;
    leaveEncashment: number;
    otherDeductions: number;
    netAmount: number;
    yearsOfService: number;
    basicSalary: number;
    employeeName: string;
}


export const FnFSettlement = () => {
    const { _rawEmployees: employees } = useEmployeeStore();

    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [form, setForm] = useState({
        employeeId: '',
        separationDate: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })(),
        reason: 'RESIGNATION',
        noticePeriodDays: 0,
        pendingLeaveDays: 0,
        otherDeductions: 0,
    });
    const [result, setResult] = useState<FnFResult | null>(null);
    const [savedId, setSavedId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

    const showToast = (ok: boolean, msg: string) => {
        setToast({ ok, msg });
        setTimeout(() => setToast(null), 4000);
    };

    const handleCalculate = async () => {
        if (!form.employeeId || !form.separationDate) { showToast(false, 'Employee and separation date required'); return; }
        setLoading(true);
        try {
            const res = await apiFetch('/fnf/calculate', {
                method: 'POST',
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Calculation failed');
            setResult(data);
            setStep(2);
        } catch (e: any) { showToast(false, e.message); }
        setLoading(false);
    };

    const handleSaveDraft = async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/fnf', {
                method: 'POST',
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Save failed');
            setSavedId(data.id);
            showToast(true, 'Draft saved successfully');
            setStep(3);
        } catch (e: any) { showToast(false, e.message); }
        setLoading(false);
    };

    const handleApprove = async () => {
        if (!savedId) return;
        setLoading(true);
        try {
            const res = await apiFetch(`/fnf/${savedId}/approve`, { method: 'PATCH' });
            if (!res.ok) throw new Error('Approval failed');
            showToast(true, 'Settlement approved!');
        } catch (e: any) { showToast(false, e.message); }
        setLoading(false);
    };

    const activeEmployees = employees.filter(e => e.status === 'ACTIVE' || e.status === 'INACTIVE');

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${toast.ok ? 'bg-success/20 text-success border border-success/30' : 'bg-danger/20 text-danger border border-danger/30'}`}>
                    {toast.msg}
                </div>
            )}

            <div>
                <h1 className="text-2xl font-bold text-dark-text mb-1">Full & Final Settlement</h1>
                <p className="text-dark-muted text-sm">Compute and finalize employee exit settlement</p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2 text-sm">
                {(['Details', 'Breakdown', 'Confirm'] as const).map((label, i) => (
                    <div key={label} className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step > i + 1 ? 'bg-success text-white' : step === i + 1 ? 'bg-primary-600 text-white' : 'bg-dark-card text-dark-muted'}`}>
                            {step > i + 1 ? '✓' : i + 1}
                        </div>
                        <span className={step === i + 1 ? 'text-dark-text font-medium' : 'text-dark-muted'}>{label}</span>
                        {i < 2 && <ChevronRight className="w-4 h-4 text-dark-muted" />}
                    </div>
                ))}
            </div>

            {/* Step 1: Input */}
            {step === 1 && (
                <div className="glass rounded-xl p-6 space-y-4">
                    <div>
                        <label className="block text-xs text-dark-muted mb-1">Employee *</label>
                        <select value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
                            className="w-full bg-dark-bg border border-dark-border text-dark-text rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500">
                            <option value="">Select employee...</option>
                            {activeEmployees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-dark-muted mb-1">Separation Date *</label>
                            <input type="date" value={form.separationDate} onChange={e => setForm(f => ({ ...f, separationDate: e.target.value }))}
                                className="w-full bg-dark-bg border border-dark-border text-dark-text rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500" />
                        </div>
                        <div>
                            <label className="block text-xs text-dark-muted mb-1">Reason</label>
                            <select value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                                className="w-full bg-dark-bg border border-dark-border text-dark-text rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500">
                                <option value="RESIGNATION">Resignation</option>
                                <option value="TERMINATION">Termination</option>
                                <option value="RETIREMENT">Retirement</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs text-dark-muted mb-1">Notice Period Days</label>
                            <input type="number" min={0} value={form.noticePeriodDays} onChange={e => setForm(f => ({ ...f, noticePeriodDays: +e.target.value }))}
                                className="w-full bg-dark-bg border border-dark-border text-dark-text rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500" />
                        </div>
                        <div>
                            <label className="block text-xs text-dark-muted mb-1">Pending Leave Days</label>
                            <input type="number" min={0} value={form.pendingLeaveDays} onChange={e => setForm(f => ({ ...f, pendingLeaveDays: +e.target.value }))}
                                className="w-full bg-dark-bg border border-dark-border text-dark-text rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500" />
                        </div>
                        <div>
                            <label className="block text-xs text-dark-muted mb-1">Other Deductions (₹)</label>
                            <input type="number" min={0} value={form.otherDeductions} onChange={e => setForm(f => ({ ...f, otherDeductions: +e.target.value }))}
                                className="w-full bg-dark-bg border border-dark-border text-dark-text rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500" />
                        </div>
                    </div>
                    <button onClick={handleCalculate} disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-60">
                        <Calculator className="w-4 h-4" />
                        {loading ? 'Calculating...' : 'Calculate Settlement'}
                    </button>
                </div>
            )}

            {/* Step 2: Breakdown */}
            {step === 2 && result && (
                <div className="glass rounded-xl p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-dark-text">{result.employeeName} — Settlement Breakdown</h2>
                    <p className="text-xs text-dark-muted">Service: {result.yearsOfService} year(s) | Basic: ₹{result.basicSalary.toLocaleString()}/mo</p>
                    <table className="w-full text-sm">
                        <tbody className="divide-y divide-dark-border/40">
                            {[
                                { label: 'Notice Period Pay', value: result.noticePeriodPay, positive: true },
                                { label: 'Gratuity', value: result.gratuityAmount, positive: true },
                                { label: 'Leave Encashment', value: result.leaveEncashment, positive: true },
                                { label: 'Other Deductions', value: result.otherDeductions, positive: false },
                            ].map(row => (
                                <tr key={row.label}>
                                    <td className="py-2.5 text-dark-muted">{row.label}</td>
                                    <td className={`py-2.5 text-right font-medium ${row.positive ? 'text-success' : 'text-danger'}`}>
                                        {row.positive ? '+' : '−'} ₹{row.value.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                            <tr className="font-bold">
                                <td className="py-3 text-dark-text">Net Settlement Amount</td>
                                <td className="py-3 text-right text-lg text-primary-400">₹{result.netAmount.toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>
                    <div className="flex gap-3">
                        <button onClick={() => setStep(1)} className="flex-1 py-2 bg-dark-card border border-dark-border text-dark-text rounded-lg text-sm hover:border-primary-500 transition-colors">
                            ← Edit
                        </button>
                        <button onClick={handleSaveDraft} disabled={loading}
                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
                            <Save className="w-4 h-4" />
                            {loading ? 'Saving...' : 'Save as Draft'}
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Confirm & Approve */}
            {step === 3 && (
                <div className="glass rounded-xl p-6 space-y-4 text-center">
                    <CheckCircle className="w-12 h-12 text-success mx-auto" />
                    <h2 className="text-lg font-semibold text-dark-text">Draft Saved</h2>
                    <p className="text-dark-muted text-sm">Settlement ID: <span className="font-mono text-primary-400">{savedId}</span></p>
                    <p className="text-dark-muted text-sm">Click Approve to finalize this settlement record.</p>
                    <button onClick={handleApprove} disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-success/80 hover:bg-success text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-60">
                        <CheckCircle className="w-4 h-4" />
                        {loading ? 'Approving...' : 'Approve Settlement'}
                    </button>
                    <button onClick={() => { setStep(1); setForm({ employeeId: '', separationDate: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })(), reason: 'RESIGNATION', noticePeriodDays: 0, pendingLeaveDays: 0, otherDeductions: 0 }); setResult(null); setSavedId(null); }}
                        className="w-full py-2 text-dark-muted text-sm hover:text-dark-text transition-colors">
                        New Settlement
                    </button>
                </div>
            )}
        </div>
    );
};
