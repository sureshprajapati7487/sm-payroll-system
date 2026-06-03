import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalyticsStore } from '@/store/analyticsStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { useAttendanceStore } from '@/store/attendanceStore';
import { useAuthStore } from '@/store/authStore';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';
import { useAuditStore } from '@/store/auditStore';
import { useExpenseStore } from '@/store/expenseStore';
import {
    Users, Clock, TrendingUp, Wallet, AlertCircle,
    CalendarX, CheckSquare, BadgeDollarSign, AlertTriangle,
    ShieldCheck, LogIn, LogOut, UserPlus, Trash2, Edit3,
    Eye, ArrowRight, Activity, DollarSign,
    UserPlus2, CalendarCheck, Banknote, CreditCard, Database, Zap,
    RefreshCcw
} from 'lucide-react';
import { PERMISSIONS } from '@/config/permissions';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';

const PAYROLL_COLORS = ['#3B82F6', '#10B981', '#F59E0B'];

const ACTION_META: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
    LOGIN: { label: 'Login', color: 'text-emerald-400', bg: 'bg-emerald-500/15', icon: LogIn },
    LOGOUT: { label: 'Logout', color: 'text-slate-400', bg: 'bg-slate-500/15', icon: LogOut },
    CREATE_EMPLOYEE: { label: 'New Employee', color: 'text-blue-400', bg: 'bg-blue-500/15', icon: UserPlus },
    UPDATE_EMPLOYEE: { label: 'Employee Edit', color: 'text-yellow-400', bg: 'bg-yellow-500/15', icon: Edit3 },
    DELETE_EMPLOYEE: { label: 'Employee Del', color: 'text-red-400', bg: 'bg-red-500/15', icon: Trash2 },
    CREATE_LOAN: { label: 'Loan Created', color: 'text-orange-400', bg: 'bg-orange-500/15', icon: BadgeDollarSign },
    UPDATE_LOAN: { label: 'Loan Updated', color: 'text-orange-300', bg: 'bg-orange-500/10', icon: BadgeDollarSign },
    VIEW_EMPLOYEE: { label: 'Viewed', color: 'text-violet-400', bg: 'bg-violet-500/15', icon: Eye },
    GENERATE_PAYROLL: { label: 'Payroll', color: 'text-teal-400', bg: 'bg-teal-500/15', icon: BadgeDollarSign },
    APPROVE_LEAVE: { label: 'Leave Approved', color: 'text-green-400', bg: 'bg-green-500/15', icon: CheckSquare },
    REJECT_LEAVE: { label: 'Leave Rejected', color: 'text-red-400', bg: 'bg-red-500/15', icon: AlertTriangle },
};

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function ActivityLogCard({ logs, onViewAll }: { logs: any[]; onViewAll: () => void }) {
    const recent = logs.slice(0, 8);
    return (
        <div className="glass rounded-2xl border border-dark-border overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center">
                        <Activity className="w-4 h-4 text-primary-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-sm">Recent Activity</h3>
                        <p className="text-[11px] text-dark-muted">{logs.length} total events logged</p>
                    </div>
                </div>
                <button onClick={onViewAll} className="flex items-center gap-1.5 text-xs text-primary-400 hover:text-primary-300 font-medium transition-colors group">
                    View All <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
            </div>
            {recent.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-dark-muted gap-2">
                    <ShieldCheck className="w-10 h-10 opacity-30" />
                    <p className="text-sm">No activity yet</p>
                </div>
            ) : (
                <div className="divide-y divide-dark-border/50">
                    {recent.map((log: any, i: number) => {
                        const meta = ACTION_META[log.action] || { label: log.action, color: 'text-slate-300', bg: 'bg-slate-500/10', icon: ShieldCheck };
                        const Icon = meta.icon;
                        return (
                            <div key={log.id || i} className="flex items-center gap-3 px-4 md:px-6 py-3 hover:bg-dark-border/10 transition-colors min-w-0">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.bg}`}>
                                    <Icon className={`w-4 h-4 ${meta.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>{meta.label}</span>
                                        {log.entityName && <span className="text-xs text-dark-text truncate font-medium">{log.entityName}</span>}
                                    </div>
                                    <p className="text-[11px] text-dark-muted mt-0.5 truncate">
                                        by <span className="text-slate-400">{log.userName || log.userId || 'System'}</span>
                                        {log.entityType && <> &bull; {log.entityType}</>}
                                    </p>
                                </div>
                                <span className="text-[11px] text-dark-muted shrink-0">{log.timestamp ? timeAgo(log.timestamp) : ''}</span>
                                <div className={`w-2 h-2 rounded-full shrink-0 ${log.status === 'SUCCESS' ? 'bg-emerald-400' : log.status === 'FAILED' ? 'bg-red-400' : 'bg-slate-500'}`} />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export const AdminDashboard = () => {
    const { employees } = useEmployeeStore();
    const { records } = useAttendanceStore();
    const { hasPermission } = useAuthStore();
    const { currentCompanyId } = useMultiCompanyStore();
    const { logs: auditLogs } = useAuditStore();
    const { stats, isLoading, error, fetchDashboardStats } = useAnalyticsStore();
    const { getStats: getExpenseStats, fetchExpenses } = useExpenseStore();
    const navigate = useNavigate();

    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().toISOString().slice(0, 7);

    const companyEmployees = currentCompanyId
        ? employees.filter(e => e.companyId === currentCompanyId)
        : employees;

    useEffect(() => {
        if (currentCompanyId) {
            fetchDashboardStats(currentCompanyId, currentMonth);
            if (hasPermission(PERMISSIONS.VIEW_FINANCE_DASHBOARD)) {
                fetchExpenses(currentMonth);
            }
        }
    }, [currentCompanyId, currentMonth]); // eslint-disable-line

    if (isLoading && !stats) {
        return (
            <div className="space-y-6 p-6">
                <div className="h-8 w-64 animate-pulse bg-dark-border rounded-lg" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => <div key={i} className="animate-pulse bg-dark-border rounded-xl h-24" />)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="animate-pulse bg-dark-border rounded-2xl h-[250px]" />
                    <div className="animate-pulse bg-dark-border rounded-2xl h-[250px]" />
                </div>
            </div>
        );
    }

    if (error && !stats) {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-white gap-4">
                <div className="glass p-8 rounded-2xl border border-red-500/30 flex flex-col items-center gap-4 max-w-md">
                    <AlertCircle className="w-12 h-12 text-red-400" />
                    <h3 className="text-lg font-bold text-white">Failed to Load Dashboard</h3>
                    <p className="text-dark-muted text-sm text-center">{error}</p>
                    <button onClick={() => currentCompanyId && fetchDashboardStats(currentCompanyId, currentMonth)}
                        className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-semibold text-sm transition-colors flex items-center gap-2">
                        <RefreshCcw className="w-4 h-4" /> Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="space-y-6 p-6">
                <div className="h-8 w-64 animate-pulse bg-dark-border rounded-lg" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => <div key={i} className="animate-pulse bg-dark-border rounded-xl h-24" />)}
                </div>
            </div>
        );
    }

    const {
        totalStaff: totalEmployees, activeStaff: activeEmployees,
        attendancePercentage, presentedCount, absentToday,
        monthProduction, momChange, totalOutstandingLoans: totalOutstanding,
        activeLoansCount, pendingLeaves, pendingProduction, pendingLoans,
        netPayrollThisMonth, slipsGenerated, attendanceTrendData,
        productionData, payrollDistribution
    } = stats;

    const hasPayrollData = payrollDistribution.length > 0;
    const activeLoans = { length: activeLoansCount };

    const lateArrivalsToday = records.filter(r => r.date === today && r.companyId === currentCompanyId && r.status === 'LATE').length;
    const markedAbsentToday = records.filter(r => r.date === today && r.companyId === currentCompanyId && r.status === 'ABSENT').length;

    const departmentAttendance = (() => {
        const deptMap = new Map<string, { total: number; present: number }>();
        companyEmployees.filter(e => e.status === 'ACTIVE').forEach(emp => {
            const dept = emp.department || 'Unassigned';
            if (!deptMap.has(dept)) deptMap.set(dept, { total: 0, present: 0 });
            deptMap.get(dept)!.total++;
        });
        records.filter(r => r.date === today && r.companyId === currentCompanyId).forEach(rec => {
            const emp = companyEmployees.find(e => e.id === rec.employeeId);
            if (emp && ['PRESENT', 'LATE', 'HALF_DAY'].includes(rec.status)) {
                const dept = emp.department || 'Unassigned';
                if (deptMap.has(dept)) deptMap.get(dept)!.present++;
            }
        });
        return Array.from(deptMap.entries())
            .map(([dept, data]) => ({ department: dept, total: data.total, present: data.present, absent: data.total - data.present, percentage: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0 }))
            .sort((a, b) => a.percentage - b.percentage);
    })();

    const todayPunches = records
        .filter(r => r.date === today && r.companyId === currentCompanyId)
        .sort((a, b) => (b.checkIn ? new Date(b.checkIn).getTime() : 0) - (a.checkIn ? new Date(a.checkIn).getTime() : 0))
        .slice(0, 10);

    const formatPunchTime = (iso?: string) => {
        if (!iso) return '—';
        return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const totalPending = pendingLeaves + pendingProduction + pendingLoans;
    const expenseStats = getExpenseStats(currentMonth);
    const estimatedProfit = monthProduction - netPayrollThisMonth - expenseStats.total;
    const profitMargin = monthProduction > 0 ? ((estimatedProfit / monthProduction) * 100).toFixed(1) : 0;

    const QUICK_ACTIONS = [
        { label: 'Add Employee', icon: UserPlus2, path: '/employees/new', perm: PERMISSIONS.ADD_EMPLOYEE, color: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400' },
        { label: 'Attendance', icon: CalendarCheck, path: '/attendance', perm: PERMISSIONS.VIEW_ATTENDANCE, color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400' },
        { label: 'Run Payroll', icon: Banknote, path: '/payroll', perm: PERMISSIONS.GENERATE_PAYROLL, color: 'from-violet-500/20 to-violet-600/10 border-violet-500/30 text-violet-400' },
        { label: 'New Loan', icon: CreditCard, path: '/loans', perm: PERMISSIONS.APPROVE_LOANS, color: 'from-orange-500/20 to-orange-600/10 border-orange-500/30 text-orange-400' },
        { label: 'Reports', icon: TrendingUp, path: '/reports/builder', perm: PERMISSIONS.VIEW_REPORTS, color: 'from-pink-500/20 to-pink-600/10 border-pink-500/30 text-pink-400' },
        { label: 'Backup', icon: Database, path: '/admin/backup', perm: PERMISSIONS.DATABASE_BACKUP, color: 'from-teal-500/20 to-teal-600/10 border-teal-500/30 text-teal-400' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">Executive Dashboard</h1>
                    <p className="text-dark-muted">Real-time overview of your workforce and operations.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => currentCompanyId && fetchDashboardStats(currentCompanyId, currentMonth)}
                        className="p-2 rounded-lg bg-dark-card border border-dark-border hover:bg-dark-border/40 transition-colors group" title="Refresh dashboard">
                        <RefreshCcw className={`w-4 h-4 text-dark-muted group-hover:text-white transition-colors ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <div className="flex items-center gap-1.5 text-xs text-dark-muted bg-dark-card border border-dark-border px-3 py-1.5 rounded-lg">
                        <Zap className="w-3 h-3 text-primary-400" />
                        <span>Live — {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {QUICK_ACTIONS.filter(a => hasPermission(a.perm as Parameters<typeof hasPermission>[0])).map(action => (
                    <button key={action.path} onClick={() => navigate(action.path)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border bg-gradient-to-b ${action.color} hover:scale-105 active:scale-95 transition-all duration-200 group`}>
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/5 group-hover:bg-white/10 transition-colors">
                            <action.icon className="w-5 h-5" />
                        </div>
                        <span className="text-[11px] font-semibold text-center leading-tight text-dark-text">{action.label}</span>
                    </button>
                ))}
            </div>

            {/* KPI Row 1 */}
            <div className="flex overflow-x-auto pb-4 -mb-4 gap-3 snap-x lg:grid lg:grid-cols-5 lg:overflow-visible lg:pb-0 lg:mb-0 md:gap-6">
                <div className="glass p-5 rounded-xl border border-dark-border relative overflow-hidden min-w-[180px] flex-[0_0_65%] sm:flex-1 snap-start">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Users className="w-16 h-16 text-primary-400" /></div>
                    <p className="text-dark-muted text-xs uppercase tracking-wider mb-2">Total Staff</p>
                    <div className="flex items-baseline gap-2"><h3 className="text-3xl font-bold text-white">{activeEmployees}</h3><span className="text-xs text-dark-muted">/ {totalEmployees}</span></div>
                    <div className="mt-2 text-xs text-success flex items-center gap-1">
                        <Users className="w-3 h-3" />{totalEmployees - activeEmployees > 0 ? `${totalEmployees - activeEmployees} inactive` : 'All Active'}
                    </div>
                </div>

                <div className="glass p-5 rounded-xl border border-dark-border relative overflow-hidden min-w-[180px] flex-[0_0_65%] sm:flex-1 snap-start">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Clock className="w-16 h-16 text-warning" /></div>
                    <p className="text-dark-muted text-xs uppercase tracking-wider mb-2">Today's Attendance</p>
                    <div className="flex items-baseline gap-2"><h3 className="text-3xl font-bold text-white">{attendancePercentage}%</h3><span className="text-xs text-dark-muted">{presentedCount} present</span></div>
                    <div className="w-full bg-dark-bg h-1.5 rounded-full mt-2 overflow-hidden">
                        <div className="bg-warning h-full transition-all" style={{ width: `${attendancePercentage}%` }} />
                    </div>
                    {(absentToday > 0 || markedAbsentToday > 0) && (
                        <p className="text-xs text-red-400 mt-1">
                            {markedAbsentToday > 0 ? `${markedAbsentToday} marked absent` : ''}
                            {markedAbsentToday > 0 && absentToday > 0 ? ' · ' : ''}
                            {absentToday > 0 ? `${absentToday} not recorded` : ''}
                        </p>
                    )}
                </div>

                <div className={`glass p-5 rounded-xl border relative overflow-hidden min-w-[180px] flex-[0_0_65%] sm:flex-1 snap-start ${lateArrivalsToday > 0 ? 'border-amber-500/30' : 'border-dark-border'}`}>
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Clock className="w-16 h-16 text-amber-400" /></div>
                    <p className="text-dark-muted text-xs uppercase tracking-wider mb-2">Late Today</p>
                    <h3 className={`text-3xl font-bold ${lateArrivalsToday > 0 ? 'text-amber-400' : 'text-white'}`}>{lateArrivalsToday}</h3>
                    <div className="mt-2 text-xs text-dark-muted flex items-center gap-1"><Clock className="w-3 h-3" /> Employees late today</div>
                </div>

                {hasPermission(PERMISSIONS.VIEW_PRODUCTION) && (
                    <div className="glass p-5 rounded-xl border border-dark-border relative overflow-hidden min-w-[180px] flex-[0_0_65%] sm:flex-1 snap-start">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp className="w-16 h-16 text-success" /></div>
                        <p className="text-dark-muted text-xs uppercase tracking-wider mb-2">This Month Production</p>
                        <h3 className="text-3xl font-bold text-white">₹ {(monthProduction / 1000).toFixed(1)}k</h3>
                        <div className="mt-2 text-xs flex items-center gap-1">
                            {momChange !== null ? (
                                <><TrendingUp className="w-3 h-3" style={{ color: momChange >= 0 ? '#10b981' : '#ef4444' }} /><span style={{ color: momChange >= 0 ? '#10b981' : '#ef4444' }}>{momChange >= 0 ? '+' : ''}{momChange}% vs last month</span></>
                            ) : <span className="text-dark-muted">No previous month data</span>}
                        </div>
                    </div>
                )}

                {hasPermission(PERMISSIONS.VIEW_ALL_LOANS) && (
                    <div className="glass p-5 rounded-xl border border-dark-border relative overflow-hidden min-w-[180px] flex-[0_0_65%] sm:flex-1 snap-start">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><Wallet className="w-16 h-16 text-danger" /></div>
                        <p className="text-dark-muted text-xs uppercase tracking-wider mb-2">Outstanding Loans</p>
                        <h3 className="text-3xl font-bold text-danger">₹ {(totalOutstanding / 1000).toFixed(1)}k</h3>
                        <div className="mt-2 text-xs text-dark-muted flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {activeLoans.length} active loans</div>
                    </div>
                )}

                {hasPermission(PERMISSIONS.VIEW_FINANCE_DASHBOARD) && (
                    <div className="glass p-5 rounded-xl border border-dark-border relative overflow-hidden min-w-[180px] flex-[0_0_65%] sm:flex-1 snap-start">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><DollarSign className="w-16 h-16 text-primary-400" /></div>
                        <p className="text-dark-muted text-xs uppercase tracking-wider mb-2">Est. Profit (P&L)</p>
                        <h3 className={`text-3xl font-bold ${estimatedProfit >= 0 ? 'text-success' : 'text-danger'}`}>₹ {(estimatedProfit / 1000).toFixed(1)}k</h3>
                        <div className="mt-2 text-xs flex items-center gap-1 justify-between">
                            <span className={estimatedProfit >= 0 ? 'text-success' : 'text-danger'}>{profitMargin}% margin</span>
                            <span className="text-dark-muted">{expenseStats.count > 0 ? `₹${(expenseStats.total / 1000).toFixed(1)}k exp.` : 'No expenses'}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* KPI Row 2 */}
            <div className="flex overflow-x-auto pb-4 -mb-4 gap-3 snap-x lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0 lg:mb-0 md:gap-4">
                <div className={`glass p-4 rounded-xl border flex items-center gap-4 min-w-[200px] flex-[0_0_75%] sm:flex-1 snap-start ${pendingLeaves > 0 ? 'border-yellow-500/30' : 'border-dark-border'}`}>
                    <div className={`p-2.5 rounded-lg ${pendingLeaves > 0 ? 'bg-yellow-500/20' : 'bg-dark-surface'}`}><CalendarX className={`w-5 h-5 ${pendingLeaves > 0 ? 'text-yellow-400' : 'text-dark-muted'}`} /></div>
                    <div><p className="text-dark-muted text-xs">Pending Leaves</p><p className={`text-xl font-bold ${pendingLeaves > 0 ? 'text-yellow-400' : 'text-white'}`}>{pendingLeaves}</p></div>
                </div>

                <div className={`glass p-4 rounded-xl border flex items-center gap-4 min-w-[200px] flex-[0_0_75%] sm:flex-1 snap-start ${pendingProduction > 0 ? 'border-blue-500/30' : 'border-dark-border'}`}>
                    <div className={`p-2.5 rounded-lg ${pendingProduction > 0 ? 'bg-blue-500/20' : 'bg-dark-surface'}`}><CheckSquare className={`w-5 h-5 ${pendingProduction > 0 ? 'text-blue-400' : 'text-dark-muted'}`} /></div>
                    <div><p className="text-dark-muted text-xs">Pending Production</p><p className={`text-xl font-bold ${pendingProduction > 0 ? 'text-blue-400' : 'text-white'}`}>{pendingProduction}</p></div>
                </div>

                {hasPermission(PERMISSIONS.VIEW_ALL_LOANS) && (
                    <div className={`glass p-4 rounded-xl border flex items-center gap-4 min-w-[200px] flex-[0_0_75%] sm:flex-1 snap-start ${pendingLoans > 0 ? 'border-orange-500/30' : 'border-dark-border'}`}>
                        <div className={`p-2.5 rounded-lg ${pendingLoans > 0 ? 'bg-orange-500/20' : 'bg-dark-surface'}`}><AlertTriangle className={`w-5 h-5 ${pendingLoans > 0 ? 'text-orange-400' : 'text-dark-muted'}`} /></div>
                        <div><p className="text-dark-muted text-xs">Pending Loans</p><p className={`text-xl font-bold ${pendingLoans > 0 ? 'text-orange-400' : 'text-white'}`}>{pendingLoans}</p></div>
                    </div>
                )}

                {hasPermission(PERMISSIONS.VIEW_PAYROLL) && (
                    <div className="glass p-4 rounded-xl border border-emerald-500/30 flex items-center gap-4 min-w-[200px] flex-[0_0_75%] sm:flex-1 snap-start">
                        <div className="p-2.5 rounded-lg bg-emerald-500/20"><BadgeDollarSign className="w-5 h-5 text-emerald-400" /></div>
                        <div>
                            <p className="text-dark-muted text-xs">Net Payroll ({currentMonth})</p>
                            <p className="text-xl font-bold text-emerald-400">{netPayrollThisMonth > 0 ? `₹ ${netPayrollThisMonth.toLocaleString('en-IN')}` : '—'}</p>
                            {slipsGenerated > 0 && <p className="text-xs text-dark-muted">{slipsGenerated} slips</p>}
                        </div>
                    </div>
                )}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass p-4 md:p-6 rounded-2xl border border-dark-border h-[250px] md:h-[350px]">
                    <h3 className="font-bold text-white mb-6">Attendance Trends (7 Days)</h3>
                    <ResponsiveContainer width="100%" height="85%">
                        <AreaChart data={attendanceTrendData}>
                            <defs>
                                <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                            <Area type="monotone" dataKey="present" stroke="#8B5CF6" strokeWidth={3} fillOpacity={1} fill="url(#colorPresent)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {hasPermission(PERMISSIONS.VIEW_PAYROLL) && (
                    <div className="glass p-4 md:p-6 rounded-2xl border border-dark-border h-[250px] md:h-[350px]">
                        <h3 className="font-bold text-white mb-2">Payroll Breakdown — {currentMonth}</h3>
                        <p className="text-xs text-dark-muted mb-4">{slipsGenerated} slips generated</p>
                        {!hasPayrollData ? (
                            <div className="h-[75%] flex flex-col items-center justify-center text-dark-muted opacity-50 gap-2">
                                <BadgeDollarSign className="w-12 h-12" /><p className="text-sm">No payroll generated for {currentMonth}</p>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-[80%]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={payrollDistribution} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={5} dataKey="value">
                                            {payrollDistribution.map((_, index) => <Cell key={`cell-${index}`} fill={PAYROLL_COLORS[index % PAYROLL_COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }} formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, '']} />
                                        <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '12px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Production Chart */}
            {hasPermission(PERMISSIONS.VIEW_PRODUCTION) && (
                <div className="glass p-6 rounded-2xl border border-dark-border">
                    <h3 className="font-bold text-white mb-6">Production Output by Department</h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={productionData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
                                <XAxis type="number" stroke="#94a3b8" />
                                <YAxis dataKey="name" type="category" stroke="#fff" width={100} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }} />
                                <Bar dataKey="units" fill="#10B981" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Department Attendance Table */}
            <section className="glass rounded-2xl border border-dark-border overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-dark-border">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center"><Users className="w-4 h-4 text-blue-400" /></div>
                    <div><h3 className="font-bold text-white text-sm">Department Attendance — Today</h3><p className="text-[11px] text-dark-muted">{departmentAttendance.length} departments</p></div>
                </div>
                {departmentAttendance.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-dark-muted gap-2"><Users className="w-10 h-10 opacity-30" /><p className="text-sm">No department data available</p></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-dark-border/50">
                                <th className="text-left text-dark-muted text-xs uppercase tracking-wider px-6 py-3">Department</th>
                                <th className="text-center text-dark-muted text-xs uppercase tracking-wider px-4 py-3">Total</th>
                                <th className="text-center text-dark-muted text-xs uppercase tracking-wider px-4 py-3">Present</th>
                                <th className="text-center text-dark-muted text-xs uppercase tracking-wider px-4 py-3">Absent</th>
                                <th className="text-center text-dark-muted text-xs uppercase tracking-wider px-4 py-3">%</th>
                            </tr></thead>
                            <tbody className="divide-y divide-dark-border/30">
                                {departmentAttendance.map(dept => (
                                    <tr key={dept.department} className="hover:bg-dark-border/10 transition-colors">
                                        <td className="px-6 py-3 text-white font-medium">{dept.department}</td>
                                        <td className="px-4 py-3 text-center text-dark-text">{dept.total}</td>
                                        <td className="px-4 py-3 text-center text-emerald-400 font-medium">{dept.present}</td>
                                        <td className="px-4 py-3 text-center text-red-400 font-medium">{dept.absent}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${dept.percentage >= 90 ? 'bg-emerald-500/20 text-emerald-400' : dept.percentage >= 70 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>{dept.percentage}%</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* Today's Punch Timeline */}
            {hasPermission(PERMISSIONS.VIEW_ATTENDANCE) && (
                <section className="glass rounded-2xl border border-dark-border overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-dark-border">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center"><Clock className="w-4 h-4 text-violet-400" /></div>
                        <div><h3 className="font-bold text-white text-sm">Today's Punch Activity</h3><p className="text-[11px] text-dark-muted">Last 10 punch events</p></div>
                    </div>
                    {todayPunches.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-14 text-dark-muted gap-2"><Clock className="w-10 h-10 opacity-30" /><p className="text-sm">No punches recorded today</p></div>
                    ) : (
                        <div className="divide-y divide-dark-border/30">
                            {todayPunches.map((rec, i) => {
                                const emp = companyEmployees.find(e => e.id === rec.employeeId);
                                return (
                                    <div key={rec.id || i} className="flex items-center gap-4 px-6 py-3 hover:bg-dark-border/10 transition-colors">
                                        <div className="flex-1 min-w-0"><p className="text-white text-sm font-medium truncate">{emp?.name || rec.employeeId}</p></div>
                                        <div className="flex items-center gap-4 text-xs">
                                            <div className="text-center min-w-[70px]"><p className="text-dark-muted text-[10px] uppercase">In</p><p className="text-emerald-400 font-medium">{formatPunchTime(rec.checkIn)}</p></div>
                                            <div className="text-center min-w-[70px]"><p className="text-dark-muted text-[10px] uppercase">Out</p><p className="text-red-400 font-medium">{formatPunchTime(rec.checkOut)}</p></div>
                                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold min-w-[70px] text-center ${rec.status === 'PRESENT' ? 'bg-emerald-500/20 text-emerald-400' : rec.status === 'LATE' ? 'bg-yellow-500/20 text-yellow-400' : rec.status === 'HALF_DAY' ? 'bg-orange-500/20 text-orange-400' : rec.status === 'ABSENT' ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400'}`}>{rec.status?.replace(/_/g, ' ')}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            )}

            {/* Pending Approvals */}
            {totalPending > 0 ? (
                <section className="glass rounded-2xl border border-dark-border overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-dark-border">
                        <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-orange-400" /></div>
                        <div><h3 className="font-bold text-white text-sm">Pending Actions</h3><p className="text-[11px] text-dark-muted">{totalPending} items require your attention</p></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-dark-border/50">
                        <button onClick={() => navigate('/leaves')} className="flex items-center gap-4 p-5 hover:bg-dark-border/10 transition-colors text-left">
                            <div className={`p-2.5 rounded-lg ${pendingLeaves > 0 ? 'bg-yellow-500/20' : 'bg-dark-surface'}`}><CalendarX className={`w-5 h-5 ${pendingLeaves > 0 ? 'text-yellow-400' : 'text-dark-muted'}`} /></div>
                            <div className="flex-1"><p className={`text-2xl font-bold ${pendingLeaves > 0 ? 'text-yellow-400' : 'text-white'}`}>{pendingLeaves}</p><p className="text-xs text-dark-muted">Pending Leaves</p></div>
                            <span className="text-xs text-primary-400 font-medium">Review →</span>
                        </button>
                        <button onClick={() => navigate('/loans')} className="flex items-center gap-4 p-5 hover:bg-dark-border/10 transition-colors text-left">
                            <div className={`p-2.5 rounded-lg ${pendingLoans > 0 ? 'bg-orange-500/20' : 'bg-dark-surface'}`}><CreditCard className={`w-5 h-5 ${pendingLoans > 0 ? 'text-orange-400' : 'text-dark-muted'}`} /></div>
                            <div className="flex-1"><p className={`text-2xl font-bold ${pendingLoans > 0 ? 'text-orange-400' : 'text-white'}`}>{pendingLoans}</p><p className="text-xs text-dark-muted">Pending Loans</p></div>
                            <span className="text-xs text-primary-400 font-medium">Review →</span>
                        </button>
                        {hasPermission(PERMISSIONS.VIEW_PRODUCTION) && (
                            <button onClick={() => navigate('/production')} className="flex items-center gap-4 p-5 hover:bg-dark-border/10 transition-colors text-left">
                                <div className={`p-2.5 rounded-lg ${pendingProduction > 0 ? 'bg-blue-500/20' : 'bg-dark-surface'}`}><CheckSquare className={`w-5 h-5 ${pendingProduction > 0 ? 'text-blue-400' : 'text-dark-muted'}`} /></div>
                                <div className="flex-1"><p className={`text-2xl font-bold ${pendingProduction > 0 ? 'text-blue-400' : 'text-white'}`}>{pendingProduction}</p><p className="text-xs text-dark-muted">Pending Production</p></div>
                                <span className="text-xs text-primary-400 font-medium">Review →</span>
                            </button>
                        )}
                    </div>
                </section>
            ) : (
                <div className="glass p-5 rounded-xl border border-dark-border text-center">
                    <p className="text-emerald-400 font-medium">✅ No pending approvals</p>
                </div>
            )}

            {/* Activity Log */}
            {hasPermission(PERMISSIONS.VIEW_AUDIT_LOGS) && (
                <ActivityLogCard logs={auditLogs} onViewAll={() => navigate('/admin/audit-logs')} />
            )}
        </div>
    );
};
