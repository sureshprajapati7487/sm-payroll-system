// MobileDashboard.tsx
// Dedicated mobile-first dashboard page — optimized for phone screens

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Users, Clock, TrendingUp, Wallet, CalendarClock,
    Banknote, Factory, CheckCircle, AlertCircle, ArrowRight,
    LogIn, LogOut, ShoppingBag, ChevronRight, Bell, MapPin, Zap,
    Wifi, WifiOff
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { useAttendanceStore } from '@/store/attendanceStore';
import { usePayrollStore } from '@/store/payrollStore';
import { useLoanStore } from '@/store/loanStore';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';
import { useProductionStore } from '@/store/productionStore';
import { useAnalyticsStore } from '@/store/analyticsStore';
import { getBSSID } from '@/hooks/useBSSID';

// ── Live Clock ────────────────────────────────────────────────────────────────
const LiveClock = () => {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);
    return (
        <div>
            <div className="font-mono text-3xl font-black text-white tracking-wider">
                {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-xs text-white/60 mt-0.5">
                {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
        </div>
    );
};

// ── Quick Link Tile ───────────────────────────────────────────────────────────
const QuickTile = ({
    icon: Icon, label, sublabel, path, color, badge
}: {
    icon: React.ElementType; label: string; sublabel?: string; path: string;
    color: string; badge?: number;
}) => {
    const navigate = useNavigate();
    return (
        <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(path)}
            className={`relative flex flex-col items-start gap-2 p-4 rounded-2xl border transition-all text-left w-full ${color}`}
        >
            {badge !== undefined && badge > 0 && (
                <span className="absolute top-3 right-3 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                    {badge > 9 ? '9+' : badge}
                </span>
            )}
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
                <p className="text-white font-bold text-sm leading-tight">{label}</p>
                {sublabel && <p className="text-white/60 text-[10px] mt-0.5">{sublabel}</p>}
            </div>
            <ChevronRight className="absolute bottom-3 right-3 w-4 h-4 text-white/30" />
        </motion.button>
    );
};

