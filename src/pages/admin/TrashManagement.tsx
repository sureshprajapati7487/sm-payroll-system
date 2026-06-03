import { useState, useEffect, useCallback } from 'react';
import { Trash2, RefreshCw, AlertTriangle, Loader2, UserX } from 'lucide-react';
import { useDialog } from '@/components/DialogProvider';
import { useAuthStore } from '@/store/authStore';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';
import { PERMISSIONS } from '@/config/permissions';
import { ReasonConfirmModal } from '@/components/ReasonConfirmModal';
import { apiFetch } from '@/lib/apiClient';

interface DeletedEmployee {
    id: string;
    name: string;
    code: string;
    department?: string;
    designation?: string;
    updatedAt: string;  // last update = soft-delete time
}

export const TrashManagement = () => {
    const [employees, setEmployees] = useState<DeletedEmployee[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deleteConfirmItem, setDeleteConfirmItem] = useState<DeletedEmployee | null>(null);
    const [actionInProgress, setActionInProgress] = useState<string | null>(null);

    const { confirm, toast } = useDialog();
    const { hasPermission } = useAuthStore();
    const { currentCompanyId } = useMultiCompanyStore();

    const canRestore = hasPermission(PERMISSIONS.RESTORE_DELETED);
    const canManageTrash = hasPermission(PERMISSIONS.MANAGE_TRASH);

    const fetchDeletedEmployees = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ status: 'INACTIVE', limit: '200' });
            if (currentCompanyId) params.set('companyId', currentCompanyId);
            const res = await apiFetch(`/employees?${params}`);
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            // Backend returns { data, total } pagination shape
            const rows: DeletedEmployee[] = (data?.data ?? data ?? []).map((e: any) => ({
                id: e.id,
                name: e.name,
                code: e.code,
                department: e.department,
                designation: e.designation,
                updatedAt: e.updatedAt || e.createdAt,
            }));
            setEmployees(rows);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    }, [currentCompanyId]);

    useEffect(() => { fetchDeletedEmployees(); }, [fetchDeletedEmployees]);

    const handleRestore = async (emp: DeletedEmployee) => {
        const ok = await confirm({
            title: `${emp.name} ko restore karein?`,
            message: `Employee ko INACTIVE se ACTIVE kar diya jayega.`,
            confirmLabel: 'Haan, Restore Karo',
            cancelLabel: 'Cancel',
            variant: 'warning',
        });
        if (!ok) return;
        setActionInProgress(emp.id);
        try {
            const res = await apiFetch(`/admin/employees/${emp.id}/restore`, { method: 'PATCH' });
            if (!res.ok) throw new Error((await res.json()).error || 'Restore failed');
            setEmployees(prev => prev.filter(e => e.id !== emp.id));
            toast(`${emp.name} successfully restore ho gaya!`, 'success');
        } catch (e: any) {
            toast(`Restore failed: ${e.message}`, 'error');
        } finally {
            setActionInProgress(null);
        }
    };

    const handlePermanentDelete = async (emp: DeletedEmployee, reason: string) => {
        setActionInProgress(emp.id);
        try {
            const res = await apiFetch(`/admin/employees/${emp.id}/permanent`, { method: 'DELETE' });
            if (!res.ok) throw new Error((await res.json()).error || 'Delete failed');
            setEmployees(prev => prev.filter(e => e.id !== emp.id));
            setDeleteConfirmItem(null);
            toast(`${emp.name} permanently delete ho gaya.`, 'warning');
            console.log(`[TrashManagement] Permanent delete: ${emp.id} | Reason: ${reason}`);
        } catch (e: any) {
            toast(`Delete failed: ${e.message}`, 'error');
        } finally {
            setActionInProgress(null);
        }
    };

    const getDaysSinceDelete = (updatedAt: string) => {
        return Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86400000);
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Trash2 className="w-8 h-8 text-danger" /> Trash Management
                    </h1>
                    <p className="text-dark-muted mt-1">Soft-deleted (INACTIVE) employees ko restore ya permanently delete karein</p>
                </div>
                <button
                    onClick={fetchDeletedEmployees}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-dark-card border border-dark-border text-dark-text rounded-xl hover:bg-dark-bg transition-colors disabled:opacity-50 text-sm"
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Refresh
                </button>
            </div>

            {/* Stats card */}
            <div className="glass rounded-xl p-4 flex items-center gap-4">
                <UserX className="w-8 h-8 text-red-400/70 shrink-0" />
                <div>
                    <p className="text-dark-muted text-sm">Soft-deleted Employees (INACTIVE)</p>
                    <p className="text-2xl font-bold text-white">{isLoading ? '…' : employees.length}</p>
                </div>
                <p className="ml-auto text-xs text-dark-muted/60 max-w-xs text-right">
                    Note: Loans, payroll slips, and attendance are soft-deleted by association. Restore employee first.
                </p>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
                </div>
            )}

            {/* Employee trash list */}
            <div className="glass rounded-2xl overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
                    </div>
                ) : employees.length === 0 ? (
                    <div className="text-center py-16 text-dark-muted">
                        <Trash2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
                        <p className="text-lg font-medium">Trash empty hai</p>
                        <p className="text-sm mt-1">Koi bhi INACTIVE employee nahi hai</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-dark-bg border-b border-dark-border">
                                <tr>
                                    <th className="text-left p-4 text-dark-muted text-sm font-medium">Employee</th>
                                    <th className="text-left p-4 text-dark-muted text-sm font-medium">Code</th>
                                    <th className="text-left p-4 text-dark-muted text-sm font-medium">Department</th>
                                    <th className="text-left p-4 text-dark-muted text-sm font-medium">Deleted Since</th>
                                    <th className="text-right p-4 text-dark-muted text-sm font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.map(emp => {
                                    const daysSince = getDaysSinceDelete(emp.updatedAt);
                                    const isActing = actionInProgress === emp.id;
                                    return (
                                        <tr key={emp.id} className="border-b border-dark-border hover:bg-white/5">
                                            <td className="p-4 text-white">{emp.name}</td>
                                            <td className="p-4 text-dark-muted text-sm font-mono">{emp.code}</td>
                                            <td className="p-4 text-dark-muted text-sm">{emp.department || '—'}</td>
                                            <td className="p-4">
                                                <span className={`text-xs px-2 py-1 rounded font-medium ${
                                                    daysSince > 60 ? 'bg-red-500/20 text-red-400'
                                                    : daysSince > 30 ? 'bg-yellow-500/20 text-yellow-400'
                                                    : 'bg-green-500/20 text-green-400'
                                                }`}>
                                                    {daysSince} din pehle
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {canRestore && (
                                                        <button
                                                            onClick={() => handleRestore(emp)}
                                                            disabled={isActing}
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm transition-all disabled:opacity-40"
                                                        >
                                                            {isActing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                                            Restore
                                                        </button>
                                                    )}
                                                    {canManageTrash && (
                                                        <button
                                                            onClick={() => setDeleteConfirmItem(emp)}
                                                            disabled={isActing}
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-all disabled:opacity-40"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                            Delete Forever
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

            {/* Warning */}
            <div className="glass rounded-xl p-4 border-l-4 border-yellow-500">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 shrink-0" />
                    <p className="text-dark-muted text-sm">
                        <span className="text-yellow-400 font-semibold">Important: </span>
                        Permanent deletion reversible nahi hai. Employee ki sab history (attendance, payroll, loans) bhi delete ho jayegi.
                        Sirf tab karein jab aap bilkul sure hon.
                    </p>
                </div>
            </div>

            <ReasonConfirmModal
                isOpen={!!deleteConfirmItem}
                onClose={() => setDeleteConfirmItem(null)}
                title="Permanent Delete Confirm Karein"
                description={`"${deleteConfirmItem?.name}" (${deleteConfirmItem?.code}) ko permanently delete karna chahte hain? Yeh action UNDO nahi ho sakta.`}
                actionLabel="Permanently Delete"
                actionVariant="danger"
                matchText={deleteConfirmItem ? `DELETE ${deleteConfirmItem.name}` : undefined}
                onConfirm={(reason) => {
                    if (deleteConfirmItem) handlePermanentDelete(deleteConfirmItem, reason);
                }}
            />
        </div>
    );
};
