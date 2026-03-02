// AuditLogDrawer — Right-side slide-in panel showing recent audit activity
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
    ShieldCheck, X, RefreshCw, Clock, Users, Activity,
    CheckCircle2, XCircle, Search, ChevronRight, Eye,
    UserPlus, Trash2, LogIn, LogOut, DollarSign, CreditCard,
    Calendar, Settings, Download, Building2
} from 'lucide-react';
import { useAuditStore } from '@/store/auditStore';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';
import { AuditLog } from '@/types/audit';

// ── Action config ─────────────────────────────────────────────────────────────
const ACTION_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
    LOGIN: { color: 'text-info bg-info/10', label: 'Login', icon: <LogIn className="w-3 h-3" /> },
    LOGOUT: { color: 'text-dark-muted bg-dark-border/30', label: 'Logout', icon: <LogOut className="w-3 h-3" /> },
    CREATE_EMPLOYEE: { color: 'text-success bg-success/10', label: 'New Employee', icon: <UserPlus className="w-3 h-3" /> },
    UPDATE_EMPLOYEE: { color: 'text-warning bg-warning/10', label: 'Updated Employee', icon: <Users className="w-3 h-3" /> },
    DELETE_EMPLOYEE: { color: 'text-danger bg-danger/10', label: 'Deleted Employee', icon: <Trash2 className="w-3 h-3" /> },
    CREATE_LOAN: { color: 'text-purple-400 bg-purple-400/10', label: 'New Loan', icon: <CreditCard className="w-3 h-3" /> },
    APPROVE_LOAN: { color: 'text-success bg-success/10', label: 'Loan Approved', icon: <CheckCircle2 className="w-3 h-3" /> },
    REJECT_LOAN: { color: 'text-danger bg-danger/10', label: 'Loan Rejected', icon: <XCircle className="w-3 h-3" /> },
    PAY_EMI: { color: 'text-teal-400 bg-teal-400/10', label: 'EMI Paid', icon: <DollarSign className="w-3 h-3" /> },
    GENERATE_PAYROLL: { color: 'text-primary-400 bg-primary-400/10', label: 'Payroll Generated', icon: <DollarSign className="w-3 h-3" /> },
    UPDATE_PAYROLL: { color: 'text-warning bg-warning/10', label: 'Payroll Updated', icon: <DollarSign className="w-3 h-3" /> },
    DELETE_PAYROLL: { color: 'text-danger bg-danger/10', label: 'Payroll Deleted', icon: <Trash2 className="w-3 h-3" /> },
    MARK_ATTENDANCE: { color: 'text-teal-400 bg-teal-400/10', label: 'Attendance', icon: <Clock className="w-3 h-3" /> },
    EDIT_ATTENDANCE: { color: 'text-warning bg-warning/10', label: 'Attendance Edit', icon: <Clock className="w-3 h-3" /> },
    DELETE_ATTENDANCE: { color: 'text-danger bg-danger/10', label: 'Attendance Del', icon: <Trash2 className="w-3 h-3" /> },
    APPROVE_LEAVE: { color: 'text-success bg-success/10', label: 'Leave Approved', icon: <Calendar className="w-3 h-3" /> },
    REJECT_LEAVE: { color: 'text-danger bg-danger/10', label: 'Leave Rejected', icon: <Calendar className="w-3 h-3" /> },
    ROLE_CHANGE: { color: 'text-yellow-400 bg-yellow-400/10', label: 'Role Changed', icon: <ShieldCheck className="w-3 h-3" /> },
    PERMISSION_CHANGE: { color: 'text-yellow-400 bg-yellow-400/10', label: 'Permissions', icon: <ShieldCheck className="w-3 h-3" /> },
    SETTINGS_UPDATE: { color: 'text-dark-muted bg-dark-border/30', label: 'Settings', icon: <Settings className="w-3 h-3" /> },
    DATA_EXPORT: { color: 'text-cyan-400 bg-cyan-400/10', label: 'Data Export', icon: <Download className="w-3 h-3" /> },
    BULK_IMPORT: { color: 'text-orange-400 bg-orange-400/10', label: 'Bulk Import', icon: <Building2 className="w-3 h-3" /> },
};

