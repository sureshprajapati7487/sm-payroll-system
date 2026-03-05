import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Info, Trash2, XCircle, X, RefreshCw } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info' | 'warning';
interface Toast { id: number; type: ToastType; message: string; }

interface DialogOptions {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'info';
    detail?: string; // extra info below message
}
interface DialogState extends DialogOptions {
    onConfirm: () => void;
    onCancel: () => void;
}

interface DialogCtx {
    // Toast
    toast: (message: string, type?: ToastType) => void;
    // Confirm dialog — returns promise<boolean>
    confirm: (opts: DialogOptions) => Promise<boolean>;
    // Alert dialog — returns promise<void>
    alert: (opts: Pick<DialogOptions, 'title' | 'message' | 'variant' | 'detail'>) => Promise<void>;
}

const DialogContext = createContext<DialogCtx | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export const DialogProvider = ({ children }: { children: ReactNode }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [dialog, setDialog] = useState<DialogState | null>(null);

    // Toast
    const toast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Date.now();
        setToasts(p => [...p, { id, type, message }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
    }, []);

    // Confirm
    const confirm = useCallback((opts: DialogOptions): Promise<boolean> =>
        new Promise(resolve => {
            setDialog({
                ...opts,
                onConfirm: () => { setDialog(null); resolve(true); },
                onCancel: () => { setDialog(null); resolve(false); },
            });
        }), []);

    // Alert
    const alert = useCallback((opts: Pick<DialogOptions, 'title' | 'message' | 'variant' | 'detail'>): Promise<void> =>
        new Promise<void>(resolve => {
            setDialog({
                ...opts,
                confirmLabel: 'OK',
                cancelLabel: undefined,
                onConfirm: () => { setDialog(null); resolve(); },
                onCancel: () => { setDialog(null); resolve(); },
            });
        }), []);

    // Listen for global session expiry events
    useEffect(() => {
        const handleSessionExpired = (e: any) => {
            const msg = e.detail?.message || 'Your session has expired. Please login again.';
            toast(msg, 'error');
            setTimeout(() => {
                window.location.href = '/';
            }, 3000); // 3 second delay for user to read the toast
        };
        window.addEventListener('session-expired', handleSessionExpired);
        return () => window.removeEventListener('session-expired', handleSessionExpired);
    }, [toast]);

    return (
        <DialogContext.Provider value={{ toast, confirm, alert }}>
            {children}

            {/* ── Toast Container ─────────────────────────────────────────── */}
            <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
                {toasts.map(t => (
                    <div
                        key={t.id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium pointer-events-auto
                            backdrop-blur-md animate-in slide-in-from-right-4 duration-300
                            ${t.type === 'success' ? 'bg-green-500/20 border-green-500/40 text-green-300' :
                                t.type === 'error' ? 'bg-red-500/20 border-red-500/40 text-red-300' :
                                    t.type === 'warning' ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' :
                                        'bg-blue-500/20 border-blue-500/40 text-blue-300'}`}
                    >
                        {t.type === 'success' && <CheckCircle className="w-4 h-4 shrink-0" />}
                        {t.type === 'error' && <XCircle className="w-4 h-4 shrink-0" />}
                        {t.type === 'warning' && <AlertTriangle className="w-4 h-4 shrink-0" />}
                        {t.type === 'info' && <Info className="w-4 h-4 shrink-0" />}
                        <span>{t.message}</span>
                        <button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))} className="ml-2 opacity-60 hover:opacity-100">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ))}
            </div>

            {/* ── Dialog Modal ─────────────────────────────────────────────── */}
            {dialog && <DialogModal dialog={dialog} />}
        </DialogContext.Provider>
    );
};

// ─── Dialog Modal ─────────────────────────────────────────────────────────────
const VARIANT_META = {
    danger: { icon: Trash2, iconBg: 'bg-red-500/20', iconColor: 'text-red-400', bar: 'from-red-500 to-rose-600', btnClass: 'bg-red-500 hover:bg-red-400 shadow-red-500/30' },
    warning: { icon: AlertTriangle, iconBg: 'bg-yellow-500/20', iconColor: 'text-yellow-400', bar: 'from-yellow-500 to-orange-500', btnClass: 'bg-yellow-500 hover:bg-yellow-400 shadow-yellow-500/30' },
    info: { icon: Info, iconBg: 'bg-blue-500/20', iconColor: 'text-blue-400', bar: 'from-blue-500 to-indigo-500', btnClass: 'bg-blue-500 hover:bg-blue-400 shadow-blue-500/30' },
};

const DialogModal = ({ dialog }: { dialog: DialogState }) => {
    const [loading, setLoading] = useState(false);
    const variant = VARIANT_META[dialog.variant || 'info'];
    const Icon = variant.icon;
    const isConfirmOnly = !dialog.cancelLabel && dialog.confirmLabel === 'OK';

    const handleConfirm = async () => {
        setLoading(true);
        dialog.onConfirm();
    };
    const handleCancel = () => {
        if (!loading) dialog.onCancel();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleCancel} />
            <div className="relative glass rounded-2xl border border-dark-border w-full max-w-sm shadow-2xl overflow-hidden">
                {/* Color bar */}
                <div className={`h-1.5 w-full bg-gradient-to-r ${variant.bar}`} />
                <div className="p-6 space-y-5">
                    {/* Icon + Title */}
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl ${variant.iconBg} border border-white/10 flex items-center justify-center shrink-0`}>
                            <Icon className={`w-6 h-6 ${variant.iconColor}`} />
                        </div>
                        <div>
                            {dialog.title && <h2 className="text-white font-bold text-base">{dialog.title}</h2>}
                            <p className="text-dark-muted text-sm leading-relaxed">{dialog.message}</p>
                        </div>
                    </div>
                    {/* Detail box */}
                    {dialog.detail && (
                        <div className="bg-dark-surface rounded-xl px-4 py-3 text-dark-muted text-xs leading-relaxed border border-dark-border">
                            {dialog.detail}
                        </div>
                    )}
                    {/* Buttons */}
                    <div className="flex gap-3">
                        {!isConfirmOnly && dialog.cancelLabel !== undefined && (
                            <button
                                onClick={handleCancel}
                                disabled={loading}
                                className="flex-1 py-2.5 rounded-xl border border-dark-border text-dark-muted hover:text-white hover:border-white/20 text-sm font-semibold transition-all disabled:opacity-50"
                            >
                                {dialog.cancelLabel || 'Cancel'}
                            </button>
                        )}
                        <button
                            onClick={handleConfirm}
                            disabled={loading}
                            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-60 ${variant.btnClass}`}
                        >
                            {loading
                                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Please wait...</>
                                : dialog.confirmLabel || 'Confirm'
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useDialog = (): DialogCtx => {
    const ctx = useContext(DialogContext);
    if (!ctx) throw new Error('useDialog must be used inside DialogProvider');
    return ctx;
};
