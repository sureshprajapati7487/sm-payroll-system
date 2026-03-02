// CameraPunchWidget — Premium Redesign
// Popup anchored above FAB | Face / Fingerprint / Live Selfie / PIN modes + GPS Location

import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
    Camera, X, LogIn, LogOut, CheckCircle, AlertCircle,
    Loader2, RefreshCw, Fingerprint, ScanFace,
    Clock, User, MapPin, Navigation, UserPlus, Hash,
    Coffee, Trash2
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useAttendanceStore } from '@/store/attendanceStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { useShiftStore } from '@/store/shiftStore';
import { useSystemConfigStore } from '@/store/systemConfigStore';
import { biometricStore } from '@/store/biometricStore';
import { useFaceRecognition } from '@/hooks/useFaceRecognition';

type PunchState = 'idle' | 'loading' | 'success' | 'error';
type PunchMode = 'face' | 'fingerprint' | 'photoUpload' | 'pin';

// ── Live Clock ────────────────────────────────────────────────────────────────
const LiveClock = () => {
    const [time, setTime] = useState(new Date());
    useEffect(() => {
        const t = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);
    return (
        <span className="font-mono text-xs text-slate-300 tabular-nums">
            {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
    );
};

// ── Animated Face Overlay ──────────────────────────────────────────────────────
const FaceScanOverlay = ({ scanned }: { scanned: boolean }) => (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* Corner brackets */}
        <div className="relative w-36 h-44">
            {/* Top-left */}
            <span className={`absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 rounded-tl-lg transition-all duration-700 ${scanned ? 'border-green-400' : 'border-blue-400'}`} />
            {/* Top-right */}
            <span className={`absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 rounded-tr-lg transition-all duration-700 ${scanned ? 'border-green-400' : 'border-blue-400'}`} />
            {/* Bottom-left */}
            <span className={`absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 rounded-bl-lg transition-all duration-700 ${scanned ? 'border-green-400' : 'border-blue-400'}`} />
            {/* Bottom-right */}
            <span className={`absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 rounded-br-lg transition-all duration-700 ${scanned ? 'border-green-400' : 'border-blue-400'}`} />
            {/* Oval face guide */}
            <div className={`absolute inset-4 rounded-full border-2 border-dashed transition-all duration-700 ${scanned ? 'border-green-400/60' : 'border-blue-400/40 animate-pulse'}`} />
            {/* Scan line */}
            {!scanned && (
                <div
                    className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent"
                    style={{ animation: 'scanline 2s linear infinite', top: '30%' }}
                />
            )}
            {scanned && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <CheckCircle className="w-10 h-10 text-green-400 drop-shadow-lg" />
                </div>
            )}
        </div>
    </div>
);

// ── Fingerprint Scanner UI ────────────────────────────────────────────────────
const FingerprintScanner = ({
    scanning, progress, verified
}: { scanning: boolean; progress: number; verified: boolean }) => (
    <div className="flex flex-col items-center gap-4 py-4">
        {/* Ring */}
        <div className="relative w-28 h-28">
            {/* Background ring */}
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="44" fill="none" stroke="#1e293b" strokeWidth="6" />
                <circle
                    cx="50" cy="50" r="44" fill="none"
                    stroke={verified ? '#22c55e' : scanning ? '#60a5fa' : '#334155'}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 44}`}
                    strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress / 100)}`}
                    style={{ transition: 'stroke-dashoffset 0.3s ease, stroke 0.5s ease' }}
                />
            </svg>
            {/* Center icon */}
            <div className={`absolute inset-3 rounded-full flex items-center justify-center transition-all duration-500 ${verified ? 'bg-green-500/15' : scanning ? 'bg-blue-500/15' : 'bg-slate-800'}`}>
                {verified ? (
                    <CheckCircle className="w-10 h-10 text-green-400" />
                ) : (
                    <Fingerprint className={`w-10 h-10 transition-all duration-300 ${scanning ? 'text-blue-400' : 'text-slate-500'}`} />
                )}
            </div>
            {/* Ripple when scanning */}
            {scanning && (
                <span className="absolute inset-0 rounded-full border-2 border-blue-400/30 animate-ping" />
            )}
        </div>

        <p className={`text-sm font-semibold text-center transition-colors duration-300 ${verified ? 'text-green-400' : scanning ? 'text-blue-400' : 'text-slate-400'}`}>
            {verified ? '✅ Fingerprint Verified!' : scanning ? `Scanning... ${Math.round(progress)}%` : 'Button dabao aur finger rakh do'}
        </p>
        {scanning && (
            <div className="w-full bg-slate-800 rounded-full h-1">
                <div
                    className="bg-gradient-to-r from-blue-500 to-indigo-400 h-1 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                />
            </div>
        )}
    </div>
);

