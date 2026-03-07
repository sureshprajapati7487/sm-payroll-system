import { create } from 'zustand';
import { ProductionItem } from '@/types';
import { apiFetch } from '@/lib/apiClient';

interface RateState {
    items: ProductionItem[];
    isLoading: boolean;
    fetchItems: (companyId: string) => Promise<void>;
    addItem: (item: Omit<ProductionItem, 'id'>) => Promise<void>;
    updateItem: (id: string, updates: Partial<ProductionItem>) => Promise<void>;
    removeItem: (id: string) => Promise<void>;
    getItem: (id: string) => ProductionItem | undefined;
}

export const useRateStore = create<RateState>((set, get) => ({
    items: [],
    isLoading: false,

    fetchItems: async (companyId) => {
        set({ isLoading: true });
        try {
            const res = await apiFetch(`/production/items/all?companyId=${companyId}`);
            if (res.ok) set({ items: await res.json() });
        } catch (err) {
            console.error('Failed to fetch production items:', err);
        } finally {
            set({ isLoading: false });
        }
    },

    addItem: async (item) => {
        const newItem: ProductionItem = {
            ...item,
            id: Math.random().toString(36).substr(2, 9)
        };
        // Optimistic update
        set(state => ({ items: [...state.items, newItem] }));
        try {
            const res = await apiFetch(`/production/items/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newItem),
            });
            if (res.ok) {
                const saved = await res.json();
                set(state => ({ items: state.items.map(i => i.id === newItem.id ? { ...newItem, ...saved } : i) }));
            }
        } catch (err) {
            console.error('Failed to save production item:', err);
        }
    },

    updateItem: async (id, updates) => {
        // Optimistic update
        set(state => ({
            items: state.items.map(item => item.id === id ? { ...item, ...updates } : item)
        }));
        try {
            await apiFetch(`/production/items/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
        } catch (err) {
            console.error('Failed to update production item:', err);
        }
    },

    removeItem: async (id) => {
        const previous = get().items;
        set(state => ({ items: state.items.filter(item => item.id !== id) }));
        try {
            const res = await apiFetch(`/production/items/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
        } catch (err) {
            console.error('Failed to delete production item:', err);
            set({ items: previous });
        }
    },

    getItem: (id) => {
        return get().items.find(item => item.id === id);
    }
}));
