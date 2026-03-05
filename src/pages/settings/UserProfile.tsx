import { useState } from 'react';
import { User, Camera, Mail, Phone, MapPin, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { PasswordStrengthInput, isPasswordValid } from '@/components/ui/PasswordStrengthInput';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const UserProfile = () => {
    const { user: authUser } = useAuthStore();
    const { employees } = useEmployeeStore();

    // Match logged-in user to employee record for full details
    const linkedEmployee = employees.find(
        e => e.email === authUser?.email || e.id === authUser?.id || e.code === authUser?.id
    );
    const user = linkedEmployee ? { ...authUser, ...linkedEmployee } : authUser;

    // ── Password Change State ──────────────────────────────────────────────────
    const [pwdForm, setPwdForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [pwdLoading, setPwdLoading] = useState(false);
    const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);
    const [pwdError, setPwdError] = useState<string | null>(null);

    // Confirm match validation
    const confirmMismatch =
        pwdForm.confirmPassword.length > 0 &&
        pwdForm.newPassword !== pwdForm.confirmPassword;

    const canSubmit =
        pwdForm.currentPassword.length > 0 &&
        isPasswordValid(pwdForm.newPassword) &&
        pwdForm.newPassword === pwdForm.confirmPassword;

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwdError(null);
        setPwdSuccess(null);

        if (!canSubmit) return;

        const empId = (user as any)?.id;
        if (!empId) {
            setPwdError('Employee ID nahi mila. Please re-login karein.');
            return;
        }

        setPwdLoading(true);
        try {
            const res = await fetch(`${API_URL}/employees/${empId}/change-password`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword: pwdForm.currentPassword.trim(),
                    newPassword: pwdForm.newPassword.trim(),
                }),
            });
            const data = await res.json();

            if (res.ok) {
                setPwdSuccess('✅ Password successfully change ho gaya! Next login se new password use karein.');
                setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            } else {
                setPwdError(data.error || 'Password change nahi hua. Please try again.');
            }
        } catch {
            setPwdError('Network error — server se connect nahi ho paya.');
        } finally {
            setPwdLoading(false);
        }
    };

    if (!user) return <div className="p-6 text-white">Loading...</div>;

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <User className="w-8 h-8 text-primary-500" />
                My Profile
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* ── Profile Card ─────────────────────────────────────────── */}
                <div className="glass rounded-2xl p-6 text-center space-y-4 h-fit">
                    <div className="relative w-32 h-32 mx-auto">
                        <img
                            src={(user as any).avatar || `https://ui-avatars.com/api/?name=${user.name}&background=random`}
                            alt={user.name}
                            className="w-full h-full rounded-full object-cover border-4 border-dark-surface"
                        />
                        <button className="absolute bottom-0 right-0 p-2 bg-primary-500 rounded-full text-white hover:bg-primary-600 transition-all">
                            <Camera className="w-4 h-4" />
                        </button>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-white">{user.name}</h2>
                        <p className="text-primary-400 font-medium">{(user as any).designation || user.role}</p>
                        <span className="inline-block mt-2 px-3 py-1 bg-dark-surface rounded-full text-xs text-dark-muted">
                            {(user as any).code || 'ID: ' + user.id}
                        </span>
                    </div>

                    <div className="pt-4 border-t border-dark-border text-left space-y-3">
                        <div className="flex items-center gap-3 text-dark-muted text-sm">
                            <Mail className="w-4 h-4" />{user.email}
                        </div>
                        <div className="flex items-center gap-3 text-dark-muted text-sm">
                            <Phone className="w-4 h-4" />{(user as any).phone || 'No phone added'}
                        </div>
                        <div className="flex items-center gap-3 text-dark-muted text-sm">
                            <MapPin className="w-4 h-4" />{(user as any).department || 'General'}
                        </div>
                    </div>
                </div>

                {/* ── Right Panel ──────────────────────────────────────────── */}
                <div className="md:col-span-2 space-y-6">

                    {/* Info Card */}
                    <div className="glass rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Account Info</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            {[
                                { label: 'Full Name', value: user.name },
                                { label: 'Email', value: user.email },
                                { label: 'Role', value: user.role },
                                { label: 'Department', value: (user as any).department || '—' },
                                { label: 'Phone', value: (user as any).phone || '—' },
                                { label: 'Joining Date', value: (user as any).joiningDate ? new Date((user as any).joiningDate).toLocaleDateString('en-IN') : '—' },
                            ].map(({ label, value }) => (
                                <div key={label}>
                                    <p className="text-dark-muted text-xs uppercase tracking-wide mb-1">{label}</p>
                                    <p className="text-white font-medium">{value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Change Password Card ─────────────────────────────── */}
                    <div className="glass rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-primary-400" />
                            Change Password
                        </h3>
                        <p className="text-dark-muted text-sm mb-6">
                            Apna current password verify karein, phir new secure password set karein.
                        </p>

                        {/* Success Banner */}
                        {pwdSuccess && (
                            <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/30 text-green-300 rounded-xl px-4 py-3 mb-4 text-sm animate-in fade-in slide-in-from-top-2">
                                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <span>{pwdSuccess}</span>
                            </div>
                        )}

                        {/* Error Banner */}
                        {pwdError && (
                            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 mb-4 text-sm animate-in fade-in slide-in-from-top-2">
                                <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <span>{pwdError}</span>
                            </div>
                        )}

                        <form onSubmit={handlePasswordChange} className="space-y-5">
                            {/* Current Password */}
                            <div className="space-y-1">
                                <label className="text-xs text-dark-muted uppercase tracking-wider">Current Password</label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        value={pwdForm.currentPassword}
                                        onChange={e => {
                                            setPwdForm(f => ({ ...f, currentPassword: e.target.value }));
                                            setPwdError(null);
                                            setPwdSuccess(null);
                                        }}
                                        placeholder="Your current password"
                                        className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-white text-sm focus:border-primary-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* New Password with Strength Meter */}
                            <PasswordStrengthInput
                                label="New Password"
                                value={pwdForm.newPassword}
                                onChange={v => {
                                    setPwdForm(f => ({ ...f, newPassword: v }));
                                    setPwdError(null);
                                    setPwdSuccess(null);
                                }}
                                placeholder="Min 8 chars, 1 number, 1 letter"
                                showStrength={true}
                            />

                            {/* Confirm Password */}
                            <div className="space-y-1">
                                <label className="text-xs text-dark-muted uppercase tracking-wider">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={pwdForm.confirmPassword}
                                    onChange={e => setPwdForm(f => ({ ...f, confirmPassword: e.target.value }))}
                                    placeholder="Re-enter new password"
                                    className={`w-full bg-dark-bg border rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-colors ${confirmMismatch
                                        ? 'border-red-500/60 focus:border-red-500'
                                        : pwdForm.confirmPassword && !confirmMismatch
                                            ? 'border-green-500/60 focus:border-green-500'
                                            : 'border-dark-border focus:border-primary-500'
                                        }`}
                                />
                                {confirmMismatch && (
                                    <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
                                        <XCircle className="w-3.5 h-3.5" /> Passwords match nahi kar rahe
                                    </p>
                                )}
                                {pwdForm.confirmPassword && !confirmMismatch && (
                                    <p className="text-xs text-green-400 flex items-center gap-1 mt-1">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match kar rahe hain
                                    </p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={!canSubmit || pwdLoading}
                                className="w-full py-3 bg-primary-600 hover:bg-primary-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-primary-600/20"
                            >
                                {pwdLoading
                                    ? <><span className="animate-spin">⟳</span> Updating...</>
                                    : <><ShieldCheck className="w-4 h-4" /> Update Password</>
                                }
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};
