import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiFetch } from '@/lib/apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────
export type ClientStatus = 'ACTIVE' | 'INACTIVE' | 'PROSPECT' | 'BLOCKED';
export type ClientType = 'RETAIL' | 'WHOLESALE' | 'DISTRIBUTOR' | 'INSTITUTION';
export type VisitPurpose = 'SALES' | 'COLLECTION' | 'DEMO' | 'COMPLAINT' | 'FOLLOWUP' | 'OTHER';
export type VisitOutcome = 'ORDER_PLACED' | 'NO_ORDER' | 'FOLLOW_UP' | 'CLOSED' | 'COMPLAINT_RESOLVED';

export interface SalesClient {
    id: string;
    companyId: string;
    name: string;
    code?: string;
    shopName?: string;
    ownerName?: string;
    phone?: string;
    phone2?: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    type: ClientType;
    category?: string;
    latitude?: number;
    longitude?: number;
    locationSetAt?: string;
    locationSetBy?: string;
    assignedTo?: string;
    assignedToName?: string;
    totalVisits: number;
    lastVisitAt?: string;
    nextVisitDate?: string;
    avgVisitMins: number;
    status: ClientStatus;
    notes?: string;
    tags?: string[];
    creditLimit?: number;
    outstandingAmount?: number;
    createdAt?: string;
}

export interface ClientVisitRecord {
    id: string;
    companyId: string;
    clientId: string;
    salesmanId: string;
    salesmanName?: string;
    checkInAt: string;
    checkOutAt?: string;
    durationMins?: number;
    checkInLat?: number;
    checkInLng?: number;
    checkOutLat?: number;
    checkOutLng?: number;
    distanceFromClient?: number;
    purpose?: VisitPurpose;
    outcome?: VisitOutcome;
    orderAmount?: number;
    collectionAmount?: number;
    notes?: string;
    nextVisitDate?: string;
    visitNumber?: number;
}

export interface SalesmanStats {
    todayVisits: number;
    totalVisits: number;
    totalClients: number;
    totalOrders: number;
    totalCollection: number;
    avgDurationMins: number;
    overdueClients: number;
}

interface ClientStore {
    clients: SalesClient[];
    visits: ClientVisitRecord[];
    activeVisit: { visit: ClientVisitRecord; client: SalesClient } | null;
    loading: boolean;
    error: string | null;

    fetchClients: (params?: { assignedTo?: string; status?: string }) => Promise<void>;
    addClient: (data: Partial<SalesClient>) => Promise<SalesClient>;
    updateClient: (id: string, data: Partial<SalesClient>) => Promise<SalesClient>;
    deleteClient: (id: string) => Promise<void>;
    bulkImportClients: (clients: Partial<SalesClient>[], companyId: string) => Promise<{ inserted: number; total: number }>;

    setClientLocation: (clientId: string, lat: number, lng: number, setBy: string) => Promise<void>;

    fetchVisits: (params?: { clientId?: string; salesmanId?: string; date?: string }) => Promise<void>;
    checkIn: (params: { clientId: string; salesmanId: string; salesmanName?: string; lat?: number; lng?: number; purpose?: VisitPurpose; notes?: string }) => Promise<ClientVisitRecord>;
    checkOut: (visitId: string, params: { lat?: number; lng?: number; outcome?: VisitOutcome; orderAmount?: number; collectionAmount?: number; notes?: string; nextVisitDate?: string }) => Promise<void>;
    fetchActiveVisit: (salesmanId: string) => Promise<void>;
    fetchStats: (salesmanId: string) => Promise<SalesmanStats>;
}

