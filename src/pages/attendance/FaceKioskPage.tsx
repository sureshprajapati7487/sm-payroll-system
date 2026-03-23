// FaceKioskPage.tsx
// Full-screen face recognition attendance kiosk — Two-Step Punch Flow
// Step 1: Face Scan  →  Step 2: Employee Confirmation  →  Punch Recorded

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Camera, UserX, CheckCircle, AlertCircle,
    Loader2, RefreshCw, LogIn, LogOut, Users,
    ScanFace, ArrowLeft, Wifi, WifiOff,
    Maximize2, Minimize2, Search, X
} from 'lucide-react';
import { useEmployeeStore } from '@/store/employeeStore';
import { useAttendanceStore } from '@/store/attendanceStore';
import { useAuthStore } from '@/store/authStore';
import { useFaceRecognition } from '@/hooks/useFaceRecognition';
import { biometricStore } from '@/store/biometricStore';
import { PERMISSIONS } from '@/config/permissions';
import { useDeviceType } from '@/hooks/useDeviceType';
import { useSecurityStore } from '@/store/securityStore';

// ── Constants ────────────────────────────────────────────────────────────────
const ENROLL_FRAMES = 3;  // Reduced from 5 — faster enrollment (~1s)
const SUCCESS_RESET_MS = 3500;
const COOLDOWN_MS = 8000;
const SCAN_INTERVAL_MS = 700;
const CONFIRM_SECONDS = 5;

// ── Types ────────────────────────────────────────────────────────────────────
type KioskMode = 'enroll' | 'live';
type LiveState = 'waiting' | 'scanning' | 'matched' | 'confirm' | 'success' | 'error';

interface MatchResult {
    empId: string;
    confidence: number;
    punchType: 'IN' | 'OUT' | 'DONE';
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// ── Voice Feedback ────────────────────────────────────────────────────────────
function speak(text: string, lang = 'hi-IN') {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = lang; utt.rate = 0.95; utt.pitch = 1.1; utt.volume = 1;
    window.speechSynthesis.speak(utt);
}

// ── Live Clock ────────────────────────────────────────────────────────────────
const LiveClock = () => {
    const [t, setT] = useState(new Date());
    useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
    return (
        <div className="text-right hidden sm:block">
            <div className="font-mono text-base md:text-2xl font-bold text-white tracking-widest">
                {t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-slate-500 text-[10px] md:text-xs">
                {t.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export const FaceKioskPage = () => {
    const navigate = useNavigate();
    const { user, hasPermission } = useAuthStore();
    const { employees } = useEmployeeStore();
    const { records, markCheckIn, markCheckOut } = useAttendanceStore();
    const { loadModels, modelsLoaded, loadProgress, error: modelError,
        retryLoadModels, getDescriptor
    } = useFaceRecognition();

    const isAdmin = hasPermission(PERMISSIONS.USE_FACE_KIOSK);
    const { isDesktop } = useDeviceType();

    const { kioskDevices, registerKioskDevice } = useSecurityStore();
    const [deviceId, setDeviceId] = useState(() => localStorage.getItem('kiosk_device_id'));
    const isDeviceRegistered = deviceId && kioskDevices.some(d => d.id === deviceId);
    const [deviceNameInput, setDeviceNameInput] = useState('');

    const handleRegisterDevice = () => {
        if (!deviceNameInput.trim()) return alert('Device name likhiye');
        const newId = registerKioskDevice(deviceNameInput, user?.name || 'Admin');
        localStorage.setItem('kiosk_device_id', newId);
        setDeviceId(newId);
    };

    // ── Mode ──────────────────────────────────────────────────────────────────
    const [mode, setMode] = useState<KioskMode>('live');

    // ── Camera ────────────────────────────────────────────────────────────────
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [cameraError, setCameraError] = useState<'denied' | 'notfound' | null>(null);

    // ── Enroll ────────────────────────────────────────────────────────────────
    const [enrollingId, setEnrollingId] = useState<string | null>(null);
    const [enrollProgress, setEnrollProgress] = useState(0);
    const [enrollStatus, setEnrollStatus] = useState<'idle' | 'scanning' | 'done' | 'error'>('idle');
    const [enrollMsg, setEnrollMsg] = useState('');
    const [enrollSearch, setEnrollSearch] = useState('');
    const enrollDescriptors = useRef<Float32Array[]>([]);
    const enrollLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Fullscreen ────────────────────────────────────────────────────────────
    const [isFullscreen, setIsFullscreen] = useState(false);
    useEffect(() => {
        const h = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', h);
        return () => document.removeEventListener('fullscreenchange', h);
    }, []);
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => { });
        else document.exitFullscreen().catch(() => { });
    };

    // ── Live detect ───────────────────────────────────────────────────────────
    const [liveState, setLiveState] = useState<LiveState>('waiting');
    const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
    const [scanMsg, setScanMsg] = useState('Camera ke samne aao...');
    const [countdown, setCountdown] = useState(CONFIRM_SECONDS);
    const liveLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const cooldowns = useRef<Record<string, number>>({});

    // ── Derived ───────────────────────────────────────────────────────────────
    const today = new Date().toISOString().split('T')[0];
    const activeEmployees = employees.filter(e => e.status === 'ACTIVE');
    const enrolledCount = activeEmployees.filter(e => biometricStore.isFaceRegistered(e.id)).length;

    // ── Load models & sync biometrics ─────────────────────────────────────────
    useEffect(() => {
        loadModels().then((loaded) => {
            if (loaded) biometricStore.syncAllFaces();
        });
    }, [loadModels]);

    // ── Camera ────────────────────────────────────────────────────────────────
    const startCamera = useCallback(async () => {
        setCameraError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
            });
            streamRef.current = stream;
            if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
        } catch (err: any) {
            if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') setCameraError('notfound');
            else setCameraError('denied');
        }
    }, []);

