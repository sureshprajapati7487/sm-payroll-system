// useFaceRecognition — upgraded face-api.js wrapper
// Improvements over v1:
//   1. Higher inputSize (320) for better detection accuracy
//   2. Lower scoreThreshold (0.35) — catches more faces in low light
//   3. Multi-frame confidence averaging (requires 2 consecutive matches before accepting)
//   4. Configurable Euclidean distance threshold (default 0.52, slightly relaxed)
//   5. Model loading progress tracking (0→33→66→100)
//   6. Retry capability on load failure
//   7. Confidence % score exposed for UI feedback
//   8. Face alignment quality check (size filter to reject tiny/far faces)

import { useState, useCallback, useRef } from 'react';
import * as faceapi from 'face-api.js';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/';

// Accuracy-tuned constants
const DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({
    inputSize: 224,         // Fast performance, decent accuracy default
    scoreThreshold: 0.25,  // Relaxed threshold to detect faces quickly even in lower light
});
const MATCH_THRESHOLD = 0.45; // Euclidean distance
const MIN_FACE_SIZE_PX = 80;   // Reject faces that are too small (too far from camera)
const LOOP_INTERVAL_MS = 600;  // Faster loop
const CONFIRM_FRAMES = 2;    // Require N consecutive matches to prevent false positives

export type FaceMatchStatus = 'idle' | 'loading_models' | 'detecting' | 'matched' | 'no_face' | 'mismatch' | 'too_far' | 'error';

export interface FaceMatchResult {
    matched: boolean;
    confidence: number; // 0–100, derived from Euclidean distance
    status: FaceMatchStatus;
    reason?: string;
}

