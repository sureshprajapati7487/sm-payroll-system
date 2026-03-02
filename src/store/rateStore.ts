import { create } from 'zustand';
import { ProductionItem } from '@/types';

interface RateState {
    items: ProductionItem[];
    addItem: (item: Omit<ProductionItem, 'id'>) => void;
    updateItem: (id: string, updates: Partial<ProductionItem>) => void;
    removeItem: (id: string) => void;
    getItem: (id: string) => ProductionItem | undefined;
}

export const useRateStore = create<RateState>((set, get) => ({
    items: [
        { id: '1', name: 'Stitching Full Shirt', rate: 25, category: 'Stitching' },
        { id: '2', name: 'Stitching Half Shirt', rate: 20, category: 'Stitching' },
        { id: '3', name: 'Trouser Stitching', rate: 40, category: 'Stitching' },
        { id: '4', name: 'Packing (Per Piece)', rate: 2, category: 'Packing' },
        { id: '5', name: 'Ironing', rate: 5, category: 'Finishing' },
    ], // Initial mock data

    addItem: (item) => {
        const newItem: ProductionItem = {
            ...item,
            id: Math.random().toString(36).substr(2, 9)
        };
        set(state => ({ items: [...state.items, newItem] }));
    },

    updateItem: (id, updates) => {
        set(state => ({
            items: state.items.map(item => item.id === id ? { ...item, ...updates } : item)
        }));
    },

    removeItem: (id) => {
        set(state => ({ items: state.items.filter(item => item.id !== id) }));
    },

    getItem: (id) => {
        return get().items.find(item => item.id === id);
    }
}));
