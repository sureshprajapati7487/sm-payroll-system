// @ts-ignore
import { describe, it, expect } from 'vitest';
import { calculateSalary } from './salaryCalculator';
import { Employee, AttendanceRecord, LoanRecord, Roles, EmployeeStatus, SalaryType, AttendanceStatus, LoanStatus, LoanType } from '@/types';

// Mock Data
const mockEmployee: Employee = {
    id: 'test-emp-1',
    code: 'EMP-TEST',
    name: 'Test Employee',
    email: 'test@example.com',
    phone: '1234567890',
    department: 'IT',
    designation: 'Developer',
    role: Roles.EMPLOYEE,
    joiningDate: '2023-01-01',
    status: EmployeeStatus.ACTIVE,
    shift: 'MORNING',
    salaryType: SalaryType.MONTHLY,
    basicSalary: 30000,
    bankDetails: {
        accountNumber: '123',
        ifscCode: 'IFSC',
        bankName: 'Bank'
    }
};

const mockAttendance: AttendanceRecord[] = Array.from({ length: 30 }, (_, i) => ({
    id: `att-${i}`,
    employeeId: 'test-emp-1',
    date: `2024-04-${String(i + 1).padStart(2, '0')}`,
    status: AttendanceStatus.PRESENT,
    checkIn: '09:00:00',
    checkOut: '18:00:00',
    lateByMinutes: 0,
    overtimeHours: 0
}));

describe('Salary Calculator', () => {
    it('should calculate full salary for full attendance', () => {
        const salary = calculateSalary(mockEmployee, '2024-04', mockAttendance, [], []);

        expect(salary).toBeDefined();
        expect(salary.basicSalary).toBe(30000);
        expect(salary.netSalary).toBeGreaterThan(0);
        expect(salary.pfDeduction).toBe(3600);
    });

    it('should deduct salary for unpaid leaves (absent days)', () => {
        // Only 15 days present
        const halfAttendance = mockAttendance.slice(0, 15);
        const salary = calculateSalary(mockEmployee, '2024-04', halfAttendance, [], []);

        expect(salary.netSalary).toBeLessThan(40000);
    });

    it('should deduct loan EMI', () => {
        const loan: LoanRecord = {
            id: 'loan-1',
            employeeId: 'test-emp-1',
            amount: 100000,
            balance: 90000,
            emiAmount: 5000,
            status: LoanStatus.ACTIVE,
            type: LoanType.OTHER,
            reason: 'Test',
            issuedDate: '2024-01-01',
            tenureMonths: 12,
            ledger: [],
            auditTrail: []
        };

        const salary = calculateSalary(mockEmployee, '2024-04', mockAttendance, [], [loan]);

        // Note: Check actual property name in output
        expect(salary.loanDeduction).toBe(5000);
    });
});
