import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CapacitorHttp } from '@capacitor/core';
import { API_URL } from '@/lib/apiConfig';
import { clsx } from 'clsx';
import {
    ShieldAlert, User, Mail, Phone, Building2, Key, Eye, EyeOff,
    AlertCircle, CheckCircle2, ArrowLeft, ChevronRight, Loader2,
} from 'lucide-react';

interface SignupResult {
    employeeCode: string;
    companyName: string;
    message: string;
}

export const SignupPage = () => {
    const navigate = useNavigate();

    const [form, setForm] = useState({
        name: '',
        email: '',
        phone: '',
        companyCode: '',
        password: '',
        confirmPassword: '',
    });

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<SignupResult | null>(null);

    const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm(prev => ({ ...prev, [field]: e.target.value }));
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Client-side quick checks
        if (!form.name.trim() || !form.email.trim() || !form.phone.trim() ||
            !form.companyCode.trim() || !form.password || !form.confirmPassword) {
            setError('All Fields Required — Sabhi fields bharni zaroori hain');
            return;
        }
        if (form.password !== form.confirmPassword) {
            setError('Passwords Do Not Match — Dono passwords same hone chahiye');
            return;
        }
        if (form.password.length < 8) {
            setError('Password Too Short — Kam se kam 8 characters ka password banayein');
            return;
        }

        setIsLoading(true);
        try {
            const res = await CapacitorHttp.post({
                url: `${API_URL}/auth/signup`,
                headers: { 'Content-Type': 'application/json' },
                data: {
                    name: form.name.trim(),
                    email: form.email.trim(),
                    phone: form.phone.trim(),
                    companyCode: form.companyCode.trim().toUpperCase(),
                    password: form.password,
                    confirmPassword: form.confirmPassword,
                },
            });

            if (res.status === 201 && res.data.success) {
                setSuccess({
                    employeeCode: res.data.employeeCode,
                    companyName: res.data.companyName,
                    message: res.data.message,
                });
            } else {
                setError(res.data.error || 'Signup failed — Please try again');
            }
        } catch {
            setError('Network Error — Server se connect nahi ho pa raha. Server chal raha hai?');
        } finally {
            setIsLoading(false);
        }
    };

    // ── Success State ──────────────────────────────────────────────────────────
    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0f172a] relative overflow-hidden p-4">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-600/10 rounded-full blur-3xl -translate-y-1/2" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl translate-y-1/2" />

                <div className="w-full max-w-md z-10 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-slate-800/50 backdrop-blur-md border border-green-500/30 rounded-2xl p-8 shadow-xl text-center">
                        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="w-9 h-9 text-green-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Registration Successful!</h2>
                        <p className="text-green-400 text-sm mb-6">Account ban gaya — Admin approval ka wait karein</p>

                        <div className="bg-slate-900/60 rounded-xl p-4 mb-6 text-left space-y-3">
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Company</p>
                                <p className="text-white font-semibold">{success.companyName}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Temporary Employee Code</p>
                                <p className="text-primary-400 font-mono font-bold text-lg">{success.employeeCode}</p>
                                <p className="text-xs text-slate-500 mt-1">Admin yeh code aapke permanent ID se replace karega</p>
                            </div>
                        </div>

                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-6 text-left">
                            <p className="text-amber-300 text-sm font-semibold mb-1">Next Steps</p>
                            <ol className="text-amber-300/70 text-xs space-y-1 list-decimal list-inside">
                                <li>Apne Admin ko batayein ki aapne signup kar liya</li>
                                <li>Admin aapka account ACTIVE karega</li>
                                <li>ACTIVE hone ke baad aap login kar sakenge</li>
                            </ol>
                        </div>

                        <button
                            onClick={() => navigate('/login')}
                            className="w-full bg-primary-600 hover:bg-primary-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" /> Login Page Par Jayein
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Signup Form ────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0f172a] relative overflow-hidden py-8 px-4">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-600/20 rounded-full blur-3xl -translate-y-1/2" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary-600/20 rounded-full blur-3xl translate-y-1/2" />

            <div className="w-full max-w-md z-10">
                <button
                    onClick={() => navigate('/login')}
                    className="mb-6 flex items-center text-slate-400 hover:text-white transition-colors text-sm font-medium"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Login
                </button>

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-primary-500/30">
                        <ShieldAlert className="w-9 h-9 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">Create Account</h1>
                    <p className="text-slate-400 text-sm">SM Payroll mein register karein</p>
                </div>

                {/* Form Card */}
                <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-2xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4">
                    <form onSubmit={handleSubmit} className="space-y-4">

                        {/* Error */}
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm animate-in fade-in slide-in-from-top-2 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Full Name */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Full Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={set('name')}
                                    placeholder="e.g. Suresh Kumar"
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all placeholder-slate-600"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={set('email')}
                                    placeholder="you@example.com"
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all placeholder-slate-600"
                                />
                            </div>
                        </div>

                        {/* Phone */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Phone</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="tel"
                                    value={form.phone}
                                    onChange={set('phone')}
                                    placeholder="e.g. 9876543210"
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all placeholder-slate-600"
                                />
                            </div>
                        </div>

                        {/* Company Code */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                                Company Code
                                <span className="ml-2 text-slate-600 normal-case">(Admin se maangein)</span>
                            </label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="text"
                                    value={form.companyCode}
                                    onChange={set('companyCode')}
                                    placeholder="e.g. AEROMEN"
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all placeholder-slate-600 uppercase"
                                />
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-slate-700/60 pt-1" />

                        {/* Password */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Password</label>
                            <div className="relative">
                                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={form.password}
                                    onChange={set('password')}
                                    placeholder="Kam se kam 8 characters"
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-2.5 pl-10 pr-10 text-white placeholder-slate-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all font-mono"
                                />
                                <button type="button" onClick={() => setShowPassword(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {form.password.length > 0 && form.password.length < 8 && (
                                <p className="text-xs text-amber-400/80 pl-1">⚠️ {8 - form.password.length} more character{8 - form.password.length !== 1 ? 's' : ''} needed</p>
                            )}
                        </div>

                        {/* Confirm Password */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Confirm Password</label>
                            <div className="relative">
                                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type={showConfirm ? 'text' : 'password'}
                                    value={form.confirmPassword}
                                    onChange={set('confirmPassword')}
                                    placeholder="Password dobara darj karein"
                                    className={clsx(
                                        'w-full bg-slate-900/50 border rounded-lg py-2.5 pl-10 pr-10 text-white placeholder-slate-600 focus:ring-1 outline-none transition-all font-mono',
                                        form.confirmPassword && form.password !== form.confirmPassword
                                            ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
                                            : 'border-slate-700 focus:border-primary-500 focus:ring-primary-500'
                                    )}
                                />
                                <button type="button" onClick={() => setShowConfirm(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {form.confirmPassword && form.password !== form.confirmPassword && (
                                <p className="text-xs text-red-400/80 pl-1">✗ Passwords match nahi kar rahe</p>
                            )}
                            {form.confirmPassword && form.password === form.confirmPassword && form.password.length >= 8 && (
                                <p className="text-xs text-green-400/80 pl-1">✓ Passwords match</p>
                            )}
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-primary-600 hover:bg-primary-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-primary-600/20 flex items-center justify-center gap-2 mt-2"
                        >
                            {isLoading
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Registering...</>
                                : <><ChevronRight className="w-4 h-4" /> Create Account</>
                            }
                        </button>
                    </form>
                </div>

                <p className="text-center text-xs text-slate-600 mt-6">
                    Already registered?{' '}
                    <button onClick={() => navigate('/login')} className="text-primary-400 hover:text-primary-300 transition-colors font-medium">
                        Login karein
                    </button>
                </p>

                <p className="text-center text-xs text-slate-700 mt-3">
                    Secure System • SM Payroll &copy; {new Date().getFullYear()}
                </p>
            </div>
        </div>
    );
};
