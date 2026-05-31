import { useState, useEffect } from 'react';
import { API_URL } from '@/lib/apiConfig';
import { useAuthStore } from '@/store/authStore';
import {
    User, Banknote, CalendarCheck, CreditCard,
    Clock, CheckCircle, XCircle, AlertCircle, Plus, Loader2,
} from 'lucide-react';

interface ESSData {
    profile: any;
    latestSlip: any;
    leaves: any[];
    loans: any[];
    attendance: any[];
}

function authHeader() {
    try {
        const raw = localStorage.getItem('auth-storage');
        const token = raw ? JSON.parse(raw)?.state?.token : null;
        return token ? { Authorization: `Bearer ${token}` } : {};
    } catch { return {}; }
}

const STATUS_ICON: Record<string, JSX.Element> = {
    PRESENT: <CheckCircle className="w-4 h-4 text-success" />,
    ABSENT: <XCircle className="w-4 h-4 text-danger" />,
    LATE: <AlertCircle className="w-4 h-4 text-warning" />,
    HALF_DAY: <AlertCircle className="w-4 h-4 text-info" />,
    ON_LEAVE: <CalendarCheck className="w-4 h-4 text-primary-400" />,
};

export const ESSDashboard = () => {
    const { user } = useAuthStore();
    const [data, setData] = useState<ESSData>({ profile: null, latestSlip: null, leaves: [], loans: [], attendance: [] });
    const [loading, setLoading] = useState(true);
    const [showLeaveForm, setShowLeaveForm] = useState(false);
    const [leaveForm, setLeaveForm] = useState({ type: 'CASUAL', startDate: '', endDate: '', reason: '' });
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

    useEffect(() => {
        const load = async () => {
            const h = authHeader();
            const [profileRes, payslipsRes, leavesRes, loansRes, attRes] = await Promise.allSettled([
                fetch(`${API_URL}/ess/me`, { headers: h }),
                fetch(`${API_URL}/ess/payslips`, { headers: h }),
                fetch(`${API_URL}/ess/leaves`, { headers: h }),
                fetch(`${API_URL}/ess/loans`, { headers: h }),
                fetch(`${API_URL}/ess/attendance`, { headers: h }),
            ]);
            const profile = profileRes.status === 'fulfilled' && profileRes.value.ok ? await profileRes.value.json() : null;
            const payslips = payslipsRes.status === 'fulfilled' && payslipsRes.value.ok ? await payslipsRes.value.json() : [];
            const leaves = leavesRes.status === 'fulfilled' && leavesRes.value.ok ? await leavesRes.value.json() : [];
            const loans = loansRes.status === 'fulfilled' && loansRes.value.ok ? await loansRes.value.json() : [];
            const attendance = attRes.status === 'fulfilled' && attRes.value.ok ? await attRes.value.json() : [];
            setData({ profile, latestSlip: payslips[0] || null, leaves, loans, attendance });
            setLoading(false);
        };
        load();
    }, []);

    const handleApplyLeave = async () => {
        if (!leaveForm.startDate || !leaveForm.endDate) { showToast('Start and end date required'); return; }
        setSubmitting(true);
        try {
            const res = await fetch(`${API_URL}/ess/leaves`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeader() },
                body: JSON.stringify(leaveForm),
            });
            if (!res.ok) throw new Error('Failed to apply leave');
            const newLeave = await res.json();
            setData(d => ({ ...d, leaves: [newLeave, ...d.leaves] }));
            setShowLeaveForm(false);
            showToast('Leave applied successfully');
        } catch (e: any) { showToast(e.message); }
        setSubmitting(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
            </div>
        );
    }

    const { profile, latestSlip, leaves, loans, attendance } = data;
    const activeLoans = loans.filter((l: any) => l.status === 'ACTIVE');
    const totalLoanBalance = activeLoans.reduce((s: number, l: any) => s + (l.balance || 0), 0);
    const leaveBalance = profile?.leaveBalance || {};
    const last7Att = attendance.slice(0, 7);

    return (
        <div className="max-w-md mx-auto px-4 py-6 space-y-4 pb-20">
            {/* Toast */}
            {toast && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-dark-card border border-dark-border text-dark-text text-sm rounded-lg shadow-xl">
                    {toast}
                </div>
            )}

            {/* Profile Card */}
            <div className="glass rounded-2xl p-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-primary-600/20 flex items-center justify-center shrink-0">
                    {profile?.avatar
                        ? <img src={profile.avatar} className="w-full h-full rounded-xl object-cover" alt="" />
                        : <User className="w-7 h-7 text-primary-400" />}
                </div>
                <div className="min-w-0">
                    <p className="font-bold text-dark-text text-lg truncate">{profile?.name || user?.name}</p>
                    <p className="text-dark-muted text-sm truncate">{profile?.designation} · {profile?.department}</p>
                    <p className="text-xs text-dark-muted">{profile?.code}</p>
                </div>
            </div>

            {/* Payslip Card */}
            <div className="glass rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                    <Banknote className="w-5 h-5 text-success" />
                    <span className="font-semibold text-dark-text">This Month's Payslip</span>
                </div>
                {latestSlip ? (
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-dark-bg/50 rounded-xl p-3">
                            <p className="text-xs text-dark-muted mb-1">Gross</p>
                            <p className="font-bold text-success">₹{(latestSlip.grossSalary || 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-dark-bg/50 rounded-xl p-3">
                            <p className="text-xs text-dark-muted mb-1">Net Pay</p>
                            <p className="font-bold text-primary-400">₹{(latestSlip.netSalary || 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-dark-bg/50 rounded-xl p-3">
                            <p className="text-xs text-dark-muted mb-1">Deductions</p>
                            <p className="font-bold text-danger">₹{(latestSlip.totalDeductions || 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-dark-bg/50 rounded-xl p-3">
                            <p className="text-xs text-dark-muted mb-1">Status</p>
                            <p className="font-bold text-xs text-warning">{latestSlip.status}</p>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-dark-muted">No payslip generated yet for this month.</p>
                )}
            </div>

            {/* Leave Balance + Quick Apply */}
            <div className="glass rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <CalendarCheck className="w-5 h-5 text-info" />
                        <span className="font-semibold text-dark-text">Leave Balance</span>
                    </div>
                    <button onClick={() => setShowLeaveForm(!showLeaveForm)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-primary-600/20 text-primary-400 hover:bg-primary-600/30 rounded-lg text-xs font-medium transition-colors">
                        <Plus className="w-3.5 h-3.5" /> Apply
                    </button>
                </div>
                <div className="flex gap-3 flex-wrap mb-3">
                    {Object.entries(leaveBalance).length === 0
                        ? <p className="text-sm text-dark-muted">No leave balance data.</p>
                        : Object.entries(leaveBalance).map(([type, bal]) => (
                            <div key={type} className="bg-dark-bg/50 rounded-xl px-3 py-2 text-center">
                                <p className="text-xs text-dark-muted">{type}</p>
                                <p className="font-bold text-dark-text">{String(bal)}</p>
                            </div>
                        ))}
                </div>
                {showLeaveForm && (
                    <div className="space-y-3 pt-3 border-t border-dark-border/50">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-dark-muted block mb-1">Type</label>
                                <select value={leaveForm.type} onChange={e => setLeaveForm(f => ({ ...f, type: e.target.value }))}
                                    className="w-full bg-dark-bg border border-dark-border text-dark-text rounded-lg px-2 py-1.5 text-sm focus:outline-none">
                                    <option value="CASUAL">Casual</option>
                                    <option value="SICK">Sick</option>
                                    <option value="PAID">Paid</option>
                                    <option value="UNPAID">Unpaid</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-dark-muted block mb-1">Reason</label>
                                <input value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
                                    placeholder="Reason..."
                                    className="w-full bg-dark-bg border border-dark-border text-dark-text rounded-lg px-2 py-1.5 text-sm focus:outline-none" />
                            </div>
                            <div>
                                <label className="text-xs text-dark-muted block mb-1">From</label>
                                <input type="date" value={leaveForm.startDate} onChange={e => setLeaveForm(f => ({ ...f, startDate: e.target.value }))}
                                    className="w-full bg-dark-bg border border-dark-border text-dark-text rounded-lg px-2 py-1.5 text-sm focus:outline-none" />
                            </div>
                            <div>
                                <label className="text-xs text-dark-muted block mb-1">To</label>
                                <input type="date" value={leaveForm.endDate} onChange={e => setLeaveForm(f => ({ ...f, endDate: e.target.value }))}
                                    className="w-full bg-dark-bg border border-dark-border text-dark-text rounded-lg px-2 py-1.5 text-sm focus:outline-none" />
                            </div>
                        </div>
                        <button onClick={handleApplyLeave} disabled={submitting}
                            className="w-full py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
                            {submitting ? 'Submitting...' : 'Submit Leave Request'}
                        </button>
                    </div>
                )}
            </div>

            {/* Loan Status */}
            <div className="glass rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                    <CreditCard className="w-5 h-5 text-warning" />
                    <span className="font-semibold text-dark-text">Loan Status</span>
                </div>
                {activeLoans.length === 0 ? (
                    <p className="text-sm text-dark-muted">No active loans.</p>
                ) : (
                    <div className="space-y-2">
                        {activeLoans.slice(0, 3).map((loan: any) => (
                            <div key={loan.id} className="flex items-center justify-between bg-dark-bg/50 rounded-xl px-3 py-2">
                                <span className="text-sm text-dark-text">{loan.type}</span>
                                <span className="text-sm font-medium text-warning">₹{(loan.balance || 0).toLocaleString()} remaining</span>
                            </div>
                        ))}
                        {activeLoans.length > 1 && (
                            <p className="text-xs text-dark-muted text-right">Total outstanding: ₹{totalLoanBalance.toLocaleString()}</p>
                        )}
                    </div>
                )}
            </div>

            {/* Recent Attendance (last 7 days) */}
            <div className="glass rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-5 h-5 text-primary-400" />
                    <span className="font-semibold text-dark-text">Recent Attendance</span>
                    <span className="text-xs text-dark-muted ml-1">(last 7 days)</span>
                </div>
                {last7Att.length === 0 ? (
                    <p className="text-sm text-dark-muted">No attendance records.</p>
                ) : (
                    <div className="space-y-1.5">
                        {last7Att.map((rec: any) => (
                            <div key={rec.id} className="flex items-center justify-between">
                                <span className="text-sm text-dark-muted">{rec.date}</span>
                                <div className="flex items-center gap-1.5">
                                    {STATUS_ICON[rec.status] || <Clock className="w-4 h-4 text-dark-muted" />}
                                    <span className="text-xs text-dark-text">{rec.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
