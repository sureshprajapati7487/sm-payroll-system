// QuickCheckIn.tsx — Mobile-first punch page (full A-to-Z rewrite)
// Supports: Check-In · Check-Out · Start/End Break · Zone check · BSSID check

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MapPin, Clock, CheckCircle, Zap, Loader, AlertTriangle,
    ArrowLeft, LogIn, LogOut, Coffee, Wifi, WifiOff,
    Shield, AlertCircle, XCircle
} from 'lucide-react';
import { useAttendanceStore } from '@/store/attendanceStore';
import { useAuthStore } from '@/store/authStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { usePunchLocationStore } from '@/store/punchLocationStore';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';
import { getBSSID, validateBSSID } from '@/hooks/useBSSID';

// ── Haversine distance (metres) ───────────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Live Clock ────────────────────────────────────────────────────────────────
const LiveClock = () => {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);
    return (
        <div className="text-center">
            <div className="font-mono text-5xl font-black text-white tracking-wider">
                {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-xs text-white/40 mt-1 font-mono">
                {now.toLocaleTimeString('en-IN', { second: '2-digit' })}s
            </div>
            <div className="text-sm text-white/60 mt-2">
                {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
        </div>
    );
};

// ── Status Pill ───────────────────────────────────────────────────────────────
const StatusPill = ({
    icon: Icon, label, color
}: { icon: React.ElementType; label: string; color: string }) => (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${color}`}>
        <Icon className="w-3.5 h-3.5" />
        {label}
    </div>
);

// ════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════
export const QuickCheckIn = () => {
    const navigate = useNavigate();
    const { markCheckIn, markCheckOut, startBreak, endBreak, getActiveBreak, records } = useAttendanceStore();
    const { user } = useAuthStore();
    const { employees } = useEmployeeStore();
    const { punchLocations, fetchPunchLocations } = usePunchLocationStore();
    const { currentCompanyId } = useMultiCompanyStore();

    const [loading, setLoading] = useState(false);
    const [action, setAction] = useState<'checkin' | 'checkout' | 'start-break' | 'end-break' | null>(null);

    // ── GPS State ──────────────────────────────────────────────────────────
    const [gpsStatus, setGpsStatus] = useState<'checking' | 'ok' | 'mocked' | 'failed'>('checking');
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [zoneStatus, setZoneStatus] = useState<'checking' | 'inside' | 'outside' | 'no-zone'>('checking');
    const [matchedZone, setMatchedZone] = useState<string | null>(null);

    // ── BSSID State ────────────────────────────────────────────────────────
    const [bssidStatus, setBssidStatus] = useState<'checking' | 'ok' | 'blocked' | 'no-restriction'>('checking');
    const [bssidMsg, setBssidMsg] = useState('');

    // ── Action Result ──────────────────────────────────────────────────────
    const [result, setResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

    // ── Derived: current employee & today's attendance ─────────────────────
    const me = employees.find(e => e.email === user?.email || e.id === user?.id);
    const today = new Date().toISOString().split('T')[0];
    const myRecord = me ? records.find(r => r.employeeId === me.id && r.date === today) : null;
    const activeBreak = me ? getActiveBreak(me.id) : undefined;

    const punchState: 'none' | 'in' | 'on-break' | 'done' = !myRecord?.checkIn
        ? 'none'
        : activeBreak
            ? 'on-break'
            : !myRecord.checkOut
                ? 'in'
                : 'done';

    // ── Fetch punch zones ──────────────────────────────────────────────────
    useEffect(() => {
        if (currentCompanyId) fetchPunchLocations(currentCompanyId);
    }, [currentCompanyId]);

    // ── GPS + Zone + BSSID detection ───────────────────────────────────────
    useEffect(() => {
        if (!('geolocation' in navigator)) {
            setGpsStatus('failed');
            setZoneStatus('no-zone');
            setBssidStatus('no-restriction');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const c = pos.coords;

                // ── Mock GPS detection ──
                let isMocked = false;
                if ((window as any).Android?.isMockLocation) {
                    isMocked = !!(window as any).Android.isMockLocation();
                } else if (c.altitude === 0 && c.altitudeAccuracy === 0 && c.speed === 0 && c.heading === 0) {
                    isMocked = true;
                }
                if (isMocked) {
                    setGpsStatus('mocked');
                    setZoneStatus('outside');
                    setBssidStatus('no-restriction');
                    return;
                }

                const lat = c.latitude;
                const lng = c.longitude;
                setCoords({ lat, lng });
                setGpsStatus('ok');

                // ── Zone check ──
                const enabledZones = punchLocations.filter(z => z.enabled);
                if (enabledZones.length === 0) {
                    setZoneStatus('no-zone');
                } else {
                    let bestZone = null;
                    let bestDist = Infinity;
                    for (const zone of enabledZones) {
                        const dist = haversine(lat, lng, zone.lat, zone.lng);
                        if (dist < bestDist) { bestDist = dist; bestZone = zone; }
                    }
                    if (bestZone && bestDist <= bestZone.radiusMeters) {
                        setZoneStatus('inside');
                        setMatchedZone(bestZone.name);

                        // ── BSSID check for matched zone ──
                        const { bssid, isAndroidApp } = getBSSID();
                        const validation = validateBSSID(bssid, isAndroidApp, bestZone.allowedBSSIDs);
                        if (!validation.allowed) {
                            setBssidStatus('blocked');
                            setBssidMsg(validation.reason || 'Wrong Wi-Fi');
                        } else {
                            setBssidStatus(
                                !isAndroidApp || !(bestZone.allowedBSSIDs?.length)
                                    ? 'no-restriction'
                                    : 'ok'
                            );
                        }
                    } else {
                        setZoneStatus('outside');
                        setBssidStatus('no-restriction');
                    }
                }
            },
            () => {
                setGpsStatus('failed');
                setZoneStatus('no-zone');
                setBssidStatus('no-restriction');
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }, [punchLocations]);

    // ── Can the user punch? ────────────────────────────────────────────────
    const isBlocked =
        gpsStatus === 'mocked' ||
        zoneStatus === 'outside' ||
        bssidStatus === 'blocked';

    const isReady = gpsStatus !== 'checking' && zoneStatus !== 'checking' && bssidStatus !== 'checking';

    // ── Perform action ─────────────────────────────────────────────────────
    const performAction = async (act: 'checkin' | 'checkout' | 'start-break' | 'end-break') => {
        if (!user || !me || isBlocked) return;
        setAction(act);
        setLoading(true);
        setResult(null);
        try {
            if (act === 'checkin') {
                await markCheckIn(user.id, (me as any)?.shift || 'GENERAL', undefined, { punchMode: 'manual' } as any);
                setResult({ type: 'success', msg: `✅ Punch In recorded — ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` });
            } else if (act === 'checkout') {
                await markCheckOut(user.id);
                setResult({ type: 'success', msg: `✅ Punch Out recorded — ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` });
            } else if (act === 'start-break') {
                await startBreak(user.id);
                setResult({ type: 'success', msg: '☕ Break shuru ho gayi!' });
            } else if (act === 'end-break') {
                await endBreak(user.id);
                setResult({ type: 'success', msg: '✅ Break khatam — kaam back on!' });
            }
        } catch (err: any) {
            setResult({ type: 'error', msg: err?.message || 'Kuch chhoot gaya. Dobara try karo.' });
        } finally {
            setLoading(false);
            setAction(null);
        }
    };

    // ── Shift complete screen ──────────────────────────────────────────────
    if (punchState === 'done') {
        const checkInTime = myRecord?.checkIn ? new Date(myRecord.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
        const checkOutTime = myRecord?.checkOut ? new Date(myRecord.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6 text-center px-6 max-w-sm mx-auto">
                <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="w-28 h-28 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center"
                >
                    <CheckCircle className="w-14 h-14 text-emerald-400" />
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <h2 className="text-2xl font-black text-white">Aaj ka Shift Complete! 🎉</h2>
                    <p className="text-dark-muted mt-1">Bahut acha kaam kiya, {me?.name?.split(' ')[0]}!</p>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="glass rounded-xl p-3 border border-emerald-500/20">
                            <p className="text-emerald-400 font-mono font-bold text-lg">{checkInTime}</p>
                            <p className="text-dark-muted text-xs">Punch In</p>
                        </div>
                        <div className="glass rounded-xl p-3 border border-blue-500/20">
                            <p className="text-blue-400 font-mono font-bold text-lg">{checkOutTime}</p>
                            <p className="text-dark-muted text-xs">Punch Out</p>
                        </div>
                    </div>
                </motion.div>
                <motion.button
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/mobile/dashboard')}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold transition-all"
                >
                    Dashboard Par Jao
                </motion.button>
            </div>
        );
    }

    return (
        <div className="max-w-sm mx-auto space-y-4 pb-8">
            {/* Back button */}
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-dark-muted hover:text-white text-sm transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                Back
            </button>

            {/* ── Clock hero ─────────────────────────────────────────────────── */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-violet-700 to-indigo-800 py-8 px-6 shadow-2xl shadow-violet-900/50 text-center">
                <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5" />
                <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/5" />
                <p className="text-white/50 text-xs mb-4 flex items-center justify-center gap-1.5">
                    <Zap className="w-3 h-3 text-yellow-400" /> SM Payroll · Mobile Check-In
                </p>
                <LiveClock />
                {me && (
                    <p className="text-white/70 text-sm mt-4 font-medium">{me.name} · {me.code}</p>
                )}
                {/* Current status badge */}
                <div className="mt-3 flex justify-center">
                    {punchState === 'in' && (
                        <StatusPill icon={LogIn} label="Punched In — Out karo?" color="bg-emerald-500/20 text-emerald-300 border-emerald-500/30" />
                    )}
                    {punchState === 'on-break' && (
                        <StatusPill icon={Coffee} label="Break chal rahi hai" color="bg-amber-500/20 text-amber-300 border-amber-500/30" />
                    )}
                    {punchState === 'none' && (
                        <StatusPill icon={LogOut} label="Abhi Punch In nahi kiya" color="bg-slate-700/50 text-slate-400 border-slate-600/30" />
                    )}
                </div>
            </div>

            {/* ── Status Cards ───────────────────────────────────────────────── */}
            <div className="space-y-2">
                {/* GPS */}
                <div className="glass rounded-2xl border border-dark-border p-3 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${gpsStatus === 'ok' ? 'bg-emerald-500/20' : gpsStatus === 'checking' ? 'bg-yellow-500/20' : 'bg-red-500/20'}`}>
                        {gpsStatus === 'checking'
                            ? <Loader className="w-4 h-4 text-yellow-400 animate-spin" />
                            : gpsStatus === 'ok'
                                ? <MapPin className="w-4 h-4 text-emerald-400" />
                                : <AlertTriangle className="w-4 h-4 text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-semibold">
                            {gpsStatus === 'mocked' ? '⚠️ Fake GPS Detected!' : 'GPS Location'}
                        </p>
                        <p className="text-dark-muted text-[11px] truncate">
                            {gpsStatus === 'checking' ? 'Location detect ho rahi hai...'
                                : gpsStatus === 'mocked' ? 'Mock/Fake GPS use nahi kar sakte. Asli location chahiye.'
                                    : gpsStatus === 'ok' && coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
                                        : 'Location unavailable'}
                        </p>
                    </div>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${gpsStatus === 'ok' ? 'bg-emerald-400' : gpsStatus === 'checking' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'}`} />
                </div>

                {/* Zone */}
                <div className="glass rounded-2xl border border-dark-border p-3 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${zoneStatus === 'inside' ? 'bg-teal-500/20' : zoneStatus === 'no-zone' ? 'bg-slate-700/50' : zoneStatus === 'checking' ? 'bg-yellow-500/20' : 'bg-red-500/20'}`}>
                        {zoneStatus === 'checking'
                            ? <Loader className="w-4 h-4 text-yellow-400 animate-spin" />
                            : <Shield className={`w-4 h-4 ${zoneStatus === 'inside' ? 'text-teal-400' : zoneStatus === 'no-zone' ? 'text-slate-500' : 'text-red-400'}`} />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-semibold">Office Zone</p>
                        <p className="text-dark-muted text-[11px]">
                            {zoneStatus === 'checking' ? 'Zone verify ho rahi hai...'
                                : zoneStatus === 'inside' ? `✓ ${matchedZone} — Andar ho`
                                    : zoneStatus === 'outside' ? '✗ Office zone ke bahar ho'
                                        : 'Koi zone configured nahi — OK'}
                        </p>
                    </div>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${zoneStatus === 'inside' ? 'bg-teal-400' : zoneStatus === 'outside' ? 'bg-red-400' : zoneStatus === 'checking' ? 'bg-yellow-400 animate-pulse' : 'bg-slate-600'}`} />
                </div>

                {/* BSSID / Wi-Fi */}
                <div className="glass rounded-2xl border border-dark-border p-3 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bssidStatus === 'ok' ? 'bg-violet-500/20' : bssidStatus === 'blocked' ? 'bg-red-500/20' : bssidStatus === 'checking' ? 'bg-yellow-500/20' : 'bg-slate-700/50'}`}>
                        {bssidStatus === 'checking'
                            ? <Loader className="w-4 h-4 text-yellow-400 animate-spin" />
                            : bssidStatus === 'blocked'
                                ? <WifiOff className="w-4 h-4 text-red-400" />
                                : <Wifi className={`w-4 h-4 ${bssidStatus === 'ok' ? 'text-violet-400' : 'text-slate-500'}`} />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-semibold">Wi-Fi BSSID</p>
                        <p className="text-dark-muted text-[11px]">
                            {bssidStatus === 'checking' ? 'Wi-Fi check ho rahi hai...'
                                : bssidStatus === 'ok' ? '✓ Office router se connected'
                                    : bssidStatus === 'blocked' ? `✗ ${bssidMsg}`
                                        : 'No restriction (browser / no rule)'}
                        </p>
                    </div>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${bssidStatus === 'ok' ? 'bg-violet-400' : bssidStatus === 'blocked' ? 'bg-red-400' : bssidStatus === 'checking' ? 'bg-yellow-400 animate-pulse' : 'bg-slate-600'}`} />
                </div>
            </div>

            {/* ── Block reason banner ────────────────────────────────────────── */}
            <AnimatePresence>
                {isReady && isBlocked && (
                    <motion.div
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                        className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-2xl p-4"
                    >
                        <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-red-300 font-bold text-sm">Punch nahi ho sakta</p>
                            <p className="text-red-400/80 text-xs mt-0.5">
                                {gpsStatus === 'mocked' ? 'Fake/Mock GPS disable karo.' :
                                    zoneStatus === 'outside' ? 'Office zone ke andar aao.' :
                                        bssidStatus === 'blocked' ? 'Office Wi-Fi se connect karo.' : ''}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Action Buttons ─────────────────────────────────────────────── */}
            {isReady && !isBlocked && (
                <div className="space-y-3">
                    {/* Punch In */}
                    {punchState === 'none' && (
                        <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={() => performAction('checkin')}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl font-black text-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed
                                bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400
                                text-white shadow-emerald-900/40 active:scale-95"
                        >
                            {loading && action === 'checkin'
                                ? <><Loader className="w-6 h-6 animate-spin" /> Checking In...</>
                                : <><LogIn className="w-6 h-6" /> Punch In Now</>}
                        </motion.button>
                    )}

                    {/* Punched In — show Checkout + Break */}
                    {(punchState === 'in' || punchState === 'on-break') && (
                        <>
                            <motion.button
                                whileTap={{ scale: 0.97 }}
                                onClick={() => performAction('checkout')}
                                disabled={loading || punchState === 'on-break'}
                                className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl font-black text-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed
                                    bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500
                                    text-white shadow-blue-900/40 active:scale-95"
                            >
                                {loading && action === 'checkout'
                                    ? <><Loader className="w-6 h-6 animate-spin" /> Checking Out...</>
                                    : <><LogOut className="w-6 h-6" /> Punch Out</>}
                            </motion.button>
                            {punchState === 'on-break' ? (
                                <motion.button
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => performAction('end-break')}
                                    disabled={loading}
                                    className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-base transition-all shadow-lg disabled:opacity-50
                                        bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400
                                        text-white active:scale-95"
                                >
                                    {loading && action === 'end-break'
                                        ? <><Loader className="w-5 h-5 animate-spin" /> Break Khatam ho rahi...</>
                                        : <><Coffee className="w-5 h-5" /> Break Khatam Karo</>}
                                </motion.button>
                            ) : (
                                <motion.button
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => performAction('start-break')}
                                    disabled={loading}
                                    className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-base transition-all shadow-lg disabled:opacity-50
                                        bg-slate-700/60 border border-slate-600/50 hover:bg-slate-700
                                        text-slate-300 active:scale-95"
                                >
                                    {loading && action === 'start-break'
                                        ? <><Loader className="w-5 h-5 animate-spin" /> Break Shuru ho rahi...</>
                                        : <><Coffee className="w-5 h-5" /> Break Shuru Karo</>}
                                </motion.button>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Loading (while GPS/zones still checking) */}
            {!isReady && (
                <div className="flex items-center justify-center gap-2 py-8 text-dark-muted text-sm">
                    <Loader className="w-5 h-5 animate-spin text-primary-400" />
                    Verification ho rahi hai...
                </div>
            )}

            {/* ── Action result toast ────────────────────────────────────────── */}
            <AnimatePresence>
                {result && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                        className={`flex items-center gap-3 p-4 rounded-2xl border ${result.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-red-500/10 border-red-500/30 text-red-300'}`}
                    >
                        {result.type === 'success'
                            ? <CheckCircle className="w-5 h-5 shrink-0" />
                            : <AlertCircle className="w-5 h-5 shrink-0" />}
                        <p className="text-sm font-medium">{result.msg}</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Footer hint */}
            <p className="text-center text-dark-muted text-xs flex items-center justify-center gap-1.5 pt-2">
                <Clock className="w-3.5 h-3.5" />
                Aaj ka attendance mark hoga — sahi location pe raho
            </p>
        </div>
    );
};
