import { create } from 'zustand';
import { SalarySlip, PayrollStatus } from '@/types';
import { calculateSalary } from '@/utils/salaryCalculator';
import { useEmployeeStore } from './employeeStore';
import { useAttendanceStore } from './attendanceStore';
import { useProductionStore } from './productionStore';
import { useLoanStore } from './loanStore';
import { useHolidayStore } from './holidayStore';
import { useAdvanceSalaryStore } from './advanceSalaryStore';
import { apiFetch } from '@/lib/apiClient';
import { audit } from '@/lib/auditLogger';

interface PayrollState {
    slips: SalarySlip[];
    monthsGenerated: string[];
    isLoading: boolean;
    isSaving: boolean;

    // Actions
    fetchPayroll: (month?: string) => Promise<void>;
    generateMonthlyPayroll: (month: string, generatedBy?: string) => Promise<void>;
    markAsPaid: (slipId: string) => Promise<void>;
    getSlipsByMonth: (month: string) => SalarySlip[];
}

export const usePayrollStore = create<PayrollState>((set, get) => ({
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
    generateMonthlyPayroll: async (month, generatedBy) => {
        set({ isSaving: true });

        try {
            // Fetch raw data from other stores
            const employees = useEmployeeStore.getState()._rawEmployees
                .filter(e => e.status === 'ACTIVE');
            const attendance = useAttendanceStore.getState().records;
            const production = useProductionStore.getState().entries;
            const loans = useLoanStore.getState()._rawLoans;
            const holidays = useHolidayStore.getState().getHolidaysForMonth(month);

            const newSlips: SalarySlip[] = employees.map(emp => {
                const empLoans = loans.filter(l => l.employeeId === emp.id && l.status === 'ACTIVE');

                // ── Advance salary monthly deduction for this employee ──────────
                const advanceMonthlyDeduction = useAdvanceSalaryStore.getState().getEmployeeBalance(emp.id) > 0
                    ? useAdvanceSalaryStore.getState().requests
                        .filter(r => r.employeeId === emp.id && r.status === 'approved' && r.remainingBalance > 0)
                        .reduce((sum, r) => sum + Math.min(r.monthlyDeduction, r.remainingBalance), 0)
                    : 0;

                const slip = calculateSalary(
                    emp,
                    month,
                    attendance.filter(r => r.employeeId === emp.id),
                    production.filter(p => p.employeeId === emp.id),
                    empLoans,
                    holidays,
                    advanceMonthlyDeduction  // ← pass advance deduction
                );
                return { ...slip, generatedBy: generatedBy || 'System' };
            });

            // 1. Update local state immediately
            const filteredSlips = get().slips.filter(s => s.month !== month);
            set(state => ({
                slips: [...filteredSlips, ...newSlips],
                monthsGenerated: Array.from(new Set([...state.monthsGenerated, month]))
            }));

            // 2. Save all slips to server (upsert — server uses SalarySlip.upsert)
            const savePromises = newSlips.map(slip =>
                apiFetch(`/payroll`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(slip),
                }).catch(err => console.error(`Failed to save slip for ${slip.employeeId}:`, err))
            );

            await Promise.allSettled(savePromises);

            // Audit payroll generation
            audit({
                action: 'GENERATE_PAYROLL',
                entityType: 'PAYROLL',
                details: { month, employeeCount: newSlips.length, totalNetPay: newSlips.reduce((s, sl) => s + sl.netSalary, 0) },
                status: 'SUCCESS',
            });

        } catch (err) {
            console.error('Failed to generate payroll:', err);
        } finally {
            set({ isSaving: false });
        }
    },

    // ── Mark Slip as Paid + Update on Server ──────────────────────────────────
    markAsPaid: async (slipId) => {
        const targetSlip = get().slips.find(s => s.id === slipId);
        if (!targetSlip || targetSlip.status === PayrollStatus.PAID) return;

        // 1. AUTO-DEDUCT LOAN EMIs
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

        // 2. AUTO-DEDUCT ADVANCE SALARY EMIs
        if ((targetSlip.advanceDeduction ?? 0) > 0) {
            useAdvanceSalaryStore.getState().processMonthlyDeduction(targetSlip.employeeId);
        }

        // 2. Optimistic local update
        set(state => ({
            slips: state.slips.map(s =>
                s.id === slipId ? { ...s, status: PayrollStatus.PAID } : s
            )
        }));

        // 3. Update status on server
        try {
            await apiFetch(`/payroll/${slipId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: PayrollStatus.PAID }),
            });
            // Audit
            const slipEmp = useEmployeeStore.getState()._rawEmployees.find(e => e.id === targetSlip.employeeId);
            audit({
                action: 'UPDATE_PAYROLL',
                entityType: 'PAYROLL',
                entityId: slipId,
                entityName: slipEmp?.name ?? targetSlip.employeeId,
                details: { month: targetSlip.month, netSalary: targetSlip.netSalary, action: 'MARK_PAID' },
                status: 'SUCCESS',
            });
        } catch (err) {
            console.error('Failed to update payroll status on server:', err);
            // Revert on failure
            set(state => ({
                slips: state.slips.map(s =>
                    s.id === slipId ? { ...s, status: PayrollStatus.GENERATED } : s
                )
            }));
        }
    },

    // ── Get Slips by Month ─────────────────────────────────────────────────────
    getSlipsByMonth: (month) => {
        return get().slips.filter(s => s.month === month);
    },
}));
