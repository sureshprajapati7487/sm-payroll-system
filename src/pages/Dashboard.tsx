import { useEffect } from 'react';
import { useAnalyticsStore } from '@/store/analyticsStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { useAttendanceStore } from '@/store/attendanceStore';
import { useProductionStore } from '@/store/productionStore';
import { useLoanStore } from '@/store/loanStore';
import { useAuthStore } from '@/store/authStore';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';
import { useAuditStore } from '@/store/auditStore';
import { useExpenseStore } from '@/store/expenseStore';
import { useNavigate } from 'react-router-dom';
import {
    Users, Clock, TrendingUp, Wallet, AlertCircle,
    CalendarX, CheckSquare, BadgeDollarSign, AlertTriangle,
    ShieldCheck, LogIn, LogOut, UserPlus, Trash2, Edit3,
    Eye, ArrowRight, Activity, DollarSign
} from 'lucide-react';
import { PERMISSIONS } from '@/config/permissions';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';

export const Dashboard = () => {
    const { employees } = useEmployeeStore();
    const { records } = useAttendanceStore();
    const { entries } = useProductionStore();
    const { loans } = useLoanStore();
    const { user, hasPermission } = useAuthStore();
    const { currentCompanyId } = useMultiCompanyStore();
    const { logs: auditLogs } = useAuditStore();
    const { stats, fetchDashboardStats } = useAnalyticsStore();
    const { getStats: getExpenseStats, fetchExpenses } = useExpenseStore();
    const navigate = useNavigate();

    // --- COMMON VARIABLES ---
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().toISOString().slice(0, 7);
    const PAYROLL_COLORS = ['#3B82F6', '#10B981', '#F59E0B'];

    // Company-scoped employees
    const companyEmployees = currentCompanyId
        ? employees.filter(e => e.companyId === currentCompanyId)
        : employees;

    // --- ROLE CHECKS ---
    const isManager = hasPermission(PERMISSIONS.VIEW_TEAM_ATTENDANCE) && !hasPermission(PERMISSIONS.VIEW_REPORTS);
    const isEmployee = !hasPermission(PERMISSIONS.VIEW_TEAM_ATTENDANCE) && !hasPermission(PERMISSIONS.VIEW_REPORTS);

    // ── C3: Auto-redirect ALL users on small screens to Mobile Dashboard ──────
    useEffect(() => {
        const check = () => {
            // Skip if user explicitly opted for full dashboard
            const preferFull = sessionStorage.getItem('prefer-full-dashboard');
            if (window.innerWidth < 640 && !preferFull) {
                navigate('/mobile/dashboard', { replace: true });
            }
        };
        check(); // on mount
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, [navigate]);

    // ── Fetch Analytics on mount ──────────────────────────────────────────────
    useEffect(() => {
        if (!isEmployee && currentCompanyId) {
            fetchDashboardStats(currentCompanyId, currentMonth);
            if (hasPermission(PERMISSIONS.VIEW_FINANCE_DASHBOARD)) {
                fetchExpenses(currentMonth);
            }
        }
    }, [currentCompanyId, currentMonth, isEmployee, hasPermission]);

    // 1. Employee View (Strictly Personal)
    if (isEmployee) {
        const me = companyEmployees.find(e => e.email === user?.email) || companyEmployees.find(e => e.id === user?.id);

        if (!me) return <div className="text-white p-6">Profile not found. Please contact HR.</div>;

        const myRecords = records.filter(r => r.employeeId === me.id);
        const myProduction = entries.filter(p => p.employeeId === me.id);
        const myLoan = loans.find(l => l.employeeId === me.id && l.status === 'ACTIVE');

        // My Attendance calc
        const myPresentDays = myRecords.filter(r => ['PRESENT', 'LATE', 'HALF_DAY'].includes(r.status)).length;
        const myAttPercentage = Math.round((myPresentDays / 26) * 100);

        // My Production
        const myProdValue = myProduction.reduce((sum, p) => sum + p.totalAmount, 0);

        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">Welcome, {me.name} 👋</h1>
                    <p className="text-dark-muted">Here is your personal overview.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                    <div className="glass p-5 rounded-xl border border-dark-border">
                        <p className="text-dark-muted text-xs uppercase mb-2">My Attendance</p>
                        <h3 className="text-3xl font-bold text-white">{myAttPercentage}%</h3>
                        <p className="text-xs text-success mt-1">{myPresentDays} Days Present</p>
                    </div>
                    <div className="glass p-5 rounded-xl border border-dark-border">
                        <p className="text-dark-muted text-xs uppercase mb-2">My Production</p>
                        <h3 className="text-3xl font-bold text-success">₹ {myProdValue.toLocaleString()}</h3>
                        <p className="text-xs text-dark-muted mt-1">Total Earnings</p>
                    </div>
                    <div className="glass p-5 rounded-xl border border-dark-border">
                        <p className="text-dark-muted text-xs uppercase mb-2">Active Loan</p>
                        <h3 className="text-3xl font-bold text-danger">₹ {myLoan?.balance.toLocaleString() || '0'}</h3>
                        <p className="text-xs text-dark-muted mt-1">Remaining Balance</p>
                    </div>
                </div>
            </div>
        );
    }

    // 2. Manager View (Team Stats)
    if (isManager) {
        const managerProfile = companyEmployees.find(e => e.email === user?.email);
        const teamEmployees = companyEmployees.filter(e => e.department === managerProfile?.department);
        const teamIds = teamEmployees.map(e => e.id);

        const teamActive = teamEmployees.filter(e => e.status === 'ACTIVE').length;
        const teamRecords = records.filter(r => teamIds.includes(r.employeeId) && r.date === today);
        const teamPresent = teamRecords.filter(r => ['PRESENT', 'LATE', 'HALF_DAY'].includes(r.status)).length;

        const teamProduction = entries
            .filter(p => teamIds.includes(p.employeeId) && p.date.startsWith(currentMonth))
            .reduce((sum, p) => sum + p.totalAmount, 0);

        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">Manager Dashboard</h1>
                    <p className="text-dark-muted">Overview of {managerProfile?.department || 'Your'} Team</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                    <div className="glass p-5 rounded-xl border border-dark-border">
                        <p className="text-dark-muted text-xs uppercase mb-2">Team Size</p>
                        <h3 className="text-3xl font-bold text-white">{teamActive}</h3>
                        <p className="text-xs text-dark-muted mt-1">Active Members</p>
                    </div>
                    <div className="glass p-5 rounded-xl border border-dark-border">
                        <p className="text-dark-muted text-xs uppercase mb-2">Team Attendance</p>
                        <h3 className="text-3xl font-bold text-warning">{teamPresent} / {teamActive}</h3>
                        <p className="text-xs text-dark-muted mt-1">Present Today</p>
                    </div>
                    <div className="glass p-5 rounded-xl border border-dark-border">
                        <p className="text-dark-muted text-xs uppercase mb-2">Team Production</p>
                        <h3 className="text-3xl font-bold text-success">₹ {teamProduction.toLocaleString()}</h3>
                        <p className="text-xs text-dark-muted mt-1">This Month</p>
                    </div>
                </div>
            </div>
        );
    }

    // 3. Admin View (Company Wide)
    if (!stats) {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-white gap-3">
                <Activity className="w-8 h-8 text-primary-400 animate-spin" />
                <p className="text-dark-muted font-medium tracking-wide">Crunching dashboard analytics...</p>
            </div>
        );
    }

    const {
        totalStaff: totalEmployees,
        activeStaff: activeEmployees,
        attendancePercentage,
        presentedCount,
        absentToday,
        monthProduction,
        momChange,
        totalOutstandingLoans: totalOutstanding,
        activeLoansCount,
        pendingLeaves,
        pendingProduction,
        pendingLoans,
        netPayrollThisMonth,
        slipsGenerated,
        attendanceTrendData,
        productionData,
        payrollDistribution
    } = stats;

    const hasPayrollData = payrollDistribution.length > 0;
    const activeLoans = { length: activeLoansCount }; // shim for JSX rendering below

    // Calculate Estimated P&L (Production - Payroll - Expenses)
    const expenseStats = getExpenseStats(currentMonth);
    const estimatedProfit = monthProduction - netPayrollThisMonth - expenseStats.total;
    const profitMargin = monthProduction > 0 ? ((estimatedProfit / monthProduction) * 100).toFixed(1) : 0;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white mb-1">Executive Dashboard</h1>
                <p className="text-dark-muted">Real-time overview of your workforce and operations.</p>
            </div>

            {/* KPI Cards Row 1 */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-6">
                <div className="glass p-5 rounded-xl border border-dark-border relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Users className="w-16 h-16 text-primary-400" /></div>
                    <p className="text-dark-muted text-xs uppercase tracking-wider mb-2">Total Staff</p>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-3xl font-bold text-white">{activeEmployees}</h3>
                        <span className="text-xs text-dark-muted">/ {totalEmployees}</span>
                    </div>
                    <div className="mt-2 text-xs text-success flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {totalEmployees - activeEmployees > 0 ? `${totalEmployees - activeEmployees} inactive` : 'All Active'}
                    </div>
                </div>

                <div className="glass p-5 rounded-xl border border-dark-border relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Clock className="w-16 h-16 text-warning" /></div>
                    <p className="text-dark-muted text-xs uppercase tracking-wider mb-2">Today's Attendance</p>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-3xl font-bold text-white">{attendancePercentage}%</h3>
                        <span className="text-xs text-dark-muted">{presentedCount} present</span>
                    </div>
                    <div className="w-full bg-dark-bg h-1.5 rounded-full mt-2 overflow-hidden">
                        <div className="bg-warning h-full transition-all" style={{ width: `${attendancePercentage}%` }} />
                    </div>
                    {absentToday > 0 && (
                        <p className="text-xs text-red-400 mt-1">{absentToday} not recorded yet</p>
                    )}
                </div>

                {hasPermission(PERMISSIONS.VIEW_PRODUCTION) && (
                    <div className="glass p-5 rounded-xl border border-dark-border relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp className="w-16 h-16 text-success" /></div>
                        <p className="text-dark-muted text-xs uppercase tracking-wider mb-2">This Month Production</p>
                        <div className="flex items-baseline gap-1">
                            <h3 className="text-3xl font-bold text-white">₹ {(monthProduction / 1000).toFixed(1)}k</h3>
                        </div>
                        <div className="mt-2 text-xs flex items-center gap-1">
                            {momChange !== null ? (
                                <>
                                    <TrendingUp className="w-3 h-3" style={{ color: momChange >= 0 ? '#10b981' : '#ef4444' }} />
                                    <span style={{ color: momChange >= 0 ? '#10b981' : '#ef4444' }}>
                                        {momChange >= 0 ? '+' : ''}{momChange}% vs last month
                                    </span>
                                </>
                            ) : (
                                <span className="text-dark-muted">No previous month data</span>
                            )}
                        </div>
                    </div>
                )}

                {hasPermission(PERMISSIONS.VIEW_ALL_LOANS) && (
                    <div className="glass p-5 rounded-xl border border-dark-border relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><Wallet className="w-16 h-16 text-danger" /></div>
                        <p className="text-dark-muted text-xs uppercase tracking-wider mb-2">Outstanding Loans</p>
                        <div className="flex items-baseline gap-1">
                            <h3 className="text-3xl font-bold text-danger">₹ {(totalOutstanding / 1000).toFixed(1)}k</h3>
                        </div>
                        <div className="mt-2 text-xs text-dark-muted flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {activeLoans.length} active loans
                        </div>
                    </div>
                )}

                {hasPermission(PERMISSIONS.VIEW_FINANCE_DASHBOARD) && (
                    <div className="glass p-5 rounded-xl border border-dark-border relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><DollarSign className="w-16 h-16 text-primary-400" /></div>
                        <p className="text-dark-muted text-xs uppercase tracking-wider mb-2">Est. Profit (P&L)</p>
                        <div className="flex items-baseline gap-1">
                            <h3 className={`text-3xl font-bold ${estimatedProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                                ₹ {(estimatedProfit / 1000).toFixed(1)}k
                            </h3>
                        </div>
                        <div className="mt-2 text-xs flex items-center gap-1 justify-between">
                            <span className={estimatedProfit >= 0 ? 'text-success' : 'text-danger'}>
                                {profitMargin}% margin
                            </span>
                            <span className="text-dark-muted shadow-sm">
                                {expenseStats.count > 0 ? `₹${(expenseStats.total / 1000).toFixed(1)}k exp.` : 'No expenses'}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* KPI Cards Row 2 — Pending Approvals + Net Payroll */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <div className={`glass p-4 rounded-xl border flex items-center gap-4 ${pendingLeaves > 0 ? 'border-yellow-500/30' : 'border-dark-border'
                    }`}>
                    <div className={`p-2.5 rounded-lg ${pendingLeaves > 0 ? 'bg-yellow-500/20' : 'bg-dark-surface'}`}>
                        <CalendarX className={`w-5 h-5 ${pendingLeaves > 0 ? 'text-yellow-400' : 'text-dark-muted'}`} />
                    </div>
                    <div>
                        <p className="text-dark-muted text-xs">Pending Leaves</p>
                        <p className={`text-xl font-bold ${pendingLeaves > 0 ? 'text-yellow-400' : 'text-white'}`}>{pendingLeaves}</p>
                    </div>
                </div>

                <div className={`glass p-4 rounded-xl border flex items-center gap-4 ${pendingProduction > 0 ? 'border-blue-500/30' : 'border-dark-border'
                    }`}>
                    <div className={`p-2.5 rounded-lg ${pendingProduction > 0 ? 'bg-blue-500/20' : 'bg-dark-surface'}`}>
                        <CheckSquare className={`w-5 h-5 ${pendingProduction > 0 ? 'text-blue-400' : 'text-dark-muted'}`} />
                    </div>
                    <div>
                        <p className="text-dark-muted text-xs">Pending Production</p>
                        <p className={`text-xl font-bold ${pendingProduction > 0 ? 'text-blue-400' : 'text-white'}`}>{pendingProduction}</p>
                    </div>
                </div>

                {hasPermission(PERMISSIONS.VIEW_ALL_LOANS) && (
                    <div className={`glass p-4 rounded-xl border flex items-center gap-4 ${pendingLoans > 0 ? 'border-orange-500/30' : 'border-dark-border'
                        }`}>
                        <div className={`p-2.5 rounded-lg ${pendingLoans > 0 ? 'bg-orange-500/20' : 'bg-dark-surface'}`}>
                            <AlertTriangle className={`w-5 h-5 ${pendingLoans > 0 ? 'text-orange-400' : 'text-dark-muted'}`} />
                        </div>
                        <div>
                            <p className="text-dark-muted text-xs">Pending Loans</p>
                            <p className={`text-xl font-bold ${pendingLoans > 0 ? 'text-orange-400' : 'text-white'}`}>{pendingLoans}</p>
                        </div>
                    </div>
                )}

                {hasPermission(PERMISSIONS.VIEW_PAYROLL) && (
                    <div className="glass p-4 rounded-xl border border-emerald-500/30 flex items-center gap-4">
                        <div className="p-2.5 rounded-lg bg-emerald-500/20">
                            <BadgeDollarSign className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-dark-muted text-xs">Net Payroll ({currentMonth})</p>
                            <p className="text-xl font-bold text-emerald-400">
                                {netPayrollThisMonth > 0 ? `₹ ${netPayrollThisMonth.toLocaleString('en-IN')}` : '—'}
                            </p>
                            {slipsGenerated > 0 && <p className="text-xs text-dark-muted">{slipsGenerated} slips</p>}
                        </div>
                    </div>
                )}
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Attendance Chart */}
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
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Area type="monotone" dataKey="present" stroke="#8B5CF6" strokeWidth={3} fillOpacity={1} fill="url(#colorPresent)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Payroll Distribution */}
                {hasPermission(PERMISSIONS.VIEW_PAYROLL) && (
                    <div className="glass p-4 md:p-6 rounded-2xl border border-dark-border h-[250px] md:h-[350px]">
                        <h3 className="font-bold text-white mb-2">Payroll Breakdown — {currentMonth}</h3>
                        <p className="text-xs text-dark-muted mb-4">{slipsGenerated} slips generated</p>
                        {!hasPayrollData ? (
                            <div className="h-[75%] flex flex-col items-center justify-center text-dark-muted opacity-50 gap-2">
                                <BadgeDollarSign className="w-12 h-12" />
                                <p className="text-sm">No payroll generated for {currentMonth}</p>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-[80%]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={payrollDistribution} cx="50%" cy="50%"
                                            innerRadius={55} outerRadius={95} paddingAngle={5} dataKey="value">
                                            {payrollDistribution.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={PAYROLL_COLORS[index % PAYROLL_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                                            formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, '']}
                                        />
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
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                                />
                                <Bar dataKey="units" fill="#10B981" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* ── Recent Activity Log ────────────────────────────────── */}
            {hasPermission(PERMISSIONS.VIEW_AUDIT_LOGS) && (
                <ActivityLogCard logs={auditLogs} onViewAll={() => navigate('/admin/audit-logs')} />
            )}
        </div>
    );
};

// ── Activity Log Card Component ────────────────────────────────────────────────
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
            {/* Header */}
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
                <button
                    onClick={onViewAll}
                    className="flex items-center gap-1.5 text-xs text-primary-400 hover:text-primary-300 font-medium transition-colors group"
                >
                    View All
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
            </div>

            {/* Log List */}
            {recent.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-dark-muted gap-2">
                    <ShieldCheck className="w-10 h-10 opacity-30" />
                    <p className="text-sm">No activity yet</p>
                </div>
            ) : (
                <div className="divide-y divide-dark-border/50">
                    {recent.map((log: any, i: number) => {
                        const meta = ACTION_META[log.action] || {
                            label: log.action,
                            color: 'text-slate-300',
                            bg: 'bg-slate-500/10',
                            icon: ShieldCheck,
                        };
                        const Icon = meta.icon;
                        return (
                            <div
                                key={log.id || i}
                                className="flex items-center gap-3 px-4 md:px-6 py-3 hover:bg-dark-border/10 transition-colors min-w-0"
                            >
                                {/* Icon */}
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.bg}`}>
                                    <Icon className={`w-4 h-4 ${meta.color}`} />
                                </div>

                                {/* Details */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                                            {meta.label}
                                        </span>
                                        {log.entityName && (
                                            <span className="text-xs text-dark-text truncate font-medium">{log.entityName}</span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-dark-muted mt-0.5 truncate">
                                        by <span className="text-slate-400">{log.userName || log.userId || 'System'}</span>
                                        {log.entityType && <> &bull; {log.entityType}</>}
                                    </p>
                                </div>

                                {/* Time */}
                                <span className="text-[11px] text-dark-muted shrink-0">
                                    {log.timestamp ? timeAgo(log.timestamp) : ''}
                                </span>

                                {/* Status dot */}
                                <div className={`w-2 h-2 rounded-full shrink-0 ${log.status === 'SUCCESS' ? 'bg-emerald-400' :
                                    log.status === 'FAILED' ? 'bg-red-400' :
                                        'bg-slate-500'
                                    }`} />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

