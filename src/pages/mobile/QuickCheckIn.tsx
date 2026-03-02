// QuickCheckIn.tsx — Redesigned mobile-first check-in page

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Clock, CheckCircle, Zap, Loader, AlertTriangle, ArrowLeft, LogIn } from 'lucide-react';
import { useAttendanceStore } from '@/store/attendanceStore';
import { useAuthStore } from '@/store/authStore';
import { useEmployeeStore } from '@/store/employeeStore';

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
            <div className="text-xs text-white/50 mt-1 font-mono">
                {now.toLocaleTimeString('en-IN', { second: '2-digit' })}s
            </div>
            <div className="text-sm text-white/60 mt-2">
                {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
        </div>
    );
};

// ════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════
export const QuickCheckIn = () => {
    const navigate = useNavigate();
    const { markCheckIn } = useAttendanceStore();
    const { user } = useAuthStore();
    const { employees } = useEmployeeStore();

    const [loading, setLoading] = useState(false);
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [locationStatus, setLocationStatus] = useState<'checking' | 'verified' | 'failed'>('checking');
    const [success, setSuccess] = useState(false);

    const me = employees.find(e => e.email === user?.email || e.id === user?.id);

    useEffect(() => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                pos => { setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocationStatus('verified'); },
                () => setLocationStatus('failed')
            );
        } else {
            setLocationStatus('failed');
        }
    }, []);

    const handleCheckIn = async () => {
        if (!user) return;
        setLoading(true);
        try {
            await markCheckIn(user.id, (me as any)?.shift || 'GENERAL', undefined, { punchMode: 'manual' } as any);
            setSuccess(true);
        } catch (err) {
            console.error('Check-in failed:', err);
        } finally {
            setLoading(false);
        }
    };

    // ── Success screen ──────────────────────────────────────────────────────
    if (success) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6 text-center px-6">
                <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="w-28 h-28 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center"
                >
                    <CheckCircle className="w-14 h-14 text-emerald-400" />
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <h2 className="text-2xl font-black text-white">Checked In! ✅</h2>
                    <p className="text-dark-muted mt-1">Have a great day, {me?.name?.split(' ')[0] || 'friend'}!</p>
                    <p className="text-emerald-400 text-lg font-bold mt-3 font-mono">
                        {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </motion.div>
                <motion.button
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/mobile/dashboard')}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold transition-all"
                >
                    Go to Dashboard
                </motion.button>
            </div>
        );
    }

    return (
        <div className="max-w-sm mx-auto space-y-4">

            {/* Back button */}
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-dark-muted hover:text-white text-sm transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                Back
            </button>

            {/* ── Clock hero ────────────────────────────────────────────────── */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-violet-700 to-indigo-800 py-8 px-6 shadow-2xl shadow-violet-900/50 text-center">
                <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5" />
                <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/5" />
                <p className="text-white/50 text-xs mb-4 flex items-center justify-center gap-1.5">
                    <Zap className="w-3 h-3 text-yellow-400" /> Quick Check-In
                </p>
                <LiveClock />
                {me && (
                    <p className="text-white/70 text-sm mt-4 font-medium">{me.name} · {me.code}</p>
                )}
            </div>

            {/* ── Location status ───────────────────────────────────────────── */}
            <div className="glass rounded-2xl border border-dark-border p-4">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${locationStatus === 'verified' ? 'bg-emerald-500/20' :
                            locationStatus === 'checking' ? 'bg-yellow-500/20' : 'bg-red-500/20'
                        }`}>
                        {locationStatus === 'checking'
                            ? <Loader className="w-5 h-5 text-yellow-400 animate-spin" />
                            : locationStatus === 'verified'
                                ? <MapPin className="w-5 h-5 text-emerald-400" />
                                : <AlertTriangle className="w-5 h-5 text-red-400" />
                        }
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold">Location</p>
                        <p className="text-dark-muted text-xs">
                            {locationStatus === 'verified' && location
                                ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
                                : locationStatus === 'checking' ? 'Getting GPS coordinates...'
                                    : 'Location unavailable — check-in allowed'
                            }
                        </p>
                    </div>
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${locationStatus === 'verified' ? 'bg-emerald-400' :
                            locationStatus === 'checking' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'
                        }`} />
                </div>
            </div>

            {/* ── Check In Button ───────────────────────────────────────────── */}
            <AnimatePresence>
                <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleCheckIn}
                    disabled={loading || locationStatus === 'checking'}
                    className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl font-black text-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed
                        bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400
                        text-white shadow-emerald-900/40 active:scale-95"
                >
                    {loading ? (
                        <> <Loader className="w-6 h-6 animate-spin" /> Checking In... </>
                    ) : (
                        <> <LogIn className="w-6 h-6" /> Punch In Now </>
                    )}
                </motion.button>
            </AnimatePresence>

            <p className="text-center text-dark-muted text-xs flex items-center justify-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Aaj ka attendance mark hoga
            </p>
        </div>
    );
};
