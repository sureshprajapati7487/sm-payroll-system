// @ts-ignore
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateSalary } from './salaryCalculator';
import {
    Employee,
    AttendanceRecord,
    LoanRecord,
    Roles,
    EmployeeStatus,
    SalaryType,
    AttendanceStatus,
    LoanStatus,
    LoanType,
} from '@/types';

// ── Mutable config so individual tests can override settings ──────────────────
const mockConfig: Record<string, any> = {
    enableZeroPresenceRule: true,
    enableSandwichRule: false,
    enableLateMarksPenalty: false,
    enableEarlyGoPenalty: false,
    enableOTMinThreshold: false,
    enableOTCap: false,
    enableOTMultipliers: false,
    otNormalMultiplier: 1.5,
    enableNightShiftAllowance: false,
    enableAttendanceBonus: false,
    enableEMICap: true,
    emiCapPercentage: 50,
};

vi.mock('@/store/systemConfigStore', () => ({
    useSystemConfigStore: { getState: () => mockConfig },
}));

beforeEach(() => {
    mockConfig.enableSandwichRule = false;
    mockConfig.enableEMICap = true;
    mockConfig.emiCapPercentage = 50;
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const makeEmployee = (overrides: Partial<Employee> = {}): Employee => ({
    id: 'emp-test',
    code: 'EMP-TEST',
    name: 'Test Employee',
    email: 'test@test.com',
    phone: '9999999999',
    department: 'Engineering',
    designation: 'Developer',
    role: Roles.EMPLOYEE,
    joiningDate: '2023-01-01',
    status: EmployeeStatus.ACTIVE,
    shift: 'GENERAL',
    salaryType: SalaryType.MONTHLY,
    basicSalary: 30000,
    paymentRate: 0,
    bankDetails: { accountNumber: '123', ifscCode: 'SBIN0000123', bankName: 'SBI' },
    ...overrides,
});

// Returns attendance records for exactly the non-Sunday working days of a month.
function buildWorkingDayAttendance(
    employeeId: string,
    month: string,
    presentCount: number,
): AttendanceRecord[] {
    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const workingDays: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${month}-${String(d).padStart(2, '0')}`;
        if (new Date(`${dateStr}T12:00:00Z`).getUTCDay() !== 0) workingDays.push(dateStr);
    }
    return workingDays.slice(0, presentCount).map((date, i) => ({
        id: `att-${i}`,
        employeeId,
        date,
        status: AttendanceStatus.PRESENT,
        checkIn: '09:00:00',
        checkOut: '18:00:00',
        lateByMinutes: 0,
        overtimeHours: 0,
    }));
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('salaryCalculator', () => {

    // Test 1: All 26 working days in April 2024 → full monthly salary
    it('26/26 present working days produces full gross salary', () => {
        // April 2024: 30 days, 4 Sundays → 26 working days.
        // With 26 working days + 4 paid Sundays: basePaidDays = 30 → basicSalary = 30000.
        const emp = makeEmployee({ basicSalary: 30000 });
        const month = '2024-04';
        const attendance = buildWorkingDayAttendance(emp.id, month, 26);

        const result = calculateSalary(emp, month, attendance, [], []);

        expect(result.basicSalary).toBe(30000);
        expect(result.grossSalary).toBe(30000);
        expect(result.netSalary).toBeGreaterThan(0);
    });

    // Test 2: 13/26 working days with sandwich rule → exactly 50% gross
    it('13/26 working days (sandwich rule on) produces exactly 50% of full gross', () => {
        // Sandwich rule ON: Sundays with both adjacent working days absent are unpaid.
        // First 13 days (Apr 1-6, 8-13, 15): Sundays Apr 7 & 14 are paid (neighbours present),
        // Apr 21 & 28 are unpaid (neighbours absent) → basePaidDays = 13 + 2 = 15.
        // Full 26 days: all 4 Sundays paid → basePaidDays = 30.
        // Ratio: round(30000/30*15) / round(30000/30*30) = 15000/30000 = 0.50.
        mockConfig.enableSandwichRule = true;

        const emp = makeEmployee({ basicSalary: 30000 });
        const month = '2024-04';
        const halfAttendance = buildWorkingDayAttendance(emp.id, month, 13);
        const fullAttendance = buildWorkingDayAttendance(emp.id, month, 26);

        const halfResult = calculateSalary(emp, month, halfAttendance, [], []);
        const fullResult = calculateSalary(emp, month, fullAttendance, [], []);

        expect(halfResult.basicSalary / fullResult.basicSalary).toBeCloseTo(0.5, 5);
    });

    // Test 3: Loan EMI is capped at 50% of gross — employee cannot go negative
    it('loan EMI deduction is capped at 50% of gross and net salary stays non-negative', () => {
        // Use 30000 basic → April full month → grossSalary = 30000 (exact integer).
        // 50% cap = 15000. EMI of 25000 should be capped to 15000.
        const emp = makeEmployee({ basicSalary: 30000 });
        const month = '2024-04';
        const attendance = buildWorkingDayAttendance(emp.id, month, 26);

        const bigLoan: LoanRecord = {
            id: 'loan-big',
            employeeId: emp.id,
            amount: 500000,
            balance: 500000,
            emiAmount: 25000,
            status: LoanStatus.ACTIVE,
            type: LoanType.OTHER,
            reason: 'Test',
            issuedDate: '2024-01-01',
            tenureMonths: 60,
            ledger: [],
            auditTrail: [],
        };

        const result = calculateSalary(emp, month, attendance, [], [bigLoan]);

        expect(result.loanDeduction).toBeLessThanOrEqual(result.grossSalary * 0.5);
        expect(result.loanDeduction).toBe(15000);
        expect(result.netSalary).toBeGreaterThanOrEqual(0);
    });

    // Test 4: PF is always capped at ₹1800 regardless of high salary
    it('PF deduction is capped at ₹1800 for high-salary employees', () => {
        const emp = makeEmployee({
            basicSalary: 100000,
            statutoryConfig: {
                pfApplicable: true,
                pfRate: 12,
                pfCapped: true,
                esicApplicable: false,
                ptApplicable: false,
                tdsApplicable: false,
            },
        } as any);
        const month = '2024-04';
        const attendance = buildWorkingDayAttendance(emp.id, month, 26);

        const result = calculateSalary(emp, month, attendance, [], []);

        // 12% of 100000 = 12000, but statutory cap is ₹1800
        expect(result.pfDeduction).toBe(1800);
    });

    // Test 5: TDS on ₹70,000/month (₹8.4L annual) — new tax regime FY2024-25
    it('TDS on ₹8.4L annual gross matches new tax regime slab calculation', () => {
        // Annual gross = 70000 * 12 = 840000.
        // Slab (code's thresholds): 20000 + (840000-700000)*0.10 = 34000.
        // After 4% cess: 34000 * 1.04 = 35360. Monthly: round(35360/12) = 2947.
        const emp = makeEmployee({
            basicSalary: 70000,
            statutoryConfig: {
                pfApplicable: false,
                esicApplicable: false,
                ptApplicable: false,
                tdsApplicable: true,
                tdsPanLinked: true,
            },
        } as any);
        const month = '2024-04';
        const attendance = buildWorkingDayAttendance(emp.id, month, 26);

        const result = calculateSalary(emp, month, attendance, [], []);

        expect(result.grossSalary).toBe(70000);
        expect(result.taxDeduction).toBeGreaterThan(0);
        // New regime 7L-10L bracket + cess → ~2947/month (verify within ±100)
        expect(result.taxDeduction).toBeGreaterThanOrEqual(2847);
        expect(result.taxDeduction).toBeLessThanOrEqual(3047);
    });
});