export const useClientStore = create<ClientStore>()(
    persist(
        (set, get) => ({
            clients: [],
            visits: [],
            activeVisit: null,
            loading: false,
            error: null,

            fetchClients: async (params = {}) => {
                set({ loading: true, error: null });
                try {
                    // companyId not sent — server uses JWT req.companyId
                    const qs = new URLSearchParams(
                        Object.entries(params).filter(([, v]) => v) as [string, string][]
                    ).toString();
                    const res = await apiFetch(`/clients${qs ? '?' + qs : ''}`);
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Failed to fetch clients');
                    set({ clients: data, loading: false });
                } catch (e: any) { set({ error: e.message, loading: false }); }
            },

            addClient: async (data) => {
                const res = await apiFetch('/clients', {
                    method: 'POST',
                    body: JSON.stringify(data),
                });
                const client = await res.json();
                if (!res.ok) throw new Error(client.error || 'Failed to add client');
                set(s => ({ clients: [client, ...s.clients] }));
                return client;
            },

            updateClient: async (id, data) => {
                const res = await apiFetch(`/clients/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(data),
                });
                const client = await res.json();
                if (!res.ok) throw new Error(client.error || 'Failed to update client');
                set(s => ({ clients: s.clients.map(c => c.id === id ? client : c) }));
                return client;
            },

            deleteClient: async (id) => {
                const res = await apiFetch(`/clients/${id}`, { method: 'DELETE' });
                if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to delete'); }
                set(s => ({ clients: s.clients.filter(c => c.id !== id) }));
            },

            bulkImportClients: async (clients, companyId) => {
                const res = await apiFetch('/clients/bulk', {
                    method: 'POST',
                    body: JSON.stringify({ clients, companyId }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Bulk import failed');
                await get().fetchClients();
                return data;
            },

            setClientLocation: async (clientId, lat, lng, setBy) => {
                const res = await apiFetch(`/clients/${clientId}/location`, {
                    method: 'PATCH',
                    body: JSON.stringify({ latitude: lat, longitude: lng, setBy }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to set location');
                set(s => ({ clients: s.clients.map(c => c.id === clientId ? data.client : c) }));
            },

            fetchVisits: async (params = {}) => {
                set({ loading: true });
                try {
                    const qs = new URLSearchParams(
                        Object.entries(params).filter(([, v]) => v) as [string, string][]
                    ).toString();
                    const res = await apiFetch(`/visits${qs ? '?' + qs : ''}`);
                    const visits = await res.json();
                    if (!res.ok) throw new Error(visits.error);
                    set({ visits, loading: false });
                } catch (e: any) { set({ error: e.message, loading: false }); }
            },

            checkIn: async ({ clientId, salesmanId, salesmanName, lat, lng, purpose, notes }) => {
                // companyId not sent — server uses JWT req.companyId via x-company-id header
                const res = await apiFetch('/visits/checkin', {
                    method: 'POST',
                    body: JSON.stringify({ clientId, salesmanId, salesmanName, checkInLat: lat, checkInLng: lng, purpose, notes }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Check-in failed');
                await get().fetchActiveVisit(salesmanId);
                return data.visit;
            },

            checkOut: async (visitId, params) => {
                const res = await apiFetch(`/visits/${visitId}/checkout`, {
                    method: 'POST',
                    body: JSON.stringify({ checkOutLat: params.lat, checkOutLng: params.lng, ...params }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Check-out failed');
                set({ activeVisit: null });
                set(s => ({ visits: s.visits.map(v => v.id === visitId ? data.visit : v) }));
                set(s => ({ clients: s.clients.map(c => c.id === data.visit.clientId ? { ...c, totalVisits: (c.totalVisits || 0) + 1, lastVisitAt: new Date().toISOString() } : c) }));
            },

            fetchActiveVisit: async (salesmanId) => {
                try {
                    const res = await apiFetch(`/visits/active/${salesmanId}`);
                    if (!res.ok) { set({ activeVisit: null }); return; }
                    const data = await res.json();
                    set({ activeVisit: (data && data.visit) ? data : null });
                } catch { set({ activeVisit: null }); }
            },

            fetchStats: async (salesmanId) => {
                const res = await apiFetch(`/visits/stats/${salesmanId}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                return data;
            },
        }),
        { name: 'client-store', partialize: (s) => ({ clients: s.clients, visits: s.visits }) }
    )
);
