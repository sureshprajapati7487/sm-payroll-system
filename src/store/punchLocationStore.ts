import { create } from 'zustand';
import { useMultiCompanyStore } from './multiCompanyStore';
import { apiFetch } from '@/lib/apiClient';

export interface PunchLocation {
    id: string;
    companyId: string;
    name: string;
    lat: number;
    lng: number;
    radiusMeters: number;
    enabled: boolean;
    /** MAC addresses of allowed Wi-Fi routers. Empty = no restriction. Android WebView only. */
    allowedBSSIDs?: string[];
}

interface PunchLocationState {
    punchLocations: PunchLocation[];
    isLoading: boolean;

    fetchPunchLocations: (companyId: string) => Promise<void>;
    addPunchLocation: (data: Omit<PunchLocation, 'id' | 'companyId'>) => Promise<void>;
    updatePunchLocation: (id: string, data: Partial<Omit<PunchLocation, 'id' | 'companyId'>>) => Promise<void>;
    deletePunchLocation: (id: string) => Promise<void>;
    togglePunchLocationZone: (id: string) => Promise<void>;
}

export const useInternalPunchLocationStore = create<PunchLocationState>((set, get) => ({
    punchLocations: [],
    isLoading: false,

    fetchPunchLocations: async (companyId) => {
        if (!companyId) return;
        set({ isLoading: true });
        try {
            const res = await apiFetch(`/punch-locations?companyId=${companyId}`);
            if (res.ok) {
                const data = await res.json();
                set({ punchLocations: data });
            }
        } catch (error) {
            console.error('Failed to fetch punch locations:', error);
        } finally {
            set({ isLoading: false });
        }
    },

    addPunchLocation: async (data) => {
        const currentCompanyId = useMultiCompanyStore.getState().currentCompanyId;
        if (!currentCompanyId) return;

        try {
            const tempId = `temp-${Date.now()}`;
            const newLocation = {
                ...data,
                companyId: currentCompanyId,
                id: tempId
            };

            set(state => ({ punchLocations: [...state.punchLocations, newLocation as PunchLocation] }));

            const res = await apiFetch(`/punch-locations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newLocation)
            });

            if (res.ok) {
                const saved = await res.json();
                set(state => ({
                    punchLocations: state.punchLocations.map(l => l.id === tempId ? saved : l)
                }));
            }
        } catch (error) {
            console.error('Failed to add punch location:', error);
        }
    },

    updatePunchLocation: async (id, data) => {
        set(state => ({
            punchLocations: state.punchLocations.map(l => l.id === id ? { ...l, ...data } : l),
        }));

        try {
            await apiFetch(`/punch-locations/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch (error) {
            console.error('Failed to update punch location:', error);
        }
    },

    deletePunchLocation: async (id) => {
        set(state => ({ punchLocations: state.punchLocations.filter(l => l.id !== id) }));

        try {
            await apiFetch(`/punch-locations/${id}`, { method: 'DELETE' });
        } catch (error) {
            console.error('Failed to delete punch location:', error);
        }
    },

    togglePunchLocationZone: async (id) => {
        const loc = get().punchLocations.find(l => l.id === id);
        if (!loc) return;

        const newEnabled = !loc.enabled;

        set(state => ({
            punchLocations: state.punchLocations.map(l =>
                l.id === id ? { ...l, enabled: newEnabled } : l
            )
        }));

        try {
            await apiFetch(`/punch-locations/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: newEnabled })
            });
        } catch (error) {
            console.error('Failed to toggle punch location zone:', error);
        }
    }
}));

export const usePunchLocationStore = () => {
    const store = useInternalPunchLocationStore();
    const currentCompanyId = useMultiCompanyStore(s => s.currentCompanyId);

    return {
        ...store,
        punchLocations: store.punchLocations.filter(l => l.companyId === currentCompanyId)
    };
};
