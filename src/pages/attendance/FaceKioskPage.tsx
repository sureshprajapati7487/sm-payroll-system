// FaceKioskPage.tsx
// Full-screen face recognition attendance kiosk — Two-Step Punch Flow
// Step 1: Face Scan  →  Step 2: Employee Confirmation  →  Punch Recorded

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Camera, UserX, CheckCircle, AlertCircle,
    Loader2, RefreshCw, LogIn, LogOut, Users,
    ScanFace, ArrowLeft, Wifi, WifiOff,
    Maximize2, Minimize2, Search, X, Trash2, SwitchCamera, FileDown
} from 'lucide-react';
import { useEmployeeStore } from '@/store/employeeStore';
import { useAttendanceStore } from '@/store/attendanceStore';
import { useAuthStore } from '@/store/authStore';
import { useFaceRecognition } from '@/hooks/useFaceRecognition';
import { biometricStore } from '@/store/biometricStore';
import { PERMISSIONS } from '@/config/permissions';
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

    const { kioskDevices, registerKioskDevice } = useSecurityStore();
    const [deviceId, setDeviceId] = useState(() => localStorage.getItem('kiosk_device_id'));
    const isDeviceRegistered = deviceId && kioskDevices.some(d => d.id === deviceId);
    const [deviceNameInput, setDeviceNameInput] = useState('');
    // Soft banner: show only if not registered, dismissible
    const [showRegisterBanner, setShowRegisterBanner] = useState(!isDeviceRegistered);

    const handleRegisterDevice = () => {
        if (!deviceNameInput.trim()) return;
        const newId = registerKioskDevice(deviceNameInput, user?.name || 'Admin');
        localStorage.setItem('kiosk_device_id', newId);
        setDeviceId(newId);
        setShowRegisterBanner(false);
    };

    // ── Manual ID Fallback — state only (callbacks defined after all deps below) ─
    const [showManualPanel, setShowManualPanel] = useState(false);
    const [manualCode, setManualCode] = useState('');
    const [manualStep, setManualStep] = useState<'input' | 'confirm' | 'success' | 'error'>('input');
    const [manualEmp, setManualEmp] = useState<typeof employees[0] | null>(null);
    const [manualPunchType, setManualPunchType] = useState<'IN' | 'OUT' | 'DONE'>('IN');
    const [manualMsg, setManualMsg] = useState('');
    const [manualLoading, setManualLoading] = useState(false);

    // ── Mode ──────────────────────────────────────────────────────────────────
    const [mode, setMode] = useState<KioskMode>('live');

    // ── Camera ────────────────────────────────────────────────────────────────
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [cameraError, setCameraError] = useState<'denied' | 'notfound' | null>(null);
    const facingModeRef = useRef<'user' | 'environment'>('user');
    const [isFrontCamera, setIsFrontCamera] = useState(true);

    // ── Enroll ────────────────────────────────────────────────────────────────
    const [enrollingId, setEnrollingId] = useState<string | null>(null);
    const [enrollProgress, setEnrollProgress] = useState(0);
    const [enrollStatus, setEnrollStatus] = useState<'idle' | 'scanning' | 'done' | 'error'>('idle');
    const [enrollMsg, setEnrollMsg] = useState('');
    const [enrollSearch, setEnrollSearch] = useState('');
    const enrollDescriptors = useRef<Float32Array[]>([]);
    const enrollLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [enrollToast, setEnrollToast] = useState<string | null>(null);
    const enrollToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Match threshold (admin adjustable) ────────────────────────────────────
    const THRESHOLD_KEY = 'face_kiosk_match_threshold';
    const [matchThreshold, setMatchThreshold] = useState<number>(() => {
        const saved = localStorage.getItem(THRESHOLD_KEY);
        return saved ? parseFloat(saved) : 0.45;
    });
    const matchThresholdRef = useRef(matchThreshold);
    const updateMatchThreshold = (v: number) => {
        matchThresholdRef.current = v;
        setMatchThreshold(v);
        localStorage.setItem(THRESHOLD_KEY, String(v));
    };

    // ── Delete enrollment ─────────────────────────────────────────────────────
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleDeleteEnrollment = useCallback(async (empId: string) => {
        setDeletingId(empId);
        try {
            await biometricStore.clearFaceDescriptor(empId);
        } finally {
            setDeletingId(null);
            setDeleteConfirmId(null);
        }
    }, []);

    // ── Fullscreen ────────────────────────────────────────────────────────────
    const isFullscreenSupported = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showIOSHint, setShowIOSHint] = useState(false);
    const iosHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!isFullscreenSupported) return;
        const h = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', h);
        return () => document.removeEventListener('fullscreenchange', h);
    }, [isFullscreenSupported]);

    const toggleFullscreen = () => {
        if (!isFullscreenSupported) {
            setShowIOSHint(true);
            if (iosHintTimerRef.current) clearTimeout(iosHintTimerRef.current);
            iosHintTimerRef.current = setTimeout(() => setShowIOSHint(false), 4000);
            return;
        }
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
                video: { facingMode: facingModeRef.current, width: { ideal: 640 }, height: { ideal: 480 } }
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

    const switchCamera = useCallback(async () => {
        const next = facingModeRef.current === 'user' ? 'environment' : 'user';
        facingModeRef.current = next;
        setIsFrontCamera(next === 'user');
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        await startCamera();
    }, [startCamera]);

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
            if (enrollToastTimer.current) clearTimeout(enrollToastTimer.current);
            setEnrollToast(empName);
            enrollToastTimer.current = setTimeout(() => setEnrollToast(null), 4000);
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

        // ── Liveness buffer: track position + faceSize across recent frames ──
        let livenessFrames: { x: number; y: number; size: number }[] = [];
        const LIVENESS_FRAMES = 5;
        const MIN_MOTION_PX = 2.5;   // min positional movement across frames
        const MIN_SIZE_CHANGE = 3;   // min face-size change across frames

        const isLive = (): boolean => {
            if (livenessFrames.length < LIVENESS_FRAMES) return false;
            const xs = livenessFrames.map(f => f.x);
            const ys = livenessFrames.map(f => f.y);
            const ss = livenessFrames.map(f => f.size);
            const posVariance = Math.max(...xs) - Math.min(...xs) + (Math.max(...ys) - Math.min(...ys));
            const sizeVariance = Math.max(...ss) - Math.min(...ss);
            return posVariance >= MIN_MOTION_PX || sizeVariance >= MIN_SIZE_CHANGE;
        };

        const loop = async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) {
                liveLoopRef.current = setTimeout(loop, 500); return;
            }
            const result = await getDescriptor(videoRef.current);
            if (!result) { setScanMsg('Camera ke samne aao...'); liveLoopRef.current = setTimeout(loop, SCAN_INTERVAL_MS); return; }
            if (result.faceSize < 80) { setScanMsg('Thoda paas aao...'); liveLoopRef.current = setTimeout(loop, SCAN_INTERVAL_MS); return; }

            // ── LIVENESS BUFFER ──
            const box = result.box;
            livenessFrames.push({ x: box?.x ?? 0, y: box?.y ?? 0, size: result.faceSize });
            if (livenessFrames.length > LIVENESS_FRAMES) livenessFrames.shift();

            if (livenessFrames.length < LIVENESS_FRAMES) {
                setScanMsg(`Scanning... (${livenessFrames.length}/${LIVENESS_FRAMES})`);
                liveLoopRef.current = setTimeout(loop, SCAN_INTERVAL_MS); return;
            }
            if (!isLive()) {
                setScanMsg('Thoda hiliye... (photo detected?)');
                liveLoopRef.current = setTimeout(loop, SCAN_INTERVAL_MS); return;
            }

            setScanMsg('Checking Face...');

            // ── OFFLINE 1:N MATCHING ──
            try {
                let bestMatchId: string | null = null;
                let minDistance = Infinity;
                const MATCH_THRESHOLD = matchThresholdRef.current;

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

    // ── Manual ID Fallback — callbacks (all deps now in scope) ────────────────
    const openManualPanel = useCallback(() => {
        stopAllLoops();
        setManualCode(''); setManualStep('input'); setManualEmp(null); setManualMsg('');
        setShowManualPanel(true);
    }, [stopAllLoops]);

    const closeManualPanel = useCallback(() => {
        setShowManualPanel(false);
        setManualCode(''); setManualStep('input'); setManualEmp(null); setManualMsg('');
        if (mode === 'live' && modelsLoaded) startLiveLoop();
    }, [mode, modelsLoaded, startLiveLoop]);

    const handleManualLookup = useCallback(() => {
        const emp = activeEmployees.find(e =>
            e.code.toLowerCase() === manualCode.trim().toLowerCase()
        );
        if (!emp) { setManualMsg('Employee ID nahi mila. Sahi code daalo.'); setManualStep('error'); return; }
        const rec = records.find(r => r.employeeId === emp.id && r.date === new Date().toISOString().split('T')[0]);
        const pt: 'IN' | 'OUT' | 'DONE' = !rec?.checkIn ? 'IN' : !rec.checkOut ? 'OUT' : 'DONE';
        setManualEmp(emp); setManualPunchType(pt); setManualStep('confirm'); setManualMsg('');
    }, [activeEmployees, manualCode, records]);

    const handleManualPunch = useCallback(async () => {
        if (!manualEmp) return;
        if (manualPunchType === 'DONE') {
            setManualMsg(`${manualEmp.name} — Aaj ki shift already complete hai.`);
            setManualStep('success');
            setTimeout(closeManualPanel, 3500);
            return;
        }
        setManualLoading(true);
        try {
            if (manualPunchType === 'IN') {
                await markCheckIn(manualEmp.id, (manualEmp as any).shift || 'GENERAL', undefined, { punchMode: 'admin', isManualPunch: true });
                speak(`Punch In. ${manualEmp.name}. Welcome!`);
                setManualMsg(`Welcome, ${manualEmp.name}!\nPunch In recorded ✓`);
            } else {
                await markCheckOut(manualEmp.id, { punchMode: 'admin', isManualPunch: true } as any);
                speak(`Punch Out. ${manualEmp.name}. Have a good day!`);
                setManualMsg(`Good bye, ${manualEmp.name}!\nPunch Out recorded ✓`);
            }
            setManualStep('success');
            setTimeout(closeManualPanel, 3500);
        } catch {
            setManualMsg('Punch save nahi hua. Dobara try karein.');
            setManualStep('error');
        } finally { setManualLoading(false); }
    }, [manualEmp, manualPunchType, markCheckIn, markCheckOut, closeManualPanel]);

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

    const unenrolledEmployees = activeEmployees.filter(e => !biometricStore.isFaceRegistered(e.id));

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
    const lateCount = activeEmployees.filter(e => { const r = records.find(r => r.employeeId === e.id && r.date === today); return r?.status === 'LATE'; }).length;
    const pendingCount = activeEmployees.length - punchedInCount;

    // ── Punch export ─────────────────────────────────────────────────────────
    const handleExportPunches = async () => {
        const XLSX = await import('xlsx');
        const headers = ['Name', 'Code', 'Department', 'Punch In', 'Punch Out', 'Hours', 'Status'];
        const rows = activeEmployees.map(emp => {
            const rec = records.find(r => r.employeeId === emp.id && r.date === today);
            const punchIn = rec?.checkIn ? fmtTime(rec.checkIn) : '-';
            const punchOut = rec?.checkOut ? fmtTime(rec.checkOut) : '-';
            let hours = '-';
            if (rec?.checkIn && rec?.checkOut) {
                const diff = (new Date(rec.checkOut).getTime() - new Date(rec.checkIn).getTime()) / 3600000;
                if (diff > 0) hours = `${diff.toFixed(1)}h`;
            }
            const status = !rec?.checkIn ? 'Absent'
                : rec.status === 'LATE' ? 'Late'
                : rec.checkOut ? 'Present (Left)'
                : 'Present (Inside)';
            return [emp.name, (emp as any).code || '-', (emp as any).department || '-', punchIn, punchOut, hours, status];
        });
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Attendance ${today}`);
        XLSX.writeFile(wb, `Face_Kiosk_${today}.xlsx`);
    };

    // ── SVG ring circumference ────────────────────────────────────────────────
    const RING_R = 34;
    const RING_C = 2 * Math.PI * RING_R;

    // ══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ══════════════════════════════════════════════════════════════════════════
    return (
        <div className="fixed inset-0 bg-[#060a0f] flex flex-col overflow-hidden z-[100] w-full h-[100dvh]">

            {/* ── Device Registration Banner (soft, dismissible) ───────────── */}
            {showRegisterBanner && !isDeviceRegistered && isAdmin && (
                <div className="shrink-0 bg-blue-950/80 border-b border-blue-700/40 px-4 py-2 flex items-center gap-3 flex-wrap z-30">
                    <ScanFace className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="text-blue-300 text-xs font-medium flex-1 min-w-0">
                        Yeh device registered nahi hai. Optional: register karein taaki audit trail mein device naam dikh sake.
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                        <input
                            value={deviceNameInput}
                            onChange={e => setDeviceNameInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleRegisterDevice()}
                            placeholder="Device name..."
                            className="bg-blue-900/50 border border-blue-700/50 rounded-lg px-3 py-1.5 text-white text-xs w-40 outline-none focus:border-blue-400"
                        />
                        <button
                            onClick={handleRegisterDevice}
                            disabled={!deviceNameInput.trim()}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-colors"
                        >
                            Register
                        </button>
                        <button
                            onClick={() => setShowRegisterBanner(false)}
                            className="p-1.5 text-blue-400 hover:text-white transition-colors"
                            title="Dismiss"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}

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
                        <button
                            onClick={toggleFullscreen}
                            title={!isFullscreenSupported ? 'Add to Home Screen for fullscreen' : isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                            className={`p-2 rounded-xl transition-all ${isFullscreenSupported ? 'text-slate-300 bg-slate-800/80 hover:bg-slate-700' : 'text-slate-500 bg-slate-800/50'}`}
                        >
                            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* Center Tabs */}
                <div className="flex items-center w-full lg:w-auto bg-slate-800/80 rounded-xl p-1 gap-1 shadow-inner overflow-x-auto min-w-0">
                    <button onClick={() => { stopAllLoops(); setMode('live'); }}
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
                    <div className="relative">
                        <button
                            onClick={toggleFullscreen}
                            title={!isFullscreenSupported ? 'Add to Home Screen for fullscreen' : isFullscreen ? 'Exit Fullscreen' : 'Fullscreen (F11)'}
                            className={`p-2.5 rounded-xl transition-all ${isFullscreenSupported ? 'text-slate-300 bg-slate-800/80 hover:bg-slate-700' : 'text-slate-500 bg-slate-800/50'}`}
                        >
                            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                        </button>
                        {showIOSHint && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-slate-800 border border-slate-600 rounded-xl p-3 shadow-xl z-50 text-left">
                                <p className="text-white text-xs font-bold mb-1">iOS Fullscreen</p>
                                <p className="text-slate-400 text-[11px] leading-relaxed">
                                    Safari mein fullscreen API nahi hai.<br />
                                    True fullscreen ke liye:<br />
                                    <span className="text-violet-300 font-medium">Share → Add to Home Screen</span>
                                </p>
                                <div className="absolute -top-1.5 right-3 w-3 h-3 bg-slate-800 border-t border-l border-slate-600 rotate-45" />
                            </div>
                        )}
                    </div>
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
                                    className={`w-full h-full object-cover ${isFrontCamera ? 'scale-x-[-1]' : ''}`} />

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

                                {/* Camera switch button */}
                                {modelsLoaded && !cameraError && liveState !== 'confirm' && (
                                    <button
                                        onClick={switchCamera}
                                        title={isFrontCamera ? 'Back camera pe switch karo' : 'Front camera pe switch karo'}
                                        className="absolute top-3 right-3 z-20 w-9 h-9 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 border border-white/10 hover:border-white/20 text-white/70 hover:text-white transition-all backdrop-blur-sm"
                                    >
                                        <SwitchCamera className="w-4 h-4" />
                                    </button>
                                )}

                                {/* No models overlay */}
                                {!modelsLoaded && (
                                    <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-4 p-6 text-center">
                                        {modelError ? (
                                            <>
                                                {/* Error icon */}
                                                <div className="relative">
                                                    <div className="w-16 h-16 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center">
                                                        <WifiOff className="w-7 h-7 text-red-400" />
                                                    </div>
                                                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-red-600 border-2 border-black flex items-center justify-center">
                                                        <X className="w-3.5 h-3.5 text-white" />
                                                    </div>
                                                </div>

                                                {/* Title + hint */}
                                                <div className="space-y-1">
                                                    <p className="text-red-300 font-bold text-base">Face AI Load Nahi Hua</p>
                                                    <p className="text-slate-500 text-xs max-w-[220px]">
                                                        Model files nahi mile. Internet check karo ya page reload karo.
                                                    </p>
                                                    {modelError && (
                                                        <p className="text-red-600/70 text-[10px] font-mono mt-1 max-w-[220px] truncate" title={modelError}>
                                                            {modelError.length > 60 ? modelError.slice(0, 60) + '…' : modelError}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Retry */}
                                                <button
                                                    onClick={retryLoadModels}
                                                    className="flex items-center gap-2 px-5 py-2 bg-red-600/20 border border-red-500/30 text-red-300 rounded-xl text-sm font-bold hover:bg-red-600/30 transition-all"
                                                >
                                                    <RefreshCw className="w-4 h-4" /> Dobara Try Karo
                                                </button>

                                                {/* Divider */}
                                                <div className="flex items-center gap-3 w-48">
                                                    <div className="flex-1 h-px bg-slate-700/60" />
                                                    <span className="text-slate-600 text-[10px] font-bold">YA</span>
                                                    <div className="flex-1 h-px bg-slate-700/60" />
                                                </div>

                                                {/* Manual fallback shortcut */}
                                                <button
                                                    onClick={openManualPanel}
                                                    className="flex items-center gap-2 px-5 py-2.5 bg-violet-600/20 border border-violet-500/30 text-violet-300 rounded-xl text-sm font-bold hover:bg-violet-600/30 transition-all"
                                                >
                                                    <UserX className="w-4 h-4" /> Employee ID se Punch Karo
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
                            {unenrolledEmployees.length > 0 && (
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex flex-col gap-2">
                                    <div className="flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-amber-300 text-xs font-bold">
                                                {unenrolledEmployees.length} employee{unenrolledEmployees.length > 1 ? 's' : ''} enroll nahi {unenrolledEmployees.length > 1 ? 'hain' : 'hai'}
                                            </p>
                                            <p className="text-amber-600/80 text-[10px] mt-0.5 leading-relaxed">
                                                {unenrolledEmployees.slice(0, 3).map(e => e.name.split(' ')[0]).join(', ')}
                                                {unenrolledEmployees.length > 3 && ` +${unenrolledEmployees.length - 3} aur`}
                                            </p>
                                        </div>
                                    </div>
                                    {isAdmin && (
                                        <button
                                            onClick={() => { stopAllLoops(); setMode('enroll'); }}
                                            className="w-full flex items-center justify-center gap-2 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 hover:border-amber-400/50 text-amber-300 rounded-lg text-xs font-bold transition-all"
                                        >
                                            <Users className="w-3.5 h-3.5" /> Enroll Karo →
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Manual fallback trigger */}
                            <button
                                onClick={openManualPanel}
                                className="flex items-center gap-2 text-slate-500 hover:text-slate-300 text-xs transition-colors border border-slate-700/40 hover:border-slate-600 rounded-xl px-4 py-2 bg-slate-900/40"
                            >
                                <UserX className="w-3.5 h-3.5" />
                                Face nahi pehchan raha? Employee ID se punch karein
                            </button>
                        </div>

                        {/* Right: Recent Punches Panel — hidden on mobile, visible on md+ */}
                        <div className="hidden md:flex w-72 shrink-0 border-l border-slate-800/60 bg-slate-900/40 flex-col overflow-hidden">
                            {/* Live stats header */}
                            <div className="px-4 pt-3 pb-2 border-b border-slate-800/60 shrink-0">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-white font-bold text-sm">Aaj ki Attendance</p>
                                    <span className="flex items-center gap-1 text-[10px] text-emerald-400/70">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                                        Live
                                    </span>
                                </div>
                                <div className="grid grid-cols-4 gap-1.5">
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg py-2 text-center">
                                        <p className="text-emerald-400 font-bold text-base leading-none">{insideCount}</p>
                                        <p className="text-slate-600 text-[9px] mt-1 leading-none">Inside</p>
                                    </div>
                                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg py-2 text-center">
                                        <p className="text-blue-400 font-bold text-base leading-none">{leftCount}</p>
                                        <p className="text-slate-600 text-[9px] mt-1 leading-none">Left</p>
                                    </div>
                                    <div className={`border rounded-lg py-2 text-center ${lateCount > 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-slate-800/30 border-slate-700/20'}`}>
                                        <p className={`font-bold text-base leading-none ${lateCount > 0 ? 'text-amber-400' : 'text-slate-600'}`}>{lateCount}</p>
                                        <p className="text-slate-600 text-[9px] mt-1 leading-none">Late</p>
                                    </div>
                                    <div className={`border rounded-lg py-2 text-center ${pendingCount > 0 ? 'bg-slate-800/50 border-slate-700/40' : 'bg-emerald-500/5 border-emerald-500/10'}`}>
                                        <p className={`font-bold text-base leading-none ${pendingCount > 0 ? 'text-slate-400' : 'text-emerald-600'}`}>{pendingCount}</p>
                                        <p className="text-slate-600 text-[9px] mt-1 leading-none">Pending</p>
                                    </div>
                                </div>
                                {/* progress bar */}
                                <div className="mt-2 h-1 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                        style={{ width: activeEmployees.length ? `${Math.round((punchedInCount / activeEmployees.length) * 100)}%` : '0%' }}
                                    />
                                </div>
                                <p className="text-slate-600 text-[10px] mt-1">{punchedInCount}/{activeEmployees.length} punched in today</p>
                            </div>

                            {/* Recent punches sub-header */}
                            <div className="px-4 py-2 border-b border-slate-800/40 shrink-0 flex items-center justify-between">
                                <p className="text-slate-400 text-xs font-semibold">Recent Punches</p>
                                <div className="flex items-center gap-1.5">
                                    {todayEvents.length > 0 && (
                                        <span className="text-[10px] font-bold text-slate-500 bg-slate-800 border border-slate-700 rounded-lg px-2 py-0.5">
                                            {todayEvents.length}
                                        </span>
                                    )}
                                    <button
                                        onClick={handleExportPunches}
                                        title="Aaj ki attendance Excel mein export karo"
                                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-emerald-400 bg-slate-800/60 hover:bg-emerald-500/10 border border-slate-700/50 hover:border-emerald-500/30 rounded-lg transition-all"
                                    >
                                        <FileDown className="w-3 h-3" /> Export
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700/50">
                                {todayEvents.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-10">
                                        <ScanFace className="w-10 h-10 text-slate-700" />
                                        <p className="text-slate-600 text-xs">Abhi koi punch nahi hua</p>
                                    </div>
                                ) : todayEvents.map((ev, i) => (
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
                        </div>
                        {/* Mobile: mini stats bar */}
                        <div className="md:hidden absolute bottom-0 inset-x-0 flex items-center justify-around py-2 px-4 bg-slate-900/90 border-t border-slate-800/60 z-10">
                            <div className="text-center"><p className="text-emerald-400 font-bold text-sm">{insideCount}</p><p className="text-slate-600 text-[9px]">Inside</p></div>
                            <div className="text-center"><p className="text-blue-400 font-bold text-sm">{leftCount}</p><p className="text-slate-600 text-[9px]">Left</p></div>
                            <div className="text-center"><p className={`font-bold text-sm ${lateCount > 0 ? 'text-amber-400' : 'text-slate-600'}`}>{lateCount}</p><p className="text-slate-600 text-[9px]">Late</p></div>
                            <div className="text-center"><p className={`font-bold text-sm ${pendingCount > 0 ? 'text-slate-400' : 'text-emerald-500'}`}>{pendingCount}</p><p className="text-slate-600 text-[9px]">Pending</p></div>
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

                {/* ══ MANUAL ID FALLBACK OVERLAY ═══════════════════════════ */}
                {showManualPanel && (
                    <div className="absolute inset-0 z-50 bg-[#020408]/90 backdrop-blur-xl flex flex-col items-center justify-center gap-5 p-6">

                        {/* Header */}
                        <div className="text-center">
                            <p className="text-slate-400 text-xs uppercase tracking-widest font-bold">Manual Punch</p>
                            <h2 className="text-white font-black text-2xl mt-1">Employee ID se Punch</h2>
                            <p className="text-slate-500 text-sm mt-1">Face scan nahi chal raha? Yahan ID enter karo.</p>
                        </div>

                        {/* Input step */}
                        {(manualStep === 'input' || manualStep === 'error') && (
                            <div className="w-full max-w-sm flex flex-col gap-3">
                                <input
                                    autoFocus
                                    value={manualCode}
                                    onChange={e => { setManualCode(e.target.value); setManualStep('input'); setManualMsg(''); }}
                                    onKeyDown={e => e.key === 'Enter' && manualCode.trim() && handleManualLookup()}
                                    placeholder="Employee ID (e.g. EMP-001)"
                                    className="w-full bg-slate-800 border-2 border-slate-700 focus:border-violet-500 rounded-2xl px-5 py-4 text-white text-xl text-center outline-none transition-colors font-mono tracking-widest"
                                />
                                {manualStep === 'error' && manualMsg && (
                                    <p className="text-red-400 text-sm text-center font-medium">{manualMsg}</p>
                                )}
                                <button
                                    onClick={handleManualLookup}
                                    disabled={!manualCode.trim()}
                                    className="w-full py-4 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-lg transition-colors"
                                >
                                    Continue →
                                </button>
                            </div>
                        )}

                        {/* Confirm step */}
                        {manualStep === 'confirm' && manualEmp && (
                            <div className="w-full max-w-sm flex flex-col gap-4">
                                {/* Employee card */}
                                <div className={`flex flex-col items-center gap-4 p-6 rounded-3xl border ${
                                    manualPunchType === 'IN'  ? 'border-emerald-500/30 bg-emerald-950/60' :
                                    manualPunchType === 'OUT' ? 'border-blue-500/30 bg-blue-950/60' :
                                    'border-slate-600/30 bg-slate-900/60'
                                }`}>
                                    <img
                                        src={manualEmp.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(manualEmp.name)}&background=random&size=128`}
                                        className="w-20 h-20 rounded-full border-4 border-white/20 object-cover"
                                    />
                                    <div className="text-center">
                                        <h3 className="text-white font-black text-2xl">{manualEmp.name}</h3>
                                        <p className="text-slate-400 text-sm">{manualEmp.code} · {(manualEmp as any).shift || 'GENERAL'}</p>
                                    </div>
                                    <div className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-base border ${
                                        manualPunchType === 'IN'  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' :
                                        manualPunchType === 'OUT' ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' :
                                        'bg-slate-700/50 border-slate-600 text-slate-300'
                                    }`}>
                                        {manualPunchType === 'IN'  && <><LogIn className="w-4 h-4" /> PUNCH IN</>}
                                        {manualPunchType === 'OUT' && <><LogOut className="w-4 h-4" /> PUNCH OUT</>}
                                        {manualPunchType === 'DONE' && <><CheckCircle className="w-4 h-4" /> Shift Complete</>}
                                    </div>
                                </div>
                                <button
                                    onClick={handleManualPunch}
                                    disabled={manualLoading}
                                    className={`w-full py-4 rounded-2xl font-extrabold text-lg transition-colors flex items-center justify-center gap-2 ${
                                        manualPunchType === 'IN'  ? 'bg-emerald-500 hover:bg-emerald-400 text-white' :
                                        manualPunchType === 'OUT' ? 'bg-blue-500 hover:bg-blue-400 text-white' :
                                        'bg-slate-700 hover:bg-slate-600 text-white'
                                    } disabled:opacity-50`}
                                >
                                    {manualLoading
                                        ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>
                                        : manualPunchType === 'IN'  ? <><LogIn className="w-5 h-5" /> Confirm Punch In</>
                                        : manualPunchType === 'OUT' ? <><LogOut className="w-5 h-5" /> Confirm Punch Out</>
                                        : <><CheckCircle className="w-5 h-5" /> OK</>
                                    }
                                </button>
                                <button onClick={() => setManualStep('input')} className="text-slate-500 hover:text-slate-300 text-sm text-center transition-colors">
                                    ← Wapas / Change ID
                                </button>
                            </div>
                        )}

                        {/* Success step */}
                        {manualStep === 'success' && (
                            <div className="flex flex-col items-center gap-4 text-center">
                                <div className="w-24 h-24 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center">
                                    <CheckCircle className="w-12 h-12 text-emerald-400" />
                                </div>
                                <p className="text-white font-bold text-xl whitespace-pre-line">{manualMsg}</p>
                                <p className="text-slate-500 text-sm">Auto close in 3 seconds…</p>
                            </div>
                        )}

                        {/* Close button */}
                        {manualStep !== 'success' && (
                            <button onClick={closeManualPanel} className="text-slate-600 hover:text-slate-400 text-sm underline transition-colors mt-2">
                                ✕ Cancel — Wapas face scan pe jao
                            </button>
                        )}
                    </div>
                )}

                {/* ══ ENROLL MODE ════════════════════════════════════════════ */}
                {mode === 'enroll' && (
                    <div className="flex-1 flex flex-col md:flex-row overflow-hidden w-full h-full min-h-0">

                        {/* Left/Top: Camera */}
                        <div className="w-full md:w-[420px] lg:w-[480px] shrink-0 p-3 md:p-6 flex flex-col gap-3 border-b md:border-b-0 md:border-r border-slate-800/80 bg-[#0a0f1a] z-10 shadow-md">
                            <div className="relative rounded-2xl overflow-hidden aspect-video w-full max-w-[260px] sm:max-w-sm mx-auto md:max-w-none border-2 border-slate-700/60 bg-slate-900 shrink-0 shadow-lg">
                                <video
                                    ref={(el) => {
                                        (videoRef as any).current = el;
                                        if (el && streamRef.current) {
                                            el.srcObject = streamRef.current;
                                            el.play().catch(() => { });
                                        }
                                    }}
                                    autoPlay playsInline muted className={`w-full h-full object-cover ${isFrontCamera ? 'scale-x-[-1]' : ''}`} />
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

                            {/* Match threshold setting — admin only */}
                            {isAdmin && (
                                <div className="w-full max-w-[260px] sm:max-w-sm mx-auto md:max-w-none bg-slate-900/60 border border-slate-700/40 rounded-xl p-3 shrink-0">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-slate-400 text-[11px] font-bold">Match Sensitivity</p>
                                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                                            matchThreshold <= 0.35 ? 'bg-emerald-950 text-emerald-400' :
                                            matchThreshold <= 0.45 ? 'bg-blue-950 text-blue-400' :
                                            'bg-amber-950 text-amber-400'
                                        }`}>
                                            {matchThreshold <= 0.35 ? 'Strict' : matchThreshold <= 0.45 ? 'Balanced' : 'Lenient'} — {matchThreshold.toFixed(2)}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.30" max="0.60" step="0.05"
                                        value={matchThreshold}
                                        onChange={e => updateMatchThreshold(parseFloat(e.target.value))}
                                        className="w-full h-1.5 rounded-full accent-violet-500 cursor-pointer"
                                    />
                                    <div className="flex justify-between text-slate-700 text-[9px] mt-1">
                                        <span>Strict (0.30)</span>
                                        <span>Default (0.45)</span>
                                        <span>Lenient (0.60)</span>
                                    </div>
                                    <p className="text-slate-600 text-[10px] mt-1.5 leading-relaxed">
                                        Strict = kam false match, zyada miss. Lenient = zyada match, galti ka risk.
                                    </p>
                                </div>
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
                                            const isConfirmDelete = deleteConfirmId === emp.id;
                                            const isDeleting = deletingId === emp.id;
                                            const registeredAt = biometricStore.getRegisteredAt(emp.id);
                                            const disabled = !!enrollingId && !isActive;
                                            return (
                                                <div key={emp.id} className={`relative flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${
                                                    isActive        ? 'border-violet-500/60 bg-violet-500/15 ring-2 ring-violet-500/30' :
                                                    isConfirmDelete ? 'border-red-500/50 bg-red-950/40' :
                                                    isEnrolled      ? 'border-emerald-500/30 bg-emerald-500/10' :
                                                    'border-slate-700/40 bg-slate-900/40'
                                                } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>

                                                    {/* Confirm-delete overlay */}
                                                    {isConfirmDelete && (
                                                        <div className="absolute inset-0 rounded-xl flex items-center justify-center gap-2 bg-red-950/90 z-10 px-3">
                                                            <span className="text-red-300 text-xs font-bold flex-1">{emp.name} ka enrollment delete karein?</span>
                                                            <button
                                                                onClick={() => handleDeleteEnrollment(emp.id)}
                                                                disabled={isDeleting}
                                                                className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50"
                                                            >
                                                                {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                                                Haan, Delete
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteConfirmId(null)}
                                                                className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-[11px] font-bold transition-colors"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Avatar */}
                                                    <div
                                                        className="relative shrink-0 cursor-pointer"
                                                        onClick={() => { if (!disabled && !isConfirmDelete) startEnroll(emp.id); }}
                                                    >
                                                        <img src={emp.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=random&size=64`}
                                                            className="w-12 h-12 rounded-full object-cover border-2 border-slate-700" />
                                                        <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-[#060a0f] flex items-center justify-center ${isEnrolled ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                                                            {isEnrolled ? <CheckCircle className="w-2.5 h-2.5 text-white" /> : <UserX className="w-2.5 h-2.5 text-slate-300" />}
                                                        </div>
                                                    </div>

                                                    {/* Info — click to enroll */}
                                                    <div
                                                        className="flex-1 min-w-0 cursor-pointer"
                                                        onClick={() => { if (!disabled && !isConfirmDelete) startEnroll(emp.id); }}
                                                    >
                                                        <p className="text-white font-semibold text-sm truncate">{emp.name}</p>
                                                        <p className="text-slate-500 text-[11px] truncate">{emp.code}</p>
                                                        {isEnrolled && registeredAt && (
                                                            <p className="text-emerald-600 text-[10px] mt-0.5">✓ {new Date(registeredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                                                        )}
                                                        {!isEnrolled && <p className="text-slate-600 text-[10px] mt-0.5">Not enrolled</p>}
                                                        {isActive && <p className="text-violet-400 text-[10px] mt-0.5 animate-pulse">Scanning...</p>}
                                                    </div>

                                                    {/* Right actions */}
                                                    {!isActive && (
                                                        <div className="shrink-0 flex flex-col items-end gap-1">
                                                            {isEnrolled && (
                                                                <>
                                                                    <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-800 border border-slate-700 rounded-lg px-1.5 py-0.5">
                                                                        <RefreshCw className="w-2.5 h-2.5" /> Re-enroll
                                                                    </div>
                                                                    <button
                                                                        onClick={e => { e.stopPropagation(); setDeleteConfirmId(emp.id); }}
                                                                        className="flex items-center gap-1 text-[10px] text-red-500/70 hover:text-red-400 bg-red-950/30 hover:bg-red-950/60 border border-red-900/30 hover:border-red-700/50 rounded-lg px-1.5 py-0.5 transition-colors"
                                                                    >
                                                                        <Trash2 className="w-2.5 h-2.5" /> Delete
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Enrollment success toast */}
            {enrollToast && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[110] pointer-events-none">
                    <div className="flex items-center gap-3 px-5 py-3 bg-emerald-600 border border-emerald-400/40 rounded-2xl shadow-2xl shadow-emerald-900/60 animate-fade-in-up">
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                            <CheckCircle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-white font-bold text-sm leading-tight">{enrollToast}</p>
                            <p className="text-emerald-200 text-[11px]">Face successfully enrolled ✓</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Scan line animation */}
            <style>{`
                @keyframes scan-line { 0%{top:10%} 50%{top:90%} 100%{top:10%} }
                .animate-scan-line { position:absolute; animation:scan-line 2s ease-in-out infinite; left:0; right:0; }
                @keyframes fade-in-up { from { opacity:0; transform:translateX(-50%) translateY(12px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
                .animate-fade-in-up { animation:fade-in-up 0.25s ease-out; }
            `}</style>
        </div>
    );
};
