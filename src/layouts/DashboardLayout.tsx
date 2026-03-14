import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { PERMISSIONS } from '@/config/permissions';
import {
    Users, CalendarClock, Wallet, Settings, Factory,
    LogOut, Menu, X, ShieldAlert, LayoutDashboard,
    Banknote, UserCheck, ChevronRight, Zap, ShieldCheck, Database, ShoppingBag,
    MoreHorizontal, Calculator, BarChart2, IndianRupee, TrendingUp, FileText,
    Scale, Trash2, Upload, GitBranch, FlaskConical, Building2

} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { NotificationBell } from '@/components/NotificationBell';
import { notificationService } from '@/utils/notificationService';
import { AuditLogDrawer } from '@/components/AuditLogDrawer';
import { LogoutConfirmModal } from '@/components/LogoutConfirmModal';
import { useTranslation } from 'react-i18next';

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

// ── Sidebar Nav Groups ──────────────────────────────────────────────────────
const NAV_GROUPS = [
    {
        label: 'Main',
        items: [
            { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, perm: PERMISSIONS.NAV_DASHBOARD },
            { label: 'Employees', path: '/employees', icon: Users, perm: PERMISSIONS.NAV_EMPLOYEES },
            {
                label: 'Attendance', path: '/attendance', icon: CalendarClock, perm: PERMISSIONS.NAV_ATTENDANCE,
                subItems: [
                    { label: 'Holiday Manager', path: '/attendance/holidays', icon: CalendarClock, perm: PERMISSIONS.MANAGE_HOLIDAYS },
                    { label: 'Face Kiosk', path: '/attendance/kiosk', icon: ShieldCheck, perm: PERMISSIONS.USE_FACE_KIOSK },
                ],
            },
            {
                label: 'Salesman', path: '/salesman', icon: ShoppingBag, perm: PERMISSIONS.NAV_SALESMAN,
                subItems: [
                    { label: 'Client / Party List', path: '/salesman/clients', icon: Building2, perm: PERMISSIONS.VIEW_CLIENTS },
                ],
            },

            {
                label: 'Production', path: '/production', icon: Factory, perm: PERMISSIONS.NAV_PRODUCTION,
                subItems: [
                    { label: 'Rate Manager', path: '/production/rates', icon: IndianRupee, perm: PERMISSIONS.MANAGE_PRODUCTION_RATES },
                    { label: 'Work Groups', path: '/production/workgroups', icon: Users, perm: PERMISSIONS.MANAGE_WORK_GROUPS },
                    { label: 'Bulk Entry', path: '/production/bulk', icon: Upload, perm: PERMISSIONS.BULK_PRODUCTION_ENTRY },
                ],
            },
        ],
    },
    {
        label: 'Finance',
        items: [
            { label: 'Leaves', path: '/leaves', icon: CalendarClock, perm: PERMISSIONS.NAV_LEAVES },
            { label: 'Loans', path: '/loans', icon: Wallet, perm: PERMISSIONS.NAV_LOANS },
            { label: 'Approvals', path: '/approvals', icon: UserCheck, perm: PERMISSIONS.NAV_APPROVALS },
            {
                label: 'Payroll', path: '/payroll', icon: Banknote, perm: PERMISSIONS.NAV_PAYROLL,
                subItems: [
                    { label: 'Payroll History', path: '/payroll/history', icon: BarChart2, perm: PERMISSIONS.VIEW_PAYROLL },
                    { label: 'Simulation', path: '/payroll/simulation', icon: FlaskConical, perm: PERMISSIONS.RUN_PAYROLL_SIMULATION },
                ],
            },
            { label: 'Expenses', path: '/expenses', icon: Wallet, perm: PERMISSIONS.NAV_EXPENSES },
            { label: 'Finance Dashboard', path: '/finance/dashboard', icon: TrendingUp, perm: PERMISSIONS.VIEW_FINANCE_DASHBOARD },
            { label: 'Advance Salary', path: '/finance/advance-salary', icon: IndianRupee, perm: PERMISSIONS.MANAGE_ADVANCE_SALARY },
            { label: 'Dept Finance', path: '/finance/department', icon: BarChart2, perm: PERMISSIONS.VIEW_DEPT_FINANCE },
            { label: 'Cost Centers', path: '/finance/cost-centers', icon: Scale, perm: PERMISSIONS.VIEW_COST_CENTERS },
        ],
    },
    {
        label: 'Calculators',
        items: [
            { label: 'CTC Calculator', path: '/calculators/ctc', icon: Calculator, perm: PERMISSIONS.NAV_CALCULATORS },
            { label: 'TDS Calculator', path: '/calculators/tds', icon: Scale, perm: PERMISSIONS.NAV_CALCULATORS },
            { label: 'PF / ESI Calc', path: '/calculators/pfesi', icon: FlaskConical, perm: PERMISSIONS.NAV_CALCULATORS },
        ],
    },
    {
        label: 'Reports',
        items: [
            { label: 'Report Builder', path: '/reports/builder', icon: BarChart2, perm: PERMISSIONS.VIEW_REPORTS },
            { label: 'Custom Reports', path: '/reports/custom', icon: FileText, perm: PERMISSIONS.BUILD_REPORTS },
            { label: 'Scheduled', path: '/reports/scheduled', icon: CalendarClock, perm: PERMISSIONS.SCHEDULE_REPORTS },
        ],
    },
    {
        label: 'Statutory',
        items: [
            { label: 'Form 16', path: '/statutory/form16', icon: FileText, perm: PERMISSIONS.VIEW_FORM16 },
            { label: 'Statutory Reports', path: '/statutory/reports', icon: ShieldCheck, perm: PERMISSIONS.VIEW_STATUTORY },
        ],
    },
    {
        label: 'System',
        items: [
            { label: 'Audit Logs', path: '/admin/audit-logs', icon: ShieldCheck, perm: PERMISSIONS.VIEW_AUDIT_LOGS },
            { label: 'Database Backup', path: '/admin/backup', icon: Database, perm: PERMISSIONS.DATABASE_BACKUP },
            { label: 'Bulk Import', path: '/admin/bulk-import', icon: Upload, perm: PERMISSIONS.BULK_IMPORT },
            { label: 'Trash', path: '/admin/trash', icon: Trash2, perm: PERMISSIONS.MANAGE_TRASH },
            { label: 'Drafts', path: '/admin/drafts', icon: GitBranch, perm: PERMISSIONS.MANAGE_TRASH },
            { label: 'Data Check', path: '/admin/consistency', icon: ShieldCheck, perm: PERMISSIONS.DATA_CONSISTENCY_CHECK },
            { label: 'Security Alerts', path: '/security/alerts', icon: ShieldAlert, perm: PERMISSIONS.VIEW_SECURITY_ALERTS },
            { label: 'Help Center', path: '/help', icon: FileText, perm: null }, // Null perm means always visible
            { label: 'Company', path: '/company/switcher', icon: Database, perm: PERMISSIONS.MANAGE_COMPANY_SWITCH },
            {
                label: 'Settings', path: '/settings', icon: Settings, perm: PERMISSIONS.MANAGE_SETTINGS,
                subItems: [
                    { label: 'Configuration', path: '/configuration', icon: Settings, perm: PERMISSIONS.MANAGE_SETTINGS },
                    { label: 'Security', path: '/settings/security', icon: ShieldCheck, perm: PERMISSIONS.MANAGE_SETTINGS },
                    { label: 'Theme', path: '/settings/theme', icon: Settings, perm: null }, // Theme is personal preference
                    { label: 'Language', path: '/settings/language', icon: FileText, perm: null },
                    { label: 'Notifications', path: '/settings/notifications', icon: Settings, perm: null },
                    { label: 'Server Status', path: '/settings/server-status', icon: Database, perm: PERMISSIONS.MANAGE_SETTINGS },
                    { label: 'My Profile', path: '/settings/profile', icon: Users, perm: null },
                ],
            },
        ],
    },
];


