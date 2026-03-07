import { useMemo, useEffect } from 'react';
import { useClientStore, ClientVisitRecord } from '@/store/clientStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';
import { MapPin, Navigation, Clock } from 'lucide-react';

// Fix Leaflet's default icon issue with Webpack/Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Icon for Salesman Path
const dotIcon = new L.DivIcon({
    className: 'bg-transparent',
    html: `<div class="w-3 h-3 bg-orange-500 rounded-full border-2 border-white shadow-md"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
});

const startIcon = new L.DivIcon({
    className: 'bg-transparent',
    html: `<div class="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-md flex items-center justify-center"><div class="w-1.5 h-1.5 bg-white rounded-full"></div></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
});

const endIcon = new L.DivIcon({
    className: 'bg-transparent',
    html: `<div class="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-md flex items-center justify-center"><div class="w-1.5 h-1.5 bg-white rounded-full"></div></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
});

export const RouteTab = ({ salesmanId, companyId }: { salesmanId?: string, companyId?: string | null }) => {
    const { visits: rawVisits, fetchVisits, clients, fetchClients } = useClientStore();
    const { employees } = useEmployeeStore();

    // Fetch visits when tab unmounts/mounts since it depends on them.
    useEffect(() => {
        if (rawVisits.length === 0) fetchVisits();
        if (clients.length === 0) fetchClients();
    }, [fetchVisits, fetchClients, rawVisits.length, clients.length]);

    // Today's boundaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Fetch visits and filter by today & salesman
    const visits = useMemo(() => {
        let all = rawVisits;
        if (companyId) all = all.filter(v => v.companyId === companyId);

        return all.filter((v: ClientVisitRecord) => {
            const vDate = new Date(v.checkInAt);
            const isToday = vDate >= today && vDate < tomorrow;
            const isTargetSalesman = !salesmanId || v.salesmanId === salesmanId;
            // Only care about visits that have actual GPS coordinates
            const hasLocation = v.checkInLat != null && v.checkInLng != null;
            return isToday && isTargetSalesman && hasLocation;
        }).sort((a: ClientVisitRecord, b: ClientVisitRecord) => new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime());
    }, [rawVisits, salesmanId, companyId, today, tomorrow]); // Added dependencies to avoid warnings

    // Group visits by salesman manually (since multiple might be selected)
    const routesBySalesman = useMemo(() => {
        const groups: Record<string, ClientVisitRecord[]> = {};
        visits.forEach((v: ClientVisitRecord) => {
            if (!groups[v.salesmanId]) groups[v.salesmanId] = [];
            groups[v.salesmanId].push(v);
        });
        return groups;
    }, [visits]);

    const routeColors = ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#ec4899'];

    // Determine initial center
    const defaultCenter: [number, number] = [20.5937, 78.9629]; // Default India
    const center = visits.length > 0 ? [visits[0].checkInLat!, visits[0].checkInLng!] as [number, number] : defaultCenter;
    const zoom = visits.length > 0 ? 13 : 5;

    return (
        <div className="flex flex-col lg:flex-row gap-6">

            {/* Map Area */}
            <div className="flex-1 glass rounded-2xl border border-dark-border overflow-hidden h-[600px] relative z-0">
                <MapContainer center={center} zoom={zoom} scrollWheelZoom={true} className="w-full h-full bg-[#1a1c23]">
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    />

                    {Object.entries(routesBySalesman).map(([sId, sVisits], idx) => {
                        const color = routeColors[idx % routeColors.length];
                        const positions: [number, number][] = sVisits.map((v: ClientVisitRecord) => [v.checkInLat!, v.checkInLng!]);

                        return (
                            <div key={`route-${sId}`}>
                                {/* Path Line */}
                                {positions.length > 1 && (
                                    <Polyline positions={positions} pathOptions={{ color, weight: 3, opacity: 0.8, dashArray: '5, 10' }} />
                                )}

                                {/* Visit Markers */}
                                {/* Visit Markers (clustering disabled — react-leaflet-cluster requires React 19) */}
                                <>
                                    {sVisits.map((v: ClientVisitRecord, i: number) => {
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
                        )
                    })}
                </MapContainer>

                {visits.length === 0 && (
                    <div className="absolute inset-0 z-[1000] bg-dark-bg/80 backdrop-blur-sm flex items-center justify-center">
                        <div className="text-center">
                            <MapPin className="w-12 h-12 text-dark-muted mx-auto mb-3 opacity-50" />
                            <h3 className="text-white font-medium">No Route Data Today</h3>
                            <p className="text-sm text-dark-muted">No client check-ins with GPS coordinates were recorded today.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Sidebar / Journey Timeline */}
            <div className="w-full lg:w-80 glass rounded-2xl border border-dark-border p-5 h-[600px] overflow-y-auto">
                <div className="flex items-center gap-2 mb-6">
                    <Navigation className="w-5 h-5 text-orange-400" />
                    <h2 className="text-white font-bold text-base">Journey Timeline</h2>
                </div>

                {visits.length === 0 ? (
                    <p className="text-sm text-dark-muted text-center py-10">No visits tracked.</p>
                ) : (
                    <div className="relative pl-6 space-y-6">
                        {/* Timeline vertical line */}
                        <div className="absolute top-2 bottom-2 left-[11px] w-0.5 bg-dark-border z-0" />

                        {visits.map((v: ClientVisitRecord, idx: number) => {
                            const emp = employees.find(e => e.id === v.salesmanId);
                            const client = clients.find(c => c.id === v.clientId);
                            const isFirst = idx === 0;
                            const isLast = idx === visits.length - 1;

                            return (
                                <div key={v.id} className="relative z-10">
                                    {/* Timeline Node */}
                                    <div className={`absolute -left-6 w-3 h-3 rounded-full border-2 border-dark-bg mt-1.5 ${isFirst ? 'bg-green-500' : isLast ? 'bg-red-500' : 'bg-orange-500'}`} />

                                    <div className="bg-white/5 rounded-xl p-3 border border-dark-border hover:bg-white/10 transition-colors">
                                        <p className="text-white text-sm font-semibold">{client?.name || 'Unknown Client'}</p>
                                        <p className="text-xs text-dark-muted mt-1">{v.purpose}</p>

                                        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                                            <span className="flex items-center gap-1.5 text-xs text-dark-muted bg-dark-bg px-2 py-1 rounded-md">
                                                <Clock className="w-3 h-3" />
                                                {new Date(v.checkInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                            </span>

                                            {v.outcome && (
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${v.outcome === 'ORDER_PLACED' ? 'bg-green-500/20 text-green-400' :
                                                    v.outcome === 'CLOSED' ? 'bg-blue-500/20 text-blue-400' :
                                                        v.outcome === 'COMPLAINT_RESOLVED' ? 'bg-red-500/20 text-red-400' :
                                                            'bg-orange-500/20 text-orange-400'
                                                    }`}>
                                                    {v.outcome.replace('_', ' ')}
                                                </span>
                                            )}
                                        </div>

                                        {!salesmanId && emp && (
                                            <div className="mt-2 pt-2 border-t border-dark-border/50 flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-full bg-dark-bg overflow-hidden flex items-center justify-center text-[10px] font-bold text-white uppercase border border-dark-border">
                                                    {emp.name.substring(0, 2)}
                                                </div>
                                                <span className="text-[11px] text-dark-muted">{emp.name}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

        </div>
    );
};
