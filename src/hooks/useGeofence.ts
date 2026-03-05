/**
 * useGeofence.ts — Auto Check-in / Check-out via GPS Geofencing
 *
 * Kaise kaam karta hai:
 *  1. navigator.geolocation.watchPosition se salesman ka GPS track karta hai
 *  2. Har position update pe — sabhi GPS-set clients se distance check karta hai
 *  3. Agar koi client radius ke andar → auto check-in (agar koi active visit nahi)
 *  4. Agar active visit chal raha hai aur salesman bahar nikla → auto check-out + duration log
 *
 * Radius: System Settings → Salesman Configuration → GPS Radius (meters) se aata hai
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useClientStore, SalesClient } from '@/store/clientStore';
import { getGeofenceRadius } from '@/utils/salesmanConfig';

// ── Haversine distance in metres ──────────────────────────────────────────────
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface GeofenceEvent {
    id: string;
    type: 'ENTERED' | 'EXITED';
    clientName: string;
    shopName?: string;
    distanceMetres?: number;
    durationMins?: number; // only for EXITED
    timestamp: string;
}

interface UseGeofenceOptions {
    salesmanId: string | undefined;
    salesmanName?: string;
    companyId: string | undefined;
    clients: SalesClient[];
    /** Radius in metres — default from System Settings → Salesman Configuration */
    radiusMetres?: number;
    enabled?: boolean;
}

interface UseGeofenceReturn {
    isTracking: boolean;
    currentPosition: { lat: number; lng: number } | null;
    nearbyClient: SalesClient | null;
    nearbyDistanceM: number | null;
    events: GeofenceEvent[];
    clearEvents: () => void;
    gpsError: string | null;
}

const WATCH_OPTIONS: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 5000,
};

