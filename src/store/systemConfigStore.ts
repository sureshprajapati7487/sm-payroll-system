import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SystemConfigState {
    // === Core Payroll Rules ===
    enableZeroPresenceRule: boolean;
    enableSandwichRule: boolean;

    // === Late Marks & Early Go Rules ===
    enableLateMarksPenalty: boolean;
    lateMarksThreshold: number; // e.g. 3 (3 lates = 1 half day)
    lateMarksPenaltyType: 'HALF_DAY' | 'FULL_DAY' | 'CUSTOM_AMOUNT';
    lateMarksPenaltyAmount: number; // If CUSTOM_AMOUNT, deduct this fixed amount

    enableEarlyGoPenalty: boolean;
    earlyGoPenaltyType: 'HALF_DAY' | 'FULL_DAY';

    // === Overtime (OT) Controls ===
    enableOTMinThreshold: boolean;
    otMinThresholdMinutes: number; // e.g. 30 (ignore OT < 30 mins)

    enableOTMultipliers: boolean;
    otNormalMultiplier: number; // e.g. 1.5 (Normal weekday OT)
    otHolidayMultiplier: number; // e.g. 2.0 (Sunday/Holiday OT)

    enableOTCap: boolean;
    otCapHoursPerMonth: number; // e.g. 50 (max 50 hours/month)

    // === Financial Limits ===
    enableEMICap: boolean;
    emiCapPercentage: number; // e.g. 50 (Max 50% of Net Salary)

    enableAdvanceLimit: boolean;
    advanceLimitPercentage: number; // e.g. 50 (Max 50% of Basic Salary)

    // === Allowances & Incentives ===
    enableNightShiftAllowance: boolean;
    nightShiftAllowanceAmount: number; // e.g. 100 (₹100 per night)
    nightShiftStartHour: number; // e.g. 22 (10 PM)
    nightShiftEndHour: number; // e.g. 6 (6 AM)

    enableAttendanceBonus: boolean;
    attendanceBonusAmount: number; // e.g. 500 (₹500 if full month present)

    // === Actions ===
    toggleZeroPresenceRule: () => void;
    toggleSandwichRule: () => void;
    toggleLateMarksPenalty: () => void;
    toggleEarlyGoPenalty: () => void;
    toggleOTMinThreshold: () => void;
    toggleOTMultipliers: () => void;
    toggleOTCap: () => void;
    toggleEMICap: () => void;
    toggleAdvanceLimit: () => void;
    toggleNightShiftAllowance: () => void;
    toggleAttendanceBonus: () => void;

    // Setters for numeric values
    setLateMarksThreshold: (value: number) => void;
    setLateMarksPenaltyType: (type: 'HALF_DAY' | 'FULL_DAY' | 'CUSTOM_AMOUNT') => void;
    setLateMarksPenaltyAmount: (value: number) => void;
    setEarlyGoPenaltyType: (type: 'HALF_DAY' | 'FULL_DAY') => void;
    setOTMinThresholdMinutes: (value: number) => void;
    setOTNormalMultiplier: (value: number) => void;
    setOTHolidayMultiplier: (value: number) => void;
    setOTCapHoursPerMonth: (value: number) => void;
    setEMICapPercentage: (value: number) => void;
    setAdvanceLimitPercentage: (value: number) => void;
    setNightShiftAllowanceAmount: (value: number) => void;
    setNightShiftStartHour: (value: number) => void;
    setNightShiftEndHour: (value: number) => void;
    setAttendanceBonusAmount: (value: number) => void;

    // === Loan Type Configuration ===
    loanTypes: Array<{ id: string; key: string; label: string }>;
    addLoanType: (key: string, label: string) => void;
    updateLoanType: (id: string, key: string, label: string) => void;
    deleteLoanType: (id: string) => void;
    resetLoanTypes: () => void;








    // === Production Grid Filter ===
    // Dept IDs from departmentStore that are visible in Production Grid Entry
    productionGridDepts: string[];
    setProductionGridDepts: (deptIds: string[]) => void;
}

