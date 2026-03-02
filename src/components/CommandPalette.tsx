import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
    Search, Command, X,
    LayoutDashboard, Users, Clock, DollarSign, TrendingUp,
    FileText, BarChart3, Settings, LogOut,
    CreditCard, Banknote, Calendar, CheckSquare, Shield,
    Building2, UserPlus, Download, RefreshCw,
    ChevronRight, BookOpen, Trash2, FileSpreadsheet,
    AlertCircle, Activity, PiggyBank, Moon
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useEmployeeStore } from '@/store/employeeStore';

// ── Types ────────────────────────────────────────────────────────────────────
type CategoryType = 'Navigation' | 'Action' | 'Employee' | 'Report' | 'Settings' | 'Quick';

interface CommandItem {
    id: string;
    title: string;
    description?: string;
    icon: React.ReactNode;
    action: () => void;
    keywords: string[];
    category: CategoryType;
    shortcut?: string;
    danger?: boolean;
}

const CATEGORY_ORDER: CategoryType[] = ['Quick', 'Navigation', 'Action', 'Employee', 'Report', 'Settings'];

const CATEGORY_CONFIG: Record<CategoryType, { label: string; color: string }> = {
    Quick: { label: '⚡ Quick Actions', color: 'text-yellow-400' },
    Navigation: { label: '🧭 Navigate', color: 'text-primary-400' },
    Action: { label: '⚙️ Actions', color: 'text-success' },
    Employee: { label: '👤 Employees', color: 'text-info' },
    Report: { label: '📊 Reports & Finance', color: 'text-purple-400' },
    Settings: { label: '🔧 Settings', color: 'text-dark-muted' },
};

