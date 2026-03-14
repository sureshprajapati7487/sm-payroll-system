/**
 * useScopedEmployees — Row-Level Security for Employee Data
 *
 * Returns a filtered employee list based on the current user's role:
 *   - SUPER_ADMIN / ADMIN / ACCOUNT_ADMIN → all employees
 *   - MANAGER → only employees in the same department as the manager
 *   - EMPLOYEE → only themselves (matched by email)
 */

import { useMemo } from 'react';
import { useEmployeeStore } from '@/store/employeeStore';
import { useAuthStore } from '@/store/authStore';
import { Roles } from '@/types';

export const useScopedEmployees = () => {
    const { employees } = useEmployeeStore();
    const { user } = useAuthStore();

    const scopedEmployees = useMemo(() => {
        if (!user) return [];

        // Super Admin, Admin, Account Admin → full access
        if (
            user.role === Roles.SUPER_ADMIN ||
            user.role === Roles.ADMIN ||
            user.role === Roles.ACCOUNT_ADMIN
        ) {
            return employees;
        }

        // Manager → only their own department's employees
        if (user.role === Roles.MANAGER) {
            // Find the manager's employee record by matching email
            const managerRecord = employees.find(e => e.email === user.email);
            if (!managerRecord?.department) return employees; // fallback
            return employees.filter(e => e.department === managerRecord.department);
        }

        // Employee → only themselves (matched by email)
        if (user.role === Roles.EMPLOYEE) {
            return employees.filter(e => e.email === user.email);
        }

        // Fallback — show all
        return employees;
    }, [employees, user]);

    const isScoped =
        user?.role === Roles.MANAGER || user?.role === Roles.EMPLOYEE;

    const scopeLabel = useMemo(() => {
        if (!user) return '';
        if (user.role === Roles.MANAGER) return 'Your Team Only';
        if (user.role === Roles.EMPLOYEE) return 'Your Profile Only';
        return 'All Employees';
    }, [user]);

    return {
        scopedEmployees,
        isScoped,
        scopeLabel,
        totalScoped: scopedEmployees.length,
    };
};