export const useSystemConfigStore = create<SystemConfigState>()(
    persist(
        (set) => ({
            // Defaults
            enableZeroPresenceRule: true,
            enableSandwichRule: true,

            enableLateMarksPenalty: false,
            lateMarksThreshold: 3,
            lateMarksPenaltyType: 'HALF_DAY',
            lateMarksPenaltyAmount: 0,

            enableEarlyGoPenalty: false,
            earlyGoPenaltyType: 'HALF_DAY',

            enableOTMinThreshold: false,
            otMinThresholdMinutes: 30,

            enableOTMultipliers: false,
            otNormalMultiplier: 1.5,
            otHolidayMultiplier: 2.0,

            enableOTCap: false,
            otCapHoursPerMonth: 50,

            enableEMICap: false,
            emiCapPercentage: 50,

            enableAdvanceLimit: false,
            advanceLimitPercentage: 50,

            enableNightShiftAllowance: false,
            nightShiftAllowanceAmount: 100,
            nightShiftStartHour: 22,
            nightShiftEndHour: 6,

            enableAttendanceBonus: false,
            attendanceBonusAmount: 500,

            // Toggles
            toggleZeroPresenceRule: () => set((state) => ({ enableZeroPresenceRule: !state.enableZeroPresenceRule })),
            toggleSandwichRule: () => set((state) => ({ enableSandwichRule: !state.enableSandwichRule })),
            toggleLateMarksPenalty: () => set((state) => ({ enableLateMarksPenalty: !state.enableLateMarksPenalty })),
            toggleEarlyGoPenalty: () => set((state) => ({ enableEarlyGoPenalty: !state.enableEarlyGoPenalty })),
            toggleOTMinThreshold: () => set((state) => ({ enableOTMinThreshold: !state.enableOTMinThreshold })),
            toggleOTMultipliers: () => set((state) => ({ enableOTMultipliers: !state.enableOTMultipliers })),
            toggleOTCap: () => set((state) => ({ enableOTCap: !state.enableOTCap })),
            toggleEMICap: () => set((state) => ({ enableEMICap: !state.enableEMICap })),
            toggleAdvanceLimit: () => set((state) => ({ enableAdvanceLimit: !state.enableAdvanceLimit })),
            toggleNightShiftAllowance: () => set((state) => ({ enableNightShiftAllowance: !state.enableNightShiftAllowance })),
            toggleAttendanceBonus: () => set((state) => ({ enableAttendanceBonus: !state.enableAttendanceBonus })),

            // Setters
            setLateMarksThreshold: (value) => set({ lateMarksThreshold: value }),
            setLateMarksPenaltyType: (type) => set({ lateMarksPenaltyType: type }),
            setLateMarksPenaltyAmount: (value) => set({ lateMarksPenaltyAmount: value }),
            setEarlyGoPenaltyType: (type) => set({ earlyGoPenaltyType: type }),
            setOTMinThresholdMinutes: (value) => set({ otMinThresholdMinutes: value }),
            setOTNormalMultiplier: (value) => set({ otNormalMultiplier: value }),
            setOTHolidayMultiplier: (value) => set({ otHolidayMultiplier: value }),
            setOTCapHoursPerMonth: (value) => set({ otCapHoursPerMonth: value }),
            setEMICapPercentage: (value) => set({ emiCapPercentage: value }),
            setAdvanceLimitPercentage: (value) => set({ advanceLimitPercentage: value }),
            setNightShiftAllowanceAmount: (value) => set({ nightShiftAllowanceAmount: value }),
            setNightShiftStartHour: (value) => set({ nightShiftStartHour: value }),
            setNightShiftEndHour: (value) => set({ nightShiftEndHour: value }),
            setAttendanceBonusAmount: (value) => set({ attendanceBonusAmount: value }),

            // === Loan Types ===
            loanTypes: [
                { id: '1', key: 'PF_LOAN', label: 'Personal / PF Loan' },
                { id: '2', key: 'ADVANCE_CASH', label: 'Cash Advance' },
                { id: '3', key: 'FOOD', label: 'Food / Canteen' },
                { id: '4', key: 'FINE', label: 'Fine / Penalty' },
                { id: '5', key: 'SALARY_PAY', label: 'Salary / Payment' },
                { id: '6', key: 'OTHER', label: 'Other' },
            ],

            addLoanType: (key, label) => set((state) => ({
                loanTypes: [
                    ...state.loanTypes,
                    {
                        id: Math.random().toString(36).substr(2, 9),
                        key: key.toUpperCase().replace(/\s+/g, '_'),
                        label
                    }
                ]
            })),

            updateLoanType: (id, key, label) => set((state) => ({
                loanTypes: state.loanTypes.map(lt =>
                    lt.id === id
                        ? { ...lt, key: key.toUpperCase().replace(/\s+/g, '_'), label }
                        : lt
                )
            })),

            deleteLoanType: (id) => set((state) => ({
                loanTypes: state.loanTypes.filter(lt => lt.id !== id)
            })),

            resetLoanTypes: () => set({
                loanTypes: [
                    { id: '1', key: 'PF_LOAN', label: 'Personal / PF Loan' },
                    { id: '2', key: 'ADVANCE_CASH', label: 'Cash Advance' },
                    { id: '3', key: 'FOOD', label: 'Food / Canteen' },
                    { id: '4', key: 'FINE', label: 'Fine / Penalty' },
                    { id: '5', key: 'SALARY_PAY', label: 'Salary / Payment' },
                    { id: '6', key: 'OTHER', label: 'Other' },
                ]
            }),






            // === Production Grid Filter ===
            productionGridDepts: [], // empty = show all; non-empty = show only selected
            setProductionGridDepts: (deptIds) => set({ productionGridDepts: deptIds }),
        }),
        {
            name: 'system-config-storage',
        }
    )
);
