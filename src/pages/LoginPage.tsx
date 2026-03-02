import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';

import { clsx } from 'clsx';
import { ShieldAlert, ChevronRight, User, Key, AlertCircle, Eye, EyeOff, Building2, PlusCircle, ArrowLeft, Lock, Clock } from 'lucide-react';

export const LoginPage = () => {
    const { loginWithCredentials, isLoading, isAuthenticated } = useAuthStore();
    const navigate = useNavigate();
    const { switchCompany } = useMultiCompanyStore();

    // Redirect if already authenticated (no need to wait for companies — CompanyGuard handles that)
    useEffect(() => {
        if (isAuthenticated) {
            navigate('/dashboard', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    // View State: 'SELECTION' | 'LOGIN'
    const [loginView, setLoginView] = useState<'SELECTION' | 'LOGIN'>('SELECTION');

    // Shared State
    const [userId, setUserId] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
    const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);
    const lockoutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [rememberMe, setRememberMe] = useState(false);

    // Countdown timer for lockout
    useEffect(() => {
        if (lockoutSeconds > 0) {
            lockoutTimerRef.current = setInterval(() => {
                setLockoutSeconds(s => {
                    if (s <= 1) {
                        clearInterval(lockoutTimerRef.current!);
                        setError(null);
                        return 0;
                    }
                    return s - 1;
                });
            }, 1000);
        }
        return () => { if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current); };
    }, [lockoutSeconds]);

    // Initial load for Remember Me
    useEffect(() => {
        const savedUser = localStorage.getItem('remembered_user_id');
        const savedPass = localStorage.getItem('remembered_password');

        if (savedUser && savedPass) {
            setUserId(savedUser);
            setPassword(savedPass);
            setRememberMe(true);
        }
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setAttemptsRemaining(null);

        if (lockoutSeconds > 0) return; // prevent submit during lockout

        if (!userId.trim()) { setError('Please enter Login ID'); return; }
        if (!password.trim()) { setError('Please enter Password'); return; }

        const result = await loginWithCredentials(userId.trim(), password.trim());

        if (result === null) {
            // Success
            const loggedInUser = useAuthStore.getState().user;
            if (loggedInUser?.companyId) switchCompany(loggedInUser.companyId);
            if (rememberMe) {
                localStorage.setItem('remembered_user_id', userId.trim());
                localStorage.setItem('remembered_password', password.trim());
            } else {
                localStorage.removeItem('remembered_user_id');
                localStorage.removeItem('remembered_password');
            }
            navigate('/dashboard');
        } else {
            // Error
            setError(result.error);
            if (result.retryAfter) {
                setLockoutSeconds(result.retryAfter);
            } else if (result.attemptsRemaining !== undefined) {
                setAttemptsRemaining(result.attemptsRemaining);
            }
        }
    };

    // Developer shortcuts removed for production clarity

    // Render Selection View
    if (loginView === 'SELECTION') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0f172a] relative overflow-hidden p-4">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-600/10 rounded-full blur-3xl -translate-y-1/2" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary-600/10 rounded-full blur-3xl translate-y-1/2" />

                <div className="w-full max-w-4xl z-10 flex flex-col items-center animate-fade-in-up">
                    <div className="text-center mb-12">
                        <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary-500/20">
                            <ShieldAlert className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-white mb-3">SM PAYROLL</h1>
                        <p className="text-slate-400">Select an option to proceed</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl px-4">
                        <button
                            onClick={() => setLoginView('LOGIN')}
                            className="group relative bg-slate-900/50 backdrop-blur-xl border border-slate-700 hover:border-primary-500 rounded-2xl p-8 text-left transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary-500/20"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                            <div className="w-14 h-14 bg-slate-800 rounded-xl flex items-center justify-center mb-6 border border-slate-700 group-hover:bg-primary-500 group-hover:border-primary-400 transition-colors">
                                <Building2 className="w-7 h-7 text-primary-400 group-hover:text-white transition-colors" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Login</h3>
                            <p className="text-slate-400 text-sm">Access your Workspace</p>
                        </button>

                        <button
                            onClick={() => navigate('/company-setup')}
                            className="group relative bg-slate-900/50 backdrop-blur-xl border border-slate-700 hover:border-blue-500 rounded-2xl p-8 text-left transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-500/20"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                            <div className="w-14 h-14 bg-slate-800 rounded-xl flex items-center justify-center mb-6 border border-slate-700 group-hover:bg-blue-500 group-hover:border-blue-400 transition-colors">
                                <PlusCircle className="w-7 h-7 text-blue-400 group-hover:text-white transition-colors" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Create Company</h3>
                            <p className="text-slate-400 text-sm">Register New Organization</p>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Render Login Form
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0f172a] relative overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-600/20 rounded-full blur-3xl -translate-y-1/2" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary-600/20 rounded-full blur-3xl translate-y-1/2" />

            <div className="w-full max-w-md z-10 p-6">
                <button
                    onClick={() => {
                        setLoginView('SELECTION');
                        setPassword('');
                        setUserId('');
                        setError(null);
                    }}
                    className="mb-8 flex items-center text-slate-400 hover:text-white transition-colors text-sm font-medium"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Selection
                </button>

                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-2xl mb-6 bg-gradient-to-br from-primary-500 to-indigo-600 shadow-primary-500/30">
                        <Building2 className="text-white w-9 h-9" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
                        Login
                    </h1>
                    <p className="text-slate-400">
                        Enter your Login ID & Password
                    </p>
                </div>

                {/* Login Form */}
                <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-2xl p-6 shadow-xl mb-6 animate-in fade-in slide-in-from-bottom-4">
                    <form onSubmit={handleLogin} className="space-y-4">
                        {/* Lockout banner */}
                        {lockoutSeconds > 0 && (
                            <div className="bg-orange-500/10 border border-orange-500/30 text-orange-300 p-3 rounded-lg text-sm animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center gap-2 font-semibold mb-1">
                                    <Lock className="w-4 h-4" /> Account Locked
                                </div>
                                <div className="flex items-center gap-1.5 text-orange-400/80">
                                    <Clock className="w-3.5 h-3.5" />
                                    {Math.floor(lockoutSeconds / 60)}:{String(lockoutSeconds % 60).padStart(2, '0')} baad try karein
                                </div>
                            </div>
                        )}

                        {/* Normal error */}
                        {error && lockoutSeconds === 0 && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                                </div>
                                {attemptsRemaining !== null && attemptsRemaining > 0 && (
                                    <p className="mt-1 text-red-400/70 text-xs pl-6">
                                        ⚠️ {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining before 15-min lockout
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Login ID</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    type="text"
                                    value={userId}
                                    onChange={e => setUserId(e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all placeholder-slate-600 uppercase"
                                    placeholder="e.g. ADMIN-001"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Password</label>
                            <div className="relative">
                                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-2.5 pl-10 pr-10 text-white placeholder-slate-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all font-mono"
                                    placeholder="••••••••"
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

                        <div className="flex items-center justify-between px-1">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="peer hidden"
                                    />
                                    <div className="w-5 h-5 border-2 border-slate-700 rounded-md bg-slate-900 peer-checked:bg-primary-600 peer-checked:border-primary-600 transition-all flex items-center justify-center">
                                        <svg
                                            className={clsx("w-3.5 h-3.5 text-white transition-opacity", rememberMe ? "opacity-100" : "opacity-0")}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                </div>
                                <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">Remember Me</span>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || lockoutSeconds > 0}
                            className={clsx(
                                "w-full text-white font-bold py-3 rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2 mt-2",
                                lockoutSeconds > 0
                                    ? "bg-slate-700 cursor-not-allowed opacity-60"
                                    : "bg-primary-600 hover:bg-primary-500 shadow-primary-600/20"
                            )}
                        >
                            {isLoading ? 'Verifying...' : lockoutSeconds > 0 ? `Locked (${Math.floor(lockoutSeconds / 60)}:${String(lockoutSeconds % 60).padStart(2, '0')})` : 'Secure Login'}
                            {!isLoading && lockoutSeconds === 0 && <ChevronRight className="w-4 h-4" />}
                        </button>
                    </form>
                </div>

                <p className="text-center text-xs text-slate-600 mt-8">
                    Secure System • SM Payroll &copy; 2024
                </p>
            </div>
        </div>
    );
};
