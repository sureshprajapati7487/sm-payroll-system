import { create } from 'zustand';
import { useMultiCompanyStore } from './multiCompanyStore';
import { apiFetch } from '@/lib/apiClient';

export type DeptSalaryBasis =
    | 'FIXED'          // Monthly fixed salary (HR, Accounts, Security)
    | 'PRODUCTION'     // Based on units/production (Factory floor)
    | 'SALES'          // Commission / target-based (Sales, Marketing)
    | 'DAILY'          // Daily wage workers
    | 'CONTRACTUAL';   // Contract / project-based

export interface Department {
    id: string;
    name: string;
    description: string;
    companyId: string;
    salaryBasis?: DeptSalaryBasis;      // How salary is calculated for this dept
    defaultSalaryType?: 'MONTHLY' | 'DAILY' | 'PER_UNIT'; // Default salary type for new employees
    headCount?: number;                // Optional: target headcount
    costCenter?: string;               // Optional: cost-center code
}

interface DepartmentState {
    departments: Department[];
    isLoading: boolean;
    fetchDepartments: (companyId: string) => Promise<void>;
    addDepartment: (dept: Omit<Department, 'id' | 'companyId'>) => Promise<void>;
    updateDepartment: (id: string, updates: Partial<Omit<Department, 'companyId'>>) => Promise<void>;
    deleteDepartment: (id: string) => Promise<void>;
}

export const useInternalDepartmentStore = create<DepartmentState>((set) => ({
    departments: [],
    isLoading: false,

    fetchDepartments: async (companyId) => {
        if (!companyId) return;
        set({ isLoading: true });
        try {
            const res = await apiFetch(`/departments?companyId=${companyId}`);
            if (res.ok) {
                const data = await res.json();
                set({ departments: data });
            }
        } catch (error) {
            console.error('Failed to fetch departments:', error);
        } finally {
            set({ isLoading: false });
        }
    },

    addDepartment: async (dept) => {
        const currentCompanyId = useMultiCompanyStore.getState().currentCompanyId;
        if (!currentCompanyId) return;

        try {
            const newDept = { ...dept, companyId: currentCompanyId };
            // Optimistic Update
            const tempId = `temp-${Date.now()}`;
            set(state => ({ departments: [...state.departments, { ...newDept, id: tempId } as Department] }));

            const res = await apiFetch(`/departments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newDept, id: Math.random().toString(36).substr(2, 9) })
            });

            if (res.ok) {
                const saved = await res.json();
                set(state => ({
                    departments: state.departments.map(d => d.id === tempId ? saved : d)
                }));
            }
        } catch (error) {
            console.error('Failed to add department', error);
        }
    },

    updateDepartment: async (id, updates) => {
        // Optimistic update
        set((state) => ({
            departments: state.departments.map((d) => (d.id === id ? { ...d, ...updates } : d))
        }));

        try {
            await apiFetch(`/departments/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
        } catch (error) {
            console.error('Failed to update department:', error);
        }
    },

    deleteDepartment: async (id) => {
        // Optimistic delete
        set((state) => ({
            departments: state.departments.filter((d) => d.id !== id)
        }));

        try {
            await apiFetch(`/departments/${id}`, { method: 'DELETE' });
        } catch (error) {
            console.error('Failed to delete department:', error);
        }
    }
}));

export const useDepartmentStore = () => {
    const store = useInternalDepartmentStore();
    const currentCompanyId = useMultiCompanyStore((s) => s.currentCompanyId);

    const filteredDepartments = store.departments.filter((d) => d.companyId === currentCompanyId);

    // Default departments if none exist (Bootstrapping)
    const defaults: Department[] = [
        { id: 'PROD', name: 'Production', description: 'Factory Floor', companyId: currentCompanyId || '', salaryBasis: 'PRODUCTION', defaultSalaryType: 'PER_UNIT' },
        { id: 'HR', name: 'HR', description: 'Human Resources', companyId: currentCompanyId || '', salaryBasis: 'FIXED', defaultSalaryType: 'MONTHLY' },
        { id: 'ACC', name: 'Accounts', description: 'Finance', companyId: currentCompanyId || '', salaryBasis: 'FIXED', defaultSalaryType: 'MONTHLY' },
        { id: 'SALES', name: 'Sales', description: 'Sales & Marketing', companyId: currentCompanyId || '', salaryBasis: 'SALES', defaultSalaryType: 'MONTHLY' },
        { id: 'SEC', name: 'Security', description: 'Security Personnel', companyId: currentCompanyId || '', salaryBasis: 'FIXED', defaultSalaryType: 'MONTHLY' },
    ];

    // Merge defaults with custom departments, prioritized by custom ones if names match
    const finalDepartments = [
        ...defaults.filter(def => !filteredDepartments.some(d => d.name.toLowerCase() === def.name.toLowerCase())),
        ...filteredDepartments
    ];

    return {
        ...store,
        departments: finalDepartments
    };
};
