import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useAttendanceStore } from '@/store/attendanceStore';
import { useHolidayStore } from '@/store/holidayStore';
import { useRegularizationStore } from '@/store/regularizationStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { AttendanceStatus, AttendanceRecord, ShiftType } from '@/types';
import { FaceScanModal } from '@/components/attendance/FaceScanModal';
import { AdminPunchModal } from '@/components/attendance/AdminPunchModal';
import { PERMISSIONS } from '@/config/permissions';
import {
    Calendar,
    CalendarCheck,
    Clock,
    CheckCircle,
    Search,
    AlertTriangle,
    FileSpreadsheet,
    MessageSquarePlus,
    ChevronLeft,
    ChevronRight,
    MapPin,
    Edit2,
    X,
    UserPlus,
    ScanFace,
    LayoutGrid,
    List,
    Eye,
    FileText,
    Upload,
    Download,
    Hash
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/apiClient';

// --- Helper Functions ---

const calcBreakMins = (breaks?: { start: string; end?: string }[]) => {
    if (!breaks?.length) return 0;
    return breaks.reduce((sum, b) => {
        if (!b.end) return sum;
        return sum + Math.round((new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000);
    }, 0);
};

// --- Helper Components ---

// ── Employee Drill-Down Modal ─────────────────────────────────────────────────
interface DrillEmp { id: string; name: string; code: string; avatar?: string; shift?: string; department?: string; }

const EmployeeDrillModal = ({ emp, onClose }: { emp: DrillEmp | null; onClose: () => void }) => {
    const [month, setMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(false);

    const getLocalToday = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const changeMonth = (dir: number) => {
        const [y, m] = month.split('-').map(Number);
        const nd = new Date(y, m - 1 + dir, 1);
        const next = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}`;
        const today = getLocalToday();
        if (next <= today.substring(0, 7)) setMonth(next);
    };

    useEffect(() => {
        if (!emp) return;
        const [y, m] = month.split('-').map(Number);
        const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        setLoading(true);
        apiFetch(`/attendance?employeeId=${emp.id}&startDate=${startDate}&endDate=${endDate}&limit=200`)
            .then(r => r.json())
            .then(raw => {
                const rows: AttendanceRecord[] = raw?.data ?? (Array.isArray(raw) ? raw : []);
                setRecords(rows.map(r => ({
                    ...r,
                    breaks: Array.isArray(r.breaks) ? r.breaks
                        : (typeof r.breaks === 'string' && r.breaks ? (() => { try { return JSON.parse(r.breaks as string); } catch { return []; } })() : [])
                })));
            })
            .catch(() => setRecords([]))
            .finally(() => setLoading(false));
    }, [emp?.id, month]);

    if (!emp) return null;

    const today = getLocalToday();
    const [y, m] = month.split('-').map(Number);
    const totalDays = new Date(y, m, 0).getDate();
    const days = Array.from({ length: totalDays }, (_, i) => i + 1);
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthName = new Date(y, m - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

    const rec = (d: number) => records.find(r => r.date === `${month}-${String(d).padStart(2, '0')}`);

    const fmt = (iso?: string) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
    const durH = (r: AttendanceRecord) => {
        if (!r.checkIn || !r.checkOut) return null;
        const mins = Math.round((new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 60000);
        if (mins < 0) return '⚠ Invalid';
        return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    };

    const STATUS_STYLE: Record<string, string> = {
        PRESENT: 'bg-emerald-500/20 text-emerald-400',
        LATE: 'bg-amber-500/20 text-amber-400',
        ABSENT: 'bg-red-500/20 text-red-400',
        HALF_DAY: 'bg-orange-500/20 text-orange-400',
        WORK_FROM_HOME: 'bg-blue-500/20 text-blue-400',
        ON_LEAVE: 'bg-purple-500/20 text-purple-400',
    };

    // Summary
    let present = 0, late = 0, absent = 0, wfh = 0, halfDay = 0, onLeave = 0, totalOT = 0;
    records.forEach(r => {
        if (r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'WORK_FROM_HOME') present++;
        if (r.status === 'LATE') late++;
        if (r.status === 'ABSENT') absent++;
        if (r.status === 'WORK_FROM_HOME') wfh++;
        if (r.status === 'HALF_DAY') halfDay++;
        if (r.status === 'ON_LEAVE') onLeave++;
        totalOT += r.overtimeHours || 0;
    });

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="relative w-full max-w-2xl h-full bg-dark-card border-l border-dark-border flex flex-col shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center gap-4 p-5 border-b border-dark-border/50 flex-shrink-0">
                    <img src={emp.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&size=48&background=random`}
                        className="w-12 h-12 rounded-full object-cover border border-dark-border" />
                    <div className="flex-1 min-w-0">
                        <h2 className="text-white font-bold text-lg leading-tight truncate">{emp.name}</h2>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-dark-muted font-mono">{emp.code}</span>
                            {emp.department && <span className="text-xs px-1.5 py-0.5 rounded bg-dark-bg border border-dark-border text-dark-muted">{emp.department}</span>}
                            {emp.shift && <span className="text-xs px-1.5 py-0.5 rounded bg-dark-bg border border-dark-border text-dark-muted">{emp.shift}</span>}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-dark-muted hover:text-white transition-colors flex-shrink-0">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Month Nav */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-dark-border/30 flex-shrink-0">
                    <button onClick={() => changeMonth(-1)} className="p-1.5 rounded hover:bg-white/5 text-dark-muted hover:text-white transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-white font-semibold text-sm">{monthName}</span>
                    <button onClick={() => changeMonth(1)} disabled={month >= today.substring(0, 7)}
                        className="p-1.5 rounded hover:bg-white/5 text-dark-muted hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-3 px-5 py-4 border-b border-dark-border/30 flex-shrink-0">
                    {[
                        { label: 'Present', val: present, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                        { label: 'Absent', val: absent, color: 'text-red-400', bg: 'bg-red-500/10' },
                        { label: 'Late', val: late, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                        { label: 'WFH', val: wfh, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                        { label: 'Half Day', val: halfDay, color: 'text-orange-400', bg: 'bg-orange-500/10' },
                        { label: 'OT Hours', val: totalOT.toFixed(1) + 'h', color: 'text-violet-400', bg: 'bg-violet-500/10' },
                    ].map(s => (
                        <div key={s.label} className={clsx('rounded-xl p-3 text-center', s.bg)}>
                            <p className={clsx('text-xl font-bold', s.color)}>{s.val}</p>
                            <p className="text-[11px] text-dark-muted mt-0.5">{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* Day-by-day list */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-16 text-dark-muted text-sm gap-2">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            Loading…
                        </div>
                    ) : (
                        <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-dark-bg/90 backdrop-blur text-dark-muted">
                                <tr>
                                    <th className="px-4 py-2 text-left font-medium">Date</th>
                                    <th className="px-3 py-2 text-center font-medium">In</th>
                                    <th className="px-3 py-2 text-center font-medium">Out</th>
                                    <th className="px-3 py-2 text-center font-medium">Hours</th>
                                    <th className="px-3 py-2 text-center font-medium">Break</th>
                                    <th className="px-3 py-2 text-center font-medium">OT</th>
                                    <th className="px-4 py-2 text-center font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-border/20">
                                {days.map(d => {
                                    const dateStr = `${month}-${String(d).padStart(2, '0')}`;
                                    const isFuture = dateStr > today;
                                    const dow = new Date(dateStr).getDay();
                                    const isSun = dow === 0;
                                    const isSat = dow === 6;
                                    const r = rec(d);
                                    if (isFuture) return null;
                                    return (
                                        <tr key={d} className={clsx('hover:bg-white/5 transition-colors', (isSun || isSat) && 'opacity-60')}>
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <span className={clsx('text-[10px] w-7 text-center font-medium', isSun ? 'text-indigo-400' : isSat ? 'text-pink-400' : 'text-dark-muted')}>
                                                        {DAYS[dow]}
                                                    </span>
                                                    <span className="text-white">{String(d).padStart(2, '0')} {new Date(dateStr).toLocaleString('default', { month: 'short' })}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5 text-center font-mono text-dark-text">
                                                {r?.checkIn ? (
                                                    <span>{fmt(r.checkIn)}{r.lateByMinutes ? <span className="block text-[9px] text-danger">+{r.lateByMinutes}m</span> : null}</span>
                                                ) : '—'}
                                            </td>
                                            <td className="px-3 py-2.5 text-center font-mono text-dark-text">{fmt(r?.checkOut)}</td>
                                            <td className="px-3 py-2.5 text-center text-dark-text">{r ? (durH(r) ?? '—') : '—'}</td>
                                            <td className="px-3 py-2.5 text-center">
                                                {(() => {
                                                    const bMins = calcBreakMins(r?.breaks);
                                                    const hasOngoing = r?.breaks?.some(b => !b.end);
                                                    if (hasOngoing) return <span className="text-cyan-400 text-[10px] font-medium animate-pulse">In Break</span>;
                                                    if (bMins > 0) {
                                                        const bh = Math.floor(bMins / 60);
                                                        const bm = bMins % 60;
                                                        return <span className="text-cyan-400 font-medium">{bh > 0 ? `${bh}h ` : ''}{bm}m</span>;
                                                    }
                                                    return <span className="text-dark-muted">—</span>;
                                                })()}
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                {r?.overtimeHours ? (
                                                    <span className="text-violet-400 font-medium">{r.overtimeHours.toFixed(1)}h</span>
                                                ) : '—'}
                                            </td>
                                            <td className="px-4 py-2.5 text-center">
                                                {r ? (
                                                    <span className={clsx('px-2 py-0.5 rounded text-[10px] font-bold', STATUS_STYLE[r.status] ?? 'bg-dark-bg text-dark-muted')}>
                                                        {r.status.replace('_', ' ')}
                                                    </span>
                                                ) : (isSun ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-500/20 text-pink-400">WEEK OFF</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-dark-bg text-dark-muted border border-dark-border">ABSENT</span>
                                                ))}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

// ── Regularization Detail Modal ──────────────────────────────────────────────
const REG_TYPE_LABEL: Record<string, { label: string; color: string }> = {
    MISSED_PUNCH:     { label: 'Missed Punch',     color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    OFFICIAL_DUTY:    { label: 'Official Duty',    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    WORK_FROM_HOME:   { label: 'Work From Home',   color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
    LEAVE_CORRECTION: { label: 'Leave Correction', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
};

interface RegDetailProps {
    req: import('@/types').RegularizationRequest;
    emp: import('@/types').Employee | undefined;
    existingRecord: import('@/types').AttendanceRecord | undefined;
    onApprove: () => void;
    onReject: () => void;
    onClose: () => void;
}

const RegularizationDetailModal = ({ req, emp, existingRecord, onApprove, onReject, onClose }: RegDetailProps) => {
    const typeInfo = REG_TYPE_LABEL[req.type] ?? { label: req.type, color: 'bg-dark-bg text-dark-muted border-dark-border' };
    const fmt = (iso?: string) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
    const createdAt = new Date(req.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="relative w-full max-w-md bg-dark-card border border-dark-border rounded-2xl shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-dark-border/50 bg-warning/5">
                    <div className="w-9 h-9 rounded-xl bg-warning/15 border border-warning/25 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-warning" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-white font-bold text-sm">Regularization Request</h2>
                        <p className="text-dark-muted text-xs mt-0.5">Review karo aur action lo</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-dark-muted hover:text-white hover:bg-white/5 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {/* Employee info */}
                    <div className="flex items-center gap-3 bg-dark-bg/50 rounded-xl p-3 border border-dark-border/40">
                        <img
                            src={emp?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp?.name || 'U')}&size=40&background=random`}
                            className="w-10 h-10 rounded-full object-cover border border-dark-border"
                        />
                        <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold text-sm truncate">{emp?.name ?? 'Unknown Employee'}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-[10px] text-dark-muted font-mono">{emp?.code}</span>
                                {emp?.department && <span className="text-[10px] px-1.5 py-0.5 rounded bg-dark-bg border border-dark-border text-dark-muted">{emp.department}</span>}
                                {emp?.shift && <span className="text-[10px] px-1.5 py-0.5 rounded bg-dark-bg border border-dark-border text-dark-muted">{emp.shift}</span>}
                            </div>
                        </div>
                    </div>

                    {/* Request details */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-dark-bg/40 rounded-xl p-3 border border-dark-border/30">
                            <p className="text-[10px] text-dark-muted uppercase tracking-wide mb-1">Date</p>
                            <p className="text-white font-semibold text-sm">{req.date}</p>
                        </div>
                        <div className="bg-dark-bg/40 rounded-xl p-3 border border-dark-border/30">
                            <p className="text-[10px] text-dark-muted uppercase tracking-wide mb-1">Type</p>
                            <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded border', typeInfo.color)}>{typeInfo.label}</span>
                        </div>
                    </div>

                    {/* Reason */}
                    <div className="bg-dark-bg/40 rounded-xl p-3 border border-dark-border/30">
                        <p className="text-[10px] text-dark-muted uppercase tracking-wide mb-1.5">Reason</p>
                        <p className="text-white text-sm leading-relaxed">"{req.reason}"</p>
                    </div>

                    {/* Existing attendance record for that date */}
                    <div className="bg-dark-bg/40 rounded-xl p-3 border border-dark-border/30">
                        <p className="text-[10px] text-dark-muted uppercase tracking-wide mb-2">Attendance on {req.date}</p>
                        {existingRecord ? (
                            <div className="flex items-center gap-4 text-xs">
                                <div className="flex flex-col items-center">
                                    <span className="text-dark-muted text-[10px]">In</span>
                                    <span className="text-emerald-400 font-mono font-semibold">{fmt(existingRecord.checkIn)}</span>
                                </div>
                                <div className="flex-1 h-px bg-dark-border/50" />
                                <div className="flex flex-col items-center">
                                    <span className="text-dark-muted text-[10px]">Out</span>
                                    <span className="text-blue-400 font-mono font-semibold">{fmt(existingRecord.checkOut)}</span>
                                </div>
                                <span className={clsx('ml-2 text-[10px] font-bold px-2 py-0.5 rounded border',
                                    existingRecord.status === 'PRESENT' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                    existingRecord.status === 'ABSENT'  ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                    'bg-dark-bg text-dark-muted border-dark-border'
                                )}>{existingRecord.status}</span>
                            </div>
                        ) : (
                            <p className="text-dark-muted text-xs italic">No attendance record found for this date</p>
                        )}
                    </div>

                    {/* Submitted at */}
                    <p className="text-[10px] text-dark-muted text-right">Submitted: {createdAt}</p>

                    {/* Action buttons */}
                    <div className="flex gap-3 pt-1">
                        <button onClick={onReject}
                            className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors">
                            Reject
                        </button>
                        <button onClick={onApprove}
                            className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 transition-colors">
                            Approve
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

const LiveClock = () => {
    const [time, setTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);
    return (
        <div className="font-mono text-xl md:text-2xl font-bold text-white tracking-wider">
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
    );
};

export const AttendanceDashboard = () => {
    const { user, hasPermission } = useAuthStore();
    const navigate = useNavigate();
    const { employees } = useEmployeeStore();
    const { records, markCheckIn, markCheckOut, updateRecordStatus, removeRecord } = useAttendanceStore();
    const { isHoliday } = useHolidayStore();
    const requests = useRegularizationStore(state => state.requests);
    const pendingRequests = requests.filter(r => r.status === 'PENDING');

    // Local date string (not UTC) — prevents IST midnight mismatch
    const getLocalToday = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // -- State --
    const [viewMode, setViewMode] = useState<'DAILY' | 'MONTHLY'>('DAILY');
    const [selectedDate, setSelectedDate] = useState(getLocalToday);
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [isScanOpen, setIsScanOpen] = useState(false);
    const [scanMode, setScanMode] = useState<'IN' | 'OUT'>('IN');
    const [adminPunchOpen, setAdminPunchOpen] = useState(false);
    const [adminPunchEmpId, setAdminPunchEmpId] = useState<string | undefined>();
    // Adjust (edit) existing punch time
    const [adjustRecord, setAdjustRecord] = useState<AttendanceRecord | undefined>();
    const [adjustField, setAdjustField] = useState<'checkIn' | 'checkOut'>('checkIn');

    const openAdjust = (record: AttendanceRecord, field: 'checkIn' | 'checkOut') => {
        setAdjustRecord(record);
        setAdjustField(field);
        setAdminPunchOpen(true);
    };

    // Employee drill-down
    const [drillEmpId, setDrillEmpId] = useState<string | null>(null);
    const drillEmp = drillEmpId ? (employees.find(e => e.id === drillEmpId) ?? null) : null;

    // Regularization detail view
    const [viewReqId, setViewReqId] = useState<string | null>(null);
    const viewReq = viewReqId ? (requests.find(r => r.id === viewReqId) ?? null) : null;

    // Monthly records (fetched separately to avoid 200-record limit on daily fetch)
    const [monthlyRecords, setMonthlyRecords] = useState<AttendanceRecord[]>([]);
    const [monthlyLoading, setMonthlyLoading] = useState(false);

    useEffect(() => {
        if (viewMode !== 'MONTHLY') return;
        const [y, m] = selectedMonth.split('-').map(Number);
        const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        setMonthlyLoading(true);
        apiFetch(`/attendance?startDate=${startDate}&endDate=${endDate}&limit=1000`)
            .then(res => res.json())
            .then(raw => {
                const rows: AttendanceRecord[] = raw?.data ?? (Array.isArray(raw) ? raw : []);
                setMonthlyRecords(rows.map(r => ({
                    ...r,
                    breaks: Array.isArray(r.breaks) ? r.breaks
                        : (typeof r.breaks === 'string' && r.breaks ? (() => { try { return JSON.parse(r.breaks as string); } catch { return []; } })() : [])
                })));
            })
            .catch(() => setMonthlyRecords([]))
            .finally(() => setMonthlyLoading(false));
    }, [viewMode, selectedMonth]);

    // UI State
    const [activeActionId, setActiveActionId] = useState<string | null>(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [shiftFilter, setShiftFilter] = useState<ShiftType | 'ALL'>('ALL');
    const [statusFilter, setStatusFilter] = useState<AttendanceStatus | 'ALL' | 'PENDING'>('ALL');
    const [deptFilter, setDeptFilter] = useState<string>('ALL');

    // Location
    const [locationStatus, setLocationStatus] = useState<'IDLE' | 'FETCHING' | 'SUCCESS' | 'ERROR'>('IDLE');
    const [locationError, setLocationError] = useState('');

    const canManualUpdate = hasPermission(PERMISSIONS.MANUAL_ATTENDANCE);

    // -- Derived Data --
    const localToday = getLocalToday();
    const isToday = selectedDate === localToday;

    // User Status (Only relevant for Today)
    const currentUserRecord = user ? records.find(r => r.employeeId === user.id && r.date === selectedDate) : undefined;
    const isCheckedIn = !!currentUserRecord;
    const isCheckedOut = !!currentUserRecord?.checkOut;

    // Filter Logic
    const canViewAllAttendance = hasPermission(PERMISSIONS.VIEW_ATTENDANCE) || hasPermission(PERMISSIONS.VIEW_TEAM_ATTENDANCE);

    const activeEmployees = employees.filter(e => {
        if (!canViewAllAttendance && e.id !== user?.id) return false;
        const isProduction = e.department?.toLowerCase().includes('production') || e.salaryType === 'PRODUCTION';
        return e.status === 'ACTIVE' && !isProduction;
    });

    // Count of production employees excluded — shown as UI note
    const hiddenProductionCount = hasPermission(PERMISSIONS.VIEW_ATTENDANCE)
        ? employees.filter(e => e.status === 'ACTIVE' && (e.department?.toLowerCase().includes('production') || e.salaryType === 'PRODUCTION')).length
        : 0;

    const filteredEmployees = activeEmployees.filter(emp => {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = emp.name.toLowerCase().includes(searchLower) ||
            emp.code.toLowerCase().includes(searchLower) ||
            (emp.department || '').toLowerCase().includes(searchLower);
        const matchesShift = shiftFilter === 'ALL' || emp.shift === shiftFilter;
        const matchesDept = deptFilter === 'ALL' || (emp.department || 'N/A') === deptFilter;

        let matchesStatus = true;
        const record = records.find(r => r.employeeId === emp.id && r.date === selectedDate);

        if (statusFilter !== 'ALL') {
            if (statusFilter === 'PENDING') matchesStatus = !record;
            else matchesStatus = record?.status === statusFilter;
        }

        return matchesSearch && matchesShift && matchesDept && matchesStatus;
    });

    // Bulk selection
    const [selectedEmpIds, setSelectedEmpIds] = useState<Set<string>>(new Set());
    const toggleSelect = (id: string) => setSelectedEmpIds(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });
    const allSelected = filteredEmployees.length > 0 && filteredEmployees.every(e => selectedEmpIds.has(e.id));
    const toggleSelectAll = () => setSelectedEmpIds(allSelected ? new Set() : new Set(filteredEmployees.map(e => e.id)));
    const clearSelection = () => setSelectedEmpIds(new Set());
    const bulkMark = (status: AttendanceStatus) => {
        selectedEmpIds.forEach(id => updateRecordStatus(id, status, selectedDate));
        clearSelection();
    };

    // Unique departments for filter dropdown
    const allDepartments = Array.from(
        new Set(activeEmployees.map(e => e.department || 'N/A'))
    ).sort();

    // Stats Calculation
    const todayRecords = records.filter(r => r.date === selectedDate);
    const stats = {
        present: todayRecords.filter(r => r.status === 'PRESENT' || r.status === 'WORK_FROM_HOME').length,
        late: todayRecords.filter(r => r.status === 'LATE').length,
        absent: todayRecords.filter(r => r.status === 'ABSENT').length,
        leave: todayRecords.filter(r => r.status === 'HALF_DAY' || r.status === 'ON_LEAVE').length,
        total: activeEmployees.length
    };

    // -- Handlers --

    const changeDate = (days: number) => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + days);
        const next = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (next > localToday) return; // block future dates
        setSelectedDate(next);
    };

    const verifyLocation = async (): Promise<boolean> => {
        setLocationStatus('FETCHING');
        try {
            if (!navigator.geolocation) {
                setLocationError("Geolocation not supported.");
                setLocationStatus('ERROR');
                return false;
            }

            const position = await new Promise<GeolocationPosition>((res, rej) => {
                navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 });
            });

            const { latitude, longitude } = position.coords;
            const res = await apiFetch('/attendance/verify-location', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyId: user?.companyId, lat: latitude, lng: longitude }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setLocationError(data.message || 'Location verification failed');
                setLocationStatus('ERROR');
                return false;
            }

            const data = await res.json();
            if (data.valid) {
                setLocationStatus('SUCCESS');
                return true;
            } else {
                setLocationError(data.message || `You are ${data.distance}m away. Must be within allowed zone.`);
                setLocationStatus('ERROR');
                return false;
            }
        } catch (err: any) {
            console.error('Location error:', err);
            setLocationError(err.message && err.message.includes('User denied') ? "Location access denied." : "Unable to verify location.");
            setLocationStatus('ERROR');
            return false;
        }
    };

    const handleScanSuccess = async (imageSrc: string) => {
        if (!user) return;
        if (scanMode === 'IN') {
            const valid = await verifyLocation();
            if (!valid) return;

            const emp = employees.find(e => e.id === user.id);
            markCheckIn(user.id, emp?.shift || 'GENERAL', imageSrc);
        } else {
            markCheckOut(user.id);
        }
        setIsScanOpen(false);
        setLocationStatus('IDLE');
    };

    // Import state
    const [importResult, setImportResult] = useState<{ ok: number; errors: string[] } | null>(null);

    const handleDownloadTemplate = async () => {
        const XLSX = await import('xlsx');
        const template = [
            { 'Employee ID': 'EMP-001', 'Date': selectedDate, 'Status': 'PRESENT', 'In Time': '09:00', 'Out Time': '18:00', 'Late (Min)': 0 },
            { 'Employee ID': 'EMP-002', 'Date': selectedDate, 'Status': 'ABSENT',  'In Time': '',      'Out Time': '',      'Late (Min)': 0 },
        ];
        const ws = XLSX.utils.json_to_sheet(template);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, `Attendance_Import_Template.xlsx`);
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        const XLSX = await import('xlsx');
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        const VALID_STATUSES = ['PRESENT','ABSENT','LATE','HALF_DAY','WORK_FROM_HOME','ON_LEAVE'];
        let ok = 0;
        const errors: string[] = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2;
            const code  = String(row['Employee ID'] || '').trim();
            const date  = String(row['Date'] || '').trim();
            const status = String(row['Status'] || '').trim().toUpperCase();
            const inTime = String(row['In Time'] || '').trim();
            const outTime = String(row['Out Time'] || '').trim();
            const lateMins = parseInt(row['Late (Min)']) || 0;

            if (!code)   { errors.push(`Row ${rowNum}: Employee ID missing`); continue; }
            if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { errors.push(`Row ${rowNum}: Date invalid (use YYYY-MM-DD) — got "${date}"`); continue; }
            if (!VALID_STATUSES.includes(status)) { errors.push(`Row ${rowNum}: Status "${status}" invalid`); continue; }

            const emp = activeEmployees.find(e => e.code === code) ?? employees.find(e => e.code === code);
            if (!emp) { errors.push(`Row ${rowNum}: Employee "${code}" not found`); continue; }

            try {
                const checkInISO  = inTime  ? new Date(`${date}T${inTime}:00`).toISOString()  : undefined;
                const checkOutISO = outTime ? new Date(`${date}T${outTime}:00`).toISOString() : undefined;
                await apiFetch('/attendance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        employeeId: emp.id,
                        date,
                        status: status as AttendanceStatus,
                        checkIn: checkInISO,
                        checkOut: checkOutISO,
                        lateByMinutes: lateMins,
                        overtimeHours: 0,
                        isManualPunch: true,
                        manualPunchBy: user?.name || 'Import',
                        manualPunchReason: 'Bulk Excel Import',
                    }),
                });
                ok++;
            } catch (err: any) {
                errors.push(`Row ${rowNum} (${code}): ${err?.message || 'Save failed'}`);
            }
        }

        setImportResult({ ok, errors });
    };

    const handleExport = async () => {
        const XLSX = await import('xlsx');
        const data = filteredEmployees.map(emp => {
            const record = records.find(r => r.employeeId === emp.id && r.date === selectedDate);
            return {
                "ID": emp.code,
                "Name": emp.name,
                "Shift": emp.shift,
                "In Time": record?.checkIn ? new Date(record.checkIn).toLocaleTimeString() : '-',
                "Out Time": record?.checkOut ? new Date(record.checkOut).toLocaleTimeString() : '-',
                "Status": record?.status || 'PENDING/ABSENT',
                "Late (Min)": record?.lateByMinutes || 0
            };
        });
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Attendance");
        XLSX.writeFile(wb, `Attendance_${selectedDate}.xlsx`);
    };

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = () => setActiveActionId(null);
        if (activeActionId) window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, [activeActionId]);

    // -- Monthly View Helpers --
    const changeMonth = (dir: number) => {
        const [y, m] = selectedMonth.split('-').map(Number);
        const d = new Date(y, m - 1 + dir, 1);
        const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (next <= localToday.substring(0, 7)) setSelectedMonth(next);
    };

    const getDaysInMonth = (ym: string) => {
        const [y, m] = ym.split('-').map(Number);
        return new Date(y, m, 0).getDate();
    };

    const getStatusShort = (status?: string) => {
        const map: Record<string, { label: string; color: string }> = {
            PRESENT: { label: 'P', color: 'bg-emerald-500/20 text-emerald-400' },
            LATE: { label: 'L', color: 'bg-amber-500/20 text-amber-400' },
            ABSENT: { label: 'A', color: 'bg-red-500/20 text-red-400' },
            HALF_DAY: { label: 'H', color: 'bg-orange-500/20 text-orange-400' },
            WORK_FROM_HOME: { label: 'W', color: 'bg-blue-500/20 text-blue-400' },
            ON_LEAVE: { label: 'OL', color: 'bg-purple-500/20 text-purple-400' },
            HOLIDAY: { label: 'HOL', color: 'bg-indigo-500/20 text-indigo-400' },
            WEEKLY_OFF: { label: 'OFF', color: 'bg-pink-500/20 text-pink-400' },
        };
        return map[status || ''] || null;
    };

    return (
        <div className="space-y-4 w-full min-w-0 max-w-full overflow-x-hidden">
            {/* Header: Date Navigation & Actions */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-dark-text mb-1">Attendance &amp; Timing</h1>
                    {/* View Toggle */}
                    <div className="flex items-center bg-dark-card border border-dark-border rounded-lg p-1 gap-1">
                        <button
                            onClick={() => setViewMode('DAILY')}
                            className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all', viewMode === 'DAILY' ? 'bg-primary-500 text-white' : 'text-dark-muted hover:text-white')}
                        >
                            <List className="w-3.5 h-3.5" /> Daily
                        </button>
                        <button
                            onClick={() => setViewMode('MONTHLY')}
                            className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all', viewMode === 'MONTHLY' ? 'bg-primary-500 text-white' : 'text-dark-muted hover:text-white')}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" /> Monthly
                        </button>
                    </div>
                </div>
                <div>
                    {viewMode === 'DAILY' ? (
                    <div className="flex items-center gap-2 text-dark-muted text-sm">
                        <button onClick={() => changeDate(-1)} className="hover:text-white p-1"><ChevronLeft className="w-4 h-4" /></button>
                        <div className="flex items-center gap-2 bg-dark-card border border-dark-border px-3 py-1 rounded-lg">
                            <Calendar className="w-4 h-4 text-primary-400" />
                            <input
                                type="date"
                                value={selectedDate}
                                max={localToday}
                                onChange={(e) => { if (e.target.value <= localToday) setSelectedDate(e.target.value); }}
                                className="bg-transparent text-white outline-none text-sm w-32"
                            />
                        </div>
                        <button onClick={() => changeDate(1)} className="hover:text-white p-1"><ChevronRight className="w-4 h-4" /></button>
                        {isToday && <span className="text-primary-500 font-bold px-2 text-xs bg-primary-500/10 rounded-full py-0.5">TODAY</span>}
                    </div>
                    ) : (
                    <div className="flex items-center gap-2 text-dark-muted text-sm">
                        <button onClick={() => changeMonth(-1)} className="hover:text-white p-1"><ChevronLeft className="w-4 h-4" /></button>
                        <div className="flex items-center gap-2 bg-dark-card border border-dark-border px-3 py-1 rounded-lg">
                            <Calendar className="w-4 h-4 text-primary-400" />
                            <input
                                type="month"
                                value={selectedMonth}
                                max={localToday.substring(0, 7)}
                                onChange={(e) => { if (e.target.value <= localToday.substring(0, 7)) setSelectedMonth(e.target.value); }}
                                className="bg-transparent text-white outline-none text-sm"
                            />
                        </div>
                        <button onClick={() => changeMonth(1)} className="hover:text-white p-1"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                    )}
                </div>

                {/* Main Actions — all visible, wrap to next line on mobile */}
                <div className="flex items-center gap-2 flex-wrap w-full">
                    {/* Live Clock — desktop only */}
                    <div className="hidden md:flex flex-col items-end mr-4">
                        <div className="text-[10px] text-dark-muted uppercase tracking-widest">Office Time</div>
                        <LiveClock />
                    </div>

                    {/* Check In/Out — for non-admin employees */}
                    {isToday && hasPermission(PERMISSIONS.MARK_OWN_ATTENDANCE) && !canManualUpdate && (
                        <>
                            {!isCheckedIn ? (
                                <button
                                    onClick={() => { setScanMode('IN'); setIsScanOpen(true); }}
                                    className="flex-1 min-w-[120px] px-3 py-2 bg-success text-white rounded-xl font-bold flex items-center justify-center gap-2 text-sm"
                                >
                                    <MapPin className="w-4 h-4" /> Check In
                                </button>
                            ) : !isCheckedOut ? (
                                <button
                                    onClick={() => { setScanMode('OUT'); setIsScanOpen(true); }}
                                    className="flex-1 min-w-[120px] px-3 py-2 bg-danger text-white rounded-xl font-bold flex items-center justify-center gap-2 text-sm"
                                >
                                    <Clock className="w-4 h-4" /> Check Out
                                </button>
                            ) : (
                                <div className="px-3 py-2 bg-dark-card border border-success/30 text-success rounded-xl flex items-center gap-2 text-xs font-medium">
                                    <CheckCircle className="w-4 h-4" /> Shift Done
                                </div>
                            )}
                        </>
                    )}

                    {/* Admin Actions — compact, all visible */}
                    {hasPermission(PERMISSIONS.EXPORT_REPORTS) && (
                        <button onClick={handleExport}
                            className="p-2.5 bg-dark-card border border-dark-border rounded-lg text-dark-muted hover:text-white transition-colors"
                            title="Export Excel">
                            <FileSpreadsheet className="w-4 h-4" />
                        </button>
                    )}
                    {canManualUpdate && (
                        <>
                            <label className="p-2.5 bg-dark-card border border-dark-border rounded-lg text-dark-muted hover:text-emerald-400 hover:border-emerald-500/40 transition-colors cursor-pointer" title="Import Excel">
                                <Upload className="w-4 h-4" />
                                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
                            </label>
                            <button onClick={handleDownloadTemplate}
                                className="p-2.5 bg-dark-card border border-dark-border rounded-lg text-dark-muted hover:text-blue-400 hover:border-blue-500/40 transition-colors"
                                title="Download Import Template">
                                <Download className="w-4 h-4" />
                            </button>
                        </>
                    )}
                    {canManualUpdate && (
                        <button
                            onClick={() => { setAdminPunchEmpId(undefined); setAdminPunchOpen(true); }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-violet-600/20 border border-violet-500/30 rounded-lg text-violet-400 text-xs font-bold"
                        >
                            <UserPlus className="w-3.5 h-3.5" /> Manual Punch
                        </button>
                    )}
                    {hasPermission(PERMISSIONS.USE_FACE_KIOSK) && (
                        <button
                            onClick={() => navigate('/attendance/kiosk')}
                            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/20 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs font-bold"
                        >
                            <ScanFace className="w-3.5 h-3.5" /> Face Kiosk
                        </button>
                    )}
                    {canManualUpdate && (
                        <button
                            onClick={() => navigate('/attendance/pin-kiosk')}
                            className="flex items-center gap-1.5 px-3 py-2 bg-violet-600/20 border border-violet-500/30 rounded-lg text-violet-400 text-xs font-bold"
                        >
                            <Hash className="w-3.5 h-3.5" /> PIN Kiosk
                        </button>
                    )}
                    {hasPermission(PERMISSIONS.MANAGE_HOLIDAYS) && (
                        <button
                            onClick={() => navigate('/attendance/holidays')}
                            className="p-2.5 bg-dark-card border border-dark-border rounded-lg text-dark-muted hover:text-white transition-colors"
                        >
                            <CalendarCheck className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>


            {/* Error Banner */}
            <AnimatePresence>
                {locationStatus === 'ERROR' && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="bg-danger/10 border border-danger/20 text-danger p-3 rounded-xl flex items-center gap-3"
                    >
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        <p className="text-sm font-medium">{locationError}</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Face Scan Modal */}
            <FaceScanModal
                isOpen={isScanOpen}
                onClose={() => setIsScanOpen(false)}
                onSuccess={handleScanSuccess}
                mode={scanMode}
            />

            {/* Stats Overview */}
            <div className="flex overflow-x-auto pb-4 -mb-4 gap-4 snap-x md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:pb-0 md:mb-0">
                <div className="glass p-4 rounded-xl border-t-4 border-success relative overflow-hidden group min-w-[150px] flex-[0_0_45%] snap-start">
                    <div className="absolute right-2 top-2 opacity-10 group-hover:opacity-20 transition-opacity"><CheckCircle className="w-12 h-12 text-success" /></div>
                    <p className="text-dark-muted text-xs font-medium uppercase">Present</p>
                    <p className="text-2xl font-bold text-dark-text mt-1">{stats.present} <span className="text-sm text-dark-muted font-normal">/ {stats.total}</span></p>
                </div>
                <div className="glass p-4 rounded-xl border-t-4 border-warning relative overflow-hidden group min-w-[150px] flex-[0_0_45%] snap-start">
                    <div className="absolute right-2 top-2 opacity-10 group-hover:opacity-20 transition-opacity"><Clock className="w-12 h-12 text-warning" /></div>
                    <p className="text-dark-muted text-xs font-medium uppercase">Late Arrival</p>
                    <p className="text-2xl font-bold text-dark-text mt-1">{stats.late}</p>
                </div>
                <div className="glass p-4 rounded-xl border-t-4 border-danger relative overflow-hidden group min-w-[150px] flex-[0_0_45%] snap-start">
                    <div className="absolute right-2 top-2 opacity-10 group-hover:opacity-20 transition-opacity"><AlertTriangle className="w-12 h-12 text-danger" /></div>
                    <p className="text-dark-muted text-xs font-medium uppercase">Absent</p>
                    <p className="text-2xl font-bold text-dark-text mt-1">{stats.absent}</p>
                </div>
                <div className="glass p-4 rounded-xl border-t-4 border-primary-500 relative overflow-hidden group min-w-[150px] flex-[0_0_45%] snap-start">
                    <div className="absolute right-2 top-2 opacity-10 group-hover:opacity-20 transition-opacity"><Calendar className="w-12 h-12 text-primary-500" /></div>
                    <p className="text-dark-muted text-xs font-medium uppercase">On Leave</p>
                    <p className="text-2xl font-bold text-dark-text mt-1">{stats.leave}</p>
                </div>
            </div>

            {/* ── Shift-Wise Summary ────────────────────────────────────────────── */}
            {hasPermission(PERMISSIONS.VIEW_ATTENDANCE) && (() => {
                // Compute per-shift stats using employee's assigned shift
                const ALL_SHIFTS: ShiftType[] = ['GENERAL', 'MORNING', 'EVENING', 'NIGHT'];
                const SHIFT_COLORS: Record<ShiftType, string> = {
                    GENERAL: 'border-blue-500/60 bg-blue-500/8',
                    MORNING: 'border-amber-500/60 bg-amber-500/8',
                    EVENING: 'border-orange-500/60 bg-orange-500/8',
                    NIGHT: 'border-indigo-500/60 bg-indigo-500/8',
                };
                const SHIFT_TIME: Record<ShiftType, string> = {
                    GENERAL: '9:00 AM – 6:00 PM',
                    MORNING: '6:00 AM – 2:00 PM',
                    EVENING: '2:00 PM – 10:00 PM',
                    NIGHT: '10:00 PM – 6:00 AM',
                };

                return (
                    <div className="flex overflow-x-auto pb-4 -mb-4 gap-4 snap-x sm:grid sm:grid-cols-2 md:grid-cols-4 md:gap-4 sm:overflow-visible sm:pb-0 sm:mb-0">
                        {ALL_SHIFTS.map(sh => {
                            const shiftEmps = activeEmployees.filter(e => (e.shift || 'GENERAL') === sh);
                            if (shiftEmps.length === 0) return null;

                            const shiftPresent = shiftEmps.filter(e => {
                                const r = todayRecords.find(r => r.employeeId === e.id);
                                return r && (r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'WORK_FROM_HOME');
                            }).length;
                            const shiftLate = shiftEmps.filter(e => {
                                const r = todayRecords.find(r => r.employeeId === e.id);
                                return r?.status === 'LATE';
                            }).length;
                            const attendancePct = shiftEmps.length > 0 ? Math.round((shiftPresent / shiftEmps.length) * 100) : 0;

                            return (
                                <div key={sh} className={`glass rounded-xl p-4 border ${SHIFT_COLORS[sh]} cursor-pointer hover:shadow-lg transition-all min-w-[200px] flex-[0_0_80%] sm:flex-1 snap-start`}
                                    onClick={() => setShiftFilter(shiftFilter === sh ? 'ALL' : sh)}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-dark-muted uppercase tracking-wider">{sh}</span>
                                        {shiftFilter === sh && <span className="text-[9px] bg-primary-500 text-white px-1.5 py-0.5 rounded-full font-bold">ACTIVE</span>}
                                    </div>
                                    <p className="text-[10px] text-slate-500 mb-3">{SHIFT_TIME[sh]}</p>
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <p className="text-2xl font-bold text-dark-text">{shiftPresent}<span className="text-sm text-dark-muted font-normal">/{shiftEmps.length}</span></p>
                                            <p className="text-[10px] text-slate-500 mt-0.5">Present {shiftLate > 0 ? `· ${shiftLate} late` : ''}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-lg font-bold ${attendancePct >= 80 ? 'text-green-400' : attendancePct >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{attendancePct}%</p>
                                        </div>
                                    </div>
                                    {/* Mini progress bar */}
                                    <div className="mt-3 h-1.5 rounded-full bg-dark-border overflow-hidden">
                                        <div className={`h-full rounded-full transition-all ${attendancePct >= 80 ? 'bg-green-500' : attendancePct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                            style={{ width: `${attendancePct}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );
            })()}

            {/* ── Monthly View ─────────────────────────────────────────────────── */}
            {viewMode === 'MONTHLY' && (() => {
                const totalDays = getDaysInMonth(selectedMonth);
                const days = Array.from({ length: totalDays }, (_, i) => i + 1);
                const mRecords = monthlyRecords;

                return (
                    <div className="glass rounded-2xl overflow-hidden">
                        {monthlyLoading && (
                            <div className="flex items-center justify-center py-12 text-dark-muted text-sm gap-2">
                                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                Loading monthly data…
                            </div>
                        )}
                        {!monthlyLoading && (
                        <>
                        {/* Legend */}
                        <div className="px-4 pt-4 pb-2 flex flex-wrap gap-3 border-b border-dark-border/50">
                            {[
                                { label: 'Present', short: 'P', color: 'bg-emerald-500/20 text-emerald-400' },
                                { label: 'Late', short: 'L', color: 'bg-amber-500/20 text-amber-400' },
                                { label: 'Absent', short: 'A', color: 'bg-red-500/20 text-red-400' },
                                { label: 'Half Day', short: 'H', color: 'bg-orange-500/20 text-orange-400' },
                                { label: 'WFH', short: 'W', color: 'bg-blue-500/20 text-blue-400' },
                                { label: 'On Leave', short: 'OL', color: 'bg-purple-500/20 text-purple-400' },
                                { label: 'Holiday', short: 'HOL', color: 'bg-indigo-500/20 text-indigo-400' },
                                { label: 'Week Off', short: 'OFF', color: 'bg-pink-500/20 text-pink-400' },
                            ].map(s => (
                                <div key={s.short} className="flex items-center gap-1.5 text-xs text-dark-muted">
                                    <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-bold', s.color)}>{s.short}</span>
                                    {s.label}
                                </div>
                            ))}
                        </div>

                        {/* Grid */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-dark-bg/50 text-dark-muted sticky top-0 z-10">
                                    <tr>
                                        <th className="p-3 text-left font-medium sticky left-0 bg-dark-bg/80 backdrop-blur z-20 min-w-[160px]">Employee</th>
                                        {days.map(d => {
                                            const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
                                            const dow = new Date(dateStr).getDay();
                                            const isSun = dow === 0;
                                            const isSat = dow === 6;
                                            const isHol = isHoliday(dateStr);
                                            return (
                                                <th key={d} className={clsx('p-1 text-center font-medium min-w-[36px]', (isSun || isHol) ? 'text-indigo-400' : isSat ? 'text-pink-400' : '')}>
                                                    <div>{d}</div>
                                                    <div className="text-[9px] opacity-60">{['Su','Mo','Tu','We','Th','Fr','Sa'][dow]}</div>
                                                </th>
                                            );
                                        })}
                                        <th className="p-3 text-center font-medium sticky right-0 bg-dark-bg/80 backdrop-blur min-w-[120px]">Summary</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-dark-border/20">
                                    {filteredEmployees.map(emp => {
                                        let pCount = 0, lCount = 0, aCount = 0, wCount = 0, hCount = 0, olCount = 0;
                                        return (
                                            <tr key={emp.id} className="hover:bg-white/5 transition-colors">
                                                <td className="p-3 sticky left-0 bg-dark-card/90 backdrop-blur z-10">
                                                    <button onClick={() => setDrillEmpId(emp.id)} className="flex items-center gap-2 text-left group/drill w-full">
                                                        <img src={emp.avatar || `https://ui-avatars.com/api/?name=${emp.name}&size=28&background=random`} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                                                        <div>
                                                            <p className="text-white font-medium leading-tight group-hover/drill:text-primary-400 transition-colors">{emp.name}</p>
                                                            <p className="text-[10px] text-dark-muted">{emp.code}</p>
                                                        </div>
                                                    </button>
                                                </td>
                                                {days.map(d => {
                                                    const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
                                                    const isFuture = dateStr > localToday;
                                                    const dow = new Date(dateStr).getDay();
                                                    const isSun = dow === 0;
                                                    const isHol = isHoliday(dateStr);
                                                    const record = mRecords.find(r => r.employeeId === emp.id && r.date === dateStr);

                                                    let statusObj = null;
                                                    if (isFuture) {
                                                        statusObj = null;
                                                    } else if (record) {
                                                        statusObj = getStatusShort(record.status);
                                                        if (record.status === 'PRESENT' || record.status === 'LATE' || record.status === 'WORK_FROM_HOME') pCount++;
                                                        if (record.status === 'LATE') lCount++;
                                                        if (record.status === 'ABSENT') aCount++;
                                                        if (record.status === 'WORK_FROM_HOME') wCount++;
                                                        if (record.status === 'HALF_DAY') hCount++;
                                                        if (record.status === 'ON_LEAVE') olCount++;
                                                    } else if (isHol) {
                                                        statusObj = { label: 'HOL', color: 'bg-indigo-500/20 text-indigo-400' };
                                                    } else if (isSun) {
                                                        statusObj = { label: 'OFF', color: 'bg-pink-500/20 text-pink-400' };
                                                    } else {
                                                        statusObj = { label: 'A', color: 'bg-red-500/20 text-red-400' };
                                                        aCount++;
                                                    }

                                                    return (
                                                        <td key={d} className="p-1 text-center">
                                                            {isFuture ? (
                                                                <span className="text-dark-border">·</span>
                                                            ) : statusObj ? (
                                                                <span className={clsx('inline-block px-1 py-0.5 rounded text-[9px] font-bold', statusObj.color)}>
                                                                    {statusObj.label}
                                                                </span>
                                                            ) : null}
                                                        </td>
                                                    );
                                                })}
                                                <td className="p-3 sticky right-0 bg-dark-card/90 backdrop-blur text-center">
                                                    <div className="flex flex-col gap-0.5 text-[10px]">
                                                        <span className="text-emerald-400 font-bold">{pCount}P</span>
                                                        {lCount > 0 && <span className="text-amber-400">{lCount}L</span>}
                                                        {aCount > 0 && <span className="text-red-400">{aCount}A</span>}
                                                        {wCount > 0 && <span className="text-blue-400">{wCount}W</span>}
                                                        {hCount > 0 && <span className="text-orange-400">{hCount}H</span>}
                                                        {olCount > 0 && <span className="text-purple-400">{olCount}OL</span>}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                    )}
                    </div>
                );
            })()}

            {/* ── Daily View ────────────────────────────────────────────────────── */}
            {viewMode === 'DAILY' && (
            <div className="flex flex-col lg:flex-row gap-6 w-full min-w-0 max-w-full">

                {/* Left: Attendance List */}
                <div className="flex-1 glass rounded-2xl overflow-hidden flex flex-col min-h-[400px] min-w-0 w-full max-w-full">
                    {/* Toolbar */}
                    <div className="p-4 border-b border-dark-border/50 flex flex-wrap gap-3 items-center justify-between min-w-0">
                        <div className="relative flex-1 min-w-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
                            <input
                                type="text"
                                placeholder="Search employees..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-dark-bg/50 border border-dark-border rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:border-primary-500 outline-none"
                            />
                        </div>

                        {/* Filters */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <select
                                value={shiftFilter}
                                onChange={(e) => setShiftFilter(e.target.value as any)}
                                className="bg-dark-bg/50 border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:border-primary-500 outline-none"
                            >
                                <option value="ALL">All Shifts</option>
                                <option value="GENERAL">General</option>
                                <option value="MORNING">Morning</option>
                                <option value="EVENING">Evening</option>
                                <option value="NIGHT">Night</option>
                            </select>

                            <select
                                value={deptFilter}
                                onChange={(e) => setDeptFilter(e.target.value)}
                                className="bg-dark-bg/50 border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:border-primary-500 outline-none"
                            >
                                <option value="ALL">All Departments</option>
                                {allDepartments.map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>

                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                                className="bg-dark-bg/50 border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:border-primary-500 outline-none"
                            >
                                <option value="ALL">All Status</option>
                                <option value="PRESENT">Present</option>
                                <option value="LATE">Late</option>
                                <option value="ABSENT">Absent</option>
                                <option value="HALF_DAY">Half Day</option>
                                <option value="WORK_FROM_HOME">Work From Home</option>
                                <option value="ON_LEAVE">On Leave</option>
                                <option value="PENDING">Pending</option>
                            </select>
                        </div>
                    </div>

                    {/* Bulk Action Bar */}
                    {canManualUpdate && selectedEmpIds.size > 0 && (
                        <div className="px-4 py-2.5 bg-primary-500/10 border-b border-primary-500/20 flex items-center gap-3 flex-wrap">
                            <span className="text-primary-400 font-bold text-xs">{selectedEmpIds.size} selected</span>
                            <div className="flex items-center gap-2 flex-wrap flex-1">
                                <button onClick={() => bulkMark(AttendanceStatus.PRESENT)}
                                    className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors">
                                    ✓ Present
                                </button>
                                <button onClick={() => bulkMark(AttendanceStatus.ABSENT)}
                                    className="px-3 py-1 rounded-lg text-xs font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
                                    ✗ Absent
                                </button>
                                <button onClick={() => bulkMark(AttendanceStatus.HALF_DAY)}
                                    className="px-3 py-1 rounded-lg text-xs font-bold bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-colors">
                                    ½ Half Day
                                </button>
                                <button onClick={() => bulkMark(AttendanceStatus.LATE)}
                                    className="px-3 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors">
                                    ⏰ Late
                                </button>
                                <button onClick={() => bulkMark(AttendanceStatus.WORK_FROM_HOME)}
                                    className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors">
                                    🏠 WFH
                                </button>
                            </div>
                            <button onClick={clearSelection} className="ml-auto text-dark-muted hover:text-white text-xs transition-colors">
                                Clear
                            </button>
                        </div>
                    )}

                    {/* Table */}
                    <div className="flex-1 overflow-x-auto overflow-y-auto bg-dark-bg/20 min-h-[300px] w-full">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-dark-bg/50 text-dark-muted sticky top-0 z-10 backdrop-blur-md">
                                <tr>
                                    {canManualUpdate && (
                                        <th className="pl-4 pr-2 py-4 w-8">
                                            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                                                className="w-3.5 h-3.5 accent-primary-500 cursor-pointer" />
                                        </th>
                                    )}
                                    <th className="p-4 font-medium">Employee</th>
                                    <th className="p-4 font-medium">Shift</th>
                                    <th className="p-4 font-medium">
                                        {canManualUpdate ? (
                                            <span className="flex items-center gap-1">
                                                Punch In <Edit2 className="w-3 h-3 text-emerald-500/50" />
                                            </span>
                                        ) : 'Punch In'}
                                    </th>
                                    <th className="p-4 font-medium">
                                        {canManualUpdate ? (
                                            <span className="flex items-center gap-1">
                                                Punch Out <Edit2 className="w-3 h-3 text-blue-500/50" />
                                            </span>
                                        ) : 'Punch Out'}
                                    </th>
                                    <th className="p-4 font-medium">Hours / OT</th>
                                    <th className="p-4 font-medium">Status</th>
                                    {canManualUpdate && <th className="p-4 font-medium text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-border/30">
                                {filteredEmployees.map(emp => {
                                    const record = records.find(r => r.employeeId === emp.id && r.date === selectedDate);

                                    // Holiday/Weekend Logic display
                                    const holiday = isHoliday(selectedDate);
                                    const isSunday = new Date(selectedDate).getDay() === 0;

                                    let statusLabel = "PENDING";
                                    let statusColor = "bg-dark-bg text-dark-muted border border-dark-border";

                                    if (record) {
                                        statusLabel = record.status;
                                        if (record.status === 'PRESENT') statusColor = "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/20";
                                        else if (record.status === 'LATE') statusColor = "bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/20";
                                        else if (record.status === 'ABSENT') statusColor = "bg-red-500/15 text-red-400 border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.15)] ring-1 ring-red-500/20";
                                        else if (record.status === 'WORK_FROM_HOME') statusColor = "bg-blue-500/15 text-blue-400 border border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/20";
                                    } else {
                                        if (holiday) { statusLabel = "HOLIDAY"; statusColor = "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.15)]"; }
                                        else if (isSunday) { statusLabel = "WEEKLY OFF"; statusColor = "bg-pink-500/15 text-pink-400 border border-pink-500/30 shadow-[0_0_10px_rgba(236,72,153,0.15)]"; }
                                    }

                                    return (
                                        <tr key={emp.id} className={clsx("hover:bg-white/5 transition-colors group relative", selectedEmpIds.has(emp.id) && "bg-primary-500/5")}>
                                            {canManualUpdate && (
                                                <td className="pl-4 pr-2 py-4 w-8">
                                                    <input type="checkbox" checked={selectedEmpIds.has(emp.id)} onChange={() => toggleSelect(emp.id)}
                                                        className="w-3.5 h-3.5 accent-primary-500 cursor-pointer" />
                                                </td>
                                            )}
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative">
                                                        <img src={emp.avatar || `https://ui-avatars.com/api/?name=${emp.name}&background=random`} className="w-9 h-9 rounded-full object-cover border border-dark-border" />
                                                        <div className={clsx("absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-dark-bg",
                                                            emp.status === 'ACTIVE' ? "bg-success" : "bg-dark-muted"
                                                        )} />
                                                    </div>
                                                    <div>
                                                        <button onClick={() => setDrillEmpId(emp.id)} className="text-left group/drill">
                                                            <p className="text-white font-medium group-hover/drill:text-primary-400 transition-colors">{emp.name}</p>
                                                            <p className="text-[10px] text-dark-muted leading-tight">{emp.code}</p>
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="text-xs px-2 py-0.5 rounded bg-dark-bg border border-dark-border text-dark-muted">
                                                    {emp.shift}
                                                </span>
                                            </td>
                                            <td className="p-4 text-white font-mono text-xs">
                                                {record?.checkIn ? (
                                                    <button
                                                        onClick={() => canManualUpdate && record && openAdjust(record, 'checkIn')}
                                                        title={canManualUpdate ? 'Click to adjust Punch In time' : undefined}
                                                        className={`group flex flex-col items-start ${canManualUpdate ? 'cursor-pointer hover:text-emerald-300 transition-colors' : ''}`}
                                                    >
                                                        <span className={`${canManualUpdate ? 'underline decoration-dashed decoration-emerald-500/40 group-hover:decoration-emerald-400' : ''}`}>
                                                            {new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        {record?.lateByMinutes ? <span className="text-[10px] text-danger">+{record.lateByMinutes}m Late</span> : null}
                                                        {record?.isManualPunch && <span className="text-[9px] text-violet-400/70">manual</span>}
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-600">-</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-white font-mono text-xs">
                                                {record?.checkOut ? (
                                                    <button
                                                        onClick={() => canManualUpdate && record && openAdjust(record, 'checkOut')}
                                                        title={canManualUpdate ? 'Click to adjust Punch Out time' : undefined}
                                                        className={`group flex flex-col items-start ${canManualUpdate ? 'cursor-pointer hover:text-blue-300 transition-colors' : ''}`}
                                                    >
                                                        <span className={`${canManualUpdate ? 'underline decoration-dashed decoration-blue-500/40 group-hover:decoration-blue-400' : ''}`}>
                                                            {new Date(record.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        {record?.isManualPunch && <span className="text-[9px] text-violet-400/70">manual</span>}
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-600">-</span>
                                                )}
                                            </td>
                                            <td className="p-4 font-mono text-xs">
                                                {record?.checkIn && record?.checkOut ? (() => {
                                                    const diffMs = new Date(record.checkOut).getTime() - new Date(record.checkIn).getTime();
                                                    if (diffMs < 0) return (
                                                        <span className="text-red-400 text-[10px] font-bold flex items-center gap-1" title="Punch Out time, Punch In se pehle hai — adjust karein">
                                                            ⚠ Invalid
                                                        </span>
                                                    );
                                                    const totalH = diffMs / 3600000;
                                                    const h = Math.floor(totalH);
                                                    const m = Math.round((totalH - h) * 60);
                                                    const ot = record.overtimeHours || 0;
                                                    const bMins = calcBreakMins(record.breaks);
                                                    const hasOngoing = record.breaks?.some(b => !b.end);
                                                    return (
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-dark-muted">{h}h {m}m</span>
                                                            {ot > 0 && (
                                                                <span className="text-amber-400 font-bold text-[10px]">+{ot}h OT</span>
                                                            )}
                                                            {hasOngoing && (
                                                                <span className="text-cyan-400 text-[10px] animate-pulse">In Break</span>
                                                            )}
                                                            {!hasOngoing && bMins > 0 && (
                                                                <span className="text-cyan-400 text-[10px]">
                                                                    {Math.floor(bMins / 60) > 0 ? `${Math.floor(bMins / 60)}h ` : ''}{bMins % 60}m brk
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })() : record?.checkIn && record.breaks?.some(b => !b.end) ? (
                                                    <span className="text-cyan-400 text-[10px] animate-pulse">In Break</span>
                                                ) : <span className="text-slate-600">-</span>}
                                            </td>
                                            <td className="p-4">
                                                <span className={clsx("px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide", statusColor)}>
                                                    {statusLabel}
                                                </span>
                                            </td>
                                            {canManualUpdate && (
                                                <td className="p-4 text-right">
                                                    <div className="relative inline-block">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveActionId(activeActionId === emp.id ? null : emp.id);
                                                            }}
                                                            className={clsx(
                                                                "p-1.5 rounded-lg transition-colors",
                                                                activeActionId === emp.id ? "bg-primary-500 text-white shadow-lg shadow-primary-500/20" : "text-dark-muted hover:text-white hover:bg-white/10"
                                                            )}
                                                        >
                                                            {activeActionId === emp.id ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                                                        </button>

                                                        {/* Custom Popover Content */}
                                                        {activeActionId === emp.id && (
                                                            <div className="absolute right-0 top-full mt-2 w-40 bg-dark-card border border-dark-border/50 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                                                                <div className="p-1 space-y-0.5">
                                                                    <button
                                                                        onClick={() => { updateRecordStatus(emp.id, AttendanceStatus.PRESENT, selectedDate); setActiveActionId(null); }}
                                                                        className="w-full text-left px-3 py-2 text-xs font-medium text-success hover:bg-success/10 rounded-lg flex items-center gap-2"
                                                                    >
                                                                        <CheckCircle className="w-3.5 h-3.5" /> Mark Present
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { updateRecordStatus(emp.id, AttendanceStatus.ABSENT, selectedDate); setActiveActionId(null); }}
                                                                        className="w-full text-left px-3 py-2 text-xs font-medium text-danger hover:bg-danger/10 rounded-lg flex items-center gap-2"
                                                                    >
                                                                        <AlertTriangle className="w-3.5 h-3.5" /> Mark Absent
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { updateRecordStatus(emp.id, AttendanceStatus.HALF_DAY, selectedDate); setActiveActionId(null); }}
                                                                        className="w-full text-left px-3 py-2 text-xs font-medium text-warning hover:bg-warning/10 rounded-lg flex items-center gap-2"
                                                                    >
                                                                        <Clock className="w-3.5 h-3.5" /> Half Day
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { updateRecordStatus(emp.id, AttendanceStatus.LATE, selectedDate); setActiveActionId(null); }}
                                                                        className="w-full text-left px-3 py-2 text-xs font-medium text-primary-400 hover:bg-primary-500/10 rounded-lg flex items-center gap-2"
                                                                    >
                                                                        <Clock className="w-3.5 h-3.5" /> Mark Late
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { updateRecordStatus(emp.id, AttendanceStatus.WORK_FROM_HOME, selectedDate); setActiveActionId(null); }}
                                                                        className="w-full text-left px-3 py-2 text-xs font-medium text-blue-400 hover:bg-blue-500/10 rounded-lg flex items-center gap-2"
                                                                    >
                                                                        <MapPin className="w-3.5 h-3.5" /> Mark WFH
                                                                    </button>
                                                                    <div className="h-px bg-dark-border/50 my-1" />
                                                                    <button
                                                                        onClick={() => { setAdminPunchEmpId(emp.id); setAdjustRecord(undefined); setAdminPunchOpen(true); setActiveActionId(null); }}
                                                                        className="w-full text-left px-3 py-2 text-xs font-medium text-violet-400 hover:bg-violet-500/10 rounded-lg flex items-center gap-2 transition-colors"
                                                                    >
                                                                        <UserPlus className="w-3.5 h-3.5" /> Manual Punch
                                                                    </button>
                                                                    {record?.checkIn && (
                                                                        <button
                                                                            onClick={() => { openAdjust(record, 'checkIn'); setActiveActionId(null); }}
                                                                            className="w-full text-left px-3 py-2 text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 rounded-lg flex items-center gap-2 transition-colors"
                                                                        >
                                                                            <Edit2 className="w-3.5 h-3.5" /> Adjust In Time
                                                                        </button>
                                                                    )}
                                                                    {record?.checkOut && (
                                                                        <button
                                                                            onClick={() => { openAdjust(record, 'checkOut'); setActiveActionId(null); }}
                                                                            className="w-full text-left px-3 py-2 text-xs font-medium text-blue-400 hover:bg-blue-500/10 rounded-lg flex items-center gap-2 transition-colors"
                                                                        >
                                                                            <Edit2 className="w-3.5 h-3.5" /> Adjust Out Time
                                                                        </button>
                                                                    )}
                                                                    <div className="h-px bg-dark-border/50 my-1" />
                                                                    <button
                                                                        onClick={() => { removeRecord(emp.id, selectedDate); setActiveActionId(null); }}
                                                                        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-400 hover:bg-white/5 rounded-lg flex items-center gap-2 transition-colors"
                                                                    >
                                                                        <X className="w-3.5 h-3.5" /> Clear Status
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                                {filteredEmployees.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-dark-muted italic">
                                            No employees match the filters for this date.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {hiddenProductionCount > 0 && (
                        <div className="px-4 py-2 border-t border-dark-border/30 text-[11px] text-dark-muted flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-dark-muted inline-block" />
                            {hiddenProductionCount} production employee{hiddenProductionCount !== 1 ? 's' : ''} not shown — tracked via Production module
                        </div>
                    )}
                </div>

                {/* Right: Sidebar (Pending Requests & Summary) */}
                {hasPermission(PERMISSIONS.APPROVE_ATTENDANCE) && (
                    <div className="w-full lg:w-80 space-y-6">
                        {/* Pending Requests */}
                        <div className="glass rounded-xl p-5 border border-dark-border">
                            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                                <MessageSquarePlus className="w-5 h-5 text-warning" />
                                Requests
                            </h3>
                            {pendingRequests.length === 0 ? (
                                <div className="text-center py-6">
                                    <CheckCircle className="w-8 h-8 text-dark-muted mx-auto mb-2 opacity-50" />
                                    <p className="text-dark-muted text-sm">All caught up!</p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                    {pendingRequests.map(req => {
                                        const emp = employees.find(e => e.id === req.employeeId);
                                        const typeInfo = REG_TYPE_LABEL[req.type] ?? { label: req.type, color: 'bg-dark-bg text-dark-muted border-dark-border' };
                                        return (
                                            <div key={req.id} className="bg-dark-bg/50 p-3 rounded-lg border border-dark-border hover:border-warning/30 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <img src={emp?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp?.name || 'U')}&size=24`} className="w-6 h-6 rounded-full" />
                                                        <span className="text-sm text-white font-medium">{emp?.name.split(' ')[0]}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] text-dark-muted bg-dark-bg px-1.5 py-0.5 rounded">{req.date}</span>
                                                        <button onClick={() => setViewReqId(req.id)}
                                                            className="p-1 rounded hover:bg-warning/10 text-dark-muted hover:text-warning transition-colors" title="View Details">
                                                            <Eye className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded border mb-2 inline-block', typeInfo.color)}>{typeInfo.label}</span>
                                                <p className="text-xs text-dark-muted mb-3 line-clamp-2 italic">"{req.reason}"</p>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            useRegularizationStore.getState().updateStatus(req.id, 'APPROVED');
                                                            updateRecordStatus(req.employeeId, AttendanceStatus.PRESENT);
                                                        }}
                                                        className="flex-1 bg-success/10 hover:bg-success/20 text-success text-xs py-1.5 rounded font-medium transition-colors"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => useRegularizationStore.getState().updateStatus(req.id, 'REJECTED')}
                                                        className="flex-1 bg-danger/10 hover:bg-danger/20 text-danger text-xs py-1.5 rounded font-medium transition-colors"
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            )}
            {/* Admin Manual Punch / Adjust Modal */}
            <AdminPunchModal
                isOpen={adminPunchOpen}
                onClose={() => {
                    setAdminPunchOpen(false);
                    setAdjustRecord(undefined);
                    setAdminPunchEmpId(undefined);
                }}
                preSelectedEmployeeId={adjustRecord ? undefined : adminPunchEmpId}
                adjustRecord={adjustRecord}
                adjustField={adjustField}
            />
            {/* Employee Drill-Down Panel */}
            <AnimatePresence>
                {drillEmpId && drillEmp && (
                    <EmployeeDrillModal
                        emp={{ id: drillEmp.id, name: drillEmp.name, code: drillEmp.code, avatar: drillEmp.avatar, shift: drillEmp.shift, department: drillEmp.department }}
                        onClose={() => setDrillEmpId(null)}
                    />
                )}
            </AnimatePresence>
            {/* Import Result Modal */}
            <AnimatePresence>
                {importResult && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={() => setImportResult(null)}>
                        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="relative w-full max-w-md bg-dark-card border border-dark-border rounded-2xl shadow-2xl overflow-hidden"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-3 px-5 py-4 border-b border-dark-border/50">
                                <Upload className="w-5 h-5 text-emerald-400" />
                                <h2 className="text-white font-bold flex-1">Import Result</h2>
                                <button onClick={() => setImportResult(null)} className="p-1.5 rounded-lg text-dark-muted hover:text-white hover:bg-white/5 transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="p-5 space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                                        <p className="text-2xl font-bold text-emerald-400">{importResult.ok}</p>
                                        <p className="text-xs text-dark-muted mt-0.5">Records Imported</p>
                                    </div>
                                    <div className={clsx('border rounded-xl p-3 text-center', importResult.errors.length > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-dark-bg/40 border-dark-border/30')}>
                                        <p className={clsx('text-2xl font-bold', importResult.errors.length > 0 ? 'text-red-400' : 'text-dark-muted')}>{importResult.errors.length}</p>
                                        <p className="text-xs text-dark-muted mt-0.5">Errors</p>
                                    </div>
                                </div>
                                {importResult.errors.length > 0 && (
                                    <div className="bg-dark-bg/40 rounded-xl p-3 border border-dark-border/30 max-h-48 overflow-y-auto space-y-1">
                                        {importResult.errors.map((e, i) => (
                                            <p key={i} className="text-xs text-red-400 flex gap-2"><span className="text-red-500/50">•</span>{e}</p>
                                        ))}
                                    </div>
                                )}
                                <button onClick={() => setImportResult(null)}
                                    className="w-full py-2.5 rounded-xl text-sm font-bold bg-primary-500/15 hover:bg-primary-500/25 text-primary-400 border border-primary-500/30 transition-colors">
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Regularization Detail Modal */}
            <AnimatePresence>
                {viewReq && (
                    <RegularizationDetailModal
                        req={viewReq}
                        emp={employees.find(e => e.id === viewReq.employeeId)}
                        existingRecord={records.find(r => r.employeeId === viewReq.employeeId && r.date === viewReq.date)}
                        onApprove={() => {
                            useRegularizationStore.getState().updateStatus(viewReq.id, 'APPROVED');
                            updateRecordStatus(viewReq.employeeId, AttendanceStatus.PRESENT);
                            setViewReqId(null);
                        }}
                        onReject={() => {
                            useRegularizationStore.getState().updateStatus(viewReq.id, 'REJECTED');
                            setViewReqId(null);
                        }}
                        onClose={() => setViewReqId(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};
