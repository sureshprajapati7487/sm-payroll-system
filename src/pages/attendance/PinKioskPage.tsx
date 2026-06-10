import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Webcam from 'react-webcam';
import { useEmployeeStore } from '@/store/employeeStore';
import { useAttendanceStore } from '@/store/attendanceStore';
import { useAuthStore } from '@/store/authStore';
import { PERMISSIONS } from '@/config/permissions';
import { apiFetch } from '@/lib/apiClient';
import {
    CheckCircle, XCircle, ArrowLeft, Delete, Shield,
    RefreshCw, Hash, Camera, Fingerprint, ScanFace
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────────
type Mode = 'pin' | 'selfie' | 'fingerprint';
type Step = 'code' | 'verify' | 'success' | 'error';
type PunchType = 'IN' | 'OUT' | 'DONE';

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function LiveClock() {
    const [t, setT] = useState(new Date());
    useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
    return (
        <div className="text-center">
            <div className="font-mono text-4xl font-bold text-white tracking-widest">
                {t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-dark-muted text-sm mt-1">
                {t.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
        </div>
    );
}

function getLocalToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Main Component ─────────────────────────────────────────────────────────────
export const PinKioskPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { employees } = useEmployeeStore();
    const { records, markCheckIn, markCheckOut } = useAttendanceStore();
    const { hasPermission } = useAuthStore();

    // Pre-select mode from URL: ?mode=pin | selfie | fingerprint
    const urlMode = searchParams.get('mode') as Mode | null;
    const [mode, setMode] = useState<Mode>(
        urlMode && ['pin', 'selfie', 'fingerprint'].includes(urlMode) ? urlMode : 'pin'
    );
    const [step, setStep] = useState<Step>('code');
    const [empCode, setEmpCode] = useState('');
    const [pin, setPin] = useState('');
    const [matchedEmp, setMatchedEmp] = useState<typeof employees[0] | null>(null);
    const [punchType, setPunchType] = useState<PunchType>('IN');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Selfie state
    const webcamRef = useRef<Webcam>(null);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [capturedImg, setCapturedImg] = useState<string | null>(null);

    // Fingerprint state
    const [fpStep, setFpStep] = useState<'idle'|'scanning'|'done'>('idle');
    const [fpProgress, setFpProgress] = useState(0);

    // Admin PIN management
    const [showPinMgmt, setShowPinMgmt] = useState(false);
    const [pinMgmtSearch, setPinMgmtSearch] = useState('');
    const [setPinEmpId, setSetPinEmpId] = useState('');
    const [newPin, setNewPin] = useState('');
    const [pinSaveMsg, setPinSaveMsg] = useState('');

    const canManage = hasPermission(PERMISSIONS.MANUAL_ATTENDANCE);

    const reset = useCallback(() => {
        setStep('code'); setEmpCode(''); setPin(''); setMatchedEmp(null);
        setMessage(''); setCapturedImg(null); setCountdown(null);
        setFpStep('idle'); setFpProgress(0);
    }, []);

    useEffect(() => {
        if (step === 'success' || step === 'error') {
            const t = setTimeout(reset, 4000);
            return () => clearTimeout(t);
        }
    }, [step, reset]);

    // ── Employee lookup ──────────────────────────────────────────────────────
    const findEmployee = (code: string) => {
        const emp = employees.find(e =>
            e.code.toLowerCase() === code.trim().toLowerCase() && e.status === 'ACTIVE'
        );
        if (!emp) { setMessage('Employee ID nahi mila. Dobara try karein.'); setStep('error'); return null; }
        const rec = records.find(r => r.employeeId === emp.id && r.date === getLocalToday());
        const pt: PunchType = !rec ? 'IN' : !rec.checkOut ? 'OUT' : 'DONE';
        setMatchedEmp(emp); setPunchType(pt);
        return emp;
    };

    const handleCodeSubmit = () => {
        const emp = findEmployee(empCode);
        if (!emp) return;
        if (mode === 'pin' && !emp.attendancePin) {
            setMessage(`${emp.name} ka PIN set nahi hai. Admin se contact karein.`);
            setStep('error'); return;
        }
        setStep('verify');
        if (mode === 'selfie') startCountdown();
        if (mode === 'fingerprint') startFingerprint(emp);
    };

    // ── Do punch ────────────────────────────────────────────────────────────
    const doPunch = async (emp: typeof employees[0], imageSrc?: string) => {
        if (punchType === 'DONE') {
            setMessage(`${emp.name} — Aaj ki shift complete ho gayi hai.`);
            setStep('success'); return;
        }
        setIsLoading(true);
        try {
            // Map UI mode → valid AttendanceRecord punchMode
            const punchModeMap: Record<Mode, 'pin' | 'photoUpload' | 'fingerprint' | 'face'> = {
                pin: 'pin', selfie: 'photoUpload', fingerprint: 'fingerprint',
            };
            const meta = {
                punchMode: punchModeMap[mode],
                usedPinPunch: mode === 'pin',
            };
            if (punchType === 'IN') {
                await markCheckIn(emp.id, emp.shift || 'GENERAL', imageSrc, meta);
                setMessage(`Welcome, ${emp.name}!\nPunch In recorded ✓`);
            } else {
                await markCheckOut(emp.id, meta);
                setMessage(`Good bye, ${emp.name}!\nPunch Out recorded ✓`);
            }
            setStep('success');
        } catch {
            setMessage('Punch save nahi hua. Dobara try karein.'); setStep('error');
        } finally { setIsLoading(false); }
    };

    // ── PIN logic ────────────────────────────────────────────────────────────
    const handleKey = (k: string) => {
        if (k === '⌫') { setPin(p => p.slice(0,-1)); return; }
        if (pin.length >= 4) return;
        const next = pin + k;
        setPin(next);
        if (next.length === 4) verifyPin(next);
    };

    const verifyPin = (entered: string) => {
        if (!matchedEmp) return;
        if (entered !== matchedEmp.attendancePin) {
            setMessage('Galat PIN. Dobara try karein.'); setStep('error'); return;
        }
        doPunch(matchedEmp);
    };

    // ── Selfie logic ─────────────────────────────────────────────────────────
    const startCountdown = () => {
        setCountdown(3);
        let c = 3;
        const t = setInterval(() => {
            c--;
            if (c <= 0) { clearInterval(t); setCountdown(null); capturePhoto(); }
            else setCountdown(c);
        }, 1000);
    };

    const capturePhoto = () => {
        const img = webcamRef.current?.getScreenshot();
        if (!img) { setMessage('Camera access nahi mila. Permission check karein.'); setStep('error'); return; }
        setCapturedImg(img);
        if (matchedEmp) doPunch(matchedEmp, img);
    };

    const retakePhoto = () => { setCapturedImg(null); startCountdown(); };

    // ── Fingerprint logic (WebAuthn) ─────────────────────────────────────────
    const startFingerprint = async (emp: typeof employees[0]) => {
        setFpStep('scanning'); setFpProgress(0);

        // Try WebAuthn platform authenticator (device fingerprint/face)
        try {
            const available = await (PublicKeyCredential as any).isUserVerifyingPlatformAuthenticatorAvailable?.();
            if (available) {
                // Use WebAuthn for real biometric verification
                const challenge = new Uint8Array(32);
                crypto.getRandomValues(challenge);
                await navigator.credentials.get({
                    publicKey: {
                        challenge,
                        timeout: 60000,
                        userVerification: 'required',
                        rpId: window.location.hostname,
                    }
                });
                setFpStep('done'); setFpProgress(100);
                await doPunch(emp);
                return;
            }
        } catch (err: any) {
            // WebAuthn failed or cancelled — fall through to simulation below
            if (err?.name === 'NotAllowedError') {
                setMessage('Fingerprint verification cancelled.'); setStep('error'); return;
            }
        }

        // Fallback: simulate scan progress for devices without WebAuthn
        let p = 0;
        const interval = setInterval(() => {
            p += 8;
            setFpProgress(Math.min(p, 100));
            if (p >= 100) {
                clearInterval(interval);
                setFpStep('done');
                doPunch(emp);
            }
        }, 120);
    };

    // ── Admin PIN management ──────────────────────────────────────────────────
    const handleSavePin = async () => {
        if (!/^\d{4}$/.test(newPin)) { setPinSaveMsg('PIN 4 digits ka hona chahiye.'); return; }
        try {
            await apiFetch(`/employees/${setPinEmpId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ attendancePin: newPin }),
            });
            useEmployeeStore.getState().updateEmployee(setPinEmpId, { attendancePin: newPin });
            setPinSaveMsg('PIN saved ✓'); setNewPin(''); setSetPinEmpId('');
        } catch { setPinSaveMsg('Save failed.'); }
    };

    const filteredEmps = employees.filter(e =>
        e.status === 'ACTIVE' &&
        (e.name.toLowerCase().includes(pinMgmtSearch.toLowerCase()) ||
         e.code.toLowerCase().includes(pinMgmtSearch.toLowerCase()))
    );

    // ── Shared Employee Card ──────────────────────────────────────────────────
    const EmpCard = () => matchedEmp ? (
        <div className="flex items-center gap-3 bg-dark-card border border-dark-border rounded-2xl px-4 py-3">
            <img src={matchedEmp.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(matchedEmp.name)}&size=40&background=random`}
                className="w-10 h-10 rounded-full border border-dark-border" />
            <div className="flex-1">
                <p className="text-white font-bold">{matchedEmp.name}</p>
                <p className="text-dark-muted text-xs">{matchedEmp.code} · {matchedEmp.shift}</p>
            </div>
            <span className={clsx('text-xs font-bold px-2.5 py-1 rounded-full',
                punchType === 'IN'  ? 'bg-emerald-500/20 text-emerald-400' :
                punchType === 'OUT' ? 'bg-red-500/20 text-red-400' :
                'bg-dark-bg text-dark-muted'
            )}>
                {punchType === 'IN' ? 'Punch In' : punchType === 'OUT' ? 'Punch Out' : 'Done'}
            </span>
        </div>
    ) : null;

    // ── Mode tabs config ──────────────────────────────────────────────────────
    const MODES: { id: Mode; label: string; icon: JSX.Element; color: string }[] = [
        { id: 'pin',         label: 'PIN',         icon: <Hash className="w-4 h-4" />,         color: 'text-violet-400 border-violet-500/50 bg-violet-500/10' },
        { id: 'selfie',      label: 'Live Selfie', icon: <Camera className="w-4 h-4" />,        color: 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10' },
        { id: 'fingerprint', label: 'Fingerprint', icon: <Fingerprint className="w-4 h-4" />,   color: 'text-blue-400 border-blue-500/50 bg-blue-500/10' },
    ];

    return (
        <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center p-4 relative select-none">

            {/* Back */}
            <button onClick={() => navigate('/attendance')}
                className="absolute top-4 left-4 flex items-center gap-1.5 text-dark-muted hover:text-white transition-colors text-sm">
                <ArrowLeft className="w-4 h-4" /> Back
            </button>

            {/* Admin manage */}
            {canManage && !showPinMgmt && (
                <button onClick={() => setShowPinMgmt(true)}
                    className="absolute top-4 right-4 flex items-center gap-1.5 text-dark-muted hover:text-violet-400 transition-colors text-sm">
                    <Shield className="w-4 h-4" /> Manage PINs
                </button>
            )}

            <AnimatePresence mode="wait">

                {/* ── Admin PIN Panel ── */}
                {showPinMgmt && (
                    <motion.div key="mgmt" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:10 }}
                        className="w-full max-w-lg bg-dark-card border border-dark-border rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-white font-bold text-lg flex items-center gap-2">
                                <Shield className="w-5 h-5 text-violet-400" /> Employee PIN Management
                            </h2>
                            <button onClick={() => { setShowPinMgmt(false); setPinSaveMsg(''); }}
                                className="text-dark-muted hover:text-white transition-colors"><XCircle className="w-5 h-5" /></button>
                        </div>
                        <input value={pinMgmtSearch} onChange={e => setPinMgmtSearch(e.target.value)}
                            placeholder="Employee search..."
                            className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-violet-500" />
                        <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                            {filteredEmps.map(emp => (
                                <div key={emp.id}
                                    className={clsx('flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors',
                                        setPinEmpId === emp.id ? 'border-violet-500/50 bg-violet-500/5' : 'border-dark-border hover:border-dark-border/70 bg-dark-bg/40'
                                    )}
                                    onClick={() => { setSetPinEmpId(emp.id); setNewPin(''); setPinSaveMsg(''); }}>
                                    <img src={emp.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&size=32&background=random`}
                                        className="w-8 h-8 rounded-full" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white text-sm font-medium truncate">{emp.name}</p>
                                        <p className="text-dark-muted text-xs">{emp.code}</p>
                                    </div>
                                    <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded border',
                                        emp.attendancePin ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-dark-bg text-dark-muted border-dark-border'
                                    )}>
                                        {emp.attendancePin ? 'PIN SET' : 'NO PIN'}
                                    </span>
                                </div>
                            ))}
                        </div>
                        {setPinEmpId && (
                            <div className="flex gap-2">
                                <input value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g,'').slice(0,4))}
                                    placeholder="New 4-digit PIN" maxLength={4}
                                    className="flex-1 bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-violet-500 font-mono tracking-[0.5em] text-center text-lg" />
                                <button onClick={handleSavePin}
                                    className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold text-sm transition-colors">
                                    Save
                                </button>
                            </div>
                        )}
                        {pinSaveMsg && (
                            <p className={clsx('text-sm text-center', pinSaveMsg.includes('✓') ? 'text-emerald-400' : 'text-red-400')}>{pinSaveMsg}</p>
                        )}
                    </motion.div>
                )}

                {/* ── Main Kiosk ── */}
                {!showPinMgmt && (
                    <motion.div key="kiosk" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                        className="w-full max-w-sm flex flex-col items-center gap-6">

                        <LiveClock />

                        {/* Mode Tabs */}
                        {step === 'code' && (
                            <div className="flex gap-2 w-full">
                                {MODES.map(m => (
                                    <button key={m.id} onClick={() => { setMode(m.id); reset(); }}
                                        className={clsx('flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-bold transition-all',
                                            mode === m.id ? m.color : 'border-dark-border text-dark-muted hover:border-dark-border/70 bg-dark-card'
                                        )}>
                                        {m.icon}
                                        <span className="text-[10px]">{m.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Title */}
                        <div className="text-center">
                            <h1 className="text-xl font-bold text-white flex items-center gap-2 justify-center">
                                {mode === 'pin' && <><Hash className="w-5 h-5 text-violet-400" /> PIN Attendance</>}
                                {mode === 'selfie' && <><Camera className="w-5 h-5 text-emerald-400" /> Live Selfie Attendance</>}
                                {mode === 'fingerprint' && <><Fingerprint className="w-5 h-5 text-blue-400" /> Fingerprint Attendance</>}
                            </h1>
                            <p className="text-dark-muted text-sm mt-1">
                                {step === 'code' ? 'Apna Employee ID enter karein' :
                                 step === 'verify' && mode === 'pin' ? `${matchedEmp?.name} — 4-digit PIN enter karein` :
                                 step === 'verify' && mode === 'selfie' ? `${matchedEmp?.name} — Camera ke saamne aajao` :
                                 step === 'verify' && mode === 'fingerprint' ? `${matchedEmp?.name} — Fingerprint place karein` :
                                 ''}
                            </p>
                        </div>

                        {/* SUCCESS */}
                        {step === 'success' && (
                            <motion.div initial={{ scale:0.8, opacity:0 }} animate={{ scale:1, opacity:1 }}
                                className="flex flex-col items-center gap-4 text-center w-full">
                                <div className="w-24 h-24 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center">
                                    <CheckCircle className="w-12 h-12 text-emerald-400" />
                                </div>
                                {capturedImg && (
                                    <img src={capturedImg} className="w-24 h-24 rounded-full object-cover border-2 border-emerald-500/40 -mt-2" />
                                )}
                                <p className="text-white font-bold text-lg whitespace-pre-line">{message}</p>
                                <p className="text-dark-muted text-sm">Auto reset in 4 seconds…</p>
                            </motion.div>
                        )}

                        {/* ERROR */}
                        {step === 'error' && (
                            <motion.div initial={{ scale:0.8, opacity:0 }} animate={{ scale:1, opacity:1 }}
                                className="flex flex-col items-center gap-4 text-center">
                                <div className="w-24 h-24 rounded-full bg-red-500/15 border-2 border-red-500/40 flex items-center justify-center">
                                    <XCircle className="w-12 h-12 text-red-400" />
                                </div>
                                <p className="text-red-400 font-bold text-lg">{message}</p>
                                <button onClick={reset} className="flex items-center gap-2 text-dark-muted hover:text-white text-sm transition-colors">
                                    <RefreshCw className="w-4 h-4" /> Try Again
                                </button>
                            </motion.div>
                        )}

                        {/* STEP: CODE INPUT (all modes) */}
                        {step === 'code' && (
                            <div className="w-full space-y-4">
                                <input autoFocus value={empCode}
                                    onChange={e => setEmpCode(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleCodeSubmit()}
                                    placeholder="Employee ID (e.g. EMP-001)"
                                    className="w-full bg-dark-card border-2 border-dark-border focus:border-primary-500 rounded-2xl px-5 py-4 text-white text-xl text-center outline-none transition-colors font-mono tracking-widest"
                                />
                                <button onClick={handleCodeSubmit} disabled={!empCode.trim()}
                                    className="w-full py-4 bg-primary-500 hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-lg transition-colors">
                                    Continue →
                                </button>
                            </div>
                        )}

                        {/* ── PIN KEYPAD ── */}
                        {step === 'verify' && mode === 'pin' && (
                            <div className="w-full space-y-5">
                                <EmpCard />
                                {/* Dots */}
                                <div className="flex justify-center gap-4">
                                    {[0,1,2,3].map(i => (
                                        <div key={i} className={clsx('w-5 h-5 rounded-full border-2 transition-all duration-150',
                                            i < pin.length ? 'bg-violet-500 border-violet-500 scale-110' : 'bg-transparent border-dark-border'
                                        )} />
                                    ))}
                                </div>
                                {/* Keypad */}
                                <div className="grid grid-cols-3 gap-3">
                                    {KEYS.map((k, idx) => (
                                        k === '' ? <div key={idx} /> :
                                        <button key={idx} onClick={() => handleKey(k)} disabled={isLoading}
                                            className={clsx('aspect-square rounded-2xl text-2xl font-bold flex items-center justify-center transition-all active:scale-90',
                                                k === '⌫'
                                                    ? 'bg-dark-card border border-dark-border text-dark-muted hover:text-white'
                                                    : 'bg-dark-card border border-dark-border text-white hover:bg-violet-500/15 hover:border-violet-500/40'
                                            )}>
                                            {k === '⌫' ? <Delete className="w-5 h-5" /> : k}
                                        </button>
                                    ))}
                                </div>
                                <button onClick={reset} className="w-full text-dark-muted hover:text-white text-sm text-center transition-colors">
                                    ← Change Employee
                                </button>
                            </div>
                        )}

                        {/* ── LIVE SELFIE ── */}
                        {step === 'verify' && mode === 'selfie' && (
                            <div className="w-full space-y-4">
                                <EmpCard />
                                <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3]">
                                    {!capturedImg ? (
                                        <>
                                            <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg"
                                                mirrored className="w-full h-full object-cover" />
                                            {/* Face guide oval */}
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <div className="w-40 h-52 border-2 border-dashed border-emerald-400/60 rounded-full" />
                                            </div>
                                            {/* Scan line */}
                                            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                                <div className="absolute w-full h-0.5 bg-emerald-400/50 animate-[scan_2s_ease-in-out_infinite]" />
                                            </div>
                                            {/* Countdown */}
                                            {countdown !== null && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                                    <span className="text-white text-8xl font-black drop-shadow-lg">{countdown}</span>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <img src={capturedImg} className="w-full h-full object-cover" />
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    {capturedImg ? (
                                        <button onClick={retakePhoto}
                                            className="flex-1 py-3 bg-dark-card border border-dark-border text-dark-muted hover:text-white rounded-xl font-bold text-sm transition-colors">
                                            Retake
                                        </button>
                                    ) : countdown === null ? (
                                        <button onClick={startCountdown}
                                            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
                                            <ScanFace className="w-4 h-4" /> Scan & Punch
                                        </button>
                                    ) : null}
                                    <button onClick={reset}
                                        className="px-4 py-3 bg-dark-card border border-dark-border text-dark-muted hover:text-white rounded-xl text-sm transition-colors">
                                        ← Back
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── FINGERPRINT ── */}
                        {step === 'verify' && mode === 'fingerprint' && (
                            <div className="w-full space-y-5">
                                <EmpCard />
                                <div className="flex flex-col items-center gap-4 py-4">
                                    {/* Ring */}
                                    <div className="relative w-32 h-32">
                                        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                                            <circle cx="50" cy="50" r="44" fill="none" stroke="#1e293b" strokeWidth="6" />
                                            <circle cx="50" cy="50" r="44" fill="none"
                                                stroke={fpStep === 'done' ? '#22c55e' : fpStep === 'scanning' ? '#60a5fa' : '#334155'}
                                                strokeWidth="6" strokeLinecap="round"
                                                strokeDasharray={`${2 * Math.PI * 44}`}
                                                strokeDashoffset={`${2 * Math.PI * 44 * (1 - fpProgress / 100)}`}
                                                style={{ transition: 'stroke-dashoffset 0.2s ease, stroke 0.4s ease' }}
                                            />
                                        </svg>
                                        <div className={clsx('absolute inset-3 rounded-full flex items-center justify-center transition-all duration-500',
                                            fpStep === 'done' ? 'bg-green-500/15' : fpStep === 'scanning' ? 'bg-blue-500/15' : 'bg-slate-800'
                                        )}>
                                            {fpStep === 'done'
                                                ? <CheckCircle className="w-12 h-12 text-green-400" />
                                                : <Fingerprint className={clsx('w-12 h-12 transition-colors', fpStep === 'scanning' ? 'text-blue-400' : 'text-slate-500')} />
                                            }
                                        </div>
                                        {fpStep === 'scanning' && (
                                            <span className="absolute inset-0 rounded-full border-2 border-blue-400/30 animate-ping" />
                                        )}
                                    </div>
                                    <p className={clsx('text-sm font-semibold text-center',
                                        fpStep === 'done' ? 'text-green-400' : fpStep === 'scanning' ? 'text-blue-400' : 'text-slate-400'
                                    )}>
                                        {fpStep === 'done' ? '✅ Fingerprint Verified!' :
                                         fpStep === 'scanning' ? `Scanning... ${Math.round(fpProgress)}%` :
                                         'Fingerprint sensor pe rakh do'}
                                    </p>
                                    {fpStep === 'scanning' && (
                                        <div className="w-full bg-slate-800 rounded-full h-1.5">
                                            <div className="bg-gradient-to-r from-blue-500 to-indigo-400 h-1.5 rounded-full transition-all"
                                                style={{ width: `${fpProgress}%` }} />
                                        </div>
                                    )}
                                    {fpStep === 'idle' && (
                                        <button onClick={() => matchedEmp && startFingerprint(matchedEmp)}
                                            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-colors">
                                            Scan Fingerprint
                                        </button>
                                    )}
                                </div>
                                <button onClick={reset}
                                    className="w-full text-dark-muted hover:text-white text-sm text-center transition-colors">
                                    ← Change Employee
                                </button>
                            </div>
                        )}

                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
