import { create } from 'zustand';
import { AttendanceRecord, AttendanceStatus } from '@/types';
import { calculateLateDuration } from '@/config/shiftRules';
import { useInternalShiftStore } from '@/store/shiftStore';
import { apiFetch } from '@/lib/apiClient';
import { useAuthStore } from './authStore';
import { useRolePermissionsStore } from './rolePermissionsStore';
import { useEmployeeStore } from './employeeStore';

interface AttendanceState {
    records: AttendanceRecord[];
    isLoading: boolean;
    offlineQueue: { method: 'POST' | 'PUT' | 'DELETE', url: string, body?: any, id: string }[];
    syncOfflineQueue: () => Promise<void>;

    // Core punch actions
    markCheckIn: (employeeId: string, shiftId: string, imageProof?: string, meta?: {
        punchMode?: AttendanceRecord['punchMode'];
        punchLocationId?: string;
        usedPinPunch?: boolean;
    }) => Promise<void>;
    markCheckOut: (employeeId: string, meta?: {
        punchMode?: AttendanceRecord['punchMode'];
    }) => Promise<void>;
    updateRecordStatus: (employeeId: string, status: AttendanceStatus, date?: string) => Promise<void>;
    removeRecord: (employeeId: string, date?: string) => Promise<void>;
    getTodayRecord: (employeeId: string) => AttendanceRecord | undefined;
    fetchAttendance: () => Promise<void>;

    // ── Break Time Tracking ───────────────────────────────────────────────────
    startBreak: (employeeId: string) => Promise<void>;
    endBreak: (employeeId: string) => Promise<void>;
    getTodayBreaks: (employeeId: string) => import('@/types').BreakRecord[];
    getActiveBreak: (employeeId: string) => import('@/types').BreakRecord | undefined;

    // ── Admin Manual Punch ────────────────────────────────────────────────────
    adminPunch: (params: {
        employeeId: string;
        type: 'checkIn' | 'checkOut' | 'breakStart' | 'breakEnd';
        time: string;      // ISO timestamp
        reason: string;
        adminName: string;
        shiftId?: string;
    }) => Promise<void>;

    // ── Adjust Existing Punch Time ────────────────────────────────────────────
    adjustPunchTime: (params: {
        recordId: string;         // attendance record ID
        field: 'checkIn' | 'checkOut';
        newTime: string;          // ISO timestamp
        reason: string;
        adminName: string;
    }) => Promise<void>;
}

