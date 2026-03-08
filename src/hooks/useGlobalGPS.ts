/**
 * useGlobalGPS.ts — Global GPS Permission + Session-Level Tracking
 *
 * Rules (as required):
 *  1. Login ke baad IMMEDIATELY GPS permission maango (ek baar).
 *  2. Permission milte hi continuously track karo — kabhi band mat karo.
 *  3. SIRF logout pe GPS band hoga.
 *  4. GPS icon ya koi bhi indicator UI mein nahi dikhega — sirf silently track karo.
 *
 * Usage: App.tsx mein ek baar call karo.
 */
import { useEffect, useRef, useCallback, useState } from 'react';

const GPS_PERM_KEY = 'sm_gps_perm_status'; // 'granted' | 'denied'

export type GpsPermission = 'granted' | 'denied' | 'prompt' | 'unknown';

interface GlobalGPSReturn {
    permission: GpsPermission;
    position: { lat: number; lng: number; accuracy?: number; isMocked?: boolean } | null;
    requestPermission: () => Promise<void>;
    isTracking: boolean;
}

export function useGlobalGPS(isLoggedIn: boolean): GlobalGPSReturn {
    const [permission, setPermission] = useState<GpsPermission>(() => {
        return (localStorage.getItem(GPS_PERM_KEY) as GpsPermission) || 'unknown';
    });
    const [position, setPosition] = useState<{ lat: number; lng: number; accuracy?: number; isMocked?: boolean } | null>(null);
    const [isTracking, setIsTracking] = useState(false);
    const watchIdRef = useRef<number | null>(null);
    const hasRequestedRef = useRef(false); // Prevent double-requesting

    // ── Persist permission state ──────────────────────────────────────────────
    const updatePermission = useCallback((p: GpsPermission) => {
        setPermission(p);
        localStorage.setItem(GPS_PERM_KEY, p);
    }, []);

    // ── Mock Location Detection (Heuristic + Native Bridge) ───────────────────
    const isMockLocation = (pos: GeolocationPosition): boolean => {
        // Native Android Bridge Check (If wrapped in WebView)
        if (typeof window !== 'undefined' && (window as any).Android?.isMockLocation) {
            return (window as any).Android.isMockLocation();
        }
        // Fake GPS apps often hardcode altitude, speed, and heading to exactly 0
        const c = pos.coords;
        if (c.altitude === 0 && c.altitudeAccuracy === 0 && c.speed === 0 && c.heading === 0) {
            return true;
        }
        return false;
    };

    // ── Start GPS watchPosition ───────────────────────────────────────────────
    const startWatch = useCallback(() => {
        if (!navigator.geolocation) return;
        if (watchIdRef.current !== null) return; // Already watching
        watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                setPosition({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                    isMocked: isMockLocation(pos),
                });
                setIsTracking(true);
            },
            (err) => {
                console.warn('🌍 GPS Watch Error:', err.message);
                if (err.code === err.PERMISSION_DENIED) {
                    updatePermission('denied');
                    setIsTracking(false);
                }
                // On timeout / unavailable — don't stop, keep watching (might recover)
            },
            { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }
        );
    }, [updatePermission]);

    // ── Stop GPS watchPosition (ONLY on logout) ───────────────────────────────
    const stopWatch = useCallback(() => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
            setIsTracking(false);
            setPosition(null);
        }
    }, []);

    // ── Request Permission (called immediately on login) ──────────────────────
    const requestPermission = useCallback(async () => {
        if (!navigator.geolocation) {
            updatePermission('denied');
            return;
        }

        // Check browser Permissions API first (Chrome/Edge/Android)
        if (navigator.permissions) {
            try {
                const status = await navigator.permissions.query({ name: 'geolocation' });
                if (status.state === 'granted') {
                    updatePermission('granted');
                    startWatch();
                    return;
                }
                // Listen for future permission changes (user might grant later)
                status.onchange = () => {
                    if (status.state === 'granted') {
                        updatePermission('granted');
                        startWatch();
                    } else if (status.state === 'denied') {
                        updatePermission('denied');
                    }
                };
            } catch { /* Firefox doesn't support permissions.query for geolocation */ }
        }

        // Trigger permission dialog by calling getCurrentPosition
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                updatePermission('granted');
                setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
                startWatch(); // Start continuous watch immediately after first fix
            },
            (err) => {
                if (err.code === err.PERMISSION_DENIED) {
                    updatePermission('denied');
                } else {
                    // Timeout or position unavailable — still try persistent watching
                    startWatch();
                }
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    }, [updatePermission, startWatch]);

    // ── Main Effect: Start GPS immediately on login, stop ONLY on logout ──────
    useEffect(() => {
        if (!isLoggedIn) {
            // Logout: stop GPS, reset flag so it re-requests on next login
            stopWatch();
            hasRequestedRef.current = false;
            return;
        }

        // Already logged in and watching — do nothing
        if (watchIdRef.current !== null) return;

        // Request GPS permission immediately on login (only once per session)
        if (!hasRequestedRef.current) {
            hasRequestedRef.current = true;
            requestPermission();
        }
    }, [isLoggedIn, requestPermission, stopWatch]);

    // ── Cleanup on app unmount (e.g. page refresh) ────────────────────────────
    // NOTE: We do NOT stop on route changes or component re-renders — only on logout
    useEffect(() => {
        return () => {
            // Only cleanup on true browser unload, not React re-renders
            // watchPosition is maintained across renders by the ref
        };
    }, []);

    return { permission, position, requestPermission, isTracking };
}
