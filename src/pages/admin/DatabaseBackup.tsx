import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/apiClient';
import {
    Database, Download, Trash2, RefreshCw, CheckCircle,
    AlertCircle, Clock, HardDrive, Shield, Info, Power, Calendar,
    PlayCircle, PauseCircle, Zap, Mail, MessageCircle, Plus, X,
    Save, BellRing, Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useDialog } from '@/components/DialogProvider';
import { PasswordConfirmModal } from '@/components/PasswordConfirmModal';
import { useDeviceType } from '@/hooks/useDeviceType';
import { useSecurityStore } from '@/store/securityStore';
import { useAuthStore } from '@/store/authStore';

interface BackupFile {
    filename: string;
    sizeBytes: number;
    sizeKB: string;
    createdAt: string;
}

interface BackupStatus {
    enabled: boolean;
    schedules: string[];
    maxBackups: number;
    backupDir: string;
    lastBackupTime: string | null;
    lastBackupFile: string | null;
    lastBackupError: string | null;
    nextBackupTimes: string[];
    dbSizeBytes: number;
    dbSizeKB: string;
    totalBackups: number;
    backups: BackupFile[];
    emailEnabled: boolean;
    whatsappEnabled: boolean;
}

interface BackupConfig {
    enabled: boolean;
    schedules: string[];
    email: {
        enabled: boolean;
        smtpHost: string;
        smtpPort: number;
        user: string;
        pass: string;
        to: string;
    };
    whatsapp: {
        enabled: boolean;
        phoneNumberId: string;
        wabaToken: string;
        to: string;
    };
}

type Tab = 'history' | 'schedules' | 'email' | 'whatsapp';

const DEFAULT_CFG: BackupConfig = {
    enabled: true,
    schedules: ['00:00'],
    email: { enabled: false, smtpHost: 'smtp.gmail.com', smtpPort: 587, user: '', pass: '', to: '' },
    whatsapp: { enabled: false, phoneNumberId: '', wabaToken: '', to: '' },
};


