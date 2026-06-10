import { create } from 'zustand';
import { Employee, EmployeeStatus } from '@/types';
import { useMultiCompanyStore } from './multiCompanyStore';
import { useAuthStore } from './authStore';
import { useRolePermissionsStore } from './rolePermissionsStore';
import { audit } from '@/lib/auditLogger';

interface EmployeeState {
    employees: Employee[];
    isLoading: boolean;

    // Pagination Metadata
    totalCount: number;
    currentPage: number;
    totalPages: number;

    // Actions
    addEmployee: (employee: Omit<Employee, 'id'>, companyIdOverride?: string) => void;
    updateEmployee: (id: string, updates: Partial<Employee>) => void;
    deleteEmployee: (id: string, reason?: string) => void;
    getEmployeeById: (id: string) => Employee | undefined;
    toggleLeaveBlock: (id: string) => void;
    generateNextCode: () => string;
    fetchEmployees: (params?: {
        page?: number; limit?: number; search?: string;
        status?: string; department?: string; shift?: string;
    }) => Promise<void>;

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
    totalCount: 0,
    currentPage: 1,
    totalPages: 1,

    // NEW: Fetch Action
    fetchEmployees: async (params = {}) => {
        const { page = 1, limit = 50, search = '', status, department, shift } = params;
        set({ isLoading: true });
        try {
            const queryParams = new URLSearchParams();
            if (page) queryParams.append('page', page.toString());
            if (limit) queryParams.append('limit', limit.toString());
            if (search) queryParams.append('search', search);
            if (status) queryParams.append('status', status);
            if (department) queryParams.append('department', department);
            if (shift) queryParams.append('shift', shift);

            const res = await apiFetch(`/employees?${queryParams.toString()}`);
            const data = await res.json();

            if (data && data.data) {
                // Paginated response
                set({
                    _rawEmployees: data.data,
                    employees: data.data,
                    totalCount: data.total,
                    currentPage: data.page,
                    totalPages: data.totalPages,
                    isLoading: false
                });
            } else {
                // Backward compatibility if backend doesn't return paginated structure
                set({
                    _rawEmployees: Array.isArray(data) ? data : [],
                    employees: Array.isArray(data) ? data : [],
                    isLoading: false
                });
            }
        } catch (error) {
            console.warn('[employees]', error);
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
            id: crypto.randomUUID(),
            companyId: currentCompanyId,
            isLeaveBlocked: false,
            leaveBalance: { CASUAL: 12, SICK: 7, PAID: 15, UNPAID: 0 }
        };

        try {
            // Include credentials for creating an employee
            const res = await apiFetch(`/employees`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newEmployeeModel)
            });

            let savedEmployee = newEmployeeModel; // default local
            if (res.ok) {
                try { savedEmployee = await res.json(); } catch { }
            }

            set((state) => ({
                _rawEmployees: [...state._rawEmployees, savedEmployee],
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

    deleteEmployee: async (id, reason?) => {
        const emp = get()._rawEmployees.find(e => e.id === id);
        set((state) => ({
            _rawEmployees: state._rawEmployees.map((e) =>
                e.id === id ? { ...e, status: EmployeeStatus.INACTIVE } : e
            ),
        }));
        try {
            await apiFetch(`/employees/${id}`, {
                method: 'DELETE',
                body: reason ? JSON.stringify({ reason }) : undefined,
            });
            audit({
                action: 'DELETE_EMPLOYEE',
                entityType: 'EMPLOYEE',
                entityId: id,
                entityName: emp?.name,
                details: { code: emp?.code, department: emp?.department, reason },
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


// Exported Hook (Wraps Internal Store + Filters by Company and Visibility Scope)
export const useEmployeeStore = () => {
    const store = useInternalEmployeeStore();
    const currentCompanyId = useMultiCompanyStore(s => s.currentCompanyId);
    const user = useAuthStore(s => s.user);
    const getScope = useRolePermissionsStore(s => s.getScope);

    // Filter employees for the current company AND user's Data Visibility Level
    const filteredEmployees = Array.isArray(store._rawEmployees) ? store._rawEmployees.filter(e => {
        // 1. Must match current company (hard rule)
        if (e.companyId !== currentCompanyId) return false;

        // 2. Data Visibility Rule (based on Super Admin config)
        if (!user) return true; // Safe fallback if accessed outside auth context

        const scope = getScope(user.role);
        if (scope === 'ALL') return true;

        if (scope === 'TEAM') {
            const userEmp = store._rawEmployees.find(emp => emp.id === user.id);
            if (!userEmp?.department) return e.id === user.id; // Fallback to OWN
            return e.department === userEmp.department;
        }

        if (scope === 'OWN') return e.id === user.id;

        return false;
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

// getState exposes the internal (unfiltered) store for non-hook usage
useEmployeeStore.getState = () => useInternalEmployeeStore.getState();
