import { create } from 'zustand';
import { SalarySlip } from '@/types';
import { useEmployeeStore } from './employeeStore';
import { useLoanStore } from './loanStore';
import { useAdvanceSalaryStore } from './advanceSalaryStore';
import { useMultiCompanyStore } from './multiCompanyStore';
import { apiFetch } from '@/lib/apiClient';
import { audit } from '@/lib/auditLogger';
import { useAuthStore } from './authStore';
import { useRolePermissionsStore } from './rolePermissionsStore';

interface PayrollState {
    slips: SalarySlip[];
    monthsGenerated: string[];
    isLoading: boolean;
    isSaving: boolean;

    // Actions
    fetchPayroll: (month?: string) => Promise<void>;
    generateMonthlyPayroll: (month: string, generatedBy?: string) => Promise<void>;
    advanceState: (slipId: string, action: 'simulate' | 'approve' | 'lock') => Promise<void>;
    getSlipsByMonth: (month: string) => SalarySlip[];
    markAsPaid: (slipId: string) => Promise<void>;
}

const useInternalPayrollStore = create<PayrollState>((set, get) => ({
    slips: [],
    monthsGenerated: [],
    isLoading: false,
    isSaving: false,

    // ── Fetch Slips from Server ────────────────────────────────────────────────
    fetchPayroll: async (month) => {
        set({ isLoading: true });
        try {
            const path = month ? `/payroll?month=${month}` : `/payroll`;
            const res = await apiFetch(path);
            if (res.ok) {
                const data: SalarySlip[] = await res.json();
                // Merge fetched slips into current state
                set(state => {
                    const otherSlips = month
                        ? state.slips.filter(s => s.month !== month)
                        : [];
                    const generatedMonths = Array.from(
                        new Set([...state.monthsGenerated, ...data.map(s => s.month)])
                    );
                    return {
                        slips: [...otherSlips, ...data],
                        monthsGenerated: generatedMonths,
                    };
                });
            }
        } catch (err) {
            console.error('Failed to fetch payroll from server:', err);
        } finally {
            set({ isLoading: false });
        }
    },

    // ── Generate Monthly Payroll + Save to Server ──────────────────────────────
    // ── Generate Monthly Payroll + Save to Server ──────────────────────────────
    generateMonthlyPayroll: async (month, generatedBy) => {
        set({ isSaving: true });

        try {
            const companyId = useMultiCompanyStore.getState().currentCompanyId;
            const res = await apiFetch(`/payroll/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyId, month, generatedBy: generatedBy || 'System' }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.why || errData.error || 'Failed to generate payroll');
            }

            // Immediately re-fetch the month's slips
            await get().fetchPayroll(month);

            // Audit payroll generation
            const slipsCount = get().slips.filter(s => s.month === month).length;
            const totalNetPay = get().slips.filter(s => s.month === month).reduce((s, sl) => s + sl.netSalary, 0);

            audit({
                action: 'GENERATE_PAYROLL',
                entityType: 'PAYROLL',
                details: { month, employeeCount: slipsCount, totalNetPay },
                status: 'SUCCESS',
            });

        } catch (err) {
            console.error('Failed to generate payroll:', err);
            throw err;
        } finally {
            set({ isSaving: false });
        }
    },

    // ── Advance Slip State (State Machine) ────────────────────────────────────
    advanceState: async (slipId: string, action: 'simulate' | 'approve' | 'lock') => {
        const targetSlip = get().slips.find(s => s.id === slipId);
        if (!targetSlip || targetSlip.status === 'LOCKED') return;

        let nextStatus: 'DRAFT' | 'SIMULATION' | 'FINAL_APPROVED' | 'LOCKED' | 'PAID' | 'GENERATED';
        if (action === 'simulate') nextStatus = 'SIMULATION';
        else if (action === 'approve') nextStatus = 'FINAL_APPROVED';
        else nextStatus = 'LOCKED';

        // Auto deduct loans only on LOCK
        if (action === 'lock') {
            const empLoans = useLoanStore.getState()._rawLoans.filter(
                l => l.employeeId === targetSlip.employeeId && l.status === 'ACTIVE'
            );

            let remainingDeduction = targetSlip.loanDeduction;
            if (remainingDeduction > 0) {
                empLoans.forEach(loan => {
                    if (remainingDeduction <= 0) return;
                    const customDeduction = Math.min(loan.emiAmount, loan.balance, remainingDeduction);
                    if (customDeduction > 0) {
                        useLoanStore.getState().payEMI(loan.id, customDeduction);
                        remainingDeduction -= customDeduction;
                    }
                });
            }

            if ((targetSlip.advanceDeduction ?? 0) > 0) {
                useAdvanceSalaryStore.getState().processMonthlyDeduction(targetSlip.employeeId);
            }
        }

        // Optimistic update
        const prevStatus = targetSlip.status;
        set(state => ({
            slips: state.slips.map(s =>
                s.id === slipId ? { ...s, status: nextStatus } : s
            )
        }));

        try {
            const res = await apiFetch(`/payroll/${slipId}/${action}`, {
                method: 'PATCH',
            });
            if (!res.ok) throw new Error('Failed to update state');

            // Audit
            const slipEmp = useEmployeeStore.getState()._rawEmployees.find(e => e.id === targetSlip.employeeId);
            audit({
                action: 'UPDATE_PAYROLL',
                entityType: 'PAYROLL',
                entityId: slipId,
                entityName: slipEmp?.name ?? targetSlip.employeeId,
                details: { month: targetSlip.month, netSalary: targetSlip.netSalary, action: action.toUpperCase() },
                status: 'SUCCESS',
            });
        } catch (err) {
            console.error('Failed to advance payroll state:', err);
            // Revert
            set(state => ({
                slips: state.slips.map(s =>
                    s.id === slipId ? { ...s, status: prevStatus } : s
                )
            }));
        }
    },

    // ── Get Slips by Month ─────────────────────────────────────────────────────
    getSlipsByMonth: (month) => {
        return get().slips.filter(s => s.month === month);
    },

    // ── Pay Salary ─────────────────────────────────────────────────────────────
    markAsPaid: async (slipId) => {
        const targetSlip = get().slips.find(s => s.id === slipId);
        if (!targetSlip || targetSlip.status !== 'LOCKED') return; // Can only pay locked slips

        const prevStatus = targetSlip.status;
        set(state => ({
            slips: state.slips.map(s =>
                s.id === slipId ? { ...s, status: 'PAID' } : s
            )
        }));

        try {
            const res = await apiFetch(`/payroll/${slipId}/paid`, { method: 'PATCH' });
            if (!res.ok) throw new Error('Failed to mark payroll as paid');
        } catch (err) {
            console.error('Failed to mark as paid:', err);
            set(state => ({
                slips: state.slips.map(s =>
                    s.id === slipId ? { ...s, status: prevStatus } : s
                )
            }));
        }
    },
}));

// ── Exported Hook with Data Visibility Filtering ─────────────────────────────
export const usePayrollStore = () => {
    const store = useInternalPayrollStore();
    const user = useAuthStore(s => s.user);
    const getScope = useRolePermissionsStore(s => s.getScope);

    const { _rawStore } = useEmployeeStore();
    const employees = _rawStore?._rawEmployees || [];

    const filteredSlips = store.slips.filter(s => {
        if (!user) return true;

        const scope = getScope(user.role);
        if (scope === 'ALL') return true;

        if (scope === 'TEAM') {
            const userEmp = employees.find((emp: any) => emp.id === user.id);
            const recordEmp = employees.find((emp: any) => emp.id === s.employeeId);
            if (!userEmp?.department) return s.employeeId === user.id; // Fallback to OWN
            return recordEmp?.department === userEmp.department;
        }

        if (scope === 'OWN') return s.employeeId === user.id;

        return false;
    });

    return {
        ...store,
        slips: filteredSlips,
        getSlipsByMonth: (month: string) => filteredSlips.filter((s: any) => s.month === month),
        _rawStore: store
    };
};

usePayrollStore.getState = () => useInternalPayrollStore.getState();
