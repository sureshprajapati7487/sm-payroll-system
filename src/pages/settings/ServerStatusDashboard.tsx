import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Server, Database, Wifi, WifiOff, RefreshCw, AlertTriangle,
    CheckCircle2, XCircle, Clock, Activity, Globe, Layers,
    ChevronDown, ChevronUp, Zap, ArrowRight, HelpCircle,
    Wrench, AlertCircle, Info, Terminal
} from 'lucide-react';

const API_BASE = 'http://localhost:3000';

// ─── Types ────────────────────────────────────────────────────────────────────
interface EndpointStatus {
    method: string;
    path: string;
    description: string;
    group: string;
    status: 'ok' | 'error' | 'unknown';
    error?: string | null;
    why?: string | null;
    fix?: string | null;
}

interface DatabaseInfo {
    status: 'connected' | 'error';
    error: string | null;
    why?: string | null;
    fix?: string | null;
    engine: string;
    file: string;
}

interface ErrorEntry {
    id: number;
    timestamp: string;
    endpoint: string;
    errorType: string;
    message: string;
    why: string;
    fix: string;
    stack?: string | null;
}

interface HealthData {
    server: 'online' | 'offline';
    uptime: string;
    uptimeSeconds: number;
    startedAt: string;
    checkedAt: string;
    database: DatabaseInfo;
    endpoints: EndpointStatus[];
    recentErrors: ErrorEntry[];
    totalErrors: number;
}

interface TableHealth { name: string; icon: string; count: number; status: 'ok' | 'error'; error?: string; lastUpdated?: string | null; }
interface EnvCheck { key: string; label: string; critical: boolean; set: boolean; value: string; }
interface FsCheck { label: string; icon: string; exists: boolean; size?: number | null; isDir?: boolean; error?: string; backupCount?: number; latestBackup?: string | null; path?: string; }
interface ErrorAnalytics { total: number; byType: { type: string; count: number }[]; byPage: { page: string; count: number }[]; recentErrors: ErrorEntry[]; }
interface RuntimeInfo { nodeVersion: string; platform: string; uptime: number; startedAt: string; memory: { heapUsed: string; heapTotal: string; rss: string }; pid: number; dbEngine: string; }
interface DiagItem { category: string; name: string; status: 'ok' | 'warning' | 'critical' | 'error'; detail: string; fix: string | null; }
interface DeepHealth {
    tables: TableHealth[];
    env: EnvCheck[];
    filesystem: FsCheck[];
    backup: { enabled: boolean; times: string[]; emailEnabled: boolean; emailTo: string | null; whatsappEnabled: boolean; status: any; error?: string };
    errorAnalytics: ErrorAnalytics;
    runtime: RuntimeInfo;
    diagnostics?: DiagItem[];
    diagnosticSummary?: { critical: number; warning: number; ok: number; total: number };
    checkedAt: string;
}