const useInternalAttendanceStore = create<AttendanceState>((set, get) => {
    // ── LocalStorage Queue Helpers ──
    const saveQueue = (q: any[]) => {
        try { localStorage.setItem('sm_attendance_queue', JSON.stringify(q)); } catch { }
    };
    const loadQueue = (): any[] => {
        try { return JSON.parse(localStorage.getItem('sm_attendance_queue') || '[]'); } catch { return []; }
    };

    // Auto-sync when coming online
    if (typeof window !== 'undefined') {
        window.addEventListener('online', () => get().syncOfflineQueue());
    }

    return {
        records: [],
        isLoading: false,
        offlineQueue: loadQueue(),

        syncOfflineQueue: async () => {
            const q = get().offlineQueue;
            if (q.length === 0 || typeof navigator !== 'undefined' && !navigator.onLine) return;

            const remaining = [];
            let syncedAny = false;
            for (const item of q) {
                try {
                    const res = await apiFetch(item.url, {
                        method: item.method,
                        headers: { 'Content-Type': 'application/json' },
                        body: item.body ? JSON.stringify(item.body) : undefined,
                    });
                    if (res.ok) {
                        syncedAny = true;
                    } else {
                        remaining.push(item);
                    }
                } catch (e) {
                    remaining.push(item);
                }
            }
            if (syncedAny || remaining.length !== q.length) {
                set({ offlineQueue: remaining });
                saveQueue(remaining);
                if (syncedAny) get().fetchAttendance(); // Refresh to get real IDs/timestamps
            }
        },

        // ── Fetch from Server ──────────────────────────────────────────────────────
        fetchAttendance: async () => {
            set({ isLoading: true });
            try {
                const res = await apiFetch(`/attendance`);
                if (res.ok) {
                    const data = await res.json();
                    // Normalize: SQLite returns `breaks` as JSON string or null — parse it back to array
                    const normalized = Array.isArray(data)
                        ? data.map((r: any) => ({
                            ...r,
                            breaks: Array.isArray(r.breaks)
                                ? r.breaks
                                : typeof r.breaks === 'string' && r.breaks
                                    ? (() => { try { return JSON.parse(r.breaks); } catch { return []; } })()
                                    : [],
                        }))
                        : [];
                    set({ records: normalized });
                }
            } catch (error) {
                console.error('Failed to fetch attendance:', error);
            } finally {
                set({ isLoading: false });
            }
        },

        // ── Mark Check-In ──────────────────────────────────────────────────────────
        markCheckIn: async (employeeId, shiftId, _imageProof, meta) => {
            const today = new Date().toISOString().split('T')[0];
            const now = new Date();

            // Prevent duplicate check-in for the same day
            const existing = get().records.find(r => r.employeeId === employeeId && r.date === today);
            if (existing) return;

            // Calculate late minutes based on shift
            const shift = useInternalShiftStore.getState().getShift(shiftId);
            let lateMinutes = 0;
            if (shift) {
                lateMinutes = calculateLateDuration(now, shift.startTime, shift.graceTimeMinutes);
            }

            const status = lateMinutes > 0 ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;

            const newRecord: AttendanceRecord = {
                id: Math.random().toString(36).substr(2, 9),
                employeeId,
                date: today,
                checkIn: now.toISOString(),
                status,
                shiftId,
                lateByMinutes: lateMinutes,
                overtimeHours: 0,
                breaks: [],
                punchMode: meta?.punchMode ?? 'face',
                punchLocationId: meta?.punchLocationId,
                usedPinPunch: meta?.usedPinPunch,
            };

            // 1. Optimistic local update
            set(state => ({ records: [...state.records, newRecord] }));

            // 2. Save to server (SQLite database)
            try {
                const res = await apiFetch(`/attendance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newRecord),
                });
                if (res.ok) {
                    const saved = await res.json();
                    set(state => ({
                        records: state.records.map(r => r.id === newRecord.id ? { ...newRecord, ...saved } : r)
                    }));
                } else throw new Error('Server returned error');
            } catch (err) {
                console.warn('Network error, saving check-in to offline queue', err);
                const q = [...get().offlineQueue, { id: Math.random().toString(), method: 'POST' as const, url: '/attendance', body: newRecord }];
                set({ offlineQueue: q });
                saveQueue(q);
            }
        },

        // ── Mark Check-Out ─────────────────────────────────────────────────────────
        markCheckOut: async (employeeId) => {
            const today = new Date().toISOString().split('T')[0];
            const now = new Date();

            // Find today's record to get checkIn time and id
            const todayRecord = get().records.find(r => r.employeeId === employeeId && r.date === today);
            if (!todayRecord) return; // No check-in found

            // Calculate overtime
            const checkInTime = new Date(todayRecord.checkIn!);
            const durationHours = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
            const standardHours = 9;
            const overtimeHours = parseFloat(
                (durationHours > standardHours ? durationHours - standardHours : 0).toFixed(2)
            );

            const checkOutPayload = {
                checkOut: now.toISOString(),
                overtimeHours,
            };

            // 1. Optimistic local update
            set(state => ({
                records: state.records.map(record =>
                    record.employeeId === employeeId && record.date === today
                        ? { ...record, ...checkOutPayload }
                        : record
                )
            }));

            // 2. Save checkout to server
            try {
                const res = await apiFetch(`/attendance/${todayRecord.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(checkOutPayload),
                });
                if (!res.ok) throw new Error('Server error on checkout');
            } catch (err) {
                console.warn('Network error, saving check-out to offline queue', err);
                const q = [...get().offlineQueue, { id: Math.random().toString(), method: 'PUT' as const, url: `/attendance/${todayRecord.id}`, body: checkOutPayload }];
                set({ offlineQueue: q });
                saveQueue(q);
            }
        },

        // ── Update Record Status (Manual / Admin Override) ─────────────────────────
        updateRecordStatus: async (employeeId, status, date) => {
            const targetDate = date || new Date().toISOString().split('T')[0];
            const isToday = targetDate === new Date().toISOString().split('T')[0];
            const checkInTime = isToday
                ? new Date().toISOString()
                : `${targetDate}T09:00:00.000Z`;

            // Check if record already exists
            const existing = get().records.find(r => r.employeeId === employeeId && r.date === targetDate);

            let recordToSave: AttendanceRecord;

            if (existing) {
                // Update existing record
                recordToSave = { ...existing, status };

                // 1. Update local state
                set(state => ({
                    records: state.records.map(r =>
                        r.employeeId === employeeId && r.date === targetDate
                            ? { ...r, status }
                            : r
                    )
                }));

                // 2. Update on server
                try {
                    await apiFetch(`/attendance/${existing.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status }),
                    });
                } catch (err) {
                    console.error('Failed to update attendance status on server:', err);
                }
            } else {
                // Create new record
                recordToSave = {
                    id: Math.random().toString(36).substr(2, 9),
                    employeeId,
                    date: targetDate,
                    checkIn: status === AttendanceStatus.ABSENT ? undefined : checkInTime,
                    status,
                    lateByMinutes: 0,
                    overtimeHours: 0,
                    isOverride: true, // Mark as manual override
                };

                // 1. Add to local state
                set(state => ({ records: [...state.records, recordToSave] }));

                // 2. Save to server
                try {
                    await apiFetch(`/attendance`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(recordToSave),
                    });
                } catch (err) {
                    console.error('Failed to save new attendance record to server:', err);
                }
            }
        },

        // ── Remove Record ──────────────────────────────────────────────────────────
        removeRecord: async (employeeId, date) => {
            const targetDate = date || new Date().toISOString().split('T')[0];

            // Find the record before removing (need id for server delete)
            const record = get().records.find(r => r.employeeId === employeeId && r.date === targetDate);

            // 1. Optimistic local removal
            set(state => ({
                records: state.records.filter(r => !(r.employeeId === employeeId && r.date === targetDate))
            }));

            // 2. Delete from server
            if (record) {
                try {
                    await apiFetch(`/attendance/${record.id}`, {
                        method: 'DELETE',
                    });
                } catch (err) {
                    console.error('Failed to delete attendance from server:', err);
                    // Restore local record if server delete fails
                    set(state => ({ records: [...state.records, record] }));
                }
            }
        },

        // ── Get Today's Record ─────────────────────────────────────────────────────
        getTodayRecord: (employeeId) => {
            const today = new Date().toISOString().split('T')[0];
            return get().records.find(r => r.employeeId === employeeId && r.date === today);
        },

        // ── Break Time Tracking ────────────────────────────────────────────────────
        startBreak: async (employeeId) => {
            const today = new Date().toISOString().split('T')[0];
            const now = new Date().toISOString();
            const rec = get().records.find(r => r.employeeId === employeeId && r.date === today);
            if (!rec || !rec.checkIn || rec.checkOut) return; // Must be punched in, not out

            // Don't start if break already in progress
            const activeBreak = (rec.breaks || []).find(b => !b.end);
            if (activeBreak) return;

            const updatedBreaks = [...(rec.breaks || []), { start: now }];
            set(state => ({
                records: state.records.map(r =>
                    r.employeeId === employeeId && r.date === today
                        ? { ...r, breaks: updatedBreaks }
                        : r
                )
            }));
            // Sync to server
            try {
                await apiFetch(`/attendance/${rec.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ breaks: updatedBreaks }),
                });
            } catch (err) { console.error('Break start sync failed:', err); }
        },

        endBreak: async (employeeId) => {
            const today = new Date().toISOString().split('T')[0];
            const now = new Date().toISOString();
            const rec = get().records.find(r => r.employeeId === employeeId && r.date === today);
            if (!rec) return;

            const updatedBreaks = (rec.breaks || []).map(b =>
                !b.end ? { ...b, end: now } : b
            );
            set(state => ({
                records: state.records.map(r =>
                    r.employeeId === employeeId && r.date === today
                        ? { ...r, breaks: updatedBreaks }
                        : r
                )
            }));
            try {
                await apiFetch(`/attendance/${rec.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ breaks: updatedBreaks }),
                });
            } catch (err) { console.error('Break end sync failed:', err); }
        },

        getTodayBreaks: (employeeId) => {
            const today = new Date().toISOString().split('T')[0];
            const rec = get().records.find(r => r.employeeId === employeeId && r.date === today);
            return rec?.breaks || [];
        },

        getActiveBreak: (employeeId) => {
            const today = new Date().toISOString().split('T')[0];
            const rec = get().records.find(r => r.employeeId === employeeId && r.date === today);
            return (rec?.breaks || []).find(b => !b.end);
        },

        // ── Admin Manual Punch ─────────────────────────────────────────────────────
        adminPunch: async ({ employeeId, type, time, reason, adminName, shiftId }) => {
            const today = time.split('T')[0];
            const existing = get().records.find(r => r.employeeId === employeeId && r.date === today);

            if (type === 'checkIn') {
                if (existing) {
                    // Update checkIn time
                    const updates = { checkIn: time, isManualPunch: true, manualPunchBy: adminName, manualPunchReason: reason, punchMode: 'admin' as const };
                    set(state => ({
                        records: state.records.map(r =>
                            r.employeeId === employeeId && r.date === today ? { ...r, ...updates } : r
                        )
                    }));
                    try { await apiFetch(`/attendance/${existing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) }); }
                    catch (err) { console.error('Admin punch sync failed:', err); }
                } else {
                    // Create new record
                    const newRec: AttendanceRecord = {
                        id: Math.random().toString(36).substr(2, 9),
                        employeeId, date: today, checkIn: time,
                        status: AttendanceStatus.PRESENT,
                        shiftId, lateByMinutes: 0, overtimeHours: 0, breaks: [],
                        isManualPunch: true, manualPunchBy: adminName, manualPunchReason: reason, punchMode: 'admin',
                    };
                    set(state => ({ records: [...state.records, newRec] }));
                    try { await apiFetch(`/attendance`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newRec) }); }
                    catch (err) { console.error('Admin punch create failed:', err); }
                }
            } else if (type === 'checkOut' && existing) {
                const checkIn = existing.checkIn ? new Date(existing.checkIn) : new Date(time);
                const checkOutDt = new Date(time);
                const diffH = (checkOutDt.getTime() - checkIn.getTime()) / 3600000;
                const overtimeHours = parseFloat((diffH > 9 ? diffH - 9 : 0).toFixed(2));
                const updates = { checkOut: time, overtimeHours, isManualPunch: true, manualPunchBy: adminName, manualPunchReason: reason };
                set(state => ({
                    records: state.records.map(r =>
                        r.employeeId === employeeId && r.date === today ? { ...r, ...updates } : r
                    )
                }));
                try { await apiFetch(`/attendance/${existing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) }); }
                catch (err) { console.error('Admin checkout sync failed:', err); }
            } else if (type === 'breakStart' && existing) {
                const updBreaks = [...(existing.breaks || []), { start: time }];
                set(state => ({
                    records: state.records.map(r =>
                        r.employeeId === employeeId && r.date === today ? { ...r, breaks: updBreaks } : r
                    )
                }));
                try { await apiFetch(`/attendance/${existing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ breaks: updBreaks }) }); }
                catch (err) { console.error('Admin break start failed:', err); }
            } else if (type === 'breakEnd' && existing) {
                const updBreaks = (existing.breaks || []).map(b => !b.end ? { ...b, end: time } : b);
                set(state => ({
                    records: state.records.map(r =>
                        r.employeeId === employeeId && r.date === today ? { ...r, breaks: updBreaks } : r
                    )
                }));
                try { await apiFetch(`/attendance/${existing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ breaks: updBreaks }) }); }
                catch (err) { console.error('Admin break end failed:', err); }
            }
        },
        // ── Adjust Existing Punch Time ─────────────────────────────────────────────
        adjustPunchTime: async ({ recordId, field, newTime, reason, adminName }) => {
            // 1. Optimistic local update
            set(state => ({
                records: state.records.map(r => {
                    if (r.id !== recordId) return r;
                    const updates: Partial<AttendanceRecord> = {
                        [field]: newTime,
                        isManualPunch: true,
                        manualPunchBy: adminName,
                        manualPunchReason: reason,
                        punchMode: 'admin' as const,
                    };
                    // Recalculate overtime if checkOut changed
                    if (field === 'checkOut' && r.checkIn) {
                        const inDt = new Date(r.checkIn);
                        const outDt = new Date(newTime);
                        const diffH = (outDt.getTime() - inDt.getTime()) / 3600000;
                        updates.overtimeHours = parseFloat((diffH > 9 ? diffH - 9 : 0).toFixed(2));
                    }
                    // Recalculate late minutes if checkIn changed
                    if (field === 'checkIn') {
                        // Simple recalc — late if after 09:05 with 5 min grace
                        const inHour = new Date(newTime).getHours();
                        const inMin = new Date(newTime).getMinutes();
                        const minutesSince9 = (inHour - 9) * 60 + inMin;
                        updates.lateByMinutes = minutesSince9 > 5 ? minutesSince9 : 0;
                        updates.status = (updates.lateByMinutes > 0 ? AttendanceStatus.LATE : AttendanceStatus.PRESENT);
                    }
                    return { ...r, ...updates };
                })
            }));

            // 2. Persist to server
            try {
                const payload: Record<string, unknown> = {
                    [field]: newTime,
                    isManualPunch: true,
                    manualPunchBy: adminName,
                    manualPunchReason: reason,
                    punchMode: 'admin',
                };
                await apiFetch(`/attendance/${recordId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            } catch (err) {
                console.error('adjustPunchTime sync failed:', err);
            }
        },
    };
});

// ── Exported Hook with Data Visibility Filtering ─────────────────────────────
export const useAttendanceStore = () => {
    const store = useInternalAttendanceStore();
    const user = useAuthStore(s => s.user);
    const getScope = useRolePermissionsStore(s => s.getScope);

    // We need employee data to know departments for TEAM filtering
    const { _rawStore } = useEmployeeStore();
    const employees = _rawStore?._rawEmployees || [];

    const filteredRecords = store.records.filter(r => {
        if (!user) return true;

        const scope = getScope(user.role);
        if (scope === 'ALL') return true;

        if (scope === 'TEAM') {
            const userEmp = employees.find((emp: any) => emp.id === user.id);
            const recordEmp = employees.find((emp: any) => emp.id === r.employeeId);
            if (!userEmp?.department) return r.employeeId === user.id; // Fallback to OWN
            return recordEmp?.department === userEmp.department;
        }

        if (scope === 'OWN') return r.employeeId === user.id;

        return false;
    });

    return {
        ...store,
        records: filteredRecords,
        _rawStore: store
    };
};

useAttendanceStore.getState = () => useInternalAttendanceStore.getState();