// ── Mobile Bottom Nav — with permission keys (same store as desktop) ────────
const BOTTOM_NAV = [
    { label: 'Home', path: '/dashboard', icon: LayoutDashboard, perm: PERMISSIONS.NAV_DASHBOARD },
    { label: 'Attend', path: '/attendance', icon: CalendarClock, perm: PERMISSIONS.NAV_ATTENDANCE },
    { label: 'Payroll', path: '/payroll', icon: Banknote, perm: PERMISSIONS.NAV_PAYROLL },
    { label: 'Salesman', path: '/salesman', icon: ShoppingBag, perm: PERMISSIONS.NAV_SALESMAN },
];

// ── More menu items — with permission keys (same store as desktop) ────────────
const MORE_ITEMS = [
    { label: 'Staff', path: '/employees', icon: Users, perm: PERMISSIONS.NAV_EMPLOYEES },
    { label: 'Leaves', path: '/leaves', icon: CalendarClock, perm: PERMISSIONS.NAV_LEAVES },
    { label: 'Loans', path: '/loans', icon: Wallet, perm: PERMISSIONS.NAV_LOANS },
    { label: 'Expenses', path: '/expenses', icon: Wallet, perm: PERMISSIONS.NAV_EXPENSES },
    { label: 'Production', path: '/production', icon: Factory, perm: PERMISSIONS.NAV_PRODUCTION },
    { label: 'Approvals', path: '/approvals', icon: UserCheck, perm: PERMISSIONS.NAV_APPROVALS },
    { label: 'Settings', path: '/settings', icon: Settings, perm: PERMISSIONS.MANAGE_SETTINGS },
    { label: 'Reports', path: '/reports/builder', icon: ShieldCheck, perm: PERMISSIONS.VIEW_REPORTS },
];