    const stopCamera = useCallback(() => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
    }, []);

    // Start camera when models are loaded
    useEffect(() => { if (modelsLoaded) startCamera(); return () => stopCamera(); }, [modelsLoaded]);

    // Restart camera when switching to enroll mode (stream may have been stopped)
    useEffect(() => {
        if (mode === 'enroll' && modelsLoaded) {
            // Short delay so the video element is mounted in DOM
            const t = setTimeout(() => {
                if (!streamRef.current || streamRef.current.getTracks().every(t => t.readyState === 'ended')) {
                    startCamera();
                } else if (videoRef.current && !videoRef.current.srcObject) {
                    // Stream exists but video element lost it
                    videoRef.current.srcObject = streamRef.current;
                    videoRef.current.play().catch(() => { });
                }
            }, 150);
            return () => clearTimeout(t);
        }
    }, [mode, modelsLoaded, startCamera]);

    // ── Stop all loops ────────────────────────────────────────────────────────
    const stopAllLoops = useCallback(() => {
        if (liveLoopRef.current) clearTimeout(liveLoopRef.current);
        if (enrollLoopRef.current) clearTimeout(enrollLoopRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
        liveLoopRef.current = enrollLoopRef.current = countdownRef.current = null;
    }, []);

    // ═══════════════════════════════════════════════════════════════════════════
    // ENROLL LOGIC
    // ═══════════════════════════════════════════════════════════════════════════
    const startEnroll = useCallback(async (empId: string) => {
        stopAllLoops();
        setEnrollingId(empId); setEnrollProgress(0); setEnrollStatus('scanning');
        setEnrollMsg('Camera chalu ho raha hai...'); enrollDescriptors.current = [];

        // Always restart camera so the enroll video gets a fresh stream
        await startCamera();
        setEnrollMsg('Camera ke samne aao...');

        const capture = async () => {
            // Wait for camera stream to be ready
            if (!videoRef.current || !modelsLoaded) {
                enrollLoopRef.current = setTimeout(capture, 300);
                return;
            }
            // If video not yet playing, restart camera and wait
            if (videoRef.current.readyState < 2 || !videoRef.current.srcObject) {
                if (!streamRef.current || streamRef.current.getTracks().every(t => t.readyState === 'ended')) {
                    await startCamera();
                } else {
                    videoRef.current.srcObject = streamRef.current;
                    videoRef.current.play().catch(() => { });
                }
                enrollLoopRef.current = setTimeout(capture, 400);
                return;
            }
            const result = await getDescriptor(videoRef.current);
            if (!result) { setEnrollMsg('Seedha dekho camera mein...'); enrollLoopRef.current = setTimeout(capture, 400); return; }
            if (result.faceSize < 80) { setEnrollMsg('Thoda paas aao camera ke...'); enrollLoopRef.current = setTimeout(capture, 400); return; }
            enrollDescriptors.current.push(result.descriptor);
            const prog = enrollDescriptors.current.length;
            setEnrollProgress(prog); setEnrollMsg(`Scanning... ${prog}/${ENROLL_FRAMES} ✓`);
            if (prog < ENROLL_FRAMES) { enrollLoopRef.current = setTimeout(capture, 300); return; }
            const len = enrollDescriptors.current[0].length;
            const avg = new Float32Array(len);
            for (const d of enrollDescriptors.current) for (let i = 0; i < len; i++) avg[i] += d[i];
            for (let i = 0; i < len; i++) avg[i] /= enrollDescriptors.current.length;
            await biometricStore.setFaceDescriptor(empId, avg);
            setEnrollStatus('done'); setEnrollMsg('Face enrolled! ✅');
            const empName = activeEmployees.find(e => e.id === empId)?.name || 'Employee';
            speak(`${empName} ka face successfully enrolled ho gaya.`);
            setTimeout(() => { setEnrollingId(null); setEnrollStatus('idle'); setEnrollMsg(''); setMode('live'); }, 1500);
        };
        // Small delay to allow camera stream to initialize before first capture
        enrollLoopRef.current = setTimeout(capture, 200);
    }, [modelsLoaded, getDescriptor, activeEmployees, startCamera, stopAllLoops]);

    const cancelEnroll = useCallback(() => {
        stopAllLoops(); setEnrollingId(null); setEnrollStatus('idle'); setEnrollMsg('');
    }, [stopAllLoops]);

    // ═══════════════════════════════════════════════════════════════════════════
    // LIVE DETECTION LOOP (OFFLINE + LIVENESS)
    // ═══════════════════════════════════════════════════════════════════════════
    const startLiveLoop = useCallback(() => {
        if (!modelsLoaded) return;
        setLiveState('scanning'); setScanMsg('Camera ke samne aao...');

        let recentBoxes: { x: number, y: number }[] = [];
        const LIVENESS_FRAMES = 3;

        const loop = async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) {
                liveLoopRef.current = setTimeout(loop, 500); return;
            }
            const result = await getDescriptor(videoRef.current);
            if (!result) { setScanMsg('Camera ke samne aao...'); liveLoopRef.current = setTimeout(loop, SCAN_INTERVAL_MS); return; }
            if (result.faceSize < 80) { setScanMsg('Thoda paas aao...'); liveLoopRef.current = setTimeout(loop, SCAN_INTERVAL_MS); return; }

            // ── LIVENESS CHECK (Motion Variance) ──
            const box = result.box || result;
            recentBoxes.push({ x: box.x, y: box.y });
            if (recentBoxes.length > LIVENESS_FRAMES) recentBoxes.shift();

            setScanMsg('Checking Face...');

            // ── OFFLINE 1:N MATCHING ──
            try {
                let bestMatchId: string | null = null;
                let minDistance = Infinity;
                const MATCH_THRESHOLD = 0.45; // Stricter threshold to prevent false matches

                // Match against all cached descriptors
                for (const emp of activeEmployees) {
                    const storedDesc = biometricStore.getFaceDescriptor(emp.id);
                    if (storedDesc && storedDesc.length === result.descriptor.length) {
                        let sum = 0;
                        for (let i = 0; i < storedDesc.length; i++) {
                            sum += (result.descriptor[i] - storedDesc[i]) ** 2;
                        }
                        const dist = Math.sqrt(sum);
                        if (dist < minDistance) {
                            minDistance = dist;
                            bestMatchId = emp.id;
                        }
                    }
                }

                if (bestMatchId && minDistance <= MATCH_THRESHOLD) {
                    const bestEmp = activeEmployees.find(e => e.id === bestMatchId);
                    if (!bestEmp) throw new Error('Matched employee not active');

                    const lastPunch = cooldowns.current[bestEmp.id] || 0;
                    if (Date.now() - lastPunch < COOLDOWN_MS) {
                        setScanMsg(`${bestEmp.name} — please wait...`);
                        liveLoopRef.current = setTimeout(loop, SCAN_INTERVAL_MS); return;
                    }
                    const rec = records.find(r => r.employeeId === bestEmp.id && r.date === today);
                    const punchType: 'IN' | 'OUT' | 'DONE' = !rec?.checkIn ? 'IN' : !rec.checkOut ? 'OUT' : 'DONE';
                    const conf = Math.max(0, Math.round(((MATCH_THRESHOLD - minDistance) / MATCH_THRESHOLD) * 100));

                    stopAllLoops();
                    setLiveState('matched');
                    setMatchResult({ empId: bestEmp.id, confidence: conf, punchType });

                    // Brief 'matched' flash → go to 'confirm'
                    setTimeout(() => {
                        setLiveState('confirm');
                        setCountdown(CONFIRM_SECONDS);
                        if (punchType === 'IN') speak(`${bestEmp.name}, Punch In confirm karo.`);
                        else if (punchType === 'OUT') speak(`${bestEmp.name}, Punch Out confirm karo.`);
                        else speak(`${bestEmp.name}, aaj ka shift already complete hai.`);
                    }, 800);
                } else {
                    setScanMsg('Face scan ho raha hai... (Not Matched)');
                    liveLoopRef.current = setTimeout(loop, SCAN_INTERVAL_MS);
                }
            } catch (err) {
                console.error("Match error:", err);
                setScanMsg('Match error! Retrying...');
                liveLoopRef.current = setTimeout(loop, SCAN_INTERVAL_MS);
            }
        };
        loop();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modelsLoaded, activeEmployees, records, today, getDescriptor, stopAllLoops]);

    // ═══════════════════════════════════════════════════════════════════════════
    // CONFIRM PUNCH (button OR auto countdown)
    // ═══════════════════════════════════════════════════════════════════════════
    const confirmPunch = useCallback(async () => {
        if (!matchResult) return;
        if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
        const emp = activeEmployees.find(e => e.id === matchResult.empId);
        if (!emp) return;
        cooldowns.current[emp.id] = Date.now();
        if (matchResult.punchType === 'IN') {
            await markCheckIn(emp.id, (emp as any).shift || 'GENERAL', undefined, { punchMode: 'face' } as any);
            speak(`Punch In. ${emp.name}. Welcome!`);
        } else if (matchResult.punchType === 'OUT') {
            await markCheckOut(emp.id, { punchMode: 'face' } as any);
            speak(`Punch Out. ${emp.name}. Have a good day!`);
        } else {
            speak(`${emp.name}, aaj ka shift already complete hai.`);
        }
        setLiveState('success');
        setTimeout(() => {
            setLiveState('scanning'); setMatchResult(null);
            setScanMsg('Camera ke samne aao...'); startLiveLoop();
        }, SUCCESS_RESET_MS);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [matchResult, activeEmployees, markCheckIn, markCheckOut]);

    // ── Cancel confirm ────────────────────────────────────────────────────────
    const cancelConfirm = useCallback(() => {
        stopAllLoops(); setLiveState('scanning'); setMatchResult(null);
        setScanMsg('Camera ke samne aao...'); startLiveLoop();
    }, [stopAllLoops, startLiveLoop]);

    // ── Mode switch effect ────────────────────────────────────────────────────
    useEffect(() => {
        stopAllLoops();
        if (mode === 'live' && modelsLoaded) { setLiveState('scanning'); startLiveLoop(); }
        if (mode !== 'enroll') setEnrollSearch('');
        return () => stopAllLoops();
    }, [mode, modelsLoaded]);

    // ── Countdown when in 'confirm' state ─────────────────────────────────────
    useEffect(() => {
        if (liveState === 'confirm') {
            setCountdown(CONFIRM_SECONDS);
            const id = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) { clearInterval(id); confirmPunch(); return 0; }
                    return prev - 1;
                });
            }, 1000);
            countdownRef.current = id;
        } else {
            if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
        }
        return () => { if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; } };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [liveState]);

    // ── Render prep ───────────────────────────────────────────────────────────
    const matchedEmp = matchResult ? activeEmployees.find(e => e.id === matchResult.empId) : null;
    const matchedRec = matchResult ? records.find(r => r.employeeId === matchResult.empId && r.date === today) : null;

    // Enroll search filter
    const enrollQ = enrollSearch.toLowerCase().trim();
    const filteredEnrollEmployees = enrollQ
        ? activeEmployees.filter(e => e.name.toLowerCase().includes(enrollQ) || e.code.toLowerCase().includes(enrollQ))
        : activeEmployees;

    // Today's events for Recent Punches panel
    const todayEvents: { emp: typeof activeEmployees[0]; time: string; type: 'IN' | 'OUT' }[] = [];
    for (const emp of activeEmployees) {
        const rec = records.find(r => r.employeeId === emp.id && r.date === today);
        if (rec?.checkIn) todayEvents.push({ emp, time: rec.checkIn, type: 'IN' });
        if (rec?.checkOut) todayEvents.push({ emp, time: rec.checkOut, type: 'OUT' });
    }
    todayEvents.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    const insideCount = activeEmployees.filter(e => { const r = records.find(r => r.employeeId === e.id && r.date === today); return r?.checkIn && !r.checkOut; }).length;
    const leftCount = activeEmployees.filter(e => { const r = records.find(r => r.employeeId === e.id && r.date === today); return r?.checkIn && r.checkOut; }).length;
    const punchedInCount = activeEmployees.filter(e => records.find(r => r.employeeId === e.id && r.date === today)?.checkIn).length;

    // ── SVG ring circumference ────────────────────────────────────────────────
    const RING_R = 34;
    const RING_C = 2 * Math.PI * RING_R;

    // ══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ══════════════════════════════════════════════════════════════════════════
    if (isDesktop) {
        return (
            <div className="fixed inset-0 bg-[#060a0f] flex flex-col items-center justify-center text-center p-6 z-[100]">
                <div className="max-w-md w-full flex flex-col items-center">
                    <div className="w-24 h-24 rounded-full bg-violet-600/10 border-2 border-violet-500/30 flex items-center justify-center mb-6 relative">
                        <ScanFace className="w-12 h-12 text-violet-400 opacity-60" />
                        <span className="absolute -bottom-2 -right-2 bg-dark-bg rounded-full p-1 border border-dark-bg">
                            <Maximize2 className="w-6 h-6 text-red-400" />
                        </span>
                    </div>
                    <h1 className="text-3xl font-extrabold text-white mb-3">Mobile & Tablet Only</h1>
                    <p className="text-slate-400 leading-relaxed mb-8">
                        The Face Recognition Kiosk is designed exclusively for front-facing devices mounted at terminal entrances. It is natively blocked on Desktop environments.
                    </p>
                    <button
                        onClick={() => navigate('/attendance')}
                        className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all border border-slate-700"
                    >
                        <ArrowLeft className="w-5 h-5" /> Go Back to Attendance
                    </button>
                </div>
            </div>
        );
    }

    if (!isDeviceRegistered) {
        return (
            <div className="fixed inset-0 bg-[#060a0f] flex flex-col items-center justify-center text-center p-6 z-[100]">
                <div className="max-w-md w-full flex flex-col items-center gap-4 bg-slate-900/80 p-8 rounded-3xl border border-slate-800 shadow-2xl">
                    <div className="w-20 h-20 rounded-full bg-blue-600/10 border-2 border-blue-500/30 flex items-center justify-center mb-2">
                        <ScanFace className="w-10 h-10 text-blue-400 opacity-80" />
                    </div>
                    <h1 className="text-2xl font-extrabold text-white">Unregistered Device</h1>
                    <p className="text-slate-400 text-sm leading-relaxed mb-4">
                        Yeh device Kiosk ke liye registered nahi hai. Face recognition chalu karne ke liye pehle is tablet/phone ko register karein.
                    </p>

                    {isAdmin ? (
                        <div className="w-full space-y-3 mt-2">
                            <input
                                type="text"
                                placeholder="Device Name (e.g. Front Gate Tablet)"
                                value={deviceNameInput}
                                onChange={e => setDeviceNameInput(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                            />
                            <button
                                onClick={handleRegisterDevice}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg text-sm"
                            >
                                Register Device
                            </button>
                        </div>
                    ) : (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 w-full">
                            <p className="text-red-400 text-sm font-bold">Admin Login Required</p>
                            <p className="text-slate-400 text-xs mt-1">Sirf admin is device ko register kar sakte hain.</p>
                        </div>
                    )}

                    <button
                        onClick={() => navigate('/attendance')}
                        className="mt-4 flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all border border-slate-700 w-full text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" /> Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-[#060a0f] flex flex-col overflow-hidden z-[100] w-full h-[100dvh]">

            {/* ── Header ───────────────────────────────────────────────────── */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-3 px-3 md:px-6 py-3 border-b border-slate-800/70 bg-[#0a0f1a] shrink-0 w-full z-20">
                {/* Mobile Top Row: Back & Title ... and Right Controls */}
                <div className="flex items-center justify-between w-full lg:w-auto">
                    <div className="flex items-center gap-2 md:gap-3">
                        <button onClick={() => { stopCamera(); stopAllLoops(); navigate('/attendance'); }}
                            className="p-2 rounded-xl text-slate-300 bg-slate-800/80 hover:bg-slate-700 transition-all">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                                <ScanFace className="w-4 h-4 text-violet-400" />
                            </div>
                            <div>
                                <p className="text-white font-bold text-sm leading-tight">Face Kiosk</p>
                                <p className="text-slate-500 text-[10px] hidden sm:block">SM Payroll System</p>
                            </div>
                        </div>
                    </div>
                    {/* Right Controls (Mobile Only) */}
                    <div className="flex items-center gap-2 lg:hidden">
                        <LiveClock />
                        <button onClick={toggleFullscreen}
                            className="p-2 rounded-xl text-slate-300 bg-slate-800/80 hover:bg-slate-700 transition-all">
                            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* Center Tabs */}
                <div className="flex items-center w-full lg:w-auto bg-slate-800/80 rounded-xl p-1 gap-1 shadow-inner overflow-x-auto min-w-0">
                    <button onClick={() => setMode('live')}
                        className={`flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${mode === 'live' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>
                        <Camera className="w-4 h-4" /> Live Detect
                    </button>
                    {isAdmin && (
                        <button onClick={() => { stopAllLoops(); setMode('enroll'); }}
                            className={`flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${mode === 'enroll' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>
                            <Users className="w-4 h-4" /> Enroll
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${enrolledCount === activeEmployees.length ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'}`}>
                                {enrolledCount}/{activeEmployees.length}
                            </span>
                        </button>
                    )}
                </div>

                {/* Right Controls (Desktop Only) */}
                <div className="hidden lg:flex items-center gap-4 shrink-0">
                    <div className="text-xs font-medium">
                        {modelsLoaded
                            ? <span className="flex items-center gap-1.5 text-emerald-400"><Wifi className="w-3.5 h-3.5" /> Models Active</span>
                            : <span className="flex items-center gap-1.5 text-amber-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading {loadProgress}%</span>}
                    </div>
                    <LiveClock />
                    <button onClick={toggleFullscreen}
                        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen (F11)'}
                        className="p-2.5 rounded-xl text-slate-300 bg-slate-800/80 hover:bg-slate-700 transition-all">
                        {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* ── Body ─────────────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col overflow-hidden relative w-full h-full min-h-0">

                {/* ══ LIVE DETECT MODE ══════════════════════════════════════ */}
                {mode === 'live' && (
                    <div className="flex-1 flex flex-col md:flex-row overflow-hidden w-full h-full min-h-0">

                        {/* Left: Camera col */}
                        <div className="flex-1 flex flex-col items-center justify-center relative p-6 gap-5">

                            {/* Camera box */}
                            <div className="relative w-full max-w-xl aspect-video rounded-3xl overflow-hidden border-2 border-slate-700/60 shadow-2xl shadow-black">
                                <video ref={videoRef} autoPlay playsInline muted
                                    className="w-full h-full object-cover scale-x-[-1]" />
                                {/* HIDDEN enroll-mode mirror: always mounted, reuses same stream */}

                                {/* Scanning frame */}
                                {liveState === 'scanning' && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="relative w-48 h-56">
                                            {(['top-0 left-0 border-t-2 border-l-2', 'top-0 right-0 border-t-2 border-r-2', 'bottom-0 left-0 border-b-2 border-l-2', 'bottom-0 right-0 border-b-2 border-r-2'] as const).map((cls, i) => (
                                                <div key={i} className={`absolute w-8 h-8 ${cls} border-violet-400 rounded-sm opacity-80`} />
                                            ))}
                                            <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-violet-400 to-transparent animate-scan-line opacity-70" />
                                        </div>
                                    </div>
                                )}

                                {/* Matched overlay (brief flash) */}
                                {liveState === 'matched' && matchedEmp && (
                                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3">
                                        <img src={matchedEmp.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(matchedEmp.name)}&background=random&size=120`}
                                            className="w-16 h-16 rounded-full border-4 border-white/30 object-cover" />
                                        <p className="text-white font-bold text-xl">{matchedEmp.name}</p>
                                        <div className="flex items-center gap-2 text-white text-sm">
                                            <Loader2 className="w-4 h-4 animate-spin" /> Verifying... {matchResult?.confidence}%
                                        </div>
                                    </div>
                                )}

                                {/* Success overlay */}
                                {liveState === 'success' && matchedEmp && matchResult && (
                                    <div className={`absolute inset-0 flex flex-col items-center justify-center gap-3 ${matchResult.punchType === 'IN' ? 'bg-emerald-900/85' :
                                        matchResult.punchType === 'OUT' ? 'bg-blue-900/85' : 'bg-slate-900/85'
                                        }`}>
                                        <img src={matchedEmp.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(matchedEmp.name)}&background=random&size=120`}
                                            className="w-20 h-20 rounded-full border-4 border-white/30 object-cover" />
                                        <p className="text-white font-bold text-2xl">{matchedEmp.name}</p>
                                        {matchResult.punchType === 'IN' && (
                                            <div className="flex items-center gap-2 bg-emerald-500/30 border border-emerald-500/50 rounded-full px-5 py-2">
                                                <LogIn className="w-5 h-5 text-emerald-300" />
                                                <span className="text-emerald-200 font-bold text-lg">PUNCH IN ✓</span>
                                            </div>
                                        )}
                                        {matchResult.punchType === 'OUT' && (
                                            <div className="flex items-center gap-2 bg-blue-500/30 border border-blue-500/50 rounded-full px-5 py-2">
                                                <LogOut className="w-5 h-5 text-blue-300" />
                                                <span className="text-blue-200 font-bold text-lg">PUNCH OUT ✓</span>
                                            </div>
                                        )}
                                        {matchResult.punchType === 'DONE' && (
                                            <div className="flex items-center gap-2 bg-slate-700/50 border border-slate-600 rounded-full px-5 py-2">
                                                <CheckCircle className="w-5 h-5 text-slate-400" />
                                                <span className="text-slate-300 font-bold">Shift Complete!</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* No models overlay */}
                                {!modelsLoaded && (
                                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3">
                                        {modelError ? (
                                            <>
                                                <WifiOff className="w-10 h-10 text-red-400" />
                                                <p className="text-red-300 text-sm font-bold">{modelError}</p>
                                                <button onClick={retryLoadModels} className="flex items-center gap-2 px-4 py-2 bg-red-600/20 border border-red-500/30 text-red-300 rounded-xl text-sm font-bold hover:bg-red-600/30 transition-all">
                                                    <RefreshCw className="w-4 h-4" /> Retry
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <Loader2 className="w-10 h-10 text-violet-400 animate-spin" />
                                                <p className="text-slate-300 text-sm">Face AI load ho raha hai... {loadProgress}%</p>
                                                <div className="w-48 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                    <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${loadProgress}%` }} />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Camera Permission Helper */}
                                {cameraError && (
                                    <div className="absolute inset-0 bg-[#0a0f1a]/95 flex flex-col items-center justify-center gap-5 p-6 text-center">
                                        <div className="relative">
                                            <div className="w-20 h-20 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center">
                                                <Camera className="w-9 h-9 text-red-400" />
                                            </div>
                                            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-red-600 border-2 border-[#0a0f1a] flex items-center justify-center">
                                                <X className="w-4 h-4 text-white" />
                                            </div>
                                        </div>
                                        {cameraError === 'notfound' ? (
                                            <>
                                                <div><p className="text-white font-bold text-lg">Camera nahi mili!</p>
                                                    <p className="text-slate-400 text-sm mt-1">Is device mein camera connected nahi hai.</p></div>
                                                <ol className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 text-left w-full max-w-xs space-y-1.5 text-slate-400 text-xs list-decimal list-inside">
                                                    <li>USB webcam connected hai?</li>
                                                    <li>Device Manager mein camera enable hai?</li>
                                                    <li>Chrome browser use karo</li>
                                                </ol>
                                            </>
                                        ) : (
                                            <>
                                                <div><p className="text-white font-bold text-lg">Camera Access Blocked!</p>
                                                    <p className="text-slate-400 text-sm mt-1">Browser ne camera permission deny ki hai.</p></div>
                                                <ol className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 text-left w-full max-w-xs space-y-2 text-xs">
                                                    {[['🔒 Lock icon click karo', 'Address bar mein'], ['Camera → Allow karo', 'Permission section mein'], ['Allow & Retry dabao', 'Neeche']].map(([bold, rest], i) => (
                                                        <li key={i} className="flex items-start gap-2">
                                                            <span className="shrink-0 w-5 h-5 rounded-full bg-violet-600/30 border border-violet-500/40 text-violet-300 text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                                                            <span className="text-slate-400"><span className="text-white font-medium">{bold}</span> {rest}</span>
                                                        </li>
                                                    ))}
                                                </ol>
                                            </>
                                        )}
                                        <button onClick={startCamera}
                                            className="flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-violet-900/40 active:scale-95">
                                            <RefreshCw className="w-4 h-4" /> Allow &amp; Retry
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Status */}
                            <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-700/40 rounded-2xl px-6 py-3">
                                {liveState === 'scanning' && <ScanFace className="w-5 h-5 text-violet-400 animate-pulse" />}
                                {liveState === 'matched' && <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />}
                                {liveState === 'success' && <CheckCircle className="w-5 h-5 text-green-400" />}
                                {liveState === 'confirm' && <AlertCircle className="w-5 h-5 text-violet-400" />}
                                {liveState === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
                                <span className="text-white text-sm font-medium">
                                    {liveState === 'confirm' ? 'Confirm your punch...' : scanMsg}
                                </span>
                            </div>

                            {/* Enroll warning */}
                            {enrolledCount < activeEmployees.length && (
                                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2 text-amber-400 text-xs">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {activeEmployees.length - enrolledCount} employees enroll nahi hain.
                                    {isAdmin && <button onClick={() => setMode('enroll')} className="underline font-bold ml-1">Enroll tab mein jao</button>}
                                </div>
                            )}
                        </div>

                        {/* Right: Recent Punches Panel — hidden on mobile, visible on md+ */}
                        <div className="hidden md:flex w-72 shrink-0 border-l border-slate-800/60 bg-slate-900/40 flex-col overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-800/60 shrink-0">
                                <p className="text-white font-bold text-sm">Aaj ke Punches</p>
                                <p className="text-slate-600 text-[11px]">{punchedInCount} / {activeEmployees.length} employees punched in</p>
                            </div>
                            <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
                                {todayEvents.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-10">
                                        <ScanFace className="w-10 h-10 text-slate-700" />
                                        <p className="text-slate-600 text-xs">Abhi koi punch nahi hua</p>
                                    </div>
                                ) : todayEvents.slice(0, 10).map((ev, i) => (
                                    <div key={`${ev.emp.id}-${ev.type}-${ev.time}`}
                                        className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${i === 0 && liveState === 'success' ? 'border-violet-500/40 bg-violet-500/10' : 'border-slate-700/30 bg-slate-800/30'}`}>
                                        <img src={ev.emp.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(ev.emp.name)}&size=48&background=random`}
                                            className="w-9 h-9 rounded-full object-cover border border-slate-700 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white text-xs font-semibold truncate">{ev.emp.name.split(' ')[0]}</p>
                                            <p className="text-slate-500 text-[10px] font-mono">{fmtTime(ev.time)}</p>
                                        </div>
                                        <div className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${ev.type === 'IN' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'}`}>
                                            {ev.type === 'IN' ? <LogIn className="w-3 h-3" /> : <LogOut className="w-3 h-3" />} {ev.type}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="border-t border-slate-800/60 px-4 py-3 shrink-0 grid grid-cols-2 gap-2">
                                <div className="text-center"><p className="text-emerald-400 font-bold text-lg">{insideCount}</p><p className="text-slate-600 text-[10px]">Inside</p></div>
                                <div className="text-center"><p className="text-slate-400 font-bold text-lg">{leftCount}</p><p className="text-slate-600 text-[10px]">Left</p></div>
                            </div>
                        </div>
                        {/* Mobile: mini punch count bar */}
                        <div className="md:hidden absolute bottom-0 inset-x-0 flex items-center justify-around py-2 px-4 bg-slate-900/90 border-t border-slate-800/60 z-10">
                            <div className="text-center"><p className="text-emerald-400 font-bold">{punchedInCount}</p><p className="text-slate-600 text-[9px]">Punched</p></div>
                            <div className="text-center"><p className="text-amber-400 font-bold">{activeEmployees.length - punchedInCount}</p><p className="text-slate-600 text-[9px]">Pending</p></div>
                            <div className="text-center"><p className="text-blue-400 font-bold">{leftCount}</p><p className="text-slate-600 text-[9px]">Left</p></div>
                        </div>
                    </div>
                )}

                {/* ══ CONFIRM OVERLAY (on top of live mode) ════════════════ */}
                {mode === 'live' && liveState === 'confirm' && matchResult && matchedEmp && (
                    <div className="absolute inset-0 z-40 bg-[#020408]/80 backdrop-blur-xl flex flex-col items-center justify-center gap-6 p-6 md:p-8">

                        {/* Step label */}
                        <div className="text-center">
                            <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">✓ Face Detected · Step 2 of 2</p>
                            <p className="text-white/50 text-xs mt-1">Confirm karo ya {countdown}s mein auto-punch hoga</p>
                        </div>

                        {/* Employee card */}
                        <div className={`flex flex-col items-center gap-5 p-8 rounded-[2rem] border shadow-2xl max-w-sm w-full relative overflow-hidden ${matchResult.punchType === 'IN'
                            ? 'border-emerald-500/30 bg-emerald-950/80 shadow-emerald-900/40'
                            : matchResult.punchType === 'OUT'
                                ? 'border-blue-500/30 bg-blue-950/80 shadow-blue-900/40'
                                : 'border-slate-600/30 bg-slate-900/80 shadow-slate-900/50'
                            }`}>

                            {/* Top Accent Gradient */}
                            <div className={`absolute top-0 inset-x-0 h-1.5 ${matchResult.punchType === 'IN' ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' :
                                matchResult.punchType === 'OUT' ? 'bg-gradient-to-r from-blue-400 to-blue-600' :
                                    'bg-gradient-to-r from-slate-400 to-slate-600'
                                }`} />
                            {/* Avatar + confidence */}
                            <div className="relative mt-2">
                                <img src={matchedEmp.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(matchedEmp.name)}&background=random&color=fff&size=200`}
                                    className={`w-32 h-32 rounded-full border-4 shadow-2xl object-cover ${matchResult.punchType === 'IN' ? 'border-emerald-400/50 shadow-emerald-900/50' :
                                        matchResult.punchType === 'OUT' ? 'border-blue-400/50 shadow-blue-900/50' :
                                            'border-slate-400/50'
                                        }`} />
                                <div className="absolute -bottom-2 right-0 bg-[#060a0f] border border-slate-700/80 rounded-full px-2.5 py-0.5 text-[11px] text-white font-mono font-bold shadow-lg">
                                    {matchResult.confidence}%
                                </div>
                            </div>

                            {/* Info */}
                            <div className="text-center w-full">
                                <h2 className="text-white font-black text-2xl md:text-3xl tracking-tight leading-tight">{matchedEmp.name}</h2>
                                <p className="text-slate-300 text-sm mt-1.5 font-medium tracking-wide">
                                    {matchedEmp.code} <span className="opacity-50">·</span> {(matchedEmp as any).shift || 'GENERAL'}
                                </p>
                                {matchResult.punchType === 'OUT' && matchedRec?.checkIn && (
                                    <p className="text-slate-400 text-xs mt-2 font-mono bg-black/20 inline-block px-3 py-1 rounded-full border border-white/5">
                                        In time: {fmtTime(matchedRec.checkIn)}
                                    </p>
                                )}
                            </div>

                            {/* Punch type badge */}
                            <div className="w-full mt-2">
                                {matchResult.punchType === 'IN' && (
                                    <div className="flex items-center justify-center gap-2 bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 rounded-2xl px-6 py-3 shadow-inner">
                                        <LogIn className="w-5 h-5" /><span className="font-extrabold text-lg tracking-wide">PUNCH IN</span>
                                    </div>
                                )}
                                {matchResult.punchType === 'OUT' && (
                                    <div className="flex items-center justify-center gap-2 bg-blue-500/20 border border-blue-500/50 text-blue-300 rounded-2xl px-6 py-3 shadow-inner">
                                        <LogOut className="w-5 h-5" /><span className="font-extrabold text-lg tracking-wide">PUNCH OUT</span>
                                    </div>
                                )}
                                {matchResult.punchType === 'DONE' && (
                                    <div className="flex items-center justify-center gap-2 bg-slate-700/50 border border-slate-600 text-slate-300 rounded-2xl px-6 py-3 shadow-inner">
                                        <CheckCircle className="w-5 h-5" /><span className="font-bold text-lg tracking-wide">Shift Complete</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Countdown ring + Confirm button */}
                        <div className="flex items-center justify-center gap-4 sm:gap-6 mt-2">
                            {/* SVG ring */}
                            <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center shrink-0">
                                <svg className="absolute inset-0 -rotate-90 w-full h-full" viewBox="0 0 80 80">
                                    <circle cx="40" cy="40" r={RING_R} stroke="#1e293b" strokeWidth="6" fill="none" />
                                    <circle cx="40" cy="40" r={RING_R}
                                        stroke={matchResult.punchType === 'IN' ? '#10b981' : matchResult.punchType === 'OUT' ? '#3b82f6' : '#64748b'}
                                        strokeWidth="6" fill="none" strokeLinecap="round"
                                        strokeDasharray={`${RING_C}`}
                                        strokeDashoffset={`${RING_C * (1 - countdown / CONFIRM_SECONDS)}`}
                                        className="transition-all duration-1000"
                                    />
                                </svg>
                                <span className="text-white font-mono text-xl sm:text-2xl font-bold relative">{countdown}</span>
                            </div>

                            {/* Confirm button */}
                            {matchResult.punchType !== 'DONE' ? (
                                <button onClick={confirmPunch}
                                    className={`flex items-center justify-center gap-2.5 font-extrabold text-lg sm:text-xl rounded-2xl px-6 sm:px-10 py-4 transition-all shadow-xl active:scale-95 whitespace-nowrap ${matchResult.punchType === 'IN'
                                        ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-900/50 ring-2 ring-emerald-500/50 hover:ring-emerald-400'
                                        : 'bg-blue-500 hover:bg-blue-400 text-white shadow-blue-900/50 ring-2 ring-blue-500/50 hover:ring-blue-400'
                                        }`}>
                                    {matchResult.punchType === 'IN'
                                        ? <><LogIn className="w-5 h-5 sm:w-6 sm:h-6" /> Confirm In</>
                                        : <><LogOut className="w-5 h-5 sm:w-6 sm:h-6" /> Confirm Out</>
                                    }
                                </button>
                            ) : (
                                <button onClick={confirmPunch}
                                    className="flex items-center justify-center gap-2.5 font-bold text-lg rounded-2xl px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white transition-all active:scale-95 shadow-xl">
                                    <CheckCircle className="w-5 h-5" /> OK
                                </button>
                            )}
                        </div>

                        {/* Cancel */}
                        <button onClick={cancelConfirm}
                            className="text-slate-600 hover:text-slate-400 text-sm underline transition-colors">
                            ✕ Cancel — Wapas scan karo
                        </button>
                    </div>
                )}

                {/* ══ ENROLL MODE ════════════════════════════════════════════ */}
                {mode === 'enroll' && (
                    <div className="flex-1 flex flex-col md:flex-row overflow-hidden w-full h-full min-h-0">

                        {/* Left/Top: Camera */}
                        <div className="w-full md:w-[420px] lg:w-[480px] shrink-0 p-3 md:p-6 flex flex-col gap-3 border-b md:border-b-0 md:border-r border-slate-800/80 bg-[#0a0f1a] z-10 shadow-md">
                            <div className="relative rounded-2xl overflow-hidden aspect-video w-full max-w-[260px] sm:max-w-sm mx-auto md:max-w-none border-2 border-slate-700/60 bg-slate-900 shrink-0 shadow-lg">
                                <video
                                    id="enroll-video"
                                    autoPlay playsInline muted
                                    ref={(el) => {
                                        if (!el) return;
                                        (videoRef as any).current = el;
                                        const attachStream = () => {
                                            if (streamRef.current && streamRef.current.active) {
                                                el.srcObject = streamRef.current;
                                                el.play().catch(() => { });
                                            } else {
                                                // Stream not active — restart camera
                                                startCamera().then(() => {
                                                    if (streamRef.current) {
                                                        el.srcObject = streamRef.current;
                                                        el.play().catch(() => { });
                                                    }
                                                });
                                            }
                                        };
                                        attachStream();
                                    }}
                                    className="w-full h-full object-cover scale-x-[-1]" />
                                {enrollingId ? (
                                    <div className="absolute inset-x-0 bottom-0 bg-black/70 py-3 px-4">
                                        <div className="flex items-center justify-between text-xs mb-1.5">
                                            <span className="text-slate-300 font-medium">{activeEmployees.find(e => e.id === enrollingId)?.name}</span>
                                            <span className="text-slate-400">{enrollProgress}/{ENROLL_FRAMES}</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full transition-all duration-300 ${enrollStatus === 'done' ? 'bg-green-500' : 'bg-violet-500'}`}
                                                style={{ width: `${(enrollProgress / ENROLL_FRAMES) * 100}%` }} />
                                        </div>
                                        <p className="text-slate-400 text-[11px] mt-1.5">{enrollMsg}</p>
                                    </div>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="text-center text-slate-600">
                                            <ScanFace className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                            <p className="text-sm">Employee select karo → Scan</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 max-w-[260px] sm:max-w-sm w-full mx-auto md:max-w-none">
                                <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-2 md:p-3 text-center transition-colors">
                                    <p className="text-xl md:text-2xl font-bold text-emerald-400">{enrolledCount}</p>
                                    <p className="text-slate-500 text-[10px] md:text-xs">Enrolled</p>
                                </div>
                                <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-2 md:p-3 text-center transition-colors">
                                    <p className="text-xl md:text-2xl font-bold text-amber-400">{activeEmployees.length - enrolledCount}</p>
                                    <p className="text-slate-500 text-[10px] md:text-xs">Pending</p>
                                </div>
                            </div>
                            {enrollingId && (
                                <button onClick={cancelEnroll}
                                    className="w-full max-w-[260px] sm:max-w-sm mx-auto md:max-w-none py-2.5 bg-red-950/40 border border-red-900/50 rounded-xl text-red-400 text-sm font-bold hover:bg-red-900/60 transition-all shrink-0 mt-1 shadow-sm">
                                    Cancel Scanning
                                </button>
                            )}
                        </div>

                        {/* Right/Bottom: Employee Grid */}
                        <div className="flex-1 flex flex-col overflow-hidden bg-[#060a0f] p-3 md:p-6 gap-3 min-h-0 relative">
                            {/* Header + Search */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                                <div>
                                    <h2 className="text-white font-bold text-lg leading-tight">Employees Roster</h2>
                                    <p className="text-slate-500 text-[11px] md:text-xs mt-0.5">Select to start face enrollment</p>
                                </div>
                                <div className="relative flex-1 max-w-xs">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                                    <input type="text" value={enrollSearch} onChange={e => setEnrollSearch(e.target.value)}
                                        placeholder="Name ya code se search..."
                                        className="w-full bg-slate-800/70 border border-slate-700/50 rounded-xl pl-8 pr-8 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50 focus:bg-slate-800 transition-all" />
                                    {enrollSearch && (
                                        <button onClick={() => setEnrollSearch('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Grid */}
                            <div className="flex-1 overflow-y-auto min-h-0 pr-1 pb-4">
                                {filteredEnrollEmployees.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                                        <Search className="w-10 h-10 text-slate-700" />
                                        <p className="text-slate-500 text-sm">"{enrollSearch}" nahi mila</p>
                                        <button onClick={() => setEnrollSearch('')} className="text-violet-400 text-xs underline mt-1">Clear search</button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                        {filteredEnrollEmployees.map(emp => {
                                            const isEnrolled = biometricStore.isFaceRegistered(emp.id);
                                            const isActive = enrollingId === emp.id;
                                            const registeredAt = biometricStore.getRegisteredAt(emp.id);
                                            return (
                                                <button key={emp.id}
                                                    onClick={() => { if (!enrollingId) startEnroll(emp.id); }}
                                                    disabled={!!enrollingId && enrollingId !== emp.id}
                                                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 ${isActive ? 'border-violet-500/60 bg-violet-500/15 ring-2 ring-violet-500/30'
                                                        : isEnrolled ? 'border-emerald-500/30 bg-emerald-500/8 hover:border-emerald-400/50'
                                                            : 'border-slate-700/40 bg-slate-900/40 hover:border-slate-600 hover:bg-slate-800/60'
                                                        } disabled:opacity-40 disabled:cursor-not-allowed`}>
                                                    <div className="relative shrink-0">
                                                        <img src={emp.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=random&size=64`}
                                                            className="w-12 h-12 rounded-full object-cover border-2 border-slate-700" />
                                                        <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-[#060a0f] flex items-center justify-center ${isEnrolled ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                                                            {isEnrolled ? <CheckCircle className="w-2.5 h-2.5 text-white" /> : <UserX className="w-2.5 h-2.5 text-slate-300" />}
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-white font-semibold text-sm truncate">{emp.name}</p>
                                                        <p className="text-slate-500 text-[11px] truncate">{emp.code}</p>
                                                        {isEnrolled && registeredAt && (
                                                            <p className="text-emerald-600 text-[10px] mt-0.5">✓ {new Date(registeredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                                                        )}
                                                        {!isEnrolled && <p className="text-slate-600 text-[10px] mt-0.5">Not enrolled</p>}
                                                        {isActive && <p className="text-violet-400 text-[10px] mt-0.5 animate-pulse">Scanning...</p>}
                                                    </div>
                                                    {isEnrolled && !isActive && (
                                                        <div className="shrink-0 flex items-center gap-1 text-[10px] text-slate-500 bg-slate-800 border border-slate-700 rounded-lg px-1.5 py-0.5">
                                                            <RefreshCw className="w-2.5 h-2.5" /> Re-enroll
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Scan line animation */}
            <style>{`
                @keyframes scan-line { 0%{top:10%} 50%{top:90%} 100%{top:10%} }
                .animate-scan-line { position:absolute; animation:scan-line 2s ease-in-out infinite; left:0; right:0; }
            `}</style>
        </div>
    );
};
