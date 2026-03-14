/**
 * useDataMask — Sensitive Data Masking Utility
 *
 * Role-aware masking for PII fields: Aadhaar, PAN, Bank Account.
 * Usage:
 *   const { maskAadhaar, maskPAN, maskAccount } = useDataMask();
 *   <span>{maskAadhaar(employee.aadhaar)}</span>
 */

import { useAuthStore } from '@/store/authStore';
import { PERMISSIONS } from '@/config/permissions';

export const useDataMask = () => {
    const { hasPermission } = useAuthStore();

    const canViewBank = hasPermission(PERMISSIONS.VIEW_EMPLOYEE_BANK);
    const canViewSalary = hasPermission(PERMISSIONS.VIEW_EMPLOYEE_SALARY);
    const canViewPersonal = hasPermission(PERMISSIONS.VIEW_EMPLOYEE_PERSONAL);

    /**
     * Mask Aadhaar number — show only last 4 digits
     * Authorized: XXXX-XXXX-1234  |  Unauthorized: ••••-••••-••••
     */
    const maskAadhaar = (aadhaar?: string | null): string => {
        if (!aadhaar) return '—';
        if (!canViewPersonal) return '••••-••••-••••';
        const digits = aadhaar.replace(/\D/g, '');
        if (digits.length !== 12) return '••••-••••-••••';
        return `XXXX-XXXX-${digits.slice(-4)}`;
    };

    /**
     * Mask PAN card — show category + last 4 chars
     * Authorized: ABCDE####F  |  Unauthorized: ••••••••••
     */
    const maskPAN = (pan?: string | null): string => {
        if (!pan) return '—';
        if (!canViewPersonal) return '••••••••••';
        const clean = pan.trim().toUpperCase();
        if (clean.length !== 10) return '••••••••••';
        return `${clean.slice(0, 5)}####${clean.slice(-1)}`;
    };

    /**
     * Mask bank account number — show only last 4 digits
     * Authorized (VIEW_EMPLOYEE_BANK): ••••-••••-1234
     * Unauthorized: ••••-••••-••••
     */
    const maskAccount = (accountNo?: string | null): string => {
        if (!accountNo) return '—';
        const last4 = accountNo.slice(-4);
        if (!canViewBank) return '••••-••••-••••';
        return `••••-••••-${last4}`;
    };

    /**
     * Mask IFSC code — show bank prefix only
     * Authorized: SBIN0001234  |  Unauthorized: ••••-•••••••
     */
    const maskIFSC = (ifsc?: string | null): string => {
        if (!ifsc) return '—';
        if (!canViewBank) return `${(ifsc?.slice(0, 4) || '••••')}•••••••`;
        return ifsc;
    };

    /**
     * Mask salary amount — hide if no VIEW_EMPLOYEE_SALARY
     * Authorized: ₹25,000  |  Unauthorized: ₹••,•••
     */
    const maskSalary = (amount?: number | null): string => {
        if (amount === null || amount === undefined) return '—';
        if (!canViewSalary) return '₹••,•••';
        return `₹${amount.toLocaleString('en-IN')}`;
    };

    return {
        maskAadhaar,
        maskPAN,
        maskAccount,
        maskIFSC,
        maskSalary,
        canViewBank,
        canViewSalary,
        canViewPersonal,
    };
};
