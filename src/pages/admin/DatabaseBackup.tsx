import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/apiClient';
import {
    Database, Download, Trash2, RefreshCw, CheckCircle,
    AlertCircle, Clock, HardDrive, Shield, Info, Power, Calendar,
    PlayCircle, PauseCircle, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

interface BackupFile {
    filename: string;
    sizeBytes: number;
    sizeKB: string;
    createdAt: string;
}

interface BackupStatus {
    enabled: boolean;
    maxBackups: number;
    intervalHours: number;
    backupDir: string;
    lastBackupTime: string | null;
    lastBackupFile: string | null;
    lastBackupError: string | null;
    nextBackupTime: string | null;
    dbSizeBytes: number;
    dbSizeKB: string;
    totalBackups: number;
    backups: BackupFile[];
}

export function DatabaseBackup() {
    const [status, setStatus] = useState<BackupStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [backing, setBacking] = useState(false);
    const [toggling, setToggling] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const showMsg = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 4000);
    };

    const loadStatus = async () => {
        try {
            setLoading(true);
            const res = await apiFetch('/backup/status');
            if (res.ok) setStatus(await res.json());
        } catch {
            showMsg('error', '❌ Server se connect nahi hua — kya server chal raha hai?');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadStatus(); }, []);

    const handleBackupNow = async () => {
        setBacking(true);
        try {
            const res = await apiFetch('/backup/now', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                showMsg('success', `✅ Backup saved: ${data.file} (${(data.sizeBytes / 1024).toFixed(1)} KB)`);
                await loadStatus();
            } else {
                showMsg('error', `❌ Backup failed: ${data.error}`);
            }
        } catch {
            showMsg('error', '❌ Network error — server se connect nahi hua');
        } finally {
            setBacking(false);
        }
    };

    const handleToggleAutoBackup = async () => {
        if (!status) return;
        const newEnabled = !status.enabled;
        setToggling(true);
        try {
            const res = await apiFetch('/backup/config', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: newEnabled }),
            });
            const data = await res.json();
            if (data.success) {
                setStatus(prev => prev ? { ...prev, enabled: newEnabled } : prev);
                showMsg('success', newEnabled
                    ? '✅ Auto-backup enabled — roz raat 12 baje backup hoga'
                    : '⏸️ Auto-backup paused — manual backup abhi bhi kaam karega'
                );
            }
        } catch {
            showMsg('error', '❌ Toggle failed');
        } finally {
            setToggling(false);
        }
    };

    const handleDelete = async (filename: string) => {
        if (!confirm(`"${filename}" delete karein?\nYeh permanently delete ho jayega.`)) return;
        setDeleting(filename);
        try {
            const res = await apiFetch(`/backup/${filename}`, { method: 'DELETE' });
            if (res.ok) {
                showMsg('success', `🗑️ Deleted: ${filename}`);
                await loadStatus();
            } else {
                showMsg('error', '❌ Delete failed');
            }
        } finally {
            setDeleting(null);
        }
    };

    const formatDate = (iso: string) => {
        if (!iso) return '-';
        const d = new Date(iso);
        return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
    };

    const formatSize = (bytes: number) => {
        if (bytes > 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / 1024).toFixed(1) + ' KB';
    };

    const getTimeToNextBackup = () => {
        if (!status?.nextBackupTime) return null;
        const now = new Date();
        const next = new Date(status.nextBackupTime);
        const diff = next.getTime() - now.getTime();
        if (diff <= 0) return 'Anytime now';
        const hrs = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/20">
                        <Database className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Database Backup</h1>
                        <p className="text-dark-muted text-sm">
                            {status?.enabled
                                ? `Auto-backup ON • Roz raat 12 baje • Last ${status.totalBackups}/${status.maxBackups} backups`
                                : 'Auto-backup PAUSED • Manual backup abhi bhi available hai'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={loadStatus}
                    className="p-2 rounded-lg bg-dark-card border border-dark-border text-dark-muted hover:text-white transition-colors"
                    title="Refresh"
                    disabled={loading}
                >
                    <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
                </button>
            </div>

            {/* Alert Message */}
            <AnimatePresence>
                {message && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={clsx(
                            'p-4 rounded-xl flex items-center gap-3 font-medium text-sm border',
                            message.type === 'success'
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                : 'bg-red-500/10 text-red-300 border-red-500/30'
                        )}
                    >
                        {message.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                        {message.text}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Stats Cards */}
            {status && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="glass p-4 rounded-xl border border-dark-border">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 rounded-lg bg-blue-500/20">
                                <HardDrive className="w-4 h-4 text-blue-400" />
                            </div>
                        </div>
                        <div className="text-lg font-bold text-white">{formatSize(status.dbSizeBytes)}</div>
                        <div className="text-xs text-dark-muted">Database Size</div>
                    </div>
                    <div className="glass p-4 rounded-xl border border-dark-border">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 rounded-lg bg-violet-500/20">
                                <Database className="w-4 h-4 text-violet-400" />
                            </div>
                        </div>
                        <div className="text-lg font-bold text-white">{status.totalBackups} <span className="text-sm text-dark-muted">/ {status.maxBackups}</span></div>
                        <div className="text-xs text-dark-muted">Total Backups</div>
                    </div>
                    <div className="glass p-4 rounded-xl border border-dark-border">
                        <div className="flex items-center gap-2 mb-2">
                            <div className={clsx('p-1.5 rounded-lg', status.enabled ? 'bg-emerald-500/20' : 'bg-yellow-500/20')}>
                                <Clock className={clsx('w-4 h-4', status.enabled ? 'text-emerald-400' : 'text-yellow-400')} />
                            </div>
                        </div>
                        <div className={clsx('text-lg font-bold', status.enabled ? 'text-emerald-400' : 'text-yellow-400')}>
                            {status.enabled ? 'Active' : 'Paused'}
                        </div>
                        <div className="text-xs text-dark-muted">Auto Backup</div>
                    </div>
                    <div className="glass p-4 rounded-xl border border-dark-border">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 rounded-lg bg-amber-500/20">
                                <Shield className="w-4 h-4 text-amber-400" />
                            </div>
                        </div>
                        <div className="text-sm font-bold text-white leading-tight">
                            {status.lastBackupTime ? formatDate(status.lastBackupTime) : 'Never'}
                        </div>
                        <div className="text-xs text-dark-muted">Last Backup</div>
                    </div>
                </div>
            )}

            {/* Error state */}
            {status?.lastBackupError && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <div>
                        <div className="font-semibold text-red-300 text-sm">Last backup failed</div>
                        <div className="text-xs text-red-400 mt-0.5">{status.lastBackupError}</div>
                    </div>
                </div>
            )}

            {/* ── Auto-Backup Toggle Card ── */}
            <div className="glass p-5 rounded-xl border border-dark-border">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className={clsx(
                            'p-2.5 rounded-xl transition-colors',
                            status?.enabled ? 'bg-emerald-500/20' : 'bg-dark-surface'
                        )}>
                            <Power className={clsx('w-5 h-5', status?.enabled ? 'text-emerald-400' : 'text-dark-muted')} />
                        </div>
                        <div>
                            <div className="font-semibold text-white flex items-center gap-2">
                                Auto-Backup Scheduler
                                <span className={clsx(
                                    'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider',
                                    status?.enabled
                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                        : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                )}>
                                    {status?.enabled ? '● RUNNING' : '⏸ PAUSED'}
                                </span>
                            </div>
                            <div className="text-sm text-dark-muted mt-0.5">
                                {status?.enabled
                                    ? `Roz raat 12 baje automatic backup • Next: ${getTimeToNextBackup() ?? '—'} mein`
                                    : 'Auto-backup paused hai — manual backup se hoga'}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleToggleAutoBackup}
                        disabled={toggling || loading || !status}
                        className={clsx(
                            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all border whitespace-nowrap',
                            status?.enabled
                                ? 'bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-400 border-yellow-500/30'
                                : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border-emerald-500/30',
                            (toggling || !status) && 'opacity-50 cursor-not-allowed'
                        )}
                    >
                        {toggling ? (
                            <><RefreshCw className="w-4 h-4 animate-spin" /> Wait...</>
                        ) : status?.enabled ? (
                            <><PauseCircle className="w-4 h-4" /> Pause Auto-Backup</>
                        ) : (
                            <><PlayCircle className="w-4 h-4" /> Enable Auto-Backup</>
                        )}
                    </button>
                </div>

                {/* Next backup countdown bar */}
                {status?.enabled && status.nextBackupTime && (
                    <div className="mt-4 pt-4 border-t border-dark-border/50">
                        <div className="flex items-center justify-between text-xs text-dark-muted mb-1.5">
                            <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> Next scheduled backup
                            </span>
                            <span className="text-emerald-400 font-mono font-bold">
                                {formatDate(status.nextBackupTime)}
                            </span>
                        </div>
                        <div className="h-1 bg-dark-border rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full animate-pulse" style={{ width: '100%' }} />
                        </div>
                    </div>
                )}
            </div>

            {/* Manual Backup Button */}
            <div className="glass p-5 rounded-xl border border-dark-border flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-primary-500/20">
                        <Zap className="w-5 h-5 text-primary-400" />
                    </div>
                    <div>
                        <div className="font-semibold text-white">Manual Backup</div>
                        <div className="text-sm text-dark-muted">Abhi ek backup lo — purana data turant save ho jayega.</div>
                    </div>
                </div>
                <button
                    onClick={handleBackupNow}
                    disabled={backing}
                    className={clsx(
                        'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap border',
                        backing
                            ? 'bg-dark-surface text-dark-muted border-dark-border cursor-not-allowed'
                            : 'bg-primary-600 hover:bg-primary-500 text-white border-primary-500/50 shadow-lg shadow-primary-500/20'
                    )}
                >
                    {backing ? (
                        <><RefreshCw className="w-4 h-4 animate-spin" /> Backing up...</>
                    ) : (
                        <><Download className="w-4 h-4" /> Backup Now</>
                    )}
                </button>
            </div>

            {/* Backup List */}
            <div className="glass rounded-xl border border-dark-border overflow-hidden">
                <div className="px-5 py-3 flex items-center justify-between border-b border-dark-border/50 bg-dark-bg/30">
                    <span className="font-semibold text-sm text-white">
                        Backup History <span className="text-dark-muted font-normal">({status?.totalBackups ?? 0})</span>
                    </span>
                    <span className="text-xs text-dark-muted font-mono">server/backups/</span>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-dark-muted">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                        <p className="text-sm">Loading backups...</p>
                    </div>
                ) : !status?.backups.length ? (
                    <div className="text-center py-12 text-dark-muted">
                        <Database className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Koi backup nahi mila.</p>
                        <p className="text-xs mt-1 opacity-60">Server start hone pe automatic backup hoga.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-dark-border/40">
                        {status.backups.map((b, i) => (
                            <motion.div
                                key={b.filename}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className={clsx(
                                    'flex items-center gap-4 px-5 py-3 hover:bg-dark-card/30 transition-colors',
                                    i === 0 && 'bg-emerald-500/5'
                                )}
                            >
                                {/* Icon */}
                                <div className={clsx(
                                    'p-2 rounded-lg shrink-0',
                                    i === 0 ? 'bg-emerald-500/20' : 'bg-dark-surface'
                                )}>
                                    <Database className={clsx('w-4 h-4', i === 0 ? 'text-emerald-400' : 'text-dark-muted')} />
                                </div>

                                {/* Name & Date */}
                                <div className="flex-1 min-w-0">
                                    <div className="font-mono text-xs font-medium text-white truncate flex items-center gap-2">
                                        {b.filename}
                                        {i === 0 && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                                                Latest
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[11px] text-dark-muted mt-0.5">{formatDate(b.createdAt)}</div>
                                </div>

                                {/* Size */}
                                <div className="text-xs font-mono text-dark-muted text-right shrink-0">
                                    {formatSize(b.sizeBytes)}
                                </div>

                                {/* Delete */}
                                <button
                                    onClick={() => handleDelete(b.filename)}
                                    disabled={deleting === b.filename}
                                    className="p-1.5 rounded-lg text-dark-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                    title="Delete this backup"
                                >
                                    {deleting === b.filename
                                        ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        : <Trash2 className="w-3.5 h-3.5" />
                                    }
                                </button>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Info box */}
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-300">
                    <strong className="text-blue-200">Auto-Backup Rules:</strong>
                    <ul className="mt-1.5 space-y-1 list-disc ml-4 text-xs text-blue-300/80">
                        <li>Server start hone pe turant ek backup hota hai</li>
                        <li>Roz raat <strong className="text-blue-200">12:00 AM</strong> pe automatic backup hota hai</li>
                        <li>Sirf last <strong className="text-blue-200">{status?.maxBackups ?? 7} backups</strong> rakhe jaate hain — purane auto-delete ho jaate hain</li>
                        <li>Backups: <code className="bg-blue-500/20 px-1 rounded text-blue-200">server/backups/</code> folder mein save hote hain</li>
                        <li>Toggle pause/resume karne se sirf current session affect hota hai — server restart se wapas ON ho jayega</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
