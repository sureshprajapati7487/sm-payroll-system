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
    ScanFace
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/apiClient';

// --- Helper Components ---

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

    // -- State --
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
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

    // UI State
    const [activeActionId, setActiveActionId] = useState<string | null>(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [shiftFilter, setShiftFilter] = useState<ShiftType | 'ALL'>('ALL');
    const [statusFilter, setStatusFilter] = useState<AttendanceStatus | 'ALL' | 'PENDING'>('ALL');

    // Location
    const [locationStatus, setLocationStatus] = useState<'IDLE' | 'FETCHING' | 'SUCCESS' | 'ERROR'>('IDLE');
    const [locationError, setLocationError] = useState('');

    const canManualUpdate = hasPermission(PERMISSIONS.MANUAL_ATTENDANCE);

    // -- Derived Data --
    const isToday = selectedDate === new Date().toISOString().split('T')[0];

    // User Status (Only relevant for Today)
    const currentUserRecord = user ? records.find(r => r.employeeId === user.id && r.date === selectedDate) : undefined;
    const isCheckedIn = !!currentUserRecord;
    const isCheckedOut = !!currentUserRecord?.checkOut;

    // Filter Logic
    const canViewAllAttendance = hasPermission(PERMISSIONS.VIEW_ATTENDANCE) || hasPermission(PERMISSIONS.VIEW_TEAM_ATTENDANCE);

    const activeEmployees = employees.filter(e => {
        // Privacy filter: Unprivileged users only see themselves
        if (!canViewAllAttendance && e.id !== user?.id) return false;

        const isProduction = e.department?.toLowerCase().includes('production') ||
            e.salaryType === 'PRODUCTION'; // Hide Production staff
        return e.status === 'ACTIVE' && !isProduction;
    });

    const filteredEmployees = activeEmployees.filter(emp => {
        const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesShift = shiftFilter === 'ALL' || emp.shift === shiftFilter;

        let matchesStatus = true;
        const record = records.find(r => r.employeeId === emp.id && r.date === selectedDate);

        if (statusFilter !== 'ALL') {
            if (statusFilter === 'PENDING') matchesStatus = !record;
            else matchesStatus = record?.status === statusFilter;
        }

        return matchesSearch && matchesShift && matchesStatus;
    });

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
        setSelectedDate(date.toISOString().split('T')[0]);
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

    return (
        <div className="space-y-6">
            {/* Header: Date Navigation & Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-dark-text mb-1">Attendance &amp; Timing</h1>
                    <div className="flex items-center gap-2 text-dark-muted text-sm">
                        <button onClick={() => changeDate(-1)} className="hover:text-white p-1"><ChevronLeft className="w-4 h-4" /></button>
                        <div className="flex items-center gap-2 bg-dark-card border border-dark-border px-3 py-1 rounded-lg">
                            <Calendar className="w-4 h-4 text-primary-400" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent text-white outline-none text-sm w-32"
                            />
                        </div>
                        <button onClick={() => changeDate(1)} className="hover:text-white p-1"><ChevronRight className="w-4 h-4" /></button>
                        {isToday && <span className="text-primary-500 font-bold px-2 text-xs bg-primary-500/10 rounded-full py-0.5">TODAY</span>}
                    </div>
                </div>

                {/* Main Actions */}
                <div className="flex items-center gap-3">
                    {/* Live Clock for Everyone */}
                    <div className="hidden md:flex flex-col items-end mr-4">
                        <div className="text-[10px] text-dark-muted uppercase tracking-widest">Office Time</div>
                        <LiveClock />
                    </div>

                    {/* Check In/Out UI (Only for Today & Non-Admins usually, but admins can self-mark) */}
                    {isToday && hasPermission(PERMISSIONS.MARK_OWN_ATTENDANCE) && !canManualUpdate && (
                        <>
                            {!isCheckedIn ? (
                                <button
                                    onClick={() => { setScanMode('IN'); setIsScanOpen(true); }}
                                    className="px-5 py-2.5 bg-success hover:bg-success/90 text-white rounded-xl font-bold shadow-lg shadow-success/20 flex items-center gap-2 transition-all"
                                >
                                    <MapPin className="w-4 h-4" /> Check In
                                </button>
                            ) : !isCheckedOut ? (
                                <button
                                    onClick={() => { setScanMode('OUT'); setIsScanOpen(true); }}
                                    className="px-5 py-2.5 bg-danger hover:bg-danger/90 text-white rounded-xl font-bold shadow-lg shadow-danger/20 flex items-center gap-2 transition-all"
                                >
                                    <Clock className="w-4 h-4" /> Check Out
                                </button>
                            ) : (
                                <div className="px-4 py-2 bg-dark-card border border-success/30 text-success rounded-xl flex items-center gap-2 text-sm font-medium">
                                    <CheckCircle className="w-4 h-4" /> Shift Completed
                                </div>
                            )}
                        </>
                    )}

                    {/* Admin Actions */}
                    {(hasPermission(PERMISSIONS.EXPORT_REPORTS) || canManualUpdate || hasPermission(PERMISSIONS.USE_FACE_KIOSK)) && (
                        <>
                            {hasPermission(PERMISSIONS.EXPORT_REPORTS) && (
                                <button onClick={handleExport} className="p-2 bg-dark-card border border-dark-border hover:bg-dark-card/80 rounded-lg text-dark-muted hover:text-white transition-colors" title="Export Excel">
                                    <FileSpreadsheet className="w-5 h-5" />
                                </button>
                            )}
                            {canManualUpdate && (
                                <button
                                    onClick={() => { setAdminPunchEmpId(undefined); setAdminPunchOpen(true); }}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-violet-600/20 border border-violet-500/30 hover:bg-violet-600/30 rounded-lg text-violet-400 hover:text-violet-300 transition-colors text-sm font-bold"
                                    title="Admin Manual Punch"
                                >
                                    <UserPlus className="w-4 h-4" /> Manual Punch
                                </button>
                            )}
                            {hasPermission(PERMISSIONS.USE_FACE_KIOSK) && (
                                <button
                                    onClick={() => navigate('/attendance/kiosk')}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/20 border border-emerald-500/30 hover:bg-emerald-600/30 rounded-lg text-emerald-400 hover:text-emerald-300 transition-colors text-sm font-bold"
                                    title="Face Kiosk Mode"
                                >
                                    <ScanFace className="w-4 h-4" /> Face Kiosk
                                </button>
                            )}
                        </>
                    )}

                    {hasPermission(PERMISSIONS.MANAGE_HOLIDAYS) && (
                        <button
                            onClick={() => navigate('/attendance/holidays')}
                            className="p-2 bg-dark-card border border-dark-border hover:bg-dark-card/80 rounded-lg text-dark-muted hover:text-white transition-colors"
                        >
                            <CalendarCheck className="w-5 h-5" />
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass p-4 rounded-xl border-t-4 border-success relative overflow-hidden group">
                    <div className="absolute right-2 top-2 opacity-10 group-hover:opacity-20 transition-opacity"><CheckCircle className="w-12 h-12 text-success" /></div>
                    <p className="text-dark-muted text-xs font-medium uppercase">Present</p>
                    <p className="text-2xl font-bold text-dark-text mt-1">{stats.present} <span className="text-sm text-dark-muted font-normal">/ {stats.total}</span></p>
                </div>
                <div className="glass p-4 rounded-xl border-t-4 border-warning relative overflow-hidden group">
                    <div className="absolute right-2 top-2 opacity-10 group-hover:opacity-20 transition-opacity"><Clock className="w-12 h-12 text-warning" /></div>
                    <p className="text-dark-muted text-xs font-medium uppercase">Late Arrival</p>
                    <p className="text-2xl font-bold text-dark-text mt-1">{stats.late}</p>
                </div>
                <div className="glass p-4 rounded-xl border-t-4 border-danger relative overflow-hidden group">
                    <div className="absolute right-2 top-2 opacity-10 group-hover:opacity-20 transition-opacity"><AlertTriangle className="w-12 h-12 text-danger" /></div>
                    <p className="text-dark-muted text-xs font-medium uppercase">Absent</p>
                    <p className="text-2xl font-bold text-dark-text mt-1">{stats.absent}</p>
                </div>
                <div className="glass p-4 rounded-xl border-t-4 border-primary-500 relative overflow-hidden group">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
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
                                <div key={sh} className={`glass rounded-xl p-4 border ${SHIFT_COLORS[sh]} cursor-pointer hover:shadow-lg transition-all`}
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

            {/* Main Content Area */}
            <div className="flex flex-col lg:flex-row gap-6">

                {/* Left: Attendance List */}
                <div className="flex-1 glass rounded-2xl overflow-hidden flex flex-col min-h-[500px]">
                    {/* Toolbar */}
                    <div className="p-4 border-b border-dark-border/50 flex flex-wrap gap-3 items-center justify-between">
                        <div className="relative flex-1 min-w-[200px]">
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
                        <div className="flex items-center gap-2">
                            <select
                                value={shiftFilter}
                                onChange={(e) => setShiftFilter(e.target.value as any)}
                                className="bg-dark-bg/50 border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:border-primary-500 outline-none"
                            >
                                <option value="ALL">All Shifts</option>
                                <option value="MORNING">Morning</option>
                                <option value="EVENING">Evening</option>
                                <option value="NIGHT">Night</option>
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
                                <option value="PENDING">Pending</option>
                            </select>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="flex-1 overflow-auto bg-dark-bg/20 min-h-[400px]">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-dark-bg/50 text-dark-muted sticky top-0 z-10 backdrop-blur-md">
                                <tr>
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
                                        if (record.status === 'PRESENT') statusColor = "bg-success/10 text-success border border-success/20";
                                        else if (record.status === 'LATE') statusColor = "bg-warning/10 text-warning border border-warning/20";
                                        else if (record.status === 'ABSENT') statusColor = "bg-danger/10 text-danger border border-danger/20";
                                    } else {
                                        if (holiday) { statusLabel = "HOLIDAY"; statusColor = "bg-blue-500/10 text-blue-400 border border-blue-500/20"; }
                                        else if (isSunday) { statusLabel = "WEEKLY OFF"; statusColor = "bg-pink-500/10 text-pink-400 border border-pink-500/20"; }
                                    }

                                    return (
                                        <tr key={emp.id} className="hover:bg-white/5 transition-colors group relative">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative">
                                                        <img src={emp.avatar || `https://ui-avatars.com/api/?name=${emp.name}&background=random`} className="w-9 h-9 rounded-full object-cover border border-dark-border" />
                                                        <div className={clsx("absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-dark-bg",
                                                            emp.status === 'ACTIVE' ? "bg-success" : "bg-dark-muted"
                                                        )} />
                                                    </div>
                                                    <div>
                                                        <p className="text-white font-medium">{emp.name}</p>
                                                        <p className="text-[10px] text-dark-muted leading-tight">{emp.code}</p>
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
                            {useRegularizationStore.getState().getPendingRequests().length === 0 ? (
                                <div className="text-center py-6">
                                    <CheckCircle className="w-8 h-8 text-dark-muted mx-auto mb-2 opacity-50" />
                                    <p className="text-dark-muted text-sm">All caught up!</p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                    {useRegularizationStore.getState().getPendingRequests().map(req => {
                                        const emp = employees.find(e => e.id === req.employeeId);
                                        return (
                                            <div key={req.id} className="bg-dark-bg/50 p-3 rounded-lg border border-dark-border transform hover:scale-[1.02] transition-transform">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <img src={emp?.avatar} className="w-6 h-6 rounded-full" />
                                                        <span className="text-sm text-white font-medium">{emp?.name.split(' ')[0]}</span>
                                                    </div>
                                                    <span className="text-[10px] text-dark-muted bg-dark-bg px-1.5 py-0.5 rounded">{req.date}</span>
                                                </div>
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
        </div>
    );
};
