import { AlertTriangle, X } from 'lucide-react';
import { clsx } from 'clsx';

interface WarningModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    severity?: 'warning' | 'danger';
}

export const WarningModal = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    severity = 'warning'
}: WarningModalProps) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 relative">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex flex-col items-center text-center">
                    <div className={clsx(
                        "w-16 h-16 rounded-2xl flex items-center justify-center mb-4",
                        severity === 'danger' ? "bg-red-500/10" : "bg-yellow-500/10"
                    )}>
                        <AlertTriangle className={clsx(
                            "w-8 h-8",
                            severity === 'danger' ? "text-red-500" : "text-yellow-500"
                        )} />
                    </div>

                    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                    <p className="text-slate-400 mb-6 text-sm leading-relaxed">
                        {message}
                    </p>

                    <div className="flex w-full gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors border border-slate-700"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={() => {
                                onConfirm();
                                onClose();
                            }}
                            className={clsx(
                                "flex-1 py-2.5 px-4 rounded-lg font-bold shadow-lg transition-all",
                                severity === 'danger'
                                    ? "bg-red-600 hover:bg-red-500 text-white shadow-red-600/20"
                                    : "bg-yellow-500 hover:bg-yellow-400 text-slate-900 shadow-yellow-500/20"
                            )}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
