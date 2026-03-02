// HolidayManager — Server-backed with Indian holiday preload, inline edit, year filter, search
import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useHolidayStore } from '@/store/holidayStore';
import { PERMISSIONS } from '@/config/permissions';
import {
    Calendar, Trash2, Plus, ShieldAlert, RefreshCw, Loader2,
    Download, Search, Edit2, Check, X, Star, Flag, Sparkles
} from 'lucide-react';
import { Holiday } from '@/types';

// ── Indian National & Festival Holidays 2026 ──────────────────────────────────
const INDIAN_HOLIDAYS_2026: Omit<Holiday, 'id'>[] = [
    { name: 'New Year\'s Day', date: '2026-01-01', type: 'OPTIONAL', description: 'New Year celebration' },
    { name: 'Makar Sankranti', date: '2026-01-14', type: 'FESTIVAL', description: 'Harvest festival' },
    { name: 'Republic Day', date: '2026-01-26', type: 'NATIONAL', description: 'National holiday' },
    { name: 'Maha Shivratri', date: '2026-02-17', type: 'FESTIVAL', description: 'Festival of Shiva' },
    { name: 'Holi', date: '2026-03-03', type: 'FESTIVAL', description: 'Festival of colors' },
    { name: 'Good Friday', date: '2026-04-03', type: 'FESTIVAL', description: 'Christian holiday' },
    { name: 'Dr. Ambedkar Jayanti', date: '2026-04-14', type: 'NATIONAL', description: 'Birth anniversary of B.R. Ambedkar' },
    { name: 'Ram Navami', date: '2026-03-26', type: 'FESTIVAL', description: 'Birth of Lord Ram' },
    { name: 'Eid ul-Fitr', date: '2026-03-21', type: 'FESTIVAL', description: 'End of Ramadan' },
    { name: 'Mahavir Jayanti', date: '2026-04-07', type: 'FESTIVAL', description: 'Jain festival' },
    { name: 'Eid ul-Adha', date: '2026-05-28', type: 'FESTIVAL', description: 'Festival of Sacrifice' },
    { name: 'Muharram', date: '2026-06-27', type: 'FESTIVAL', description: 'Islamic New Year' },
    { name: 'Independence Day', date: '2026-08-15', type: 'NATIONAL', description: 'India\'s Independence Day' },
    { name: 'Janmashtami', date: '2026-08-21', type: 'FESTIVAL', description: 'Birth of Lord Krishna' },
    { name: 'Milad-un-Nabi', date: '2026-09-04', type: 'FESTIVAL', description: 'Prophet\'s birthday' },
    { name: 'Gandhi Jayanti', date: '2026-10-02', type: 'NATIONAL', description: 'Birth anniversary of Mahatma Gandhi' },
    { name: 'Dussehra', date: '2026-10-19', type: 'FESTIVAL', description: 'Victory of good over evil' },
    { name: 'Diwali', date: '2026-11-08', type: 'FESTIVAL', description: 'Festival of lights' },
    { name: 'Guru Nanak Jayanti', date: '2026-11-24', type: 'FESTIVAL', description: 'Sikh festival' },
    { name: 'Christmas', date: '2026-12-25', type: 'FESTIVAL', description: 'Christian holiday' },
];

