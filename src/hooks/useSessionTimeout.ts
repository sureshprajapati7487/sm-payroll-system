// useSessionTimeout — FIXED: uses refs instead of useCallback chains
// This avoids the "Maximum update depth exceeded" infinite re-render loop.
// Strategy: All timer logic lives in plain functions stored in refs,
// so they never appear in useEffect/useCallback dependency arrays.

import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/authStore';

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;  // 30 minutes
const WARNING_BEFORE_MS = 2 * 60 * 1000;   // 2 minute warning

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

export const useSessionTimeout = (timeoutMs: number = DEFAULT_TIMEOUT_MS) => {
    const isAuthRef = useRef(false);
    const logoutRef = useRef<() => void>(() => { });

    // Sync auth state into refs (never causes re-renders through here)
    const isAuthenticated = useAuthStore(s => s.isAuthenticated);
    const logout = useAuthStore(s => s.logout);
    isAuthRef.current = isAuthenticated;
    logoutRef.current = logout;

    const [showWarning, setShowWarning] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(Math.floor(WARNING_BEFORE_MS / 1000));

    // All timer IDs stored in refs — no state, no deps
    const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const warningActiveRef = useRef(false);

    // ── clear everything ───────────────────────────────────────────────────────
    const clearAll = () => {
        if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
        if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
        warnTimerRef.current = null;
        logoutTimerRef.current = null;
        countdownRef.current = null;
    };

    // ── do the actual logout ───────────────────────────────────────────────────
    const doLogout = () => {
        clearAll();
        warningActiveRef.current = false;
        setShowWarning(false);
        logoutRef.current();
    };

    // ── show warning + start countdown + schedule hard logout ──────────────────
    const showWarningNow = () => {
        warningActiveRef.current = true;
        setShowWarning(true);
        setSecondsLeft(Math.floor(WARNING_BEFORE_MS / 1000));

        countdownRef.current = setInterval(() => {
            setSecondsLeft(prev => {
                if (prev <= 1) {
                    clearInterval(countdownRef.current!);
                    countdownRef.current = null;
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        logoutTimerRef.current = setTimeout(doLogout, WARNING_BEFORE_MS);
    };

    // ── reset timers after activity ────────────────────────────────────────────
    const resetTimers = () => {
        if (!isAuthRef.current) return;
        clearAll();
        warningActiveRef.current = false;
        setShowWarning(false);
        warnTimerRef.current = setTimeout(showWarningNow, timeoutMs - WARNING_BEFORE_MS);
    };

    // ── extend session (Stay Logged In button) ─────────────────────────────────
    const extendSession = () => resetTimers();

    // ── attach / detach activity listeners ────────────────────────────────────
    useEffect(() => {
        if (!isAuthenticated) {
            clearAll();
            warningActiveRef.current = false;
            setShowWarning(false);
            return;
        }

        const onActivity = () => {
            // Only reset when warning is NOT showing (ignore mouse moves during modal)
            if (!warningActiveRef.current) resetTimers();
        };

        ACTIVITY_EVENTS.forEach(ev => window.addEventListener(ev, onActivity, { passive: true }));
        resetTimers(); // Start the idle timer on mount

        return () => {
            ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, onActivity));
            clearAll();
        };
    }, [isAuthenticated]); // ✅ ONLY depends on isAuthenticated — no circular deps

    return { showWarning, secondsLeft, extendSession, doLogout };
};
