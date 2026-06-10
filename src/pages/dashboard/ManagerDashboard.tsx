import { useEmployeeStore } from '@/store/employeeStore';
import { useAttendanceStore } from '@/store/attendanceStore';
import { useProductionStore } from '@/store/productionStore';
import { useAuthStore } from '@/store/authStore';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';

export const ManagerDashboard = () => {
    const { employees } = useEmployeeStore();
    const { records } = useAttendanceStore();
    const { entries } = useProductionStore();
    const { user } = useAuthStore();
    const { currentCompanyId } = useMultiCompanyStore();

    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().toISOString().slice(0, 7);

    const companyEmployees = currentCompanyId
        ? employees.filter(e => e.companyId === currentCompanyId)
        : employees;

    const managerProfile = companyEmployees.find(e => e.id === user?.id) || companyEmployees.find(e => e.email === user?.email);
    const teamEmployees = companyEmployees.filter(e => e.department && e.department === managerProfile?.department);
    const teamIds = teamEmployees.map(e => e.id);

    const teamActive = teamEmployees.filter(e => e.status === 'ACTIVE').length;
    const teamRecords = records.filter(r => teamIds.includes(r.employeeId) && r.date === today);
    const teamPresent = teamRecords.filter(r => ['PRESENT', 'LATE', 'HALF_DAY'].includes(r.status)).length;

    const teamProduction = entries
        .filter(p => teamIds.includes(p.employeeId) && p.date.startsWith(currentMonth))
        .reduce((sum, p) => sum + p.totalAmount, 0);

    if (companyEmployees.length > 0 && !managerProfile) {
        return (
            <div className="flex flex-col items-center justify-center p-16 text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 flex items-center justify-center">
                    <span className="text-3xl">👤</span>
                </div>
                <h2 className="text-white font-bold text-lg">Profile Not Linked</h2>
                <p className="text-dark-muted text-sm max-w-xs">
                    Your manager account is not linked to an employee profile. Contact HR or Admin to assign your employee record.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white mb-1">Manager Dashboard</h1>
                <p className="text-dark-muted">Overview of {managerProfile?.department || 'Your'} Team</p>
            </div>

            <div className="flex overflow-x-auto pb-4 -mb-4 gap-4 snap-x sm:grid sm:grid-cols-3 md:gap-6 sm:overflow-visible sm:pb-0 sm:mb-0">
                <div className="glass p-5 rounded-xl border border-dark-border min-w-[200px] flex-1 snap-start">
                    <p className="text-dark-muted text-xs uppercase mb-2">Team Size</p>
                    <h3 className="text-3xl font-bold text-white">{teamActive}</h3>
                    <p className="text-xs text-dark-muted mt-1">Active Members</p>
                </div>
                <div className="glass p-5 rounded-xl border border-dark-border min-w-[200px] flex-1 snap-start">
                    <p className="text-dark-muted text-xs uppercase mb-2">Team Attendance</p>
                    <h3 className="text-3xl font-bold text-warning">{teamPresent} / {teamActive}</h3>
                    <p className="text-xs text-dark-muted mt-1">Present Today</p>
                </div>
                <div className="glass p-5 rounded-xl border border-dark-border min-w-[200px] flex-1 snap-start">
                    <p className="text-dark-muted text-xs uppercase mb-2">Team Production</p>
                    <h3 className="text-3xl font-bold text-success">₹ {teamProduction.toLocaleString()}</h3>
                    <p className="text-xs text-dark-muted mt-1">This Month</p>
                </div>
            </div>
        </div>
    );
};