// ════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════
export const MobileDashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { employees } = useEmployeeStore();
    const { records } = useAttendanceStore();
    const { slips } = usePayrollStore();
    const { loans } = useLoanStore();
    const { currentCompanyId } = useMultiCompanyStore();
    const { entries } = useProductionStore();
    const { stats, fetchDashboardStats } = useAnalyticsStore();

    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().toISOString().slice(0, 7);

    // ── Offline detection ────────────────────────────────────────────────
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    useEffect(() => {
        const setOnline = () => setIsOffline(false);
        const setOfflineMode = () => setIsOffline(true);
        window.addEventListener('online', setOnline);
        window.addEventListener('offline', setOfflineMode);
        return () => {
            window.removeEventListener('online', setOnline);
            window.removeEventListener('offline', setOfflineMode);
        };
    }, []);

    // ── BSSID Wi-Fi status (Android only) ───────────────────────────────
    const [bssidLabel, setBssidLabel] = useState<string | null>(null);
    const [bssidOk, setBssidOk] = useState<boolean | null>(null);
    useEffect(() => {
        const { bssid, isAndroidApp } = getBSSID();
        if (!isAndroidApp) { setBssidLabel(null); return; }
        if (bssid) {
            setBssidOk(true);
            setBssidLabel(`Wi-Fi: ${bssid}`);
        } else {
            setBssidOk(false);
            setBssidLabel('Office Wi-Fi nahi mili');
        }
    }, []);

    // Clear 'prefer-full-dashboard' so future sessions redirect normally
    useEffect(() => {
        sessionStorage.removeItem('prefer-full-dashboard');
    }, []);

    useEffect(() => {
        if (user?.role !== 'EMPLOYEE' && currentCompanyId) {
            fetchDashboardStats(currentCompanyId, currentMonth);
        }
    }, [user, currentCompanyId, currentMonth]);

    const companyEmployees = currentCompanyId
        ? employees.filter(e => e.companyId === currentCompanyId)
        : employees;

    // ── My personal data (if employee) ─────────────────────────────────────
    const isEmployee = user?.role === 'EMPLOYEE';
    const me = isEmployee
        ? companyEmployees.find(e => e.email === user?.email || e.id === user?.id)
        : null;
    const myRecord = me ? records.find(r => r.employeeId === me.id && r.date === today) : null;
    const myLoan = me ? loans.find(l => l.employeeId === me.id && l.status === 'ACTIVE') : null;
    const mySlip = me ? slips.filter(s => s.employeeId === me.id && s.month === currentMonth)[0] : null;
    const myProduction = me
        ? entries.filter(p => p.employeeId === me.id && p.date.startsWith(currentMonth)).reduce((s, p) => s + p.totalAmount, 0)
        : 0;

    // ── Admin stats ─────────────────────────────────────────────────────────
    const activeEmps = stats?.activeStaff || 0;
    const totalEmps = stats?.totalStaff || 0;
    const todayPresent = stats?.presentedCount || 0;
    const attPct = stats?.attendancePercentage || 0;
    const pendingLeaves = stats?.pendingLeaves || 0;
    const pendingLoans = stats?.pendingLoans || 0;
    const netPayroll = stats?.netPayrollThisMonth || 0;

    // ── Punch status ────────────────────────────────────────────────────────
    const punchStatus = myRecord?.checkIn && myRecord?.checkOut
        ? 'done'
        : myRecord?.checkIn
            ? 'in'
            : 'out';

    const PUNCH_CONFIG = {
        done: { label: 'Shift Complete', sub: 'Aaj ka kaam ho gaya!', color: 'from-slate-700 to-slate-800', icon: CheckCircle, iconColor: 'text-slate-400' },
        in: { label: 'Punched In', sub: `In: ${myRecord?.checkIn ? new Date(myRecord.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}`, color: 'from-emerald-700 to-emerald-900', icon: LogIn, iconColor: 'text-emerald-300' },
        out: { label: 'Not Punched In', sub: 'Aaj abhi punch nahi kiya', color: 'from-violet-700 to-violet-900', icon: LogOut, iconColor: 'text-violet-300' },
    };
    const punch = PUNCH_CONFIG[punchStatus];
    const PunchIcon = punch.icon;

    return (
        <div className="space-y-4 max-w-lg mx-auto">

            {/* ── Offline Banner ────────────────────────────────────────── */}
            {isOffline && (
                <motion.div
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 bg-orange-500/15 border border-orange-500/30 rounded-2xl px-4 py-3"
                >
                    <WifiOff className="w-5 h-5 text-orange-400 shrink-0" />
                    <div>
                        <p className="text-orange-300 font-bold text-sm">Aap Offline Hain</p>
                        <p className="text-orange-400/70 text-xs">Punch aur data sync network ke baad hoga.</p>
                    </div>
                </motion.div>
            )}

            {/* ── Hero card: Clock + greeting ──────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-primary-600 via-violet-700 to-indigo-800 p-5 shadow-xl shadow-primary-900/40"
            >
                {/* Decorative circles */}
                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5" />
                <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-white/5" />

                <div className="relative flex items-start justify-between gap-3">
                    <div>
                        <p className="text-white/60 text-xs font-medium mb-1 flex items-center gap-1.5">
                            <Zap className="w-3 h-3 text-yellow-400" />
                            SM Payroll · Mobile
                        </p>
                        <p className="text-white font-bold text-xl leading-tight">
                            Namaste, {user?.name?.split(' ')[0]} 👋
                        </p>
                        <p className="text-white/50 text-xs mt-1">{user?.role?.replace(/_/g, ' ')}</p>
                        {bssidLabel !== null && (
                            <div className={`mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border w-fit ${bssidOk ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}`}>
                                {bssidOk ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                                {bssidLabel}
                            </div>
                        )}
                    </div>
                    <LiveClock />
                </div>

                {/* Punch status strip */}
                {me && (
                    <div className={`mt-4 flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r ${punch.color}`}>
                        <PunchIcon className={`w-6 h-6 ${punch.iconColor}`} />
                        <div className="flex-1 min-w-0">
                            <p className="text-white font-bold text-sm">{punch.label}</p>
                            <p className="text-white/60 text-xs">{punch.sub}</p>
                        </div>
                        {punchStatus === 'out' && (
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => navigate('/mobile/checkin')}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-white text-xs font-bold transition-all"
                            >
                                <MapPin className="w-3.5 h-3.5" /> Check In
                            </motion.button>
                        )}
                    </div>
                )}
            </motion.div>

            {/* ── Personal stats (Employee view) ───────────────────────────── */}
            {isEmployee && me && (
                <div className="grid grid-cols-3 gap-3">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                        className="glass p-3 rounded-2xl border border-dark-border text-center"
                    >
                        <Clock className="w-5 h-5 text-primary-400 mx-auto mb-1" />
                        <p className="text-white font-bold text-lg">
                            {records.filter(r => r.employeeId === me.id && ['PRESENT', 'LATE', 'HALF_DAY'].includes(r.status)).length}
                        </p>
                        <p className="text-dark-muted text-[10px]">Days Present</p>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                        className="glass p-3 rounded-2xl border border-dark-border text-center"
                    >
                        <TrendingUp className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                        <p className="text-emerald-400 font-bold text-lg">₹{(myProduction / 1000).toFixed(1)}k</p>
                        <p className="text-dark-muted text-[10px]">Production</p>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                        className="glass p-3 rounded-2xl border border-dark-border text-center"
                    >
                        <Banknote className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
                        <p className="text-yellow-400 font-bold text-lg">
                            {mySlip ? `₹${(mySlip.netSalary / 1000).toFixed(1)}k` : '—'}
                        </p>
                        <p className="text-dark-muted text-[10px]">Net Salary</p>
                    </motion.div>
                    {myLoan && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                            className="glass p-3 rounded-2xl border border-red-500/20 col-span-3 flex items-center gap-3"
                        >
                            <Wallet className="w-5 h-5 text-red-400 shrink-0" />
                            <div>
                                <p className="text-white text-xs font-semibold">Active Loan</p>
                                <p className="text-red-400 text-xs">Balance: ₹{myLoan.balance.toLocaleString()}</p>
                            </div>
                        </motion.div>
                    )}
                </div>
            )}

            {/* ── Admin stats ───────────────────────────────────────────────── */}
            {!isEmployee && (
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { label: "Today's Attendance", value: `${attPct}%`, sub: `${todayPresent}/${activeEmps} present`, icon: Clock, color: 'text-primary-400', bg: 'bg-primary-500/15' },
                        { label: 'Active Staff', value: activeEmps, sub: `${totalEmps} total`, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
                        { label: 'Net Payroll', value: `₹${(netPayroll / 1000).toFixed(0)}k`, sub: currentMonth, icon: Banknote, color: 'text-yellow-400', bg: 'bg-yellow-500/15' },
                        { label: 'Pending Items', value: pendingLeaves + pendingLoans, sub: `${pendingLeaves} leaves, ${pendingLoans} loans`, icon: Bell, color: 'text-red-400', bg: 'bg-red-500/15' },
                    ].map((stat, i) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                            className="glass p-4 rounded-2xl border border-dark-border"
                        >
                            <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center mb-2`}>
                                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                            </div>
                            <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
                            <p className="text-dark-text text-xs font-semibold">{stat.label}</p>
                            <p className="text-dark-muted text-[10px] mt-0.5">{stat.sub}</p>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* ── Quick Links Grid ──────────────────────────────────────────── */}
            <div>
                <p className="text-dark-muted text-xs font-bold uppercase tracking-widest mb-3 px-1">Quick Access</p>
                <div className="grid grid-cols-2 gap-3">
                    {(!isEmployee) && (
                        <>
                            <QuickTile icon={Users} label="Employees" sublabel="Manage staff" path="/employees" color="bg-blue-600/80 border-blue-500/30" />
                            <QuickTile icon={CalendarClock} label="Attendance" sublabel="Today's status" path="/attendance" color="bg-violet-600/80 border-violet-500/30" badge={activeEmps - todayPresent} />
                            <QuickTile icon={Banknote} label="Payroll" sublabel={currentMonth} path="/payroll" color="bg-emerald-600/80 border-emerald-500/30" />
                            <QuickTile icon={Factory} label="Production" sublabel="View output" path="/production" color="bg-orange-600/80 border-orange-500/30" />
                            <QuickTile icon={ShoppingBag} label="Salesman" sublabel="Sales data" path="/salesman" color="bg-pink-600/80 border-pink-500/30" />
                            <QuickTile icon={AlertCircle} label="Approvals" sublabel="Pending items" path="/approvals" color="bg-red-600/80 border-red-500/30" badge={pendingLeaves + pendingLoans} />
                        </>
                    )}
                    {isEmployee && (
                        <>
                            <QuickTile
                                icon={punchStatus === 'in' ? LogOut : punchStatus === 'done' ? CheckCircle : LogIn}
                                label={punchStatus === 'in' ? 'Punch Out' : punchStatus === 'done' ? 'Shift Done' : 'Punch In'}
                                sublabel={punchStatus === 'in' ? 'Check Out karo' : punchStatus === 'done' ? 'Aaj ka kaam complete' : 'Attendance mark karo'}
                                path="/mobile/checkin"
                                color={punchStatus === 'in' ? 'bg-blue-600/80 border-blue-500/30' : punchStatus === 'done' ? 'bg-slate-600/80 border-slate-500/30' : 'bg-emerald-600/80 border-emerald-500/30'}
                            />
                            <QuickTile icon={CalendarClock} label="My Leaves" sublabel="Apply / view" path="/leaves" color="bg-violet-600/80 border-violet-500/30" />
                            <QuickTile icon={Wallet} label="My Loans" sublabel="Loan status" path="/loans" color="bg-orange-600/80 border-orange-500/30" />
                            <QuickTile icon={Banknote} label="My Payslip" sublabel={currentMonth} path="/payroll" color="bg-teal-600/80 border-teal-500/30" />
                        </>
                    )}
                </div>
            </div>

            {/* ── Face Kiosk quick link (admin only) ───────────────────────── */}
            {!isEmployee && (
                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate('/attendance/kiosk')}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-violet-600/30 to-indigo-600/30 border border-violet-500/20 transition-all hover:border-violet-500/40"
                >
                    <div className="w-12 h-12 rounded-2xl bg-violet-500/20 flex items-center justify-center shrink-0">
                        <Users className="w-6 h-6 text-violet-400" />
                    </div>
                    <div className="flex-1 text-left">
                        <p className="text-white font-bold">Face Kiosk</p>
                        <p className="text-violet-400 text-xs">Open biometric attendance kiosk</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-violet-400 shrink-0" />
                </motion.button>
            )}
            {/* ── Full Dashboard link ───────────────────────────────────────── */}
            <motion.button
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                onClick={() => {
                    sessionStorage.setItem('prefer-full-dashboard', '1');
                    navigate('/dashboard');
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dark-border/50 text-dark-muted hover:text-white hover:border-dark-border transition-all text-xs font-medium"
            >
                🖥️ Switch to Full Dashboard
            </motion.button>
        </div>
    );
};
