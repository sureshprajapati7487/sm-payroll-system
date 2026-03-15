import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuthStore } from '@/store/authStore';
import { useRolePermissionsStore } from '@/store/rolePermissionsStore';
import { Roles } from '@/types';
import { PERMISSIONS } from '@/config/permissions';

// Mock the components
const MockDashboard = () => <div data-testid="dashboard-page">Dashboard</div>;
const MockPayroll = () => <div data-testid="payroll-page">Payroll Access Granted</div>;
const MockUnauthorized = () => <div data-testid="unauthorized-page">Unauthorized Access</div>;

describe('ProtectedRoute Integration Tests', () => {

    beforeEach(() => {
        useAuthStore.getState().logout();
        useRolePermissionsStore.getState().resetAll();
    });

    const renderWithRouter = (initialRoute: string) => {
        return render(
            <MemoryRouter initialEntries={[initialRoute]}>
                <Routes>
                    <Route path="/login" element={<div data-testid="login-page">Login</div>} />
                    <Route path="/unauthorized" element={<MockUnauthorized />} />

                    {/* Protected routes */}
                    <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.NAV_DASHBOARD} />}>
                        <Route path="/dashboard" element={<MockDashboard />} />
                    </Route>

                    {/* Admin only route */}
                    <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.VIEW_PAYROLL} />}>
                        <Route path="/payroll" element={<MockPayroll />} />
                    </Route>
                </Routes>
            </MemoryRouter>
        );
    };

    it('Should redirect to /login if user is not authenticated', () => {
        renderWithRouter('/dashboard');
        // Unauthenticated users hit ProtectedRoute -> Navigate to /login
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
        expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
    });

    it('Should allow access to /dashboard for an authenticated EMPLOYEE', () => {
        useAuthStore.setState({
            user: { id: 'test', email: 'test@sm.com', name: 'Test', role: Roles.EMPLOYEE },
            isAuthenticated: true,
            hasPermission: (perm) => useRolePermissionsStore.getState().hasPermission(Roles.EMPLOYEE, perm)
        });

        renderWithRouter('/dashboard');

        // Employee has NAV_DASHBOARD, should render perfectly
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });

    it('Should block an EMPLOYEE from accessing /payroll and redirect to /unauthorized', () => {
        useAuthStore.setState({
            user: { id: 'test', email: 'test@sm.com', name: 'Test', role: Roles.EMPLOYEE },
            isAuthenticated: true,
            hasPermission: (perm) => useRolePermissionsStore.getState().hasPermission(Roles.EMPLOYEE, perm)
        });

        renderWithRouter('/payroll');

        // Employee does NOT have VIEW_PAYROLL. Should block and redirect to unauthorized.
        expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument();
        expect(screen.queryByTestId('payroll-page')).not.toBeInTheDocument();
    });

    it('Should allow a SUPER_ADMIN to access /payroll seamlessly via god mode', () => {
        useAuthStore.setState({
            user: { id: 'test', email: 'admin@sm.com', name: 'Admin', role: Roles.SUPER_ADMIN },
            isAuthenticated: true,
            hasPermission: (perm) => useRolePermissionsStore.getState().hasPermission(Roles.SUPER_ADMIN, perm)
        });

        renderWithRouter('/payroll');

        // Super Admin bypasses all checks via God Mode implementation
        expect(screen.getByTestId('payroll-page')).toBeInTheDocument();
    });
});
