# Product Requirements Document (PRD)
## Feature: Face Scan Modal Real AI Integration

### Background
Currently, the `FaceScanModal.tsx` on the web dashboard uses **simulated (dummy) fake logic** where it waits for a timeout and automatically returns "SUCCESS". To provide real biometric security, it needs to be integrated with the existing `useFaceRecognition` AI hook to do a strict 1:1 match against the logged-in user's enrolled face descriptor.

---

### SECTION 1: Face AI Integration (Priority: Blocker)

#### 1.1 — Replace Fake Logic with AI Matching
- **Problem**: `FaceScanModal.tsx` uses a `setTimeout` to simulate verification.
- **Fix**: 
  - Import `useFaceRecognition`, `useAuthStore`, and `biometricStore`.
  - On component mount, call `loadModels()` from the hook to load the AI.
  - Check if `biometricStore.getFaceDescriptor(user.id)` returns a valid `Float32Array`. If not, the user is not enrolled. Display an error message blocking the scan.
  - In `startScan()`, instead of a `setInterval`, call `startMatchLoop` passing the `webcamRef.current.video` and the stored descriptor.
  - `startMatchLoop` automatically handles `onMatch` (success), `onNoFace`, and `onMismatch`.

#### 1.2 — UI State Management
- Handle the `modelsLoaded` state. Show a loading indicator (`loadProgress`) while the AI models are downloading over the network.
- Display real-time feedback during the scanning process (e.g. "Looking for face", "No match found", "Success!").
- Do not remove the `Webcam` component. The AI hook relies on the `<video>` element rendered by `react-webcam`.

---

### Files to Modify
1. `src/components/attendance/FaceScanModal.tsx`

### Success Criteria
- If a user hasn't enrolled their face via the Kiosk `Enroll` tab, the dashboard `FaceScanModal` should reject them safely without crashing.
- Scanning must require the actual user's face to match the stored AI descriptor before `onSuccess` is triggered.
- No `setTimeout` fake success simulation.
- Zero TypeScript errors.
