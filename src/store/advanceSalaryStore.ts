// advanceSalaryStore — Server-first with localStorage cache
import { create } from 'zustand';
import { apiFetch } from '@/lib/apiClient';
import { useMultiCompanyStore } from './multiCompanyStore';

export interface AdvanceSalaryRequest {
    id: string;
    employeeId: string;
    employeeName: string;
    companyId?: string;
    amount: number;
    reason: string;
    requestDate: string;
    status: 'pending' | 'approved' | 'rejected';
    approvedBy?: string;
    approvedDate?: string;
    installments: number;
    monthlyDeduction: number;
    remainingBalance: number;
}

interface AdvanceSalaryState {
    requests: AdvanceSalaryRequest[];
    isLoading: boolean;

    fetchAdvances: (employeeId?: string) => Promise<void>;
    createRequest: (employeeId: string, employeeName: string, amount: number, reason: string, installments: number) => Promise<void>;
    approveRequest: (requestId: string, approvedBy?: string) => Promise<void>;
    rejectRequest: (requestId: string) => Promise<void>;
    processMonthlyDeduction: (employeeId: string) => Promise<number>;
    getEmployeeBalance: (employeeId: string) => number;
    getEmployeeRequests: (employeeId: string) => AdvanceSalaryRequest[];
    deleteRequest: (requestId: string) => Promise<void>;
}

export const useAdvanceSalaryStore = create<AdvanceSalaryState>((set, get) => ({
    requests: [],
    isLoading: false,

    // ── Fetch from server ─────────────────────────────────────────────────────
    fetchAdvances: async (employeeId) => {
        set({ isLoading: true });
        try {
            const companyId = useMultiCompanyStore.getState().currentCompanyId;
            const params = new URLSearchParams();
            if (companyId) params.append('companyId', companyId);
            if (employeeId) params.append('employeeId', employeeId);
            const res = await apiFetch(`/finance/advances?${params}`);
            if (res.ok) {
                const data: AdvanceSalaryRequest[] = await res.json();
                set({ requests: data });
            }
        } catch (e) {
            console.error('[AdvanceSalaryStore] fetchAdvances failed:', e);
        } finally {
            set({ isLoading: false });
        }
    },

    // ── Create new request → POST /api/advance-salary ─────────────────────────
    createRequest: async (employeeId, employeeName, amount, reason, installments) => {
        const companyId = useMultiCompanyStore.getState().currentCompanyId;
        const monthlyDeduction = Math.round(amount / installments);
        const optimistic: AdvanceSalaryRequest = {
            id: `adv-${Date.now()}`,
            employeeId, employeeName, companyId: companyId || undefined,
            amount, reason, installments, monthlyDeduction,
            remainingBalance: amount,
            requestDate: new Date().toISOString(),
            status: 'pending',
        };
        set(s => ({ requests: [optimistic, ...s.requests] }));
        try {
            const res = await apiFetch(`/finance/advances`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(optimistic),
            });
            if (res.ok) {
                const saved = await res.json();
                set(s => ({ requests: s.requests.map(r => r.id === optimistic.id ? saved : r) }));
            }
        } catch (e) {
            console.error('[AdvanceSalaryStore] createRequest failed:', e);
            set(s => ({ requests: s.requests.filter(r => r.id !== optimistic.id) }));
        }
    },

    // ── Approve → PATCH /api/advance-salary/:id/status ───────────────────────
    approveRequest: async (requestId, approvedBy = 'Admin') => {
        set(s => ({ requests: s.requests.map(r => r.id === requestId ? { ...r, status: 'approved' as const, approvedBy, approvedDate: new Date().toISOString() } : r) }));
        try {
            await apiFetch(`/finance/advances/${requestId}/approve`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ approvedBy }),
            });
        } catch (e) {
            console.error('[AdvanceSalaryStore] approveRequest failed:', e);
            set(s => ({ requests: s.requests.map(r => r.id === requestId ? { ...r, status: 'pending' as const } : r) }));
        }
    },

    // ── Reject → PATCH /api/advance-salary/:id/status ────────────────────────
    rejectRequest: async (requestId) => {
        set(s => ({ requests: s.requests.map(r => r.id === requestId ? { ...r, status: 'rejected' as const, remainingBalance: 0 } : r) }));
        try {
            await apiFetch(`/finance/advances/${requestId}/reject`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (e) {
            console.error('[AdvanceSalaryStore] rejectRequest failed:', e);
            set(s => ({ requests: s.requests.map(r => r.id === requestId ? { ...r, status: 'approved' as const } : r) }));
        }
    },

    // ── Process monthly deduction on payroll paid ─────────────────────────────
    processMonthlyDeduction: async (employeeId) => {
        let totalDeducted = 0;
        const approvedAdvances = get().requests.filter(r => r.employeeId === employeeId && r.status === 'approved' && r.remainingBalance > 0);

        for (const req of approvedAdvances) {
            const deduction = Math.min(req.monthlyDeduction, req.remainingBalance);
            const newBalance = Math.max(0, req.remainingBalance - deduction);
            totalDeducted += deduction;

            // Optimistic update
            set(s => ({ requests: s.requests.map(r => r.id === req.id ? { ...r, remainingBalance: newBalance } : r) }));

            // Persist to server
            try {
                await apiFetch(`/advance-salary/${req.id}/deduct`, { method: 'PATCH' });
            } catch (e) {
                console.error('[AdvanceSalaryStore] processMonthlyDeduction failed for', req.id, e);
            }
        }
        return totalDeducted;
    },

    // ── Delete request ────────────────────────────────────────────────────────
    deleteRequest: async (requestId) => {
        set(s => ({ requests: s.requests.filter(r => r.id !== requestId) }));
        try {
            await apiFetch(`/finance/advances/${requestId}`, { method: 'DELETE' });
        } catch (e) {
            console.error('[AdvanceSalaryStore] deleteRequest failed:', e);
        }
    },

    // ── Local helpers ─────────────────────────────────────────────────────────
    getEmployeeBalance: (employeeId) =>
        get().requests.filter(r => r.employeeId === employeeId && r.status === 'approved').reduce((s, r) => s + r.remainingBalance, 0),

    getEmployeeRequests: (employeeId) =>
        get().requests.filter(r => r.employeeId === employeeId).sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()),
}));
