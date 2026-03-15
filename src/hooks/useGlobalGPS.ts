/**
 * useGlobalGPS.ts — Global GPS Permission + Always-On Background Tracking
 *
 * Rules (as required by "App Install karne ke baad all Time GPS on rahe"):
 *  1. App open hote hi IMMEDIATELY GPS permission maango (ek baar).
 *  2. Permission milte hi continuously track karo — kabhi band mat karo.
 *  3. Logout hone par bhi background tracking band NAHI hogi.
 *  4. GPS icon ya koi bhi indicator UI mein nahi dikhega — sirf silently track karo.
 *
 * Usage: App.tsx mein ek baar call karo.
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { BackgroundGeolocationPlugin, Location, } from '@capacitor-community/background-geolocation';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

const GPS_PERM_KEY = 'sm_gps_perm_status'; // 'granted' | 'denied'

export type GpsPermission = 'granted' | 'denied' | 'prompt' | 'unknown';

interface GlobalGPSReturn {
    permission: GpsPermission;
    position: { lat: number; lng: number; accuracy?: number; isMocked?: boolean } | null;
    requestPermission: () => Promise<void>;
    isTracking: boolean;
}

export function useGlobalGPS(): GlobalGPSReturn {
    const [permission, setPermission] = useState<GpsPermission>(() => {
        return (localStorage.getItem(GPS_PERM_KEY) as GpsPermission) || 'unknown';
    });
    const [position, setPosition] = useState<{ lat: number; lng: number; accuracy?: number; isMocked?: boolean } | null>(null);
    const [isTracking, setIsTracking] = useState(false);

    // Web Watch ID
    const watchIdRef = useRef<number | null>(null);
    // Capacitor Watcher ID
    const capWatcherIdRef = useRef<string | null>(null);

    const hasRequestedRef = useRef(false); // Prevent double-requesting

    // -- Persist permission state ----------------------------------------------
    const updatePermission = useCallback((p: GpsPermission) => {
        setPermission(p);
        localStorage.setItem(GPS_PERM_KEY, p);
    }, []);

    // -- Mock Location Detection (Heuristic + Native Bridge) -------------------
    const isMockLocation = (pos: any): boolean => {
        // Native Android Bridge Check (If wrapped in WebView)
        if (typeof window !== 'undefined' && (window as any).Android?.isMockLocation) {
            return (window as any).Android.isMockLocation();
        }

        // Capacitor Background Geolocation flag
        if (pos.isMock === true) return true;

        // Fake GPS apps often hardcode altitude, speed, and heading to exactly 0 (Web)
        if (pos.coords) {
            const c = pos.coords;
            if (c.altitude === 0 && c.altitudeAccuracy === 0 && c.speed === 0 && c.heading === 0) {
                return true;
            }
        }
        return false;
    };

    // -- Start GPS watchPosition -----------------------------------------------
    const startWatch = useCallback(async () => {
        if (Capacitor.isNativePlatform()) {
            // -- NATIVE ANDROID/IOS BACKGROUND TRACKING --
            if (capWatcherIdRef.current !== null) return;
            try {
                // Background tracking with Foreground Service
                const watcherId = await BackgroundGeolocation.addWatcher(
                    {
                        backgroundMessage: "Cancel to prevent battery drain.",
                        backgroundTitle: "SM Payroll Tracking",
                        requestPermissions: true,
                        stale: false,
                        distanceFilter: 10 // only update if moved 10 meters
                    },
                    (location?: Location, error?: any) => {
                        if (error) {
                            if (error.code === 'NOT_AUTHORIZED') {
                                updatePermission('denied');
                                setIsTracking(false);
                            }
                            return;
                        }
                        if (location) {
                            setPosition({
                                lat: location.latitude,
                                lng: location.longitude,
                                accuracy: location.accuracy,
                                isMocked: isMockLocation(location),
                            });
                            setIsTracking(true);

                            // Send to service worker just in case (optional for native, but keeps logic unified)
                            if ('serviceWorker' in navigator) {
                                navigator.serviceWorker.ready.then((reg) => {
                                    reg.active?.postMessage({
                                        type: 'GPS_UPDATE',
                                        payload: { lat: location.latitude, lng: location.longitude, accuracy: location.accuracy, timestamp: location.time }
                                    });
                                }).catch(() => { });
                            }
                        }
                    }
                );
                capWatcherIdRef.current = watcherId;
                updatePermission('granted');
            } catch (err: any) {
                console.warn('Capacitor GPS Watch Error:', err.message);
                updatePermission('denied');
                setIsTracking(false);
            }
        } else {
            // -- STANDARD WEB GEOLOCATION (PWA) --
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
                    console.warn('?? GPS Watch Error:', err.message);
                    if (err.code === err.PERMISSION_DENIED) {
                        updatePermission('denied');
                        setIsTracking(false);
                    }
                    // On timeout / unavailable — don't stop, keep watching
                },
                { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }
            );
        }
    }, [updatePermission]);



    // -- Request Permission (called immediately on login) ----------------------
    const requestPermission = useCallback(async () => {
        if (Capacitor.isNativePlatform()) {
            // Capacitor handles permission via addWatcher options automatically
            startWatch();
        } else {
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
        }
    }, [updatePermission, startWatch]);

    // -- Main Effect: Start GPS immediately on app load, never stop ------------
    useEffect(() => {
        // Already watching — do nothing
        if (watchIdRef.current !== null || capWatcherIdRef.current !== null) return;

        // Request GPS permission immediately on mount (only once per session)
        if (!hasRequestedRef.current) {
            hasRequestedRef.current = true;
            requestPermission();
        }
    }, [requestPermission]);

    // -- Cleanup on app unmount (e.g. page refresh) ----------------------------
    // NOTE: We do NOT stop on route changes or component re-renders — only on logout
    useEffect(() => {
        return () => {
            // Only cleanup on true browser unload, not React re-renders
            // watchPosition is maintained across renders by the refs
        };
    }, []);

    return { permission, position, requestPermission, isTracking };
}
