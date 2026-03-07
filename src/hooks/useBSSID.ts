/**
 * useBSSID — Wi-Fi BSSID (Router MAC Address) Reader
 *
 * Attempts to read the current Wi-Fi BSSID via the Android WebView bridge.
 * This only works when the app runs inside a native Android WebView wrapper
 * that exposes `window.Android.getCurrentBSSID()`.
 *
 * For regular browser sessions (Chrome desktop, iOS Safari, etc.),
 * `isAndroidApp` will be false and `bssid` will be null — the BSSID
 * check should be SKIPPED gracefully in those cases.
 *
 * Usage:
 *   const { bssid, isAndroidApp, getBSSID } = useBSSID();
 */

// Extend Window to include the Android bridge interface
declare global {
    interface Window {
        Android?: {
            getCurrentBSSID?: () => string | null;
            isMockLocation?: () => boolean;
            [key: string]: unknown;
        };
    }
}

export interface BSSIDResult {
    /** The current Wi-Fi BSSID (MAC address), e.g. "AA:BB:CC:DD:EE:FF" */
    bssid: string | null;
    /** True if running inside an Android WebView with the bridge available */
    isAndroidApp: boolean;
}

/**
 * Reads the current Wi-Fi BSSID from the Android WebView bridge.
 * Returns { bssid, isAndroidApp } synchronously.
 * Safe to call on any platform — falls back gracefully on non-Android.
 */
export function getBSSID(): BSSIDResult {
    try {
        const androidBridge = window.Android;
        const hasGetBSSID = typeof androidBridge?.getCurrentBSSID === 'function';

        if (!hasGetBSSID) {
            // Running in a regular browser — BSSID check not possible
            return { bssid: null, isAndroidApp: false };
        }

        const bssid = androidBridge!.getCurrentBSSID!();
        return {
            bssid: bssid || null,
            isAndroidApp: true,
        };
    } catch {
        return { bssid: null, isAndroidApp: false };
    }
}

/**
 * Validates a BSSID against an allowlist.
 *
 * @param bssid - The current device BSSID
 * @param allowedBSSIDs - Array of allowed BSSIDs for the punch zone
 * @returns true if allowed (pass), false if blocked
 *
 * Rules:
 * - If allowedBSSIDs is empty or not configured → PASS (no restriction)
 * - If not on Android → PASS (cannot check, skip gracefully)
 * - If bssid matches any in allowedBSSIDs (case-insensitive) → PASS
 * - Otherwise → BLOCK
 */
export function validateBSSID(
    bssid: string | null,
    isAndroidApp: boolean,
    allowedBSSIDs: string[] | undefined
): { allowed: boolean; reason?: string } {
    // No restriction configured for this zone
    if (!allowedBSSIDs || allowedBSSIDs.length === 0) {
        return { allowed: true };
    }

    // Not running on Android — cannot check, skip gracefully
    if (!isAndroidApp) {
        return { allowed: true };
    }

    // Android app but couldn't read BSSID (e.g. Wi-Fi off)
    if (!bssid) {
        return {
            allowed: false,
            reason: 'Wi-Fi connected nahi hai. Office Wi-Fi se connect karke punch karein.',
        };
    }

    const normalizedBSSID = bssid.toUpperCase();
    const normalizedAllowed = allowedBSSIDs.map(b => b.toUpperCase());

    if (normalizedAllowed.includes(normalizedBSSID)) {
        return { allowed: true };
    }

    return {
        allowed: false,
        reason: `⛔ Wrong Wi-Fi detected (${bssid}). Office router se connect karke punch karein.`,
    };
}

/**
 * React hook version — reads BSSID once on mount.
 * Can be called multiple times (e.g., on widget open).
 */
import { useState, useCallback } from 'react';

export function useBSSID() {
    const [result, setResult] = useState<BSSIDResult>({ bssid: null, isAndroidApp: false });

    const refresh = useCallback(() => {
        const current = getBSSID();
        setResult(current);
        return current;
    }, []);

    return { ...result, refresh };
}
