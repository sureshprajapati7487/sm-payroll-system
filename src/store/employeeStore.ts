import { create } from 'zustand';
import { Employee } from '@/types';
import { useMultiCompanyStore } from './multiCompanyStore';
import { audit } from '@/lib/auditLogger';

interface EmployeeState {
    employees: Employee[];
    isLoading: boolean;

    // Actions
    addEmployee: (employee: Omit<Employee, 'id'>, companyIdOverride?: string) => void;
    updateEmployee: (id: string, updates: Partial<Employee>) => void;
    deleteEmployee: (id: string) => void;
    getEmployeeById: (id: string) => Employee | undefined;
    toggleLeaveBlock: (id: string) => void;
    generateNextCode: () => string;
    fetchEmployees: () => Promise<void>;

    // Internal (for migration/debug)
    _rawEmployees: Employee[];
}

import { apiFetch } from '@/lib/apiClient';

// const API_URL = 'http://localhost:3000/api';

// Internal Store (Holds ALL data)
const useInternalEmployeeStore = create<EmployeeState>((set, get) => ({
    employees: [],
    _rawEmployees: [],
    isLoading: false,

    // NEW: Fetch Action
    fetchEmployees: async () => {
        set({ isLoading: true });
        try {
            const res = await apiFetch(`/employees`);
            const data = await res.json();
            set({
                _rawEmployees: data,
                employees: data, // Keep consistent
                isLoading: false
            });
        } catch (error) {
            console.error('Failed to fetch employees:', error);
            set({ isLoading: false });
        }
    },

    // Modified to handle Company ID
    addEmployee: async (employee, companyIdOverride?: string) => {
        const currentCompanyId = companyIdOverride || useMultiCompanyStore.getState().currentCompanyId;
        if (!currentCompanyId) {
            console.error("No active company selected!");
            return;
        }

        // ✅ Code uniqueness check — across ALL companies (globally unique codes)
        const employeeCode = employee.code?.trim().toUpperCase();
        if (employeeCode) {
            const codeExists = get()._rawEmployees.some(
                e => e.code?.toUpperCase() === employeeCode
            );
            if (codeExists) {
                throw new Error(`Employee code "${employeeCode}" is already in use. Please use a different code.`);
            }
        }

        const newEmployeeModel = {
            ...employee,
            code: employeeCode || employee.code,
            id: Math.random().toString(36).substr(2, 9),
            companyId: currentCompanyId,
            isLeaveBlocked: false,
            leaveBalance: { CASUAL: 12, SICK: 7, PAID: 15, UNPAID: 0 }
        };

        try {
            // skipAuth: true — allows this call without a JWT (needed during company setup)
            const res = await apiFetch(`/employees`, {
                method: 'POST',
                skipAuth: true,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newEmployeeModel)
            });

            let savedEmployee = newEmployeeModel; // default local
            if (res.ok) {
                try { savedEmployee = await res.json(); } catch { }
            }

            set((state) => ({
                _rawEmployees: [...state._rawEmployees, savedEmployee],
                employees: [...state._rawEmployees, savedEmployee]
            }));
            // Audit
            audit({
                action: 'CREATE_EMPLOYEE',
                entityType: 'EMPLOYEE',
                entityId: savedEmployee.id,
                entityName: savedEmployee.name,
                details: { code: savedEmployee.code, department: savedEmployee.department, designation: savedEmployee.designation },
                status: 'SUCCESS',
            });
        } catch (e) {
            audit({ action: 'CREATE_EMPLOYEE', entityType: 'EMPLOYEE', entityName: employee.name as string, details: { error: String(e) }, status: 'FAILED', errorMessage: String(e) });
            console.error("Failed to add employee", e);
            throw e;
        }
    },

    updateEmployee: async (id, updates) => {
        const previous = get()._rawEmployees.find(e => e.id === id);
        // Optimistic Update
        set((state) => {
            const updated = state._rawEmployees.map((emp) =>
                emp.id === id ? { ...emp, ...updates } : emp
            );
            return { _rawEmployees: updated, employees: updated };
        });
        // API Call
        try {
            await apiFetch(`/employees/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            audit({
                action: 'UPDATE_EMPLOYEE',
                entityType: 'EMPLOYEE',
                entityId: id,
                entityName: previous?.name,
                details: { fields: Object.keys(updates) },
                previousValue: previous ? { department: previous.department, designation: previous.designation, status: previous.status, basicSalary: previous.basicSalary } : undefined,
                newValue: { department: updates.department, designation: updates.designation, status: updates.status, basicSalary: updates.basicSalary },
                status: 'SUCCESS',
            });
        } catch (e) {
            audit({ action: 'UPDATE_EMPLOYEE', entityType: 'EMPLOYEE', entityId: id, entityName: previous?.name, details: { error: String(e) }, status: 'FAILED' });
            console.error("Failed to update employee", e);
        }
    },

    deleteEmployee: async (id) => {
        const emp = get()._rawEmployees.find(e => e.id === id);
        // Optimistic update first
        set((state) => {
            const updated = state._rawEmployees.filter((emp) => emp.id !== id);
            return { _rawEmployees: updated, employees: updated };
        });
        try {
            await apiFetch(`/employees/${id}`, { method: 'DELETE' });
            audit({
                action: 'DELETE_EMPLOYEE',
                entityType: 'EMPLOYEE',
                entityId: id,
                entityName: emp?.name,
                details: { code: emp?.code, department: emp?.department },
                status: 'SUCCESS',
            });
        } catch (e) {
            audit({ action: 'DELETE_EMPLOYEE', entityType: 'EMPLOYEE', entityId: id, entityName: emp?.name, details: { error: String(e) }, status: 'FAILED' });
            console.error('Failed to delete employee from backend:', e);
        }
    },

    getEmployeeById: (id) => {
        return get()._rawEmployees.find((emp) => emp.id === id);
    },

    toggleLeaveBlock: (id: string) => {
        set(state => {
            const updated = state._rawEmployees.map(e => e.id === id ? { ...e, isLeaveBlocked: !e.isLeaveBlocked } : e);
            return { _rawEmployees: updated, employees: updated };
        });
    },

    generateNextCode: () => {
        const multiStore = useMultiCompanyStore.getState();
        const currentCompanyId = multiStore.currentCompanyId;
        const currentCompany = multiStore.companies.find(c => c.id === currentCompanyId);
        const prefix = currentCompany ? currentCompany.code.toUpperCase() : 'EMP';

        // Use _rawEmployees so ALL companies' codes are checked for global uniqueness
        // But only filter by current company for sequential numbering
        const companyEmployees = get()._rawEmployees.filter(e => e.companyId === currentCompanyId);

        // Extract existing numbers from codes like "ABC-01", "ABC-02"
        const existingNumbers = new Set(
            companyEmployees
                .map(e => e.code)
                .filter(c => c.startsWith(`${prefix}-`))
                .map(c => {
                    const parts = c.split('-');
                    const num = parseInt(parts[parts.length - 1]);
                    return isNaN(num) ? -1 : num;
                })
                .filter(n => n >= 0)
        );

        if (existingNumbers.size === 0) return `${prefix}-01`;

        // ✅ Gap-filling: find lowest available slot starting from 1
        let next = 1;
        while (existingNumbers.has(next)) {
            next++;
        }

        return `${prefix}-${next.toString().padStart(2, '0')}`;
    }
}));


// Exported Hook (Wraps Internal Store + Filters by Company)
export const useEmployeeStore = () => {
    const store = useInternalEmployeeStore();
    const currentCompanyId = useMultiCompanyStore(s => s.currentCompanyId);

    // Filter employees for the current company
    const filteredEmployees = Array.isArray(store._rawEmployees) ? store._rawEmployees.filter(e => {
        // If data has no companyId (Legacy), show it ONLY if we are in "Legacy Mode" or just show it until migrated.
        // Better: Show Legacy data ONLY if currentCompanyId matches the 'default' or if we want to force migration.
        // User request: "Mene naya kiya toh sab New hona chahiye".
        // So strict filtering: match companyId.
        // Legacy data (undefined companyId) will be HIDDEN in new companies.
        return e.companyId === currentCompanyId;
    }) : [];

    return {
        ...store,
        employees: filteredEmployees,

        // Overwrite Actions to use the store's reference but the filtering is read-only
        // Write actions don't need wrapping as they use ID or create new with correct ID (handled in addEmployee)

        // We expose raw store just in case
        _rawStore: store
    };
};

// Also export getState for non-hook usage (AuthStore needs this!)
// We must be careful. AuthStore used useEmployeeStore.getState().employees.
// The Internal store has ALL employees.
// AuthStore loop: finds user by ID/Email.
// Ideally Auth should check Company ID too? 
// Login is usually Global or Per Company?
// User said "Start me Company Creat".
// If I login as "Aero-01", and that ID exists in Company A.
// If I am in Company B context?
// "Login" happens BEFORE Company? No, Company Setup happens BEFORE.
// But Login page is separate.
// Wait, the User FLOW:
// 1. App Open -> Company Setup (if none).
// 2. Dashboard -> Login?
// Actually the App structure is:
// ProtectedRoute wraps Dashboard.
// Login Page is public.
// When unauthenticated, we go to Login.
// Does Login require Company?
// Default: Global Login? Or Company Specific?
// If "Aero-01" is in Company A.
// If I create Company B, and try to login as "Aero-01"?
// Should fail.
// So AuthStore needs to know Current Company too?
// OR, AuthStore should authenticate against ALL employees, and then SET the current company based on the employee's company?
// BUT User said "Pahle Option aana chahiye Create Company".
// This implies the Admin is setting it up.
// This is an "Admin/Owner" view. not Employee view yet.
// For now, let's stick to: useEmployeeStore exports filtered employees for the VIEW.
// AuthStore might need to check ALL to find the user.
useEmployeeStore.getState = () => useInternalEmployeeStore.getState();
