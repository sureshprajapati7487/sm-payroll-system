/**
 * RouteMap.tsx — Lazily-loaded Leaflet map for Today's Route tab.
 *
 * Separated into its own file so that React.lazy() can dynamically import it.
 * This prevents the react-leaflet "rendered is not a function" crash from
 * killing the entire Salesman Dashboard on load.
 */

import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';
import { Clock } from 'lucide-react';
import { ClientVisitRecord, SalesClient } from '@/store/clientStore';

// Fix Leaflet's default icon issue with Webpack/Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons
const dotIcon = new L.DivIcon({
    className: 'bg-transparent',
    html: `<div class="w-3 h-3 bg-orange-500 rounded-full border-2 border-white shadow-md"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
});
const startIcon = new L.DivIcon({
    className: 'bg-transparent',
    html: `<div class="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-md flex items-center justify-center"><div class="w-1.5 h-1.5 bg-white rounded-full"></div></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
});
const endIcon = new L.DivIcon({
    className: 'bg-transparent',
    html: `<div class="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-md flex items-center justify-center"><div class="w-1.5 h-1.5 bg-white rounded-full"></div></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
});

interface RouteMapProps {
    visits: ClientVisitRecord[];
    routesBySalesman: Record<string, ClientVisitRecord[]>;
    clients: SalesClient[];
}

const routeColors = ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#ec4899'];

const defaultCenter: [number, number] = [20.5937, 78.9629]; // Center of India

export default function RouteMap({ visits, routesBySalesman, clients }: RouteMapProps) {
    const center = visits.length > 0
        ? [visits[0].checkInLat!, visits[0].checkInLng!] as [number, number]
        : defaultCenter;
    const zoom = visits.length > 0 ? 13 : 5;

    return (
        <MapContainer
            center={center}
            zoom={zoom}
            scrollWheelZoom={true}
            className="w-full h-full bg-[#1a1c23]"
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />

            {Object.entries(routesBySalesman).map(([sId, sVisits], idx) => {
                const color = routeColors[idx % routeColors.length];
                const positions: [number, number][] = sVisits.map(v => [v.checkInLat!, v.checkInLng!]);

                return (
                    <div key={`route-${sId}`}>
                        {positions.length > 1 && (
                            <Polyline
                                positions={positions}
                                pathOptions={{ color, weight: 3, opacity: 0.8, dashArray: '5, 10' }}
                            />
                        )}
                        <>
                            {sVisits.map((v, i) => {
                                const isStart = i === 0;
                                const isEnd = i === sVisits.length - 1 && sVisits.length > 1;
                                const icon = isStart ? startIcon : isEnd ? endIcon : dotIcon;
                                const client = clients.find(c => c.id === v.clientId);

                                return (
                                    <Marker key={v.id} position={[v.checkInLat!, v.checkInLng!]} icon={icon}>
                                        <Popup className="custom-popup">
                                            <div className="p-1">
                                                <p className="font-bold text-gray-800 text-sm">{client?.name || 'Unknown Client'}</p>
                                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(v.checkInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                                {v.outcome && (
                                                    <p className="text-xs font-semibold text-blue-600 mt-1 uppercase">{v.outcome}</p>
                                                )}
                                            </div>
                                        </Popup>
                                    </Marker>
                                );
                            })}
                        </>
                    </div>
                );
            })}
        </MapContainer>
    );
}