// ── Translation keys ───────────────────────────────────────────────────────
const NAV_LABEL_KEYS: Record<string, string> = {
    'Dashboard': 'nav.dashboard',
    'Employees': 'nav.employees',
    'Attendance': 'nav.attendance',
    'Salesman': 'nav.salesman',
    'Production': 'nav.production',
    'Leaves': 'nav.leaves',
    'Loans': 'nav.loans',
    'Approvals': 'nav.approvals',
    'Payroll': 'nav.payroll',
    'Expenses': 'nav.expenses',
    'Settings': 'nav.settings',
    'Audit Logs': 'nav.auditLogs',
};
const NAV_GROUP_KEYS: Record<string, string> = {
    'Main': 'nav.main',
    'Finance': 'nav.finance',
    'Calculators': 'nav.calculators',
    'Reports': 'nav.reports',
    'Statutory': 'nav.statutory',
    'System': 'nav.system',
};

// ════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════
export const DashboardLayout = () => {
    const { user, logout, hasPermission } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isMoreOpen, setIsMoreOpen] = useState(false);
    const { t } = useTranslation();
    const [expandedItems, setExpandedItems] = useState<string[]>([]);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    const toggleExpand = (path: string) => {
        setExpandedItems(prev => prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]);
    };

    useEffect(() => {
        if (user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')) {
            notificationService.requestPermission();
        }
    }, [user]);

    // Close overlays on route change
    useEffect(() => {
        setIsMobileMenuOpen(false);
        setIsMoreOpen(false);
    }, [location.pathname]);

    const handleLogout = () => setShowLogoutConfirm(true);
    const doLogoutNow = () => { setShowLogoutConfirm(false); logout(); navigate('/login'); };

    const showItem = (item: { perm?: string | null }) => {
        if (!item.perm) return true;
        return hasPermission(item.perm as Parameters<typeof hasPermission>[0]);
    };

    // ── Sidebar Content (shared: desktop + mobile overlay) ──────────────────
    const renderSidebarContent = () => (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="px-5 pt-3 pb-4 flex items-center gap-3 border-b border-dark-border">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-lg shadow-primary-500/30 shrink-0">
                    <ShieldAlert className="text-white w-5 h-5" />
                </div>
                <div>
                    <h1 className="font-extrabold text-[15px] tracking-tight text-dark-text leading-none">SM PAYROLL</h1>
                    <p className="text-[10px] text-dark-muted uppercase tracking-widest mt-0.5 flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5 text-primary-500" /> System v1.0
                    </p>
                </div>
            </div>

            {/* Nav groups */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
                {NAV_GROUPS.map(group => {
                    const visible = group.items.filter(item => showItem(item));
                    if (!visible.length) return null;
                    return (
                        <div key={group.label}>
                            <p className="text-[10px] font-bold text-dark-muted uppercase tracking-widest px-3 mb-1.5">
                                {t(NAV_GROUP_KEYS[group.label] || group.label)}
                            </p>
                            <div className="space-y-0.5">
                                {visible.map(item => {
                                    const rawSubItems = 'subItems' in item && item.subItems ? item.subItems : [];
                                    const visibleSubItems = rawSubItems.filter(sub => showItem(sub as any));
                                    const hasSubItems = visibleSubItems.length > 0;

                                    const isExpanded = expandedItems.includes(item.path);
                                    const isSubActive = hasSubItems && visibleSubItems.some(s => location.pathname.startsWith(s.path));

                                    return (
                                        <div key={item.path}>
                                            {hasSubItems ? (
                                                // Parent item with toggle
                                                <>
                                                    <button
                                                        onClick={() => {
                                                            navigate(item.path);
                                                            toggleExpand(item.path);
                                                            setIsMobileMenuOpen(false);
                                                        }}
                                                        className={cn(
                                                            'group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative overflow-hidden',
                                                            (location.pathname === item.path || isSubActive)
                                                                ? 'bg-primary-500/20 text-dark-text border border-primary-500/20'
                                                                : 'text-dark-muted hover:text-dark-text hover:bg-dark-border/30'
                                                        )}
                                                    >
                                                        {(location.pathname === item.path || isSubActive) && (
                                                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-400 rounded-r-full" />
                                                        )}
                                                        <div className={cn(
                                                            'w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0',
                                                            (location.pathname === item.path || isSubActive)
                                                                ? 'bg-primary-500/20 text-primary-500'
                                                                : 'bg-dark-border/30 text-dark-muted group-hover:bg-dark-border/50 group-hover:text-dark-text'
                                                        )}>
                                                            <item.icon className="w-4 h-4" />
                                                        </div>
                                                        <span className="flex-1 text-left">{t(NAV_LABEL_KEYS[item.label] || item.label)}</span>
                                                        <ChevronRight className={cn('w-3.5 h-3.5 shrink-0 transition-transform', isExpanded ? 'rotate-90' : '')} />
                                                    </button>
                                                    {/* Sub-items */}
                                                    {isExpanded && (
                                                        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-dark-border/50 pl-2">
                                                            {visibleSubItems.map(sub => (
                                                                <NavLink
                                                                    key={sub.path}
                                                                    to={sub.path}
                                                                    onClick={() => setIsMobileMenuOpen(false)}
                                                                    className={({ isActive }) => cn(
                                                                        'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                                                                        isActive
                                                                            ? 'bg-primary-500/15 text-primary-400'
                                                                            : 'text-dark-muted hover:text-dark-text hover:bg-dark-border/30'
                                                                    )}
                                                                >
                                                                    <sub.icon className="w-3.5 h-3.5 shrink-0" />
                                                                    <span>{sub.label}</span>
                                                                </NavLink>
                                                            ))}
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                // Regular NavLink
                                                <NavLink
                                                    to={item.path}
                                                    onClick={() => setIsMobileMenuOpen(false)}
                                                    className={({ isActive }) => cn(
                                                        'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative overflow-hidden',
                                                        isActive
                                                            ? 'bg-primary-500/20 text-dark-text shadow-sm border border-primary-500/20'
                                                            : 'text-dark-muted hover:text-dark-text hover:bg-dark-border/30'
                                                    )}
                                                >
                                                    {({ isActive }) => (
                                                        <>
                                                            {isActive && (
                                                                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-400 rounded-r-full" />
                                                            )}
                                                            <div className={cn(
                                                                'w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0',
                                                                isActive
                                                                    ? 'bg-primary-500/20 text-primary-500'
                                                                    : 'bg-dark-border/30 text-dark-muted group-hover:bg-dark-border/50 group-hover:text-dark-text'
                                                            )}>
                                                                <item.icon className="w-4 h-4" />
                                                            </div>
                                                            <span className="flex-1">{t(NAV_LABEL_KEYS[item.label] || item.label)}</span>
                                                            {isActive && <ChevronRight className="w-3.5 h-3.5 text-primary-400 shrink-0" />}
                                                        </>
                                                    )}
                                                </NavLink>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </nav>

            {/* User card + logout */}
            <div className="px-3 pb-4 pt-2 border-t border-dark-border space-y-2">
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-dark-border/20 border border-dark-border">
                    <img src={user?.avatar} alt="avatar" className="w-8 h-8 rounded-full border-2 border-primary-500/40 shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-dark-text truncate">{user?.name}</p>
                        <p className="text-[10px] text-primary-500 font-bold uppercase tracking-wide truncate">
                            {user?.role?.replace(/_/g, ' ')}
                        </p>
                    </div>
                    <NotificationBell />
                </div>
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all text-xs font-medium group"
                >
                    <LogOut className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    <span>{t('nav.signOut')}</span>
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-dark-bg text-dark-text flex font-sans">

            {/* ── Desktop Sidebar ──────────────────────────────────────────── */}
            <aside className="hidden md:flex w-[220px] flex-col bg-dark-card border-r border-dark-border fixed h-full z-10">
                {renderSidebarContent()}
            </aside>

            {/* ── Mobile Sidebar Overlay ───────────────────────────────────── */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 z-30 md:hidden"
                            onClick={() => setIsMobileMenuOpen(false)}
                        />
                        <motion.aside
                            initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="fixed left-0 top-0 h-full w-[260px] bg-dark-card border-r border-dark-border z-40 md:hidden"
                        >
                            {renderSidebarContent()}
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* ── More Menu (bottom sheet popup) ───────────────────────────── */}
            <AnimatePresence>
                {isMoreOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40 md:hidden"
                            onClick={() => setIsMoreOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
                            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                            className="fixed bottom-[64px] left-2 right-2 z-50 md:hidden rounded-2xl bg-dark-card border border-dark-border shadow-2xl overflow-hidden"
                        >
                            {/* Grid of extra pages — filtered by role permissions */}
                            <div className="p-3 grid grid-cols-3 gap-1.5">
                                {MORE_ITEMS.filter(item =>
                                    hasPermission(item.perm as Parameters<typeof hasPermission>[0])
                                ).map(item => {
                                    const isActive = location.pathname.startsWith(item.path);
                                    return (
                                        <button
                                            key={item.path}
                                            onClick={() => { navigate(item.path); setIsMoreOpen(false); }}
                                            className={cn(
                                                'flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all text-xs font-medium',
                                                isActive
                                                    ? 'bg-primary-500/20 text-primary-400'
                                                    : 'text-dark-muted hover:bg-dark-border/30 hover:text-dark-text active:scale-95'
                                            )}
                                        >
                                            <item.icon className="w-5 h-5" />
                                            <span className="text-center leading-tight">{item.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            {/* User strip + logout */}
                            <div className="px-4 py-3 border-t border-dark-border flex items-center gap-3">
                                <img src={user?.avatar} alt="avatar" className="w-8 h-8 rounded-full border-2 border-primary-500/40 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-dark-text truncate">{user?.name}</p>
                                    <p className="text-[10px] text-primary-500 font-bold uppercase">{user?.role?.replace(/_/g, ' ')}</p>
                                </div>
                                <button onClick={handleLogout} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-all" title="Logout">
                                    <LogOut className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ── Main Content ─────────────────────────────────────────────── */}
            <main className="flex-1 md:ml-[220px] relative">
                {/* Mobile sticky header */}
                <div className="md:hidden flex items-center justify-between px-4 py-3 bg-dark-card border-b border-dark-border sticky top-0 z-20">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-md shadow-primary-500/30">
                            <ShieldAlert className="text-white w-4 h-4" />
                        </div>
                        <span className="font-bold text-dark-text text-sm tracking-tight">SM PAYROLL</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <NotificationBell />
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-dark-border/30 text-dark-text hover:bg-dark-border/50 transition-all"
                        >
                            {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* Page content — pb-24 on mobile to avoid bottom nav overlap */}
                <div className="p-4 md:p-6 max-w-7xl mx-auto pb-24 md:pb-6 overflow-x-hidden">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={location.pathname}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.25 }}
                        >
                            <Outlet />
                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>

            {/* ── Mobile Bottom Navigation Bar ─────────────────────────────── */}
            <nav
                className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-dark-card/95 backdrop-blur-xl border-t border-dark-border"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
                <div className="flex items-stretch h-[60px]">
                    {BOTTOM_NAV.filter(item =>
                        hasPermission(item.perm as Parameters<typeof hasPermission>[0])
                    ).map(item => {
                        const isActive = location.pathname === item.path ||
                            (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
                        return (
                            <button
                                key={item.path}
                                onClick={() => { navigate(item.path); setIsMoreOpen(false); }}
                                className={cn(
                                    'flex-1 flex flex-col items-center justify-center gap-0.5 transition-all duration-200 relative active:scale-95',
                                    isActive ? 'text-primary-400' : 'text-dark-muted'
                                )}
                            >
                                {isActive && (
                                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary-400 rounded-b-full" />
                                )}
                                <div className={cn(
                                    'w-9 h-9 rounded-xl flex items-center justify-center transition-all',
                                    isActive ? 'bg-primary-500/15' : ''
                                )}>
                                    <item.icon className={cn('w-5 h-5', isActive ? 'scale-105' : '')} />
                                </div>
                                <span className="text-[10px] font-semibold tracking-tight leading-none">{item.label}</span>
                            </button>
                        );
                    })}

                    {/* More button */}
                    <button
                        onClick={() => setIsMoreOpen(prev => !prev)}
                        className={cn(
                            'flex-1 flex flex-col items-center justify-center gap-0.5 transition-all duration-200 relative active:scale-95',
                            isMoreOpen ? 'text-primary-400' : 'text-dark-muted'
                        )}
                    >
                        {isMoreOpen && (
                            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary-400 rounded-b-full" />
                        )}
                        <div className={cn(
                            'w-9 h-9 rounded-xl flex items-center justify-center transition-all',
                            isMoreOpen ? 'bg-primary-500/15' : ''
                        )}>
                            <MoreHorizontal className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-semibold tracking-tight leading-none">More</span>
                    </button>
                </div>
            </nav>

            {/* ── Audit Log Drawer ─────────────────────────────────────────── */}
            <AuditLogDrawer />

            {/* ── Logout Password Confirm Modal ────────────────────────────── */}
            <LogoutConfirmModal
                isOpen={showLogoutConfirm}
                onConfirmed={doLogoutNow}
                onCancel={() => setShowLogoutConfirm(false)}
            />
        </div>
    );
};
