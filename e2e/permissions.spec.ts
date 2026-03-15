import { test, expect } from '@playwright/test';

// Before each test, we clear localStorage so we start fresh
test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
});

test.describe('Role Based Access Control E2E', () => {

    test('A standard MANAGER should be blocked from deleting an employee', async ({ page }) => {
        // Mock the AuthStore and MultiCompanyStore state directly to avoid UI login race conditions

        // Let's mock the AuthStore state strictly to avoid flaky network login for this pure UI test
        await page.evaluate(() => {
            const roleStore = window.localStorage.getItem('role-permissions-v2');
            let perms = {};
            if (roleStore) {
                perms = JSON.parse(roleStore).state.permissions['MANAGER'];
            }
            window.localStorage.setItem('auth-storage', JSON.stringify({
                state: {
                    isAuthenticated: true,
                    user: { id: 'test-manager-1', name: 'Test Manager', email: 'manager@smpayroll.com', role: 'MANAGER', companyId: '1' }
                }
            }));
            window.localStorage.setItem('multi-company-store', JSON.stringify({
                state: {
                    companies: [{ id: '1', name: 'SM Payroll System', code: 'SM01', address: 'Test', employeeCount: 1, isActive: true }],
                    currentCompanyId: '1'
                }
            }));
        });

        // Reload to apply mocked state
        await page.reload();

        // Navigate to employees
        await page.goto('/employees');

        // The page should load
        await expect(page.locator('h1', { hasText: 'Employee Directory' })).toBeVisible({ timeout: 10000 });

        // Search for a test employee row, let's say "Ramesh"
        const deleteButton = page.locator('table tr').first().locator('button:has(svg.lucide-trash2)');

        // In this architecture, if you don't have MANAGE_EMPLOYEES permission, the delete button shouldn't exist in the DOM
        // because of `hasPermission(PERMISSIONS.MANAGE_EMPLOYEES) && <button...>` checks in EmployeeList.tsx
        // So we expect the count to be 0 or not visible.
        await expect(deleteButton).toHaveCount(0);
    });

    test('An HR MANAGER should be forcibly kicked out of the Payroll screen', async ({ page }) => {
        // Mock AuthStore state strictly to log in as an HR Role with NO payroll permissions
        await page.evaluate(() => {
            window.localStorage.setItem('auth-storage', JSON.stringify({
                state: {
                    isAuthenticated: true,
                    user: { id: 'hr-1', name: 'HR Staff', email: 'hr@smpayroll.com', role: 'MANAGER', companyId: '1' }
                }
            }));
            window.localStorage.setItem('multi-company-store', JSON.stringify({
                state: {
                    companies: [{ id: '1', name: 'SM Payroll System', code: 'SM01', address: 'Test', employeeCount: 1, isActive: true }],
                    currentCompanyId: '1'
                }
            }));

            // Explicitly deny payroll permission in localStorage cache
            const roleData = {
                state: {
                    permissions: {
                        'MANAGER': ['VIEW_EMPLOYEES', 'VIEW_ATTENDANCE'] // Missing VIEW_PAYROLL
                    },
                    scopes: { 'MANAGER': 'TEAM' }
                }
            };
            window.localStorage.setItem('role-permissions-v2', JSON.stringify(roleData));
        });

        await page.reload();

        // Navigate directly via URL to a restricted admin route
        await page.goto('/payroll');

        // We expect the ProtectedRoute to intercept and redirect to Unauthorized or Dashboard
        // We look for a Toast error or Unauthorized Screen
        await expect(page.locator('body')).toContainText(/Unauthorized|Dashboard/i);
    });
});
