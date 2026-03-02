import { useEmployeeStore } from '@/store/employeeStore';
import { Employee, AttendanceRecord, AttendanceStatus, Roles, EmployeeStatus, SalaryType } from '@/types';

export const generateDemoData = () => {
    // 1. Generate Employees
    const departments = ['Engineering', 'HR', 'Finance', 'Sales', 'Marketing', 'Operations'];
    const designations = ['Manager', 'Senior Associate', 'Associate', 'Intern', 'Director'];
    const employeeCount = 20;

    const employees: Employee[] = Array.from({ length: employeeCount }).map((_, i) => ({
        id: `EMP${String(i + 1).padStart(3, '0')}`,
        code: `EMP-${String(i + 1).padStart(3, '0')}`,
        name: getRandomName(),
        email: `employee${i + 1}@smindustries.com`,
        phone: `9${Math.floor(Math.random() * 1000000000)}`,
        department: departments[Math.floor(Math.random() * departments.length)],
        designation: designations[Math.floor(Math.random() * designations.length)],
        role: i < 3 ? Roles.ADMIN : Roles.EMPLOYEE,
        joiningDate: getRandomDate(new Date(2020, 0, 1), new Date()).toISOString().split('T')[0],
        status: EmployeeStatus.ACTIVE,
        shift: 'MORNING',
        salaryType: SalaryType.MONTHLY,
        basicSalary: Math.floor(Math.random() * 80000) + 20000,
        avatar: `https://ui-avatars.com/api/?name=User+${i + 1}`,
        bankDetails: {
            accountNumber: `HDFC${Math.floor(Math.random() * 1000000)}`,
            ifscCode: 'HDFC0001234',
            bankName: 'HDFC Bank'
        }
    }));

    // 2. Generate Attendance for current month
    const attendanceRecs: AttendanceRecord[] = [];
    const today = new Date();

    employees.forEach(emp => {
        for (let day = 1; day <= today.getDate(); day++) {
            if (Math.random() > 0.1) { // 90% attendance
                const date = new Date(today.getFullYear(), today.getMonth(), day);
                const isLate = Math.random() > 0.8;
                attendanceRecs.push({
                    id: `att-${emp.id}-${day}`,
                    employeeId: emp.id,
                    date: date.toISOString().split('T')[0],
                    checkIn: new Date(date.setHours(9 + (isLate ? 1 : 0), Math.random() * 30)).toISOString(),
                    checkOut: new Date(date.setHours(18, Math.random() * 30)).toISOString(),
                    status: isLate ? AttendanceStatus.LATE : AttendanceStatus.PRESENT,
                    lateByMinutes: isLate ? Math.floor(Math.random() * 60) : 0,
                    overtimeHours: Math.random() > 0.9 ? 2 : 0
                });
            }
        }
    });

    // 3. Clear existing & Load new data
    // Note: In a real app, we might check if empty first
    useEmployeeStore.getState().addEmployee ?
        employees.forEach(e => useEmployeeStore.getState().addEmployee(e)) : null; // Mock add loop

    // For Zustand stores usually we can set directly if exposed or use actions
    // Here we will just log for now as direct state mutation might be complex without specific actions
    // In a real implementation, we would call the set actions

    console.log('Generated Demo Data:', { employees, attendanceRecs });

    alert(`Generated ${employees.length} employees and ${attendanceRecs.length} attendance records. \nNote: To fully apply, we need to map these to store actions.`);

    return { employees, attendanceRecs };
};

// Helpers
function getRandomName() {
    const firstNames = ['Rajesh', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Anjali', 'Rahul', 'Kavita', 'Suresh', 'Pooja'];
    const lastNames = ['Kumar', 'Singh', 'Patel', 'Mehta', 'Reddy', 'Sharma', 'Verma', 'Gupta', 'Malhotra', 'Yadav'];
    return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
}

function getRandomDate(start: Date, end: Date) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}
