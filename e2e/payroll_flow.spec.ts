import { test, expect } from '@playwright/test';

test('Full payroll run flow', async ({ page }) => {
    // 1. Login as admin
    await page.goto('http://localhost:5173');
    await page.fill('[data-testid="login-id"]', 'ACLLP-01');
    await page.fill('[data-testid="login-password"]', '8824834657@AA');
    await page.click('[data-testid="login-submit"]');

    // 2. Navigate to payroll
    await page.goto('http://localhost:5173/payroll');
    await expect(page).toHaveURL(/payroll/);

    // 3. Verify page loads
    await expect(page.locator('h1, h2').first()).toBeVisible();
});
