// Data Masking Utilities for Phase 15

import { DataMaskingRule } from '@/types/audit';

/**
 * Masks sensitive data based on user role
 */
export class DataMasker {
    /**
     * Mask bank account number
     * Example: "1234567890" -> "******7890"
     */
    static maskBankAccount(accountNumber: string, allowedRoles: string[], userRole: string): string {
        if (allowedRoles.includes(userRole)) {
            return accountNumber; // Show full for allowed roles
        }

        if (!accountNumber || accountNumber.length < 4) return '****';

        return '*'.repeat(accountNumber.length - 4) + accountNumber.slice(-4);
    }

    /**
     * Mask Aadhaar number
     * Example: "1234 5678 9012" -> "XXXX XXXX 9012"
     */
    static maskAadhaar(aadhaar: string, allowedRoles: string[], userRole: string): string {
        if (allowedRoles.includes(userRole)) {
            return aadhaar;
        }

        const cleaned = aadhaar.replace(/\s/g, '');
        if (cleaned.length !== 12) return 'XXXX XXXX XXXX';

        return 'XXXX XXXX ' + cleaned.slice(-4);
    }

    /**
     * Mask PAN number
     * Example: "ABCDE1234F" -> "***DE1234*"
     */
    static maskPAN(pan: string, allowedRoles: string[], userRole: string): string {
        if (allowedRoles.includes(userRole)) {
            return pan;
        }

        if (pan.length !== 10) return '**********';

        return '***' + pan.slice(3, 9) + '*';
    }

    /**
     * Mask phone number
     * Example: "9876543210" -> "******3210"
     */
    static maskPhone(phone: string, allowedRoles: string[], userRole: string): string {
        if (allowedRoles.includes(userRole)) {
            return phone;
        }

        if (phone.length < 4) return '****';

        return '*'.repeat(phone.length - 4) + phone.slice(-4);
    }

    /**
     * Mask email
     * Example: "john.doe@example.com" -> "j***@example.com"
     */
    static maskEmail(email: string, allowedRoles: string[], userRole: string): string {
        if (allowedRoles.includes(userRole)) {
            return email;
        }

        const [local, domain] = email.split('@');
        if (!local || !domain) return '***@***';

        return local[0] + '***' + '@' + domain;
    }

    /**
     * Mask salary/amount
     * Shows only range for non-admins
     */
    static maskSalary(amount: number, allowedRoles: string[], userRole: string): string {
        if (allowedRoles.includes(userRole)) {
            return amount.toLocaleString('en-IN');
        }

        // Show range instead of exact amount
        if (amount < 20000) return '< ₹20,000';
        if (amount < 50000) return '₹20,000 - ₹50,000';
        if (amount < 100000) return '₹50,000 - ₹1,00,000';
        return '> ₹1,00,000';
    }

    /**
     * Generic masking function
     */
    static maskData(
        data: string | number,
        rule: DataMaskingRule,
        userRole: string
    ): string | number {
        // Check if user role is allowed to see unmasked data
        if (rule.allowedRoles.includes(userRole)) {
            return data;
        }

        const strData = String(data);

        switch (rule.maskType) {
            case 'FULL':
                return '*'.repeat(strData.length);

            case 'PARTIAL':
                const visibleChars = rule.visibleChars || 4;
                if (strData.length <= visibleChars) {
                    return '*'.repeat(strData.length);
                }
                return '*'.repeat(strData.length - visibleChars) + strData.slice(-visibleChars);

            case 'HASH':
                // Simple hash representation
                return '#'.repeat(8);

            default:
                return strData;
        }
    }

    /**
     * Mask employee sensitive data
     */
    static maskEmployeeData(employee: any, userRole: string) {
        const adminRoles = ['SUPER_ADMIN', 'ADMIN'];
        const hrRoles = ['SUPER_ADMIN', 'ADMIN', 'HR'];

        return {
            ...employee,
            phone: this.maskPhone(employee.phone || '', adminRoles, userRole),
            email: employee.email, // Keep email visible for communication
            bankDetails: employee.bankDetails ? {
                ...employee.bankDetails,
                accountNumber: this.maskBankAccount(
                    employee.bankDetails.accountNumber || '',
                    adminRoles,
                    userRole
                )
            } : undefined,
            documents: employee.documents ? {
                aadharUrl: employee.documents.aadharUrl,
                panUrl: employee.documents.panUrl,
                // Don't show actual document URLs to non-admin
                ...(adminRoles.includes(userRole) ? {} : {
                    aadharUrl: employee.documents.aadharUrl ? '[PROTECTED]' : undefined,
                    panUrl: employee.documents.panUrl ? '[PROTECTED]' : undefined
                })
            } : undefined,
            basicSalary: hrRoles.includes(userRole)
                ? employee.basicSalary
                : this.maskSalary(employee.basicSalary, hrRoles, userRole)
        };
    }
}

/**
 * Hook to use data masking
 */
export const useDataMasking = (userRole: string) => {
    return {
        maskBankAccount: (account: string) =>
            DataMasker.maskBankAccount(account, ['SUPER_ADMIN', 'ADMIN'], userRole),

        maskAadhaar: (aadhaar: string) =>
            DataMasker.maskAadhaar(aadhaar, ['SUPER_ADMIN', 'ADMIN'], userRole),

        maskPAN: (pan: string) =>
            DataMasker.maskPAN(pan, ['SUPER_ADMIN', 'ADMIN'], userRole),

        maskPhone: (phone: string) =>
            DataMasker.maskPhone(phone, ['SUPER_ADMIN', 'ADMIN'], userRole),

        maskEmail: (email: string) =>
            DataMasker.maskEmail(email, ['SUPER_ADMIN', 'ADMIN'], userRole),

        maskSalary: (amount: number) =>
            DataMasker.maskSalary(amount, ['SUPER_ADMIN', 'ADMIN', 'HR'], userRole),

        maskEmployeeData: (employee: any) =>
            DataMasker.maskEmployeeData(employee, userRole)
    };
};
