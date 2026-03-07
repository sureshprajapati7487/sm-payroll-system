import { create } from 'zustand';
import { LeaveRequest, LeaveStatus } from '@/types';
import { useMultiCompanyStore } from './multiCompanyStore';
import { apiFetch } from '@/lib/apiClient';

interface LeaveState {
    requests: LeaveRequest[];
    isLoading: boolean;

    // Actions
    fetchLeaves: () => Promise<void>;
    requestLeave: (req: Omit<LeaveRequest, 'id' | 'status' | 'appliedOn'>) => Promise<void>;
    approveLeave: (id: string) => Promise<void>;
    rejectLeave: (id: string) => Promise<void>;
    cancelLeave: (id: string) => Promise<void>;
    getLeavesByEmployee: (employeeId: string) => LeaveRequest[];
}

export const useLeaveStore = create<LeaveState>((set, get) => ({
    requests: [],
    isLoading: false,

    // ── Fetch from server ─────────────────────────────────────────────────────
    fetchLeaves: async () => {
        const companyId = useMultiCompanyStore.getState().currentCompanyId;
        set({ isLoading: true });
        try {
            const params = companyId ? `?companyId=${companyId}` : '';
            const res = await apiFetch(`/leaves${params}`);
            if (res.ok) {
                const data = await res.json();
                set({ requests: data });
            }
        } catch (e) {
            console.error('[LeaveStore] fetchLeaves failed:', e);
        } finally {
            set({ isLoading: false });
        }
    },

    // ── Request Leave → POST /api/leaves ─────────────────────────────────────
    requestLeave: async (req) => {
        const companyId = useMultiCompanyStore.getState().currentCompanyId;

        const newRequest: LeaveRequest = {
            ...req,
            id: Math.random().toString(36).substr(2, 9),
            companyId: companyId || undefined,
            status: LeaveStatus.PENDING,
            appliedOn: new Date().toISOString().split('T')[0],
        };

        // Optimistic update
        set(state => ({ requests: [newRequest, ...state.requests] }));

        try {
            const res = await apiFetch(`/leaves`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newRequest),
            });
            if (res.ok) {
                const saved = await res.json();
                // Replace optimistic with server response
                set(state => ({
                    requests: state.requests.map(r => r.id === newRequest.id ? saved : r)
                }));
            }
        } catch (e) {
            console.error('[LeaveStore] requestLeave failed:', e);
            // Rollback on failure
            set(state => ({ requests: state.requests.filter(r => r.id !== newRequest.id) }));
        }
    },

    // ── Approve → PATCH /api/leaves/:id/approve ──────────────────────────────
    approveLeave: async (id) => {
        // Optimistic update
        set(state => ({
            requests: state.requests.map(r =>
                r.id === id ? { ...r, status: LeaveStatus.APPROVED } : r
            )
        }));

        try {
            await apiFetch(`/leaves/${id}/approve`, {
                method: 'PATCH',
            });
        } catch (e) {
            console.error('[LeaveStore] approveLeave failed:', e);
            // Rollback
            set(state => ({
                requests: state.requests.map(r =>
                    r.id === id ? { ...r, status: LeaveStatus.PENDING } : r
                )
            }));
        }
    },

    // ── Reject → PATCH /api/leaves/:id/reject ───────────────────────────────
    rejectLeave: async (id) => {
        // Optimistic update
        set(state => ({
            requests: state.requests.map(r =>
                r.id === id ? { ...r, status: LeaveStatus.REJECTED } : r
            )
        }));

        try {
            await apiFetch(`/leaves/${id}/reject`, {
                method: 'PATCH',
            });
        } catch (e) {
            console.error('[LeaveStore] rejectLeave failed:', e);
            // Rollback
            set(state => ({
                requests: state.requests.map(r =>
                    r.id === id ? { ...r, status: LeaveStatus.PENDING } : r
                )
            }));
        }
    },

    // ── Cancel (Employee self-cancel) → DELETE /api/leaves/:id ───────────────
    cancelLeave: async (id) => {
        // Optimistic
        set(state => ({ requests: state.requests.filter(r => r.id !== id) }));

        try {
            await apiFetch(`/leaves/${id}`, { method: 'DELETE' });
        } catch (e) {
            console.error('[LeaveStore] cancelLeave failed:', e);
            // Refetch to restore state
            get().fetchLeaves();
        }
    },

    // ── Query helper ──────────────────────────────────────────────────────────
    getLeavesByEmployee: (employeeId) => {
        return get().requests.filter(r => r.employeeId === employeeId);
    }
}));
