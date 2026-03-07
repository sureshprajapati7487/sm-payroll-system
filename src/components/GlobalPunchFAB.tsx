// GlobalPunchFAB.tsx
// DEPRECATED: Superseded by CameraPunchWidget.tsx which handles all the secure BSSID and GPS logic.
// This file is no longer imported globally.
// Shows:  🟢 Punch In   → employee ne punch in nahi kiya
//         🔴 Punch Out  → punch in hua, punch out pending
//         ✅ Done badge → shift complete (auto-hides after 5s)
// Admins / non-employee roles: hidden by default

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogIn, LogOut, CheckCircle, Loader2, Clock } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useAttendanceStore } from '@/store/attendanceStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { motion, AnimatePresence } from 'framer-motion';

// Pages where FAB should NOT appear
const HIDDEN_ON = ['/login', '/company-setup', '/quick-action', '/mobile', '/attendance/kiosk'];

export const GlobalPunchFAB = () => {
    const { user, isAuthenticated } = useAuthStore();
    const { records, markCheckIn, markCheckOut } = useAttendanceStore();
    const { employees } = useEmployeeStore();
    const navigate = useNavigate();
    const location = useLocation();

    const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'expanded'>('idle');
    const [justDone, setJustDone] = useState<'IN' | 'OUT' | null>(null);
    const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Cleanup on unmount
    useEffect(() => () => { if (doneTimerRef.current) clearTimeout(doneTimerRef.current); }, []);

    // Hide on certain pages
    const shouldHide = HIDDEN_ON.some(p => location.pathname.startsWith(p));
    if (!isAuthenticated || shouldHide) return null;

    // Only show for employees (not super admin if they have no employee record)
    // Admin can still see it if they have their own attendance record or are an employee too
    const today = new Date().toISOString().split('T')[0];
    const myRecord = records.find(r => r.employeeId === user?.id && r.date === today);
    const myEmployee = employees.find(e => e.id === user?.id);

    // Determine punch state
    const notPunchedIn = !myRecord?.checkIn;
    const punchedInOnly = !!myRecord?.checkIn && !myRecord?.checkOut;
    const shiftDone = !!myRecord?.checkIn && !!myRecord?.checkOut;

    // If no employee record at all, don't show FAB (admin-only accounts)
    if (!myEmployee && user?.role === 'SUPER_ADMIN') return null;

    const handlePunch = async () => {
        if (status === 'loading') return;
        if (shiftDone) {
            // Navigate to attendance if shift already done
            navigate('/attendance');
            return;
        }
        setStatus('loading');
        try {
            if (notPunchedIn) {
                await markCheckIn(user!.id, myEmployee?.shift || 'GENERAL', undefined, {
                    punchMode: 'face',
                });
                setJustDone('IN');
            } else if (punchedInOnly) {
                await markCheckOut(user!.id, { punchMode: 'face' });
                setJustDone('OUT');
            }
            setStatus('done');
            doneTimerRef.current = setTimeout(() => {
                setStatus('idle');
                setJustDone(null);
            }, 3000);
        } catch {
            setStatus('idle');
        }
    };

    // Button config
    type BtnConfig = {
        label: string;
        sublabel: string;
        icon: JSX.Element;
        color: string;
        shadow: string;
        ring: string;
    };

    const cfg: BtnConfig = notPunchedIn
        ? {
            label: 'Punch In',
            sublabel: 'Aaj ka punch in karo',
            icon: <LogIn className="w-5 h-5" />,
            color: 'from-emerald-500 to-green-600',
            shadow: 'shadow-emerald-500/40',
            ring: 'ring-emerald-400/30',
        }
        : punchedInOnly
            ? {
                label: 'Punch Out',
                sublabel: `In: ${new Date(myRecord!.checkIn!).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
                icon: <LogOut className="w-5 h-5" />,
                color: 'from-red-500 to-rose-600',
                shadow: 'shadow-red-500/40',
                ring: 'ring-red-400/30',
            }
            : {
                label: 'Shift Done ✓',
                sublabel: 'View attendance',
                icon: <CheckCircle className="w-5 h-5" />,
                color: 'from-slate-600 to-slate-700',
                shadow: 'shadow-slate-500/30',
                ring: 'ring-slate-400/20',
            };

    return (
        <AnimatePresence>
            <motion.div
                key="global-punch-fab"
                className="fixed bottom-6 right-6 z-[8888] flex flex-col items-end gap-2"
                initial={{ opacity: 0, scale: 0.7, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.7, y: 20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            >
                {/* Toast on success */}
                <AnimatePresence>
                    {justDone && status === 'done' && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.9 }}
                            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl shadow-xl text-white text-sm font-bold border ${justDone === 'IN'
                                ? 'bg-emerald-600/95 border-emerald-400/30 shadow-emerald-900/50'
                                : 'bg-blue-600/95 border-blue-400/30 shadow-blue-900/50'
                                } backdrop-blur-md`}
                        >
                            <CheckCircle className="w-4 h-4 shrink-0" />
                            Punch {justDone === 'IN' ? 'In' : 'Out'} Ho Gaya! ✓
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Main FAB */}
                <motion.button
                    onClick={handlePunch}
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.95 }}
                    title={cfg.label}
                    className={`
                        relative flex items-center gap-3 pl-4 pr-5 py-3
                        bg-gradient-to-br ${cfg.color}
                        text-white font-bold rounded-2xl
                        shadow-2xl ${cfg.shadow}
                        ring-2 ${cfg.ring}
                        transition-all duration-200
                        select-none
                    `}
                >
                    {/* Pulse dot (only when not done) */}
                    {!shiftDone && status !== 'loading' && (
                        <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${notPunchedIn ? 'bg-green-300' : 'bg-red-300'}`} />
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${notPunchedIn ? 'bg-green-200' : 'bg-red-200'}`} />
                        </span>
                    )}

                    {/* Icon */}
                    <div className="shrink-0">
                        {status === 'loading'
                            ? <Loader2 className="w-5 h-5 animate-spin" />
                            : status === 'done'
                                ? <CheckCircle className="w-5 h-5" />
                                : cfg.icon
                        }
                    </div>

                    {/* Label */}
                    <div className="flex flex-col items-start leading-none">
                        <span className="text-sm font-extrabold tracking-tight">
                            {status === 'loading' ? 'Saving...' : status === 'done' ? (justDone === 'IN' ? 'Punched In!' : 'Punched Out!') : cfg.label}
                        </span>
                        {status === 'idle' && (
                            <span className="text-[10px] font-normal opacity-70 mt-0.5 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {cfg.sublabel}
                            </span>
                        )}
                    </div>
                </motion.button>
            </motion.div>
        </AnimatePresence>
    );
};