// ── Component ────────────────────────────────────────────────────────────────
export const CommandPalette = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedIdx, setSelectedIdx] = useState(0);
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const { logout } = useAuthStore();
    const { employees } = useEmployeeStore();

    const close = useCallback(() => {
        setIsOpen(false);
        setSearch('');
        setSelectedIdx(0);
    }, []);

    const open = useCallback(() => {
        setIsOpen(true);
        setSelectedIdx(0);
    }, []);

    // ── Static commands ───────────────────────────────────────────────────
    const staticCommands: CommandItem[] = useMemo(() => [
        // ── Navigation ──────────────────────────────────────────────────
        { id: 'nav-dashboard', title: 'Dashboard', description: 'Overview & key metrics', icon: <LayoutDashboard className="w-4 h-4" />, action: () => navigate('/dashboard'), keywords: ['home', 'overview', 'dashboard', 'stats'], category: 'Navigation' },
        { id: 'nav-employees', title: 'Employees', description: 'Manage staff records', icon: <Users className="w-4 h-4" />, action: () => navigate('/employees'), keywords: ['employees', 'staff', 'workers', 'kaamgar'], category: 'Navigation' },
        { id: 'nav-attendance', title: 'Attendance', description: 'Daily punch-in records', icon: <Clock className="w-4 h-4" />, action: () => navigate('/attendance'), keywords: ['attendance', 'present', 'absent', 'punch', 'hazri'], category: 'Navigation' },
        { id: 'nav-payroll', title: 'Payroll', description: 'Salary slips & payments', icon: <DollarSign className="w-4 h-4" />, action: () => navigate('/payroll'), keywords: ['payroll', 'salary', 'payment', 'tankhwa'], category: 'Navigation' },
        { id: 'nav-loans', title: 'Loans', description: 'Advance & loan requests', icon: <CreditCard className="w-4 h-4" />, action: () => navigate('/loans'), keywords: ['loans', 'advance', 'deduction', 'udhar'], category: 'Navigation' },
        { id: 'nav-leaves', title: 'Leave Management', description: 'Request & approve leaves', icon: <Calendar className="w-4 h-4" />, action: () => navigate('/leaves'), keywords: ['leave', 'vacation', 'chutti', 'off'], category: 'Navigation' },
        { id: 'nav-production', title: 'Production', description: 'Track production output', icon: <TrendingUp className="w-4 h-4" />, action: () => navigate('/production'), keywords: ['production', 'output', 'pieces', 'kaam'], category: 'Navigation' },
        { id: 'nav-approvals', title: 'Approvals', description: 'Pending approval requests', icon: <CheckSquare className="w-4 h-4" />, action: () => navigate('/approvals'), keywords: ['approvals', 'pending', 'approve'], category: 'Navigation' },
        { id: 'nav-expenses', title: 'Expenses', description: 'Petty cash & daily expenses', icon: <Banknote className="w-4 h-4" />, action: () => navigate('/expenses'), keywords: ['expenses', 'petty cash', 'kharch'], category: 'Navigation' },
        { id: 'nav-holidays', title: 'Holiday Manager', description: 'Manage holidays & schedule', icon: <BookOpen className="w-4 h-4" />, action: () => navigate('/attendance/holidays'), keywords: ['holidays', 'holiday', 'chutti', 'calendar'], category: 'Navigation' },
        { id: 'nav-statutory', title: 'Statutory Reports', description: 'PF, ESIC, PT reports', icon: <Shield className="w-4 h-4" />, action: () => navigate('/statutory/reports'), keywords: ['pf', 'esic', 'pt', 'statutory', 'compliance'], category: 'Navigation' },
        { id: 'nav-form16', title: 'Form 16 Generator', description: 'Income tax year-end form', icon: <FileText className="w-4 h-4" />, action: () => navigate('/statutory/form16'), keywords: ['form16', 'tax', 'income tax'], category: 'Navigation' },

        // ── Actions ──────────────────────────────────────────────────────
        { id: 'act-add-emp', title: 'Add New Employee', description: 'Create a new staff record', icon: <UserPlus className="w-4 h-4" />, action: () => navigate('/employees/new'), keywords: ['add', 'new', 'create', 'employee', 'naya'], category: 'Action' },
        { id: 'act-attendance', title: 'Mark Attendance', description: 'Record today\'s check-in', icon: <Clock className="w-4 h-4" />, action: () => navigate('/attendance'), keywords: ['mark', 'attendance', 'punch', 'hazri'], category: 'Action' },
        { id: 'act-gen-payroll', title: 'Generate Payroll', description: 'Create salary slips', icon: <DollarSign className="w-4 h-4" />, action: () => navigate('/payroll'), keywords: ['generate', 'payroll', 'salary', 'slip'], category: 'Action' },
        { id: 'act-payslip', title: 'View Payslip History', description: 'Past payroll records', icon: <FileSpreadsheet className="w-4 h-4" />, action: () => navigate('/payroll/history'), keywords: ['payslip', 'history', 'past', 'payroll'], category: 'Action' },
        { id: 'act-loan-req', title: 'New Loan Request', description: 'Raise an advance/loan', icon: <PiggyBank className="w-4 h-4" />, action: () => navigate('/loans'), keywords: ['loan', 'advance', 'udhar', 'request'], category: 'Action' },
        { id: 'act-bulk-import', title: 'Bulk Import', description: 'Import employees from file', icon: <Download className="w-4 h-4" />, action: () => navigate('/admin/bulk-import'), keywords: ['import', 'bulk', 'upload', 'excel'], category: 'Action' },
        { id: 'act-audit', title: 'Audit Logs', description: 'View system activity logs', icon: <Activity className="w-4 h-4" />, action: () => navigate('/admin/audit-logs'), keywords: ['audit', 'logs', 'activity', 'history'], category: 'Action' },
        { id: 'act-trash', title: 'Trash / Deleted Items', description: 'Restore deleted records', icon: <Trash2 className="w-4 h-4" />, action: () => navigate('/admin/trash'), keywords: ['trash', 'deleted', 'restore', 'recycle'], category: 'Action' },

        // ── Reports ──────────────────────────────────────────────────────
        { id: 'rep-builder', title: 'Report Builder', description: 'Custom report generation', icon: <BarChart3 className="w-4 h-4" />, action: () => navigate('/reports/builder'), keywords: ['report', 'builder', 'custom'], category: 'Report' },
        { id: 'rep-finance', title: 'Finance Dashboard', description: 'Financial overview & charts', icon: <TrendingUp className="w-4 h-4" />, action: () => navigate('/finance/dashboard'), keywords: ['finance', 'financial', 'charts', 'budget'], category: 'Report' },
        { id: 'rep-dept', title: 'Department Finance', description: 'Department-wise cost report', icon: <Building2 className="w-4 h-4" />, action: () => navigate('/finance/department'), keywords: ['department', 'finance', 'cost'], category: 'Report' },
        { id: 'rep-advance', title: 'Advance Salary', description: 'Advance salary management', icon: <CreditCard className="w-4 h-4" />, action: () => navigate('/finance/advance-salary'), keywords: ['advance', 'salary', 'management'], category: 'Report' },
        { id: 'rep-scheduled', title: 'Scheduled Reports', description: 'Auto-send report schedule', icon: <RefreshCw className="w-4 h-4" />, action: () => navigate('/reports/scheduled'), keywords: ['scheduled', 'auto', 'report', 'email'], category: 'Report' },

        // ── Settings ─────────────────────────────────────────────────────
        { id: 'set-settings', title: 'Settings', description: 'App configuration', icon: <Settings className="w-4 h-4" />, action: () => navigate('/settings'), keywords: ['settings', 'config', 'preferences'], category: 'Settings' },
        { id: 'set-theme', title: 'Change Theme', description: 'Switch app theme & dark mode', icon: <Moon className="w-4 h-4" />, action: () => navigate('/settings'), keywords: ['theme', 'dark', 'light', 'color', 'mode', 'theem'], category: 'Settings' },
        { id: 'set-logout', title: 'Log Out', description: 'Sign out of your account', icon: <LogOut className="w-4 h-4" />, action: () => { logout(); navigate('/login'); }, keywords: ['logout', 'sign out', 'exit', 'quit'], category: 'Settings', danger: true },
    ], [navigate, logout]);

    // ── Employee quick-search commands ────────────────────────────────────
    const employeeCommands: CommandItem[] = useMemo(() => {
        if (!search || search.length < 2) return [];
        const q = search.toLowerCase();
        return employees
            .filter(e =>
                e.name.toLowerCase().includes(q) ||
                e.code.toLowerCase().includes(q) ||
                e.designation?.toLowerCase().includes(q)
            )
            .slice(0, 5)
            .map(e => ({
                id: `emp-${e.id}`,
                title: e.name,
                description: `${e.designation} · ${e.department} · ${e.code}`,
                icon: (
                    <img
                        src={e.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${e.name}`}
                        className="w-6 h-6 rounded-full border border-dark-border"
                        alt={e.name}
                    />
                ),
                action: () => navigate(`/employees/${e.id}`),
                keywords: [e.name, e.code, e.designation || '', e.department],
                category: 'Employee' as CategoryType,
            }));
    }, [search, employees, navigate]);

    // ── All filtered commands ─────────────────────────────────────────────
    const allCommands = useMemo(() => {
        const all = [...employeeCommands, ...staticCommands];
        if (!search) return all;
        const q = search.toLowerCase();
        return all.filter(cmd =>
            cmd.title.toLowerCase().includes(q) ||
            cmd.description?.toLowerCase().includes(q) ||
            cmd.keywords.some(k => k.toLowerCase().includes(q))
        );
    }, [search, staticCommands, employeeCommands]);

    // ── Group by category ─────────────────────────────────────────────────
    const grouped = useMemo(() => {
        const map = new Map<CategoryType, CommandItem[]>();
        for (const cmd of allCommands) {
            if (!map.has(cmd.category)) map.set(cmd.category, []);
            map.get(cmd.category)!.push(cmd);
        }
        // Sort by CATEGORY_ORDER
        const sorted: Array<{ category: CategoryType; items: CommandItem[] }> = [];
        for (const cat of CATEGORY_ORDER) {
            if (map.has(cat)) sorted.push({ category: cat, items: map.get(cat)! });
        }
        return sorted;
    }, [allCommands]);

    // Flat list for keyboard nav
    const flatList = useMemo(() => allCommands, [allCommands]);

    // ── Keyboard navigation ───────────────────────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                isOpen ? close() : open();
                return;
            }
            if (!isOpen) return;

            if (e.key === 'Escape') { close(); return; }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIdx(i => Math.min(i + 1, flatList.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIdx(i => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (flatList[selectedIdx]) {
                    flatList[selectedIdx].action();
                    close();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, flatList, selectedIdx, close, open]);

    // Auto-scroll selected item into view
    useEffect(() => {
        const el = listRef.current?.querySelector(`[data-idx="${selectedIdx}"]`) as HTMLElement;
        el?.scrollIntoView({ block: 'nearest' });
    }, [selectedIdx]);

    // Reset selected when search changes
    useEffect(() => { setSelectedIdx(0); }, [search]);

    // ── Quick actions strip (shown when search is empty) ──────────────────
    const quickActions: CommandItem[] = useMemo(() => [
        staticCommands.find(c => c.id === 'act-add-emp')!,
        staticCommands.find(c => c.id === 'nav-payroll')!,
        staticCommands.find(c => c.id === 'act-attendance')!,
        staticCommands.find(c => c.id === 'rep-builder')!,
    ].filter(Boolean), [staticCommands]);

    if (!isOpen) return null;

    // Track global index for keyboard nav across groups
    let globalIdx = 0;

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-start justify-center pt-[15vh] p-4"
            onClick={close}
        >
            <div
                className="w-full max-w-2xl rounded-2xl border border-dark-border bg-dark-card shadow-2xl shadow-black/50 animate-in zoom-in-95 fade-in duration-150 overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* ── Search Input ──────────────────────────────────── */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-dark-border bg-dark-bg/50">
                    <Search className="w-5 h-5 text-primary-400 shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search commands, employees, pages…"
                        className="flex-1 bg-transparent text-dark-text placeholder-dark-muted outline-none text-base"
                        autoFocus
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="text-dark-muted hover:text-dark-text transition-colors p-1 rounded">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                    <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 bg-dark-bg border border-dark-border rounded text-xs text-dark-muted">
                        Esc
                    </kbd>
                </div>

                {/* ── Quick Actions (when no search) ────────────────── */}
                {!search && (
                    <div className="px-3 py-2.5 border-b border-dark-border/50 flex gap-2 overflow-x-auto">
                        {quickActions.map(cmd => (
                            <button
                                key={cmd.id}
                                onClick={() => { cmd.action(); close(); }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-dark-bg hover:bg-primary-500/10 hover:border-primary-500/50 border border-dark-border rounded-lg text-xs text-dark-text transition-all whitespace-nowrap shrink-0"
                            >
                                <span className="text-primary-400">{cmd.icon}</span>
                                {cmd.title}
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Results ───────────────────────────────────────── */}
                <div ref={listRef} className="max-h-[400px] overflow-y-auto py-2 scroll-smooth">
                    {flatList.length === 0 ? (
                        <div className="flex flex-col items-center py-12 text-dark-muted gap-3">
                            <AlertCircle className="w-8 h-8 opacity-30" />
                            <div className="text-sm">No results for <span className="text-dark-text font-medium">"{search}"</span></div>
                            <p className="text-xs opacity-60">Try: employees, payroll, attendance, settings…</p>
                        </div>
                    ) : (
                        grouped.map(({ category, items }) => (
                            <div key={category}>
                                {/* Category header */}
                                <div className={clsx("px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest", CATEGORY_CONFIG[category].color)}>
                                    {CATEGORY_CONFIG[category].label}
                                </div>

                                {/* Items */}
                                {items.map(cmd => {
                                    const idx = globalIdx++;
                                    const isSelected = selectedIdx === idx;
                                    return (
                                        <button
                                            key={cmd.id}
                                            data-idx={idx}
                                            onClick={() => { cmd.action(); close(); }}
                                            onMouseEnter={() => setSelectedIdx(idx)}
                                            className={clsx(
                                                "w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors group",
                                                isSelected
                                                    ? "bg-primary-500/15 border-l-2 border-l-primary-500"
                                                    : "border-l-2 border-l-transparent hover:bg-white/3"
                                            )}
                                        >
                                            {/* Icon */}
                                            <span className={clsx(
                                                "shrink-0 transition-colors",
                                                isSelected ? "text-primary-400" : "text-dark-muted"
                                            )}>
                                                {cmd.icon}
                                            </span>

                                            {/* Text */}
                                            <div className="flex-1 min-w-0">
                                                <div className={clsx(
                                                    "text-sm font-medium truncate",
                                                    cmd.danger ? "text-danger" : (isSelected ? "text-dark-text" : "text-dark-text")
                                                )}>
                                                    {cmd.title}
                                                </div>
                                                {cmd.description && (
                                                    <div className="text-xs text-dark-muted truncate">{cmd.description}</div>
                                                )}
                                            </div>

                                            {/* Enter hint */}
                                            {isSelected && (
                                                <span className="text-xs text-dark-muted flex items-center gap-1 shrink-0">
                                                    <kbd className="px-1.5 py-0.5 bg-dark-bg border border-dark-border rounded text-[10px]">↵</kbd>
                                                </span>
                                            )}

                                            {/* Arrow */}
                                            {!isSelected && (
                                                <ChevronRight className="w-3.5 h-3.5 text-dark-muted opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>

                {/* ── Footer ───────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-dark-border bg-dark-bg/30 text-[11px] text-dark-muted">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-dark-bg border border-dark-border rounded font-mono">↑↓</kbd>
                            Navigate
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-dark-bg border border-dark-border rounded font-mono">↵</kbd>
                            Select
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-dark-bg border border-dark-border rounded font-mono">Esc</kbd>
                            Close
                        </span>
                    </div>
                    <span className="flex items-center gap-1 text-dark-muted/60">
                        <Command className="w-3 h-3" />K &nbsp;·&nbsp; {flatList.length} commands
                    </span>
                </div>
            </div>
        </div>
    );
};
