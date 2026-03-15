/**
 * useBackgroundServices.ts
 *
 * Login ke baad yeh sab chalu karta hai:
 * 1. Screen Wake Lock — screen on rehti hai, GPS band nahi hota
 * 2. Custom Service Worker register — background sync + push notifications
 * 3. Periodic Background Sync — regular GPS keepalive
 * 4. GPS → SW bridge — GPS position SW ko bhejta hai offline queue ke liye
 * 5. Visibility change handler — screen lock detect karke re-acquire karta hai
 */
import { useEffect, useRef } from 'react';
import { useWakeLock } from './useWakeLock';

export function useBackgroundServices() {
    const swRef = useRef<ServiceWorkerRegistration | null>(null);
    const gpsWatchRef = useRef<number | null>(null);

    // ── Wake Lock: screen on, GPS active ──
    useWakeLock(true); // Changed to true unconditionally

    // ── Register Custom Service Worker ────────────────────────────────────────
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        const registerSW = async () => {
            try {
                // Register our custom SW (in addition to PWA SW)
                const reg = await navigator.serviceWorker.register('/sw-custom.js', {
                    scope: '/',
                });
                swRef.current = reg;
                console.log('✅ Custom SW registered:', reg.scope);

                // Register Periodic Background Sync (Chrome Android 80+)
                if ('periodicSync' in reg) {
                    try {
                        const status = await navigator.permissions.query({
                            name: 'periodic-background-sync' as PermissionName,
                        });
                        if (status.state === 'granted') {
                            await (reg as any).periodicSync.register('sm-keepalive', {
                                minInterval: 15 * 60 * 1000, // every 15 minutes
                            });
                            console.log('✅ Periodic Background Sync registered');
                        }
                    } catch (e) {
                        console.warn('Periodic sync not available:', e);
                    }
                }
            } catch (e) {
                console.warn('⚠️ Custom SW registration failed:', e);
            }
        };

        registerSW();

        return () => {
            // Don't unregister SW on cleanup — it should persist
        };
    }, []);

    // ── GPS → Service Worker Bridge ───────────────────────────────────────────
    // Har GPS update ko SW ko bhejo taaki background mein store ho sake
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        const sendGPSToSW = (position: GeolocationPosition) => {
            navigator.serviceWorker.ready.then((reg) => {
                reg.active?.postMessage({
                    type: 'GPS_UPDATE',
                    payload: {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: position.timestamp,
                    },
                });
            }).catch(() => { });
        };

        if (navigator.geolocation) {
            gpsWatchRef.current = navigator.geolocation.watchPosition(
                sendGPSToSW,
                (err) => console.warn('GPS error in BG service:', err.message),
                { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }
            );
        }

        return () => {
            if (gpsWatchRef.current !== null) {
                navigator.geolocation.clearWatch(gpsWatchRef.current);
                gpsWatchRef.current = null;
            }
        };
    }, []);

    // ── Visibility Change: re-request GPS permission on resume ────────────────
    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                // User app pe wapas aaya — notify SW
                navigator.serviceWorker.ready.then((reg) => {
                    reg.active?.postMessage({ type: 'APP_RESUMED' });
                }).catch(() => { });
            }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, []);
}
