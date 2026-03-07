import { create } from 'zustand';
import { Shift } from '@/types';
import { useMultiCompanyStore } from './multiCompanyStore';
import { apiFetch } from '@/lib/apiClient';

interface ShiftState {
    shifts: Shift[];
    isLoading: boolean;
    fetchShifts: (companyId: string) => Promise<void>;
    addShift: (shift: Omit<Shift, 'id' | 'companyId'>) => Promise<void>;
    updateShift: (id: string, updates: Partial<Omit<Shift, 'companyId'>>) => Promise<void>;
    removeShift: (id: string) => Promise<void>;
    getShift: (id: string) => Shift | undefined;
}

export const useInternalShiftStore = create<ShiftState>((set, get) => ({
    shifts: [],
    isLoading: false,

    fetchShifts: async (companyId) => {
        if (!companyId) return;
        set({ isLoading: true });
        try {
            const res = await apiFetch(`/shifts?companyId=${companyId}`);
            if (res.ok) {
                const data = await res.json();
                set({ shifts: data });
            }
        } catch (error) {
            console.error('Failed to fetch shifts:', error);
        } finally {
            set({ isLoading: false });
        }
    },

    addShift: async (shift) => {
        const currentCompanyId = useMultiCompanyStore.getState().currentCompanyId;
        if (!currentCompanyId) return;

        try {
            const newShift = { ...shift, companyId: currentCompanyId };
            const tempId = `temp-${Date.now()}`;
            set(state => ({ shifts: [...state.shifts, { ...newShift, id: tempId } as Shift] }));

            const res = await apiFetch(`/shifts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newShift, id: Math.random().toString(36).substr(2, 9) })
            });

            if (res.ok) {
                const saved = await res.json();
                set(state => ({
                    shifts: state.shifts.map(s => s.id === tempId ? saved : s)
                }));
            }
        } catch (error) {
            console.error('Failed to add shift', error);
        }
    },

    updateShift: async (id, updates) => {
        set(state => ({
            shifts: state.shifts.map(s => s.id === id ? { ...s, ...updates } : s)
        }));

        try {
            await apiFetch(`/shifts/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
        } catch (error) {
            console.error('Failed to update shift:', error);
        }
    },

    removeShift: async (id) => {
        set(state => ({ shifts: state.shifts.filter(s => s.id !== id) }));
        try {
            await apiFetch(`/shifts/${id}`, { method: 'DELETE' });
        } catch (error) {
            console.error('Failed to delete shift:', error);
        }
    },

    getShift: (id) => {
        return get().shifts.find(s => s.id === id);
    }
}));

export const useShiftStore = () => {
    const store = useInternalShiftStore();
    const currentCompanyId = useMultiCompanyStore(s => s.currentCompanyId);

    const filteredShifts = store.shifts.filter(s => s.companyId === currentCompanyId);

    // Default shifts if none exist
    const defaults: Shift[] = [
        { id: 'GENERAL', companyId: currentCompanyId || '', name: 'General Shift', startTime: '09:00', endTime: '18:00', graceTimeMinutes: 15 },
        { id: 'MORNING', companyId: currentCompanyId || '', name: 'Morning Shift', startTime: '06:00', endTime: '14:00', graceTimeMinutes: 10 },
        { id: 'NIGHT', companyId: currentCompanyId || '', name: 'Night Shift', startTime: '20:00', endTime: '05:00', graceTimeMinutes: 20 }
    ];

    const finalShifts = [
        ...defaults.filter(def => !filteredShifts.some(s => s.name.toLowerCase() === def.name.toLowerCase())),
        ...filteredShifts
    ];

    return {
        ...store,
        shifts: finalShifts
    };
};
