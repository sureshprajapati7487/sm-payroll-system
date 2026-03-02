// AdminPunchModal.tsx
// Admin can:
//   1. Manually punch IN or OUT for any employee (new punch)
//   2. ADJUST / EDIT an existing punch-in or punch-out time (adjust mode)

import { useState, useEffect } from 'react';
import {
    X, User, LogIn, LogOut, Clock, Calendar,
    FileText, CheckCircle, AlertCircle, Loader2, Shield, Edit3
} from 'lucide-react';
import { useEmployeeStore } from '@/store/employeeStore';
import { useAttendanceStore } from '@/store/attendanceStore';
import { useAuthStore } from '@/store/authStore';
import { AttendanceRecord } from '@/types';

type PunchType = 'IN' | 'OUT';
type ModalMode = 'new' | 'adjust';

interface AdminPunchModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Pre-select an employee (from row action) */
    preSelectedEmployeeId?: string;
    /** If set, modal opens in ADJUST mode for this specific record */
    adjustRecord?: AttendanceRecord;
    /** Which field to adjust (checkIn or checkOut) — only used in adjust mode */
    adjustField?: 'checkIn' | 'checkOut';
}

function toTimeInput(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function toDateInput(iso: string): string {
    return iso.split('T')[0];
}

export const AdminPunchModal = ({
    isOpen,
    onClose,
    preSelectedEmployeeId,
    adjustRecord,
    adjustField,
}: AdminPunchModalProps) => {
    const { employees } = useEmployeeStore();
    const { markCheckIn, markCheckOut, getTodayRecord, adjustPunchTime } = useAttendanceStore();
    const { user } = useAuthStore();

    // Determine mode from props
    const mode: ModalMode = adjustRecord ? 'adjust' : 'new';

    // Form state
    const [employeeId, setEmployeeId] = useState(preSelectedEmployeeId || '');
    const [punchType, setPunchType] = useState<PunchType>('IN');
    const [punchDate, setPunchDate] = useState(new Date().toISOString().split('T')[0]);
    const [punchTime, setPunchTime] = useState(() => {
        const n = new Date();
        return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
    });
    const [reason, setReason] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    // Reset when modal opens
    useEffect(() => {
        if (!isOpen) return;
        setStatus('idle');
        setErrorMsg('');
        setReason('');

        if (mode === 'adjust' && adjustRecord) {
            // Pre-fill from the existing record
            const fieldToEdit = adjustField || 'checkIn';
            const existingTime = fieldToEdit === 'checkIn' ? adjustRecord.checkIn : adjustRecord.checkOut;
            if (existingTime) {
                setPunchDate(toDateInput(existingTime));
                setPunchTime(toTimeInput(existingTime));
            } else {
                setPunchDate(adjustRecord.date);
                const n = new Date();
                setPunchTime(`${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`);
            }
            setEmployeeId(adjustRecord.employeeId);
        } else {
            // New punch mode
            setEmployeeId(preSelectedEmployeeId || '');
            setPunchType('IN');
            setPunchDate(new Date().toISOString().split('T')[0]);
            const n = new Date();
            setPunchTime(`${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`);
        }
    }, [isOpen, preSelectedEmployeeId, adjustRecord, adjustField, mode]);

    // Auto-detect punch type for selected employee (new mode only)
    useEffect(() => {
        if (mode !== 'new' || !employeeId) return;
        const rec = getTodayRecord(employeeId);
        if (!rec?.checkIn) setPunchType('IN');
        else if (!rec.checkOut) setPunchType('OUT');
    }, [employeeId, mode]);

    const activeEmployees = employees.filter(e => e.status === 'ACTIVE');
    const selectedEmp = activeEmployees.find(e => e.id === employeeId)
        || employees.find(e => e.id === employeeId); // fallback for inactive

    const isAdjustIn = mode === 'adjust' && adjustField === 'checkIn';
    const adjustFieldLabel = isAdjustIn ? 'Punch In' : 'Punch Out';

    const handleSubmit = async () => {
        if (!reason.trim()) { setErrorMsg('Reason likhna zaroori hai.'); return; }

        setStatus('loading');
        setErrorMsg('');

        try {
            const punchDateTime = new Date(`${punchDate}T${punchTime}:00`).toISOString();
            const adminName = user?.name || 'Admin';

            if (mode === 'adjust' && adjustRecord) {
                // ── ADJUST EXISTING PUNCH TIME ──────────────────────────────
                await adjustPunchTime({
                    recordId: adjustRecord.id,
                    field: adjustField || 'checkIn',
                    newTime: punchDateTime,
                    reason: reason.trim(),
                    adminName,
                });
            } else {
                // ── NEW MANUAL PUNCH ────────────────────────────────────────
                if (!employeeId) { setErrorMsg('Employee select karein.'); setStatus('error'); return; }
                const punchMeta = {
                    punchMode: 'face' as const,
                    isManualPunch: true,
                    manualPunchBy: adminName,
                    manualPunchReason: reason.trim(),
                };
                if (punchType === 'IN') {
                    const emp = activeEmployees.find(e => e.id === employeeId);
                    await markCheckIn(employeeId, emp?.shift || 'GENERAL', undefined, {
                        ...punchMeta,
                        overrideTime: punchDateTime,
                    } as any);
                } else {
                    await markCheckOut(employeeId, {
                        ...punchMeta,
                        overrideTime: punchDateTime,
                    } as any);
                }
            }

            setStatus('success');
            setTimeout(() => onClose(), 1800);
        } catch (err: any) {
            setStatus('error');
            setErrorMsg(err?.message || 'Punch fail hua. Dobara try karein.');
        }
    };

    if (!isOpen) return null;

    // Header accent based on mode
    const headerAccent = mode === 'adjust'
        ? isAdjustIn
            ? 'from-emerald-900/60 to-slate-900/60'
            : 'from-blue-900/60 to-slate-900/60'
        : 'from-slate-800/80 to-slate-900/60';

    const iconColor = mode === 'adjust'
        ? isAdjustIn ? 'text-emerald-400' : 'text-blue-400'
        : 'text-violet-400';
    const iconBg = mode === 'adjust'
        ? isAdjustIn ? 'bg-emerald-500/15 border-emerald-500/25' : 'bg-blue-500/15 border-blue-500/25'
        : 'bg-violet-500/15 border-violet-500/25';

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-[#0d1117] border border-slate-700/60 rounded-3xl shadow-2xl shadow-black/80 overflow-hidden">

                {/* Header */}
                <div className={`flex items-center gap-3 px-6 py-4 border-b border-slate-700/50 bg-gradient-to-r ${headerAccent}`}>
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${iconBg}`}>
                        {mode === 'adjust'
                            ? <Edit3 className={`w-5 h-5 ${iconColor}`} />
                            : <Shield className={`w-5 h-5 ${iconColor}`} />}
                    </div>
                    <div className="flex-1">
                        <h2 className="text-white font-bold text-base">
                            {mode === 'adjust'
                                ? `${adjustFieldLabel} Time Adjust`
                                : 'Admin Manual Punch'}
                        </h2>
                        <p className="text-slate-500 text-xs mt-0.5">
                            {mode === 'adjust'
                                ? `${selectedEmp?.name || 'Employee'} ki ${adjustFieldLabel} time badlo`
                                : 'Kisi bhi employee ke liye manual punch karo'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-slate-700/60 transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">

                    {/* SUCCESS state */}
                    {status === 'success' && (
                        <div className="py-8 text-center space-y-3">
                            <div className="relative w-16 h-16 mx-auto">
                                <div className="absolute inset-0 rounded-full bg-green-500/10 animate-ping" />
                                <div className="relative w-full h-full rounded-full bg-green-500/15 border-2 border-green-500/40 flex items-center justify-center">
                                    <CheckCircle className="w-8 h-8 text-green-400" />
                                </div>
                            </div>
                            <div>
                                <p className="text-white font-bold">
                                    {mode === 'adjust' ? `${adjustFieldLabel} Updated!` : `Punch ${punchType === 'IN' ? 'In' : 'Out'} Successful!`}
                                </p>
                                <p className="text-slate-400 text-sm mt-1">
                                    {selectedEmp?.name} — {punchDate} {punchTime}
                                </p>
                                <p className="text-slate-600 text-xs mt-2 italic">Reason: {reason}</p>
                            </div>
                        </div>
                    )}

                    {/* LOADING state */}
                    {status === 'loading' && (
                        <div className="py-8 text-center space-y-3">
                            <Loader2 className="w-10 h-10 text-violet-400 animate-spin mx-auto" />
                            <p className="text-slate-300 text-sm">Saving...</p>
                        </div>
                    )}

                    {/* FORM state */}
                    {(status === 'idle' || status === 'error') && (
                        <>
                            {/* Employee chip (adjust mode: read-only; new mode: dropdown) */}
                            {mode === 'adjust' && selectedEmp ? (
                                <div className="flex items-center gap-3 bg-slate-800/50 border border-slate-700/40 rounded-xl px-4 py-3">
                                    <img
                                        src={selectedEmp.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedEmp.name)}&background=random&size=64`}
                                        className="w-10 h-10 rounded-full object-cover border border-slate-700 shrink-0"
                                    />
                                    <div>
                                        <p className="text-white font-bold text-sm">{selectedEmp.name}</p>
                                        <p className="text-slate-500 text-xs">{selectedEmp.code} · {selectedEmp.shift} Shift</p>
                                    </div>
                                    <span className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-full border ${isAdjustIn ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-blue-500/15 text-blue-400 border-blue-500/30'}`}>
                                        {adjustFieldLabel}
                                    </span>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                                        <User className="w-3 h-3" /> Employee
                                    </label>
                                    <select
                                        value={employeeId}
                                        onChange={e => setEmployeeId(e.target.value)}
                                        className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-violet-500/60 transition-colors"
                                    >
                                        <option value="">— Employee chunein —</option>
                                        {activeEmployees.map(e => (
                                            <option key={e.id} value={e.id}>{e.name} ({e.code})</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Punch Type (only in new mode) */}
                            {mode === 'new' && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                                        <Clock className="w-3 h-3" /> Punch Type
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['IN', 'OUT'] as PunchType[]).map(t => (
                                            <button
                                                key={t}
                                                onClick={() => setPunchType(t)}
                                                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all border ${punchType === t
                                                    ? t === 'IN'
                                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                                        : 'bg-red-500/20 text-red-400 border-red-500/40'
                                                    : 'bg-slate-800/50 text-slate-500 border-slate-700/40 hover:border-slate-600'
                                                    }`}
                                            >
                                                {t === 'IN' ? <LogIn className="w-3.5 h-3.5" /> : <LogOut className="w-3.5 h-3.5" />}
                                                Punch {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Date + Time */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                                        <Calendar className="w-3 h-3" /> Date
                                    </label>
                                    <input
                                        type="date"
                                        value={punchDate}
                                        onChange={e => setPunchDate(e.target.value)}
                                        className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-violet-500/60 transition-colors [color-scheme:dark]"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                                        <Clock className="w-3 h-3" /> {mode === 'adjust' ? 'New Time' : 'Time'}
                                    </label>
                                    <input
                                        type="time"
                                        value={punchTime}
                                        onChange={e => setPunchTime(e.target.value)}
                                        className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-violet-500/60 transition-colors [color-scheme:dark]"
                                    />
                                </div>
                            </div>

                            {/* Reason */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                                    <FileText className="w-3 h-3" /> Reason / Note <span className="text-red-400">*</span>
                                </label>
                                <textarea
                                    rows={2}
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                    placeholder={mode === 'adjust'
                                        ? 'Kyu time adjust kar rahe ho? (e.g. System error, wrong punch...)'
                                        : 'Kyu manual punch karna pad raha hai? (e.g. Technical glitch...)'}
                                    className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-violet-500/60 transition-colors resize-none placeholder:text-slate-600"
                                />
                            </div>

                            {/* Employee current status (new mode only) */}
                            {mode === 'new' && selectedEmp && (() => {
                                const rec = getTodayRecord(selectedEmp.id);
                                return (
                                    <div className="flex items-center gap-2 bg-slate-800/40 border border-slate-700/30 rounded-xl px-3 py-2">
                                        <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                                            <User className="w-3.5 h-3.5 text-slate-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white text-xs font-semibold truncate">{selectedEmp.name}</p>
                                            <p className="text-slate-500 text-[10px]">{selectedEmp.shift} shift</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            {rec?.checkIn ? (
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rec.checkOut ? 'bg-slate-700 text-slate-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                                    {rec.checkOut ? '✓ Done' : `In: ${new Date(rec.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-500">
                                                    Not Punched
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Error */}
                            {status === 'error' && errorMsg && (
                                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                                    <span className="text-red-300 text-xs">{errorMsg}</span>
                                </div>
                            )}
                            {!errorMsg && status === 'idle' && (
                                <p className="text-slate-600 text-[10px] flex items-center gap-1">
                                    <Shield className="w-3 h-3" />
                                    Yeh action audit trail mein record hoga — Admin: {user?.name}
                                </p>
                            )}

                            {/* Submit */}
                            <button
                                onClick={handleSubmit}
                                disabled={mode === 'new' ? (!employeeId || !reason.trim()) : !reason.trim()}
                                className={`w-full py-3 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all shadow-lg ${mode === 'adjust'
                                    ? isAdjustIn
                                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-900/40'
                                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-900/40'
                                    : 'bg-gradient-to-r from-violet-600 to-purple-600 shadow-violet-900/40'
                                    }`}
                            >
                                {mode === 'adjust'
                                    ? <><Edit3 className="w-4 h-4" /> {adjustFieldLabel} Time Update Karo</>
                                    : punchType === 'IN'
                                        ? <><LogIn className="w-4 h-4" /> Manual Punch In Submit</>
                                        : <><LogOut className="w-4 h-4" /> Manual Punch Out Submit</>
                                }
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
