import { useMemo, useEffect, Suspense, lazy, Component } from 'react';
import type { ReactNode } from 'react';
import { useClientStore, ClientVisitRecord } from '@/store/clientStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { MapPin, Navigation, Clock, AlertTriangle } from 'lucide-react';

// ── Lazy-load the map to prevent react-leaflet SSR/context crashes ─────────────
const LeafletMap = lazy(() => import('./RouteMap'));

// ── Error boundary to prevent map crash from killing the whole page ────────────
class MapErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false, error: '' };
    }
    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error: error.message };
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="w-full h-full flex items-center justify-center bg-dark-bg/50 rounded-2xl">
                    <div className="text-center p-6">
                        <AlertTriangle className="w-10 h-10 text-orange-400 mx-auto mb-3" />
                        <h3 className="text-white font-medium mb-1">Map failed to load</h3>
                        <p className="text-sm text-dark-muted">Refresh the page to try again.</p>
                        <p className="text-xs text-red-400 mt-2 font-mono">{this.state.error}</p>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

export const RouteTab = ({ salesmanId, companyId }: { salesmanId?: string, companyId?: string | null }) => {
    const { visits: rawVisits, fetchVisits, clients, fetchClients } = useClientStore();
    const { employees } = useEmployeeStore();

    useEffect(() => {
        if (rawVisits.length === 0) fetchVisits();
        if (clients.length === 0) fetchClients();
    }, [fetchVisits, fetchClients, rawVisits.length, clients.length]);

    // Today's boundaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const visits = useMemo(() => {
        let all = rawVisits;
        if (companyId) all = all.filter(v => v.companyId === companyId);
        return all.filter((v: ClientVisitRecord) => {
            const vDate = new Date(v.checkInAt);
            const isToday = vDate >= today && vDate < tomorrow;
            const isTargetSalesman = !salesmanId || v.salesmanId === salesmanId;
            const hasLocation = v.checkInLat != null && v.checkInLng != null;
            return isToday && isTargetSalesman && hasLocation;
        }).sort((a, b) => new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime());
    }, [rawVisits, salesmanId, companyId]);

    const routesBySalesman = useMemo(() => {
        const groups: Record<string, ClientVisitRecord[]> = {};
        visits.forEach((v: ClientVisitRecord) => {
            if (!groups[v.salesmanId]) groups[v.salesmanId] = [];
            groups[v.salesmanId].push(v);
        });
        return groups;
    }, [visits]);

    return (
        <div className="flex flex-col lg:flex-row gap-6">

            {/* Map Area */}
            <div className="flex-1 glass rounded-2xl border border-dark-border overflow-hidden h-[600px] relative z-0">
                <MapErrorBoundary>
                    <Suspense fallback={
                        <div className="w-full h-full flex items-center justify-center bg-dark-bg">
                            <div className="text-center">
                                <MapPin className="w-10 h-10 text-orange-400 mx-auto mb-3 animate-pulse" />
                                <p className="text-dark-muted text-sm">Loading map...</p>
                            </div>
                        </div>
                    }>
                        <LeafletMap
                            visits={visits}
                            routesBySalesman={routesBySalesman}
                            clients={clients}
                        />
                    </Suspense>
                </MapErrorBoundary>

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
                    <p className="text-sm text-dark-muted text-center py-10">No visits tracked today.</p>
                ) : (
                    <div className="relative pl-6 space-y-6">
                        <div className="absolute top-2 bottom-2 left-[11px] w-0.5 bg-dark-border z-0" />

                        {visits.map((v: ClientVisitRecord, idx: number) => {
                            const emp = employees.find(e => e.id === v.salesmanId);
                            const client = clients.find(c => c.id === v.clientId);
                            const isFirst = idx === 0;
                            const isLast = idx === visits.length - 1;

                            return (
                                <div key={v.id} className="relative z-10">
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


