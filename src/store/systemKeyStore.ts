import { create } from 'zustand';

export interface SystemKey {
    id: string;
    companyId: string;
    key: string;
    label: string;
    value: string;
    category: 'PAYROLL' | 'ATTENDANCE' | 'LEAVES' | 'GENERAL' | 'SECURITY';
    description: string;
    isSecret: boolean;
}

interface SystemKeyStore {
    keys: SystemKey[];
    loading: boolean;
    error: string | null;
    fetchKeys: (companyId: string) => Promise<void>;
    addKey: (data: Omit<SystemKey, 'id' | 'companyId'> & { companyId: string }) => Promise<void>;
    updateKey: (id: string, data: Partial<SystemKey>) => Promise<void>;
    deleteKey: (id: string) => Promise<void>;
}

export const useInternalSystemKeyStore = create<SystemKeyStore>((set, get) => ({
    keys: [],
    loading: false,
    error: null,

    fetchKeys: async (companyId: string) => {
        set({ loading: true, error: null });
        try {
            const res = await fetch(`/api/system-keys?companyId=${companyId}`);
            if (!res.ok) throw new Error('Failed to fetch system keys');
            const data = await res.json();
            set({ keys: data });
        } catch (err: any) {
            set({ error: err.message });
            console.error(err);
        } finally {
            set({ loading: false });
        }
    },

    addKey: async (data) => {
        const tempId = Math.random().toString(36).substr(2, 9);
        const tempKey: SystemKey = { ...data, id: tempId };

        // Optimistic update
        set(state => ({ keys: [...state.keys, tempKey] }));

        try {
            const res = await fetch('/api/system-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to add system key');
            const saved = await res.json();

            // Swap temp with real
            set(state => ({
                keys: state.keys.map(k => k.id === tempId ? saved : k)
            }));
        } catch (err: any) {
            // Revert
            set(state => ({ keys: state.keys.filter(k => k.id !== tempId), error: err.message }));
            console.error(err);
        }
    },

    updateKey: async (id: string, data: Partial<SystemKey>) => {
        // Optimistic update
        set(state => ({
            keys: state.keys.map(k => k.id === id ? { ...k, ...data } : k)
        }));

        try {
            const res = await fetch(`/api/system-keys/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to update system key');
        } catch (err: any) {
            console.error(err);
            set({ error: err.message });
            // Ideally trigger a re-fetch here if we cared about strict rollback
        }
    },

    deleteKey: async (id: string) => {
        const oldState = get().keys;
        // Optimistic delete
        set(state => ({ keys: state.keys.filter(k => k.id !== id) }));

        try {
            const res = await fetch(`/api/system-keys/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete system key');
        } catch (err: any) {
            // Revert
            set({ keys: oldState, error: err.message });
            console.error(err);
        }
    }
}));

// Helper hook to auto-filter by current company
import { useMultiCompanyStore } from './multiCompanyStore';

export const useSystemKeyStore = () => {
    const store = useInternalSystemKeyStore();
    const currentCompanyId = useMultiCompanyStore(s => s.currentCompanyId);

    return {
        ...store,
        keys: store.keys.filter(k => k.companyId === currentCompanyId),
        addKey: (data: Omit<SystemKey, 'id' | 'companyId'>) => {
            if (!currentCompanyId) throw new Error('No company selected');
            return store.addKey({ ...data, companyId: currentCompanyId });
        },
        // We override fetchKeys to automatically inject the current company
        fetchKeys: () => {
            if (currentCompanyId) return store.fetchKeys(currentCompanyId);
        }
    };
};