export function useFaceRecognition() {
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [loadProgress, setLoadProgress] = useState(0);  // 0–100
    const [status, setStatus] = useState<FaceMatchStatus>('idle');
    const [confidence, setConfidence] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const matchLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const consecutiveHitsRef = useRef(0);  // for multi-frame confirmation

    // ── Load models from CDN with progress steps ──────────────────────────────
    const loadModels = useCallback(async (): Promise<boolean> => {
        if (modelsLoaded) return true;
        setStatus('loading_models');
        setError(null);
        setLoadProgress(0);
        try {
            // Load models sequentially so we can track progress
            await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
            setLoadProgress(33);
            await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
            setLoadProgress(66);
            await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
            setLoadProgress(100);
            setModelsLoaded(true);
            setStatus('idle');
            return true;
        } catch (e: any) {
            const msg = 'Face AI models load nahi hue. Internet check karein.';
            setError(msg);
            setStatus('error');
            setLoadProgress(0);
            console.error('[FaceRecognition] Model load failed:', e);
            return false;
        }
    }, [modelsLoaded]);

    // ── Retry model loading ────────────────────────────────────────────────────
    const retryLoadModels = useCallback(async (): Promise<boolean> => {
        setModelsLoaded(false);
        faceapi.nets.tinyFaceDetector.dispose?.();
        faceapi.nets.faceLandmark68TinyNet.dispose?.();
        faceapi.nets.faceRecognitionNet.dispose?.();
        return loadModels();
    }, [loadModels]);

    // ── Euclidean distance between two descriptors ─────────────────────────────
    const euclideanDistance = (a: Float32Array, b: Float32Array): number => {
        let sum = 0;
        for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
        return Math.sqrt(sum);
    };

    // Convert distance to confidence % (0=perfect, 1=totally different)
    const distanceToConfidence = (dist: number): number => {
        // dist 0.0 → 100%, dist 0.52 → 0%, anything beyond → negative (clamped)
        return Math.max(0, Math.round(((MATCH_THRESHOLD - dist) / MATCH_THRESHOLD) * 100));
    };

    // ── Get face descriptor from a video element ───────────────────────────────
    // Returns descriptor + quality info (face size)
    const getDescriptor = useCallback(async (
        videoEl: HTMLVideoElement
    ): Promise<{ descriptor: Float32Array; faceSize: number; box?: any } | null> => {
        if (!modelsLoaded) return null;
        try {
            const detection = await faceapi
                .detectSingleFace(videoEl, DETECTOR_OPTIONS)
                .withFaceLandmarks(true)
                .withFaceDescriptor();
            if (!detection) return null;
            const box = detection.detection.box;
            const faceSize = Math.min(box.width, box.height);
            return { descriptor: detection.descriptor, faceSize, box };
        } catch {
            return null;
        }
    }, [modelsLoaded]);

    // ── Match two descriptors with confidence score ────────────────────────────
    const matchDescriptor = useCallback((
        stored: Float32Array,
        current: Float32Array
    ): FaceMatchResult => {
        const dist = euclideanDistance(stored, current);
        const conf = distanceToConfidence(dist);
        const matched = dist < MATCH_THRESHOLD;
        return {
            matched,
            confidence: conf,
            status: matched ? 'matched' : 'mismatch',
            reason: matched ? undefined : `Distance ${dist.toFixed(3)} > ${MATCH_THRESHOLD}`,
        };
    }, []);

    // ── Stop the match loop ───────────────────────────────────────────────────
    const stopMatchLoop = useCallback(() => {
        if (matchLoopRef.current !== null) {
            clearTimeout(matchLoopRef.current);
            matchLoopRef.current = null;
        }
        consecutiveHitsRef.current = 0;
    }, []);

    // ── Start continuous face match loop with multi-frame confirmation ─────────
    const startMatchLoop = useCallback((
        videoEl: HTMLVideoElement,
        storedDescriptor: Float32Array,
        onMatch: (confidence: number) => void,
        onNoFace?: () => void,
        onMismatch?: (confidence: number) => void,
    ) => {
        stopMatchLoop();
        consecutiveHitsRef.current = 0;

        const loop = async () => {
            if (!videoEl || videoEl.readyState < 2) {
                matchLoopRef.current = window.setTimeout(loop, 500) as any;
                return;
            }
            try {
                setStatus('detecting');
                const result = await faceapi
                    .detectSingleFace(videoEl, DETECTOR_OPTIONS)
                    .withFaceLandmarks(true)
                    .withFaceDescriptor();

                if (!result) {
                    consecutiveHitsRef.current = 0;
                    setStatus('no_face');
                    setConfidence(0);
                    onNoFace?.();
                } else {
                    const box = result.detection.box;
                    const faceSize = Math.min(box.width, box.height);

                    // Reject if face is too far/small
                    if (faceSize < MIN_FACE_SIZE_PX) {
                        consecutiveHitsRef.current = 0;
                        setStatus('too_far');
                        setConfidence(0);
                        matchLoopRef.current = window.setTimeout(loop, LOOP_INTERVAL_MS) as any;
                        return;
                    }

                    const dist = euclideanDistance(storedDescriptor, result.descriptor);
                    const conf = distanceToConfidence(dist);
                    setConfidence(conf);

                    if (dist < MATCH_THRESHOLD) {
                        consecutiveHitsRef.current++;
                        setStatus('matched');

                        if (consecutiveHitsRef.current >= CONFIRM_FRAMES) {
                            // ✅ Confirmed match — stop loop and call onMatch
                            stopMatchLoop();
                            onMatch(conf);
                            return;
                        }
                        // Still waiting for more confirming frames — don't stop yet
                    } else {
                        consecutiveHitsRef.current = 0;
                        setStatus('mismatch');
                        onMismatch?.(conf);
                    }
                }
            } catch {
                // Ignore transient frame errors
            }
            matchLoopRef.current = window.setTimeout(loop, LOOP_INTERVAL_MS) as any;
        };
        loop();
    }, [modelsLoaded, stopMatchLoop]);

    return {
        modelsLoaded,
        loadProgress,
        status,
        confidence,
        error,
        loadModels,
        retryLoadModels,
        getDescriptor,
        matchDescriptor,
        startMatchLoop,
        stopMatchLoop,
        MATCH_THRESHOLD,
    };
}
