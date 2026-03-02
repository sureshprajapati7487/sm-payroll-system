import { useState } from 'react';
import { useRateStore } from '@/store/rateStore';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { motion } from 'framer-motion';

export const RateManager = ({ onClose }: { onClose: () => void }) => {
    const { items, addItem, updateItem, removeItem } = useRateStore();
    const [newItem, setNewItem] = useState({ name: '', rate: '', category: 'Stitching' });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ name: '', rate: '', category: '' });

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItem.name || !newItem.rate) return;

        addItem({
            name: newItem.name,
            rate: parseFloat(newItem.rate),
            category: newItem.category
        });
        setNewItem({ name: '', rate: '', category: 'Stitching' });
    };

    const startEdit = (item: any) => {
        setEditingId(item.id);
        setEditForm({ name: item.name, rate: item.rate.toString(), category: item.category });
    };

    const saveEdit = () => {
        if (editingId) {
            updateItem(editingId, {
                name: editForm.name,
                rate: parseFloat(editForm.rate),
                category: editForm.category
            });
            setEditingId(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
            >
                <div className="p-6 border-b border-dark-border flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Manage Production Rates</h2>
                    <button onClick={onClose} className="text-dark-muted hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    {/* Add New Form */}
                    <form onSubmit={handleAdd} className="bg-dark-bg/50 p-4 rounded-xl border border-dark-border mb-6 flex gap-3 items-end">
                        <div className="flex-1 space-y-1">
                            <label className="text-xs text-dark-muted">Item Name</label>
                            <input
                                type="text"
                                placeholder="e.g. Packing Shirt"
                                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-primary-500"
                                value={newItem.name}
                                onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                            />
                        </div>
                        <div className="w-24 space-y-1">
                            <label className="text-xs text-dark-muted">Rate (₹)</label>
                            <input
                                type="number"
                                placeholder="0"
                                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-primary-500"
                                value={newItem.rate}
                                onChange={e => setNewItem({ ...newItem, rate: e.target.value })}
                            />
                        </div>
                        <div className="w-32 space-y-1">
                            <label className="text-xs text-dark-muted">Category</label>
                            <select
                                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-primary-500"
                                value={newItem.category}
                                onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                            >
                                <option>Stitching</option>
                                <option>Packing</option>
                                <option>Finishing</option>
                                <option>Cutting</option>
                                <option>Other</option>
                            </select>
                        </div>
                        <button type="submit" className="bg-primary-600 hover:bg-primary-700 text-white p-2 rounded-lg transition-colors">
                            <Plus className="w-5 h-5" />
                        </button>
                    </form>

                    {/* Rate List */}
                    <div className="space-y-2">
                        {items.length === 0 ? (
                            <p className="text-center text-dark-muted py-8">No rates defined yet.</p>
                        ) : (
                            items.map(item => (
                                <div key={item.id} className="flex items-center justify-between p-3 bg-dark-bg rounded-lg group border border-transparent hover:border-dark-border transition-all">
                                    {editingId === item.id ? (
                                        <div className="flex items-center gap-3 w-full">
                                            <input
                                                className="flex-1 bg-dark-card border border-dark-border rounded px-2 py-1 text-white text-sm"
                                                value={editForm.name}
                                                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                            />
                                            <input
                                                className="w-20 bg-dark-card border border-dark-border rounded px-2 py-1 text-white text-sm"
                                                type="number"
                                                value={editForm.rate}
                                                onChange={e => setEditForm({ ...editForm, rate: e.target.value })}
                                            />
                                            <button onClick={saveEdit} className="text-success hover:bg-success/10 p-1.5 rounded">
                                                <Save className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setEditingId(null)} className="text-danger hover:bg-danger/10 p-1.5 rounded">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-full bg-primary-500/10 flex items-center justify-center text-primary-500 text-xs font-bold">
                                                    {item.category[0]}
                                                </div>
                                                <div>
                                                    <p className="text-white font-medium text-sm">{item.name}</p>
                                                    <p className="text-xs text-dark-muted">{item.category}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <p className="text-white font-mono font-bold">₹{item.rate}</p>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => startEdit(item)} className="text-primary-400 hover:bg-primary-500/10 p-1.5 rounded">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => removeItem(item.id)} className="text-danger hover:bg-danger/10 p-1.5 rounded">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
