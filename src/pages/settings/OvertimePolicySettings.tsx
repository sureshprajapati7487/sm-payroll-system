import { useState, useEffect } from 'react';
import { API_URL } from '@/lib/apiConfig';
import { Plus, Pencil, Trash2, Clock, Check, X } from 'lucide-react';

interface OTPolicy {
    id: string;
    name: string;
    weeklyCapHours: number;
    dailyCapHours: number;
    multiplier: number;
    effectiveFrom: string;
}

const EMPTY: Omit<OTPolicy, 'id'> = { name: '', weeklyCapHours: 48, dailyCapHours: 12, multiplier: 1.5, effectiveFrom: '' };

function authHeader() {
    try {
        const raw = localStorage.getItem('auth-storage');
        const token = raw ? JSON.parse(raw)?.state?.token : null;
        return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
    } catch { return { 'Content-Type': 'application/json' }; }
}

export const OvertimePolicySettings = () => {
    const [policies, setPolicies] = useState<OTPolicy[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState({ ...EMPTY });
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

    const showToast = (ok: boolean, msg: string) => { setToast({ ok, msg }); setTimeout(() => setToast(null), 3500); };

    const fetchPolicies = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/overtime-policy`, { headers: authHeader() });
            if (res.ok) setPolicies(await res.json());
        } catch {}
        setLoading(false);
    };

    useEffect(() => { fetchPolicies(); }, []);

    const handleSave = async () => {
        if (!form.name) { showToast(false, 'Policy name is required'); return; }
        setSaving(true);
        try {
            const url = editId ? `${API_URL}/overtime-policy/${editId}` : `${API_URL}/overtime-policy`;
            const method = editId ? 'PUT' : 'POST';
            const res = await fetch(url, { method, headers: authHeader(), body: JSON.stringify(form) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Save failed');
            showToast(true, editId ? 'Policy updated' : 'Policy created');
            setShowForm(false);
            setEditId(null);
            setForm({ ...EMPTY });
            fetchPolicies();
        } catch (e: any) { showToast(false, e.message); }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this overtime policy?')) return;
        try {
            await fetch(`${API_URL}/overtime-policy/${id}`, { method: 'DELETE', headers: authHeader() });
            showToast(true, 'Deleted');
            fetchPolicies();
        } catch { showToast(false, 'Delete failed'); }
    };

    const startEdit = (p: OTPolicy) => {
        setEditId(p.id);
        setForm({ name: p.name, weeklyCapHours: p.weeklyCapHours, dailyCapHours: p.dailyCapHours, multiplier: p.multiplier, effectiveFrom: p.effectiveFrom || '' });
        setShowForm(true);
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${toast.ok ? 'bg-success/20 text-success border border-success/30' : 'bg-danger/20 text-danger border border-danger/30'}`}>
                    {toast.msg}
                </div>
            )}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-dark-text mb-1">Overtime Policies</h1>
                    <p className="text-dark-muted text-sm">Define OT caps and multipliers per policy</p>
                </div>
                <button onClick={() => { setShowForm(true); setEditId(null); setForm({ ...EMPTY }); }}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-medium transition-colors">
                    <Plus className="w-4 h-4" /> Add Policy
                </button>
            </div>

            {/* Inline Form */}
            {showForm && (
                <div className="glass rounded-xl p-5 space-y-4">
                    <h3 className="font-semibold text-dark-text">{editId ? 'Edit Policy' : 'New Policy'}</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-xs text-dark-muted mb-1">Policy Name *</label>
                            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. Standard OT Policy"
                                className="w-full bg-dark-bg border border-dark-border text-dark-text rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500" />
                        </div>
                        <div>
                            <label className="block text-xs text-dark-muted mb-1">Weekly Cap (hrs)</label>
                            <input type="number" value={form.weeklyCapHours} onChange={e => setForm(f => ({ ...f, weeklyCapHours: +e.target.value }))}
                                className="w-full bg-dark-bg border border-dark-border text-dark-text rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500" />
                        </div>
                        <div>
                            <label className="block text-xs text-dark-muted mb-1">Daily Cap (hrs)</label>
                            <input type="number" value={form.dailyCapHours} onChange={e => setForm(f => ({ ...f, dailyCapHours: +e.target.value }))}
                                className="w-full bg-dark-bg border border-dark-border text-dark-text rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500" />
                        </div>
                        <div>
                            <label className="block text-xs text-dark-muted mb-1">OT Multiplier</label>
                            <input type="number" step="0.1" value={form.multiplier} onChange={e => setForm(f => ({ ...f, multiplier: +e.target.value }))}
                                className="w-full bg-dark-bg border border-dark-border text-dark-text rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500" />
                        </div>
                        <div>
                            <label className="block text-xs text-dark-muted mb-1">Effective From</label>
                            <input type="date" value={form.effectiveFrom} onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))}
                                className="w-full bg-dark-bg border border-dark-border text-dark-text rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500" />
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={handleSave} disabled={saving}
                            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
                            <Check className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button onClick={() => { setShowForm(false); setEditId(null); }}
                            className="flex items-center gap-1.5 px-4 py-2 bg-dark-card border border-dark-border text-dark-muted hover:text-dark-text rounded-lg text-sm transition-colors">
                            <X className="w-4 h-4" /> Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="glass rounded-xl overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-dark-muted text-sm">Loading policies...</div>
                ) : policies.length === 0 ? (
                    <div className="p-8 text-center text-dark-muted text-sm">No overtime policies configured.</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-dark-bg/50 text-dark-muted border-b border-dark-border/50">
                            <tr>
                                <th className="p-4 text-left">Policy Name</th>
                                <th className="p-4 text-left">Weekly Cap</th>
                                <th className="p-4 text-left">Daily Cap</th>
                                <th className="p-4 text-left">Multiplier</th>
                                <th className="p-4 text-left">Effective From</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border/40">
                            {policies.map(p => (
                                <tr key={p.id} className="hover:bg-dark-card/50 transition-colors">
                                    <td className="p-4 font-medium text-dark-text flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-primary-400" />{p.name}
                                    </td>
                                    <td className="p-4 text-dark-muted">{p.weeklyCapHours}h</td>
                                    <td className="p-4 text-dark-muted">{p.dailyCapHours}h</td>
                                    <td className="p-4 text-dark-muted">{p.multiplier}×</td>
                                    <td className="p-4 text-dark-muted">{p.effectiveFrom || '—'}</td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => startEdit(p)}
                                                className="p-1.5 text-info hover:bg-info/10 rounded transition-colors">
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(p.id)}
                                                className="p-1.5 text-danger hover:bg-danger/10 rounded transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