// ─── Frontend Routes (from App.tsx) ───────────────────────────────────────────
const FRONTEND_ROUTES = [
    { path: '/', component: 'LoginPage', group: 'Public', description: 'Login / Landing' },
    { path: '/login', component: 'LoginPage', group: 'Public', description: 'Login Page' },
    { path: '/company-setup', component: 'CompanySetup', group: 'Public', description: 'Initial Company Setup' },
    { path: '/quick-action', component: 'QuickActionPage', group: 'Public', description: 'Quick Actions' },
    { path: '/dashboard', component: 'Dashboard', group: 'Core', description: 'Main Dashboard' },
    { path: '/employees', component: 'EmployeeList', group: 'Employees', description: 'Employee List' },
    { path: '/employees/new', component: 'EmployeeForm', group: 'Employees', description: 'Add Employee' },
    { path: '/employees/:id', component: 'EmployeeProfile', group: 'Employees', description: 'Employee Profile' },
    { path: '/employees/:id/edit', component: 'EmployeeForm', group: 'Employees', description: 'Edit Employee' },
    { path: '/attendance', component: 'AttendanceDashboard', group: 'Attendance', description: 'Attendance Dashboard' },
    { path: '/attendance/holidays', component: 'HolidayManager', group: 'Attendance', description: 'Holiday Manager' },
    { path: '/production', component: 'ProductionDashboard', group: 'Production', description: 'Production Dashboard' },
    { path: '/leaves', component: 'LeaveDashboard', group: 'Leaves', description: 'Leave Dashboard' },
    { path: '/loans', component: 'LoanDashboard', group: 'Loans', description: 'Loan Dashboard' },
    { path: '/approvals', component: 'ApprovalCenter', group: 'Approvals', description: 'Approval Center' },
    { path: '/payroll', component: 'PayrollDashboard', group: 'Payroll', description: 'Payroll Dashboard' },
    { path: '/payroll/history', component: 'PayrollHistory', group: 'Payroll', description: 'Payroll History' },
    { path: '/payroll/simulation', component: 'PayrollSimulation', group: 'Payroll', description: 'Payroll Simulation' },
    { path: '/payroll/slip/:id', component: 'PayslipView', group: 'Payroll', description: 'Payslip View' },
    { path: '/expenses', component: 'ExpensesDashboard', group: 'Finance', description: 'Expenses Dashboard' },
    { path: '/calculators/ctc', component: 'CTCCalculator', group: 'Calculators', description: 'CTC Calculator' },
    { path: '/calculators/tds', component: 'TDSCalculator', group: 'Calculators', description: 'TDS Calculator' },
    { path: '/calculators/pfesi', component: 'PFESICalculator', group: 'Calculators', description: 'PF/ESI Calculator' },
    { path: '/admin/bulk-import', component: 'BulkImport', group: 'Admin', description: 'Bulk Import Tool' },
    { path: '/admin/audit-logs', component: 'AuditLogs', group: 'Admin', description: 'Audit Logs' },
    { path: '/admin/trash', component: 'TrashManagement', group: 'Admin', description: 'Trash Management' },
    { path: '/admin/drafts', component: 'DraftManager', group: 'Admin', description: 'Draft Manager' },
    { path: '/admin/consistency', component: 'DataConsistencyChecker', group: 'Admin', description: 'Data Consistency' },
    { path: '/admin/seed', component: 'DataSeeding', group: 'Admin', description: 'Data Seeding' },
    { path: '/reports/builder', component: 'ReportBuilder', group: 'Reports', description: 'Report Builder' },
    { path: '/reports/custom', component: 'CustomReportBuilder', group: 'Reports', description: 'Custom Reports' },
    { path: '/reports/scheduled', component: 'ScheduledReports', group: 'Reports', description: 'Scheduled Reports' },
    { path: '/finance/dashboard', component: 'FinanceDashboard', group: 'Finance', description: 'Finance Dashboard' },
    { path: '/finance/department', component: 'DepartmentFinanceReport', group: 'Finance', description: 'Dept Finance Report' },
    { path: '/finance/cost-centers', component: 'CostCenterMapping', group: 'Finance', description: 'Cost Center Mapping' },
    { path: '/finance/advance-salary', component: 'AdvanceSalaryManagement', group: 'Finance', description: 'Advance Salary' },
    { path: '/statutory/form16', component: 'Form16Generator', group: 'Statutory', description: 'Form 16 Generator' },
    { path: '/statutory/reports', component: 'StatutoryReports', group: 'Statutory', description: 'Statutory Reports' },
    { path: '/settings', component: 'GeneralSettings', group: 'Settings', description: 'System Settings' },
    { path: '/settings/security', component: 'SecuritySettings', group: 'Settings', description: 'Security Settings' },
    { path: '/settings/profile', component: 'UserProfile', group: 'Settings', description: 'User Profile' },
    { path: '/settings/theme', component: 'ThemeCustomizer', group: 'Settings', description: 'Theme Customizer' },
    { path: '/settings/server-status', component: 'ServerStatusDashboard', group: 'Settings', description: 'Server Status' },
    { path: '/configuration', component: 'ConfigurationPage', group: 'Settings', description: 'Configuration' },
    { path: '/security/alerts', component: 'SecurityAlerts', group: 'Security', description: 'Security Alerts' },
    { path: '/company/switcher', component: 'CompanySwitcher', group: 'Company', description: 'Company Switcher' },
    { path: '/mobile/checkin', component: 'QuickCheckIn', group: 'Mobile', description: 'Quick Check-In' },
    { path: '/help', component: 'HelpCenter', group: 'Support', description: 'Help Center' },
];

