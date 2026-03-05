/**
 * useGlobalGPS.ts — Global GPS Permission + Session-Level Tracking
 *
 * Login ke baad GPS permission maango (ek baar).
 * Granted hone par continuously position track karo.
 * Logout hote hi band ho jao.
 *
 * Usage: App.tsx mein ek baar call karo — baaki sab useGeofence automatically kaam karta hai.
 */
import { useEffect, useRef, useCallback, useState } from 'react';

const GPS_PERM_KEY = 'sm_gps_perm_status'; // 'granted' | 'denied' | 'prompt'

export type GpsPermission = 'granted' | 'denied' | 'prompt' | 'unknown';

interface GlobalGPSReturn {
    permission: GpsPermission;
    position: { lat: number; lng: number; accuracy?: number } | null;
    requestPermission: () => Promise<void>;
    isTracking: boolean;
}

export function useGlobalGPS(isLoggedIn: boolean): GlobalGPSReturn {
    const [permission, setPermission] = useState<GpsPermission>(() => {
        return (localStorage.getItem(GPS_PERM_KEY) as GpsPermission) || 'unknown';
    });
    const [position, setPosition] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
    const [isTracking, setIsTracking] = useState(false);
    const watchIdRef = useRef<number | null>(null);

    // ── Persist permission state ──────────────────────────────────────────────
    const updatePermission = useCallback((p: GpsPermission) => {
        setPermission(p);
        localStorage.setItem(GPS_PERM_KEY, p);
    }, []);

    // ── Start GPS watchPosition ───────────────────────────────────────────────
    const startWatch = useCallback(() => {
        if (!navigator.geolocation || watchIdRef.current !== null) return;
        watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                setPosition({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                });
                setIsTracking(true);
            },
            (err) => {
                console.warn('🌍 GPS Watch Error:', err.message);
                if (err.code === err.PERMISSION_DENIED) {
                    updatePermission('denied');
                }
                setIsTracking(false);
            },
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
        );
    }, [updatePermission]);

    // ── Stop GPS watchPosition ────────────────────────────────────────────────
    const stopWatch = useCallback(() => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
            setIsTracking(false);
            setPosition(null);
        }
    }, []);

    // ── Request Permission (manual trigger or on login) ───────────────────────
    const requestPermission = useCallback(async () => {
        if (!navigator.geolocation) {
            updatePermission('denied');
            return;
        }

        // Check browser Permissions API first (Chrome/Edge)
        if (navigator.permissions) {
            try {
                const status = await navigator.permissions.query({ name: 'geolocation' });
                if (status.state === 'granted') {
                    updatePermission('granted');
                    startWatch();
                    return;
                }
            } catch { /* Firefox doesn't support permissions.query for geolocation */ }
        }

        // Trigger permission dialog by calling getCurrentPosition
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                updatePermission('granted');
                setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
                startWatch();
            },
            (err) => {
                if (err.code === err.PERMISSION_DENIED) {
                    updatePermission('denied');
                } else {
                    // Timeout or other error — still try watching
                    startWatch();
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }, [updatePermission, startWatch]);

    // ── Effect: start tracking when logged in + permission granted ────────────
    useEffect(() => {
        if (!isLoggedIn) {
            stopWatch();
            return;
        }
        // Already granted — start immediately
        if (permission === 'granted') {
            startWatch();
        }
        // Cleanup on logout or unmount
        return () => {
            if (!isLoggedIn) stopWatch();
        };
    }, [isLoggedIn, permission, startWatch, stopWatch]);

    // ── Effect: cleanup on unmount ────────────────────────────────────────────
    useEffect(() => {
        return () => stopWatch();
    }, [stopWatch]);

    return { permission, position, requestPermission, isTracking };
}