const getAC = (a: string) => ACTION_CONFIG[a] ?? { color: 'text-primary-400 bg-primary-500/10', label: a, icon: <Activity className="w-3 h-3" /> };

// ── Relative time ─────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
}

// ── Log Detail Panel ──────────────────────────────────────────────────────────
const LogDetail = ({ log, onClose }: { log: AuditLog; onClose: () => void }) => {
    const cfg = getAC(log.action);
    return (
        <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className="absolute inset-0 bg-dark-card z-10 flex flex-col"
        >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-dark-border">
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-dark-bg text-dark-muted hover:text-dark-text transition-colors">
                    <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
                <span className="font-semibold text-dark-text text-sm">Activity Detail</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Action badge */}
                <div className={clsx("flex items-center gap-2 px-3 py-2 rounded-xl w-fit text-sm font-medium", cfg.color)}>
                    {cfg.icon}
                    {cfg.label || log.action}
                </div>

                {/* Who */}
                <div className="glass rounded-xl p-3 space-y-2 border border-dark-border">
                    <p className="text-[10px] text-dark-muted uppercase tracking-widest font-bold">Who</p>
                    <div className="flex items-center gap-3">
                        <img
                            src={`https://api.dicebear.com/7.x/initials/svg?seed=${log.userName}`}
                            className="w-10 h-10 rounded-full border border-dark-border"
                            alt={log.userName}
                        />
                        <div>
                            <p className="text-sm font-semibold text-dark-text">{log.userName}</p>
                            <p className="text-xs text-primary-400 font-medium">{log.userRole}</p>
                            <p className="text-[10px] text-dark-muted font-mono">{log.userId}</p>
                        </div>
                    </div>
                </div>

                {/* When */}
                <div className="glass rounded-xl p-3 space-y-1 border border-dark-border">
                    <p className="text-[10px] text-dark-muted uppercase tracking-widest font-bold">When</p>
                    <p className="text-sm text-dark-text font-medium">
                        {new Date(log.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                    <p className="text-xs text-dark-muted">{relativeTime(log.timestamp)}</p>
                </div>

                {/* What */}
                {(log.entityType || log.entityName) && (
                    <div className="glass rounded-xl p-3 space-y-1.5 border border-dark-border">
                        <p className="text-[10px] text-dark-muted uppercase tracking-widest font-bold">What / Target</p>
                        {log.entityType && <p className="text-xs text-dark-muted uppercase">{log.entityType}</p>}
                        {log.entityName && <p className="text-sm text-dark-text font-medium">{log.entityName}</p>}
                        {log.entityId && <p className="text-[10px] text-dark-muted font-mono">ID: {log.entityId}</p>}
                    </div>
                )}

                {/* Changes — previousValue vs newValue */}
                {(log.previousValue || log.newValue) && (
                    <div className="glass rounded-xl p-3 space-y-3 border border-dark-border">
                        <p className="text-[10px] text-dark-muted uppercase tracking-widest font-bold">What Changed</p>
                        {log.previousValue && (
                            <div>
                                <p className="text-[10px] text-danger mb-1 font-medium">Before</p>
                                <pre className="text-[10px] text-dark-muted bg-danger/5 border border-danger/20 rounded-lg p-2 overflow-auto max-h-28 font-mono whitespace-pre-wrap">
                                    {typeof log.previousValue === 'string' ? log.previousValue : JSON.stringify(log.previousValue, null, 2)}
                                </pre>
                            </div>
                        )}
                        {log.newValue && (
                            <div>
                                <p className="text-[10px] text-success mb-1 font-medium">After</p>
                                <pre className="text-[10px] text-dark-text bg-success/5 border border-success/20 rounded-lg p-2 overflow-auto max-h-28 font-mono whitespace-pre-wrap">
                                    {typeof log.newValue === 'string' ? log.newValue : JSON.stringify(log.newValue, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                )}

                {/* Details */}
                {log.details && Object.keys(log.details).length > 0 && (
                    <div className="glass rounded-xl p-3 space-y-1.5 border border-dark-border">
                        <p className="text-[10px] text-dark-muted uppercase tracking-widest font-bold">Details</p>
                        <pre className="text-[10px] text-dark-text font-mono bg-dark-bg border border-dark-border rounded-lg p-2 overflow-auto max-h-40 whitespace-pre-wrap">
                            {JSON.stringify(log.details, null, 2)}
                        </pre>
                    </div>
                )}

                {/* Status + IP */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="glass rounded-xl p-3 border border-dark-border">
                        <p className="text-[10px] text-dark-muted uppercase tracking-widest font-bold mb-1">Status</p>
                        <span className={clsx("flex items-center gap-1 text-xs font-semibold",
                            log.status === 'SUCCESS' ? 'text-success' : 'text-danger')}>
                            {log.status === 'SUCCESS' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            {log.status}
                        </span>
                        {log.errorMessage && <p className="text-[10px] text-danger mt-1">{log.errorMessage}</p>}
                    </div>
                    <div className="glass rounded-xl p-3 border border-dark-border">
                        <p className="text-[10px] text-dark-muted uppercase tracking-widest font-bold mb-1">IP Address</p>
                        <p className="text-xs text-dark-text font-mono">{log.ipAddress || '—'}</p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

// ── Main Drawer ───────────────────────────────────────────────────────────────
export const AuditLogDrawer = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
    const { logs, isFetching, fetchLogs } = useAuditStore();
    const currentCompanyId = useMultiCompanyStore(s => s.currentCompanyId);
    const hasNewRef = useRef(0);
    const [newCount, setNewCount] = useState(0);

    const load = useCallback(() => {
        fetchLogs({ companyId: currentCompanyId || undefined, limit: 100 });
    }, [fetchLogs, currentCompanyId]);

    // Load on open
    useEffect(() => { if (isOpen) { load(); setNewCount(0); } }, [isOpen, load]);

    // Track new logs when drawer is closed
    useEffect(() => {
        if (!isOpen && logs.length > hasNewRef.current) {
            setNewCount(logs.length - hasNewRef.current);
        }
        hasNewRef.current = logs.length;
    }, [logs.length, isOpen]);

    // Auto-refresh every 30s when open
    useEffect(() => {
        if (!isOpen) return;
        const t = setInterval(load, 30_000);
        return () => clearInterval(t);
    }, [isOpen, load]);

    const filtered = logs.filter(l => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            l.userName?.toLowerCase().includes(q) ||
            l.action?.toLowerCase().includes(q) ||
            l.entityName?.toLowerCase().includes(q) ||
            l.entityType?.toLowerCase().includes(q)
        );
    });

    return (
        <>
            {/* ── Floating Trigger Button ──────────────────────────────── */}
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-[152px] md:bottom-6 right-4 md:right-6 z-40 w-12 h-12 rounded-full bg-primary-600 hover:bg-primary-500 text-white shadow-2xl shadow-primary-600/40 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                title="Activity Log"
            >
                <Activity className="w-5 h-5" />
                {newCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center border-2 border-dark-bg">
                        {newCount > 9 ? '9+' : newCount}
                    </span>
                )}
            </button>

            {/* ── Backdrop ─────────────────────────────────────────────── */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                        onClick={() => { setIsOpen(false); setSelectedLog(null); }}
                    />
                )}
            </AnimatePresence>

            {/* ── Drawer ────────────────────────────────────────────────── */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                        className="fixed right-0 top-0 h-full w-[380px] max-w-[95vw] bg-dark-card border-l border-dark-border z-50 flex flex-col shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3.5 border-b border-dark-border bg-dark-bg/50 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-primary-500/15 flex items-center justify-center">
                                    <ShieldCheck className="w-4 h-4 text-primary-400" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-dark-text leading-none">Activity Log</h2>
                                    <p className="text-[10px] text-dark-muted mt-0.5">{filtered.length} records</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={load}
                                    disabled={isFetching}
                                    className="p-1.5 rounded-lg hover:bg-dark-bg text-dark-muted hover:text-dark-text transition-colors"
                                    title="Refresh"
                                >
                                    <RefreshCw className={clsx("w-4 h-4", isFetching && "animate-spin")} />
                                </button>
                                <button
                                    onClick={() => { setIsOpen(false); setSelectedLog(null); }}
                                    className="p-1.5 rounded-lg hover:bg-dark-bg text-dark-muted hover:text-dark-text transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Search */}
                        <div className="px-3 py-2.5 border-b border-dark-border/50 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-muted" />
                                <input
                                    type="text" value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search user, action, entity…"
                                    className="w-full bg-dark-bg border border-dark-border rounded-lg pl-9 pr-3 py-2 text-dark-text text-xs placeholder-dark-muted focus:outline-none focus:border-primary-500 transition-colors"
                                />
                                {search && (
                                    <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dark-muted">
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Log List */}
                        <div className="flex-1 overflow-y-auto relative">
                            {/* Detail panel */}
                            <AnimatePresence>
                                {selectedLog && (
                                    <LogDetail log={selectedLog} onClose={() => setSelectedLog(null)} />
                                )}
                            </AnimatePresence>

                            {isFetching ? (
                                <div className="p-3 space-y-3">
                                    {[...Array(8)].map((_, i) => (
                                        <div key={i} className="flex gap-3 animate-pulse">
                                            <div className="w-8 h-8 rounded-full bg-dark-border/40 shrink-0 mt-1" />
                                            <div className="flex-1 space-y-2">
                                                <div className="h-3 bg-dark-border/40 rounded w-3/4" />
                                                <div className="h-2 bg-dark-border/30 rounded w-1/2" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-48 text-dark-muted">
                                    <Activity className="w-10 h-10 mb-2 opacity-20" />
                                    <p className="text-sm">{search ? 'No matching activity' : 'No activity yet'}</p>
                                    <p className="text-xs opacity-60 mt-1">Actions karo toh yahan dikhega</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-dark-border/30">
                                    {filtered.map((log, i) => {
                                        const cfg = getAC(log.action);
                                        return (
                                            <button
                                                key={log.id || i}
                                                onClick={() => setSelectedLog(log)}
                                                className="w-full text-left flex gap-3 px-4 py-3 hover:bg-white/3 transition-colors group"
                                            >
                                                {/* Avatar */}
                                                <div className="shrink-0 mt-0.5 relative">
                                                    <img
                                                        src={`https://api.dicebear.com/7.x/initials/svg?seed=${log.userName}`}
                                                        className="w-8 h-8 rounded-full border border-dark-border"
                                                        alt={log.userName}
                                                    />
                                                    {/* Action icon badge */}
                                                    <span className={clsx(
                                                        "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border border-dark-bg",
                                                        cfg.color
                                                    )}>
                                                        {cfg.icon}
                                                    </span>
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-1">
                                                        <p className="text-xs font-semibold text-dark-text truncate leading-tight">
                                                            {log.userName}
                                                        </p>
                                                        <span className="text-[10px] text-dark-muted shrink-0 leading-tight pt-0.5">
                                                            {relativeTime(log.timestamp)}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-dark-muted mt-0.5 leading-snug">
                                                        <span className={clsx("font-medium", cfg.color.split(' ')[0])}>{cfg.label || log.action}</span>
                                                        {log.entityName && (
                                                            <> · <span className="text-dark-text">{log.entityName}</span></>
                                                        )}
                                                    </p>
                                                    {/* Show field-level diff hint */}
                                                    {(log.previousValue || log.newValue) && (
                                                        <p className="text-[10px] text-warning/70 mt-0.5 flex items-center gap-1">
                                                            <span className="w-1 h-1 rounded-full bg-warning inline-block" />
                                                            Changes available
                                                        </p>
                                                    )}
                                                    {/* Status dot */}
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <span className={clsx("w-1.5 h-1.5 rounded-full",
                                                            log.status === 'SUCCESS' ? 'bg-success' : 'bg-danger'
                                                        )} />
                                                        <span className="text-[10px] text-dark-muted">{log.status}</span>
                                                    </div>
                                                </div>

                                                {/* Eye arrow */}
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity pt-1 shrink-0">
                                                    <Eye className="w-3.5 h-3.5 text-dark-muted" />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-2.5 border-t border-dark-border bg-dark-bg/30 text-[10px] text-dark-muted flex items-center justify-between shrink-0">
                            <span>Auto-refreshes every 30s</span>
                            <a href="/admin/audit-logs" className="text-primary-400 hover:text-primary-300 transition-colors">
                                View all logs →
                            </a>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