export function DatabaseBackup() {
    const { user } = useAuthStore();
    const { currentIp, allowedIps } = useSecurityStore();
    const isIpAllowed = user?.role === 'SUPER_ADMIN' || (currentIp && allowedIps.includes(currentIp));
    const [status, setStatus] = useState<BackupStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [backing, setBacking] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('history');
    const [showBackupConfirm, setShowBackupConfirm] = useState(false);
    const { confirm } = useDialog();

    // Config state — initialize with DEFAULT_CFG so JSX never reads .enabled on undefined
    const [cfg, setCfg] = useState<BackupConfig>(DEFAULT_CFG);
    const [cfgLoading, setCfgLoading] = useState(false);
    const [savingCfg, setSavingCfg] = useState(false);
    const [newTime, setNewTime] = useState('');
    const { isDesktop } = useDeviceType();

    const showMsg = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
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


    const loadConfig = async () => {
        try {
            setCfgLoading(true);
            const res = await apiFetch('/backup/config');
            if (res.ok) {
                const raw = await res.json();
                // Deep-merge with defaults so email/whatsapp are never undefined
                setCfg({
                    ...DEFAULT_CFG,
                    ...raw,
                    email: { ...DEFAULT_CFG.email, ...(raw.email || {}) },
                    whatsapp: { ...DEFAULT_CFG.whatsapp, ...(raw.whatsapp || {}) },
                });
            }
        } catch {
            showMsg('error', '❌ Config load nahi hua');
        } finally {
            setCfgLoading(false);
        }
    };

    useEffect(() => {
        loadStatus();
        loadConfig();
    }, []);

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
            setShowBackupConfirm(false);
        }
    };

    const handleDelete = async (filename: string) => {
        const ok = await confirm({
            title: 'Backup Delete Karein?',
            message: `"${filename}" ko permanently delete karna chahte hain? Yeh wapas nahi aayega.`,
            confirmLabel: 'Haan, Delete Karo',
            cancelLabel: 'Cancel',
            variant: 'danger',
        });
        if (!ok) return;
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

    const handleDownload = async (filename: string) => {
        try {
            showMsg('success', `⏳ Downloading ${filename}...`);
            const res = await apiFetch(`/backup/download/${filename}`);
            if (!res.ok) throw new Error('Download failed');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch {
            showMsg('error', '❌ File download fail ho gaya.');
        }
    };

    const handleSaveCfg = async () => {
        if (!cfg) return;
        setSavingCfg(true);
        try {
            const res = await apiFetch('/backup/config', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cfg),
            });
            const data = await res.json();
            if (data.success) {
                showMsg('success', '✅ Settings save ho gayi! Scheduler updated.');
                setCfg(data.config);
                await loadStatus();
            } else {
                showMsg('error', '❌ Save failed');
            }
        } catch {
            showMsg('error', '❌ Network error');
        } finally {
            setSavingCfg(false);
        }
    };

    const handleAddTime = () => {
        if (!newTime || !cfg) return;
        const schedules = cfg.schedules ?? [];
        if (schedules.includes(newTime)) return showMsg('error', 'Yeh time pehle se add hai');
        setCfg({ ...cfg, schedules: [...schedules, newTime].sort() });
        setNewTime('');
    };

    const handleRemoveTime = (t: string) => {
        if (!cfg) return;
        const schedules = cfg.schedules ?? [];
        if (schedules.length <= 1) return showMsg('error', 'Kam se kam ek time rakho');
        setCfg({ ...cfg, schedules: schedules.filter(s => s !== t) });
    };

    const formatDate = (iso: string) => {
        if (!iso) return '-';
        return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
    };
    const formatSize = (bytes: number) => {
        if (bytes > 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / 1024).toFixed(1) + ' KB';
    };

    const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'history', label: 'History', icon: <Database className="w-4 h-4" /> },
        { id: 'schedules', label: 'Schedules', icon: <BellRing className="w-4 h-4" /> },
        { id: 'email', label: 'Email', icon: <Mail className="w-4 h-4" /> },
        { id: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle className="w-4 h-4" /> },
    ];

    if (!isDesktop) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] text-center px-4">
                <div className="w-20 h-20 bg-red-500/10 flex items-center justify-center rounded-full mb-6 relative">
                    <Database className="w-10 h-10 text-red-500 opacity-50" />
                    <X className="w-6 h-6 text-red-400 absolute bottom-4 right-4 bg-dark-bg rounded-full border border-dark-bg" />
                    <Smartphone className="w-8 h-8 text-red-400 absolute -bottom-2 -left-2 bg-dark-bg rounded-full p-1" />
                </div>
                <h2 className="text-2xl font-bold text-dark-text mb-3">Desktop Environment Required</h2>
                <p className="text-dark-muted max-w-sm leading-relaxed">
                    Database Backup is a highly sensitive infrastructure operation. It is strictly isolated to <strong className="text-white">Desktop devices</strong> to ensure reliable network stability and security during massive data dumps.
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">

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
                                ? `Auto-backup ON • ${status.schedules?.length ?? cfg?.schedules?.length ?? 1} schedule(s) active`
                                : 'Auto-backup PAUSED • Manual backup available'}
                        </p>
                    </div>
                </div>
                <button onClick={loadStatus} className="p-2 rounded-lg bg-dark-card border border-dark-border text-dark-muted hover:text-white transition-colors" title="Refresh" disabled={loading}>
                    <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
                </button>
            </div>

            {/* Alert Message */}
            <AnimatePresence>
                {message && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
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
                        <div className="flex items-center gap-2 mb-2"><div className="p-1.5 rounded-lg bg-blue-500/20"><HardDrive className="w-4 h-4 text-blue-400" /></div></div>
                        <div className="text-lg font-bold text-white">{formatSize(status.dbSizeBytes)}</div>
                        <div className="text-xs text-dark-muted">Database Size</div>
                    </div>
                    <div className="glass p-4 rounded-xl border border-dark-border">
                        <div className="flex items-center gap-2 mb-2"><div className="p-1.5 rounded-lg bg-violet-500/20"><Database className="w-4 h-4 text-violet-400" /></div></div>
                        <div className="text-lg font-bold text-white">{status.totalBackups} <span className="text-sm text-dark-muted">/ {status.maxBackups}</span></div>
                        <div className="text-xs text-dark-muted">Total Backups</div>
                    </div>
                    <div className="glass p-4 rounded-xl border border-dark-border">
                        <div className="flex items-center gap-2 mb-2">
                            <div className={clsx('p-1.5 rounded-lg', status.enabled ? 'bg-emerald-500/20' : 'bg-yellow-500/20')}>
                                <Clock className={clsx('w-4 h-4', status.enabled ? 'text-emerald-400' : 'text-yellow-400')} />
                            </div>
                        </div>
                        <div className={clsx('text-lg font-bold', status.enabled ? 'text-emerald-400' : 'text-yellow-400')}>{status.enabled ? 'Active' : 'Paused'}</div>
                        <div className="text-xs text-dark-muted">Auto Backup</div>
                    </div>
                    <div className="glass p-4 rounded-xl border border-dark-border">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex gap-1">
                                {status.emailEnabled && <div className="p-1.5 rounded-lg bg-sky-500/20"><Mail className="w-3.5 h-3.5 text-sky-400" /></div>}
                                {status.whatsappEnabled && <div className="p-1.5 rounded-lg bg-green-500/20"><MessageCircle className="w-3.5 h-3.5 text-green-400" /></div>}
                                {!status.emailEnabled && !status.whatsappEnabled && <div className="p-1.5 rounded-lg bg-dark-surface"><Shield className="w-4 h-4 text-dark-muted" /></div>}
                            </div>
                        </div>
                        <div className="text-sm font-bold text-white leading-tight">
                            {[status.emailEnabled && 'Email', status.whatsappEnabled && 'WA'].filter(Boolean).join(' + ') || 'No delivery'}
                        </div>
                        <div className="text-xs text-dark-muted">Delivery</div>
                    </div>
                </div>
            )}

            {/* Manual Backup + Toggle */}
            <div className="grid md:grid-cols-2 gap-4">
                {/* Manual Backup */}
                <div className="glass p-5 rounded-xl border border-dark-border flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-primary-500/20"><Zap className="w-5 h-5 text-primary-400" /></div>
                        <div>
                            <div className="font-semibold text-white">Manual Backup</div>
                            <div className="text-sm text-dark-muted">Abhi backup lo</div>
                        </div>
                    </div>
                    <button onClick={() => isIpAllowed ? setShowBackupConfirm(true) : showMsg('error', 'Manual backup is restricted to the Office IP network.')} disabled={backing || !isIpAllowed}
                        className={clsx('flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap border',
                            backing || !isIpAllowed ? 'bg-dark-surface text-dark-muted border-dark-border cursor-not-allowed'
                                : 'bg-primary-600 hover:bg-primary-500 text-white border-primary-500/50 shadow-lg shadow-primary-500/20')}>
                        {backing ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</> : !isIpAllowed ? <><AlertCircle className="w-4 h-4" /> Locked (IP)</> : <><Download className="w-4 h-4" /> Backup Now</>}
                    </button>
                </div>
                {/* Auto-backup Toggle */}
                {cfg && (
                    <div className="glass p-5 rounded-xl border border-dark-border flex items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className={clsx('p-2.5 rounded-xl', cfg.enabled ? 'bg-emerald-500/20' : 'bg-dark-surface')}>
                                <Power className={clsx('w-5 h-5', cfg.enabled ? 'text-emerald-400' : 'text-dark-muted')} />
                            </div>
                            <div>
                                <div className="font-semibold text-white flex items-center gap-2">
                                    Auto-Backup
                                    <span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider',
                                        cfg.enabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30')}>
                                        {cfg.enabled ? '● ON' : '⏸ OFF'}
                                    </span>
                                </div>
                                <div className="text-sm text-dark-muted">{cfg.schedules?.length ?? 0} time(s) set</div>
                            </div>
                        </div>
                        <button
                            onClick={() => { const updated = { ...cfg, enabled: !cfg.enabled }; setCfg(updated); setTimeout(() => handleSaveCfg(), 100); }}
                            className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all border whitespace-nowrap',
                                cfg.enabled ? 'bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-400 border-yellow-500/30' : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border-emerald-500/30')}>
                            {cfg.enabled ? <><PauseCircle className="w-4 h-4" /> Pause</> : <><PlayCircle className="w-4 h-4" /> Enable</>}
                        </button>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="glass rounded-xl border border-dark-border overflow-hidden">
                {/* Tab Bar */}
                <div className="flex border-b border-dark-border/50 bg-dark-bg/30">
                    {TABS.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={clsx('flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors',
                                activeTab === tab.id
                                    ? 'text-primary-400 border-b-2 border-primary-400 bg-primary-500/5'
                                    : 'text-dark-muted hover:text-white')}>
                            {tab.icon}{tab.label}
                        </button>
                    ))}
                </div>

                {/* ── Tab: History ── */}
                {activeTab === 'history' && (
                    <>
                        <div className="px-5 py-3 flex items-center justify-between border-b border-dark-border/50">
                            <span className="font-semibold text-sm text-white">Backup History <span className="text-dark-muted font-normal">({status?.totalBackups ?? 0})</span></span>
                            <span className="text-xs text-dark-muted font-mono">server/backups/</span>
                        </div>
                        {loading ? (
                            <div className="text-center py-12 text-dark-muted"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" /><p className="text-sm">Loading...</p></div>
                        ) : !status?.backups.length ? (
                            <div className="text-center py-12 text-dark-muted">
                                <Database className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                <p className="text-sm">Koi backup nahi mila.</p>
                                <p className="text-xs mt-1 opacity-60">Server start hone pe automatic backup hoga.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-dark-border/40">
                                {status.backups.map((b, i) => (
                                    <motion.div key={b.filename} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                        className={clsx('flex items-center gap-4 px-5 py-3 hover:bg-dark-card/30 transition-colors', i === 0 && 'bg-emerald-500/5')}>
                                        <div className={clsx('p-2 rounded-lg shrink-0', i === 0 ? 'bg-emerald-500/20' : 'bg-dark-surface')}>
                                            <Database className={clsx('w-4 h-4', i === 0 ? 'text-emerald-400' : 'text-dark-muted')} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-mono text-xs font-medium text-white truncate flex items-center gap-2">
                                                <span className="truncate">{b.filename}</span>
                                                {i === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold shrink-0">Latest</span>}
                                            </div>
                                            <div className="text-[11px] text-dark-muted mt-0.5">{formatDate(b.createdAt)}</div>
                                        </div>
                                        <div className="text-xs font-mono text-dark-muted text-right shrink-0 w-20">{formatSize(b.sizeBytes)}</div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button onClick={() => handleDownload(b.filename)} className="p-1.5 rounded-lg text-dark-muted hover:text-primary-400 hover:bg-primary-500/10 transition-colors" title="Download">
                                                <Download className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(b.filename)} disabled={deleting === b.filename} className="p-1.5 rounded-lg text-dark-muted hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                                                {deleting === b.filename ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* ── Tab: Schedules ── */}
                {activeTab === 'schedules' && (
                    <div className="p-6 space-y-5">
                        <div>
                            <h3 className="text-white font-semibold mb-1">Daily Backup Times</h3>
                            <p className="text-dark-muted text-sm">Jinne bhi time set karoge, us time pe automatically backup hoga aur Email/WhatsApp pe bheja jayega.</p>
                        </div>
                        {cfgLoading ? (
                            <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-dark-muted" /></div>
                        ) : (
                            <>
                                {/* Existing Schedules */}
                                <div className="flex flex-wrap gap-2">
                                    {(cfg?.schedules ?? []).map(t => (
                                        <div key={t} className="flex items-center gap-2 bg-dark-card border border-dark-border rounded-lg px-3 py-2">
                                            <Clock className="w-3.5 h-3.5 text-emerald-400" />
                                            <span className="font-mono text-sm font-bold text-white">{t}</span>
                                            <button onClick={() => handleRemoveTime(t)} className="text-dark-muted hover:text-red-400 transition-colors ml-1">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                {/* Add New Time */}
                                <div className="flex items-center gap-3">
                                    <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
                                        className="bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-primary-500" />
                                    <button onClick={handleAddTime} disabled={!newTime}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 disabled:opacity-40 transition-colors">
                                        <Plus className="w-4 h-4" /> Add Time
                                    </button>
                                </div>
                                {/* Save */}
                                <div className="pt-2">
                                    <button onClick={handleSaveCfg} disabled={savingCfg}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm bg-primary-600 hover:bg-primary-500 text-white transition-colors disabled:opacity-60">
                                        {savingCfg ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Schedules</>}
                                    </button>
                                </div>
                                {/* Next upcoming times info */}
                                {status?.nextBackupTimes && status.nextBackupTimes.length > 0 && (
                                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-start gap-3">
                                        <Calendar className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                        <div className="text-sm text-emerald-300">
                                            <strong className="text-emerald-200">Active schedule times:</strong>
                                            <div className="mt-1 flex flex-wrap gap-2">
                                                {(status?.nextBackupTimes ?? []).map(t => (
                                                    <span key={t} className="font-mono bg-emerald-500/20 px-2 py-0.5 rounded text-xs text-emerald-200">{t}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* ── Tab: Email ── */}
                {activeTab === 'email' && cfg && cfg.email && (
                    <div className="p-6 space-y-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-white font-semibold mb-1">Email Delivery</h3>
                                <p className="text-dark-muted text-sm">Har backup ke baad, .sqlite file email attachment ke roop mein bheja jayega.</p>
                            </div>
                            <button onClick={() => setCfg({ ...cfg, email: { ...cfg.email, enabled: !cfg.email.enabled } })}
                                className={clsx('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors',
                                    cfg.email.enabled ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-dark-surface text-dark-muted border-dark-border')}>
                                {cfg.email.enabled ? '✓ Enabled' : 'Disabled'}
                            </button>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            {[
                                { label: 'SMTP Host', field: 'smtpHost', placeholder: 'smtp.gmail.com', type: 'text' },
                                { label: 'SMTP Port', field: 'smtpPort', placeholder: '587', type: 'number' },
                                { label: 'Email ID (Sender)', field: 'user', placeholder: 'yourmail@gmail.com', type: 'email' },
                                { label: 'App Password', field: 'pass', placeholder: 'Gmail App Password', type: 'password' },
                            ].map(({ label, field, placeholder, type }) => (
                                <div key={field}>
                                    <label className="block text-xs text-dark-muted mb-1.5">{label}</label>
                                    <input
                                        type={type}
                                        value={(cfg.email as unknown as Record<string, string | number>)[field] as string || ''}
                                        onChange={e => setCfg({ ...cfg, email: { ...cfg.email, [field]: type === 'number' ? parseInt(e.target.value) || 587 : e.target.value } })}
                                        placeholder={placeholder}
                                        className="w-full bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500"
                                    />
                                </div>
                            ))}
                        </div>
                        <div>
                            <label className="block text-xs text-dark-muted mb-1.5">Send Backup To (comma separated emails)</label>
                            <input type="text" value={cfg.email.to || ''}
                                onChange={e => setCfg({ ...cfg, email: { ...cfg.email, to: e.target.value } })}
                                placeholder="admin@company.com, backup@company.com"
                                className="w-full bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500" />
                        </div>

                        <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/20 text-xs text-sky-300 flex items-start gap-2">
                            <Info className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>Gmail ke liye: <strong className="text-sky-200">2-Step Verification</strong> enable karo aur <strong className="text-sky-200">App Password</strong> bano (<em>myaccount.google.com → Security → App Passwords</em>). Normal Gmail password kaam nahi karega.</span>
                        </div>

                        <button onClick={handleSaveCfg} disabled={savingCfg}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm bg-primary-600 hover:bg-primary-500 text-white transition-colors disabled:opacity-60">
                            {savingCfg ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Email Settings</>}
                        </button>
                    </div>
                )}

                {/* ── Tab: WhatsApp ── */}
                {activeTab === 'whatsapp' && cfg && cfg.whatsapp && (
                    <div className="p-6 space-y-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-white font-semibold mb-1">WhatsApp Delivery</h3>
                                <p className="text-dark-muted text-sm">Har backup ke baad, ek notification (aur agar possible ho, document) WhatsApp pe bheja jayega.</p>
                            </div>
                            <button onClick={() => setCfg({ ...cfg, whatsapp: { ...cfg.whatsapp, enabled: !cfg.whatsapp.enabled } })}
                                className={clsx('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors',
                                    cfg.whatsapp.enabled ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-dark-surface text-dark-muted border-dark-border')}>
                                {cfg.whatsapp.enabled ? '✓ Enabled' : 'Disabled'}
                            </button>
                        </div>

                        <div className="grid md:grid-cols-1 gap-4">
                            {[
                                { label: 'WhatsApp Phone Number ID (Meta Business)', field: 'phoneNumberId', placeholder: '1234567890123456' },
                                { label: 'WABA Bearer Token', field: 'wabaToken', placeholder: '••••••••••••' },
                                { label: 'Send To (Phone Number with country code)', field: 'to', placeholder: '919876543210 (no + required)' },
                            ].map(({ label, field, placeholder }) => (
                                <div key={field}>
                                    <label className="block text-xs text-dark-muted mb-1.5">{label}</label>
                                    <input type={field === 'wabaToken' ? 'password' : 'text'}
                                        value={(cfg.whatsapp as unknown as Record<string, string>)[field] || ''}
                                        onChange={e => setCfg({ ...cfg, whatsapp: { ...cfg.whatsapp, [field]: e.target.value } })}
                                        placeholder={placeholder}
                                        className="w-full bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-primary-500" />
                                </div>
                            ))}
                        </div>

                        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-300 flex items-start gap-2">
                            <Smartphone className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>
                                Phone Number ID aur Token aapke <strong className="text-green-200">Meta for Developers → WhatsApp → API Setup</strong> page pe milega. Yeh wahi credentials hain jo aapne WhatsApp Config page pe enter kiye hain.
                                WhatsApp par <strong className="text-green-200">.sqlite file send</strong> ho gi agar Meta Media Upload API accessible ho, warna notification message aayega.
                            </span>
                        </div>

                        <button onClick={handleSaveCfg} disabled={savingCfg}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm bg-primary-600 hover:bg-primary-500 text-white transition-colors disabled:opacity-60">
                            {savingCfg ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save WhatsApp Settings</>}
                        </button>
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
                        <li><strong className="text-blue-200">Schedules tab</strong> mein aap multiple daily times set kar sakte ho</li>
                        <li>Sirf last <strong className="text-blue-200">{status?.maxBackups ?? 7} backups</strong> rakhe jaate hain — purane auto-delete ho jaate hain</li>
                        <li>Email aur WhatsApp delivery <strong className="text-blue-200">startup backup pe nahi</strong> chalti — sirf scheduled/manual backups pe hoti hai</li>
                    </ul>
                </div>
            </div>

            <PasswordConfirmModal
                isOpen={showBackupConfirm}
                onClose={() => setShowBackupConfirm(false)}
                title="Confirm Manual Backup"
                description="This will immediately snapshot the entire database. It might cause slight latency for other active users for a few seconds."
                actionLabel="Generate Details & Backup"
                actionVariant="primary"
                onConfirm={handleBackupNow}
            />
        </div>
    );
}
