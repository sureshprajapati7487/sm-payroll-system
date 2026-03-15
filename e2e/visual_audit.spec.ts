import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.use({ ignoreHTTPSErrors: true });

test('Capture Super Admin Dashboard', async ({ page }) => {
    // 1. Mock state directly to bypass login and company setup
    const authState = {
        state: {
            user: {
                id: 'superadmin-123',
                name: 'System Admin',
                email: 'admin@smpayroll.com',
                role: 'SUPER_ADMIN',
                status: 'ACTIVE'
            },
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InN1cGVyYWRtaW4tMTIzIiwiZXhwIjo5OTk5OTk5OTk5fQ.signature',
            isAuthenticated: true,
            tokenExpiresAt: Date.now() + 86400000
        },
        version: 0
    };

    const companyState = {
        state: {
            currentCompanyId: 'company-1',
            companies: [
                { id: 'company-1', name: 'SM Payroll Test' }
            ]
        },
        version: 0
    };

    // Go to a blank page first to set localStorage
    await page.goto('https://localhost:5173');

    await page.evaluate(({ auth, comp }) => {
        localStorage.setItem('auth-storage', JSON.stringify(auth));
        localStorage.setItem('multi-company-store', JSON.stringify(comp));
    }, { auth: authState, comp: companyState });

    // 2. Navigate to dashboard
    await page.goto('https://localhost:5173/dashboard');

    // 3. Wait for dashboard to load
    await page.waitForSelector('text=Dashboard', { timeout: 10000 });

    // 4. Force sidebar to expand if needed (in case it is mobile or collapsed)
    // Try to click the hamburger menu if it's visible on smaller screens, or just take a full page screenshot

    // Expand all sidebar subgroups
    await page.evaluate(() => {
        const buttons = document.querySelectorAll('nav button');
        buttons.forEach((btn: any) => btn.click());
    });

    await page.waitForTimeout(1000); // let animations finish

    // 5. Take Screenshot
    await page.screenshot({ path: 'C:/Users/SURESH KUMAR/.gemini/antigravity/brain/4c094d55-ea86-4cad-a370-0b423d2a7740/super_admin_dashboard_full.png', fullPage: true });
});
