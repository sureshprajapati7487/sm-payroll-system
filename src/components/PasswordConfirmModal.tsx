import { useState } from 'react';
import { X, Key, RefreshCw, EyeOff, Eye, ShieldAlert } from 'lucide-react';
import { apiJson } from '@/lib/apiClient';

interface PasswordConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description?: string;
    actionLabel?: string;
    actionVariant?: 'danger' | 'warning' | 'primary';
}

export const PasswordConfirmModal = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    actionLabel = 'Confirm Action',
    actionVariant = 'danger',
}: PasswordConfirmModalProps) => {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleConfirm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password.trim()) {
            setError('Password is required');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const res = await apiJson<{ valid: boolean, error?: string }>('POST', '/api/auth/verify-password', { password });
            if (res.valid) {
                setPassword('');
                onConfirm();
            } else {
                setError(res.error || 'Invalid password');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to verify password');
        } finally {
            setIsLoading(false);
        }
    };

    const variantClasses = {
        danger: 'bg-red-500 hover:bg-red-400 border-red-500',
        warning: 'bg-yellow-500 hover:bg-yellow-400 border-yellow-500 text-slate-900',
        primary: 'bg-primary-600 hover:bg-primary-500 border-primary-600',
    };

    const btnClass = variantClasses[actionVariant];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={!isLoading ? onClose : undefined} />
            <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden transform animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${actionVariant === 'danger' ? 'bg-red-500/20 text-red-400' :
                                actionVariant === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-primary-500/20 text-primary-400'
                            }`}>
                            <ShieldAlert className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-bold text-white">{title}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleConfirm} className="p-6 space-y-5">
                    {description && (
                        <p className="text-slate-400 text-sm leading-relaxed">
                            {description}
                        </p>
                    )}

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm font-medium animate-in slide-in-from-top-2">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Enter Password to Confirm
                        </label>
                        <div className="relative">
                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Your password or master password"
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-10 pr-10 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all placeholder-slate-600 font-mono"
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !password.trim()}
                            className={`flex-1 py-2.5 border rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-white shadow-lg ${btnClass}`}
                        >
                            {isLoading ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    Verifying...
                                </>
                            ) : (
                                actionLabel
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
