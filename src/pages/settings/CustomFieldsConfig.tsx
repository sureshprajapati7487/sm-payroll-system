import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Save, Settings2 } from 'lucide-react';
import { useCustomFieldStore, CustomFieldType, CustomField } from '@/store/customFieldStore';
import { useAuthStore } from '@/store/authStore';
import { InfoTip } from '@/components/ui/InfoTip';
import { PERMISSIONS } from '@/config/permissions';

export const CustomFieldsConfig: React.FC = () => {
    const { fields, addField, updateField, deleteField } = useCustomFieldStore();
    const { hasPermission } = useAuthStore();
    const isAdmin = hasPermission(PERMISSIONS.MANAGE_SETTINGS);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState<Partial<CustomField>>({});

    const [isAdding, setIsAdding] = useState(false);

    const handleSaveNew = () => {
        if (!draft.name || !draft.type) return alert('Name aur Type dono zaroori hain');

        let optionsArray: string[] | undefined;
        if (draft.type === 'select') {
            if (!draft.options || (draft.options as any).length === 0) {
                return alert('Dropdown (Select) ke liye options (comma-separated) lazmi hain');
            }
            if (typeof draft.options === 'string') {
                optionsArray = (draft.options as string).split(',').map(s => s.trim()).filter(Boolean);
            } else {
                optionsArray = draft.options;
            }
        }

        addField({
            name: draft.name,
            type: draft.type as CustomFieldType,
            required: !!draft.required,
            module: 'employee',
            isActive: true,
            options: optionsArray
        });
        setIsAdding(false);
        setDraft({});
    };

    const handleUpdate = (id: string) => {
        if (!draft.name || !draft.type) return alert('Name aur Type required hain');

        let optionsArray: string[] | undefined;
        if (draft.type === 'select') {
            if (typeof draft.options === 'string') {
                optionsArray = (draft.options as string).split(',').map(s => s.trim()).filter(Boolean);
            } else {
                optionsArray = draft.options;
            }
        }

        updateField(id, {
            name: draft.name,
            type: draft.type as CustomFieldType,
            required: !!draft.required,
            options: optionsArray,
        });
        setEditingId(null);
        setDraft({});
    };

    if (!isAdmin) {
        return <div className="p-8 text-center text-slate-500">Sirf Admin isko access kar sakte hain.</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Settings2 className="w-5 h-5 text-indigo-400" /> Dynamic Custom Fields
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">Employee form mein naye fields (e.g. Blood Group, PF Number) dynamically add karein bina coding ke.</p>
                </div>
                {!isAdding && (
                    <button
                        onClick={() => { setIsAdding(true); setDraft({ type: 'text', module: 'employee', required: false }); }}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-indigo-900/20 transition-all"
                    >
                        <Plus className="w-4 h-4" /> Naya Field Banayein
                    </button>
                )}
            </div>

            {/* Add New Field Card */}
            {isAdding && (
                <div className="bg-slate-800 border border-indigo-500/30 rounded-2xl p-5 shadow-xl">
                    <h3 className="text-sm font-bold text-indigo-400 mb-4 flex items-center gap-2">✨ New Custom Field</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div className="col-span-1">
                            <InfoTip id="customFieldLabel" label="Field Name (Label)" />
                            <input
                                autoFocus
                                value={draft.name || ''}
                                onChange={e => setDraft({ ...draft, name: e.target.value })}
                                placeholder="e.g. T-Shirt Size"
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                            />
                        </div>
                        <div className="col-span-1">
                            <InfoTip id="customFieldType" label="Field Type" />
                            <select
                                value={draft.type || 'text'}
                                onChange={e => setDraft({ ...draft, type: e.target.value as CustomFieldType })}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                            >
                                <option value="text">Text (Moti Jankari)</option>
                                <option value="number">Number</option>
                                <option value="date">Date picker</option>
                                <option value="select">Dropdown (Select Box)</option>
                            </select>
                        </div>
                        {draft.type === 'select' && (
                            <div className="col-span-2">
                                <label className="text-xs text-slate-400 block mb-1">Dropdown Options (Comma se alag karein)</label>
                                <input
                                    value={draft.options as any || ''}
                                    onChange={e => setDraft({ ...draft, options: e.target.value as any })}
                                    placeholder="e.g. Small, Medium, Large"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                                />
                            </div>
                        )}
                        <div className="col-span-1 flex flex-col justify-end pb-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={!!draft.required}
                                    onChange={e => setDraft({ ...draft, required: e.target.checked })}
                                    className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500/20"
                                />
                                <span className="text-sm font-medium text-slate-300">Zaroori (Required)</span>
                                <InfoTip id="customFieldRequired" />
                            </label>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={handleSaveNew} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                            <Save className="w-4 h-4" /> Save Field
                        </button>
                        <button onClick={() => setIsAdding(false)} className="bg-slate-700 hover:bg-slate-600 text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* List Existing Fields */}
            <div className="space-y-3">
                {fields.length === 0 && !isAdding && (
                    <div className="text-center py-10 bg-slate-800/50 rounded-2xl border border-slate-700/50 border-dashed">
                        <p className="text-slate-400 text-sm">Abhi tak koi custom fields nahi banaye gaye. Upar "Naya Field Banayein" par click karein.</p>
                    </div>
                )}
                {fields.map(field => {
                    const isEditingThis = editingId === field.id;
                    return (
                        <div key={field.id} className="bg-slate-800/80 border border-slate-700/50 rounded-xl p-4 flex items-start justify-between group hover:border-slate-600 transition-colors">
                            {isEditingThis ? (
                                <div className="flex-1 mr-4">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                                        <input
                                            value={draft.name || ''}
                                            onChange={e => setDraft({ ...draft, name: e.target.value })}
                                            className="col-span-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm"
                                        />
                                        <select
                                            value={draft.type || 'text'}
                                            onChange={e => setDraft({ ...draft, type: e.target.value as CustomFieldType })}
                                            className="col-span-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm"
                                        >
                                            <option value="text">Text</option>
                                            <option value="number">Number</option>
                                            <option value="date">Date</option>
                                            <option value="select">Dropdown</option>
                                        </select>
                                        {draft.type === 'select' && (
                                            <input
                                                value={(typeof draft.options === 'string' ? draft.options : (draft.options?.join(', ') || ''))}
                                                onChange={e => setDraft({ ...draft, options: e.target.value as any })}
                                                placeholder="Chips, comma se"
                                                className="col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm"
                                            />
                                        )}
                                        <label className="col-span-1 flex items-center gap-2 text-sm text-white">
                                            <input type="checkbox" checked={!!draft.required} onChange={e => setDraft({ ...draft, required: e.target.checked })} /> Required
                                        </label>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleUpdate(field.id)} className="bg-emerald-600/20 text-emerald-400 px-3 py-1.5 rounded text-xs font-bold hover:bg-emerald-600/30">Save Update</button>
                                        <button onClick={() => setEditingId(null)} className="bg-slate-700 text-slate-300 px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-600">Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-bold text-white tracking-wide">{field.name}</h3>
                                        <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/20 uppercase tracking-wider">{field.type}</span>
                                        {field.required && <span className="text-[10px] font-bold bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full border border-rose-500/20">Required</span>}
                                        {!field.isActive && <span className="text-[10px] bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">Inactive</span>}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1 uppercase font-mono tracking-widest bg-slate-900/50 inline-block px-1.5 py-0.5 rounded">Module » {field.module}</p>

                                    {field.type === 'select' && field.options && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {field.options.map((opt, i) => (
                                                <span key={i} className="text-[10px] bg-slate-900 border border-slate-700 text-slate-400 px-1.5 py-0.5 rounded">{opt}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {!isEditingThis && (
                                <div className="flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => updateField(field.id, { isActive: !field.isActive })}
                                        className="text-xs px-2 py-1 rounded bg-slate-800 border border-slate-600 text-slate-400 hover:text-white"
                                    >
                                        {field.isActive ? 'Disable' : 'Enable'}
                                    </button>
                                    <button onClick={() => { setEditingId(field.id); setDraft(field); }} className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => { if (confirm('Are you sure you want to delete this field permanently?')) deleteField(field.id); }} className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
