import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Shift } from '@/types';
import { useMultiCompanyStore } from './multiCompanyStore';

interface ShiftState {
    shifts: Shift[];
    addShift: (shift: Omit<Shift, 'id' | 'companyId'>) => void;
    updateShift: (id: string, updates: Partial<Omit<Shift, 'companyId'>>) => void; // Added update
    removeShift: (id: string) => void;
    getShift: (id: string) => Shift | undefined;
}

// Export for direct store access (getState)
export const useInternalShiftStore = create<ShiftState>()(
    persist(
        (set, get) => ({
            shifts: [],
            addShift: (shift) => {
                const currentCompanyId = useMultiCompanyStore.getState().currentCompanyId;
                if (!currentCompanyId) return;

                const newShift: Shift = {
                    ...shift,
                    id: Math.random().toString(36).substr(2, 9),
                    companyId: currentCompanyId
                };
                set(state => ({ shifts: [...state.shifts, newShift] }));
            },
            updateShift: (id, updates) => {
                set(state => ({
                    shifts: state.shifts.map(s => s.id === id ? { ...s, ...updates } : s)
                }));
            },
            removeShift: (id) => {
                set(state => ({ shifts: state.shifts.filter(s => s.id !== id) }));
            },
            getShift: (id) => {
                return get().shifts.find(s => s.id === id);
            }
        }),
        {
            name: 'shift-storage'
        }
    )
);

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

    // Merge defaults with custom shifts, prioritized by custom ones if names match
    const finalShifts = [
        ...defaults.filter(def => !filteredShifts.some(s => s.name.toLowerCase() === def.name.toLowerCase())),
        ...filteredShifts
    ];

    return {
        ...store,
        shifts: finalShifts
    };
};
