import { useState } from 'react';
import { useSystemConfigStore } from '@/store/systemConfigStore';
import { X, Plus, Edit2, Wallet, Trash2, ShieldAlert } from 'lucide-react';
import { LoanType } from '@/types';

interface Props {
    onClose: () => void;
}

export const LoanTypesModal = ({ onClose }: Props) => {
    const config = useSystemConfigStore();
    const loanTypes = config.loanTypes || [];

    const [form, setForm] = useState({ key: '', label: '' });
    const [editingId, setEditingId] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.label.trim()) return;

        // Auto-generate key if empty, format: UPPER_SNAKE_CASE
        const finalKey = form.key.trim() ? form.key.trim().toUpperCase().replace(/\s+/g, '_') : form.label.trim().toUpperCase().replace(/\s+/g, '_');

        if (editingId) {
            config.updateLoanType(editingId, finalKey, form.label);
            setEditingId(null);
        } else {
            // Check if key already exists
            if (loanTypes.some(lt => lt.key === finalKey)) {
                alert('A loan type with this key already exists!');
                return;
            }
            config.addLoanType(finalKey, form.label);
        }
        setForm({ key: '', label: '' });
    };

    const handleEdit = (lt: any) => {
        setEditingId(lt.id);
        setForm({ key: lt.key, label: lt.label });
    };

    const isSystemType = (key: string) => {
        // Prevent deleting core types if needed, or just allow all.
        // For now, let's say PF_LOAN and ADVANCE_CASH are core.
        return key === LoanType.PF_LOAN || key === LoanType.ADVANCE_CASH;
    };

    const handleDelete = (id: string, key: string) => {
        if (isSystemType(key)) {
            alert('Cannot delete core system loan types.');
            return;
        }
        if (window.confirm('Are you sure you want to delete this loan type?')) {
            // TODO: Ensure no active loans are using this type before deleting (ideally backend check)
            config.deleteLoanType(id);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 w-full max-w-2xl rounded-2xl border border-slate-700 shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">

                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-primary-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white leading-none">Manage Loan Types</h2>
                            <p className="text-sm text-slate-400 mt-1">Configure available loan categories</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors bg-slate-800 p-2 rounded-full hover:bg-slate-700">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-6">

                    {/* Add / Edit Form */}
                    <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                            {editingId ? <Edit2 className="w-4 h-4 text-warning" /> : <Plus className="w-4 h-4 text-primary-400" />}
                            {editingId ? 'Edit Loan Type' : 'Create New Loan Type'}
                        </h3>
                        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 items-end">
                            <div className="flex-1 w-full space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Display Name</label>
                                <input
                                    required
                                    type="text"
                                    value={form.label}
                                    onChange={e => setForm({ ...form, label: e.target.value })}
                                    placeholder="e.g. Festival Advance"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500"
                                />
                            </div>
                            <div className="flex-1 w-full space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unique Key (Optional)</label>
                                <input
                                    type="text"
                                    value={form.key}
                                    onChange={e => setForm({ ...form, key: e.target.value })}
                                    placeholder="e.g. FESTIVAL_ADV"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder:font-sans focus:outline-none focus:border-primary-500 uppercase"
                                />
                            </div>
                            <div className="w-full sm:w-auto flex gap-2">
                                {editingId && (
                                    <button
                                        type="button"
                                        onClick={() => { setEditingId(null); setForm({ key: '', label: '' }); }}
                                        className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-bold transition-all border border-slate-700"
                                    >
                                        Cancel
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={!form.label.trim()}
                                    className="py-2 px-6 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-primary-900/20"
                                >
                                    {editingId ? 'Save Changes' : 'Add Type'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* List */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {loanTypes.map(lt => (
                            <div key={lt.id} className="bg-slate-800/30 border border-slate-700 p-4 rounded-xl flex items-center justify-between group hover:border-slate-500 transition-colors">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <Wallet className="w-4 h-4 text-slate-400" />
                                        <h4 className="font-bold text-white text-sm">{lt.label}</h4>
                                    </div>
                                    <p className="text-xs text-slate-500 font-mono mt-1 pr-2">Key: {lt.key}</p>
                                </div>
                                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleEdit(lt)}
                                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
                                        title="Edit"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    {!isSystemType(lt.key) ? (
                                        <button
                                            onClick={() => handleDelete(lt.id, lt.key)}
                                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    ) : (
                                        <div className="p-1.5 text-slate-600" title="System Type - Cannot Delete">
                                            <ShieldAlert className="w-3.5 h-3.5" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                </div>
            </div>
        </div>
    );
};
