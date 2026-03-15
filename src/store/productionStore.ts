import { create } from 'zustand';
import { ProductionEntry, ProductionStatus } from '@/types';
import { apiFetch } from '@/lib/apiClient';
import { useAuthStore } from './authStore';
import { useRolePermissionsStore } from './rolePermissionsStore';
import { useEmployeeStore } from './employeeStore';

interface ProductionState {
    entries: ProductionEntry[];
    isLoading: boolean;

    // Actions
    fetchProductionEntries: (companyId: string) => Promise<void>;
    addEntry: (entry: Omit<ProductionEntry, 'id' | 'status' | 'totalAmount'>) => Promise<void>;
    addBulkEntries: (entries: Omit<ProductionEntry, 'id' | 'status' | 'totalAmount'>[]) => Promise<{ successCount: number; failedCount: number; errors: any[] }>;
    updateEntry: (id: string, updates: Partial<ProductionEntry>) => Promise<void>;
    approveEntry: (id: string) => Promise<void>;
    rejectEntry: (id: string) => Promise<void>;
    deleteEntry: (id: string) => Promise<void>;
    getEntriesByEmployee: (employeeId: string) => ProductionEntry[];
}

const useInternalProductionStore = create<ProductionState>((set, get) => ({
    entries: [],
    isLoading: false,

    fetchProductionEntries: async (companyId) => {
        set({ isLoading: true });
        try {
            const res = await apiFetch(`/production?companyId=${companyId}`);
            if (res.ok) set({ entries: await res.json() });
        } catch (err) {
            console.error('Failed to fetch production entries:', err);
        } finally {
            set({ isLoading: false });
        }
    },

    addEntry: async (entry) => {
        // 🛡️ > 1000 Units Double Approval Guard
        const isHuge = entry.qty > 1000;
        let workflowApprovals = undefined;
        if (isHuge) {
            workflowApprovals = [
                { stepId: 's1', roleId: 'MANAGER', roleName: 'Manager', status: 'PENDING' as const },
                { stepId: 's2', roleId: 'PRODUCTION_ADMIN', roleName: 'Prod Admin', status: 'PENDING' as const },
            ];
        }

        const newEntry: ProductionEntry = {
            ...entry,
            id: Math.random().toString(36).substr(2, 9),
            totalAmount: entry.qty * entry.rate,
            status: isHuge ? ProductionStatus.PENDING : ProductionStatus.APPROVED, // Huge entries must be approved
            workflowApprovals,
            currentWorkflowStep: isHuge ? 0 : undefined,
        };
        // Optimistic update
        set(state => ({ entries: [newEntry, ...state.entries] }));
        try {
            const res = await apiFetch(`/production`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newEntry),
            });
            if (res.ok) {
                const saved = await res.json();
                // Replace optimistic entry with server-saved entry
                set(state => ({ entries: state.entries.map(e => e.id === newEntry.id ? { ...newEntry, ...saved } : e) }));
            }
        } catch (err) {
            console.error('Failed to save production entry:', err);
        }
    },

    addBulkEntries: async (entries) => {
        // 🛡️ > 1000 Units Double Approval Guard
        const processedEntries = entries.map(e => {
            const isHuge = e.qty > 1000;
            const workflowApprovals = isHuge ? [
                { stepId: 's1', roleId: 'MANAGER', roleName: 'Manager', status: 'PENDING' as const },
                { stepId: 's2', roleId: 'PRODUCTION_ADMIN', roleName: 'Prod Admin', status: 'PENDING' as const },
            ] : undefined;
            return {
                ...e,
                workflowApprovals,
                currentWorkflowStep: isHuge ? 0 : undefined,
            };
        });

        try {
            const res = await apiFetch(`/production/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entries: processedEntries }),
            });

            if (res.status === 207 || res.ok) {
                const result = await res.json();
                // Append successful entries to state
                if (result.successful && result.successful.length > 0) {
                    set(state => ({ entries: [...result.successful, ...state.entries] }));
                }
                return result;
            } else {
                const err = await res.json();
                throw new Error(err.error || 'Failed to bulk add');
            }
        } catch (err: any) {
            console.error('Failed to save bulk production entries:', err);
            return { successCount: 0, failedCount: entries.length, errors: [{ error: err.message }] };
        }
    },

    updateEntry: async (id, updates) => {
        // Optimistic update
        set(state => ({ entries: state.entries.map(e => e.id === id ? { ...e, ...updates } : e) }));
        try {
            await apiFetch(`/production/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
        } catch (err) {
            console.error('Failed to update production entry:', err);
        }
    },

    approveEntry: async (id) => {
        const user = useAuthStore.getState().user;
        const entry = get().entries.find(e => e.id === id);

        if (entry?.workflowApprovals && entry.workflowApprovals.length > 0) {
            const stepIdx = entry.currentWorkflowStep ?? 0;
            const updatedApprovals = entry.workflowApprovals.map((a, i) =>
                i === stepIdx
                    ? { ...a, status: 'APPROVED' as const, actorName: user?.name ?? '', actedAt: new Date().toISOString() }
                    : a
            );
            const nextStep = stepIdx + 1;
            const allDone = nextStep >= updatedApprovals.length;

            const payload = {
                status: allDone ? ProductionStatus.APPROVED : ProductionStatus.PENDING,
                workflowApprovals: updatedApprovals,
                currentWorkflowStep: allDone ? undefined : nextStep
            };

            set(state => ({ entries: state.entries.map(e => e.id === id ? { ...e, ...payload } : e) }));
            try {
                await apiFetch(`/production/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            } catch (err) {
                console.error('Failed to approve production entry:', err);
                set(state => ({ entries: state.entries.map(e => e.id === id ? { ...e, status: ProductionStatus.PENDING } : e) }));
            }
            return;
        }

        const payload = { status: ProductionStatus.APPROVED };
        // Optimistic update
        set(state => ({ entries: state.entries.map(e => e.id === id ? { ...e, ...payload } : e) }));
        try {
            await apiFetch(`/production/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        } catch (err) {
            console.error('Failed to approve production entry:', err);
            // Revert on error
            set(state => ({ entries: state.entries.map(e => e.id === id ? { ...e, status: ProductionStatus.PENDING } : e) }));
        }
    },

    rejectEntry: async (id) => {
        const payload = { status: ProductionStatus.REJECTED };
        set(state => ({ entries: state.entries.map(e => e.id === id ? { ...e, ...payload } : e) }));
        try {
            await apiFetch(`/production/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        } catch (err) {
            console.error('Failed to reject production entry:', err);
            set(state => ({ entries: state.entries.map(e => e.id === id ? { ...e, status: ProductionStatus.PENDING } : e) }));
        }
    },

    deleteEntry: async (id) => {
        // Optimistic removal
        const previous = get().entries;
        set(state => ({ entries: state.entries.filter(e => e.id !== id) }));
        try {
            const res = await apiFetch(`/production/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
        } catch (err) {
            console.error('Failed to delete production entry:', err);
            // Restore on failure
            set({ entries: previous });
        }
    },

    getEntriesByEmployee: (employeeId) => get().entries.filter(e => e.employeeId === employeeId),
}));

// ── Exported Hook with Data Visibility Filtering ─────────────────────────────
export const useProductionStore = () => {
    const store = useInternalProductionStore();
    const user = useAuthStore(s => s.user);
    const getScope = useRolePermissionsStore(s => s.getScope);

    const { _rawStore } = useEmployeeStore();
    const employees = _rawStore?._rawEmployees || [];

    const filteredEntries = store.entries.filter(e => {
        if (!user) return true;

        const scope = getScope(user.role);
        if (scope === 'ALL') return true;

        if (scope === 'TEAM') {
            const userEmp = employees.find((emp: any) => emp.id === user.id);
            const recordEmp = employees.find((emp: any) => emp.id === e.employeeId);
            if (!userEmp?.department) return e.employeeId === user.id; // Fallback to OWN
            return recordEmp?.department === userEmp.department;
        }

        if (scope === 'OWN') return e.employeeId === user.id;

        return false;
    });

    return {
        ...store,
        entries: filteredEntries,
        _rawStore: store
    };
};

useProductionStore.getState = () => useInternalProductionStore.getState();