const TYPE_STYLES: Record<string, string> = {
    NATIONAL: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
    FESTIVAL: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
    OPTIONAL: 'bg-slate-500/15 text-slate-400 border-slate-500/25',
};
const TYPE_ICON: Record<string, JSX.Element> = {
    NATIONAL: <Flag className="w-3 h-3" />,
    FESTIVAL: <Star className="w-3 h-3" />,
    OPTIONAL: <Sparkles className="w-3 h-3" />,
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const HolidayManager = () => {
    const { hasPermission } = useAuthStore();
    const { holidays, isLoading, fetchHolidays, addHoliday, updateHoliday, removeHoliday, bulkImport } = useHolidayStore();
    const canManage = hasPermission(PERMISSIONS.MANAGE_HOLIDAYS);

    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState<'ALL' | 'NATIONAL' | 'FESTIVAL' | 'OPTIONAL'>('ALL');
    const [form, setForm] = useState({ name: '', date: '', type: 'FESTIVAL' as Holiday['type'], description: '' });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editData, setEditData] = useState<Partial<Holiday>>({});
    const [submitting, setSubmitting] = useState(false);
    const [importing, setImporting] = useState(false);
    const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

    const showToast = (ok: boolean, msg: string) => {
        setToast({ ok, msg });
        setTimeout(() => setToast(null), 3500);
    };

    useEffect(() => { fetchHolidays(selectedYear); }, [selectedYear]);

    const filtered = useMemo(() =>
        holidays
            .filter(h => h.date.startsWith(String(selectedYear)))
            .filter(h => filterType === 'ALL' || h.type === filterType)
            .filter(h => !search || h.name.toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => a.date.localeCompare(b.date)),
        [holidays, selectedYear, filterType, search]
    );

    // Group by month
    const byMonth = useMemo(() => {
        const groups: Record<number, Holiday[]> = {};
        filtered.forEach(h => {
            const m = new Date(h.date + 'T00:00:00').getMonth();
            if (!groups[m]) groups[m] = [];
            groups[m].push(h);
        });
        return groups;
    }, [filtered]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name || !form.date) { showToast(false, 'Name and date required'); return; }
        setSubmitting(true);
        await addHoliday(form);
        setForm({ name: '', date: '', type: 'FESTIVAL', description: '' });
        showToast(true, 'Holiday added');
        setSubmitting(false);
    };

    const handleBulkImport = async () => {
        setImporting(true);
        const toImport = INDIAN_HOLIDAYS_2026.filter(h => h.date.startsWith(String(selectedYear)));
        await bulkImport(toImport);
        showToast(true, `${toImport.length} Indian holidays imported for ${selectedYear}`);
        setImporting(false);
    };

    const startEdit = (h: Holiday) => { setEditingId(h.id); setEditData({ name: h.name, date: h.date, type: h.type, description: h.description }); };
    const cancelEdit = () => { setEditingId(null); setEditData({}); };
    const saveEdit = async (id: string) => {
        await updateHoliday(id, editData);
        showToast(true, 'Holiday updated');
        cancelEdit();
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete "${name}"?`)) return;
        await removeHoliday(id);
        showToast(true, 'Holiday deleted');
    };

    const stats = {
        total: filtered.length,
        national: filtered.filter(h => h.type === 'NATIONAL').length,
        festival: filtered.filter(h => h.type === 'FESTIVAL').length,
        optional: filtered.filter(h => h.type === 'OPTIONAL').length,
    };

    if (!canManage) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
                <ShieldAlert className="w-16 h-16 text-red-400 opacity-50" />
                <h1 className="text-2xl font-bold text-white">Access Denied</h1>
                <p className="text-dark-muted">Only Administrators can manage holidays.</p>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium ${toast.ok ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                    {toast.ok ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Calendar className="w-8 h-8 text-primary-500" /> Holiday Calendar
                    </h1>
                    <p className="text-dark-muted mt-1">Company holidays — linked to payroll & attendance salary calculation</p>
                </div>
                <div className="flex gap-3 flex-wrap">
                    {/* Year selector */}
                    <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
                        className="bg-dark-surface border border-dark-border text-white rounded-xl px-4 py-2.5 text-sm">
                        {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <button onClick={() => fetchHolidays(selectedYear)} disabled={isLoading}
                        className="flex items-center gap-2 border border-dark-border text-slate-400 hover:text-white px-4 py-2.5 rounded-xl text-sm transition-colors">
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </button>
                    <button onClick={handleBulkImport} disabled={importing}
                        className="flex items-center gap-2 bg-amber-600/80 hover:bg-amber-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors">
                        {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Import Indian Holidays
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total', value: stats.total, color: 'text-white' },
                    { label: 'National', value: stats.national, color: 'text-blue-400' },
                    { label: 'Festival', value: stats.festival, color: 'text-purple-400' },
                    { label: 'Optional', value: stats.optional, color: 'text-slate-400' },
                ].map(s => (
                    <div key={s.label} className="glass rounded-2xl p-4 text-center">
                        <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-dark-muted text-xs mt-1">{s.label}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Add Form */}
                <div className="glass p-6 rounded-2xl h-fit border border-primary-500/20">
                    <h3 className="font-bold text-white mb-5 flex items-center gap-2 border-b border-dark-border pb-3">
                        <Plus className="w-5 h-5 text-primary-500" /> Add Holiday
                    </h3>
                    <form onSubmit={handleAdd} className="space-y-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Holiday Name</label>
                            <input type="text" placeholder="e.g. Diwali" value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                className="w-full bg-dark-bg/50 border border-dark-border rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-primary-500" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Date</label>
                            <input type="date" value={form.date}
                                onChange={e => setForm({ ...form, date: e.target.value })}
                                className="w-full bg-dark-bg/50 border border-dark-border rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-primary-500" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Type</label>
                            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as Holiday['type'] })}
                                className="w-full bg-dark-bg/50 border border-dark-border rounded-xl px-3 py-2.5 text-white text-sm outline-none">
                                <option value="NATIONAL">🇮🇳 National Holiday</option>
                                <option value="FESTIVAL">🎉 Festival</option>
                                <option value="OPTIONAL">📌 Optional</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Description (optional)</label>
                            <input type="text" placeholder="Brief note" value={form.description}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                                className="w-full bg-dark-bg/50 border border-dark-border rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-primary-500" />
                        </div>
                        <button type="submit" disabled={submitting}
                            className="w-full py-2.5 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            Add to Calendar
                        </button>
                    </form>
                </div>

                {/* List */}
                <div className="md:col-span-2 glass rounded-2xl overflow-hidden">
                    {/* Filters */}
                    <div className="p-4 border-b border-dark-border flex gap-3 flex-wrap items-center">
                        <div className="relative flex-1 min-w-[160px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Search holidays…"
                                className="w-full pl-9 pr-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-white text-sm outline-none" />
                        </div>
                        <div className="flex gap-1.5">
                            {(['ALL', 'NATIONAL', 'FESTIVAL', 'OPTIONAL'] as const).map(t => (
                                <button key={t} onClick={() => setFilterType(t)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === t ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                                    {t === 'ALL' ? 'All' : t.charAt(0) + t.slice(1).toLowerCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Month-grouped list */}
                    <div className="overflow-y-auto max-h-[600px] p-4 space-y-5">
                        {isLoading ? (
                            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-primary-400 animate-spin" /></div>
                        ) : filtered.length === 0 ? (
                            <div className="text-center py-14">
                                <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                                <p className="text-dark-muted">No holidays for {selectedYear}</p>
                                <button onClick={handleBulkImport} disabled={importing}
                                    className="mt-3 px-4 py-2 bg-amber-600/80 hover:bg-amber-500 text-white rounded-xl text-sm font-medium">
                                    Import Indian Holidays
                                </button>
                            </div>
                        ) : (
                            Object.keys(byMonth).map(mStr => {
                                const m = Number(mStr);
                                return (
                                    <div key={m}>
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{MONTHS[m]} {selectedYear}</p>
                                        <div className="space-y-2">
                                            {byMonth[m].map(h => {
                                                const d = new Date(h.date + 'T00:00:00');
                                                const isEditing = editingId === h.id;
                                                return (
                                                    <div key={h.id} className="group flex items-start gap-4 p-3.5 bg-dark-bg/30 hover:bg-dark-bg/50 rounded-xl border border-transparent hover:border-dark-border transition-all">
                                                        {/* Day Box */}
                                                        <div className="w-12 h-12 shrink-0 bg-dark-surface rounded-xl flex flex-col items-center justify-center border border-dark-border">
                                                            <span className="text-[9px] text-slate-500 font-bold uppercase">{MONTHS[d.getMonth()]}</span>
                                                            <span className="text-lg font-bold text-white leading-none">{d.getDate()}</span>
                                                        </div>

                                                        {/* Content */}
                                                        <div className="flex-1 min-w-0">
                                                            {isEditing ? (
                                                                <div className="space-y-2">
                                                                    <input value={editData.name || ''} onChange={e => setEditData({ ...editData, name: e.target.value })}
                                                                        className="w-full bg-dark-surface border border-primary-500/50 rounded-lg px-3 py-1.5 text-white text-sm outline-none" />
                                                                    <div className="flex gap-2">
                                                                        <input type="date" value={editData.date || ''} onChange={e => setEditData({ ...editData, date: e.target.value })}
                                                                            className="bg-dark-surface border border-dark-border rounded-lg px-2 py-1.5 text-white text-xs outline-none" />
                                                                        <select value={editData.type || 'FESTIVAL'} onChange={e => setEditData({ ...editData, type: e.target.value as Holiday['type'] })}
                                                                            className="bg-dark-surface border border-dark-border rounded-lg px-2 py-1.5 text-white text-xs outline-none">
                                                                            <option value="NATIONAL">National</option>
                                                                            <option value="FESTIVAL">Festival</option>
                                                                            <option value="OPTIONAL">Optional</option>
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <p className="font-semibold text-white text-sm">{h.name}</p>
                                                                        <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium ${TYPE_STYLES[h.type]}`}>
                                                                            {TYPE_ICON[h.type]} {h.type}
                                                                        </span>
                                                                    </div>
                                                                    {h.description && <p className="text-xs text-slate-500 mt-0.5">{h.description}</p>}
                                                                    <p className="text-xs text-slate-600 mt-0.5">{d.toLocaleDateString('en-IN', { weekday: 'long' })}</p>
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* Actions */}
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            {isEditing ? (
                                                                <>
                                                                    <button onClick={() => saveEdit(h.id)} className="p-1.5 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg transition-colors">
                                                                        <Check className="w-4 h-4" />
                                                                    </button>
                                                                    <button onClick={cancelEdit} className="p-1.5 bg-slate-700 text-slate-400 hover:bg-slate-600 rounded-lg transition-colors">
                                                                        <X className="w-4 h-4" />
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button onClick={() => startEdit(h)} className="p-1.5 text-slate-500 hover:text-primary-400 hover:bg-primary-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                                                                        <Edit2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button onClick={() => handleDelete(h.id, h.name)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
