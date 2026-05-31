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
import { useNotificationStore } from './notificationStore';
import { NotificationType } from '@/types';
import { PERMISSIONS } from '@/config/permissions';

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
                const raw = await res.json();
                const data: SalarySlip[] = raw?.data ?? (Array.isArray(raw) ? raw : []);
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

    // ── Generate Monthly Payroll — async worker-based ──────────────────────────
    // POST /api/run returns { jobId } (202 Accepted) immediately.
    // We poll GET /api/payroll/job/:jobId until COMPLETED or FAILED (max 10 min).
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
                throw new Error(errData.why || errData.error || 'Failed to start payroll run');
            }

            const { jobId } = await res.json();

            // Poll for completion — check every 3 seconds, timeout after 10 minutes
            const MAX_POLLS = 200;
            const POLL_INTERVAL_MS = 3000;
            let polls = 0;
            await new Promise<void>((resolve, reject) => {
                const interval = setInterval(async () => {
                    polls++;
                    try {
                        const statusRes = await apiFetch(`/payroll/job/${jobId}`);
                        if (!statusRes.ok) { clearInterval(interval); reject(new Error('Failed to poll job status')); return; }
                        const job = await statusRes.json();
                        if (job.status === 'COMPLETED') { clearInterval(interval); resolve(); }
                        else if (job.status === 'FAILED') { clearInterval(interval); reject(new Error(job.error || 'Payroll run failed')); }
                        else if (polls >= MAX_POLLS) { clearInterval(interval); reject(new Error('Payroll run timed out after 10 minutes')); }
                    } catch (e) { clearInterval(interval); reject(e); }
                }, POLL_INTERVAL_MS);
            });

            // Re-fetch payroll slips after job completes
            await get().fetchPayroll(month);

            // Invalidate dependent stores — loan balances and advances changed during run
            const { useLoanStore } = await import('./loanStore');
            const { useAdvanceSalaryStore } = await import('./advanceSalaryStore');
            const { useAttendanceStore } = await import('./attendanceStore');
            await Promise.allSettled([
                useLoanStore.getState().fetchLoans(),
                useAdvanceSalaryStore.getState().fetchAdvances?.(),
                useAttendanceStore.getState().fetchAttendance(),
            ]);

            // Audit payroll generation
            const slipsCount = get().slips.filter(s => s.month === month).length;
            const totalNetPay = get().slips.filter(s => s.month === month).reduce((s, sl) => s + sl.netSalary, 0);

            audit({
                action: 'GENERATE_PAYROLL',
                entityType: 'PAYROLL',
                details: { month, employeeCount: slipsCount, totalNetPay },
                status: 'SUCCESS',
            });

            // ── Notify all users who can generate payroll ─────────────────────
            useNotificationStore.getState().addNotification({
                type: NotificationType.PAYROLL_GENERATED,
                targetPermissions: [PERMISSIONS.GENERATE_PAYROLL],
                title: `Payroll Generated — ${month}`,
                message: `${slipsCount} salary slips generated. Total payout: ₹${totalNetPay.toLocaleString('en-IN')}.`,
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
        } catch (err: any) {
            // Revert optimistic update
            set(state => ({
                slips: state.slips.map(s =>
                    s.id === slipId ? { ...s, status: prevStatus } : s
                )
            }));
            // Surface error to user via notification
            const errorMsg = err?.message || `Failed to ${action} payroll slip`;
            useNotificationStore.getState().addNotification({
                type: NotificationType.SYSTEM,
                title: 'Payroll Action Failed',
                message: errorMsg,
                targetPermissions: [],
            });
            throw err; // Re-throw so UI can also catch if needed
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

    const currentCompanyId = useMultiCompanyStore(s => s.currentCompanyId);

    const filteredSlips = store.slips.filter(s => {
        // Always filter by current company first — prevents cross-company slip leakage on company switch
        if (currentCompanyId && s.companyId && s.companyId !== currentCompanyId) return false;
        if (!user) return true;

        const scope = getScope(user.role);
        if (scope === 'ALL') return true;

        if (scope === 'TEAM') {
            const userEmp = employees.find((emp: any) => emp.id === user.id);
            const recordEmp = employees.find((emp: any) => emp.id === s.employeeId);
            if (!userEmp?.department) return s.employeeId === user.id;
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
