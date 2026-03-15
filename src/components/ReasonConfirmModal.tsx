import { useState } from 'react';
import { X, AlertTriangle, MessageSquare, CheckCircle2 } from 'lucide-react';

interface ReasonConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    title: string;
    description: string;
    actionLabel?: string;
    actionVariant?: 'danger' | 'warning' | 'primary';
    matchText?: string; // If provided, user must type this exact text to confirm e.g., "DELETE EMP-001"
}

export const ReasonConfirmModal = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    actionLabel = 'Confirm Action',
    actionVariant = 'danger',
    matchText
}: ReasonConfirmModalProps) => {
    const [reason, setReason] = useState('');
    const [matchInput, setMatchInput] = useState('');
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const isMatchValid = !matchText || matchInput === matchText;
    const isReasonValid = reason.trim().length >= 5;

    const handleConfirm = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isReasonValid) {
            setError('Please provide a valid reason (min 5 characters).');
            return;
        }
        if (!isMatchValid) {
            setError('The confirmation text does not match.');
            return;
        }

        setError(null);
        onConfirm(reason.trim());
        setReason('');
        setMatchInput('');
    };

    const handleClose = () => {
        setReason('');
        setMatchInput('');
        setError(null);
        onClose();
    };

    const variantClasses = {
        danger: 'bg-red-500 hover:bg-red-400 border-red-500',
        warning: 'bg-yellow-500 hover:bg-yellow-400 border-yellow-500 text-slate-900',
        primary: 'bg-primary-600 hover:bg-primary-500 border-primary-600',
    };

    const btnClass = variantClasses[actionVariant];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
            <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden transform animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${actionVariant === 'danger' ? 'bg-red-500/20 text-red-400' :
                                actionVariant === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-primary-500/20 text-primary-400'
                            }`}>
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-bold text-white">{title}</h2>
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-slate-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleConfirm} className="p-6 space-y-5">
                    <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                        <p className="text-slate-300 text-sm leading-relaxed">
                            {description}
                        </p>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm font-medium animate-in slide-in-from-top-2">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            Reason for this action
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Please provide a reason..."
                            rows={3}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all placeholder-slate-600 resize-none font-mono text-sm"
                            autoFocus
                        />
                    </div>

                    {matchText && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                To confirm, type "{matchText}" below:
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={matchInput}
                                    onChange={(e) => setMatchInput(e.target.value)}
                                    placeholder={matchText}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 pr-10 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all placeholder-slate-700 font-mono"
                                />
                                {isMatchValid && matchInput !== '' && (
                                    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500 animate-in zoom-in" />
                                )}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!isReasonValid || !isMatchValid}
                            className={`flex-1 py-2.5 border rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg ${btnClass}`}
                        >
                            {actionLabel}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
