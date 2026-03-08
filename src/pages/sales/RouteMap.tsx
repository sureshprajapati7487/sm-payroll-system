/**
 * RouteMap.tsx — Vanilla Leaflet map (no react-leaflet) for Today's Route.
 *
 * react-leaflet@5 requires React 19. Since this project uses React 18,
 * we use the raw leaflet library directly via useEffect + useRef.
 * This avoids all "render2 is not a function" / context errors.
 */

import { useEffect, useRef } from 'react';
import { ClientVisitRecord, SalesClient } from '@/store/clientStore';

// Import leaflet types but use it as a module to avoid SSR issues
let L: typeof import('leaflet') | null = null;

const routeColors = ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#ec4899'];

interface RouteMapProps {
    visits: ClientVisitRecord[];
    routesBySalesman: Record<string, ClientVisitRecord[]>;
    clients: SalesClient[];
}

export default function RouteMap({ visits, routesBySalesman, clients }: RouteMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<import('leaflet').Map | null>(null);

    useEffect(() => {
        // Dynamically import leaflet to keep it out of the main bundle
        import('leaflet').then((leaflet) => {
            L = leaflet.default ?? leaflet;

            // Ensure leaflet CSS is loaded
            if (!document.getElementById('leaflet-css')) {
                const link = document.createElement('link');
                link.id = 'leaflet-css';
                link.rel = 'stylesheet';
                link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
                document.head.appendChild(link);
            }

            if (!containerRef.current || mapRef.current) return;
            if ((containerRef.current as any)._leaflet_id) return; // StrictMode guard

            const defaultCenter: [number, number] = [20.5937, 78.9629];
            const center = visits.length > 0
                ? [visits[0].checkInLat!, visits[0].checkInLng!] as [number, number]
                : defaultCenter;
            const zoom = visits.length > 0 ? 13 : 5;

            // Create map
            const map = L!.map(containerRef.current, {
                center,
                zoom,
                scrollWheelZoom: true,
                zoomControl: true,
            });
            mapRef.current = map;

            // Dark tile layer
            L!.tileLayer(
                'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
                { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' }
            ).addTo(map);

            // Custom icons
            const makeIcon = (color: string) => L!.divIcon({
                className: '',
                html: `<div style="width:14px;height:14px;background:${color};border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.5)"></div>`,
                iconSize: [14, 14],
                iconAnchor: [7, 7],
            });

            const startIconObj = L!.divIcon({
                className: '',
                html: `<div style="width:16px;height:16px;background:#22c55e;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center"><div style="width:6px;height:6px;background:white;border-radius:50%"></div></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
            });

            const endIconObj = L!.divIcon({
                className: '',
                html: `<div style="width:16px;height:16px;background:#ef4444;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center"><div style="width:6px;height:6px;background:white;border-radius:50%"></div></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
            });

            // Draw each salesman route
            Object.entries(routesBySalesman).forEach(([, sVisits], idx) => {
                const color = routeColors[idx % routeColors.length];
                const positions: [number, number][] = sVisits.map(v => [v.checkInLat!, v.checkInLng!]);

                // Route line
                if (positions.length > 1) {
                    L!.polyline(positions, { color, weight: 3, opacity: 0.8, dashArray: '5, 10' }).addTo(map);
                }

                // Markers
                sVisits.forEach((v, i) => {
                    const isStart = i === 0;
                    const isEnd = i === sVisits.length - 1 && sVisits.length > 1;
                    const icon = isStart ? startIconObj : isEnd ? endIconObj : makeIcon(color);
                    const client = clients.find(c => c.id === v.clientId);
                    const time = new Date(v.checkInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

                    L!.marker([v.checkInLat!, v.checkInLng!], { icon })
                        .addTo(map)
                        .bindPopup(`
                            <div style="padding:4px;min-width:140px">
                                <p style="font-weight:bold;font-size:13px;margin:0 0 4px">${client?.name || 'Unknown Client'}</p>
                                <p style="font-size:11px;color:#555;margin:0">⏰ ${time}</p>
                                ${v.outcome ? `<p style="font-size:11px;font-weight:600;color:#2563eb;margin:4px 0 0;text-transform:uppercase">${v.outcome.replace(/_/g, ' ')}</p>` : ''}
                            </div>
                        `);
                });
            });
        });

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);  // Run once on mount — map is self-contained

    return <div ref={containerRef} className="w-full h-full" />;
}
