import { calculateSalary } from './salaryCalculator';
import { Employee, AttendanceRecord, AttendanceStatus, SalaryType, Holiday, EmployeeStatus } from '@/types';
import { useSystemConfigStore } from '@/store/systemConfigStore';

// Mock Config Store
useSystemConfigStore.setState({
    enableZeroPresenceRule: true,
    enableSandwichRule: true // Enable to test stripping
});

const mockEmployee: Employee = {
    id: 'emp1',
    code: 'EMP001',
    name: 'Test User',
    email: 'test@test.com',
    phone: '9999999999',
    department: 'Test',
    designation: 'Test',
    joiningDate: '2023-01-01',
    salaryType: SalaryType.MONTHLY,
    basicSalary: 30000,
    status: EmployeeStatus.ACTIVE,
    shift: 'GENERAL',
    role: 'EMPLOYEE',
    paymentRate: 0,
};

const month = '2024-01'; // Jan 2024
// Jan 2024:
// Sun: 7, 14, 21, 28
// Holidays: let's assume Jan 26 (Republic Day)

const holidays: Holiday[] = [
    { id: 'h1', name: 'Republic Day', date: '2024-01-26', type: 'NATIONAL' }
];

// Attendance: 5 Days Present.
// Let's say Jan 1, 2, 3, 4 (Mon-Thu) + Jan 7 (Sun - Worked)
const attendanceRecords: AttendanceRecord[] = [
    { id: '1', employeeId: 'emp1', date: '2024-01-01', status: AttendanceStatus.PRESENT, checkIn: '2024-01-01T09:00:00Z' },
    { id: '2', employeeId: 'emp1', date: '2024-01-02', status: AttendanceStatus.PRESENT, checkIn: '2024-01-02T09:00:00Z' },
    { id: '3', employeeId: 'emp1', date: '2024-01-03', status: AttendanceStatus.PRESENT, checkIn: '2024-01-03T09:00:00Z' },
    { id: '4', employeeId: 'emp1', date: '2024-01-04', status: AttendanceStatus.PRESENT, checkIn: '2024-01-04T09:00:00Z' },
    { id: '5', employeeId: 'emp1', date: '2024-01-07', status: AttendanceStatus.PRESENT, checkIn: '2024-01-07T09:00:00Z' } // Sunday
];

const salary = calculateSalary(mockEmployee, month, attendanceRecords, [], [], holidays);

console.log('--- Result ---');
console.log('Total Days:', salary.totalDays);
console.log('Present Days:', salary.presentDays);
console.log('Basic Earnings:', salary.basicSalary);

// Reverse engineer Paid Days from Basic
// Basic = (30000 / 31) * PaidDays
const paidDays = (salary.basicSalary / (30000 / 31));
console.log('Calculated Paid Days:', paidDays);
console.log('Gross Salary:', salary.grossSalary);