// ── Main Widget ────────────────────────────────────────────────────────────────
export const CameraPunchWidget = () => {
    const location = useLocation();

    // Hide FAB on Face Kiosk page — kiosk has its own camera UI
    if (location.pathname === '/attendance/kiosk') return null;

    const [open, setOpen] = useState(false);
    const [activeMode, setActiveMode] = useState<PunchMode>('face');
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
    const [punchState, setPunchState] = useState<PunchState>('idle');
    const [punchMessage, setPunchMessage] = useState('');
    const [punchTime, setPunchTime] = useState('');
    const [workedHours, setWorkedHours] = useState('');
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [thumbScanning, setThumbScanning] = useState(false);
    const [thumbProgress, setThumbProgress] = useState(0);

    // PIN mode state
    const [pinValue, setPinValue] = useState('');
    const [pinError, setPinError] = useState<string | null>(null);

    // Late punch alert
    const [lateAlertMsg, setLateAlertMsg] = useState<string | null>(null);

    // Matched GPS zone (for multi-location)
    const [matchedZone, setMatchedZone] = useState<{ id: string; name: string; distM: number } | null>(null);

    const [locationStatus, setLocationStatus] = useState<'idle' | 'checking' | 'ok' | 'denied' | 'outside'>('idle');
    const [locationDistance, setLocationDistance] = useState<number | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);

    const [bioStep, setBioStep] = useState<'check' | 'register_intro' | 'registering' | 'verified' | 'auto_matching'>('check');
    const [bioError, setBioError] = useState<string | null>(null);
    const [faceRegProgress, setFaceRegProgress] = useState(0); // 0-100 during face capture
    const [faceMatchStatus, setFaceMatchStatus] = useState<'scanning' | 'matched' | 'mismatch' | 'no_face' | 'too_far'>('scanning');
    const [faceConfidence, setFaceConfidence] = useState(0); // 0-100
    const {
        loadModels: loadFaceModels,
        retryLoadModels,
        loadProgress: modelLoadProgress,
        status: faceHookStatus,
        error: faceHookError,
        getDescriptor,
        startMatchLoop,
        stopMatchLoop,
    } = useFaceRecognition();

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const { user } = useAuthStore();
    const { markCheckIn, markCheckOut, getTodayRecord, startBreak, endBreak, getActiveBreak, getTodayBreaks } = useAttendanceStore();
    const { employees } = useEmployeeStore();
    const { shifts } = useShiftStore();
    const { punchMethods, punchLocation, punchLocations, shiftPunchWindows } = useSystemConfigStore();

    const myEmployee = employees.find(e =>
        (user?.email && e.email?.toLowerCase() === user.email.toLowerCase()) ||
        (user?.name && e.name?.toLowerCase() === user.name.toLowerCase())
    );
    const todayRecord = myEmployee ? getTodayRecord(myEmployee.id) : undefined;
    const isPunchedIn = !!todayRecord?.checkIn;
    const isPunchedOut = !!todayRecord?.checkOut;
    const todayBreaks = myEmployee ? getTodayBreaks(myEmployee.id) : [];
    const activeBreak = myEmployee ? getActiveBreak(myEmployee.id) : undefined;
    const isOnBreak = !!activeBreak;

    // ── Late punch alert check ─────────────────────────────────────────────────
    const checkLateAlert = useCallback(() => {
        if (isPunchedIn) return; // already punched in
        const myShiftId = myEmployee?.shift;
        if (!myShiftId) return;
        const window = shiftPunchWindows.find(w => w.enabled && w.shiftId === myShiftId);
        if (!window) return;
        const now = new Date();
        const [toH, toM] = window.checkInTo.split(':').map(Number);
        const windowEnd = new Date();
        windowEnd.setHours(toH, toM, 0, 0);
        if (now > windowEnd) {
            const diffMin = Math.round((now.getTime() - windowEnd.getTime()) / 60000);
            setLateAlertMsg(`⏰ Late Punch! Check-in window (${window.checkInFrom}-${window.checkInTo}) khatam ho gayi. Aap ${diffMin} min late hain.`);
        } else {
            setLateAlertMsg(null);
        }
    }, [isPunchedIn, myEmployee, shiftPunchWindows]);

    const enabledModes = (['face', 'fingerprint', 'photoUpload', 'pin'] as PunchMode[]).filter(
        m => m === 'pin' ? true : punchMethods[m as 'face' | 'fingerprint' | 'photoUpload']?.enabled
    );

    useEffect(() => {
        if (enabledModes.length > 0 && !enabledModes.includes(activeMode)) {
            setActiveMode(enabledModes[0]);
        }
    }, [enabledModes.join(',')]); // eslint-disable-line

    const startCamera = useCallback(async () => {
        setCameraError(null);
        setCapturedPhoto(null);
        try {
            const s = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
                audio: false,
            });
            setStream(s);
        } catch {
            setCameraError('Camera access denied.');
        }
    }, []);

    useEffect(() => {
        if (stream && videoRef.current) videoRef.current.srcObject = stream;
    }, [stream]);

    const stopCamera = useCallback(() => {
        stream?.getTracks().forEach(t => t.stop());
        setStream(null);
    }, [stream]);

    useEffect(() => {
        if (open) {
            setPunchState('idle');
            setCapturedPhoto(null);
            setCameraError(null);
            setThumbScanning(false);
            setThumbProgress(0);
            setPunchTime('');
            setWorkedHours('');
            setPinValue('');
            setPinError(null);
            // Hydrate biometric cache from server
            if (myEmployee) biometricStore.hydrate(myEmployee.id);
            // Start camera for face OR live selfie modes
            if (activeMode === 'face' || activeMode === 'photoUpload') startCamera();
            // GPS check
            if (punchLocation.enabled || punchLocations.some(l => l.enabled)) checkLocation();
            // Late alert check
            checkLateAlert();
        } else {
            stopCamera();
        }
    }, [open]); // eslint-disable-line

    useEffect(() => {
        setCapturedPhoto(null);
        setCameraError(null);
        setPunchState('idle');
        setThumbScanning(false);
        setThumbProgress(0);
        // Start camera for face OR live selfie modes
        if (activeMode === 'face' || activeMode === 'photoUpload') { startCamera(); }
        else { stopCamera(); }
    }, [activeMode]); // eslint-disable-line

    // ── Haversine distance (km) ────────────────────────────────────────────────
    const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    // ── GPS Location Check (Multi-Zone support) ───────────────────────────────
    const checkLocation = useCallback(() => {
        // If multi-zones configured, use them; else fall back to legacy single-zone
        const zones = punchLocations.filter(l => l.enabled);
        const useLegacy = zones.length === 0;

        if (useLegacy && !punchLocation.enabled) { setLocationStatus('ok'); return; }
        if (!navigator.geolocation) { setLocationStatus('denied'); setLocationError('GPS is astitva mein nahi hai.'); return; }
        setLocationStatus('checking');
        setLocationError(null);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const userLat = pos.coords.latitude;
                const userLng = pos.coords.longitude;

                if (useLegacy) {
                    // Legacy single-zone
                    const distM = Math.round(haversineKm(userLat, userLng, punchLocation.lat, punchLocation.lng) * 1000);
                    setLocationDistance(distM);
                    if (distM <= punchLocation.radiusMeters) { setLocationStatus('ok'); }
                    else { setLocationStatus('outside'); setLocationError(`Aap ${distM}m door hain. Sirf ${punchLocation.radiusMeters}m ke andar punch kar sakte hain.`); }
                } else {
                    // Multi-zone: find nearest enabled zone
                    let nearest: { id: string; name: string; distM: number; radius: number } | null = null;
                    for (const z of zones) {
                        const d = Math.round(haversineKm(userLat, userLng, z.lat, z.lng) * 1000);
                        if (!nearest || d < nearest.distM) nearest = { id: z.id, name: z.name, distM: d, radius: z.radiusMeters };
                    }
                    if (nearest) {
                        setLocationDistance(nearest.distM);
                        if (nearest.distM <= nearest.radius) {
                            setLocationStatus('ok');
                            setMatchedZone({ id: nearest.id, name: nearest.name, distM: nearest.distM });
                        } else {
                            setLocationStatus('outside');
                            setMatchedZone(null);
                            setLocationError(`Nearest zone "${nearest.name}" se ${nearest.distM}m door hain (allowed: ${nearest.radius}m).`);
                        }
                    }
                }
            },
            (err) => {
                setLocationStatus('denied');
                setLocationError(err.code === 1 ? 'Location permission deny ki gayi.' : 'Location detect nahi ho payi.');
            },
            { timeout: 10000, maximumAge: 30000 }
        );
    }, [punchLocation, punchLocations]);

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return;
        const v = videoRef.current;
        const c = canvasRef.current;
        c.width = v.videoWidth || 640;
        c.height = v.videoHeight || 480;
        c.getContext('2d')?.drawImage(v, 0, 0);
        setCapturedPhoto(c.toDataURL('image/jpeg', 0.8));

    };


    // ── THUMB: Register (first time) ──────────────────────────────────────────
    const registerThumb = async () => {
        if (!myEmployee) return;
        setThumbScanning(true); setThumbProgress(0); setCameraError(null); setBioError(null);
        try {
            if (!window.PublicKeyCredential) throw new Error('WebAuthn supported nahi hai is browser mein.');
            const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            if (!available) throw new Error('Is device par fingerprint sensor nahi hai.');

            setThumbProgress(20);
            const empIdBytes = new TextEncoder().encode(myEmployee.id.padEnd(16, '0').slice(0, 16));
            const cred = await navigator.credentials.create({
                publicKey: {
                    challenge: crypto.getRandomValues(new Uint8Array(32)),
                    rp: { name: 'SM Payroll', id: window.location.hostname },
                    user: { id: empIdBytes, name: myEmployee.id, displayName: myEmployee.name },
                    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
                    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
                    timeout: 60000,
                } as any
            }) as any;
            if (!cred) throw new Error('Registration cancel ho gayi.');

            // Store credential ID for future get() calls
            const rawIdArr = Array.from(new Uint8Array(cred.rawId));
            const credentialId = btoa(String.fromCharCode(...rawIdArr));
            biometricStore.setThumbCredential(myEmployee.id, { credentialId, rawId: rawIdArr });
            setThumbProgress(100);
            setBioStep('verified');
            setCapturedPhoto('THUMB_VERIFIED');
        } catch (err: any) {
            setBioError(err?.name === 'NotAllowedError' ? 'Registration cancel ki gayi.' : err?.message || 'Registration fail.');
        } finally { setThumbScanning(false); }
    };

    // ── THUMB: Verify (registered employee) ───────────────────────────────────
    const verifyThumb = async () => {
        if (!myEmployee) return;
        setThumbScanning(true); setThumbProgress(0); setCameraError(null); setBioError(null);
        const stored = biometricStore.getThumbCredential(myEmployee.id);
        if (!stored) { setBioStep('register_intro'); setThumbScanning(false); return; }
        try {
            setThumbProgress(30);
            const rawIdUint8 = new Uint8Array(stored.rawId);
            await navigator.credentials.get({
                publicKey: {
                    challenge: crypto.getRandomValues(new Uint8Array(32)),
                    rpId: window.location.hostname,
                    allowCredentials: [{ type: 'public-key', id: rawIdUint8 }],
                    userVerification: 'required',
                    timeout: 60000,
                } as any
            });
            setThumbProgress(100);
            setBioStep('verified');
            setCapturedPhoto('THUMB_VERIFIED');
        } catch (err: any) {
            setBioError(err?.name === 'NotAllowedError' ? 'Fingerprint match nahi hua ya cancel kiya.' : 'Verify fail. Dobara try karein.');
        } finally { setThumbScanning(false); }
    };

    // ── FACE: Register (capture descriptor) ──────────────────────────────────
    const registerFace = async () => {
        if (!myEmployee || !videoRef.current) return;
        setBioError(null); setBioStep('registering');
        const ok = await loadFaceModels();
        if (!ok) { setBioError('Face AI load fail. Internet check karein.'); setBioStep('register_intro'); return; }

        // Capture 5 descriptors and average them for robustness
        const descriptors: Float32Array[] = [];
        for (let i = 0; i < 5; i++) {
            setFaceRegProgress(Math.round((i / 5) * 90));
            await new Promise(r => setTimeout(r, 600));
            const result = await getDescriptor(videoRef.current!);
            if (result) descriptors.push(result.descriptor);
        }
        if (descriptors.length < 2) {
            setBioError('Chehra detect nahi hua. Achi roshnii mein camera ke saamne aayein.');
            setBioStep('register_intro'); return;
        }
        // Average the descriptors
        const avg = new Float32Array(128);
        for (const d of descriptors) d.forEach((v, i) => avg[i] += v / descriptors.length);
        await biometricStore.setFaceDescriptor(myEmployee.id, avg);
        setFaceRegProgress(100);
        setBioStep('auto_matching');
        // Start live match loop immediately after registration
        startFaceAutoMatch();
    };

    // ── FACE: Start live auto-match loop ──────────────────────────────────────
    const startFaceAutoMatch = useCallback(async () => {
        if (!myEmployee || !videoRef.current) return;
        const stored = biometricStore.getFaceDescriptor(myEmployee.id);
        if (!stored) { setBioStep('register_intro'); return; }
        const ok = await loadFaceModels();
        if (!ok) { setBioError('Face AI load fail. Retry karein.'); return; }
        setFaceMatchStatus('scanning');
        setFaceConfidence(0);
        setBioStep('auto_matching');
        startMatchLoop(
            videoRef.current,
            stored,
            (conf) => {
                // ✅ Face matched with confidence
                setFaceMatchStatus('matched');
                setFaceConfidence(conf);
                setBioStep('verified');
                setCapturedPhoto('FACE_VERIFIED');
                setTimeout(() => doPunch(), 800);
            },
            () => setFaceMatchStatus('no_face'),
            (conf) => {
                setFaceMatchStatus('mismatch');
                setFaceConfidence(conf);
            },
        );
    }, [myEmployee, loadFaceModels, startMatchLoop]); // eslint-disable-line


    const calcWorkedHours = (checkIn: string, checkOut: string) => {
        const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        return `${h}h ${m}m`;
    };

    const doPunch = async (overridePinVerified = false) => {
        if (!myEmployee) {
            setPunchState('error');
            setPunchMessage('Employee record nahi mila. HR se contact karein.');
            return;
        }
        // PIN mode: verify PIN against employee password
        if (activeMode === 'pin') {
            if (!overridePinVerified) {
                if (!pinValue || pinValue.length < 4) { setPinError('4-digit PIN daalo.'); return; }
                // Match pin (using employee password field as PIN)
                const empPin = myEmployee.password?.trim();
                if (empPin && empPin !== pinValue) { setPinError('Galat PIN. Dobara try karo.'); return; }
                // PIN ok
            }
        } else {
            // Non-PIN: verification photo required
            if (!capturedPhoto) return;
        }
        // 📍 Location check (legacy or multi-zone)
        const hasLocationRestriction = punchLocation.enabled || punchLocations.some(l => l.enabled);
        if (hasLocationRestriction && locationStatus !== 'ok') {
            setPunchState('error');
            setPunchMessage(locationError || 'Location verify karne ke baad punch karein.');
            return;
        }
        setPunchState('loading');
        await new Promise(r => setTimeout(r, 900));
        try {
            const proof = capturedPhoto && capturedPhoto !== 'THUMB_VERIFIED' && capturedPhoto !== 'FACE_VERIFIED' ? capturedPhoto : undefined;
            const defaultShift = shifts[0]?.id || 'default';
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            const punchMeta = {
                punchMode: activeMode as 'face' | 'fingerprint' | 'photoUpload' | 'pin',
                punchLocationId: matchedZone?.id,
                usedPinPunch: activeMode === 'pin',
            };

            if (!isPunchedIn) {
                await markCheckIn(myEmployee.id, defaultShift, proof, punchMeta);
                setPunchTime(timeStr);
                setPunchState('success');
                setPunchMessage('Punch In Successful!');
            } else {
                await markCheckOut(myEmployee.id, { punchMode: punchMeta.punchMode });
                setPunchTime(timeStr);
                if (todayRecord?.checkIn) {
                    setWorkedHours(calcWorkedHours(todayRecord.checkIn, now.toISOString()));
                }
                setPunchState('success');
                setPunchMessage('Punch Out Successful!');
            }
            setTimeout(() => setOpen(false), 2800);
        } catch {
            setPunchState('error');
            setPunchMessage('Punch fail hua. Dobara koshish karein.');
        }
    };

    // ── Break Start / End ──────────────────────────────────────────────────────
    const handleBreak = async () => {
        if (!myEmployee) return;
        if (isOnBreak) {
            await endBreak(myEmployee.id);
        } else {
            await startBreak(myEmployee.id);
        }
    };

    // ── PIN keypad handler ────────────────────────────────────────────────────
    const handlePinKey = (key: string) => {
        setPinError(null);
        if (key === 'DEL') { setPinValue(v => v.slice(0, -1)); return; }
        if (pinValue.length >= 6) return;
        const newPin = pinValue + key;
        setPinValue(newPin);
        if (newPin.length >= 4) {
            // Auto-submit when 4+ digits entered
            setTimeout(() => doPunch(false), 300);
        }
    };

    if (!user || enabledModes.length === 0) return null;

    // ── Mode metadata ──────────────────────────────────────────────────────────
    const MODE_META: Record<PunchMode, { icon: React.ReactNode; label: string; color: string }> = {
        face: { icon: <ScanFace className="w-4 h-4" />, label: punchMethods.face?.label || 'Face', color: 'blue' },
        fingerprint: { icon: <Fingerprint className="w-4 h-4" />, label: punchMethods.fingerprint?.label || 'Fingerprint', color: 'indigo' },
        photoUpload: { icon: <Camera className="w-4 h-4" />, label: punchMethods.photoUpload?.label || 'Live Selfie', color: 'violet' },
        pin: { icon: <Hash className="w-4 h-4" />, label: 'PIN', color: 'amber' },
    };

    // FAB state config
    const fabConfig = isPunchedOut
        ? { gradient: 'from-slate-600 to-slate-700', border: 'border-slate-500/40', shadow: 'shadow-slate-800/40', pulse: 'border-slate-500/20', dot: 'bg-slate-400', label: '✓ Done', icon: <Camera className="w-5 h-5 text-white" /> }
        : isPunchedIn
            ? { gradient: 'from-red-600 to-rose-600', border: 'border-red-400/30', shadow: 'shadow-red-700/50', pulse: 'border-red-400/30', dot: 'bg-red-300', label: 'Punch Out', icon: <LogOut className="w-5 h-5 text-white" /> }
            : { gradient: 'from-emerald-500 to-green-600', border: 'border-green-400/30', shadow: 'shadow-green-700/50', pulse: 'border-green-400/20', dot: 'bg-green-300', label: 'Punch In', icon: <LogIn className="w-5 h-5 text-white" /> };

    return (
        <>
            {/* ── Scan line CSS animation ──────────────────────────────────── */}
            <style>{`
                @keyframes scanline {
                    0% { top: 20%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 80%; opacity: 0; }
                }
            `}</style>

            {/* ── FAB ─────────────────────────────────────────────────────── */}
            <button
                onClick={() => setOpen(o => !o)}
                className={`fixed bottom-[88px] md:bottom-6 right-4 md:right-6 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl border transition-all duration-300 hover:scale-[1.04] active:scale-95 select-none bg-gradient-to-br ${fabConfig.gradient} ${fabConfig.border} ${fabConfig.shadow}`}
                title={fabConfig.label}
            >
                {/* Ping animation */}
                {!isPunchedOut && (
                    <span className={`absolute -inset-1.5 rounded-2xl border-2 animate-ping pointer-events-none opacity-60 ${fabConfig.pulse}`} />
                )}

                {/* Avatar */}
                {myEmployee?.avatar ? (
                    <img src={myEmployee.avatar} alt="" className="w-7 h-7 rounded-full border-2 border-white/30 shrink-0 object-cover" />
                ) : (
                    <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-white/80" />
                    </div>
                )}

                <span className="text-sm font-bold text-white tracking-wide">{fabConfig.label}</span>

                {/* Status dot */}
                <span className={`w-2 h-2 rounded-full shrink-0 ${fabConfig.dot} ${!isPunchedOut ? 'animate-pulse' : ''}`} />
            </button>

            {/* ── Popover ──────────────────────────────────────────────────── */}
            {open && (
                <div className="fixed bottom-[160px] md:bottom-24 right-4 md:right-5 z-[999] w-[360px] max-w-[calc(100vw-20px)] bg-[#0d1117] border border-slate-700/60 rounded-3xl shadow-2xl shadow-black/70 overflow-hidden max-h-[calc(100vh-200px)] md:max-h-[calc(100vh-120px)] overflow-y-auto">

                    {/* ── Header ────────────────────────────────────────────── */}
                    <div className="relative px-4 py-3.5 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/80 to-slate-900/80">
                        <div className="flex items-center gap-3">
                            {/* Avatar */}
                            {myEmployee?.avatar ? (
                                <img src={myEmployee.avatar} alt="" className="w-10 h-10 rounded-xl border-2 border-slate-600 shrink-0 object-cover" />
                            ) : (
                                <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center shrink-0">
                                    <User className="w-5 h-5 text-slate-400" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-white font-bold text-sm truncate">{user.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    {/* Status badge */}
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${isPunchedOut ? 'bg-slate-700 text-slate-400' : isPunchedIn ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${isPunchedOut ? 'bg-slate-400' : isPunchedIn ? 'bg-red-400 animate-pulse' : 'bg-green-400 animate-pulse'}`} />
                                        {isPunchedOut ? 'Day Complete' : isPunchedIn ? 'Punched In' : 'Not Punched'}
                                    </span>
                                    {/* Live clock */}
                                    <span className="flex items-center gap-1 text-slate-500 text-[10px]">
                                        <Clock className="w-3 h-3" />
                                        <LiveClock />
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => setOpen(false)}
                                className="p-1.5 rounded-xl text-slate-500 hover:text-white hover:bg-slate-700/60 transition-all shrink-0"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* ── GPS Location Badge (legacy + multi-zone) ──────────── */}
                    {(punchLocation.enabled || punchLocations.some(l => l.enabled)) && (
                        <div className={`flex items-center gap-2 px-4 py-1.5 border-b text-[11px] font-semibold transition-all duration-300 ${locationStatus === 'ok'
                            ? 'bg-green-500/10 border-green-500/20 text-green-400'
                            : locationStatus === 'checking'
                                ? 'bg-slate-800/60 border-slate-700/40 text-slate-400'
                                : 'bg-red-500/10 border-red-500/20 text-red-400'
                            }`}>
                            {locationStatus === 'ok' ? (
                                <><MapPin className="w-3 h-3 shrink-0" /> ✓ {matchedZone?.name || punchLocation.name}
                                    {locationDistance != null && <span className="text-green-500/70 ml-1 font-normal">({locationDistance}m)</span>}
                                </>
                            ) : locationStatus === 'checking' ? (
                                <><Navigation className="w-3 h-3 shrink-0 animate-spin" /> Location check ho raha hai...</>
                            ) : locationStatus === 'outside' ? (
                                <><MapPin className="w-3 h-3 shrink-0" /> Zone se bahar!
                                    {locationDistance != null && <span className="ml-1 font-normal">({locationDistance}m)</span>}
                                    <button onClick={checkLocation} className="ml-auto text-red-400/70 hover:text-red-300 underline text-[10px]">Retry</button>
                                </>
                            ) : (
                                <><MapPin className="w-3 h-3 shrink-0" /> {locationError || 'Location mil nahi raha'}
                                    <button onClick={checkLocation} className="ml-auto text-red-400/70 hover:text-red-300 underline text-[10px]">Retry</button>
                                </>
                            )}
                        </div>
                    )}

                    {/* ── Late Punch Alert Banner ────────────────────────── */}
                    {lateAlertMsg && (
                        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-amber-500/20 bg-amber-500/10 text-amber-400 text-[11px] font-semibold">
                            <Clock className="w-3 h-3 shrink-0" />
                            {lateAlertMsg}
                        </div>
                    )}

                    {/* ── Mode Tabs ─────────────────────────────────────────── */}
                    {!isPunchedOut && punchState === 'idle' && enabledModes.length > 1 && (
                        <div className="flex gap-1.5 px-3 pt-3">
                            {enabledModes.map(m => {
                                const isActive = activeMode === m;
                                return (
                                    <button
                                        key={m}
                                        onClick={() => setActiveMode(m)}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-bold transition-all duration-200 ${isActive
                                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-inner'
                                            : 'text-slate-500 hover:text-slate-300 bg-slate-800/40 border border-transparent hover:border-slate-600/40'
                                            }`}
                                    >
                                        {MODE_META[m].icon}
                                        <span className="hidden sm:inline">{MODE_META[m].label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* ── Body ──────────────────────────────────────────────── */}
                    <div className="p-4 space-y-3">

                        {/* ═══ SUCCESS ═══════════════════════════════════════ */}
                        {punchState === 'success' && (
                            <div className="py-5 text-center space-y-3">
                                <div className="relative w-20 h-20 mx-auto">
                                    <div className="absolute inset-0 rounded-full bg-green-500/10 animate-ping" />
                                    <div className="relative w-full h-full rounded-full bg-green-500/15 border-2 border-green-500/40 flex items-center justify-center">
                                        <CheckCircle className="w-10 h-10 text-green-400" />
                                    </div>
                                </div>
                                <div>
                                    <p className="text-white font-bold text-base">{punchMessage}</p>
                                    <p className="text-green-400 font-mono text-sm mt-1">{punchTime}</p>
                                    {workedHours && (
                                        <p className="text-slate-400 text-xs mt-1">⏱ Worked: <span className="text-white font-semibold">{workedHours}</span></p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ═══ ERROR ═════════════════════════════════════════ */}
                        {punchState === 'error' && (
                            <div className="py-5 text-center space-y-3">
                                <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
                                <p className="text-red-300 text-sm">{punchMessage}</p>
                                <button
                                    onClick={() => setPunchState('idle')}
                                    className="text-xs text-slate-400 hover:text-white px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all"
                                >
                                    Dobara Koshish Karo
                                </button>
                            </div>
                        )}

                        {/* ═══ LOADING ═══════════════════════════════════════ */}
                        {punchState === 'loading' && (
                            <div className="py-8 text-center space-y-3">
                                <div className="relative w-16 h-16 mx-auto">
                                    <div className="absolute inset-0 rounded-full border-4 border-slate-700" />
                                    <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                                    <div className="absolute inset-2 rounded-full bg-blue-500/10 flex items-center justify-center">
                                        <Loader2 className="w-5 h-5 text-blue-400 animate-spin" style={{ animationDirection: 'reverse' }} />
                                    </div>
                                </div>
                                <p className="text-slate-300 text-sm">Record ho raha hai...</p>
                            </div>
                        )}

                        {/* ═══ ALREADY DONE ══════════════════════════════════ */}
                        {isPunchedOut && punchState !== 'success' && (
                            <div className="py-5 text-center space-y-3">
                                <div className="w-16 h-16 mx-auto rounded-full bg-slate-700/50 border-2 border-slate-600 flex items-center justify-center">
                                    <CheckCircle className="w-8 h-8 text-slate-400" />
                                </div>
                                <div>
                                    <p className="text-white font-bold text-sm">Aaj ka Attendance Complete!</p>
                                    <p className="text-slate-500 text-xs mt-1">Wapas kal milenge 👋</p>
                                </div>
                                <div className="flex gap-2 justify-center">
                                    <div className="flex flex-col items-center bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2">
                                        <span className="text-[10px] text-slate-500 uppercase tracking-wide">Punch In</span>
                                        <span className="text-green-400 font-mono text-sm font-bold mt-0.5">
                                            {todayRecord?.checkIn ? new Date(todayRecord.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col items-center bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
                                        <span className="text-[10px] text-slate-500 uppercase tracking-wide">Punch Out</span>
                                        <span className="text-red-400 font-mono text-sm font-bold mt-0.5">
                                            {todayRecord?.checkOut ? new Date(todayRecord.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                        </span>
                                    </div>
                                </div>
                                {todayRecord?.checkIn && todayRecord?.checkOut && (
                                    <p className="text-slate-400 text-xs">
                                        ⏱ Total: <span className="text-white font-semibold">{calcWorkedHours(todayRecord.checkIn, todayRecord.checkOut)}</span>
                                    </p>
                                )}
                            </div>
                        )}

                        {/* ═══ PIN MODE ═══════════════════════════════════ */}
                        {!isPunchedOut && punchState === 'idle' && activeMode === 'pin' && (
                            <div className="space-y-4">
                                {/* PIN dots indicator */}
                                <div className="flex items-center justify-center gap-3">
                                    {[0, 1, 2, 3].map(i => (
                                        <div
                                            key={i}
                                            className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${pinValue.length > i
                                                ? 'bg-amber-400 border-amber-400 scale-110'
                                                : 'bg-transparent border-slate-600'
                                                }`}
                                        />
                                    ))}
                                </div>
                                {/* Error */}
                                {pinError && (
                                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                                        <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                        <span className="text-red-300 text-xs">{pinError}</span>
                                    </div>
                                )}
                                {/* Numpad */}
                                <div className="grid grid-cols-3 gap-2">
                                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'DEL'].map(k => (
                                        k === '' ? <div key="empty" /> : (
                                            <button
                                                key={k}
                                                onClick={() => handlePinKey(k)}
                                                className={`py-3.5 rounded-xl font-bold text-base transition-all duration-150 active:scale-95 ${k === 'DEL'
                                                    ? 'bg-slate-700/60 text-red-400 hover:bg-red-500/20 text-sm'
                                                    : 'bg-slate-800/60 text-white hover:bg-amber-500/20 hover:text-amber-300 border border-slate-700/40'
                                                    }`}
                                            >
                                                {k}
                                            </button>
                                        )
                                    ))}
                                </div>
                                {/* Punch button for PIN (fallback manual submit) */}
                                <button
                                    onClick={() => doPunch()}
                                    disabled={pinValue.length < 4}
                                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all shadow-lg shadow-amber-900/30"
                                >
                                    <Hash className="w-4 h-4" />
                                    {!isPunchedIn ? 'PIN se Punch In' : 'PIN se Punch Out'}
                                </button>
                            </div>
                        )}

                        {/* ═══ FACE MODE ═════════════════════════════════════ */}
                        {!isPunchedOut && punchState === 'idle' && activeMode === 'face' && (
                            <>
                                {cameraError ? (
                                    <div className="space-y-2.5">
                                        <div className="bg-red-500/10 border border-red-500/25 rounded-2xl px-3.5 py-3 flex items-start gap-2.5">
                                            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-red-300 text-xs font-bold">Camera Access Denied</p>
                                                <p className="text-red-400/60 text-[11px] mt-0.5">🔒 Browser padlock → Camera → Allow → Page refresh</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={startCamera}
                                            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-slate-600/40"
                                        >
                                            <RefreshCw className="w-3.5 h-3.5" /> Camera Retry Karo
                                        </button>
                                        {/* Hint to switch mode — NO bypass allowed */}
                                        {enabledModes.length > 1 && (
                                            <p className="text-center text-[11px] text-slate-600">
                                                💡 Upar se <span className="text-slate-400 font-semibold">Fingerprint</span> ya <span className="text-slate-400 font-semibold">Photo Upload</span> mode try karein
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        {/* Camera preview */}
                                        <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video border border-slate-700/50">
                                            {capturedPhoto
                                                ? <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover" />
                                                : <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                                            }
                                            {/* Overlay: face guide or check */}
                                            {capturedPhoto
                                                ? <FaceScanOverlay scanned={true} />
                                                : <FaceScanOverlay scanned={false} />
                                            }
                                            {/* Retake button */}
                                            {capturedPhoto && (
                                                <button
                                                    onClick={() => { setCapturedPhoto(null); }}
                                                    className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5 border border-white/10 hover:bg-black/80 transition-all"
                                                >
                                                    <RefreshCw className="w-3 h-3" /> Retake
                                                </button>
                                            )}
                                        </div>
                                        <canvas ref={canvasRef} className="hidden" />

                                        {/* Face mode: registration-first + auto-match */}
                                        {(() => {
                                            const isFaceReg = myEmployee ? biometricStore.isFaceRegistered(myEmployee.id) : false;

                                            // Model loading in progress
                                            if (faceHookStatus === 'loading_models') return (
                                                <div className="space-y-2 py-2">
                                                    <p className="text-xs text-slate-400 flex items-center gap-2">
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        Face AI load ho raha hai... {modelLoadProgress}%
                                                    </p>
                                                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                                        <div className="bg-gradient-to-r from-blue-500 to-cyan-400 h-1.5 rounded-full transition-all duration-500" style={{ width: `${modelLoadProgress}%` }} />
                                                    </div>
                                                    <p className="text-[10px] text-slate-600 text-center">Neural network models download ho rahe hain</p>
                                                </div>
                                            );

                                            // Model load error
                                            if (faceHookStatus === 'error' && faceHookError) return (
                                                <div className="space-y-2.5">
                                                    <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-3.5 py-3 flex items-start gap-2.5">
                                                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                                        <div>
                                                            <p className="text-red-300 text-xs font-bold">Face AI Load Failed</p>
                                                            <p className="text-red-400/60 text-[11px] mt-0.5">{faceHookError}</p>
                                                        </div>
                                                    </div>
                                                    <button onClick={retryLoadModels} className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-slate-600/40">
                                                        <RefreshCw className="w-3.5 h-3.5" /> Retry Load Models
                                                    </button>
                                                </div>
                                            );

                                            if (!isFaceReg) {
                                                return (
                                                    <div className="space-y-3">
                                                        <div className="bg-blue-500/10 border border-blue-500/25 rounded-2xl px-4 py-3 text-xs text-blue-300 space-y-1">
                                                            <p className="font-bold flex items-center gap-1.5"><UserPlus className="w-3.5 h-3.5" /> Pehli Baar Face Register Karein</p>
                                                            <p className="text-blue-400/70">Camera ke saamne sone par baitho. 5 photos li jaayengi. Baad mein sirf chehra dikhane se punch ho jayega.</p>
                                                        </div>
                                                        {bioError && <p className="text-red-400 text-xs px-1">{bioError}</p>}
                                                        <button onClick={registerFace} disabled={bioStep === 'registering'}
                                                            className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:brightness-110 disabled:opacity-60 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-blue-900/40">
                                                            {bioStep === 'registering'
                                                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Registering... ({faceRegProgress}%)</>
                                                                : <><ScanFace className="w-4 h-4" /> Face Register Karein</>}
                                                        </button>
                                                    </div>
                                                );
                                            }
                                            // Registered — show live match status + confidence
                                            return (
                                                <div className="space-y-3">
                                                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${faceMatchStatus === 'matched' ? 'bg-green-500/15 border border-green-500/30 text-green-400' :
                                                        faceMatchStatus === 'scanning' ? 'bg-slate-800/60 border border-slate-700/40 text-slate-400' :
                                                            faceMatchStatus === 'mismatch' ? 'bg-red-500/10 border border-red-500/20 text-red-400' :
                                                                faceMatchStatus === 'too_far' ? 'bg-orange-500/10 border border-orange-500/20 text-orange-400' :
                                                                    'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'}`}>
                                                        {faceMatchStatus === 'matched' && <><CheckCircle className="w-3.5 h-3.5" /> Match! ({faceConfidence}%) Punch ho raha hai...</>}
                                                        {faceMatchStatus === 'scanning' && <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Chehra dhundh raha hai...</>}
                                                        {faceMatchStatus === 'no_face' && <><ScanFace className="w-3.5 h-3.5 animate-pulse" /> Camera ke saamne aayein</>}
                                                        {faceMatchStatus === 'mismatch' && <><AlertCircle className="w-3.5 h-3.5" /> Chehra match nahi hua {faceConfidence > 0 ? `(${faceConfidence}%)` : ''}</>}
                                                        {faceMatchStatus === 'too_far' && <><ScanFace className="w-3.5 h-3.5" /> Camera ke thoda paas aayein</>}
                                                    </div>
                                                    {faceMatchStatus !== 'scanning' && faceMatchStatus !== 'no_face' && faceMatchStatus !== 'too_far' && faceConfidence > 0 && (
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between text-[10px] text-slate-500">
                                                                <span>Match Confidence</span>
                                                                <span className={faceConfidence >= 60 ? 'text-green-400' : faceConfidence >= 30 ? 'text-yellow-400' : 'text-red-400'}>{faceConfidence}%</span>
                                                            </div>
                                                            <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                                                                <div className={`h-1 rounded-full transition-all duration-300 ${faceConfidence >= 60 ? 'bg-green-500' : faceConfidence >= 30 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${faceConfidence}%` }} />
                                                            </div>
                                                        </div>
                                                    )}
                                                    {bioStep !== 'auto_matching' && bioStep !== 'verified' && (
                                                        <button onClick={startFaceAutoMatch} className="w-full py-3 bg-gradient-to-r from-blue-700 to-cyan-700 hover:brightness-110 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-blue-900/40">
                                                            <ScanFace className="w-4 h-4" /> Face Scan Shuru Karo
                                                        </button>
                                                    )}
                                                    <button onClick={async () => { await biometricStore.clearFaceDescriptor(myEmployee!.id); stopMatchLoop(); setBioStep('check'); }}
                                                        className="w-full py-1.5 text-slate-600 hover:text-red-400 text-[11px] transition-colors flex items-center justify-center gap-1">
                                                        <Trash2 className="w-3 h-3" /> Face reset karein
                                                    </button>
                                                </div>
                                            );
                                        })()}
                                    </>
                                )}
                            </>
                        )}

                        {/* ═══ FINGERPRINT MODE ══════════════════════════════ */}
                        {!isPunchedOut && punchState === 'idle' && activeMode === 'fingerprint' && (() => {
                            const isRegistered = myEmployee ? biometricStore.isThumbRegistered(myEmployee.id) : false;
                            return (
                                <>
                                    <FingerprintScanner
                                        scanning={thumbScanning}
                                        progress={thumbProgress}
                                        verified={capturedPhoto === 'THUMB_VERIFIED'}
                                    />

                                    {/* Error / bio error */}
                                    {(bioError || cameraError) && !thumbScanning && capturedPhoto !== 'THUMB_VERIFIED' && (
                                        <div className="space-y-2">
                                            <div className="bg-red-500/10 border border-red-500/25 rounded-2xl px-3.5 py-3 flex items-start gap-2.5">
                                                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                                <p className="text-red-300 text-xs">{bioError || cameraError}</p>
                                            </div>
                                            <button onClick={() => { setBioError(null); isRegistered ? verifyThumb() : registerThumb(); }}
                                                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-slate-600/40">
                                                <Fingerprint className="w-3.5 h-3.5" /> Dobara Try Karo
                                            </button>
                                        </div>
                                    )}

                                    {capturedPhoto === 'THUMB_VERIFIED' ? (
                                        /* ✅ Verified — punch button */
                                        <button onClick={() => doPunch()}
                                            className={`w-full py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm hover:brightness-110 ${!isPunchedIn
                                                ? 'bg-gradient-to-r from-emerald-600 to-green-500 text-white shadow-lg shadow-green-700/30'
                                                : 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-700/30'}`}>
                                            {!isPunchedIn ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                                            {!isPunchedIn ? '✅ Thumb se Punch In' : '🔴 Thumb se Punch Out'}
                                        </button>
                                    ) : !bioError && !cameraError && (
                                        <>
                                            {!isRegistered ? (
                                                /* 🆕 First time — show registration UI */
                                                <div className="space-y-3">
                                                    <div className="bg-indigo-500/10 border border-indigo-500/25 rounded-2xl px-4 py-3 text-xs text-indigo-300 space-y-1">
                                                        <p className="font-bold flex items-center gap-1.5"><UserPlus className="w-3.5 h-3.5" /> Pehli Baar Setup Karein</p>
                                                        <p className="text-indigo-400/70">Aapka fingerprint ek baar register hoga. Baad mein sirf thumb rakhne se punch ho jayega.</p>
                                                    </div>
                                                    <button onClick={registerThumb} disabled={thumbScanning}
                                                        className="w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:brightness-110 disabled:opacity-60 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-indigo-900/40">
                                                        {thumbScanning
                                                            ? <><Fingerprint className="w-4 h-4 animate-pulse" /><span className="animate-pulse">Phone fingerprint sensor chhu karein...</span></>
                                                            : <><UserPlus className="w-4 h-4" /> Fingerprint Register Karein</>}
                                                    </button>
                                                </div>
                                            ) : (
                                                /* 🔄 Registered — verify button */
                                                <button onClick={verifyThumb} disabled={thumbScanning}
                                                    className="w-full py-3 bg-gradient-to-r from-blue-700 to-indigo-700 hover:brightness-110 disabled:opacity-60 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-indigo-900/40">
                                                    {thumbScanning
                                                        ? <><Fingerprint className="w-4 h-4 animate-pulse text-blue-300" /><span className="animate-pulse">Phone fingerprint sensor chhu karein...</span></>
                                                        : <><Fingerprint className="w-4 h-4" /> Thumb Scan Karein</>}
                                                </button>
                                            )}
                                            {/* Re-register option */}
                                            {isRegistered && !thumbScanning && (
                                                <button onClick={() => { biometricStore.clearThumbCredential(myEmployee!.id); setBioStep('register_intro'); }}
                                                    className="w-full py-1.5 text-slate-600 hover:text-red-400 text-[11px] transition-colors flex items-center justify-center gap-1">
                                                    <Trash2 className="w-3 h-3" /> Fingerprint reset karein
                                                </button>
                                            )}
                                        </>
                                    )}
                                </>
                            );
                        })()}



                        {/* ═══ LIVE SELFIE MODE (photoUpload) ════════════════════ */}
                        {!isPunchedOut && punchState === 'idle' && activeMode === 'photoUpload' && (
                            <>
                                {cameraError ? (
                                    <div className="space-y-2.5">
                                        <div className="bg-red-500/10 border border-red-500/25 rounded-2xl px-3.5 py-3 flex items-start gap-2.5">
                                            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-red-300 text-xs font-bold">Camera Access Denied</p>
                                                <p className="text-red-400/60 text-[11px] mt-0.5">🔒 Browser settings mein Camera Allow karein</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={startCamera}
                                            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-slate-600/40"
                                        >
                                            <RefreshCw className="w-3.5 h-3.5" /> Camera Retry Karo
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {/* Live selfie preview */}
                                        <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video border border-slate-700/50">
                                            {capturedPhoto
                                                ? <img src={capturedPhoto} alt="Selfie" className="w-full h-full object-cover" />
                                                : <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                                            }
                                            {/* Selfie ring guide */}
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <div className={`w-28 h-28 rounded-full border-2 border-dashed transition-all duration-500 ${capturedPhoto ? 'border-green-400/70' : 'border-violet-400/50 animate-pulse'}`} />
                                                {capturedPhoto && (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <CheckCircle className="w-10 h-10 text-green-400 drop-shadow-lg" />
                                                    </div>
                                                )}
                                            </div>
                                            {capturedPhoto && (
                                                <button
                                                    onClick={() => setCapturedPhoto(null)}
                                                    className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5 border border-white/10 hover:bg-black/80 transition-all"
                                                >
                                                    <RefreshCw className="w-3 h-3" /> Retake
                                                </button>
                                            )}
                                        </div>
                                        <canvas ref={canvasRef} className="hidden" />

                                        {!capturedPhoto ? (
                                            <button
                                                onClick={capturePhoto}
                                                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 border border-slate-600/40 hover:border-slate-500"
                                            >
                                                <Camera className="w-4 h-4" /> 📸 Live Selfie Lo
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => doPunch()}
                                                className={`w-full py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm hover:brightness-110 ${!isPunchedIn
                                                    ? 'bg-gradient-to-r from-emerald-600 to-green-500 text-white shadow-lg shadow-green-700/30'
                                                    : 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-700/30'
                                                    }`}
                                            >
                                                {!isPunchedIn ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                                                {!isPunchedIn ? '✅ Selfie se Punch In' : '🔴 Selfie se Punch Out'}
                                            </button>
                                        )}
                                    </>
                                )}
                            </>
                        )}

                        {/* ═══ TODAY TIMELINE + BREAK ══════════════════════ */}
                        {todayRecord?.checkIn && !isPunchedOut && punchState === 'idle' && (
                            <div className="space-y-2">
                                {/* In/Out strip */}
                                <div className="flex items-center gap-2 bg-slate-800/50 rounded-xl px-3.5 py-2.5 border border-slate-700/40">
                                    <div className="flex flex-col items-center gap-0.5">
                                        <span className="text-[9px] text-slate-500 uppercase tracking-widest">In</span>
                                        <span className="text-green-400 font-mono text-xs font-bold">
                                            {new Date(todayRecord.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div className="flex-1 flex items-center gap-1">
                                        <div className="h-px flex-1 bg-slate-600" />
                                        {isOnBreak
                                            ? <Coffee className="w-3 h-3 text-amber-400 animate-pulse" />
                                            : <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
                                        <div className="h-px flex-1 bg-slate-700" />
                                    </div>
                                    <div className="flex flex-col items-center gap-0.5">
                                        <span className="text-[9px] text-slate-500 uppercase tracking-widest">Out</span>
                                        <span className="text-slate-600 font-mono text-xs font-bold">--:--</span>
                                    </div>
                                </div>

                                {/* Break history pills */}
                                {todayBreaks.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {todayBreaks.map((b, i) => (
                                            <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[10px] text-amber-400 font-mono">
                                                <Coffee className="w-2.5 h-2.5" />
                                                {new Date(b.start).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                {b.end ? ` → ${new Date(b.end).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ' (ongoing)'}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Break toggle button */}
                                <button
                                    onClick={handleBreak}
                                    className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${isOnBreak
                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30'
                                        : 'bg-slate-800/60 text-slate-400 border-slate-700/40 hover:text-amber-400 hover:border-amber-500/30'
                                        }`}
                                >
                                    <Coffee className="w-3.5 h-3.5" />
                                    {isOnBreak ? '⏹ Break End Karo' : '☕ Break Start Karo'}
                                </button>
                            </div>
                        )}

                    </div>
                </div>
            )}
        </>
    );
};
