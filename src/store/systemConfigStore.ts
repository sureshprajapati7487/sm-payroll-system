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

    // === Salary Type Configuration ===
    salaryTypes: Array<{ id: string; key: string; label: string; description: string; basis: 'MONTHLY' | 'DAILY' | 'PER_UNIT' | 'WEEKLY' | 'OTHER' }>;
    addSalaryType: (data: { key: string; label: string; description: string; basis: 'MONTHLY' | 'DAILY' | 'PER_UNIT' | 'WEEKLY' | 'OTHER' }) => void;
    updateSalaryType: (id: string, data: { key: string; label: string; description: string; basis: 'MONTHLY' | 'DAILY' | 'PER_UNIT' | 'WEEKLY' | 'OTHER' }) => void;
    deleteSalaryType: (id: string) => void;
    resetSalaryTypes: () => void;

    // === Attendance Actions Configuration ===
    attendanceActions: Array<{
        id: string;
        key: string;        // PRESENT, ABSENT, HALF_DAY, LATE, etc.
        label: string;      // Display name — can be renamed
        icon: string;       // Emoji icon
        color: string;      // Tailwind color class token
        enabled: boolean;   // Can be turned ON/OFF
        isDefault: boolean; // Default actions can't be deleted, only disabled
    }>;
    addAttendanceAction: (data: { key: string; label: string; icon: string; color: string }) => void;
    updateAttendanceAction: (id: string, data: Partial<{ key: string; label: string; icon: string; color: string; enabled: boolean }>) => void;
    deleteAttendanceAction: (id: string) => void;
    toggleAttendanceAction: (id: string) => void;
    resetAttendanceActions: () => void;

    // === System Keys (Super Admin Only) ===
    systemKeys: Array<{
        id: string;
        key: string;         // Unique key code e.g. MAX_ADVANCE_LIMIT
        label: string;       // Human-readable name
        value: string;       // The value
        category: 'PAYROLL' | 'ATTENDANCE' | 'LEAVES' | 'GENERAL' | 'SECURITY';
        description: string;
        isSecret: boolean;   // If true, value is masked (***) for non-super-admins
    }>;
    addSystemKey: (data: { key: string; label: string; value: string; category: 'PAYROLL' | 'ATTENDANCE' | 'LEAVES' | 'GENERAL' | 'SECURITY'; description: string; isSecret: boolean }) => void;
    updateSystemKey: (id: string, data: Partial<{ key: string; label: string; value: string; category: 'PAYROLL' | 'ATTENDANCE' | 'LEAVES' | 'GENERAL' | 'SECURITY'; description: string; isSecret: boolean }>) => void;
    deleteSystemKey: (id: string) => void;

    // === Punch Method Config ===
    punchMethods: {
        face: { enabled: boolean; label: string };
        fingerprint: { enabled: boolean; label: string };
        photoUpload: { enabled: boolean; label: string };
    };
    updatePunchMethod: (method: 'face' | 'fingerprint' | 'photoUpload', updates: { enabled?: boolean; label?: string }) => void;

    // === Punch Location Config ===
    punchLocation: {
        enabled: boolean;        // Admin toggle
        name: string;            // e.g. "Head Office"
        lat: number;             // Latitude
        lng: number;             // Longitude
        radiusMeters: number;    // Allowed radius in meters (e.g. 100)
    };
    setPunchLocation: (config: Partial<SystemConfigState['punchLocation']>) => void;
    togglePunchLocation: () => void;

    // === Multi-Location GPS Zones ===
    punchLocations: Array<{
        id: string;
        name: string;
        lat: number;
        lng: number;
        radiusMeters: number;
        branchCode?: string;
        enabled: boolean;
    }>;
    addPunchLocation: (loc: Omit<SystemConfigState['punchLocations'][0], 'id'>) => void;
    updatePunchLocation: (id: string, updates: Partial<Omit<SystemConfigState['punchLocations'][0], 'id'>>) => void;
    removePunchLocation: (id: string) => void;
    togglePunchLocationZone: (id: string) => void;

    // === Shift-wise Punch Windows ===
    shiftPunchWindows: Array<{
        id: string;
        shiftId: string;       // Links to shiftStore shift
        shiftName: string;     // Display name (denormalized)
        checkInFrom: string;   // e.g. "07:30"
        checkInTo: string;     // e.g. "10:30"
        checkOutFrom: string;  // e.g. "16:00"
        checkOutTo: string;    // e.g. "21:00"
        enabled: boolean;
    }>;
    addShiftPunchWindow: (win: Omit<SystemConfigState['shiftPunchWindows'][0], 'id'>) => void;
    updateShiftPunchWindow: (id: string, updates: Partial<Omit<SystemConfigState['shiftPunchWindows'][0], 'id'>>) => void;
    removeShiftPunchWindow: (id: string) => void;

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

            // Punch Method Defaults (all enabled)
            punchMethods: {
                face: { enabled: true, label: 'Face Scan' },
                fingerprint: { enabled: true, label: 'Thumb Print' },
                photoUpload: { enabled: true, label: 'Live Selfie' },
            },
            updatePunchMethod: (method, updates) => set(state => ({
                punchMethods: {
                    ...state.punchMethods,
                    [method]: { ...state.punchMethods[method], ...updates },
                },
            })),

            // Punch Location Config
            punchLocation: {
                enabled: false,
                name: 'Office',
                lat: 0,
                lng: 0,
                radiusMeters: 100,
            },
            setPunchLocation: (config) => set(state => ({
                punchLocation: { ...state.punchLocation, ...config }
            })),
            togglePunchLocation: () => set(state => ({
                punchLocation: { ...state.punchLocation, enabled: !state.punchLocation.enabled }
            })),

            // === Multi-Location GPS Zones ===
            punchLocations: [],
            addPunchLocation: (loc) => set(state => ({
                punchLocations: [
                    ...state.punchLocations,
                    { ...loc, id: Math.random().toString(36).substr(2, 9) }
                ]
            })),
            updatePunchLocation: (id, updates) => set(state => ({
                punchLocations: state.punchLocations.map(l =>
                    l.id === id ? { ...l, ...updates } : l
                )
            })),
            removePunchLocation: (id) => set(state => ({
                punchLocations: state.punchLocations.filter(l => l.id !== id)
            })),
            togglePunchLocationZone: (id) => set(state => ({
                punchLocations: state.punchLocations.map(l =>
                    l.id === id ? { ...l, enabled: !l.enabled } : l
                )
            })),

            // === Shift-wise Punch Windows ===
            shiftPunchWindows: [],
            addShiftPunchWindow: (win) => set(state => ({
                shiftPunchWindows: [
                    ...state.shiftPunchWindows,
                    { ...win, id: Math.random().toString(36).substr(2, 9) }
                ]
            })),
            updateShiftPunchWindow: (id, updates) => set(state => ({
                shiftPunchWindows: state.shiftPunchWindows.map(w =>
                    w.id === id ? { ...w, ...updates } : w
                )
            })),
            removeShiftPunchWindow: (id) => set(state => ({
                shiftPunchWindows: state.shiftPunchWindows.filter(w => w.id !== id)
            })),

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

            // === Salary Types ===
            salaryTypes: [
                { id: 'ST1', key: 'MONTHLY_FIXED', label: 'Monthly Fixed', description: 'Fixed amount paid every month regardless of days', basis: 'MONTHLY' },
                { id: 'ST2', key: 'DAILY_RATE', label: 'Daily Rate', description: 'Paid per day worked (attendance-based)', basis: 'DAILY' },
                { id: 'ST3', key: 'PER_UNIT_PROD', label: 'Per Unit / Production', description: 'Paid based on number of units produced (piece-rate)', basis: 'PER_UNIT' },
                { id: 'ST4', key: 'WEEKLY_WAGE', label: 'Weekly Wage', description: 'Salary calculated and paid every week', basis: 'WEEKLY' },
                { id: 'ST5', key: 'CONTRACTUAL', label: 'Contractual / Project', description: 'Fixed-term project-based payment', basis: 'OTHER' },
            ],

            addSalaryType: (data) => set((state) => ({
                salaryTypes: [
                    ...state.salaryTypes,
                    {
                        id: Math.random().toString(36).substr(2, 9),
                        key: data.key.toUpperCase().replace(/\s+/g, '_'),
                        label: data.label,
                        description: data.description,
                        basis: data.basis,
                    }
                ]
            })),

            updateSalaryType: (id, data) => set((state) => ({
                salaryTypes: state.salaryTypes.map(st =>
                    st.id === id
                        ? { ...st, key: data.key.toUpperCase().replace(/\s+/g, '_'), label: data.label, description: data.description, basis: data.basis }
                        : st
                )
            })),

            deleteSalaryType: (id) => set((state) => ({
                salaryTypes: state.salaryTypes.filter(st => st.id !== id)
            })),

            resetSalaryTypes: () => set({
                salaryTypes: [
                    { id: 'ST1', key: 'MONTHLY_FIXED', label: 'Monthly Fixed', description: 'Fixed amount paid every month regardless of days', basis: 'MONTHLY' },
                    { id: 'ST2', key: 'DAILY_RATE', label: 'Daily Rate', description: 'Paid per day worked (attendance-based)', basis: 'DAILY' },
                    { id: 'ST3', key: 'PER_UNIT_PROD', label: 'Per Unit / Production', description: 'Paid based on number of units produced (piece-rate)', basis: 'PER_UNIT' },
                    { id: 'ST4', key: 'WEEKLY_WAGE', label: 'Weekly Wage', description: 'Salary calculated and paid every week', basis: 'WEEKLY' },
                    { id: 'ST5', key: 'CONTRACTUAL', label: 'Contractual / Project', description: 'Fixed-term project-based payment', basis: 'OTHER' },
                ]
            }),

            // === Attendance Actions ===
            attendanceActions: [
                { id: 'AA1', key: 'PRESENT', label: 'Mark Present', icon: '✅', color: 'green', enabled: true, isDefault: true },
                { id: 'AA2', key: 'ABSENT', label: 'Mark Absent', icon: '❌', color: 'red', enabled: true, isDefault: true },
                { id: 'AA3', key: 'HALF_DAY', label: 'Half Day', icon: '🌗', color: 'yellow', enabled: true, isDefault: true },
                { id: 'AA4', key: 'LATE', label: 'Mark Late', icon: '🕐', color: 'orange', enabled: true, isDefault: true },
                { id: 'AA5', key: 'CLEAR', label: 'Clear Status', icon: '✕', color: 'slate', enabled: true, isDefault: true },
            ],

            addAttendanceAction: (data) => set((state) => ({
                attendanceActions: [
                    ...state.attendanceActions,
                    {
                        id: Math.random().toString(36).substr(2, 9),
                        key: data.key.toUpperCase().replace(/\s+/g, '_'),
                        label: data.label,
                        icon: data.icon,
                        color: data.color,
                        enabled: true,
                        isDefault: false,
                    }
                ]
            })),

            updateAttendanceAction: (id, data) => set((state) => ({
                attendanceActions: state.attendanceActions.map(a =>
                    a.id === id ? { ...a, ...data } : a
                )
            })),

            deleteAttendanceAction: (id) => set((state) => ({
                attendanceActions: state.attendanceActions.filter(a => a.id !== id || a.isDefault)
            })),

            toggleAttendanceAction: (id) => set((state) => ({
                attendanceActions: state.attendanceActions.map(a =>
                    a.id === id ? { ...a, enabled: !a.enabled } : a
                )
            })),

            resetAttendanceActions: () => set({
                attendanceActions: [
                    { id: 'AA1', key: 'PRESENT', label: 'Mark Present', icon: '✅', color: 'green', enabled: true, isDefault: true },
                    { id: 'AA2', key: 'ABSENT', label: 'Mark Absent', icon: '❌', color: 'red', enabled: true, isDefault: true },
                    { id: 'AA3', key: 'HALF_DAY', label: 'Half Day', icon: '🌗', color: 'yellow', enabled: true, isDefault: true },
                    { id: 'AA4', key: 'LATE', label: 'Mark Late', icon: '🕐', color: 'orange', enabled: true, isDefault: true },
                    { id: 'AA5', key: 'CLEAR', label: 'Clear Status', icon: '✕', color: 'slate', enabled: true, isDefault: true },
                ]
            }),

            // === System Keys ===
            systemKeys: [
                { id: 'SK1', key: 'MAX_ADVANCE_LIMIT', label: 'Max Advance Limit (%)', value: '50', category: 'PAYROLL', description: 'Maximum advance salary as % of basic salary', isSecret: false },
                { id: 'SK2', key: 'MAX_OT_HOURS_MONTH', label: 'Max OT Hours / Month', value: '50', category: 'PAYROLL', description: 'Maximum overtime hours allowed per month', isSecret: false },
                { id: 'SK3', key: 'LATE_GRACE_MINUTES', label: 'Late Grace Period (min)', value: '15', category: 'ATTENDANCE', description: 'Minutes allowed after shift start before marking late', isSecret: false },
                { id: 'SK4', key: 'MAX_LEAVES_PER_MONTH', label: 'Max Leaves / Month', value: '3', category: 'LEAVES', description: 'Maximum leaves allowed per month', isSecret: false },
                { id: 'SK5', key: 'PF_EMPLOYEE_RATE', label: 'PF Employee Rate (%)', value: '12', category: 'PAYROLL', description: 'PF deduction rate from employee salary', isSecret: false },
                { id: 'SK6', key: 'PF_EMPLOYER_RATE', label: 'PF Employer Rate (%)', value: '13', category: 'PAYROLL', description: 'PF contribution rate from employer', isSecret: false },
                { id: 'SK7', key: 'SESSION_TIMEOUT_MINS', label: 'Session Timeout (min)', value: '480', category: 'SECURITY', description: 'Auto-logout after inactivity (minutes)', isSecret: false },
            ],

            addSystemKey: (data) => set((state) => ({
                systemKeys: [
                    ...state.systemKeys,
                    {
                        id: Math.random().toString(36).substr(2, 9),
                        key: data.key.toUpperCase().replace(/\s+/g, '_'),
                        label: data.label,
                        value: data.value,
                        category: data.category,
                        description: data.description,
                        isSecret: data.isSecret,
                    }
                ]
            })),

            updateSystemKey: (id, data) => set((state) => ({
                systemKeys: state.systemKeys.map(k =>
                    k.id === id ? { ...k, ...data, key: data.key ? data.key.toUpperCase().replace(/\s+/g, '_') : k.key } : k
                )
            })),

            deleteSystemKey: (id) => set((state) => ({
                systemKeys: state.systemKeys.filter(k => k.id !== id)
            })),

            // === Production Grid Filter ===
            productionGridDepts: [], // empty = show all; non-empty = show only selected
            setProductionGridDepts: (deptIds) => set({ productionGridDepts: deptIds }),
        }),
        {
            name: 'system-config-storage',
        }
    )
);
