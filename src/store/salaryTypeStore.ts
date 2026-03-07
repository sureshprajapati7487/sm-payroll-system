import { create } from 'zustand';
import { useMultiCompanyStore } from './multiCompanyStore';
import { apiFetch } from '@/lib/apiClient';

export interface SalaryType {
    id: string;
    companyId: string;
    key: string;
    label: string;
    description: string;
    basis: 'MONTHLY' | 'DAILY' | 'PER_UNIT' | 'WEEKLY' | 'OTHER';
}

interface SalaryTypeState {
    salaryTypes: SalaryType[];
    isLoading: boolean;

    fetchSalaryTypes: (companyId: string) => Promise<void>;
    addSalaryType: (data: Omit<SalaryType, 'id' | 'companyId'>) => Promise<void>;
    updateSalaryType: (id: string, data: Partial<Omit<SalaryType, 'id' | 'companyId'>>) => Promise<void>;
    deleteSalaryType: (id: string) => Promise<void>;
}

export const useInternalSalaryTypeStore = create<SalaryTypeState>((set) => ({
    salaryTypes: [],
    isLoading: false,

    fetchSalaryTypes: async (companyId) => {
        if (!companyId) return;
        set({ isLoading: true });
        try {
            const res = await apiFetch(`/salary-types?companyId=${companyId}`);
            if (res.ok) {
                const data = await res.json();
                set({ salaryTypes: data });
            }
        } catch (error) {
            console.error('Failed to fetch salary types:', error);
        } finally {
            set({ isLoading: false });
        }
    },

    addSalaryType: async (data) => {
        const currentCompanyId = useMultiCompanyStore.getState().currentCompanyId;
        if (!currentCompanyId) return;

        try {
            const tempId = `temp-${Date.now()}`;
            const newST = {
                ...data,
                companyId: currentCompanyId,
                id: tempId
            };

            set(state => ({ salaryTypes: [...state.salaryTypes, newST as SalaryType] }));

            const res = await apiFetch(`/salary-types`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId: currentCompanyId,
                    key: data.key.toUpperCase().replace(/\s+/g, '_'),
                    label: data.label,
                    description: data.description,
                    basis: data.basis
                })
            });

            if (res.ok) {
                const saved = await res.json();
                set(state => ({
                    salaryTypes: state.salaryTypes.map(st => st.id === tempId ? saved : st)
                }));
            }
        } catch (error) {
            console.error('Failed to add salary type:', error);
        }
    },

    updateSalaryType: async (id, data) => {
        set(state => ({
            salaryTypes: state.salaryTypes.map(st => st.id === id ? { ...st, ...data } : st),
        }));

        try {
            const updatePayload = { ...data };
            if (data.key) updatePayload.key = data.key.toUpperCase().replace(/\s+/g, '_');

            await apiFetch(`/salary-types/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatePayload)
            });
        } catch (error) {
            console.error('Failed to update salary type:', error);
        }
    },

    deleteSalaryType: async (id) => {
        set(state => ({ salaryTypes: state.salaryTypes.filter(st => st.id !== id) }));

        try {
            await apiFetch(`/salary-types/${id}`, { method: 'DELETE' });
        } catch (error) {
            console.error('Failed to delete salary type:', error);
        }
    }
}));

export const useSalaryTypeStore = () => {
    const store = useInternalSalaryTypeStore();
    const currentCompanyId = useMultiCompanyStore(s => s.currentCompanyId);

    return {
        ...store,
        salaryTypes: store.salaryTypes.filter(st => st.companyId === currentCompanyId)
    };
};
