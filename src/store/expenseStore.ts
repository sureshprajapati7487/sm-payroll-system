import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { useMultiCompanyStore } from './multiCompanyStore';
import { apiFetch } from '@/lib/apiClient';
import { useRolePermissionsStore } from './rolePermissionsStore';
import { useEmployeeStore } from './employeeStore';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface AuditLog {
    id: string;
    date: string;
    action: string;
    performedBy: string;
    details?: string;
}

export interface Expense {
    id: string;
    companyId?: string;
    date: string;
    category: 'S_ADVANCE' | 'TEA' | 'TRANSPORT' | 'MAINTENANCE' | 'OTHER';
    amount: number;
    description: string;
    paidTo?: string;
    addedBy: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
    auditTrail: AuditLog[];
}

interface ExpenseState {
    expenses: Expense[];
    isLoading: boolean;
    isSaving: boolean;

    fetchExpenses: (month?: string) => Promise<void>;
    addExpense: (expense: Omit<Expense, 'id' | 'status' | 'auditTrail'>) => Promise<void>;
    updateStatus: (id: string, status: Expense['status'], remarks?: string) => Promise<void>;
    deleteExpense: (id: string) => Promise<void>;
    getStats: (month: string) => { total: number; count: number; pending: number };
}

export const useInternalExpenseStore = create<ExpenseState>((set, get) => ({
    expenses: [],
    isLoading: false,
    isSaving: false,

    // ── Fetch from server ─────────────────────────────────────────────────────
    fetchExpenses: async (month?: string) => {
        const companyId = useMultiCompanyStore.getState().currentCompanyId;
        set({ isLoading: true });
        try {
            const params = new URLSearchParams();
            if (companyId) params.append('companyId', companyId);
            if (month) params.append('month', month);
            const res = await apiFetch(`/expenses?${params}`);
            if (res.ok) {
                const data = await res.json();
                // Parse auditTrail if stored as string
                const parsed = data.map((e: any) => ({
                    ...e,
                    auditTrail: typeof e.auditTrail === 'string'
                        ? JSON.parse(e.auditTrail)
                        : (e.auditTrail || [])
                }));
                set({ expenses: parsed });
            }
        } catch (e) {
            console.error('[ExpenseStore] fetchExpenses failed:', e);
        } finally {
            set({ isLoading: false });
        }
    },

    // ── Add → POST /api/expenses ──────────────────────────────────────────────
    addExpense: async (expense) => {
        const currentUser = useAuthStore.getState().user;
        const companyId = useMultiCompanyStore.getState().currentCompanyId;

        const newExpense: Expense = {
            ...expense,
            id: Math.random().toString(36).substr(2, 9),
            companyId: companyId || undefined,
            status: 'PENDING',
            auditTrail: [{
                id: Math.random().toString(36).substr(2, 9),
                date: new Date().toISOString(),
                action: 'CREATED',
                performedBy: currentUser?.name || expense.addedBy || 'System',
                details: 'Expense Created'
            }]
        };

        // Optimistic update
        set(state => ({ expenses: [newExpense, ...state.expenses], isSaving: true }));

        try {
            const res = await apiFetch(`/expenses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newExpense),
            });
            if (res.ok) {
                const saved = await res.json();
                set(state => ({
                    expenses: state.expenses.map(e => e.id === newExpense.id ? {
                        ...saved,
                        auditTrail: typeof saved.auditTrail === 'string'
                            ? JSON.parse(saved.auditTrail) : (saved.auditTrail || [])
                    } : e)
                }));
            }
        } catch (e) {
            console.error('[ExpenseStore] addExpense failed:', e);
            // Rollback
            set(state => ({ expenses: state.expenses.filter(ex => ex.id !== newExpense.id) }));
        } finally {
            set({ isSaving: false });
        }
    },

    // ── Update Status → PUT /api/expenses/:id ────────────────────────────────
    updateStatus: async (id, status, remarks) => {
        const currentUser = useAuthStore.getState().user;

        const newLog: AuditLog = {
            id: Math.random().toString(36).substr(2, 9),
            date: new Date().toISOString(),
            action: status,
            performedBy: currentUser?.name || 'Admin',
            details: remarks || `Status changed to ${status}`
        };

        // Optimistic
        set(state => ({
            expenses: state.expenses.map(e =>
                e.id === id
                    ? { ...e, status, auditTrail: [...(e.auditTrail || []), newLog] }
                    : e
            )
        }));

        try {
            const expense = get().expenses.find(e => e.id === id);
            const updatedAuditTrail = [...(expense?.auditTrail || [])];

            await apiFetch(`/expenses/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, auditTrail: updatedAuditTrail }),
            });
        } catch (e) {
            console.error('[ExpenseStore] updateStatus failed:', e);
            // Refetch to restore real state
            get().fetchExpenses();
        }
    },

    // ── Delete → DELETE /api/expenses/:id ────────────────────────────────────
    deleteExpense: async (id) => {
        // Optimistic remove
        set(state => ({ expenses: state.expenses.filter(e => e.id !== id) }));

        try {
            await apiFetch(`/expenses/${id}`, { method: 'DELETE' });
        } catch (e) {
            console.error('[ExpenseStore] deleteExpense failed:', e);
            get().fetchExpenses();
        }
    },

    // ── Stats helper ──────────────────────────────────────────────────────────
    getStats: (month) => {
        const filtered = get().expenses.filter(e => e.date.startsWith(month));
        const total = filtered
            .filter(e => e.status !== 'REJECTED')
            .reduce((sum, e) => sum + e.amount, 0);
        const pending = filtered.filter(e => e.status === 'PENDING').length;
        return { total, count: filtered.length, pending };
    }
}));

// ── Exported Hook with Data Visibility Filtering ─────────────────────────────
export const useExpenseStore = () => {
    const store = useInternalExpenseStore();
    const user = useAuthStore(s => s.user);
    const getScope = useRolePermissionsStore(s => s.getScope);

    const { _rawStore } = useEmployeeStore();
    const employees = _rawStore?._rawEmployees || [];

    const filteredExpenses = store.expenses.filter(e => {
        if (!user) return true;

        const scope = getScope(user.role);
        if (scope === 'ALL') return true;

        if (scope === 'TEAM') {
            const userEmp = employees.find((emp: any) => emp.id === user.id);
            // Expense doesn't have employeeId, it has addedBy string name
            const recordEmp = employees.find((emp: any) => emp.name === e.addedBy);
            if (!userEmp?.department) return e.addedBy === user.name;
            return recordEmp?.department === userEmp.department;
        }

        if (scope === 'OWN') return e.addedBy === user.name;

        return false;
    });

    return {
        ...store,
        expenses: filteredExpenses,
        _rawStore: store
    };
};

useExpenseStore.getState = () => useInternalExpenseStore.getState();
