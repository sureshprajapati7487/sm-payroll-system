# AI Agent Instructions for FaceScanModal AI Integration
## SM PAYROLL SYSTEM — Ralph Loop Task 4

---

## Project Overview
- **Framework**: React 18 + TypeScript + Vite
- **AI Library**: face-api.js (via `useFaceRecognition` hook)
- **State**: Zustand (Need to properly call hooks)

---

## Files You Will Be Editing

| File | Purpose |
|------|---------|
| `src/components/attendance/FaceScanModal.tsx` | Integrate real AI face matching, remove the fake 3-second simulation. |

---

## Step-by-Step Implementation (Follow Exactly)

### STEP 1 — Add Required Imports
**File**: `src/components/attendance/FaceScanModal.tsx`

At the top of the file, add the following imports just under the existing imports:
```tsx
import { useAuthStore } from '@/store/authStore';
import { useFaceRecognition } from '@/hooks/useFaceRecognition';
import { biometricStore } from '@/store/biometricStore';
```

**Log to progress.txt**: `[STEP 1 DONE] Added required imports`


### STEP 2 — Setup AI Hook & User State
Inside the `FaceScanModal` component (around line 17, before `useEffect`), add:

```tsx
    const { user } = useAuthStore();
    const { loadModels, modelsLoaded, startMatchLoop, stopMatchLoop, loadProgress, error } = useFaceRecognition();
    
    // Load models when modal opens
    useEffect(() => {
        if (isOpen) {
            loadModels();
        } else {
            stopMatchLoop();
        }
    }, [isOpen, loadModels, stopMatchLoop]);

    const storedDescriptor = user ? biometricStore.getFaceDescriptor(user.id) : null;
    const isEnrolled = !!storedDescriptor;
```

**Log to progress.txt**: `[STEP 2 DONE] Configured useFaceRecognition and auth state`


### STEP 3 — Replace Fake Scanning with Real AI MatchLoop
Find the `startScan = useCallback(() => { ... })` function (around line 26). Delete the entire `let progress = 0; setInterval(...)` dummy logic inside it. 
Replace the whole `startScan` function with this:

```tsx
    const startScan = useCallback(() => {
        if (!webcamRef.current?.video || !storedDescriptor) return;
        setStep('SCANNING');

        startMatchLoop(
            webcamRef.current.video,
            storedDescriptor,
            (conf) => {
                // Success Match
                setStep('SUCCESS');
                const imageSrc = webcamRef.current?.getScreenshot();
                setTimeout(() => {
                    if (imageSrc) onSuccess(imageSrc);
                    onClose();
                }, 1500);
            },
            () => {
                // No Face Detected (loop continues automatically)
                setScanProgress(0);
            },
            (conf) => {
                // Face detected but mismatch (loop continues automatically)
                setScanProgress(conf);
            }
        );
    }, [onSuccess, onClose, startMatchLoop, storedDescriptor]);
```

**Log to progress.txt**: `[STEP 3 DONE] Integrated startMatchLoop with real AI logic`


### STEP 4 — Update UI for AI Status & Enrollment Check
In the JSX return block:

1. Locate the `Footer Controls` section (around line 116).
2. Right below the `Footer Controls` div declaration, add a check for enrollment and AI loading:

Replace the `step === 'IDLE'` button block with:
```tsx
                    {!isEnrolled ? (
                        <div className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                            <p className="text-red-400 font-bold text-sm">Face Not Enrolled ❌</p>
                            <p className="text-red-300 text-xs mt-1">Please ask Admin to enroll your face from the Kiosk.</p>
                        </div>
                    ) : !modelsLoaded ? (
                        <div className="w-full flex-col flex items-center gap-2 p-2">
                            <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                            <p className="text-sm font-bold text-primary-400">Loading AI ({loadProgress}%)...</p>
                            {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
                        </div>
                    ) : step === 'IDLE' ? (
                        <button
                            onClick={startScan}
                            className="w-full py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-primary-600/20 flex items-center justify-center gap-2 transition-all"
                        >
                            <Camera className="w-5 h-5" />
                            Scan My Face
                        </button>
                    ) : null}
```

3. Locate the `step === 'SCANNING'` UI block and replace the hardcoded "Scanning generic features..." and progress bar with:
```tsx
                    {step === 'SCANNING' && (
                        <div className="w-full text-center">
                            <div className="text-sm font-bold text-primary-400 mb-2 animate-pulse">
                                Live AI Analysis Active...
                            </div>
                            <p className="text-xs text-dark-muted">Keep device steady and face camera.</p>
                            {(scanProgress > 0) && (
                                <p className="text-[10px] text-amber-500 mt-1">Match Confidence: {scanProgress}% (Needs &gt; 50%)</p>
                            )}
                        </div>
                    )}
```

**Log to progress.txt**: `[STEP 4 DONE] Updated UI to block non-enrolled users and show AI load states`

### STEP 5 — Final TypeScript Verification
Verify that your changes cause no syntax errors or unused variable warnings. Do NOT edit CSS styles outside of standard Tailwind.
**Log to progress.txt**: `[STEP 5 DONE] TypeScript verified`

---
## STRICT RULES
- ❌ Do NOT over-complicate the component by adding your own logic.
- ❌ Strictly use the `useFaceRecognition` hook provided.
- ❌ Provide exactly these functional updates to ensure real 1:1 biometric matching.
