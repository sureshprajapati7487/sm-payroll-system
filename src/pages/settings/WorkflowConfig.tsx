import { useState } from 'react';
import { Network, Plus, Trash2, Save, X } from 'lucide-react';
import { useWorkflowStore, WorkflowConfig, WorkflowStep } from '@/store/workflowStore';
import { useAuthStore } from '@/store/authStore';
import { InfoTip } from '@/components/ui/InfoTip';

const ROLES = [
    { id: 'MANAGER', label: 'Manager' },
    { id: 'HR', label: 'HR Admin' },
    { id: 'ADMIN', label: 'Admin' },
    { id: 'SUPER_ADMIN', label: 'Super Admin' }
];

export const WorkflowBuilder = () => {
    const { workflows, toggleWorkflow, updateWorkflow, addWorkflow, deleteWorkflow } = useWorkflowStore();
    const { user } = useAuthStore();

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<WorkflowConfig>>({});

    const handleEdit = (w: WorkflowConfig) => {
        setEditingId(w.id);
        setEditForm({ ...w });
    };

    const handleSave = () => {
        if (editingId && editForm.name) {
            updateWorkflow(editingId, editForm);
            setEditingId(null);
            setEditForm({});
        }
    };

    const handleCreateNew = () => {
        addWorkflow({
            module: 'leave',
            name: 'New Custom Workflow',
            isActive: false,
            steps: [{ id: `s-${Date.now()}`, roleId: 'MANAGER', roleName: 'Manager', stepOrder: 1 }]
        });
    };

    const updateEditSteps = (steps: WorkflowStep[]) => {
        setEditForm({ ...editForm, steps: steps.map((s, i) => ({ ...s, stepOrder: i + 1 })) });
    };

    const addStep = () => {
        if (!editForm.steps) return;
        const newStep: WorkflowStep = {
            id: `s-${Date.now()}`,
            roleId: 'MANAGER',
            roleName: 'Manager',
            stepOrder: editForm.steps.length + 1
        };
        updateEditSteps([...editForm.steps, newStep]);
    };

    const removeStep = (id: string) => {
        if (!editForm.steps) return;
        updateEditSteps(editForm.steps.filter(s => s.id !== id));
    };

    // Only SUPER_ADMIN can configure this deeply
    if (user?.role !== 'SUPER_ADMIN') {
        return (
            <div className="p-8 text-center text-dark-muted">
                You do not have permission to view or modify System Workflows.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Network className="w-5 h-5 text-indigo-400" />
                        Approval Workflows
                    </h2>
                    <p className="text-sm text-dark-muted mt-1">
                        Define multi-level approval chains for leaves and loans.
                    </p>
                </div>
                <button
                    onClick={handleCreateNew}
                    className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    New Workflow
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {workflows.map(w => (
                    <div key={w.id} className="glass rounded-2xl border border-dark-border overflow-hidden">

                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-dark-border bg-dark-bg/40">
                            {editingId === w.id ? (
                                <input
                                    type="text"
                                    value={editForm.name || ''}
                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                    className="bg-dark-surface border border-dark-border px-3 py-1.5 rounded-lg text-sm text-white w-full max-w-[200px]"
                                />
                            ) : (
                                <div>
                                    <h3 className="font-semibold text-white text-base">{w.name}</h3>
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-dark-muted">
                                        {w.module}
                                    </span>
                                </div>
                            )}

                            <div className="flex items-center gap-2">
                                {/* Toggle Active */}
                                <InfoTip id="workflowActive" />
                                <button
                                    onClick={() => toggleWorkflow(w.id)}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors ${w.isActive ? 'bg-success' : 'bg-dark-border'}`}
                                >
                                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${w.isActive ? 'translate-x-1.5' : '-translate-x-1.5'}`} />
                                </button>
                                {editingId === w.id ? (
                                    <button onClick={handleSave} className="text-success hover:text-green-400 p-1">
                                        <Save className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <button onClick={() => handleEdit(w)} className="text-indigo-400 hover:text-indigo-300 p-1 text-xs font-medium uppercase tracking-wider">
                                        Edit
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Body / Steps */}
                        <div className="p-4 space-y-3">
                            {editingId === w.id ? (
                                <>
                                    <div className="mb-3">
                                        <InfoTip id="workflowModule" label="Module" />
                                        <select
                                            value={editForm.module}
                                            onChange={e => setEditForm({ ...editForm, module: e.target.value as any })}
                                            className="bg-dark-surface border border-dark-border px-3 py-2 rounded-lg text-sm text-white w-full"
                                        >
                                            <option value="leave">Leave</option>
                                            <option value="loan">Loan</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <InfoTip id="workflowStep" label="Approval Levels (In Order)" />
                                        {(editForm.steps || []).map((step, idx) => (
                                            <div key={step.id} className="flex items-center gap-2 bg-dark-bg/50 border border-dark-border p-2 rounded-lg">
                                                <div className="w-6 h-6 rounded-full bg-dark-surface flex items-center justify-center text-xs text-dark-muted font-mono shrink-0">
                                                    {idx + 1}
                                                </div>
                                                <select
                                                    value={step.roleId}
                                                    onChange={e => {
                                                        const role = ROLES.find(r => r.id === e.target.value);
                                                        const newSteps = [...(editForm.steps || [])];
                                                        newSteps[idx] = { ...step, roleId: e.target.value, roleName: role?.label || '' };
                                                        updateEditSteps(newSteps);
                                                    }}
                                                    className="flex-1 bg-transparent border-none text-white text-sm focus:ring-0 px-1"
                                                >
                                                    {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                                                </select>
                                                <button onClick={() => removeStep(step.id)} className="text-danger hover:text-red-400 p-1">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                        <button onClick={addStep} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-2">
                                            <Plus className="w-3 h-3" /> Add Level
                                        </button>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-dark-border flex justify-between items-center">
                                        <button onClick={() => deleteWorkflow(w.id)} className="text-danger flex items-center gap-1 text-xs">
                                            <Trash2 className="w-3 h-3" /> Delete Workflow
                                        </button>
                                        <button onClick={() => { setEditingId(null); setEditForm({}); }} className="text-dark-muted text-xs">
                                            Cancel
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div>
                                    {w.steps.length === 0 ? (
                                        <div className="text-sm text-dark-muted italic">No approval steps defined. (Auto-approves or relies on default logic)</div>
                                    ) : (
                                        <div className="flex items-center flex-wrap gap-2 text-sm">
                                            {w.steps.map((step, idx) => (
                                                <div key={step.id} className="flex items-center gap-2">
                                                    <div className="px-2.5 py-1 rounded-full bg-dark-surface border border-dark-border text-dark-text text-xs flex items-center gap-1.5 font-medium shadow-sm">
                                                        <span className="w-4 h-4 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-[10px]">{idx + 1}</span>
                                                        {step.roleName}
                                                    </div>
                                                    {idx < w.steps.length - 1 && (
                                                        <span className="text-dark-muted">→</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
