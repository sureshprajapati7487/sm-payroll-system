import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { useAttendanceStore } from '@/store/attendanceStore';
import { useProductionStore } from '@/store/productionStore';
import { useLoanStore } from '@/store/loanStore';
import { useLeaveStore } from '@/store/leaveStore';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';
import { Clock, LogIn, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';

export const EmployeeDashboard = () => {
    const { user } = useAuthStore();
    const { employees } = useEmployeeStore();
    const { records } = useAttendanceStore();
    const { entries } = useProductionStore();
    const { loans } = useLoanStore();
    const { requests: leaves } = useLeaveStore();
    const { currentCompanyId } = useMultiCompanyStore();
    const navigate = useNavigate();

    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().toISOString().slice(0, 7);
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);

    const companyEmployees = currentCompanyId
        ? employees.filter(e => e.companyId === currentCompanyId)
        : employees;

    const me = companyEmployees.find(e => e.email === user?.email) || companyEmployees.find(e => e.id === user?.id);

    if (!me) return <div className="text-white p-6">Profile not found. Please contact HR.</div>;

    const changeMonth = (direction: -1 | 1) => {
        const [y, m] = selectedMonth.split('-').map(Number);
        const d = new Date(y, m - 1 + direction, 1);
        setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    };
    const monthLabel = new Date(selectedMonth + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const isCurrentMonth = selectedMonth === currentMonth;

    const myRecords = records.filter(r => r.employeeId === me.id && r.date?.startsWith(selectedMonth));
    const myProduction = entries.filter(p => p.employeeId === me.id && p.date?.startsWith(selectedMonth));
    const myLoan = loans.find(l => l.employeeId === me.id && l.status === 'ACTIVE');
    const myPendingLeaves = leaves.filter((l: any) => l.employeeId === me.id && l.status === 'PENDING').length;

    const myPresentDays = myRecords.filter(r => ['PRESENT', 'LATE', 'HALF_DAY'].includes(r.status)).length;
    const myAttPercentage = Math.round((myPresentDays / 26) * 100);
    const myProdValue = myProduction.reduce((sum, p) => sum + p.totalAmount, 0);

    const todayRecord = isCurrentMonth ? records.find(r => r.employeeId === me.id && r.date === today) : undefined;
    const isPunchedIn = !!todayRecord?.checkIn;
    const isPunchedOut = !!todayRecord?.checkOut;

    const formatTime = (iso?: string) => {
        if (!iso) return '--:--';
        return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    };
    const workingHours = (() => {
        if (!todayRecord?.checkIn) return null;
        const inTime = new Date(todayRecord.checkIn).getTime();
        const outTime = todayRecord.checkOut ? new Date(todayRecord.checkOut).getTime() : Date.now();
        const mins = Math.floor((outTime - inTime) / 60000);
        return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    })();
    const todayDisplay = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    // Leave balance from employee record
    const leaveBalance: Record<string, number> = me.leaveBalance || {};

    return (
        <div className="space-y-6">
            {/* Header + Month Selector */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">Welcome, {me.name} 👋</h1>
                    <p className="text-dark-muted">Your personal overview</p>
                </div>
                <div className="flex items-center gap-2 bg-dark-card border border-dark-border rounded-xl px-3 py-1.5">
                    <button onClick={() => changeMonth(-1)} className="text-dark-muted hover:text-white transition-colors p-1 rounded-lg hover:bg-dark-border/40">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-semibold text-white min-w-[110px] text-center">{monthLabel}</span>
                    <button onClick={() => changeMonth(1)} disabled={isCurrentMonth} className="text-dark-muted hover:text-white transition-colors p-1 rounded-lg hover:bg-dark-border/40 disabled:opacity-30 disabled:cursor-not-allowed">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Today's Summary */}
            {isCurrentMonth && (
                <div className="glass rounded-2xl border border-dark-border overflow-hidden">
                    <div className="px-5 py-3 border-b border-dark-border bg-dark-border/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-primary-500/20 flex items-center justify-center">
                                <Clock className="w-3.5 h-3.5 text-primary-400" />
                            </div>
                            <span className="text-sm font-bold text-white">Today's Summary</span>
                        </div>
                        <span className="text-xs text-dark-muted">{todayDisplay}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-dark-border/60">
                        <div className="p-4 flex flex-col items-center gap-1">
                            <p className="text-[10px] uppercase tracking-wider text-dark-muted">Punch In</p>
                            <p className={`text-xl font-bold ${isPunchedIn ? 'text-emerald-400' : 'text-slate-500'}`}>{isPunchedIn ? formatTime(todayRecord?.checkIn) : '--:--'}</p>
                            {!isPunchedIn && <span className="text-[10px] text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full font-medium">Not Punched In</span>}
                        </div>
                        <div className="p-4 flex flex-col items-center gap-1">
                            <p className="text-[10px] uppercase tracking-wider text-dark-muted">Punch Out</p>
                            <p className={`text-xl font-bold ${isPunchedOut ? 'text-red-400' : isPunchedIn ? 'text-slate-400' : 'text-slate-500'}`}>{isPunchedOut ? formatTime(todayRecord?.checkOut) : '--:--'}</p>
                            {isPunchedIn && !isPunchedOut && <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full font-medium animate-pulse">In Office</span>}
                        </div>
                        <div className="p-4 flex flex-col items-center gap-1">
                            <p className="text-[10px] uppercase tracking-wider text-dark-muted">Working Hours</p>
                            <p className={`text-xl font-bold ${workingHours ? 'text-primary-400' : 'text-slate-500'}`}>{workingHours || '0h 0m'}</p>
                            {isPunchedIn && !isPunchedOut && <span className="text-[10px] text-primary-400 font-medium">Live ●</span>}
                        </div>
                        <div className="p-4 flex flex-col items-center gap-1">
                            <p className="text-[10px] uppercase tracking-wider text-dark-muted">Status</p>
                            {todayRecord ? (
                                <span className={`text-sm font-bold px-3 py-1 rounded-full ${todayRecord.status === 'PRESENT' ? 'bg-emerald-500/20 text-emerald-400' :
                                    todayRecord.status === 'LATE' ? 'bg-yellow-500/20 text-yellow-400' :
                                        todayRecord.status === 'HALF_DAY' ? 'bg-orange-500/20 text-orange-400' :
                                            todayRecord.status === 'ABSENT' ? 'bg-red-500/20 text-red-400' :
                                                'bg-slate-500/20 text-slate-400'
                                    }`}>{todayRecord.status.replace(/_/g, ' ')}</span>
                            ) : (
                                <span className="text-sm font-bold px-3 py-1 rounded-full bg-slate-500/20 text-slate-400">No Record</span>
                            )}
                        </div>
                    </div>
                    <div className="px-5 py-3 border-t border-dark-border/50 flex justify-center">
                        {!isPunchedIn ? (
                            <button onClick={() => navigate('/attendance')} className="w-full sm:w-auto px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                                <LogIn className="w-4 h-4" /> → Punch In Now
                            </button>
                        ) : !isPunchedOut ? (
                            <button onClick={() => navigate('/attendance')} className="w-full sm:w-auto px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                                <LogOut className="w-4 h-4" /> → Punch Out Now
                            </button>
                        ) : null}
                    </div>
                </div>
            )}

            {/* KPI Cards */}
            <div className="flex overflow-x-auto pb-4 -mb-4 gap-4 snap-x sm:grid sm:grid-cols-4 sm:overflow-visible sm:pb-0 sm:mb-0">
                <div className="glass p-5 rounded-xl border border-dark-border min-w-[200px] flex-1 snap-start">
                    <p className="text-dark-muted text-xs uppercase mb-2">My Attendance</p>
                    <h3 className="text-3xl font-bold text-white">{myAttPercentage}%</h3>
                    <p className="text-xs text-success mt-1">{myPresentDays} Days Present in {monthLabel}</p>
                </div>
                <div className="glass p-5 rounded-xl border border-dark-border min-w-[200px] flex-1 snap-start">
                    <p className="text-dark-muted text-xs uppercase mb-2">My Production</p>
                    <h3 className="text-3xl font-bold text-success">₹ {myProdValue.toLocaleString()}</h3>
                    <p className="text-xs text-dark-muted mt-1">Earnings in {monthLabel}</p>
                </div>
                <div className="glass p-5 rounded-xl border border-dark-border min-w-[200px] flex-1 snap-start">
                    <p className="text-dark-muted text-xs uppercase mb-2">Active Loan</p>
                    <h3 className="text-3xl font-bold text-danger">₹ {myLoan?.balance?.toLocaleString() || '0'}</h3>
                    <p className="text-xs text-dark-muted mt-1">Remaining Balance</p>
                </div>
                <div className="glass p-5 rounded-xl border border-dark-border min-w-[200px] flex-1 snap-start">
                    <p className="text-dark-muted text-xs uppercase mb-2">Pending Leaves</p>
                    <h3 className="text-3xl font-bold text-warning">{myPendingLeaves}</h3>
                    <p className="text-xs text-dark-muted mt-1">Awaiting Approval</p>
                </div>
            </div>

            {/* Leave Balance */}
            {Object.keys(leaveBalance).length > 0 && (
                <div className="glass p-5 rounded-xl border border-dark-border">
                    <p className="text-dark-muted text-xs uppercase mb-3">Leave Balance</p>
                    <div className="flex flex-wrap gap-3">
                        {Object.entries(leaveBalance).map(([type, balance]) => (
                            <div key={type} className="flex items-center gap-2 bg-dark-surface px-3 py-2 rounded-lg border border-dark-border">
                                <span className="text-dark-muted text-xs">{type}</span>
                                <span className="text-white font-bold text-sm">{balance}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