export function useGeofence({
    salesmanId,
    salesmanName,
    companyId,
    clients,
    radiusMetres,
    enabled = true,
}: UseGeofenceOptions): UseGeofenceReturn {
    const { checkIn, checkOut, activeVisit, fetchActiveVisit } = useClientStore();

    // Dynamic radius: Super Admin ki System Settings → Salesman Config se
    const effectiveRadius = radiusMetres ?? getGeofenceRadius();

    // State
    const [isTracking, setIsTracking] = useState(false);
    const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null);
    const [nearbyClient, setNearbyClient] = useState<SalesClient | null>(null);
    const [nearbyDistanceM, setNearbyDistanceM] = useState<number | null>(null);
    const [events, setEvents] = useState<GeofenceEvent[]>([]);
    const [gpsError, setGpsError] = useState<string | null>(null);

    // Refs to avoid stale closures
    const watchIdRef = useRef<number | null>(null);
    const activeVisitRef = useRef(activeVisit);
    const processingRef = useRef(false);
    const lastInsideClientRef = useRef<string | null>(null);
    const checkInAtRef = useRef<Date | null>(null);

    // Keep activeVisitRef in sync
    useEffect(() => {
        activeVisitRef.current = activeVisit;
    }, [activeVisit]);

    const addEvent = useCallback((event: GeofenceEvent) => {
        setEvents(prev => [event, ...prev].slice(0, 20));
    }, []);

    const clearEvents = useCallback(() => setEvents([]), []);

    // ── Core: handle new GPS position ─────────────────────────────────────────
    const handlePosition = useCallback(async (pos: GeolocationPosition) => {
        if (!salesmanId || !companyId || processingRef.current) return;

        const myLat = pos.coords.latitude;
        const myLng = pos.coords.longitude;
        setCurrentPosition({ lat: myLat, lng: myLng });
        setGpsError(null);

        const gpsClients = clients.filter(c => c.latitude && c.longitude && c.status === 'ACTIVE');
        if (!gpsClients.length) return;

        let nearestClient: SalesClient | null = null;
        let nearestDist = Infinity;

        for (const client of gpsClients) {
            const dist = haversineDistance(myLat, myLng, client.latitude!, client.longitude!);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestClient = client;
            }
        }

        const isInside = nearestDist <= effectiveRadius && nearestClient !== null;
        const currentInside = lastInsideClientRef.current;

        setNearbyClient(isInside ? nearestClient : null);
        setNearbyDistanceM(isInside ? nearestDist : null);

        // ENTERED
        if (isInside && nearestClient && nearestClient.id !== currentInside) {
            lastInsideClientRef.current = nearestClient.id;
            checkInAtRef.current = new Date();

            const av = activeVisitRef.current;
            if (!av) {
                processingRef.current = true;
                try {
                    await checkIn({
                        companyId,
                        clientId: nearestClient.id,
                        salesmanId,
                        salesmanName: salesmanName || salesmanId,
                        lat: myLat,
                        lng: myLng,
                        purpose: 'SALES',
                        notes: `Auto check-in via GPS (${nearestDist}m)`,
                    });
                    await fetchActiveVisit(salesmanId);
                    addEvent({
                        id: `enter-${Date.now()}`,
                        type: 'ENTERED',
                        clientName: nearestClient.name,
                        shopName: nearestClient.shopName,
                        distanceMetres: nearestDist,
                        timestamp: new Date().toISOString(),
                    });
                } catch (e) {
                    console.warn('🌍 Geofence auto check-in failed:', e);
                } finally {
                    processingRef.current = false;
                }
            } else {
                addEvent({
                    id: `near-${Date.now()}`,
                    type: 'ENTERED',
                    clientName: nearestClient.name,
                    shopName: nearestClient.shopName,
                    distanceMetres: nearestDist,
                    timestamp: new Date().toISOString(),
                });
            }
        }

        // EXITED
        if (!isInside && currentInside) {
            lastInsideClientRef.current = null;
            const enteredAt = checkInAtRef.current;
            const durationMins = enteredAt
                ? Math.round((Date.now() - enteredAt.getTime()) / 60000)
                : undefined;
            checkInAtRef.current = null;

            const exitedClient = clients.find(c => c.id === currentInside);

            const av = activeVisitRef.current;
            if (av?.visit?.clientId === currentInside && !processingRef.current) {
                processingRef.current = true;
                try {
                    await checkOut(av.visit.id, {
                        lat: myLat,
                        lng: myLng,
                        outcome: 'NO_ORDER',
                        notes: `Auto check-out via GPS. Ruke: ${durationMins ?? '?'} min`,
                        nextVisitDate: undefined,
                    });
                    addEvent({
                        id: `exit-${Date.now()}`,
                        type: 'EXITED',
                        clientName: exitedClient?.name || 'Client',
                        shopName: exitedClient?.shopName,
                        durationMins,
                        timestamp: new Date().toISOString(),
                    });
                } catch (e) {
                    console.warn('🌍 Geofence auto check-out failed:', e);
                } finally {
                    processingRef.current = false;
                }
            } else if (exitedClient) {
                addEvent({
                    id: `exit-${Date.now()}`,
                    type: 'EXITED',
                    clientName: exitedClient.name,
                    shopName: exitedClient.shopName,
                    durationMins,
                    timestamp: new Date().toISOString(),
                });
            }
        }
    }, [salesmanId, companyId, clients, effectiveRadius, checkIn, checkOut, fetchActiveVisit, salesmanName, addEvent]);

    const handleError = useCallback((err: GeolocationPositionError) => {
        console.warn('🌍 GPS Watch Error:', err.message);
        setGpsError(err.message);
        setIsTracking(false);
    }, []);

    // ── Start / Stop GPS watcher ──────────────────────────────────────────────
    useEffect(() => {
        if (!enabled || !salesmanId || !companyId || !navigator.geolocation) {
            setIsTracking(false);
            return;
        }

        const hasGpsClients = clients.some(c => c.latitude && c.longitude);
        if (!hasGpsClients) {
            setIsTracking(false);
            return;
        }

        watchIdRef.current = navigator.geolocation.watchPosition(
            handlePosition,
            handleError,
            WATCH_OPTIONS,
        );
        setIsTracking(true);
        console.log(`🌍 Geofence tracking started (radius: ${effectiveRadius}m)`);

        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
                setIsTracking(false);
                console.log('🌍 Geofence tracking stopped');
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        enabled,
        salesmanId,
        companyId,
        effectiveRadius,
        clients.filter(c => c.latitude).map(c => `${c.id}:${c.latitude},${c.longitude}`).join('|'),
    ]);

    return { isTracking, currentPosition, nearbyClient, nearbyDistanceM, events, clearEvents, gpsError };
}
