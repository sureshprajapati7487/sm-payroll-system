import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';
import { Save, Trash2, CalendarCheck, Shield } from 'lucide-react';
import { Roles } from '@/types';
import { InfoTip } from '@/components/ui/InfoTip';

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
    const { user } = useAuthStore();
    const currentCompanyId = useMultiCompanyStore(s => s.currentCompanyId);
    const isAdmin = user?.role === Roles.SUPER_ADMIN || user?.role === Roles.ADMIN || user?.role === Roles.ACCOUNT_ADMIN;

    const [rules, setRules] = useState<StatutoryRule[]>([]);
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState<Partial<StatutoryRule>>({
        effectiveDate: new Date().toISOString().split('T')[0],
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
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/statutory-rules?companyId=${currentCompanyId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setRules(data);
            }
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
            const token = localStorage.getItem('token');
            const res = await fetch('/api/statutory-rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ ...form, companyId: currentCompanyId })
            });

            if (res.ok) {
                fetchRules();
                setForm({
                    effectiveDate: new Date().toISOString().split('T')[0],
                    pfRate: 12.0,
                    pfCappedAmount: 1800,
                    esicRate: 0.75,
                    esicThreshold: 21000,
                    ptSlabs: []
                });
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to save rule');
            }
        } catch (e) {
            console.error(e);
            alert('Error saving rule');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this rule? Historical payrolls may be affected if recalculated.')) return;
        try {
            const token = localStorage.getItem('token');
            await fetch(`/api/statutory-rules/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchRules();
        } catch (e) {
            console.error(e);
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
