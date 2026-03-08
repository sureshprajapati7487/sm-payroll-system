/**
 * useWakeLock.ts
 *
 * Screen Wake Lock API — logged in hone ke baad phone ki screen band nahi hogi.
 * Isse GPS aur background processes chalta rahega jab tak app open hai.
 *
 * - Screen Wake Lock API (Chrome 84+, Android Chrome)
 * - Visibility change pe auto re-acquire (user app pe wapas aaye to)
 */
import { useEffect, useRef } from 'react';

export function useWakeLock(enabled: boolean) {
    const wakeLockRef = useRef<WakeLockSentinel | null>(null);

    const acquire = async () => {
        if (!enabled) return;
        if (!('wakeLock' in navigator)) return; // Not supported
        try {
            const current = wakeLockRef.current;
            if (current && !current.released) return; // Already held
            wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
            console.log('🔆 Screen Wake Lock acquired — GPS active');

            // Auto-release event listener
            wakeLockRef.current!.addEventListener('release', () => {
                console.log('💤 Wake Lock released');
            });
        } catch (err: any) {
            // User denied or battery saver mode
            console.warn('⚠️ Wake Lock failed:', err.message);
        }
    };

    const release = async () => {
        if (wakeLockRef.current && !wakeLockRef.current.released) {
            await wakeLockRef.current.release();
            wakeLockRef.current = null;
        }
    };

    useEffect(() => {
        if (!enabled) {
            release();
            return;
        }

        // Acquire immediately
        acquire();

        // Re-acquire when user comes back to the tab (visibility change)
        const onVisible = () => {
            if (document.visibilityState === 'visible' && enabled) {
                acquire();
            }
        };

        document.addEventListener('visibilitychange', onVisible);

        // Re-acquire on fullscreen change
        document.addEventListener('fullscreenchange', onVisible);

        return () => {
            document.removeEventListener('visibilitychange', onVisible);
            document.removeEventListener('fullscreenchange', onVisible);
            release();
        };
    }, [enabled]);
}
