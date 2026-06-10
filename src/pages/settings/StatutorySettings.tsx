import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';
import { Save, Trash2, CalendarCheck, Shield } from 'lucide-react';
import { PERMISSIONS } from '@/config/permissions';
import { InfoTip } from '@/components/ui/InfoTip';
import { apiFetch } from '@/lib/apiClient';
import { useDialog } from '@/components/DialogProvider';

interface StatutoryRule {
    id: string;
    companyId: string;
    effectiveDate: string;
    pfRate: number;
    pfCappedAmount: number;
    esicRate: number;
    esicThreshold: number;
    ptSlabs: any[];
}

export const StatutorySettings = () => {
    const { hasPermission } = useAuthStore();
    const currentCompanyId = useMultiCompanyStore(s => s.currentCompanyId);
    const isAdmin = hasPermission(PERMISSIONS.MANAGE_STATUTORY);

    const [rules, setRules] = useState<StatutoryRule[]>([]);
    const [loading, setLoading] = useState(false);
    const { confirm, toast } = useDialog();

    const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

    const [form, setForm] = useState<Partial<StatutoryRule>>({
        effectiveDate: localToday(),
        pfRate: 12.0,
        pfCappedAmount: 1800,
        esicRate: 0.75,
        esicThreshold: 21000,
        ptSlabs: []
    });

    const fetchRules = async () => {
        if (!currentCompanyId) return;
        setLoading(true);
        try {
            const res = await apiFetch(`/admin/statutory-rules?companyId=${currentCompanyId}`);
            if (res.ok) setRules(await res.json());
        } catch (e) {
            console.error('Failed to fetch statutory rules', e);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchRules();
    }, [currentCompanyId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentCompanyId) return;
        try {
            const res = await apiFetch('/admin/statutory-rules', {
                method: 'POST',
                body: JSON.stringify({ ...form, companyId: currentCompanyId }),
            });
            if (res.ok) {
                fetchRules();
                setForm({ effectiveDate: localToday(), pfRate: 12.0, pfCappedAmount: 1800, esicRate: 0.75, esicThreshold: 21000, ptSlabs: [] });
                toast('Statutory rule saved!', 'success');
            } else {
                const err = await res.json();
                toast(err.error || 'Failed to save rule', 'error');
            }
        } catch {
            toast('Server se connect nahi ho saka', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        const ok = await confirm({
            title: 'Delete Statutory Rule?',
            message: 'Yeh rule delete hoga. Historical payrolls recalculate pe affect ho sakti hain.',
            confirmLabel: 'Haan, Delete Karo',
            cancelLabel: 'Cancel',
            variant: 'danger',
        });
        if (!ok) return;
        try {
            await apiFetch(`/admin/statutory-rules/${id}`, { method: 'DELETE' });
            fetchRules();
            toast('Rule deleted', 'warning');
        } catch {
            toast('Delete failed', 'error');
        }
    };

    if (!isAdmin) {
        return (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center text-red-400">
                <Shield className="w-8 h-8 mx-auto xl mb-2" />
                <h3 className="font-bold">Access Denied</h3>
                <p className="text-sm">You do not have permission to view or modify Statutory Compliance configurations.</p>
            </div>
        );
    }

    const inp = "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-violet-500 outline-none";

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Form */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 space-y-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400">📝</span>
                    Add New Rule
                </h3>
                <p className="text-xs text-slate-400 mb-4">Set future effective dates to change rates without breaking historical locked payrolls.</p>

                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-slate-400 uppercase">Effective Date (From)</label>
                        <input type="date" required value={form.effectiveDate} onChange={e => setForm({ ...form, effectiveDate: e.target.value })} className={inp} />
                        <p className="text-[10px] text-slate-500 mt-1">Rule applies to payrolls ending on or after this date.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-700/50">
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase"><InfoTip id="pfWages" label="PF Rate (%)" /></label>
                            <input type="number" step="0.1" required value={form.pfRate} onChange={e => setForm({ ...form, pfRate: parseFloat(e.target.value) })} className={inp} />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase"><InfoTip id="pfWages" label="PF Cap (₹)" /></label>
                            <input type="number" step="100" required value={form.pfCappedAmount} onChange={e => setForm({ ...form, pfCappedAmount: parseFloat(e.target.value) })} className={inp} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-700/50">
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase"><InfoTip id="esiWages" label="ESI Rate (%)" /></label>
                            <input type="number" step="0.01" required value={form.esicRate} onChange={e => setForm({ ...form, esicRate: parseFloat(e.target.value) })} className={inp} />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase"><InfoTip id="esiWages" label="ESI Max Grs (₹)" /></label>
                            <input type="number" step="100" required value={form.esicThreshold} onChange={e => setForm({ ...form, esicThreshold: parseFloat(e.target.value) })} className={inp} />
                        </div>
                    </div>

                    <button type="submit" className="w-full flex justify-center items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm py-2.5 rounded-xl transition-all">
                        <Save className="w-4 h-4" /> Save Rule
                    </button>
                </form>
            </div>

            {/* List */}
            <div className="lg:col-span-2 space-y-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <CalendarCheck className="w-5 h-5 text-violet-400" />
                    Chronological Rules
                </h3>

                {loading ? (
                    <div className="p-8 text-center text-slate-500 font-medium">Loading rules...</div>
                ) : rules.length === 0 ? (
                    <div className="bg-slate-800/20 border border-slate-700/30 rounded-2xl p-8 text-center text-slate-500 border-dashed">
                        No statutory rules configured for this company. Engine will use hardcoded defaults (12% PF, 0.75% ESI).
                    </div>
                ) : (
                    <div className="space-y-3">
                        {rules.map((rule, idx) => (
                            <div key={rule.id} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <div className={`px-3 py-2 rounded-lg text-center ${idx === 0 ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-slate-900 border border-slate-700 text-slate-400'}`}>
                                        <div className="text-[10px] font-bold uppercase">{idx === 0 ? 'Currently Active' : 'Historical'}</div>
                                        <div className="font-mono text-sm">{rule.effectiveDate}</div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                                        <div className="text-xs">
                                            <span className="text-slate-500">PF:</span> <span className="font-bold text-white">{rule.pfRate}%</span> (Cap: {rule.pfCappedAmount})
                                        </div>
                                        <div className="text-xs">
                                            <span className="text-slate-500">ESI:</span> <span className="font-bold text-white">{rule.esicRate}%</span> (Limit: {rule.esicThreshold})
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(rule.id)}
                                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
