import { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import {
    Search, Download, Eye, RefreshCw, X,
    ShieldCheck, ShieldAlert, Clock, Users, Activity,
    Filter, CheckCircle2, XCircle, ChevronLeft, ChevronRight,
    Building2
} from 'lucide-react';
import { useAuditStore } from '@/store/auditStore';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';
import { useAuthStore } from '@/store/authStore';
import { useDeviceType } from '@/hooks/useDeviceType';
import { AuditLog, AuditAction } from '@/types/audit';

// ── Action categories with colors ──────────────────────────────────────────
const ACTION_CONFIG: Record<string, { color: string; label: string }> = {
    LOGIN: { color: 'text-info bg-info/10 border-info/20', label: 'Login' },
    LOGIN_FAILED: { color: 'text-red-400 bg-red-500/10 border-red-500/30', label: '⚠ Login Failed' },
    LOGOUT: { color: 'text-dark-muted bg-dark-border/20 border-dark-border', label: 'Logout' },
    CHANGE_PASSWORD: { color: 'text-purple-400 bg-purple-500/10 border-purple-400/30', label: '🔒 Pwd Change' },
    CREATE_EMPLOYEE: { color: 'text-success bg-success/10 border-success/20', label: 'Create Employee' },
    UPDATE_EMPLOYEE: { color: 'text-warning bg-warning/10 border-warning/20', label: 'Update Employee' },
    DELETE_EMPLOYEE: { color: 'text-danger bg-danger/10 border-danger/20', label: 'Delete Employee' },
    CREATE_LOAN: { color: 'text-purple-400 bg-purple-400/10 border-purple-400/20', label: 'Create Loan' },
    APPROVE_LOAN: { color: 'text-success bg-success/10 border-success/20', label: 'Approve Loan' },
    REJECT_LOAN: { color: 'text-danger bg-danger/10 border-danger/20', label: 'Reject Loan' },
    GENERATE_PAYROLL: { color: 'text-primary-400 bg-primary-400/10 border-primary-400/20', label: 'Generate Payroll' },
    MARK_ATTENDANCE: { color: 'text-teal-400 bg-teal-400/10 border-teal-400/20', label: 'Mark Attendance' },
    APPROVE_LEAVE: { color: 'text-success bg-success/10 border-success/20', label: 'Approve Leave' },
    REJECT_LEAVE: { color: 'text-danger bg-danger/10 border-danger/20', label: 'Reject Leave' },
    DATA_EXPORT: { color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20', label: 'Data Export' },
    BULK_IMPORT: { color: 'text-orange-400 bg-orange-400/10 border-orange-400/20', label: 'Bulk Import' },
    ROLE_CHANGE: { color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', label: 'Role Change' },
    SETTINGS_UPDATE: { color: 'text-dark-muted bg-dark-border/20 border-dark-border', label: 'Settings Update' },
    DEFAULT: { color: 'text-primary-400 bg-primary-500/10 border-primary-500/20', label: '' },
};

const getActionConfig = (action: string) => ACTION_CONFIG[action] ?? { ...ACTION_CONFIG.DEFAULT, label: action };

const ENTITY_ICONS: Record<string, React.ReactNode> = {
    EMPLOYEE: <Users className="w-3.5 h-3.5" />,
    LOAN: <Building2 className="w-3.5 h-3.5" />,
    PAYROLL: <Activity className="w-3.5 h-3.5" />,
    ATTENDANCE: <Clock className="w-3.5 h-3.5" />,
    LEAVE: <Clock className="w-3.5 h-3.5" />,
    SETTINGS: <ShieldCheck className="w-3.5 h-3.5" />,
};

const PAGE_SIZE = 50;

const ALL_ACTIONS: Array<AuditAction | ''> = [
    '', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'CHANGE_PASSWORD',
    'CREATE_EMPLOYEE', 'UPDATE_EMPLOYEE', 'DELETE_EMPLOYEE',
    'CREATE_LOAN', 'APPROVE_LOAN', 'REJECT_LOAN', 'PAY_EMI', 'GENERATE_PAYROLL',
    'UPDATE_PAYROLL', 'DELETE_PAYROLL', 'MARK_ATTENDANCE', 'EDIT_ATTENDANCE',
    'DELETE_ATTENDANCE', 'APPROVE_LEAVE', 'REJECT_LEAVE', 'ROLE_CHANGE',
    'PERMISSION_CHANGE', 'SETTINGS_UPDATE', 'DATA_EXPORT', 'BULK_IMPORT'
];

// ── Component ────────────────────────────────────────────────────────────────
export const AuditLogs = () => {
    const { logs, isFetching, totalCount, fetchLogs, getLogs } = useAuditStore();
    const currentCompanyId = useMultiCompanyStore(s => s.currentCompanyId);
    const user = useAuthStore(s => s.user);
    const { isMobile } = useDeviceType();

    const [searchTerm, setSearchTerm] = useState('');
    const [filterAction, setFilterAction] = useState<AuditAction | ''>('');
    const [filterStatus, setFilterStatus] = useState<'SUCCESS' | 'FAILED' | ''>('');
    const [filterEntity, setFilterEntity] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [page, setPage] = useState(1);
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const [isBackendMode, setIsBackendMode] = useState(false);

    // Fetch from backend on mount and when filters change
    const loadLogs = useCallback(async () => {
        try {
            await fetchLogs({
                companyId: currentCompanyId || undefined,
                action: filterAction || undefined,
                status: filterStatus || undefined,
                entityType: filterEntity || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                page,
                limit: PAGE_SIZE,
            });
            setIsBackendMode(true);
        } catch {
            setIsBackendMode(false);
        }
    }, [fetchLogs, currentCompanyId, filterAction, filterStatus, filterEntity, startDate, endDate, page]);

    useEffect(() => { loadLogs(); }, [loadLogs]);

    // Handle incoming filter=permissions link
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('filter') === 'permissions') {
            setFilterAction('PERMISSION_CHANGE');
            setFilterEntity('SETTINGS');
            setShowFilters(true);
        }
    }, []);

    // Local filtering (for search + when backend unavailable)
    const baseSource = isBackendMode ? logs : getLogs({ action: filterAction || undefined, startDate, endDate });

    const filteredLogs = baseSource.filter(log => {
        if (filterStatus && log.status !== filterStatus) return false;
        if (filterEntity && log.entityType !== filterEntity) return false;
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            return (
                log.userName?.toLowerCase().includes(q) ||
                log.action?.toLowerCase().includes(q) ||
                log.entityName?.toLowerCase().includes(q) ||
                log.entityType?.toLowerCase().includes(q) ||
                log.userId?.toLowerCase().includes(q)
            );
        }
        return true;
    });

    // Paginate client-side when not in backend mode
    const displayLogs = isBackendMode
        ? filteredLogs
        : filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const total = isBackendMode ? totalCount : filteredLogs.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // ── Stats ─────────────────────────────────────────────────────────────
    const successCount = filteredLogs.filter(l => l.status === 'SUCCESS').length;
    const failedCount = filteredLogs.filter(l => l.status === 'FAILED').length;
    // Count LOGIN_FAILED in last 24h for security alert banner
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentFailedLogins = logs.filter(
        l => l.action === 'LOGIN_FAILED' && l.timestamp >= oneDayAgo
    ).length;

    const activeFilterCount = [filterAction, filterStatus, filterEntity, startDate, endDate].filter(Boolean).length;

    const resetFilters = () => {
        setFilterAction(''); setFilterStatus('');
        setFilterEntity(''); setStartDate(''); setEndDate('');
        setPage(1);
    };

    // ── CSV Export ────────────────────────────────────────────────────────
    const exportCSV = () => {
        const headers = ['Timestamp', 'User', 'Role', 'Action', 'Entity', 'Entity Name', 'Status', 'IP Address'].join(',');
        const rows = filteredLogs.map(l => [
            l.timestamp, l.userName, l.userRole, l.action,
            l.entityType, l.entityName || '', l.status, l.ipAddress || ''
        ].map(v => `"${v}"`).join(','));
        const footerInfo = [
            '',
            `"CONFIDENTIAL \— ${user?.role || 'System'} DATA"`,
            `"Downloaded by ${user?.name || 'Automated'} (${user?.id || 'System'}) on ${new Date().toLocaleString()}"`
        ];
        const csv = [headers, ...rows, ...footerInfo].join('\n');

        const bom = '\uFEFF';
        const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
    };

    return (
        <div className="space-y-5">
            {/* ── Header ──────────────────────────────────────────────── */}
            {/* ── Security Alert Banner ───────────────────────────────── */}
            {recentFailedLogins >= 3 && (
                <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm animate-in fade-in">
                    <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <div>
                        <span className="font-semibold text-red-300">⚠️ Security Alert: </span>
                        <span className="text-red-200">
                            {recentFailedLogins} failed login attempt{recentFailedLogins > 1 ? 's' : ''} in last 24 hours.
                        </span>
                        <button
                            onClick={() => { setFilterAction('LOGIN_FAILED'); setShowFilters(true); }}
                            className="ml-2 underline text-red-300 hover:text-red-200 text-xs"
                        >
                            View details
                        </button>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-dark-text flex items-center gap-2">
                        <ShieldCheck className="w-7 h-7 text-primary-400" />
                        Audit Logs
                    </h1>
                    <p className="text-dark-muted text-sm mt-0.5">
                        {isBackendMode ? (
                            <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-success inline-block animate-pulse" />
                                Live from database · {total.toLocaleString()} total records
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-warning inline-block" />
                                Local cache · {total.toLocaleString()} records
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={loadLogs}
                        disabled={isFetching}
                        className="flex items-center gap-2 px-3 py-2 bg-dark-bg border border-dark-border text-dark-muted hover:text-dark-text rounded-xl transition-all text-sm"
                    >
                        <RefreshCw className={clsx("w-4 h-4", isFetching && "animate-spin")} />
                        Refresh
                    </button>
                    <button
                        onClick={() => {
                            setFilterAction('PERMISSION_CHANGE');
                            setFilterEntity('SETTINGS');
                            setShowFilters(true);
                            setPage(1);
                        }}
                        className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 rounded-xl transition-all text-sm font-medium"
                    >
                        <ShieldCheck className="w-4 h-4" />
                        Permission History
                    </button>
                    <button
                        onClick={exportCSV}
                        disabled={isMobile}
                        title={isMobile ? "Export available on Desktop only" : "Download as CSV"}
                        className={clsx(
                            "flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-sm font-medium",
                            isMobile
                                ? "bg-dark-border/30 text-dark-muted cursor-not-allowed"
                                : "bg-primary-500/20 hover:bg-primary-500/30 text-primary-400"
                        )}
                    >
                        <Download className="w-4 h-4" />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* ── Stats strip ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Total Logs', value: total, icon: <Activity className="w-5 h-5" />, cls: 'text-dark-text', bg: '' },
                    { label: 'Shown', value: filteredLogs.length, icon: <Filter className="w-5 h-5" />, cls: 'text-primary-400', bg: 'bg-primary-500/5 border-primary-500/20' },
                    { label: 'Success', value: successCount, icon: <CheckCircle2 className="w-5 h-5" />, cls: 'text-success', bg: 'bg-success/5 border-success/20' },
                    { label: 'Failed', value: failedCount, icon: <ShieldAlert className="w-5 h-5" />, cls: 'text-danger', bg: 'bg-danger/5 border-danger/20' },
                ].map(s => (
                    <div key={s.label} className={clsx("glass rounded-xl p-4 border", s.bg)}>
                        <div className={clsx("flex items-center gap-2 mb-1", s.cls)}>{s.icon}
                            <span className="text-xs text-dark-muted uppercase tracking-wider">{s.label}</span>
                        </div>
                        <p className={clsx("text-2xl font-bold", s.cls)}>{s.value.toLocaleString()}</p>
                    </div>
                ))}
            </div>

            {/* ── Search + filter row ─────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
                    <input
                        type="text" value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search user, action, entity…"
                        className="w-full bg-dark-bg border border-dark-border rounded-xl pl-10 pr-10 py-2.5 text-dark-text placeholder-dark-muted focus:outline-none focus:border-primary-500 transition-colors text-sm"
                    />
                    {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted hover:text-dark-text"><X className="w-4 h-4" /></button>}
                </div>
                <button
                    onClick={() => setShowFilters(f => !f)}
                    className={clsx(
                        'flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all whitespace-nowrap',
                        showFilters || activeFilterCount > 0
                            ? 'bg-primary-600/20 border-primary-500 text-primary-400'
                            : 'bg-dark-bg border-dark-border text-dark-muted hover:text-dark-text'
                    )}
                >
                    <Filter className="w-4 h-4" />
                    Filters
                    {activeFilterCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-primary-500 text-white text-xs flex items-center justify-center font-bold">{activeFilterCount}</span>
                    )}
                </button>
            </div>

            {/* ── Advanced filter panel ────────────────────────────────── */}
            {showFilters && (
                <div className="glass rounded-2xl border border-dark-border p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        <div>
                            <label className="block text-xs text-dark-muted mb-1.5 font-medium">Action</label>
                            <select value={filterAction} onChange={e => { setFilterAction(e.target.value as any); setPage(1); }}
                                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text text-sm focus:outline-none focus:border-primary-500">
                                {ALL_ACTIONS.map(a => <option key={a} value={a}>{a === '' ? 'All Actions' : (ACTION_CONFIG[a]?.label || a)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-dark-muted mb-1.5 font-medium">Status</label>
                            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value as any); setPage(1); }}
                                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text text-sm focus:outline-none focus:border-primary-500">
                                <option value="">All Statuses</option>
                                <option value="SUCCESS">✅ Success</option>
                                <option value="FAILED">❌ Failed</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-dark-muted mb-1.5 font-medium">Entity</label>
                            <select value={filterEntity} onChange={e => { setFilterEntity(e.target.value); setPage(1); }}
                                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text text-sm focus:outline-none focus:border-primary-500">
                                <option value="">All Entities</option>
                                {['EMPLOYEE', 'LOAN', 'PAYROLL', 'ATTENDANCE', 'LEAVE', 'USER', 'SETTINGS'].map(e => (
                                    <option key={e} value={e}>{e}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-dark-muted mb-1.5 font-medium">From Date</label>
                            <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }}
                                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text text-sm focus:outline-none focus:border-primary-500" />
                        </div>
                        <div>
                            <label className="block text-xs text-dark-muted mb-1.5 font-medium">To Date</label>
                            <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); }}
                                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text text-sm focus:outline-none focus:border-primary-500" />
                        </div>
                    </div>
                    {activeFilterCount > 0 && (
                        <button onClick={resetFilters} className="text-xs text-danger hover:text-red-400 flex items-center gap-1.5 pt-1 border-t border-dark-border/50 w-full">
                            <X className="w-3 h-3" /> Clear all filters
                        </button>
                    )}
                </div>
            )}

            {/* ── Logs Table ───────────────────────────────────────────── */}
            <div className="glass rounded-2xl overflow-hidden border border-dark-border">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-dark-bg/70 border-b border-dark-border">
                            <tr>
                                <th className="text-left px-4 py-3 text-dark-muted font-medium uppercase tracking-wider text-xs">Time</th>
                                <th className="text-left px-4 py-3 text-dark-muted font-medium uppercase tracking-wider text-xs">User</th>
                                <th className="text-left px-4 py-3 text-dark-muted font-medium uppercase tracking-wider text-xs">Action</th>
                                <th className="text-left px-4 py-3 text-dark-muted font-medium uppercase tracking-wider text-xs">Entity</th>
                                <th className="text-left px-4 py-3 text-dark-muted font-medium uppercase tracking-wider text-xs">Status</th>
                                <th className="w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border/50">
                            {isFetching ? (
                                [...Array(8)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {[...Array(6)].map((_, j) => (
                                            <td key={j} className="px-4 py-3">
                                                <div className="h-4 bg-dark-border/40 rounded w-3/4" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : displayLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-16">
                                        <ShieldCheck className="w-12 h-12 text-dark-border mx-auto mb-3" />
                                        <p className="text-dark-text font-medium">No audit logs found</p>
                                        <p className="text-dark-muted text-xs mt-1">Actions taken in the app will appear here</p>
                                    </td>
                                </tr>
                            ) : (
                                displayLogs.map(log => {
                                    const cfg = getActionConfig(log.action);
                                    return (
                                        <tr key={log.id} className="hover:bg-white/3 transition-colors group">
                                            <td className="px-4 py-3 text-dark-muted font-mono text-xs whitespace-nowrap">
                                                {new Date(log.timestamp).toLocaleString('en-IN', {
                                                    day: '2-digit', month: 'short',
                                                    hour: '2-digit', minute: '2-digit', hour12: true
                                                })}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-dark-text text-xs">{log.userName}</div>
                                                <div className="text-dark-muted text-[10px]">{log.userRole}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={clsx("px-2 py-0.5 rounded-full border text-[10px] font-semibold", cfg.color)}>
                                                    {cfg.label || log.action}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {log.entityType ? (
                                                    <span className="flex items-center gap-1.5 text-dark-muted text-xs">
                                                        {ENTITY_ICONS[log.entityType] || <Activity className="w-3.5 h-3.5" />}
                                                        <span>{log.entityName || log.entityType}</span>
                                                    </span>
                                                ) : <span className="text-dark-muted text-xs">—</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={clsx(
                                                    "flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold w-fit",
                                                    log.status === 'SUCCESS'
                                                        ? 'text-success bg-success/10 border-success/20'
                                                        : 'text-danger bg-danger/10 border-danger/20'
                                                )}>
                                                    {log.status === 'SUCCESS' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                                    {log.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => setSelectedLog(log)}
                                                    className="p-1.5 text-dark-muted hover:text-primary-400 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-primary-500/10"
                                                    title="View details"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ── Pagination ─────────────────────────────────────── */}
                {totalPages > 1 && (
                    <div className="px-4 py-3 border-t border-dark-border flex items-center justify-between text-sm">
                        <span className="text-dark-muted text-xs">
                            Page {page} of {totalPages} · {total.toLocaleString()} records
                        </span>
                        <div className="flex gap-1">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                className="p-1.5 rounded-lg bg-dark-bg border border-dark-border text-dark-muted hover:text-dark-text disabled:opacity-30 transition-colors">
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const p = Math.max(1, Math.min(page - 2 + i, totalPages - 4 + i));
                                return (
                                    <button key={p} onClick={() => setPage(p)}
                                        className={clsx("w-8 h-8 rounded-lg text-xs font-medium transition-colors",
                                            page === p ? "bg-primary-500 text-white" : "bg-dark-bg border border-dark-border text-dark-muted hover:text-dark-text"
                                        )}>
                                        {p}
                                    </button>
                                );
                            })}
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                className="p-1.5 rounded-lg bg-dark-bg border border-dark-border text-dark-muted hover:text-dark-text disabled:opacity-30 transition-colors">
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Log Detail Modal ─────────────────────────────────────── */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedLog(null)}>
                    <div className="glass max-w-xl w-full rounded-2xl border border-dark-border shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-dark-border">
                            <h3 className="text-lg font-bold text-dark-text flex items-center gap-2">
                                <Eye className="w-5 h-5 text-primary-400" />
                                Log Details
                            </h3>
                            <button onClick={() => setSelectedLog(null)} className="text-dark-muted hover:text-dark-text transition-colors p-1 rounded-lg hover:bg-dark-bg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 space-y-3 text-sm">
                            {[
                                { label: 'Timestamp', value: new Date(selectedLog.timestamp).toLocaleString() },
                                { label: 'User', value: `${selectedLog.userName} (${selectedLog.userRole})` },
                                { label: 'User ID', value: selectedLog.userId },
                                { label: 'Action', value: selectedLog.action },
                                { label: 'Entity', value: selectedLog.entityType || '—' },
                                { label: 'Entity Name', value: selectedLog.entityName || '—' },
                                { label: 'Entity ID', value: selectedLog.entityId || '—' },
                                { label: 'IP Address', value: selectedLog.ipAddress || '—' },
                                { label: 'Status', value: selectedLog.status },
                                ...(selectedLog.errorMessage ? [{ label: 'Error', value: selectedLog.errorMessage }] : []),
                            ].map(row => (
                                <div key={row.label} className="flex gap-3 py-1.5 border-b border-dark-border/30">
                                    <span className="text-dark-muted w-28 shrink-0 text-xs uppercase tracking-wider pt-0.5">{row.label}</span>
                                    <span className="text-dark-text text-xs font-mono break-all">{row.value}</span>
                                </div>
                            ))}
                            {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                                <div className="pt-1">
                                    <p className="text-dark-muted text-xs uppercase tracking-wider mb-2">Details</p>
                                    <pre className="text-dark-text text-xs bg-dark-bg border border-dark-border p-3 rounded-xl overflow-auto max-h-40 font-mono">
                                        {JSON.stringify(selectedLog.details, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