// ─── Method Badge ─────────────────────────────────────────────────────────────
const MethodBadge = ({ method }: { method: string }) => {
    const colors: Record<string, string> = {
        GET: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
        POST: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
        PUT: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
        DELETE: 'bg-red-500/20 text-red-400 border-red-500/40',
    };
    return (
        <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-bold border font-mono ${colors[method] || 'bg-slate-500/20 text-slate-400'}`}>
            {method}
        </span>
    );
};

// ─── Status Dot ───────────────────────────────────────────────────────────────
const StatusDot = ({ status }: { status: 'ok' | 'error' | 'unknown' | 'connected' | 'offline' }) => {
    if (status === 'ok' || status === 'connected') {
        return (
            <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
        );
    }
    if (status === 'error' || status === 'offline') {
        return <span className="inline-flex rounded-full h-3 w-3 bg-red-500 shrink-0 animate-pulse" />;
    }
    return <span className="inline-flex rounded-full h-3 w-3 bg-amber-400 opacity-80 shrink-0" />;
};

// ─── Detailed Error Card ──────────────────────────────────────────────────────
const ErrorCard = ({ error }: { error: ErrorEntry }) => {
    const [open, setOpen] = useState(false);
    const time = new Date(error.timestamp).toLocaleTimeString('en-IN');
    const date = new Date(error.timestamp).toLocaleDateString('en-IN');

    return (
        <div className="border border-red-500/30 rounded-xl overflow-hidden bg-red-500/5">
            {/* Header */}
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-start gap-3 p-4 hover:bg-red-500/10 transition-colors text-left"
            >
                <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-bold bg-red-500/20 text-red-300 px-2 py-0.5 rounded font-mono">
                            {error.errorType}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">{error.endpoint}</span>
                        <span className="text-xs text-slate-600 ml-auto">{date} · {time}</span>
                    </div>
                    <p className="text-sm text-red-200 truncate font-mono">{error.message}</p>
                </div>
                {open ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
            </button>

            {/* Expanded details */}
            {open && (
                <div className="border-t border-red-500/20 divide-y divide-red-500/10">
                    {/* WHY */}
                    <div className="flex items-start gap-3 p-4">
                        <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">⚠ Kyu Hua (Why)?</p>
                            <p className="text-sm text-slate-300">{error.why}</p>
                        </div>
                    </div>
                    {/* HOW TO FIX */}
                    <div className="flex items-start gap-3 p-4">
                        <Wrench className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">✅ Kese Sahi Karein (How to Fix)?</p>
                            <p className="text-sm text-slate-300">{error.fix}</p>
                        </div>
                    </div>
                    {/* Stack trace */}
                    {error.stack && (
                        <div className="p-4">
                            <p className="text-xs text-slate-600 mb-1 flex items-center gap-1">
                                <Terminal className="w-3 h-3" /> Stack Trace
                            </p>
                            <pre className="text-xs text-slate-500 font-mono whitespace-pre-wrap break-all bg-dark-elem/50 p-3 rounded leading-relaxed">
                                {error.stack}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Endpoint Row ─────────────────────────────────────────────────────────────
const EndpointRow = ({ ep }: { ep: EndpointStatus }) => {
    const [open, setOpen] = useState(false);
    const hasDetails = ep.status === 'error' && (ep.why || ep.fix);

    return (
        <div className={`border-b border-dark-border/40 ${ep.status === 'error' ? 'bg-red-500/5' : ''}`}>
            <div
                className={`flex items-center gap-3 px-4 py-3 hover:bg-dark-elem/20 transition-colors ${hasDetails ? 'cursor-pointer' : ''}`}
                onClick={() => hasDetails && setOpen(o => !o)}
            >
                <MethodBadge method={ep.method} />
                <code className="text-sm text-slate-200 font-mono flex-1 min-w-0 truncate">{ep.path}</code>
                <p className="text-xs text-slate-500 hidden md:block flex-1 truncate">{ep.description}</p>
                <div className="flex items-center gap-2 shrink-0">
                    {ep.status === 'ok' && (
                        <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" /> OK
                        </span>
                    )}
                    {ep.status === 'error' && (
                        <span className="flex items-center gap-1.5 text-xs text-red-400">
                            <XCircle className="w-4 h-4" /> Error
                            {hasDetails && (open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                        </span>
                    )}
                    {ep.status === 'unknown' && (
                        <span className="flex items-center gap-1.5 text-xs text-amber-400">
                            <Info className="w-4 h-4" /> Checking
                        </span>
                    )}
                </div>
            </div>
            {/* Expanded why+fix for errored endpoint */}
            {open && ep.status === 'error' && (
                <div className="mx-4 mb-3 rounded-lg border border-red-500/30 bg-red-500/5 overflow-hidden divide-y divide-red-500/20">
                    <div className="flex items-start gap-3 p-3 text-sm">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-mono text-red-300 mb-1">{ep.error}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-3">
                        <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-semibold text-amber-400 mb-1">Kyu Hua?</p>
                            <p className="text-sm text-slate-300">{ep.why}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-3">
                        <Wrench className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-semibold text-emerald-400 mb-1">Kese Sahi Karein?</p>
                            <p className="text-sm text-slate-300">{ep.fix}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const ServerStatusDashboard = () => {
    const [health, setHealth] = useState<HealthData | null>(null);
    const [loading, setLoading] = useState(true);
    const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
    const [lastChecked, setLastChecked] = useState<string>('Never');
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [activeSection, setActiveSection] = useState<'endpoints' | 'errors' | 'routes' | 'deep'>('endpoints');
    const [clearing, setClearing] = useState(false);
    const [deepHealth, setDeepHealth] = useState<DeepHealth | null>(null);
    const [deepLoading, setDeepLoading] = useState(false);
    const [deepError, setDeepError] = useState<string | null>(null);

    const fetchDeepHealth = useCallback(async () => {
        setDeepLoading(true);
        setDeepError(null);
        try {
            const res = await fetch(`${API_BASE}/api/health/deep`, { signal: AbortSignal.timeout(15000) });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: DeepHealth = await res.json();
            setDeepHealth(data);
        } catch (e: any) {
            setDeepError(e.message || 'Deep scan failed');
        } finally {
            setDeepLoading(false);
        }
    }, []);

    const clearErrors = async () => {
        setClearing(true);
        try {
            await fetch(`${API_BASE}/api/health/errors`, { method: 'DELETE' });
            await fetchHealth();
        } catch { }
        finally { setClearing(false); }
    };

    const intervalRef = useRef<number | null>(null);

    const fetchHealth = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(5000) });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: HealthData = await res.json();
            setHealth(data);
            setBackendOnline(true);
        } catch {
            setBackendOnline(false);
            setHealth(null);
        } finally {
            setLoading(false);
            setLastChecked(new Date().toLocaleTimeString('en-IN'));
        }
    }, []);

    useEffect(() => { fetchHealth(); }, [fetchHealth]);

    useEffect(() => {
        if (autoRefresh) {
            intervalRef.current = window.setInterval(fetchHealth, 10000);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [autoRefresh, fetchHealth]);

    const endpointGroups = (health?.endpoints ?? []).reduce((acc, ep) => {
        if (!acc[ep.group]) acc[ep.group] = [];
        acc[ep.group].push(ep);
        return acc;
    }, {} as Record<string, EndpointStatus[]>);

    const routeGroups = FRONTEND_ROUTES.reduce((acc, r) => {
        if (!acc[r.group]) acc[r.group] = [];
        acc[r.group].push(r);
        return acc;
    }, {} as Record<string, typeof FRONTEND_ROUTES>);

    const okCount = health?.endpoints?.filter(e => e.status === 'ok').length ?? 0;
    const errCount = health?.endpoints?.filter(e => e.status === 'error').length ?? 0;
    const totalErrors = health?.totalErrors ?? 0;

    return (
        <div className="space-y-4">

            {/* ── Header ── */}
            <div className="flex items-center justify-between mb-3 shrink-0">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${backendOnline ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
                        <Server className={`w-5 h-5 ${backendOnline ? 'text-emerald-400' : 'text-red-400'}`} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-white">Server Status</h2>
                        <p className="text-xs text-slate-500">{lastChecked !== 'Never' ? `Last checked ${lastChecked}` : 'Checking...'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setAutoRefresh(a => !a)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${autoRefresh ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-dark-card border-dark-border text-slate-400'}`}
                    >
                        {autoRefresh ? '⚡ Auto ON' : '⏸ Auto OFF'}
                    </button>
                    <button
                        onClick={fetchHealth}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500/15 border border-primary-500/30 text-primary-400 rounded-lg text-xs font-medium hover:bg-primary-500/25 transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* ── Status Cards ── */}
            <div className="grid grid-cols-4 gap-3 mb-3 shrink-0">
                {/* Backend */}
                <div className={`rounded-xl p-3 border ${backendOnline ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-red-500/10 border-red-500/25'}`}>
                    <div className="flex items-center justify-between mb-1">
                        {backendOnline ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
                        <StatusDot status={backendOnline ? 'ok' : 'offline'} />
                    </div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Backend</p>
                    <p className={`text-sm font-bold ${backendOnline ? 'text-emerald-400' : 'text-red-400'}`}>
                        {backendOnline === null ? 'Checking...' : backendOnline ? 'Online' : 'Offline'}
                    </p>
                    <p className="text-xs text-slate-600">:3000</p>
                </div>

                {/* Database */}
                <div className={`rounded-xl p-3 border ${health?.database.status === 'connected' ? 'bg-blue-500/10 border-blue-500/25' : 'bg-red-500/10 border-red-500/25'}`}>
                    <div className="flex items-center justify-between mb-1">
                        <Database className={`w-4 h-4 ${health?.database.status === 'connected' ? 'text-blue-400' : 'text-red-400'}`} />
                        <StatusDot status={health?.database.status === 'connected' ? 'connected' : backendOnline === false ? 'offline' : 'unknown'} />
                    </div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Database</p>
                    <p className={`text-sm font-bold ${health?.database.status === 'connected' ? 'text-blue-400' : 'text-slate-500'}`}>
                        {health ? (health.database.status === 'connected' ? 'Connected' : 'Error') : '—'}
                    </p>
                    <p className="text-xs text-slate-600">{health?.database.engine ?? 'SQLite'}</p>
                </div>

                {/* Uptime */}
                <div className="rounded-xl p-3 border bg-purple-500/10 border-purple-500/25">
                    <div className="flex items-center justify-between mb-1">
                        <Clock className="w-4 h-4 text-purple-400" />
                        <Activity className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                    </div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Uptime</p>
                    <p className="text-sm font-bold text-purple-400">{health?.uptime ?? '—'}</p>
                    <p className="text-xs text-slate-600">
                        {health ? `Since ${new Date(health.startedAt).toLocaleTimeString('en-IN')}` : 'Not running'}
                    </p>
                </div>

                {/* API Health */}
                <div className={`rounded-xl p-3 border ${errCount > 0 ? 'bg-red-500/10 border-red-500/25' : totalErrors > 0 ? 'bg-amber-500/10 border-amber-500/25' : 'bg-emerald-500/10 border-emerald-500/25'}`}>
                    <div className="flex items-center justify-between mb-1">
                        <Zap className={`w-4 h-4 ${errCount > 0 ? 'text-red-400' : totalErrors > 0 ? 'text-amber-400' : 'text-emerald-400'}`} />
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${errCount > 0 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                            {health ? `${okCount}/${health.endpoints?.length ?? 0}` : '—'}
                        </span>
                    </div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">API Health</p>
                    <p className={`text-sm font-bold ${errCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {errCount > 0 ? `${errCount} Error${errCount > 1 ? 's' : ''}` : health ? 'All OK' : '—'}
                    </p>
                    <p className="text-xs text-slate-600">{totalErrors} total logged errors</p>
                </div>
            </div>

            {/* ── Backend Offline Banner ── */}
            {backendOnline === false && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <AlertTriangle className="w-6 h-6 text-red-400" />
                        <div>
                            <p className="font-bold text-red-300 text-lg">Backend Server Band Hai</p>
                            <p className="text-sm text-slate-400">http://localhost:3000 pe koi response nahi aa raha</p>
                        </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                            <p className="text-xs font-bold text-amber-400 mb-1 flex items-center gap-1"><HelpCircle className="w-3.5 h-3.5" /> Kyu Hua?</p>
                            <p className="text-sm text-slate-300">Backend server start nahi hua hai, ya crash ho gaya, ya port 3000 use mein hai kisi aur process se.</p>
                        </div>
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                            <p className="text-xs font-bold text-emerald-400 mb-1 flex items-center gap-1"><Wrench className="w-3.5 h-3.5" /> Kese Sahi Karein?</p>
                            <p className="text-sm text-slate-300">Terminal kholein aur yeh run karein:</p>
                            <code className="block mt-1 text-xs text-emerald-300 font-mono bg-dark-elem/60 rounded px-2 py-1">cd server &amp;&amp; npm start</code>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Section Tabs ── */}
            <div className="flex flex-wrap gap-2 border-b border-dark-border pb-2">
                {(['endpoints', 'errors', 'routes', 'deep'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => {
                            setActiveSection(tab);
                            if (tab === 'deep' && !deepHealth && !deepLoading) fetchDeepHealth();
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${activeSection === tab ? 'bg-primary-500/20 border border-primary-500/40 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        {tab === 'endpoints' && <><Globe className="w-3.5 h-3.5" /> API Endpoints</>}
                        {tab === 'errors' && (
                            <>
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Live Errors
                                {totalErrors > 0 && <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{totalErrors}</span>}
                            </>
                        )}
                        {tab === 'routes' && <><Layers className="w-3.5 h-3.5" /> Frontend Routes</>}
                        {tab === 'deep' && <><Activity className="w-3.5 h-3.5 text-amber-400" /><span className="text-amber-400 font-bold">🔍 Deep Scan</span></>}
                    </button>
                ))}
            </div>

            {/* ── Content Area ── */}
            <div className="mt-4 space-y-4">

                {/* ── API Endpoints Section ── */}
                {activeSection === 'endpoints' && (
                    <div className="bg-dark-card rounded-xl border border-dark-border overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-dark-border">
                            <span className="text-sm font-semibold text-white flex items-center gap-2">
                                <Globe className="w-4 h-4 text-primary-400" />
                                Backend API Endpoints
                            </span>
                            <span className="text-xs text-slate-500">http://localhost:3000</span>
                        </div>
                        {!backendOnline ? (
                            <div className="p-8 text-center text-slate-500">
                                <WifiOff className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                <p>Backend offline — can't check endpoints</p>
                            </div>
                        ) : (
                            Object.entries(endpointGroups).map(([group, eps]) => (
                                <div key={group}>
                                    <div className="flex items-center gap-2 px-4 py-2 bg-dark-elem/40">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{group}</span>
                                        {eps.some(e => e.status === 'error') && (
                                            <span className="text-xs text-red-400 flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3" /> Error
                                            </span>
                                        )}
                                    </div>
                                    {eps.map((ep, i) => <EndpointRow key={i} ep={ep} />)}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* ── Live Errors Section ── */}
                {activeSection === 'errors' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-slate-400">
                                {totalErrors === 0 ? '✅ Koi error nahi — sab theek chal raha hai!' : `${totalErrors} error(s) recorded — Click karein details dekhne ke liye:`}
                            </p>
                            <div className="flex items-center gap-2">
                                {totalErrors > 0 && (
                                    <>
                                        <span className="text-xs text-slate-600">Last 20 shown</span>
                                        <button
                                            onClick={clearErrors}
                                            disabled={clearing}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 border border-red-500/30 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/25 transition-all disabled:opacity-50"
                                        >
                                            {clearing ? '🗑️ Clearing...' : '🗑️ Clear All Errors'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {!backendOnline ? (
                            <div className="bg-dark-card border border-dark-border rounded-xl p-8 text-center text-slate-500 text-sm">
                                Backend offline — error log unavailable
                            </div>
                        ) : (health?.recentErrors?.length ?? 0) === 0 ? (
                            <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-8 text-center">
                                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3 opacity-60" />
                                <p className="text-emerald-400 font-semibold">Koi Error Nahi!</p>
                                <p className="text-slate-500 text-sm mt-1">Backend bilkul clean chal raha hai 🎉</p>
                            </div>
                        ) : (
                            health!.recentErrors.map(err => <ErrorCard key={err.id} error={err} />)
                        )}
                    </div>
                )}

                {/* ── Frontend Routes Section ── */}
                {activeSection === 'routes' && (
                    <div className="space-y-3">
                        <p className="text-sm text-slate-500">{FRONTEND_ROUTES.length} React Router routes · group karein dekhne ke liye click karein ↓</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {Object.entries(routeGroups).map(([group, routes]) => (
                                <div key={group} className="border border-dark-border rounded-xl overflow-hidden">
                                    <button
                                        onClick={() => setExpandedGroup(expandedGroup === group ? null : group)}
                                        className="w-full flex items-center justify-between px-4 py-3 bg-dark-elem/40 hover:bg-dark-elem transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-slate-200">{group}</span>
                                            <span className="text-xs bg-primary-500/20 text-primary-400 px-1.5 py-0.5 rounded-full">{routes.length}</span>
                                        </div>
                                        {expandedGroup === group
                                            ? <ChevronUp className="w-4 h-4 text-slate-500" />
                                            : <ChevronDown className="w-4 h-4 text-slate-500" />
                                        }
                                    </button>
                                    {expandedGroup === group && (
                                        <div className="divide-y divide-dark-border/30">
                                            {routes.map((r, i) => (
                                                <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-dark-elem/20 transition-colors">
                                                    <StatusDot status="ok" />
                                                    <code className="text-xs text-emerald-300 font-mono flex-1 truncate">{r.path}</code>
                                                    <div className="flex items-center gap-2 text-right">
                                                        <ArrowRight className="w-3 h-3 text-slate-600" />
                                                        <span className="text-xs text-slate-500 font-mono bg-dark-elem px-1.5 py-0.5 rounded">{r.component}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>{/* end content area */}

            {/* ── Deep Scan Section ── */}
            {activeSection === 'deep' && (
                <div className="space-y-5">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-white">🔍 Deep System Scan</h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {deepHealth ? `Last scanned: ${new Date(deepHealth.checkedAt).toLocaleTimeString('en-IN')}` : 'Poora system check — database, env vars, files, errors sab'}
                            </p>
                        </div>
                        <button
                            onClick={fetchDeepHealth}
                            disabled={deepLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-lg text-xs font-medium hover:bg-amber-500/25 transition-all disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${deepLoading ? 'animate-spin' : ''}`} />
                            {deepLoading ? 'Scanning...' : 'Run Deep Scan'}
                        </button>
                    </div>

                    {deepError && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
                            <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-red-300">Deep Scan Failed</p>
                                <p className="text-xs text-slate-400 mt-0.5">{deepError} — Make sure backend is running on localhost:3000</p>
                            </div>
                        </div>
                    )}

                    {deepLoading && !deepHealth && (
                        <div className="grid grid-cols-3 gap-3">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="bg-dark-card border border-dark-border rounded-xl p-4 animate-pulse">
                                    <div className="h-3 bg-dark-elem rounded w-1/2 mb-2" />
                                    <div className="h-6 bg-dark-elem rounded w-3/4" />
                                </div>
                            ))}
                        </div>
                    )}

                    {deepHealth && (
                        <>
                            {/* ── Diagnostics Summary Bar ── */}
                            {deepHealth.diagnosticSummary && (
                                <>
                                    <div className="grid grid-cols-4 gap-3">
                                        {[
                                            { label: 'Total Checks', value: deepHealth.diagnosticSummary.total, color: 'text-slate-300', bg: 'bg-dark-elem/50 border-dark-border' },
                                            { label: 'Critical Issues', value: deepHealth.diagnosticSummary.critical, color: 'text-red-400', bg: deepHealth.diagnosticSummary.critical > 0 ? 'bg-red-500/15 border-red-500/30' : 'bg-dark-elem/50 border-dark-border' },
                                            { label: 'Warnings', value: deepHealth.diagnosticSummary.warning, color: 'text-amber-400', bg: deepHealth.diagnosticSummary.warning > 0 ? 'bg-amber-500/15 border-amber-500/30' : 'bg-dark-elem/50 border-dark-border' },
                                            { label: 'All Clear', value: deepHealth.diagnosticSummary.ok, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25' },
                                        ].map(item => (
                                            <div key={item.label} className={`rounded-xl p-3 border ${item.bg}`}>
                                                <p className="text-[10px] text-slate-500 uppercase">{item.label}</p>
                                                <p className={`text-3xl font-black mt-1 ${item.color}`}>{item.value}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Critical Alert Banner */}
                                    {deepHealth.diagnosticSummary.critical > 0 && (
                                        <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <XCircle className="w-5 h-5 text-red-400" />
                                                <p className="font-bold text-red-300 text-sm">🚨 {deepHealth.diagnosticSummary.critical} Critical Issue(s) — Immediate Action Required!</p>
                                            </div>
                                            <div className="space-y-1.5">
                                                {(deepHealth.diagnostics ?? []).filter(d => d.status === 'critical').map((d, i) => (
                                                    <div key={i} className="bg-red-500/10 rounded-lg px-3 py-2">
                                                        <p className="text-xs font-bold text-red-300">{d.name}: <span className="font-normal text-red-200">{d.detail}</span></p>
                                                        {d.fix && <p className="text-xs text-amber-300 mt-1">👉 Fix: {d.fix}</p>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* All Diagnostics Traffic Light Cards */}
                                    {(deepHealth.diagnostics ?? []).length > 0 && (
                                        <div className="bg-dark-card border border-dark-border rounded-xl p-4">
                                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                <Activity className="w-3.5 h-3.5 text-amber-400" /> Live System Diagnostics ({(deepHealth.diagnostics ?? []).length} Checks)
                                            </h4>
                                            <div className="space-y-2">
                                                {(['auth', 'setup', 'employees', 'database', 'schema', 'integrity', 'errors', 'backup'] as const).map(cat => {
                                                    const items = (deepHealth.diagnostics ?? []).filter(d => d.category === cat);
                                                    if (items.length === 0) return null;
                                                    const catLabels: Record<string, string> = {
                                                        auth: '🔐 Authentication',
                                                        setup: '🏢 Setup',
                                                        employees: '👷 Employees',
                                                        database: '🗄️ Database',
                                                        schema: '📐 Schema (Column Check)',
                                                        integrity: '🔗 Data Integrity',
                                                        errors: '🚨 Error Monitoring',
                                                        backup: '💾 Backup',
                                                    };
                                                    return (
                                                        <div key={cat}>
                                                            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5 mt-3">{catLabels[cat] || cat}</p>
                                                            <div className="space-y-1.5">
                                                                {items.map((d, i) => {
                                                                    const cfgMap: Record<string, { border: string; badge: string; icon: JSX.Element }> = {
                                                                        ok: { border: 'border-emerald-500/20 bg-emerald-500/5', badge: 'bg-emerald-500/20 text-emerald-400', icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> },
                                                                        warning: { border: 'border-amber-500/25 bg-amber-500/5', badge: 'bg-amber-500/20 text-amber-400', icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" /> },
                                                                        critical: { border: 'border-red-500/40 bg-red-500/10', badge: 'bg-red-500/20 text-red-400', icon: <XCircle className="w-4 h-4 text-red-400 shrink-0" /> },
                                                                        error: { border: 'border-red-500/30 bg-red-500/5', badge: 'bg-red-500/15 text-red-300', icon: <XCircle className="w-4 h-4 text-red-300 shrink-0" /> },
                                                                    };
                                                                    const cfg = cfgMap[d.status] ?? { border: 'border-dark-border bg-dark-elem/20', badge: 'bg-slate-500/20 text-slate-400', icon: <Info className="w-4 h-4 text-slate-400 shrink-0" /> };
                                                                    return (
                                                                        <div key={i} className={`rounded-lg border px-3 py-2.5 ${cfg.border}`}>
                                                                            <div className="flex items-start gap-2.5">
                                                                                {cfg.icon}
                                                                                <div className="flex-1 min-w-0">
                                                                                    <div className="flex items-center gap-2 mb-0.5">
                                                                                        <span className="text-xs font-semibold text-white">{d.name}</span>
                                                                                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${cfg.badge}`}>{d.status}</span>
                                                                                    </div>
                                                                                    <p className="text-xs text-slate-300 leading-relaxed">{d.detail}</p>
                                                                                    {d.fix && (
                                                                                        <div className="mt-1.5 flex items-start gap-1.5">
                                                                                            <Wrench className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                                                                                            <p className="text-xs text-amber-300">{d.fix}</p>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* ── Server Runtime ── */}
                            <div className="bg-dark-card border border-dark-border rounded-xl p-4">
                                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Terminal className="w-3.5 h-3.5" /> Server Runtime
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {[
                                        { label: 'Node.js', value: deepHealth.runtime.nodeVersion, icon: '🟢' },
                                        { label: 'Platform', value: deepHealth.runtime.platform, icon: '💻' },
                                        { label: 'DB Engine', value: deepHealth.runtime.dbEngine, icon: '🗄️' },
                                        { label: 'Heap Used', value: deepHealth.runtime.memory.heapUsed, icon: '🧠' },
                                        { label: 'Heap Total', value: deepHealth.runtime.memory.heapTotal, icon: '📦' },
                                        { label: 'RSS Memory', value: deepHealth.runtime.memory.rss, icon: '💾' },
                                        { label: 'Process ID', value: String(deepHealth.runtime.pid), icon: '🔢' },
                                        { label: 'Started At', value: new Date(deepHealth.runtime.startedAt).toLocaleTimeString('en-IN'), icon: '🕐' },
                                    ].map(item => (
                                        <div key={item.label} className="bg-dark-elem/40 rounded-lg px-3 py-2">
                                            <p className="text-[10px] text-slate-500 uppercase tracking-wide">{item.icon} {item.label}</p>
                                            <p className="text-sm font-mono font-semibold text-white mt-0.5">{item.value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ── Database Tables ── */}
                            <div className="bg-dark-card border border-dark-border rounded-xl p-4">
                                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Database className="w-3.5 h-3.5" /> Database Tables ({deepHealth.tables.filter(t => t.status === 'ok').length}/{deepHealth.tables.length} OK)
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {deepHealth.tables.map(t => (
                                        <div key={t.name} className={`rounded-lg px-3 py-2 border flex items-center justify-between ${t.status === 'ok' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/10 border-red-500/30'}`}>
                                            <div>
                                                <p className="text-xs text-slate-400">{t.icon} {t.name}</p>
                                                {t.status === 'ok'
                                                    ? <p className="text-sm font-bold text-white">{t.count.toLocaleString()} <span className="text-[10px] text-slate-500 font-normal">records</span></p>
                                                    : <p className="text-xs text-red-400 font-mono mt-0.5 truncate">{t.error}</p>
                                                }
                                            </div>
                                            <span className={`text-[10px] font-bold ${t.status === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{t.status === 'ok' ? '✓' : '✗'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ── Environment Variables ── */}
                            <div className="bg-dark-card border border-dark-border rounded-xl p-4">
                                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Zap className="w-3.5 h-3.5" /> Environment Variables & Config
                                </h4>
                                <div className="space-y-2">
                                    {deepHealth.env.map(e => (
                                        <div key={e.key} className={`flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg border ${e.critical && !e.set ? 'bg-red-500/10 border-red-500/30' : !e.set ? 'bg-amber-500/10 border-amber-500/20' : 'bg-dark-elem/30 border-dark-border/50'}`}>
                                            <div className="flex items-center gap-2">
                                                {e.critical && !e.set && <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                                                {!e.critical && !e.set && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                                                {e.set && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                                                <div>
                                                    <span className="text-xs font-mono font-bold text-slate-200">{e.key}</span>
                                                    {e.critical && <span className="ml-1.5 text-[9px] font-bold text-red-400 uppercase bg-red-500/20 px-1 py-0.5 rounded">Critical</span>}
                                                    <p className="text-xs text-slate-400 mt-0.5">{e.label}</p>
                                                </div>
                                            </div>
                                            <span className="text-xs text-right text-slate-400 shrink-0">{e.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ── File System ── */}
                            <div className="bg-dark-card border border-dark-border rounded-xl p-4">
                                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Layers className="w-3.5 h-3.5" /> File System
                                </h4>
                                <div className="space-y-2">
                                    {deepHealth.filesystem.map((f, i) => (
                                        <div key={i} className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${f.exists ? 'bg-dark-elem/30 border-dark-border/50' : 'bg-amber-500/10 border-amber-500/20'}`}>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm">{f.icon}</span>
                                                <div>
                                                    <p className="text-xs font-semibold text-slate-200">{f.label}</p>
                                                    {f.backupCount !== undefined && <p className="text-xs text-slate-500">{f.backupCount} backup files · Latest: {f.latestBackup || 'none'}</p>}
                                                    {f.size !== undefined && f.size !== null && !f.isDir && <p className="text-xs text-slate-500">{(f.size / 1024).toFixed(1)} KB</p>}
                                                </div>
                                            </div>
                                            <span className={`text-xs font-bold ${f.exists ? 'text-emerald-400' : 'text-amber-400'}`}>{f.exists ? '✓ Exists' : '⚠ Missing'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ── Backup Config ── */}
                            <div className="bg-dark-card border border-dark-border rounded-xl p-4">
                                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Clock className="w-3.5 h-3.5" /> Backup Configuration
                                </h4>
                                {deepHealth.backup.error ? (
                                    <p className="text-xs text-red-400">{deepHealth.backup.error}</p>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {[
                                            { label: 'Backup Enabled', value: deepHealth.backup.enabled ? '✅ Yes' : '❌ No', ok: deepHealth.backup.enabled },
                                            { label: 'Scheduled Times', value: deepHealth.backup.times.length > 0 ? deepHealth.backup.times.join(', ') : 'None', ok: deepHealth.backup.times.length > 0 },
                                            { label: 'Email Delivery', value: deepHealth.backup.emailEnabled ? `✅ ${deepHealth.backup.emailTo || 'Enabled'}` : '⚠️ Disabled', ok: deepHealth.backup.emailEnabled },
                                            { label: 'WhatsApp Delivery', value: deepHealth.backup.whatsappEnabled ? '✅ Enabled' : '⚠️ Disabled', ok: deepHealth.backup.whatsappEnabled },
                                            { label: 'Last Backup', value: deepHealth.backup.status?.lastBackup ? new Date(deepHealth.backup.status.lastBackup).toLocaleString('en-IN') : 'Never', ok: !!deepHealth.backup.status?.lastBackup },
                                            { label: 'Total Backups', value: String(deepHealth.backup.status?.totalBackups ?? 0), ok: (deepHealth.backup.status?.totalBackups ?? 0) > 0 },
                                        ].map(item => (
                                            <div key={item.label} className={`rounded-lg px-3 py-2 border ${item.ok ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                                                <p className="text-[10px] text-slate-500 uppercase">{item.label}</p>
                                                <p className="text-xs font-semibold text-slate-200 mt-0.5">{item.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ── Error Analytics ── */}
                            {deepHealth.errorAnalytics.total > 0 && (
                                <div className="bg-dark-card border border-dark-border rounded-xl p-4">
                                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> Error Analytics ({deepHealth.errorAnalytics.total} total)
                                    </h4>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-[10px] text-slate-500 uppercase mb-2">By Error Type</p>
                                            <div className="space-y-1.5">
                                                {deepHealth.errorAnalytics.byType.map(t => (
                                                    <div key={t.type} className="flex items-center gap-2">
                                                        <span className="text-xs font-mono text-red-300 flex-1 truncate">{t.type}</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="h-1.5 bg-red-500/40 rounded-full" style={{ width: `${Math.min((t.count / deepHealth.errorAnalytics.total) * 100, 100) * 0.6}px` }} />
                                                            <span className="text-xs font-bold text-red-400 w-6 text-right">{t.count}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-500 uppercase mb-2">By Page / Endpoint</p>
                                            <div className="space-y-1.5">
                                                {deepHealth.errorAnalytics.byPage.map(p => (
                                                    <div key={p.page} className="flex items-center gap-2">
                                                        <span className="text-xs text-slate-400 flex-1 truncate font-mono">{p.page}</span>
                                                        <span className="text-xs font-bold text-amber-400 w-6 text-right">{p.count}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {deepHealth.errorAnalytics.total === 0 && (
                                <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-6 text-center">
                                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-70" />
                                    <p className="text-emerald-400 font-bold">System Clean!</p>
                                    <p className="text-slate-500 text-xs mt-1">Koi bhi error log nahi hai — sab systems normal hain 🎉</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
