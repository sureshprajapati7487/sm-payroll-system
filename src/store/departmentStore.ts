import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useMultiCompanyStore } from './multiCompanyStore';

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
    addDepartment: (dept: Omit<Department, 'id' | 'companyId'>) => void;
    updateDepartment: (id: string, updates: Partial<Omit<Department, 'companyId'>>) => void;
    deleteDepartment: (id: string) => void;
}

const useInternalDepartmentStore = create<DepartmentState>()(
    persist(
        (set) => ({
            departments: [],
            addDepartment: (dept) => {
                const currentCompanyId = useMultiCompanyStore.getState().currentCompanyId;
                if (!currentCompanyId) return;

                const newDept: Department = {
                    ...dept,
                    id: Math.random().toString(36).substr(2, 9),
                    companyId: currentCompanyId
                };
                set((state) => ({ departments: [...state.departments, newDept] }));
            },
            updateDepartment: (id, updates) => {
                set((state) => ({
                    departments: state.departments.map((d) => (d.id === id ? { ...d, ...updates } : d))
                }));
            },
            deleteDepartment: (id) => {
                set((state) => ({
                    departments: state.departments.filter((d) => d.id !== id)
                }));
            }
        }),
        {
            name: 'department-storage'
        }
    )
);

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
