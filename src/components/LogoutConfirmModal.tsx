/**
 * LogoutConfirmModal.tsx
 *
 * Logout se pehle Super Admin ka password verify karo.
 * Galat password pe logout nahi hoga.
 */
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Eye, EyeOff, ShieldAlert, X, Lock } from 'lucide-react';
import { API_URL } from '@/lib/apiConfig';

interface Props {
    isOpen: boolean;
    onConfirmed: () => void;   // Password sahi → logout karo
    onCancel: () => void;      // Modal band karo
}

export function LogoutConfirmModal({ isOpen, onConfirmed, onCancel }: Props) {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Reset state when opened
    useEffect(() => {
        if (isOpen) {
            setPassword('');
            setError(null);
            setShowPassword(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password.trim()) {
            setError('Password daalna zaroori hai');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            // Verify by attempting a login with SUPER_ADMIN credentials
            // We send the stored user's ID + the typed password to verify
            const res = await fetch(`${API_URL}/auth/verify-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ password: password.trim() }),
            });
            const data = await res.json();
            if (res.ok && data.valid) {
                onConfirmed();
            } else {
                setError(data.error || 'Galat password — logout cancel kiya gaya');
                setPassword('');
                inputRef.current?.focus();
            }
        } catch {
            setError('Server se connect nahi ho saka');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                    onClick={onCancel}
                >
                    <motion.div
                        initial={{ scale: 0.92, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.92, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                        className="bg-dark-card border border-dark-border rounded-2xl shadow-2xl w-full max-w-sm p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                                    <LogOut className="w-5 h-5 text-red-400" />
                                </div>
                                <div>
                                    <h2 className="text-white font-bold text-base">Logout Confirm</h2>
                                    <p className="text-dark-muted text-xs mt-0.5">Super Admin password daalo</p>
                                </div>
                            </div>
                            <button
                                onClick={onCancel}
                                className="p-1.5 rounded-lg text-dark-muted hover:text-white hover:bg-dark-border/50 transition-all"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Warning banner */}
                        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-5">
                            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                            <p className="text-amber-300 text-xs leading-snug">
                                Logout se pehle Super Admin password verify karna zaroori hai
                            </p>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleVerify} className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-1.5 block">
                                    Super Admin Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
                                    <input
                                        ref={inputRef}
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => { setPassword(e.target.value); setError(null); }}
                                        className="w-full bg-dark-surface border border-dark-border rounded-xl py-2.5 pl-10 pr-10 text-white text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all placeholder-dark-muted font-mono"
                                        placeholder="••••••••"
                                        disabled={loading}
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(v => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted hover:text-white transition-colors"
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Error */}
                            {error && (
                                <motion.p
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-red-400 text-xs flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg"
                                >
                                    ❌ {error}
                                </motion.p>
                            )}

                            {/* Buttons */}
                            <div className="flex gap-2.5 pt-1">
                                <button
                                    type="button"
                                    onClick={onCancel}
                                    disabled={loading}
                                    className="flex-1 py-2.5 rounded-xl border border-dark-border text-dark-muted hover:text-white hover:border-dark-muted transition-all text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || !password.trim()}
                                    className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <LogOut className="w-3.5 h-3.5" />
                                            Logout
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
