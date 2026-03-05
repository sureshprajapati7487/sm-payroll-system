/**
 * salesmanConfig.ts — Salesman Config reader
 *
 * ConfigurationPage ke SalesmanConfigPanel mein jo settings Super Admin save karta hai
 * (localStorage key: 'sm-salesman-config'), woh sab yahan se easily read kar sako.
 *
 * Usage:
 *   import { getSalesmanConfig } from '@/utils/salesmanConfig';
 *   const cfg = getSalesmanConfig();
 *   const radius = cfg.gpsRadiusMeters; // e.g. 100
 */

export interface SalesmanConfig {
    gpsRadiusMeters: number;
    maxDailyVisits: number;
    minVisitDurationMins: number;
    maxVisitDurationMins: number;
    checkInStartTime: string;
    checkInEndTime: string;
    baseCommissionPct: number;
    bonusThreshold1: number;
    bonusThreshold1Pct: number;
    bonusThreshold2: number;
    bonusThreshold2Pct: number;
    dailyVisitTarget: number;
    monthlyOrderTarget: number;
    monthlyCollectionTarget: number;
    maxClientsPerSalesman: number;
    overdueAlertDays: number;
    gpsRequired: boolean;
    photoRequired: boolean;
    competitorTracking: boolean;
    offlineMode: boolean;
    autoCheckout: boolean;
    autoCheckoutHours: number;
    visitPurposes: { key: string; label: string; emoji: string }[];
}

const LS_KEY = 'sm-salesman-config';

export const DEFAULT_SALESMAN_CONFIG: SalesmanConfig = {
    gpsRadiusMeters: 50,        // ← 50m default (changed from original 500)
    maxDailyVisits: 20,
    minVisitDurationMins: 5,
    maxVisitDurationMins: 180,
    checkInStartTime: '08:00',
    checkInEndTime: '20:00',
    baseCommissionPct: 2,
    bonusThreshold1: 50000,
    bonusThreshold1Pct: 3,
    bonusThreshold2: 100000,
    bonusThreshold2Pct: 5,
    dailyVisitTarget: 8,
    monthlyOrderTarget: 200000,
    monthlyCollectionTarget: 150000,
    maxClientsPerSalesman: 100,
    overdueAlertDays: 7,
    gpsRequired: true,
    photoRequired: false,
    competitorTracking: false,
    offlineMode: true,
    autoCheckout: true,
    autoCheckoutHours: 8,
    visitPurposes: [
        { key: 'SALES', label: 'Sales', emoji: '🛒' },
        { key: 'COLLECTION', label: 'Collection', emoji: '💰' },
        { key: 'DEMO', label: 'Demo', emoji: '🎯' },
        { key: 'COMPLAINT', label: 'Complaint', emoji: '⚠️' },
        { key: 'FOLLOWUP', label: 'Follow-up', emoji: '🔄' },
        { key: 'OTHER', label: 'Other', emoji: '📝' },
    ],
};

/** LocalStorage se Salesman Config load karo (Super Admin ne jo set kiya hai) */
export function getSalesmanConfig(): SalesmanConfig {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) return { ...DEFAULT_SALESMAN_CONFIG, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return DEFAULT_SALESMAN_CONFIG;
}

/** Geofence radius — ya default 50m */
export function getGeofenceRadius(): number {
    return getSalesmanConfig().gpsRadiusMeters || 50;
}

/** Visit purposes — check-in ke waqt choices */
export function getVisitPurposes(): { key: string; label: string; emoji: string }[] {
    return getSalesmanConfig().visitPurposes;
}
